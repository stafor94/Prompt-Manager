const APP_VERSION = "1.5.5";
const STORAGE_KEYS = Object.freeze({
  search: "prompt-manager-library-search",
  sort: "prompt-manager-library-sort",
  favoritesOnly: "prompt-manager-library-favorites-only",
});
const VALID_SORT_ORDERS = new Set(["UPDATED_DESC", "CREATED_DESC", "TITLE_ASC"]);

function readPreference(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writePreference(key, value) {
  try { localStorage.setItem(key, value); } catch {
    // 저장소 접근이 제한된 환경에서는 현재 세션 상태만 유지합니다.
  }
}

function installStylesheet() {
  if (document.querySelector("link[data-library-controls-style]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `./library-controls.css?v=${APP_VERSION}`;
  link.dataset.libraryControlsStyle = "true";
  document.head.append(link);
}

function restorePreferences(elements) {
  const savedSearch = readPreference(STORAGE_KEYS.search);
  if (savedSearch !== null) elements.searchInput.value = savedSearch;
  const savedSort = readPreference(STORAGE_KEYS.sort);
  if (savedSort && VALID_SORT_ORDERS.has(savedSort)
    && [...elements.sortOrder.options].some((option) => option.value === savedSort)) {
    elements.sortOrder.value = savedSort;
  }
  elements.favoritesOnly.checked = readPreference(STORAGE_KEYS.favoritesOnly) === "true";
}

function syncFavoriteChip(favoriteField, favoritesOnly) {
  const active = favoritesOnly.checked;
  favoriteField.classList.toggle("active", active);
  favoriteField.setAttribute("aria-label", active ? "즐겨찾기만 필터 해제" : "즐겨찾기만 필터 적용");
  favoritesOnly.setAttribute("aria-checked", String(active));
}

function installLayout(elements) {
  const { libraryScreen, filterGrid, listOptions, sortField, favoriteField, promptCount, sortOrder } = elements;
  let controls = libraryScreen.querySelector(".library-control-row");
  if (!controls) {
    controls = document.createElement("div");
    controls.className = "library-control-row";
    controls.setAttribute("aria-label", "목록 표시 조건");
    filterGrid.insertAdjacentElement("afterend", controls);
  }
  favoriteField.classList.add("favorite-filter-chip");
  favoriteField.querySelector("span").textContent = "즐겨찾기만";
  controls.append(favoriteField);
  sortField.classList.add("sort-compact-control");
  sortField.querySelector(":scope > span")?.classList.add("visually-hidden");
  sortOrder.setAttribute("aria-label", "정렬 기준");
  controls.append(sortField);
  if (listOptions && listOptions.childElementCount === 0) listOptions.hidden = true;
  let summary = libraryScreen.querySelector(".library-result-summary");
  if (!summary) {
    summary = document.createElement("div");
    summary.className = "library-result-summary";
    controls.insertAdjacentElement("afterend", summary);
  }
  promptCount.classList.add("library-result-count");
  summary.append(promptCount);
}

function bindPreferences(elements) {
  const { searchInput, sortOrder, favoritesOnly, favoriteField } = elements;
  searchInput.addEventListener("input", () => writePreference(STORAGE_KEYS.search, searchInput.value));
  sortOrder.addEventListener("input", () => {
    if (VALID_SORT_ORDERS.has(sortOrder.value)) writePreference(STORAGE_KEYS.sort, sortOrder.value);
  });
  favoritesOnly.addEventListener("input", () => {
    writePreference(STORAGE_KEYS.favoritesOnly, String(favoritesOnly.checked));
    syncFavoriteChip(favoriteField, favoritesOnly);
  });
  favoritesOnly.addEventListener("change", () => {
    writePreference(STORAGE_KEYS.favoritesOnly, String(favoritesOnly.checked));
    syncFavoriteChip(favoriteField, favoritesOnly);
  });
}

function requestListRender(searchInput) {
  searchInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function initLibraryControls() {
  const libraryScreen = document.querySelector("#libraryScreen");
  const filterGrid = libraryScreen?.querySelector(".filter-grid");
  const listOptions = libraryScreen?.querySelector(".list-options");
  const sortField = document.querySelector(".sort-field");
  const sortOrder = document.querySelector("#sortOrder");
  const favoritesOnly = document.querySelector("#favoritesOnly");
  const favoriteField = favoritesOnly?.closest(".checkbox-field");
  const searchInput = document.querySelector("#searchInput");
  const promptCount = document.querySelector("#promptCount");
  if (!libraryScreen || !filterGrid || !sortField || !sortOrder || !favoritesOnly
    || !favoriteField || !searchInput || !promptCount) return;
  const elements = { libraryScreen, filterGrid, listOptions, sortField, sortOrder, favoritesOnly, favoriteField, searchInput, promptCount };
  installStylesheet();
  restorePreferences(elements);
  installLayout(elements);
  syncFavoriteChip(favoriteField, favoritesOnly);
  bindPreferences(elements);
  queueMicrotask(() => requestListRender(searchInput));
}

function scheduleLibraryControls() {
  const run = () => setTimeout(initLibraryControls, 0);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
}

scheduleLibraryControls();
