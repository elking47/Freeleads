// Input sanitization and validation shared by the browser forms and the API.
// The browser uses it for instant feedback; the server always re-runs it and never trusts the client.
//
// Field specs:
//   text     { min, max, multiline, pattern, patternMessage }
//   email    {}                              lower-cased, RFC-lite syntax, <= 254 chars
//   password {}                              new-password policy
//   secret   { max }                         any non-empty string (login password), never echoed
//   url      { max }                         absolute http(s) URL without credentials (never fetched)
//   enum     { values }
//   int      { min, max }                    accepts numbers or numeric strings (query params)
//   bool     { mustBeTrue }
//   list     { items: <enum spec>, min, max }
// Common options: required, nullable, default.

import {
  CHANNEL_IDS,
  DISCIPLINE_IDS,
  LEAD_STATUS_IDS,
  PLAN_IDS,
} from "./constants.js";

// Zero-width characters and bidirectional overrides are stripped: they can hide or reorder text.
const INVISIBLE_RE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
// eslint-disable-next-line no-control-regex
const CONTROL_SINGLE_LINE_RE = /[\u0000-\u001F\u007F-\u009F]/g;
// eslint-disable-next-line no-control-regex
const CONTROL_MULTILINE_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const PERSON_NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;
const PHONE_RE = /^\+?[0-9 .()-]{6,20}$/;
const COMMON_PASSWORDS = new Set([
  "password123", "azerty1234", "qwerty1234", "1234567890", "motdepasse1",
  "freeleads123", "welcome123", "password1234", "iloveyou123", "admin12345",
]);

const MESSAGES = {
  required: "Ce champ est obligatoire.",
  unexpected: "Ce champ n’est pas autorisé.",
  type: "Valeur invalide.",
};

/** Normalize Unicode, remove control/invisible characters and trim. */
export function sanitizeText(value, { multiline = false } = {}) {
  if (typeof value !== "string") return value;
  let text = value.normalize("NFC").replace(INVISIBLE_RE, "");
  if (multiline) {
    text = text.replace(/\r\n?/g, "\n").replace(CONTROL_MULTILINE_RE, "").replace(/\n{4,}/g, "\n\n\n");
  } else {
    text = text.replace(CONTROL_SINGLE_LINE_RE, " ").replace(/\s+/g, " ");
  }
  return text.trim();
}

const checkers = {
  text(spec, raw) {
    if (typeof raw !== "string") return { error: MESSAGES.type };
    const value = sanitizeText(raw, { multiline: spec.multiline });
    if (spec.min && value.length < spec.min) return { error: `${spec.min} caractères minimum.` };
    if (spec.max && value.length > spec.max) return { error: `${spec.max} caractères maximum.` };
    if (spec.pattern && !spec.pattern.test(value)) return { error: spec.patternMessage ?? MESSAGES.type };
    return { value };
  },

  email(_spec, raw) {
    if (typeof raw !== "string") return { error: MESSAGES.type };
    const value = sanitizeText(raw).toLowerCase();
    if (value.length > 254 || !EMAIL_RE.test(value)) return { error: "Saisissez une adresse e-mail valide." };
    return { value };
  },

  password(_spec, raw) {
    if (typeof raw !== "string") return { error: MESSAGES.type };
    if (raw.length < 10) return { error: "10 caractères minimum." };
    if (raw.length > 128) return { error: "128 caractères maximum." };
    if (!/\p{L}/u.test(raw) || !/\d/.test(raw)) return { error: "Mélangez des lettres et au moins un chiffre." };
    if (COMMON_PASSWORDS.has(raw.toLowerCase())) return { error: "Ce mot de passe est trop courant." };
    return { value: raw };
  },

  secret(spec, raw) {
    if (typeof raw !== "string" || raw.length === 0) return { error: MESSAGES.required };
    if (raw.length > (spec.max ?? 128)) return { error: MESSAGES.type };
    return { value: raw };
  },

  url(spec, raw) {
    if (typeof raw !== "string") return { error: MESSAGES.type };
    const value = sanitizeText(raw);
    const invalid = { error: "Collez un lien complet, qui commence par https://" };
    if (value.length > (spec.max ?? 2048)) return { error: "Ce lien est trop long." };
    let url;
    try {
      url = new URL(value);
    } catch {
      return invalid;
    }
    // Only web links, no embedded credentials, and a real host name. The server never fetches it.
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return invalid;
    if (!url.hostname.includes(".") || /^[\d.]+$/.test(url.hostname) || url.hostname.startsWith("[")) return invalid;
    return { value: url.href };
  },

  enum(spec, raw) {
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (!spec.values.includes(value)) return { error: spec.message ?? "Choisissez une des options proposées." };
    return { value };
  },

  int(spec, raw) {
    const value = typeof raw === "string" && /^-?\d{1,12}$/.test(raw.trim()) ? Number(raw.trim()) : raw;
    if (!Number.isSafeInteger(value)) return { error: "Saisissez un nombre entier." };
    if (spec.min !== undefined && value < spec.min) return { error: `${spec.min} minimum.` };
    if (spec.max !== undefined && value > spec.max) return { error: `${spec.max} maximum.` };
    return { value };
  },

  bool(spec, raw) {
    const value = raw === "true" ? true : raw === "false" ? false : raw;
    if (typeof value !== "boolean") return { error: MESSAGES.type };
    if (spec.mustBeTrue && value !== true) return { error: spec.message ?? MESSAGES.required };
    return { value };
  },

  list(spec, raw) {
    if (!Array.isArray(raw)) return { error: MESSAGES.type };
    const values = [];
    for (const item of raw) {
      const result = checkers[spec.items.type](spec.items, item);
      if (result.error) return { error: result.error };
      if (!values.includes(result.value)) values.push(result.value);
    }
    if (spec.min && values.length < spec.min) return { error: spec.minMessage ?? `Choisissez-en au moins ${spec.min}.` };
    if (spec.max && values.length > spec.max) return { error: `${spec.max} maximum.` };
    return { value: values };
  },
};

const isEmpty = (raw) => raw === null || (typeof raw === "string" && sanitizeText(raw) === "");

/**
 * Validate `input` against `schema`.
 * Unknown keys are rejected. With `partial`, missing fields are skipped (PATCH semantics).
 * Returns { ok, data, errors } where errors maps field -> message.
 */
export function validate(schema, input, { partial = false } = {}) {
  const errors = {};
  const data = {};

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, data, errors: { _form: "Requête invalide." } };
  }

  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(schema, key)) errors[key] = MESSAGES.unexpected;
  }

  for (const [key, spec] of Object.entries(schema)) {
    const raw = Object.hasOwn(input, key) ? input[key] : undefined;

    if (raw === undefined) {
      if (partial) continue;
      if (spec.required) errors[key] = MESSAGES.required;
      else if (spec.default !== undefined) data[key] = spec.default;
      continue;
    }

    if (isEmpty(raw)) {
      if (spec.nullable) data[key] = null;
      else if (spec.required) errors[key] = MESSAGES.required;
      else if (!partial && spec.default !== undefined) data[key] = spec.default;
      continue;
    }

    const checker = checkers[spec.type];
    const result = checker ? checker(spec, raw) : { error: MESSAGES.type };
    if (result.error) errors[key] = result.error;
    else data[key] = result.value;
  }

  if (partial && Object.keys(data).length === 0 && Object.keys(errors).length === 0) {
    errors._form = "Rien à mettre à jour.";
  }

  return { ok: Object.keys(errors).length === 0, data, errors };
}

// ---- Field building blocks -------------------------------------------------------------------

const personName = {
  type: "text",
  min: 2,
  max: 60,
  pattern: PERSON_NAME_RE,
  patternMessage: "Lettres, espaces, apostrophes et tirets uniquement.",
};
const disciplineList = (max) => ({
  type: "list",
  items: { type: "enum", values: DISCIPLINE_IDS },
  min: 1,
  max,
  minMessage: "Choisissez au moins un métier.",
});

// ---- Schemas ---------------------------------------------------------------------------------

export const schemas = {
  signup: {
    name: { ...personName, required: true },
    email: { type: "email", required: true },
    password: { type: "password", required: true },
    disciplines: { ...disciplineList(3), required: true },
    terms: { type: "bool", required: true, mustBeTrue: true, message: "Acceptez les conditions pour continuer." },
  },

  login: {
    email: { type: "email", required: true },
    password: { type: "secret", required: true },
  },

  // A company submits a job offer (link or short description) to receive a freelance shortlist.
  missionRequest: {
    offerUrl: { type: "url", max: 2048, nullable: true },
    description: { type: "text", multiline: true, min: 20, max: 1000, nullable: true },
    company: { type: "text", min: 2, max: 100, required: true },
    name: { ...personName, required: true },
    email: { type: "email", required: true },
    phone: { type: "text", max: 20, pattern: PHONE_RE, patternMessage: "Numéro de téléphone invalide.", nullable: true },
    consent: { type: "bool", required: true, mustBeTrue: true, message: "Acceptez d’être recontacté pour continuer." },
  },

  leadQuery: {
    view: { type: "enum", values: ["today", "all"], default: "all" },
    status: { type: "enum", values: LEAD_STATUS_IDS },
    discipline: { type: "enum", values: DISCIPLINE_IDS },
    q: { type: "text", max: 80 },
    minScore: { type: "int", min: 0, max: 100 },
    sort: { type: "enum", values: ["score", "newest", "urgency"], default: "score" },
    page: { type: "int", min: 1, max: 500, default: 1 },
  },

  leadUpdate: {
    status: { type: "enum", values: LEAD_STATUS_IDS },
    notes: { type: "text", multiline: true, max: 2000, nullable: true },
    rating: { type: "enum", values: ["up", "down"], nullable: true },
    wonAmount: { type: "int", min: 0, max: 10_000_000, nullable: true },
  },

  followUpDone: {
    step: { type: "int", min: 1, max: 2, required: true },
  },

  template: {
    name: { type: "text", min: 2, max: 80, required: true },
    channel: { type: "enum", values: CHANNEL_IDS, required: true },
    discipline: { type: "enum", values: DISCIPLINE_IDS, nullable: true },
    subject: { type: "text", max: 150, nullable: true },
    body: { type: "text", multiline: true, min: 10, max: 4000, required: true },
  },

  profile: {
    name: { ...personName },
    dailyRate: { type: "int", min: 50, max: 5000, nullable: true },
    location: { type: "text", max: 80, nullable: true },
    disciplines: disciplineList(8),
  },

  passwordChange: {
    currentPassword: { type: "secret", required: true },
    newPassword: { type: "password", required: true },
  },

  plan: {
    plan: { type: "enum", values: PLAN_IDS, required: true },
  },

  deleteAccount: {
    password: { type: "secret", required: true },
    confirm: { type: "enum", values: ["DELETE"], required: true, message: "Saisissez DELETE pour confirmer." },
  },
};

/** Mission requests need either a job-offer link or a short description of the need. */
export function validateMissionRequest(input) {
  const result = validate(schemas.missionRequest, input);
  if (result.ok && !result.data.offerUrl && !result.data.description) {
    const message = "Collez le lien de votre offre ou décrivez le besoin.";
    return { ok: false, data: result.data, errors: { offerUrl: message, description: message } };
  }
  return result;
}
