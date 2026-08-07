const APP_VERSION = "1.5.0";
const ARCHIVE_COLUMNS_KEY = "prompt-manager-archive-columns";
const SIX_COLUMNS_KEY = "prompt-manager-archive-six-columns";

function readSixColumnPreference() {
  try {
    return localStorage.getItem(SIX_COLUMNS_KEY) === "true";
  } catch {
    return false;
  }
}

function writeSixColumnPreference(enabled) {
  try {
    if (enabled) {
      localStorage.setItem(SIX_COLUMNS_KEY, "true");
      localStorage.setItem(ARCHIVE_COLUMNS_KEY, "6");
    } else {
      localStorage.removeItem(SIX_COLUMNS_KEY);
    }
  } catch {
    // 저장소 접근이 제한된 환경에서는 현재 세션 상태만 유지합니다.
  }
}

function installStylesheet() {
  if (document.querySelector("link[data-archive-six-columns-style]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `./archive-six-columns.css?v=${APP_VERSION}`;
  link.dataset.archiveSixColumnsStyle = "true";
  document.head.append(link);
}

function applyArchiveColumns(columns) {
  const grid = document.querySelector("#imageArchiveGrid");
  if (!grid) return;

  grid.dataset.columns = columns;
  document.querySelectorAll("[data-archive-columns]").forEach((button) => {
    const active = button.dataset.archiveColumns === columns;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function createSixColumnButton(controls) {
  let button = controls.querySelector('[data-archive-columns="6"]');
  if (button) return button;

  button = document.createElement("button");
  button.className = "archive-view-button";
  button.type = "button";
  button.dataset.archiveColumns = "6";
  button.setAttribute("aria-label", "한 행에 이미지 6개");
  button.title = "매우 작은 썸네일";
  button.textContent = "6열";
  controls.append(button);
  return button;
}

function initArchiveSixColumns() {
  const controls = document.querySelector(".archive-view-controls");
  if (!controls || controls.dataset.sixColumnsInstalled === "true") return false;

  controls.dataset.sixColumnsInstalled = "true";
  const sixColumnButton = createSixColumnButton(controls);

  sixColumnButton.addEventListener("click", () => {
    writeSixColumnPreference(true);
    applyArchiveColumns("6");
  });

  controls.querySelectorAll('[data-archive-columns]:not([data-archive-columns="6"])')
    .forEach((button) => {
      button.addEventListener("click", () => {
        writeSixColumnPreference(false);
      });
    });

  if (readSixColumnPreference()) {
    applyArchiveColumns("6");
  } else {
    sixColumnButton.classList.remove("active");
    sixColumnButton.setAttribute("aria-pressed", "false");
  }
  return true;
}

function waitForArchiveControls() {
  if (initArchiveSixColumns()) return;

  const observer = new MutationObserver(() => {
    if (initArchiveSixColumns()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("load", () => {
    if (initArchiveSixColumns()) observer.disconnect();
  }, { once: true });
}

installStylesheet();
waitForArchiveControls();
