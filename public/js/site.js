// Marketing site: header (theme, mobile menu) and the interactive sections present on the page.
import { initCalc, initDelay, initDemo, initExample, initJobs, initScore } from "./site/widgets.js";

// ---- Theme toggle (light / dark), remembered on this device ----------------------------------------

const root = document.documentElement;
const themeButtons = document.querySelectorAll("[data-theme-toggle]");

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  for (const button of themeButtons) button.setAttribute("aria-pressed", String(theme === "dark"));
}

applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
for (const button of themeButtons) {
  button.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem("fl-theme", next);
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this page only.
    }
  });
}

// ---- Mobile navigation -----------------------------------------------------------------------------

const toggle = document.querySelector("[data-nav-toggle]");
const nav = document.getElementById("site-nav");

function setNav(open, { returnFocus = false } = {}) {
  toggle?.setAttribute("aria-expanded", String(open));
  nav?.setAttribute("data-open", String(open));
  if (!open && returnFocus) toggle?.focus();
}

toggle?.addEventListener("click", () => setNav(toggle.getAttribute("aria-expanded") !== "true"));
nav?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) setNav(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && nav?.dataset.open === "true") setNav(false, { returnFocus: true });
});

// ---- Sections --------------------------------------------------------------------------------------

const audience = document.body.dataset.audience;
const find = (selector) => document.querySelector(selector);

if (find("[data-example]")) initExample(find("[data-example]"));
if (find("[data-jobs]")) initJobs(find("[data-jobs]"));
if (find("[data-score]")) initScore(find("[data-score]"), audience);
if (find("[data-calc]")) initCalc(find("[data-calc]"));
if (find("[data-demo]")) initDemo(find("[data-demo]"));
if (find("[data-delay]")) initDelay(find("[data-delay]"));
