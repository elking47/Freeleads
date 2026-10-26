// App shell: session check, sidebar, hash router and live counters.
import { api } from "../lib/api.js";
import { h, icon } from "../lib/dom.js";
import { toast } from "./components.js";
import { renderUser } from "./shell.js";
import { loadUser, onCountsChanged } from "./state.js";
import * as analytics from "./views/analytics.js";
import * as followups from "./views/followups.js";
import * as leads from "./views/leads.js";
import * as pipeline from "./views/pipeline.js";
import * as settings from "./views/settings.js";
import * as templates from "./views/templates.js";
import * as today from "./views/today.js";

const ROUTES = { today, leads, pipeline, templates, followups, analytics, settings };
const TITLES = {
  today: "Today", leads: "All leads", pipeline: "Pipeline", templates: "Templates",
  followups: "Follow-ups", analytics: "Analytics", settings: "Settings",
};

const view = document.getElementById("view");
const sidebar = document.querySelector("[data-sidebar]");
const openButton = document.querySelector("[data-sidebar-open]");

function parseHash() {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const name = Object.hasOwn(ROUTES, path) ? path : "today";
  return { name, params: Object.fromEntries(new URLSearchParams(query)) };
}

let renderToken = 0;
async function route() {
  const { name, params } = parseHash();
  const token = ++renderToken;
  document.title = `${TITLES[name]} · Freeleads`;
  for (const link of document.querySelectorAll("[data-route]")) {
    if (link.dataset.route === name) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  setSidebar(false);
  view.replaceChildren(h("p", { class: "muted" }, "Loading…"));
  try {
    const content = await ROUTES[name].render(params);
    if (token !== renderToken) return; // A newer navigation won.
    view.replaceChildren(content);
    view.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (error) {
    if (error.status === 401) return location.replace("/login");
    view.replaceChildren(h("div", { class: "empty" }, h("h2", {}, "This page could not load"), h("p", {}, error.message)));
  }
}

function setSidebar(open, { moveFocus = false } = {}) {
  const wasOpen = sidebar.dataset.open === "true";
  sidebar.setAttribute("data-open", String(open));
  openButton.setAttribute("aria-expanded", String(open));
  // Mobile menu: put focus inside when it opens, and back on the menu button when it closes.
  if (!moveFocus) return;
  if (open) sidebar.querySelector("[data-sidebar-close]").focus();
  else if (wasOpen) openButton.focus();
}

async function refreshCounts() {
  try {
    const [todayFeed, due] = await Promise.all([
      api("/leads", { query: { view: "today", status: "new" } }),
      api("/leads/followups"),
    ]);
    document.querySelector('[data-count="today"]').textContent = todayFeed.total ? String(todayFeed.total) : "";
    const overdue = due.items.filter((item) => item.overdue).length;
    document.querySelector('[data-count="followups"]').textContent = overdue ? String(overdue) : "";
  } catch {
    // Counters are decorative; the views report real errors.
  }
}

async function boot() {
  try {
    await loadUser();
  } catch {
    return location.replace("/login");
  }

  for (const link of document.querySelectorAll("[data-icon]")) link.prepend(icon(link.dataset.icon));
  document.querySelector("[data-logout]").append(icon("logout"));
  document.querySelector("[data-sidebar-close]").append(icon("close"));
  openButton.append(icon("menu", { size: 22 }));

  document.querySelector("[data-logout]").addEventListener("click", async () => {
    try {
      await api("/auth/logout", { method: "POST", body: {} });
    } finally {
      location.replace("/login");
    }
  });
  openButton.addEventListener("click", () => setSidebar(true, { moveFocus: true }));
  for (const el of document.querySelectorAll("[data-sidebar-close]")) {
    el.addEventListener("click", () => setSidebar(false, { moveFocus: true }));
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.dataset.open === "true") setSidebar(false, { moveFocus: true });
  });

  renderUser();
  onCountsChanged(refreshCounts);
  refreshCounts();

  document.querySelector("[data-boot]").remove();
  document.querySelector("[data-app]").hidden = false;
  window.addEventListener("hashchange", route);
  route();
}

window.addEventListener("unhandledrejection", (event) => {
  if (event.reason?.status === 401) location.replace("/login");
  else if (event.reason?.message) toast(event.reason.message, "error");
});

boot();
