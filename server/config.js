// Runtime configuration. Every secret comes from the environment (see .env.example); nothing is hard-coded.
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const env = process.env;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isProduction = env.NODE_ENV === "production";

function intFromEnv(name, fallback, { min, max }) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function resolveSessionSecret() {
  const secret = env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProduction) {
    throw new Error("SESSION_SECRET must be set to at least 32 random characters in production.");
  }
  if (secret) console.warn("[config] SESSION_SECRET is shorter than 32 characters; using a random one instead.");
  else console.warn("[config] SESSION_SECRET is not set; using a random value (sessions reset on restart).");
  return randomBytes(48).toString("base64url");
}

export const config = Object.freeze({
  rootDir,
  isProduction,
  host: env.HOST || "127.0.0.1",
  port: intFromEnv("PORT", 3000, { min: 1, max: 65535 }),
  // Number of reverse proxies in front of the app (needed for correct client IPs in rate limiting).
  trustProxy: intFromEnv("TRUST_PROXY", 0, { min: 0, max: 5 }),
  databasePath: path.resolve(rootDir, env.DATABASE_PATH || "data/freeleads.db"),
  sessionSecret: resolveSessionSecret(),
  sessionTtlDays: intFromEnv("SESSION_TTL_DAYS", 7, { min: 1, max: 30 }),
  deliveryHour: intFromEnv("DELIVERY_HOUR", 8, { min: 0, max: 23 }),
  deliveryTimezone: env.DELIVERY_TIMEZONE || "Europe/Paris",
});
