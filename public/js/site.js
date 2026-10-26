// Marketing site: sticky header state and mobile navigation.
const header = document.querySelector("[data-header]");
const toggle = document.querySelector("[data-nav-toggle]");
const nav = document.getElementById("site-nav");

const onScroll = () => header?.setAttribute("data-scrolled", String(window.scrollY > 8));
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

function setOpen(open) {
  toggle?.setAttribute("aria-expanded", String(open));
  nav?.setAttribute("data-open", String(open));
}

toggle?.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
nav?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) setOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setOpen(false);
});
