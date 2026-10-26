// App-wide state: the signed-in user and cached templates.
import { api } from "../lib/api.js";

export const state = {
  user: null,
  templates: null,
};

export async function loadUser() {
  const { user } = await api("/auth/me");
  state.user = user;
  return user;
}

export async function loadTemplates({ force = false } = {}) {
  if (!state.templates || force) state.templates = (await api("/templates")).templates;
  return state.templates;
}

const listeners = new Set();
export const onCountsChanged = (fn) => listeners.add(fn);
export const countsChanged = () => listeners.forEach((fn) => fn());
