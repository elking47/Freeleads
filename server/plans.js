// Plan and trial rules (maquette v6: Gratuit / Pro / Studio, 14-day Pro trial without card).
// When the trial ends without a paid plan, the account falls back to Gratuit and keeps its missions.
import { PLANS } from "../shared/constants.js";

export function planState(user) {
  const trialEnds = user.trialEndsAt ? Date.parse(user.trialEndsAt) : null;
  const trialActive = trialEnds !== null && trialEnds > Date.now();
  const trialExpired = trialEnds !== null && !trialActive;
  const plan = trialExpired ? PLANS.free : (PLANS[user.plan] ?? PLANS.free);
  return {
    ...plan,
    trialActive,
    trialExpired,
    trialDaysLeft: trialActive ? Math.ceil((trialEnds - Date.now()) / 86_400_000) : 0,
    canReceiveLeads: true,
  };
}
