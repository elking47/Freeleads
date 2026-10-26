// Pipeline integrity: stage timestamps, analytics and follow-up rules.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { client, useServer } from "./helpers.js";

useServer();

describe("Pipeline stages and analytics", () => {
  let c;
  let leads;

  before(async () => {
    c = client();
    await c.signup("pipeline@freeleads.example");
    leads = (await c.get("/api/leads?sort=score")).data.leads;
    assert.ok(leads.length >= 4, "signup delivers enough leads for these tests");
  });

  const contacted = async () => (await c.get("/api/analytics")).data.totals.contacted;

  it("does not count a lead dismissed from New as contacted", async () => {
    const { data } = await c.patch(`/api/leads/${leads[0].id}`, { status: "lost" });
    assert.equal(data.lead.status, "lost");
    assert.equal(data.lead.contactedAt, null);
    assert.ok(data.lead.lostAt);
    assert.equal(await contacted(), 0);
  });

  it("clears contact history when a lead is moved back to New", async () => {
    await c.patch(`/api/leads/${leads[1].id}`, { status: "contacted" });
    assert.equal(await contacted(), 1);
    const { data } = await c.patch(`/api/leads/${leads[1].id}`, { status: "new" });
    assert.equal(data.lead.contactedAt, null);
    assert.equal(await contacted(), 0);
  });

  it("fills in earlier stages and clears later ones", async () => {
    const won = (await c.patch(`/api/leads/${leads[2].id}`, { status: "won" })).data.lead;
    assert.ok(won.contactedAt && won.repliedAt && won.wonAt);

    const back = (await c.patch(`/api/leads/${leads[2].id}`, { status: "contacted" })).data.lead;
    assert.ok(back.contactedAt);
    assert.equal(back.repliedAt, null);
    assert.equal(back.wonAt, null);
  });

  it("keeps contact history when a contacted lead is lost", async () => {
    await c.patch(`/api/leads/${leads[3].id}`, { status: "contacted" });
    const lost = (await c.patch(`/api/leads/${leads[3].id}`, { status: "lost" })).data.lead;
    assert.ok(lost.contactedAt, "a lead lost after contact still counts as contacted");
  });
});

describe("Follow-ups", () => {
  let c;
  let leads;

  before(async () => {
    c = client();
    await c.signup("followups@freeleads.example");
    leads = (await c.get("/api/leads?sort=score")).data.leads;
  });

  it("only applies to leads waiting for a reply", async () => {
    const res = await c.post(`/api/leads/${leads[0].id}/followups`, { step: 1 });
    assert.equal(res.status, 409);

    await c.patch(`/api/leads/${leads[0].id}`, { status: "lost" });
    assert.equal((await c.post(`/api/leads/${leads[0].id}/followups`, { step: 1 })).status, 409);
  });

  it("enforces D+3 before D+7", async () => {
    await c.patch(`/api/leads/${leads[1].id}`, { status: "contacted" });
    assert.equal((await c.post(`/api/leads/${leads[1].id}/followups`, { step: 2 })).status, 409);
    assert.equal((await c.post(`/api/leads/${leads[1].id}/followups`, { step: 1 })).status, 200);
    const done = await c.post(`/api/leads/${leads[1].id}/followups`, { step: 2 });
    assert.equal(done.status, 200);
    assert.ok(done.data.lead.followUps.every((f) => f.doneAt));
  });

  it("resets follow-ups when a lead goes back to New", async () => {
    const { data } = await c.patch(`/api/leads/${leads[1].id}`, { status: "new" });
    assert.deepEqual(data.lead.followUps, []);
  });
});
