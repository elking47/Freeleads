import { Router } from "express";
import { TRIAL_DAYS } from "../../shared/constants.js";
import { schemas, validate } from "../../shared/validation.js";
import { endSession, hashPassword, startSession, verifyAgainstDummy, verifyPassword } from "../auth.js";
import { db, nowIso, transaction } from "../db.js";
import { currentBatchDate, deliverToUser } from "../engine/pipeline.js";
import { planState } from "../plans.js";
import {
  HttpError,
  authIpLimiter,
  issueCsrf,
  loginAccountLimiter,
  securityLog,
  validationError,
} from "../security.js";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

const q = {
  userByEmail: db.prepare("SELECT id, password_hash, failed_logins, locked_until FROM users WHERE email = ?"),
  insertUser: db.prepare(`
    INSERT INTO users (email, name, password_hash, plan, trial_ends_at, created_at)
    VALUES (?, ?, ?, 'pro', ?, ?) RETURNING id
  `),
  insertDiscipline: db.prepare("INSERT INTO user_disciplines (user_id, discipline) VALUES (?, ?)"),
  loginFailed: db.prepare(`
    UPDATE users SET failed_logins = failed_logins + 1,
      locked_until = CASE WHEN failed_logins + 1 >= ? THEN ? ELSE locked_until END
    WHERE id = ?
  `),
  resetFailures: db.prepare("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?"),
};

export const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  dailyRate: user.dailyRate,
  location: user.location,
  disciplines: user.disciplines,
  createdAt: user.createdAt,
  plan: planState(user),
});

export const authRouter = Router();

authRouter.get("/csrf", (req, res) => {
  res.json({ csrfToken: issueCsrf(res, req.session?.tokenHash ?? "anon") });
});

authRouter.get("/me", (req, res) => {
  if (!req.user) throw new HttpError(401, "unauthenticated", "Please sign in.");
  res.json({ user: publicUser(req.user) });
});

authRouter.post("/signup", authIpLimiter, async (req, res) => {
  const { ok, data, errors } = validate(schemas.signup, req.body);
  if (!ok) throw validationError(errors);

  if (q.userByEmail.get(data.email)) {
    throw validationError({ email: "An account already exists for this email. Try signing in." });
  }

  const passwordHash = await hashPassword(data.password);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
  const userId = transaction(() => {
    const id = q.insertUser.get(data.email, data.name, passwordHash, trialEndsAt, nowIso()).id;
    for (const discipline of data.disciplines) q.insertDiscipline.run(id, discipline);
    return id;
  });

  startSession(res, userId);
  // The business plan promises the first Freeleads within 24 h; the MVP delivers the current batch now.
  deliverToUser({ id: userId, plan: "pro", trialEndsAt }, currentBatchDate());
  res.status(201).json({ ok: true });
});

authRouter.post("/login", authIpLimiter, loginAccountLimiter, async (req, res) => {
  const { ok, data, errors } = validate(schemas.login, req.body);
  if (!ok) throw validationError(errors);

  const invalid = new HttpError(401, "invalid_credentials", "Email or password is incorrect.");
  const user = q.userByEmail.get(data.email);
  if (!user) {
    await verifyAgainstDummy(data.password);
    securityLog("login_failed_unknown", { email: data.email, ip: req.ip });
    throw invalid;
  }
  if (user.locked_until) {
    if (Date.parse(user.locked_until) > Date.now()) {
      securityLog("login_locked", { userId: user.id, ip: req.ip });
      throw new HttpError(429, "locked", `Too many attempts. Try again in ${LOCK_MINUTES} minutes.`);
    }
    q.resetFailures.run(user.id); // The lock expired: start counting again from zero.
  }
  if (!(await verifyPassword(data.password, user.password_hash))) {
    const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
    q.loginFailed.run(MAX_FAILED_LOGINS, lockUntil, user.id);
    securityLog("login_failed", { userId: user.id, ip: req.ip });
    throw invalid;
  }

  q.resetFailures.run(user.id);
  endSession(req, res);
  startSession(res, user.id);
  res.json({ ok: true });
});

authRouter.post("/logout", (req, res) => {
  endSession(req, res);
  res.json({ ok: true });
});
