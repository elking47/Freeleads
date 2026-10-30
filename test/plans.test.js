// Plan rules (no server needed).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planState } from "../server/plans.js";

const day = 86_400_000;

describe("planState", () => {
  it("gives Pro during the 14-day trial", () => {
    const plan = planState({ plan: "pro", trialEndsAt: new Date(Date.now() + 5 * day).toISOString() });
    assert.equal(plan.id, "pro");
    assert.equal(plan.trialActive, true);
    assert.equal(plan.trialDaysLeft, 5);
  });

  it("falls back to Gratuit when the trial ends, and keeps receiving missions", () => {
    const plan = planState({ plan: "pro", trialEndsAt: new Date(Date.now() - day).toISOString() });
    assert.equal(plan.id, "free");
    assert.equal(plan.trialExpired, true);
    assert.equal(plan.canReceiveLeads, true);
    assert.equal(plan.contactsPerMonth, 5);
  });

  it("keeps a paid plan without a trial date", () => {
    assert.equal(planState({ plan: "studio", trialEndsAt: null }).seats, 3);
  });
});
