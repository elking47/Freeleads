// Binds a <form> to a shared validation schema: instant field feedback in the browser, the same rules
// the server enforces, and server-side field errors mapped back onto the inputs.
import { validate } from "/shared/validation.js";

/** Read form controls into a plain object. Checkbox groups (data-list) become arrays. */
export function collect(form, schema) {
  const values = {};
  for (const name of Object.keys(schema)) {
    const controls = [...form.elements].filter((el) => el.name === name);
    if (controls.length === 0) continue;
    const first = controls[0];
    if (first.type === "checkbox" && (controls.length > 1 || first.dataset.list !== undefined)) {
      values[name] = controls.filter((c) => c.checked).map((c) => c.value);
    } else if (first.type === "checkbox") {
      values[name] = first.checked;
    } else {
      values[name] = first.value;
    }
  }
  return values;
}

function errorSlot(form, name) {
  return form.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
}

export function showFieldError(form, name, message) {
  const slot = errorSlot(form, name);
  if (slot) slot.textContent = message ?? "";
  for (const el of form.elements) {
    if (el.name !== name) continue;
    if (message) {
      el.setAttribute("aria-invalid", "true");
      if (slot?.id) el.setAttribute("aria-describedby", slot.id);
    } else {
      el.removeAttribute("aria-invalid");
    }
  }
}

export function showErrors(form, errors = {}) {
  const formError = form.querySelector("[data-form-error]");
  if (formError) formError.textContent = errors._form ?? "";
  for (const name of new Set([...form.elements].map((el) => el.name).filter(Boolean))) {
    showFieldError(form, name, errors[name]);
  }
  const firstInvalid = form.querySelector('[aria-invalid="true"]');
  firstInvalid?.focus();
}

/**
 * @param {HTMLFormElement} form
 * @param {object} schema  shared schema from /shared/validation.js
 * @param {(data: object) => Promise<void>} onSubmit receives validated, sanitized data
 */
export function bindForm(form, schema, onSubmit, { partial = false } = {}) {
  form.noValidate = true; // We render our own accessible messages from the shared rules.

  const validateField = (name) => {
    if (!schema[name]) return;
    const values = collect(form, { [name]: schema[name] });
    const { errors } = validate({ [name]: schema[name] }, values, { partial });
    showFieldError(form, name, errors[name]);
  };

  form.addEventListener("focusout", (event) => {
    const name = event.target.name;
    if (name && event.target.getAttribute("aria-invalid") === "true") validateField(name);
    else if (name && event.target.value) validateField(name);
  });
  form.addEventListener("change", (event) => {
    if (event.target.type === "checkbox" && event.target.name) validateField(event.target.name);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { ok, data, errors } = validate(schema, collect(form, schema), { partial });
    if (!ok) return showErrors(form, errors);

    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      showErrors(form, {});
      await onSubmit(data);
    } catch (error) {
      if (error.fields) showErrors(form, error.fields);
      else showErrors(form, { _form: error.message || "Something went wrong. Please try again." });
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}

/** Adds a show/hide button to password inputs marked with data-password. */
export function enhancePasswords(root = document) {
  for (const toggle of root.querySelectorAll("[data-password-toggle]")) {
    const input = document.getElementById(toggle.getAttribute("aria-controls"));
    toggle.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.textContent = show ? "Hide" : "Show";
      toggle.setAttribute("aria-pressed", String(show));
    });
  }
}
