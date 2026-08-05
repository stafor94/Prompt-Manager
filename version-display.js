(() => {
  const APP_VERSION = "1.0.4";

  function applyVersion() {
    document.querySelectorAll(".app-version-badge").forEach((badge) => {
      badge.textContent = `v${APP_VERSION}`;
      badge.setAttribute("aria-label", `앱 버전 ${APP_VERSION}`);
    });

    document.querySelectorAll(".info-list div").forEach((row) => {
      if (row.querySelector("dt")?.textContent.trim() !== "버전") return;
      const value = row.querySelector("dd");
      if (value) value.textContent = `v${APP_VERSION}`;
    });
  }

  applyVersion();
  window.addEventListener("load", applyVersion, { once: true });
  setTimeout(applyVersion, 0);
})();
