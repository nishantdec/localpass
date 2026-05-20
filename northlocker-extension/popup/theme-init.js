/**
 * Theme initializer — runs before CSS paints to prevent flash.
 * Must be an external file; MV3 CSP blocks all inline scripts.
 */
(function () {
  try {
    chrome.storage.local.get(['theme', 'popup_size'], function (d) {
      // Default to light unless explicitly configured as dark
      const theme = (d && d.theme) ? d.theme : 'light';
      if (theme === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }
      if (d && d.popup_size) {
        document.documentElement.classList.add('size-' + d.popup_size.replace('_', '-'));
      }
    });
  } catch (e) {
    document.documentElement.classList.add('light');
  }
})();
