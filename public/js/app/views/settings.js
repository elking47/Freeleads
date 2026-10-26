// Settings: profile, disciplines, plan, password and account deletion.
import { PLANS } from "/shared/constants.js";
import { schemas } from "/shared/validation.js";
import { api } from "../../lib/api.js";
import { h } from "../../lib/dom.js";
import { renderDisciplinePicker } from "../../lib/disciplines.js";
import { bindForm, enhancePasswords } from "../../lib/forms.js";
import { pageHead, toast } from "../components.js";
import { renderPlanPill, renderUser, rerender } from "../shell.js";
import { countsChanged, loadUser, state } from "../state.js";

function field(id, name, label, control, hint) {
  return h("div", { class: "field" },
    h("label", { for: id }, label),
    control,
    hint ? h("p", { class: "hint" }, hint) : null,
    h("p", { class: "field-error", id: `err-${id}`, dataset: { errorFor: name } }));
}

function passwordInput(id, name, autocomplete) {
  return h("div", { class: "password-wrap" },
    h("input", { class: "input", id, name, type: "password", autocomplete, maxlength: "128", required: true }),
    h("button", { class: "password-toggle", type: "button", "aria-controls": id, "aria-pressed": "false", dataset: { passwordToggle: "" } }, "Show"));
}

const formError = () => h("p", { class: "form-error", role: "alert", dataset: { formError: "" } });

export async function render() {
  const user = await loadUser();
  const plan = user.plan;

  // ---- Profile ----
  const profileForm = h("form", {},
    formError(),
    h("div", { class: "form-grid" },
      field("set-name", "name", "Full name", h("input", { class: "input", id: "set-name", name: "name", autocomplete: "name", maxlength: "60", value: user.name })),
      field("set-rate", "dailyRate", "Daily rate (€)", h("input", { class: "input", id: "set-rate", name: "dailyRate", type: "number", min: "50", max: "5000", step: "10", inputmode: "numeric", value: user.dailyRate ?? "" }), "Used in your templates.")),
    field("set-location", "location", "Location", h("input", { class: "input", id: "set-location", name: "location", maxlength: "80", autocomplete: "address-level2", value: user.location ?? "" })),
    h("div", {}, h("button", { class: "btn btn-primary", type: "submit" }, "Save profile")));
  bindForm(profileForm, { name: schemas.profile.name, dailyRate: schemas.profile.dailyRate, location: schemas.profile.location }, async (data) => {
    await api("/settings/profile", { method: "PATCH", body: data });
    await loadUser();
    renderUser();
    toast("Profile saved.");
  });

  // ---- Disciplines ----
  const picker = h("div", { class: "chip-group" });
  renderDisciplinePicker(picker, { max: plan.disciplines, selected: user.disciplines });
  const disciplinesForm = h("form", {},
    formError(),
    h("fieldset", { class: "field" },
      h("legend", { class: "visually-hidden" }, "Disciplines"),
      picker,
      h("p", { class: "field-error", id: "err-set-disciplines", dataset: { errorFor: "disciplines" } })),
    h("div", {}, h("button", { class: "btn btn-primary", type: "submit" }, "Save disciplines")));
  bindForm(disciplinesForm, { disciplines: schemas.profile.disciplines }, async (data) => {
    await api("/settings/profile", { method: "PATCH", body: data });
    await loadUser();
    toast("Disciplines saved. They apply from the next 8 AM delivery.");
  });

  // ---- Plan ----
  const planOption = (p) => {
    const current = !plan.trialActive && !plan.trialExpired && plan.id === p.id;
    return h("div", { class: "plan-option", dataset: { current: String(current) } },
      h("strong", {}, p.label),
      h("p", { class: "plan-option-price" }, `€${p.price}`, h("span", { class: "muted" }, " /month")),
      h("ul", {},
        h("li", {}, `${p.leadsPerDay ?? "Unlimited"} Freeleads per day`),
        h("li", {}, `${p.disciplines === 8 ? "All 8" : p.disciplines} discipline${p.disciplines > 1 ? "s" : ""}`),
        h("li", {}, `${p.seats} seat${p.seats > 1 ? "s" : ""}${p.api ? " · API" : ""}`)),
      current
        ? h("span", { class: "badge badge-primary" }, "Current plan")
        : h("button", {
            class: "btn btn-sm",
            type: "button",
            onClick: async () => {
              const result = await api("/settings/plan", { method: "POST", body: { plan: p.id } });
              await loadUser();
              renderPlanPill();
              countsChanged();
              toast(result.trimmedDisciplines ? `Switched to ${p.label}. Extra disciplines were removed.` : `Switched to ${p.label}.`);
              rerender();
            },
          }, `Switch to ${p.label}`));
  };

  // ---- Password ----
  const passwordForm = h("form", {},
    formError(),
    h("div", { class: "form-grid" },
      field("set-current", "currentPassword", "Current password", passwordInput("set-current", "currentPassword", "current-password")),
      field("set-new", "newPassword", "New password", passwordInput("set-new", "newPassword", "new-password"), "At least 10 characters, with letters and a number.")),
    h("div", {}, h("button", { class: "btn btn-primary", type: "submit" }, "Change password")));
  enhancePasswords(passwordForm);
  bindForm(passwordForm, schemas.passwordChange, async (data) => {
    await api("/settings/password", { method: "POST", body: data });
    passwordForm.reset();
    toast("Password changed. Other sessions were signed out.");
  });

  // ---- Delete account ----
  const deleteForm = h("form", {},
    formError(),
    h("div", { class: "form-grid" },
      field("del-password", "password", "Password", passwordInput("del-password", "password", "current-password")),
      field("del-confirm", "confirm", "Type DELETE to confirm", h("input", { class: "input", id: "del-confirm", name: "confirm", autocomplete: "off", maxlength: "6" }))),
    h("div", {}, h("button", { class: "btn btn-danger", type: "submit" }, "Delete my account")));
  enhancePasswords(deleteForm);
  bindForm(deleteForm, schemas.deleteAccount, async (data) => {
    await api("/settings/delete-account", { method: "POST", body: data });
    location.replace("/");
  });

  const section = (title, sub, ...content) =>
    h("section", { class: "card card-pad" }, h("h2", { class: "card-title" }, title), sub ? h("p", { class: "card-sub template-sub" }, sub) : null, ...content);

  return h("div", {},
    pageHead("Settings", state.user.email),
    h("div", { class: "settings-grid" },
      section("Profile", null, profileForm),
      section("Disciplines", `Your plan includes ${plan.disciplines === 8 ? "all 8 disciplines" : `${plan.disciplines} discipline${plan.disciplines > 1 ? "s" : ""}`}.`, disciplinesForm),
      section("Plan",
        plan.trialActive
          ? `You're on a ${plan.label} trial: ${plan.trialDaysLeft} day${plan.trialDaysLeft > 1 ? "s" : ""} left.`
          : plan.trialExpired ? "Your trial has ended. Pick a plan to keep receiving Freeleads." : null,
        h("p", { class: "muted" }, "Billing isn't connected in this version: switching plans is free and takes effect immediately."),
        h("div", { class: "plan-options" }, Object.values(PLANS).map(planOption))),
      section("Password", null, passwordForm),
      h("section", { class: "card card-pad danger-zone" },
        h("h2", { class: "card-title" }, "Delete account"),
        h("p", { class: "card-sub template-sub" }, "Permanently deletes your account, leads, notes and templates. This cannot be undone."),
        deleteForm)
    )
  );
}
