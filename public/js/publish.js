// "Publier une mission": companies submit a job offer link or a short description.
import { schemas, validateMissionRequest } from "/shared/validation.js";
import { api } from "./lib/api.js";
import { bindForm, collect, showErrors } from "./lib/forms.js";

const form = document.querySelector("[data-mission-form]");
const success = document.querySelector("[data-success]");

// Field-level rules come from the shared schema; the "link or description" rule is checked on submit.
bindForm(form, schemas.missionRequest, async () => {
  const { ok, data, errors } = validateMissionRequest(collect(form, schemas.missionRequest));
  if (!ok) return showErrors(form, errors);
  await api("/missions", { method: "POST", body: data });
  form.hidden = true;
  success.querySelector("[data-success-email]").textContent = data.email;
  success.hidden = false;
  success.focus();
});
