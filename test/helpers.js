// Shared test harness: a real server on a random port, backed by a throwaway database.
import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before } from "node:test";

// Must be set before the server modules load their config.
const dbPath = path.join(tmpdir(), `freeleads-test-${randomBytes(6).toString("hex")}.db`);
process.env.DATABASE_PATH = dbPath;
process.env.SESSION_SECRET = randomBytes(48).toString("base64url");

const { createApp } = await import("../server/app.js");
const { seedTemplates } = await import("../server/seed-templates.js");
export const { db } = await import("../server/db.js");

let baseUrl;

/** Start the server before this file's tests and remove the database afterwards. */
export function useServer() {
  let server;
  before(async () => {
    seedTemplates();
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => {
    server.close();
    db.close();
    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${dbPath}${suffix}`, { force: true });
  });
}

export const getBaseUrl = () => baseUrl;

/** Minimal browser-like client: keeps cookies and sends the CSRF header. */
export function client() {
  const jar = new Map();
  async function request(method, url, { body, headers = {}, csrf = true, raw } = {}) {
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const finalHeaders = { Accept: "application/json", ...headers };
    if (cookie) finalHeaders.Cookie = cookie;
    if (csrf && method !== "GET" && jar.has("fl_csrf")) finalHeaders["X-CSRF-Token"] = decodeURIComponent(jar.get("fl_csrf"));
    if (body !== undefined && !finalHeaders["Content-Type"]) finalHeaders["Content-Type"] = "application/json";
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: finalHeaders,
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const index = pair.indexOf("=");
      jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const data = await response.json().catch(() => null);
    return { status: response.status, data, headers: response.headers };
  }
  return {
    jar,
    get: (url, opts) => request("GET", url, opts),
    post: (url, body, opts) => request("POST", url, { ...opts, body }),
    patch: (url, body, opts) => request("PATCH", url, { ...opts, body }),
    async signup(email, password = "Sunrise-pipeline-42") {
      await request("GET", "/api/auth/csrf");
      return request("POST", "/api/auth/signup", {
        body: { name: "Test User", email, password, disciplines: ["web", "video"], terms: true },
      });
    },
  };
}
