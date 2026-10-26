// HTTP hardening: security headers, rate limiting, CSRF protection, cookies and error responses.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { config } from "./config.js";

export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const validationError = (errors) =>
  new HttpError(400, "validation", "Some fields need your attention.", errors);

/** Log security-relevant events without personal data (emails are hashed). */
export function securityLog(event, details = {}) {
  const safe = { ...details };
  if (safe.email) safe.email = createHash("sha256").update(safe.email).digest("hex").slice(0, 12);
  console.warn(`[security] ${new Date().toISOString()} ${event}`, JSON.stringify(safe));
}

// ---- Headers ---------------------------------------------------------------------------------

export const securityHeaders = [
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(config.isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    strictTransportSecurity: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
  (_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    next();
  },
];

// ---- Rate limiting (applied to every /api route; stricter on sensitive ones) -------------------

const limiterDefaults = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    securityLog("rate_limited", { path: req.path, ip: req.ip });
    res.status(options.statusCode).json({ error: "rate_limited", message: "Too many requests. Please slow down." });
  },
};

/** Baseline limit for every API endpoint, keyed by client IP. */
export const apiLimiter = rateLimit({ ...limiterDefaults, windowMs: 15 * 60_000, limit: 600 });

/** Signup / login / password endpoints, keyed by IP. */
export const authIpLimiter = rateLimit({ ...limiterDefaults, windowMs: 15 * 60_000, limit: 20 });

/** Login attempts per target account (stops distributed guessing on one email). */
export const loginAccountLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60_000,
  limit: 8,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";
    return `login:${createHash("sha256").update(email).digest("hex")}`;
  },
});

/** Write operations (lead updates, templates, settings), keyed by user when signed in. */
export const writeLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60_000,
  limit: 60,
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : `ip:${req.ip}`),
});

// ---- Cookies ---------------------------------------------------------------------------------

export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!Object.hasOwn(cookies, name)) {
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        // Ignore malformed cookie values.
      }
    }
  }
  return cookies;
}

export const baseCookieOptions = {
  path: "/",
  sameSite: "strict",
  secure: config.isProduction,
};

// ---- CSRF: signed double-submit cookie, bound to the current session -------------------------

export const CSRF_COOKIE = "fl_csrf";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const sign = (value) => createHmac("sha256", config.sessionSecret).update(value).digest("base64url");

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Issue a CSRF token bound to `binding` (the session token hash, or "anon"). */
export function issueCsrf(res, binding) {
  const nonce = randomBytes(24).toString("base64url");
  const token = `${nonce}.${sign(`csrf:${binding}:${nonce}`)}`;
  res.cookie(CSRF_COOKIE, token, { ...baseCookieOptions, httpOnly: false });
  return token;
}

export function verifyCsrf(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const header = req.get("x-csrf-token");
  const cookie = req.cookies?.[CSRF_COOKIE];
  const binding = req.session?.tokenHash ?? "anon";
  const [nonce, signature] = typeof header === "string" ? header.split(".") : [];
  const valid =
    header && cookie && safeEqual(header, cookie) && nonce && signature &&
    safeEqual(signature, sign(`csrf:${binding}:${nonce}`));
  if (!valid) {
    securityLog("csrf_rejected", { path: req.path, ip: req.ip });
    return next(new HttpError(403, "csrf", "Your session token expired. Please retry."));
  }
  next();
}

// ---- Request shape ---------------------------------------------------------------------------

/** State-changing requests must send JSON (blocks form-encoded cross-site posts). */
export function requireJson(req, _res, next) {
  if (SAFE_METHODS.has(req.method) || req.method === "DELETE") return next();
  if (!req.is("application/json")) {
    return next(new HttpError(415, "unsupported_media_type", "Requests must be sent as JSON."));
  }
  next();
}

/** Route ids must be positive integers; anything else is a 404, not a database query. */
export function parseId(raw) {
  if (typeof raw !== "string" || !/^[1-9]\d{0,9}$/.test(raw)) throw new HttpError(404, "not_found", "Not found.");
  return Number(raw);
}

// ---- Error handling --------------------------------------------------------------------------

export function apiNotFound(_req, _res, next) {
  next(new HttpError(404, "not_found", "Not found."));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.code, message: error.message, fields: error.fields });
  }
  // Body-parser errors (malformed JSON, payload too large) carry a 4xx status.
  if (error?.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ error: "bad_request", message: "The request could not be read." });
  }
  console.error(`[error] ${req.method} ${req.path}`, error);
  res.status(500).json({ error: "internal", message: "Something went wrong on our side." });
}
