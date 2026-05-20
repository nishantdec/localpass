/* localpass Javascript Utilities */

document.addEventListener("DOMContentLoaded", function () {
  // 1. Keyboard shortcut '/' to focus search bar
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      const searchInput = document.querySelector(".md-search__input");
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    }
  });

  // 2. Custom console logger indicating premium portal setup
  console.log("localpass Technical Developer Portal successfully loaded.");
  
  // 3. Setup analytics or logging hooks placeholder if needed
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    console.log("Accessibility Mode: Reduced motion is enabled on the client system.");
  }
});
