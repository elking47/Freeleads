// End-to-end security checks against a real server instance with a throwaway database.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { client, db, getBaseUrl, useServer } from "./helpers.js";

useServer();

describe("HTTP hardening", () => {
  it("sends security headers and hides the framework", async () => {
    const { headers } = await client().get("/api/auth/csrf");
    assert.match(headers.get("content-security-policy"), /script-src 'self'/);
    assert.match(headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.equal(headers.get("x-content-type-options"), "nosniff");
    assert.equal(headers.get("x-powered-by"), null);
    assert.equal(headers.get("cache-control"), "no-store");
  });

  it("rate-limits every API endpoint (headers present on reads)", async () => {
    const { headers } = await client().get("/api/auth/csrf");
    assert.ok(headers.get("ratelimit-policy"), "RateLimit-Policy header expected");
  });

  it("rejects non-JSON bodies on writes", async () => {
    const c = client();
    await c.get("/api/auth/csrf");
    const res = await c.post("/api/auth/login", undefined, {
      raw: "email=a@b.co&password=x",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    assert.equal(res.status, 415);
  });

  it("rejects state-changing requests without a valid CSRF token", async () => {
    const c = client();
    await c.signup("csrf@freeleads.example");
    const missing = await c.patch("/api/settings/profile", { dailyRate: 500 }, { csrf: false });
    assert.equal(missing.status, 403);
    const forged = await c.patch("/api/settings/profile", { dailyRate: 500 }, { csrf: false, headers: { "X-CSRF-Token": "forged.token" } });
    assert.equal(forged.status, 403);
    const ok = await c.patch("/api/settings/profile", { dailyRate: 500 });
    assert.equal(ok.status, 200);
  });

  it("sets HttpOnly, SameSite=Strict session cookies", async () => {
    const c = client();
    await c.get("/api/auth/csrf");
    const response = await fetch(`${getBaseUrl()}/api/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `fl_csrf=${c.jar.get("fl_csrf")}`,
        "X-CSRF-Token": decodeURIComponent(c.jar.get("fl_csrf")),
      },
      body: JSON.stringify({ name: "Cookie Test", email: "cookie@freeleads.example", password: "Sunrise-pipeline-42", disciplines: ["web"], terms: true }),
    });
    const session = response.headers.getSetCookie().find((c) => c.startsWith("fl_session="));
    assert.match(session, /HttpOnly/i);
    assert.match(session, /SameSite=Strict/i);
  });
});

describe("Input validation (backend, independent of the browser)", () => {
  it("rejects invalid signup data with field errors", async () => {
    const c = client();
    await c.get("/api/auth/csrf");
    const res = await c.post("/api/auth/signup", {
      name: "<script>alert(1)</script>",
      email: "not-an-email",
      password: "short",
      disciplines: ["web", "hacking"],
      terms: false,
    });
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.data.fields).sort(), ["disciplines", "email", "name", "password", "terms"]);
  });

  it("rejects unexpected fields (mass assignment)", async () => {
    const c = client();
    await c.signup("mass@freeleads.example");
    const res = await c.patch("/api/settings/profile", { dailyRate: 500, plan: "team", trial_ends_at: null });
    assert.equal(res.status, 400);
    assert.equal(res.data.fields.plan, "Ce champ n’est pas autorisé.");
  });

  it("strips control and bidi-override characters", async () => {
    const { sanitizeText } = await import("../shared/validation.js");
    assert.equal(sanitizeText("  Ac‮me\u0000 Corp​  "), "Acme Corp");
    assert.equal(sanitizeText("line1\r\nline2\u0007", { multiline: true }), "line1\nline2");
  });
});

describe("SQL injection", () => {
  it("treats search text as data and rejects unknown sort keys", async () => {
    const c = client();
    await c.signup("sqli@freeleads.example");
    const search = await c.get(`/api/leads?q=${encodeURIComponent("' OR 1=1 --")}`);
    assert.equal(search.status, 200);
    assert.equal(search.data.total, 0);

    const sort = await c.get(`/api/leads?sort=${encodeURIComponent("score; DROP TABLE users")}`);
    assert.equal(sort.status, 400);

    const like = await c.get(`/api/leads?q=${encodeURIComponent("%")}`);
    assert.equal(like.data.total, 0, "LIKE wildcards are escaped");

    assert.ok(db.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0, "users table still exists");
  });

  it("rejects non-numeric ids before they reach the database", async () => {
    const c = client();
    await c.signup("ids@freeleads.example");
    const res = await c.get(`/api/leads/${encodeURIComponent("1 OR 1=1")}`);
    assert.equal(res.status, 404);
  });
});

describe("Access control", () => {
  it("prevents reading or editing another user's leads (IDOR)", async () => {
    const alice = client();
    const bob = client();
    await alice.signup("alice@freeleads.example");
    await bob.signup("bob@freeleads.example");

    const aliceLeads = await alice.get("/api/leads");
    assert.ok(aliceLeads.data.total > 0, "signup delivers leads");
    const leadId = aliceLeads.data.leads[0].id;

    assert.equal((await bob.get(`/api/leads/${leadId}`)).status, 404);
    assert.equal((await bob.patch(`/api/leads/${leadId}`, { status: "won" })).status, 404);
    assert.equal((await alice.get(`/api/leads/${leadId}`)).data.lead.status, "new");
  });

  it("requires a session for app endpoints", async () => {
    assert.equal((await client().get("/api/leads")).status, 401);
    assert.equal((await client().get("/api/analytics")).status, 401);
  });

  it("reports session state to public pages without a 401", async () => {
    const anonymous = await client().get("/api/auth/session");
    assert.equal(anonymous.status, 200);
    assert.deepEqual(anonymous.data, { authenticated: false });

    const c = client();
    await c.signup("session@freeleads.example");
    assert.deepEqual((await c.get("/api/auth/session")).data, { authenticated: true });
  });

  it("enforces the plan's discipline limit on the server", async () => {
    const c = client();
    await c.signup("limits@freeleads.example");
    const res = await c.patch("/api/settings/profile", { disciplines: ["web", "video", "design", "sales"] });
    assert.equal(res.status, 400);
  });
});

describe("Authentication", () => {
  it("uses one generic message for unknown email and wrong password", async () => {
    const c = client();
    await c.signup("generic@freeleads.example");
    const fresh = client();
    await fresh.get("/api/auth/csrf");
    const wrong = await fresh.post("/api/auth/login", { email: "generic@freeleads.example", password: "Wrong-password-1" });
    const unknown = await fresh.post("/api/auth/login", { email: "nobody@freeleads.example", password: "Wrong-password-1" });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.data.message, unknown.data.message);
  });

  it("locks the account after repeated wrong passwords", async () => {
    const c = client();
    await c.signup("lockout@freeleads.example");
    const attacker = client();
    await attacker.get("/api/auth/csrf");
    for (let i = 0; i < 5; i++) {
      await attacker.post("/api/auth/login", { email: "lockout@freeleads.example", password: `Wrong-password-${i}` });
    }
    const locked = await attacker.post("/api/auth/login", { email: "lockout@freeleads.example", password: "Sunrise-pipeline-42" });
    assert.equal(locked.status, 429);
  });

  it("rate-limits repeated login attempts", async () => {
    const c = client();
    await c.get("/api/auth/csrf");
    let limited = false;
    for (let i = 0; i < 25 && !limited; i++) {
      const res = await c.post("/api/auth/login", { email: "spray@freeleads.example", password: `Guess-number-${i}` });
      limited = res.status === 429;
    }
    assert.ok(limited, "expected a 429 after repeated attempts");
  });
});
