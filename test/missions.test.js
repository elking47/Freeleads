// Company mission requests: public form, so validation, CSRF and rate limiting matter most.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { client, db, useServer } from "./helpers.js";

useServer();

const valid = {
  offerUrl: "https://carrieres.arbor-exemple.fr/charge-contenu-video",
  description: null,
  company: "Arbor Immobilier",
  name: "Romain Morel",
  email: "romain.morel@arbor-exemple.fr",
  phone: "+33 6 39 98 12 34",
  consent: true,
};

async function anonymous() {
  const c = client();
  await c.get("/api/auth/csrf");
  return c;
}

describe("Mission requests", () => {
  it("stores a valid request with parameterized SQL", async () => {
    const c = await anonymous();
    const res = await c.post("/api/missions", valid);
    assert.equal(res.status, 201);
    const row = db.prepare("SELECT company, offer_url, status FROM mission_requests WHERE email = ?").get(valid.email);
    assert.equal(row.company, "Arbor Immobilier");
    assert.equal(row.status, "new");
  });

  it("rejects links that are not plain public web addresses", async () => {
    const c = await anonymous();
    for (const offerUrl of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "https://user:pass@carrieres.example.fr/offre",
      "http://localhost:3000/admin",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "carrieres.example.fr/offre",
    ]) {
      const res = await c.post("/api/missions", { ...valid, offerUrl });
      assert.equal(res.status, 400, offerUrl);
      assert.ok(res.data.fields.offerUrl, offerUrl);
    }
  });

  it("needs either an offer link or a description", async () => {
    const c = await anonymous();
    const res = await c.post("/api/missions", { ...valid, offerUrl: null, description: null });
    assert.equal(res.status, 400);
    assert.ok(res.data.fields.offerUrl && res.data.fields.description);
  });

  it("rejects unexpected fields and missing consent", async () => {
    const c = await anonymous();
    const extra = await c.post("/api/missions", { ...valid, status: "shortlisted" });
    assert.equal(extra.status, 400);
    assert.ok(extra.data.fields.status);
    const noConsent = await c.post("/api/missions", { ...valid, consent: false });
    assert.equal(noConsent.status, 400);
  });

  it("requires a CSRF token", async () => {
    const c = await anonymous();
    const res = await c.post("/api/missions", valid, { csrf: false });
    assert.equal(res.status, 403);
  });

  it("rate-limits submissions per IP", async () => {
    const c = await anonymous();
    let limited = false;
    for (let i = 0; i < 8 && !limited; i++) {
      const res = await c.post("/api/missions", { ...valid, email: `rh${i}@arbor-exemple.fr` });
      limited = res.status === 429;
    }
    assert.ok(limited, "expected 429 after repeated submissions");
  });
});
