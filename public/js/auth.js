// Login and signup pages.
import { schemas } from "/shared/validation.js";
import { api } from "./lib/api.js";
import { renderDisciplinePicker } from "./lib/disciplines.js";
import { bindForm, enhancePasswords } from "./lib/forms.js";

const form = document.querySelector("[data-auth-form]");
const mode = form.dataset.authForm;

// Already signed in? Go straight to the app.
api("/auth/session").then(({ authenticated }) => {
  if (authenticated) location.replace("/app");
}, () => {});

enhancePasswords(form);

if (mode === "signup") {
  const picker = form.querySelector("[data-discipline-picker]");
  renderDisciplinePicker(picker, { max: Number(picker.dataset.max) });
  bindForm(form, schemas.signup, async (data) => {
    await api("/auth/signup", { method: "POST", body: data });
    location.assign("/app");
  });
} else {
  bindForm(form, schemas.login, async (data) => {
    await api("/auth/login", { method: "POST", body: data });
    location.assign("/app");
  });
}
