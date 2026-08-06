const LAST_ACTIVE_TAB_KEY = "prompt-manager-last-active-tab";
const VALID_TABS = new Set(["library", "archive", "settings"]);
const DEFAULT_TAB = "library";

export function normalizeTab(route, fallback = DEFAULT_TAB) {
  return VALID_TABS.has(route) ? route : fallback;
}

export function resolveRestoredTab(storedRoute, fallback = DEFAULT_TAB) {
  return normalizeTab(storedRoute, normalizeTab(fallback));
}

function readLastActiveTab() {
  try {
    return resolveRestoredTab(localStorage.getItem(LAST_ACTIVE_TAB_KEY));
  } catch {
    return DEFAULT_TAB;
  }
}

function storeLastActiveTab(route) {
  const resolvedRoute = normalizeTab(route, null);
  if (!resolvedRoute) return;
  try {
    localStorage.setItem(LAST_ACTIVE_TAB_KEY, resolvedRoute);
  } catch {
    // 저장소 접근이 제한된 환경에서는 현재 화면만 유지합니다.
  }
}

function installTabPersistence() {
  const root = document.documentElement;
  if (root.dataset.tabPersistenceInstalled === "true") return;
  root.dataset.tabPersistenceInstalled = "true";

  let restored = false;
  let observer = null;
  let restoreTimeout = null;

  document.addEventListener("click", (event) => {
    const tab = event.target.closest?.(".nav-item[data-route]");
    if (!tab) return;
    storeLastActiveTab(tab.dataset.route);
  }, true);

  function stopWaiting() {
    observer?.disconnect();
    observer = null;
    clearTimeout(restoreTimeout);
    restoreTimeout = null;
  }

  function restoreLastTab() {
    if (restored) return true;

    const route = readLastActiveTab();
    const tab = document.querySelector(`.nav-item[data-route="${route}"]`);
    const screen = document.querySelector(`#${route}Screen`);
    if (!tab || !screen) return false;

    restored = true;
    stopWaiting();

    const alreadyActive = tab.classList.contains("active") && screen.classList.contains("active");
    if (!alreadyActive) tab.click();
    return true;
  }

  function restoreWhenReady() {
    if (restoreLastTab()) return;

    observer = new MutationObserver(() => {
      restoreLastTab();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    restoreTimeout = setTimeout(() => {
      stopWaiting();
      if (!restored) {
        const fallbackTab = document.querySelector('.nav-item[data-route="library"]');
        if (fallbackTab && !fallbackTab.classList.contains("active")) fallbackTab.click();
      }
    }, 5000);
  }

  if (document.readyState === "complete") {
    setTimeout(restoreWhenReady, 0);
  } else {
    window.addEventListener("load", () => setTimeout(restoreWhenReady, 0), { once: true });
  }
}

if (typeof document !== "undefined") {
  installTabPersistence();
}
