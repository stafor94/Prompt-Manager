(() => {
  const APP_VERSION = "1.0.4";

  function applyVersion() {
    document.querySelectorAll(".app-version-badge").forEach((badge) => {
      const expected = `v${APP_VERSION}`;
      if (badge.textContent !== expected) badge.textContent = expected;
      if (badge.getAttribute("aria-label") !== `앱 버전 ${APP_VERSION}`) {
        badge.setAttribute("aria-label", `앱 버전 ${APP_VERSION}`);
      }
    });

    document.querySelectorAll(".info-list div").forEach((row) => {
      if (row.querySelector("dt")?.textContent.trim() !== "버전") return;
      const value = row.querySelector("dd");
      if (value && value.textContent !== `v${APP_VERSION}`) {
        value.textContent = `v${APP_VERSION}`;
      }
    });
  }

  applyVersion();
  setTimeout(applyVersion, 0);
  window.addEventListener("load", applyVersion, { once: true });

  const observer = new MutationObserver(applyVersion);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
