(() => {
  const APP_VERSION = "1.0.8";

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

  import(`./library-controls.js?v=${APP_VERSION}`).catch((error) => {
    console.error("목록 제어 UI를 불러오지 못했습니다.", error);
  });

  import(`./archive-six-columns.js?v=${APP_VERSION}`).catch((error) => {
    console.error("보관함 6열 UI를 불러오지 못했습니다.", error);
  });

  import(`./image-navigation.js?v=${APP_VERSION}`).catch((error) => {
    console.error("이미지 탐색 기능을 불러오지 못했습니다.", error);
  });
})();
