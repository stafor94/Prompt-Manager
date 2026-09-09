import { getAllCustomLlmRecords } from "./prompt-db.mjs";
import { getLlmDefinitions, normalizeCustomLlms } from "./llm-registry.mjs";

const ARCHIVE_LLM_FILTER_KEY = "prompt-manager-archive-active-llms";
const ARCHIVE_KNOWN_LLM_KEY = "prompt-manager-archive-known-llms";
let definitions = [];
let activeArchiveLlmTypes = new Set();
let refreshTimer = null;

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : null;
  } catch {
    return null;
  }
}

function reconcileActiveTypes() {
  const validTypes = new Set(definitions.map(({ type }) => type));
  const savedActive = readArray(ARCHIVE_LLM_FILTER_KEY);
  const savedKnown = new Set(readArray(ARCHIVE_KNOWN_LLM_KEY) ?? ["CHATGPT", "GEMINI", "GROK", "CLAUDE"]);
  activeArchiveLlmTypes = new Set((savedActive ?? [...validTypes]).filter((type) => validTypes.has(type)));
  for (const type of validTypes) {
    if (!savedKnown.has(type)) activeArchiveLlmTypes.add(type);
  }
  saveActiveArchiveLlmTypes();
}

function saveActiveArchiveLlmTypes() {
  try {
    localStorage.setItem(ARCHIVE_LLM_FILTER_KEY, JSON.stringify([...activeArchiveLlmTypes]));
    localStorage.setItem(ARCHIVE_KNOWN_LLM_KEY, JSON.stringify(definitions.map(({ type }) => type)));
  } catch {
    // 저장소 접근이 제한된 환경에서는 현재 세션에만 적용합니다.
  }
}

function renderArchiveLlmButtons() {
  const container = document.querySelector(".archive-llm-filter-buttons");
  if (!container) return;
  container.replaceChildren(...definitions.map(({ type, label }) => {
    const button = document.createElement("button");
    button.className = "archive-llm-filter-button";
    button.type = "button";
    button.dataset.archiveLlmFilter = type;
    button.textContent = label;
    const active = activeArchiveLlmTypes.has(type);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    return button;
  }));
}

function applyArchiveLlmFilter() {
  const grid = document.querySelector("#imageArchiveGrid");
  const count = document.querySelector("#archiveImageCount");
  const empty = document.querySelector("#archiveEmptyState");
  if (!grid || !count || !empty) return;
  const items = [...grid.querySelectorAll("[data-archive-image-index]")];
  const visiblePromptIds = new Set();
  let visibleImageCount = 0;
  items.forEach((item) => {
    const visible = activeArchiveLlmTypes.has(item.dataset.archiveLlmType ?? "");
    item.hidden = !visible;
    if (!visible) return;
    visibleImageCount += 1;
    if (item.dataset.promptId) visiblePromptIds.add(item.dataset.promptId);
  });
  grid.querySelectorAll(".archive-prompt-group").forEach((group) => {
    group.hidden = !group.querySelector("[data-archive-image-index]:not([hidden])");
  });
  if (grid.dataset.lazyArchive === "true") return;
  const totalImageCount = items.length;
  const allTypesActive = activeArchiveLlmTypes.size === definitions.length;
  count.textContent = allTypesActive
    ? `첨부 이미지 ${totalImageCount}장 · 연결된 프롬프트 ${visiblePromptIds.size}개`
    : `표시 ${visibleImageCount}장 · 전체 ${totalImageCount}장 · 프롬프트 ${visiblePromptIds.size}개`;
  const strong = empty.querySelector("strong");
  const description = empty.querySelector("p");
  const hasVisibleImages = visibleImageCount > 0;
  empty.classList.toggle("hidden", hasVisibleImages);
  if (totalImageCount > 0 && !hasVisibleImages) {
    if (strong) strong.textContent = "선택한 LLM의 이미지가 없습니다.";
    if (description) description.textContent = "상단에서 다른 LLM 필터를 선택하세요.";
  } else {
    if (strong) strong.textContent = "첨부된 이미지가 없습니다.";
    if (description) description.textContent = "프롬프트에 이미지를 첨부하면 이곳에 모아서 표시됩니다.";
  }
}

function scheduleArchiveFilterRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(applyArchiveLlmFilter, 0);
}

function notifyArchiveFilterChange() {
  window.dispatchEvent(new CustomEvent("prompt-manager:archive-llm-filter-change", {
    detail: { activeTypes: [...activeArchiveLlmTypes] },
  }));
}

function createArchiveLlmFilter() {
  const heading = document.querySelector("#archiveScreen .archive-screen-heading");
  const toolbar = heading?.querySelector(".archive-toolbar");
  if (!heading || !toolbar) return false;
  let fieldset = heading.querySelector(".archive-llm-filter-field");
  if (!fieldset) {
    fieldset = document.createElement("fieldset");
    fieldset.className = "archive-llm-filter-field";
    const legend = document.createElement("legend");
    legend.textContent = "LLM";
    const container = document.createElement("div");
    container.className = "archive-llm-filter-buttons";
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", "보관함 LLM 필터");
    fieldset.append(legend, container);
    heading.insertBefore(fieldset, toolbar);
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-archive-llm-filter]");
      if (!button || !definitions.some(({ type }) => type === button.dataset.archiveLlmFilter)) return;
      const type = button.dataset.archiveLlmFilter;
      if (activeArchiveLlmTypes.has(type)) activeArchiveLlmTypes.delete(type);
      else activeArchiveLlmTypes.add(type);
      saveActiveArchiveLlmTypes();
      renderArchiveLlmButtons();
      applyArchiveLlmFilter();
      notifyArchiveFilterChange();
    });
  }
  renderArchiveLlmButtons();
  return true;
}

function installArchiveObservers() {
  const grid = document.querySelector("#imageArchiveGrid");
  if (grid && grid.dataset.llmFilterObserved !== "true") {
    grid.dataset.llmFilterObserved = "true";
    new MutationObserver(scheduleArchiveFilterRefresh).observe(grid, { childList: true, subtree: true });
  }
  applyArchiveLlmFilter();
}

function installArchiveLlmFilter() {
  if (!createArchiveLlmFilter()) {
    const observer = new MutationObserver(() => {
      if (!createArchiveLlmFilter()) return;
      observer.disconnect();
      installArchiveObservers();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return;
  }
  installArchiveObservers();
}

async function refreshDefinitions() {
  definitions = getLlmDefinitions(normalizeCustomLlms(await getAllCustomLlmRecords()));
  reconcileActiveTypes();
  installArchiveLlmFilter();
  notifyArchiveFilterChange();
}

window.addEventListener("prompt-manager:llms-changed", () => refreshDefinitions().catch(console.error));
refreshDefinitions().catch(console.error);
