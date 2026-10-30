// Password hashing (scrypt) and server-side sessions stored as HMAC hashes.
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config.js";
import { db, nowIso } from "./db.js";
import { HttpError, baseCookieOptions, issueCsrf } from "./security.js";

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };
export const SESSION_COOKIE = "fl_session";

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password.normalize("NFKC"), salt, SCRYPT.keylen, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const [algo, N, r, p, saltB64, hashB64] = String(stored).split("$");
  if (algo !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
  });
  return timingSafeEqual(actual, expected);
}

// Used when an email is unknown so that response time does not reveal which accounts exist.
const dummyHashPromise = hashPassword(randomBytes(16).toString("hex"));
export const verifyAgainstDummy = async (password) => verifyPassword(password, await dummyHashPromise);

const hashToken = (token) => createHmac("sha256", config.sessionSecret).update(`session:${token}`).digest("hex");

const statements = {
  insertSession: db.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ),
  findSession: db.prepare(`
    SELECT s.token_hash, s.expires_at, u.id, u.email, u.name, u.plan, u.trial_ends_at, u.daily_rate, u.location, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `),
  deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
  deleteOtherSessions: db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?"),
  deleteExpired: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),
  disciplines: db.prepare("SELECT discipline FROM user_disciplines WHERE user_id = ? ORDER BY rowid"),
};

/** Create a fresh session (never reuse one: prevents session fixation) and set its cookie. */
export function startSession(res, userId) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + config.sessionTtlDays * 86_400_000);
  statements.insertSession.run(tokenHash, userId, nowIso(), expires.toISOString());
  res.cookie(SESSION_COOKIE, token, { ...baseCookieOptions, httpOnly: true, expires });
  issueCsrf(res, tokenHash);
  return tokenHash;
}

export function endSession(req, res) {
  if (req.session) statements.deleteSession.run(req.session.tokenHash);
  res.clearCookie(SESSION_COOKIE, { ...baseCookieOptions, httpOnly: true });
  issueCsrf(res, "anon");
}

export const revokeOtherSessions = (userId, keepTokenHash) =>
  statements.deleteOtherSessions.run(userId, keepTokenHash);

export function purgeExpiredSessions() {
  statements.deleteExpired.run(nowIso());
}

/** Attach req.session / req.user when a valid session cookie is present. */
export function loadSession(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const row = statements.findSession.get(hashToken(token), nowIso());
    if (row) {
      req.session = { tokenHash: row.token_hash };
      req.user = {
        id: row.id,
        email: row.email,
        name: row.name,
        plan: row.plan,
        trialEndsAt: row.trial_ends_at,
        dailyRate: row.daily_rate,
        location: row.location,
        createdAt: row.created_at,
        disciplines: statements.disciplines.all(row.id).map((d) => d.discipline),
      };
    }
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, "unauthenticated", "Connectez-vous pour continuer."));
  next();
}
