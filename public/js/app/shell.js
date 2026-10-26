// Sidebar pieces that views can refresh (user chip, plan pill) and a way to re-render the current view.
import { h, initials } from "../lib/dom.js";
import { state } from "./state.js";

export function renderPlanPill() {
  const pill = document.querySelector("[data-plan-pill]");
  const plan = state.user.plan;
  if (plan.trialExpired) {
    pill.dataset.state = "expired";
    pill.replaceChildren(h("strong", {}, "Trial ended"), "Choose a plan to keep receiving Freeleads");
  } else if (plan.trialActive) {
    pill.dataset.state = "trial";
    pill.replaceChildren(h("strong", {}, `${plan.label} trial`), `${plan.trialDaysLeft} day${plan.trialDaysLeft > 1 ? "s" : ""} left`);
  } else {
    pill.dataset.state = "paid";
    pill.replaceChildren(h("strong", {}, `${plan.label} plan`), `${plan.leadsPerDay ?? "Unlimited"} Freeleads per day`);
  }
}

export function renderUser() {
  const { user } = state;
  const [first = "", last = ""] = user.name.split(" ");
  document.querySelector("[data-user-initials]").textContent = initials(first, last);
  document.querySelector("[data-user-name]").textContent = user.name;
  document.querySelector("[data-user-email]").textContent = user.email;
  renderPlanPill();
}

export const rerender = () => window.dispatchEvent(new HashChangeEvent("hashchange"));
