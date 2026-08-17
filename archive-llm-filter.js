const ARCHIVE_LLM_FILTER_KEY = "prompt-manager-archive-active-llms";
const ARCHIVE_LLM_TYPES = [
  { type: "CHATGPT", label: "ChatGPT" },
  { type: "GEMINI", label: "Gemini" },
  { type: "GROK", label: "Grok" },
  { type: "CLAUDE", label: "Claude" },
];

let activeArchiveLlmTypes = loadActiveArchiveLlmTypes();
let refreshTimer = null;

function loadActiveArchiveLlmTypes() {
  const fallback = new Set(ARCHIVE_LLM_TYPES.map(({ type }) => type));
  try {
    const saved = JSON.parse(localStorage.getItem(ARCHIVE_LLM_FILTER_KEY));
    if (!Array.isArray(saved)) return fallback;
    return new Set(saved.filter((type) => ARCHIVE_LLM_TYPES.some((item) => item.type === type)));
  } catch {
    return fallback;
  }
}

function saveActiveArchiveLlmTypes() {
  try {
    localStorage.setItem(ARCHIVE_LLM_FILTER_KEY, JSON.stringify([...activeArchiveLlmTypes]));
  } catch {
    // 저장소 접근이 제한된 환경에서는 현재 세션에만 적용합니다.
  }
}

function renderArchiveLlmButtons() {
  document.querySelectorAll("[data-archive-llm-filter]").forEach((button) => {
    const active = activeArchiveLlmTypes.has(button.dataset.archiveLlmFilter);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
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
    const llmType = item.dataset.archiveLlmType ?? "";
    const visible = activeArchiveLlmTypes.has(llmType);
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
  const allTypesActive = activeArchiveLlmTypes.size === ARCHIVE_LLM_TYPES.length;
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
  if (!heading || !toolbar || heading.querySelector(".archive-llm-filter-field")) return false;

  const fieldset = document.createElement("fieldset");
  fieldset.className = "archive-llm-filter-field";
  fieldset.innerHTML = `
    <legend>LLM</legend>
    <div class="archive-llm-filter-buttons" role="group" aria-label="보관함 LLM 필터">
      ${ARCHIVE_LLM_TYPES.map(({ type, label }) => `
        <button class="archive-llm-filter-button" type="button" data-archive-llm-filter="${type}" aria-pressed="true">${label}</button>
      `).join("")}
    </div>
  `;
  heading.insertBefore(fieldset, toolbar);

  fieldset.querySelectorAll("[data-archive-llm-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.archiveLlmFilter;
      if (!ARCHIVE_LLM_TYPES.some((item) => item.type === type)) return;
      if (activeArchiveLlmTypes.has(type)) activeArchiveLlmTypes.delete(type);
      else activeArchiveLlmTypes.add(type);
      saveActiveArchiveLlmTypes();
      renderArchiveLlmButtons();
      applyArchiveLlmFilter();
      notifyArchiveFilterChange();
    });
  });

  renderArchiveLlmButtons();
  return true;
}

function installArchiveLlmFilter() {
  if (!createArchiveLlmFilter()) {
    const screenObserver = new MutationObserver(() => {
      if (!createArchiveLlmFilter()) return;
      screenObserver.disconnect();
      installArchiveObservers();
    });
    screenObserver.observe(document.body, { childList: true, subtree: true });
    return;
  }
  installArchiveObservers();
}

function installArchiveObservers() {
  const grid = document.querySelector("#imageArchiveGrid");
  if (grid) {
    new MutationObserver(scheduleArchiveFilterRefresh).observe(grid, { childList: true, subtree: true });
  }
  applyArchiveLlmFilter();
}

installArchiveLlmFilter();
