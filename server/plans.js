// Plan and trial rules (business plan: Solo / Pro / Team, 14-day Pro trial without card).
import { PLANS } from "../shared/constants.js";

export function planState(user) {
  const plan = PLANS[user.plan] ?? PLANS.solo;
  const trialEnds = user.trialEndsAt ? Date.parse(user.trialEndsAt) : null;
  const trialActive = trialEnds !== null && trialEnds > Date.now();
  const trialExpired = trialEnds !== null && !trialActive;
  return {
    ...plan,
    trialActive,
    trialExpired,
    trialDaysLeft: trialActive ? Math.ceil((trialEnds - Date.now()) / 86_400_000) : 0,
    canReceiveLeads: !trialExpired,
  };
}
