const ARCHIVE_LLM_FILTER_KEY = "prompt-manager-archive-active-llms";
const ARCHIVE_LLM_TYPES = [
  { type: "CHATGPT", label: "ChatGPT" },
  { type: "GEMINI", label: "Gemini" },
  { type: "GROK", label: "Grok" },
  { type: "CLAUDE", label: "Claude" },
];

let activeArchiveLlmTypes = loadActiveArchiveLlmTypes();
let archiveImageMetadata = [];
let refreshTimer = null;
let refreshSequence = 0;

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

function openPromptDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("prompt-vault", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("보관함 필터 데이터를 불러올 수 없습니다."));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("보관함 필터 데이터를 읽을 수 없습니다."));
  });
}

async function readPromptMetadata() {
  const db = await openPromptDatabase();
  if (!db.objectStoreNames.contains("prompts")) {
    db.close();
    return [];
  }

  const transaction = db.transaction("prompts", "readonly");
  const prompts = await requestResult(transaction.objectStore("prompts").getAll());
  db.close();
  return prompts;
}

function buildArchiveImageMetadata(prompts) {
  return [...prompts]
    .sort((first, second) => (second.updatedAt ?? 0) - (first.updatedAt ?? 0))
    .flatMap((prompt) => {
      if (!Array.isArray(prompt.images)) return [];
      return prompt.images
        .filter((image) => image && typeof image.dataUrl === "string" && image.dataUrl.startsWith("data:image/"))
        .map(() => ({
          promptId: prompt.id,
          llmType: typeof prompt.llmType === "string" ? prompt.llmType : "",
        }));
    });
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

  const visiblePromptIds = new Set();
  let visibleImageCount = 0;

  grid.querySelectorAll("[data-archive-image-index]").forEach((item) => {
    const index = Number(item.dataset.archiveImageIndex);
    const metadata = Number.isInteger(index) ? archiveImageMetadata[index] : null;
    const visible = Boolean(metadata && activeArchiveLlmTypes.has(metadata.llmType));
    item.hidden = !visible;
    if (visible) {
      visibleImageCount += 1;
      visiblePromptIds.add(metadata.promptId);
    }
  });

  grid.querySelectorAll(".archive-prompt-group").forEach((group) => {
    group.hidden = !group.querySelector("[data-archive-image-index]:not([hidden])");
  });

  const totalImageCount = archiveImageMetadata.length;
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

async function refreshArchiveMetadata() {
  const sequence = ++refreshSequence;
  const prompts = await readPromptMetadata();
  if (sequence !== refreshSequence) return;
  archiveImageMetadata = buildArchiveImageMetadata(prompts);
  applyArchiveLlmFilter();
}

function scheduleArchiveFilterRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshArchiveMetadata().catch((error) => {
      console.error(error instanceof Error ? error.message : "보관함 LLM 필터 오류");
    });
  }, 80);
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
    new MutationObserver(scheduleArchiveFilterRefresh)
      .observe(grid, { childList: true, subtree: true });
  }

  const promptList = document.querySelector("#promptList");
  if (promptList) {
    new MutationObserver(scheduleArchiveFilterRefresh)
      .observe(promptList, { childList: true, subtree: true });
  }

  scheduleArchiveFilterRefresh();
}

installArchiveLlmFilter();
