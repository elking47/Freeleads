// Applies the saved (or system) colour theme before first paint to avoid a flash.
// Loaded as a classic blocking script: the CSP forbids inline scripts.
(function () {
  var theme = null;
  try {
    theme = window.localStorage.getItem("fl-theme");
  } catch (error) {
    theme = null;
  }
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", theme);
})();
