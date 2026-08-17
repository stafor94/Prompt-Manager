import { getAllPromptSummaries, getPromptRecords } from "./prompt-db.mjs";
import {
  getArchiveTotals,
  prepareArchiveSummaries,
  takeArchiveSummaryBatch,
} from "./archive-pagination-core.mjs";

const APP_VERSION = "1.5.4";
const ARCHIVE_COLUMNS_KEY = "prompt-manager-archive-columns";
const ARCHIVE_MODE_KEY = "prompt-manager-archive-mode";
const ARCHIVE_HISTORY_KEY = "promptManagerArchive";
const ARCHIVE_LLM_FILTER_KEY = "prompt-manager-archive-active-llms";
const ARCHIVE_COLUMN_OPTIONS = new Set(["2", "3", "4"]);
const ARCHIVE_MODE_OPTIONS = new Set(["ALL", "GROUPED"]);
const ARCHIVE_LLM_TYPES = ["CHATGPT", "GEMINI", "GROK", "CLAUDE"];
const ARCHIVE_PULL_THRESHOLD = 36;

const addPromptButton = document.querySelector("#addPromptButton");
const promptList = document.querySelector("#promptList");
const imageViewerDialog = document.querySelector("#imageViewerDialog");
const imageViewerImage = document.querySelector("#imageViewerImage");
const imageViewerCaption = document.querySelector("#imageViewerCaption");

let archiveImages = [];
let archiveSummaries = [];
let archiveNextSummaryIndex = 0;
let archiveTotals = { promptCount: 0, imageCount: 0 };
let archiveRefreshTimer = null;
let archiveViewerHistoryActive = false;
let archiveMode = readArchiveMode();
let archiveActive = false;
let archiveDirty = true;
let archiveLoading = false;
let archiveGeneration = 0;
let archiveTouchStartY = null;

function readArchiveColumns() {
  try {
    const value = localStorage.getItem(ARCHIVE_COLUMNS_KEY);
    return ARCHIVE_COLUMN_OPTIONS.has(value) ? value : "3";
  } catch {
    return "3";
  }
}

function saveArchiveColumns(columns) {
  if (!ARCHIVE_COLUMN_OPTIONS.has(columns)) return;
  try {
    localStorage.setItem(ARCHIVE_COLUMNS_KEY, columns);
  } catch {
    // 저장소 접근이 제한된 환경에서는 현재 세션에만 적용합니다.
  }
}

function readArchiveMode() {
  try {
    const value = localStorage.getItem(ARCHIVE_MODE_KEY);
    return ARCHIVE_MODE_OPTIONS.has(value) ? value : "ALL";
  } catch {
    return "ALL";
  }
}

function saveArchiveMode(mode) {
  if (!ARCHIVE_MODE_OPTIONS.has(mode)) return;
  try {
    localStorage.setItem(ARCHIVE_MODE_KEY, mode);
  } catch {
    // 저장소 접근이 제한된 환경에서는 현재 세션에만 적용합니다.
  }
}

function readActiveArchiveLlmTypes() {
  const fallback = new Set(ARCHIVE_LLM_TYPES);
  try {
    const saved = JSON.parse(localStorage.getItem(ARCHIVE_LLM_FILTER_KEY));
    if (!Array.isArray(saved)) return fallback;
    return new Set(saved.filter((type) => ARCHIVE_LLM_TYPES.includes(type)));
  } catch {
    return fallback;
  }
}

function installVersionMetadata() {
  document.querySelectorAll(".app-version-badge").forEach((badge) => {
    badge.textContent = `v${APP_VERSION}`;
    badge.setAttribute("aria-label", `앱 버전 ${APP_VERSION}`);
  });

  document.querySelectorAll(".info-list div").forEach((row) => {
    if (row.querySelector("dt")?.textContent.trim() === "버전") {
      const value = row.querySelector("dd");
      if (value) value.textContent = `v${APP_VERSION}`;
    }
  });

  if (!document.querySelector('link[data-archive-grouping-style]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `./archive-grouping.css?v=${APP_VERSION}`;
    link.dataset.archiveGroupingStyle = "true";
    document.head.append(link);
  }
}

function installLibraryLayout() {
  const libraryScreen = document.querySelector("#libraryScreen");
  const heading = libraryScreen?.querySelector(".screen-heading");
  const sortField = document.querySelector(".sort-field");
  const libraryNavItem = document.querySelector('.nav-item[data-route="library"]');
  if (!libraryScreen || !heading || !sortField || !addPromptButton) return;

  if (libraryNavItem) libraryNavItem.textContent = "프롬프트";
  sortField.classList.add("library-sort-field");
  heading.insertBefore(sortField, addPromptButton);

  addPromptButton.classList.add("new-prompt-fab");
  addPromptButton.textContent = "+";
  addPromptButton.setAttribute("aria-label", "새 프롬프트 추가");
  addPromptButton.title = "새 프롬프트";
}

function createArchiveScreen() {
  const main = document.querySelector("main");
  const settingsScreen = document.querySelector("#settingsScreen");
  if (!main || document.querySelector("#archiveScreen")) return;

  const section = document.createElement("section");
  section.id = "archiveScreen";
  section.className = "screen";
  section.setAttribute("aria-labelledby", "archiveHeading");
  section.innerHTML = `
    <div class="screen-heading archive-screen-heading">
      <div>
        <h2 id="archiveHeading">보관함</h2>
        <p id="archiveImageCount" class="supporting-text">첨부 이미지 0장</p>
      </div>
      <div class="archive-toolbar">
        <div class="archive-mode-controls" role="group" aria-label="이미지 묶음 방식">
          <button class="archive-mode-button" type="button" data-archive-mode="ALL" aria-label="모든 이미지를 한 목록으로 보기">전체</button>
          <button class="archive-mode-button" type="button" data-archive-mode="GROUPED" aria-label="동일한 프롬프트의 이미지끼리 묶어 보기">프롬프트별</button>
        </div>
        <div class="archive-view-controls" role="group" aria-label="이미지 보기 방식">
          <button class="archive-view-button" type="button" data-archive-columns="2" aria-label="한 행에 이미지 2개" title="큰 썸네일">2열</button>
          <button class="archive-view-button" type="button" data-archive-columns="3" aria-label="한 행에 이미지 3개" title="보통 썸네일">3열</button>
          <button class="archive-view-button" type="button" data-archive-columns="4" aria-label="한 행에 이미지 4개" title="작은 썸네일">4열</button>
        </div>
      </div>
    </div>
    <div id="imageArchiveGrid" class="image-archive-grid" data-columns="3" data-mode="ALL" data-lazy-archive="true" aria-live="polite"></div>
    <p id="archiveLoadMoreStatus" class="supporting-text" role="status" aria-live="polite" hidden></p>
    <div id="archiveEmptyState" class="empty-state hidden">
      <strong>첨부된 이미지가 없습니다.</strong>
      <p>프롬프트에 이미지를 첨부하면 이곳에 모아서 표시됩니다.</p>
    </div>
  `;
  main.insertBefore(section, settingsScreen ?? null);
}

function createArchiveNavigation() {
  const navigation = document.querySelector(".navigation");
  const settingsNavItem = navigation?.querySelector('.nav-item[data-route="settings"]');
  if (!navigation || navigation.querySelector('[data-route="archive"]')) return;

  const button = document.createElement("button");
  button.className = "nav-item";
  button.type = "button";
  button.dataset.route = "archive";
  button.textContent = "보관함";
  navigation.insertBefore(button, settingsNavItem ?? null);
}

function setArchiveColumns(columns) {
  const resolved = ARCHIVE_COLUMN_OPTIONS.has(columns) ? columns : "3";
  const grid = document.querySelector("#imageArchiveGrid");
  if (grid) grid.dataset.columns = resolved;
  document.querySelectorAll("[data-archive-columns]").forEach((button) => {
    const active = button.dataset.archiveColumns === resolved;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  saveArchiveColumns(resolved);
}

function setArchiveMode(mode) {
  archiveMode = ARCHIVE_MODE_OPTIONS.has(mode) ? mode : "ALL";
  const grid = document.querySelector("#imageArchiveGrid");
  if (grid) grid.dataset.mode = archiveMode;
  document.querySelectorAll("[data-archive-mode]").forEach((button) => {
    const active = button.dataset.archiveMode === archiveMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  saveArchiveMode(archiveMode);
  renderArchiveContent();
}

function buildArchiveImages(prompts) {
  return (Array.isArray(prompts) ? prompts : []).flatMap((prompt) => {
    if (!Array.isArray(prompt?.images)) return [];
    return prompt.images
      .filter((image) => image && typeof image.dataUrl === "string" && image.dataUrl.startsWith("data:image/"))
      .map((image, index) => ({
        promptId: prompt.id,
        promptTitle: typeof prompt.title === "string" ? prompt.title : "제목 없음",
        llmType: typeof prompt.llmType === "string" ? prompt.llmType : "",
        imageName: typeof image.name === "string" && image.name ? image.name : `첨부 이미지 ${index + 1}`,
        dataUrl: image.dataUrl,
      }));
  });
}

function buildArchiveGroups(images, startIndex = 0) {
  const groups = [];
  const groupsByPromptId = new Map();

  images.forEach((image, offset) => {
    let group = groupsByPromptId.get(image.promptId);
    if (!group) {
      group = { promptId: image.promptId, promptTitle: image.promptTitle, images: [] };
      groupsByPromptId.set(image.promptId, group);
      groups.push(group);
    }
    group.images.push({ ...image, archiveIndex: startIndex + offset });
  });

  return groups;
}

function createArchiveImageItem(image, index, showCaption = true) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "image-archive-item";
  button.dataset.archiveImageIndex = String(index);
  button.dataset.archiveLlmType = image.llmType;
  button.dataset.promptId = String(image.promptId);
  button.setAttribute("aria-label", `${image.promptTitle}의 ${image.imageName} 확대 보기`);

  const thumbnail = document.createElement("img");
  thumbnail.src = image.dataUrl;
  thumbnail.alt = image.imageName;
  thumbnail.loading = "lazy";
  thumbnail.decoding = "async";
  button.append(thumbnail);

  if (showCaption) {
    const caption = document.createElement("span");
    caption.className = "image-archive-caption";
    caption.textContent = image.promptTitle;
    button.append(caption);
  }

  return button;
}

function createArchiveGroup(group) {
  const section = document.createElement("section");
  section.className = "archive-prompt-group";
  section.dataset.promptId = String(group.promptId);

  const header = document.createElement("div");
  header.className = "archive-prompt-group-header";
  const title = document.createElement("h3");
  title.textContent = group.promptTitle;
  title.title = group.promptTitle;
  const count = document.createElement("span");
  count.className = "archive-prompt-group-count";
  count.textContent = `${group.images.length}장`;
  const imageGrid = document.createElement("div");
  imageGrid.className = "archive-prompt-group-grid";
  imageGrid.replaceChildren(...group.images.map((image) => createArchiveImageItem(image, image.archiveIndex, false)));

  header.append(title, count);
  section.append(header, imageGrid);
  return section;
}

function renderArchiveContent() {
  const grid = document.querySelector("#imageArchiveGrid");
  if (!grid) return;
  grid.dataset.mode = archiveMode;
  if (archiveMode === "GROUPED") {
    grid.replaceChildren(...buildArchiveGroups(archiveImages).map(createArchiveGroup));
    return;
  }
  grid.replaceChildren(...archiveImages.map((image, index) => createArchiveImageItem(image, index)));
}

function appendArchiveImages(images) {
  if (!Array.isArray(images) || images.length === 0) return;
  const grid = document.querySelector("#imageArchiveGrid");
  if (!grid) return;

  const startIndex = archiveImages.length;
  archiveImages.push(...images);

  if (archiveMode === "GROUPED") {
    grid.append(...buildArchiveGroups(images, startIndex).map(createArchiveGroup));
    return;
  }

  grid.append(...images.map((image, offset) => createArchiveImageItem(image, startIndex + offset)));
}

function archiveHasMore() {
  return archiveNextSummaryIndex < archiveSummaries.length;
}

function updateArchiveUi() {
  const grid = document.querySelector("#imageArchiveGrid");
  const count = document.querySelector("#archiveImageCount");
  const empty = document.querySelector("#archiveEmptyState");
  const loadStatus = document.querySelector("#archiveLoadMoreStatus");
  if (!grid || !count || !empty || !loadStatus) return;

  grid.dataset.archiveTotalImages = String(archiveTotals.imageCount);
  grid.dataset.archiveLoadedImages = String(archiveImages.length);
  grid.dataset.archiveTotalPrompts = String(archiveTotals.promptCount);

  count.textContent = archiveHasMore() || archiveLoading
    ? `로드 ${archiveImages.length} / ${archiveTotals.imageCount}장 · 프롬프트 ${archiveTotals.promptCount}개`
    : `첨부 이미지 ${archiveImages.length}장 · 연결된 프롬프트 ${archiveTotals.promptCount}개`;

  const hasImages = archiveTotals.imageCount > 0;
  empty.classList.toggle("hidden", hasImages);
  if (!hasImages) {
    const activeTypes = readActiveArchiveLlmTypes();
    const filtered = activeTypes.size !== ARCHIVE_LLM_TYPES.length;
    const strong = empty.querySelector("strong");
    const description = empty.querySelector("p");
    if (strong) strong.textContent = filtered ? "선택한 LLM의 이미지가 없습니다." : "첨부된 이미지가 없습니다.";
    if (description) description.textContent = filtered
      ? "상단에서 다른 LLM 필터를 선택하세요."
      : "프롬프트에 이미지를 첨부하면 이곳에 모아서 표시됩니다.";
  }

  if (archiveLoading) {
    loadStatus.hidden = false;
    loadStatus.textContent = "이미지를 불러오는 중입니다.";
  } else if (archiveHasMore()) {
    loadStatus.hidden = false;
    loadStatus.textContent = `${archiveImages.length} / ${archiveTotals.imageCount}장 로드됨 · 목록 끝에서 위로 밀어 더 불러오기`;
  } else {
    loadStatus.hidden = true;
    loadStatus.textContent = "";
  }
}

async function loadNextArchiveBatch(expectedGeneration = archiveGeneration) {
  if (!archiveActive || archiveLoading || !archiveHasMore()) return;

  const page = takeArchiveSummaryBatch(archiveSummaries, archiveNextSummaryIndex);
  if (page.batch.length === 0) {
    archiveNextSummaryIndex = page.nextIndex;
    updateArchiveUi();
    return;
  }

  archiveLoading = true;
  updateArchiveUi();

  try {
    const records = await getPromptRecords(page.batch.map((summary) => summary.id));
    if (!archiveActive || expectedGeneration !== archiveGeneration) return;
    appendArchiveImages(buildArchiveImages(records));
    archiveNextSummaryIndex = page.nextIndex;
  } finally {
    if (expectedGeneration === archiveGeneration) {
      archiveLoading = false;
      updateArchiveUi();
    }
  }
}

async function renderArchiveGallery() {
  if (!archiveActive) return;
  const generation = ++archiveGeneration;
  archiveLoading = true;
  archiveImages = [];
  archiveSummaries = [];
  archiveNextSummaryIndex = 0;
  archiveTotals = { promptCount: 0, imageCount: 0 };
  document.querySelector("#imageArchiveGrid")?.replaceChildren();
  updateArchiveUi();

  try {
    const summaries = await getAllPromptSummaries();
    if (!archiveActive || generation !== archiveGeneration) return;
    archiveSummaries = prepareArchiveSummaries(summaries, readActiveArchiveLlmTypes());
    archiveTotals = getArchiveTotals(archiveSummaries);
    archiveDirty = false;
  } finally {
    if (generation === archiveGeneration) archiveLoading = false;
  }

  if (!archiveActive || generation !== archiveGeneration) return;
  updateArchiveUi();
  await loadNextArchiveBatch(generation);
}

function scheduleArchiveRefresh() {
  archiveDirty = true;
  clearTimeout(archiveRefreshTimer);
  if (!archiveActive) return;
  archiveRefreshTimer = setTimeout(() => {
    renderArchiveGallery().catch((error) => console.error(error instanceof Error ? error.message : "이미지 보관함 오류"));
  }, 60);
}

function isDocumentAtBottom() {
  const root = document.documentElement;
  return window.scrollY + window.innerHeight >= root.scrollHeight - 4;
}

function requestMoreArchiveImages() {
  if (!archiveActive || archiveLoading || !archiveHasMore() || !isDocumentAtBottom()) return;
  loadNextArchiveBatch().catch((error) => console.error(error instanceof Error ? error.message : "이미지 추가 로드 오류"));
}

function bindArchiveLoadGesture() {
  window.addEventListener("touchstart", (event) => {
    if (!archiveActive || event.touches.length !== 1) return;
    archiveTouchStartY = event.touches[0].clientY;
  }, { passive: true });

  window.addEventListener("touchmove", (event) => {
    if (!archiveActive || archiveTouchStartY === null || event.touches.length !== 1) return;
    const currentY = event.touches[0].clientY;
    if (archiveTouchStartY - currentY < ARCHIVE_PULL_THRESHOLD) return;
    archiveTouchStartY = currentY;
    requestMoreArchiveImages();
  }, { passive: true });

  const clearTouch = () => { archiveTouchStartY = null; };
  window.addEventListener("touchend", clearTouch, { passive: true });
  window.addEventListener("touchcancel", clearTouch, { passive: true });
  window.addEventListener("wheel", (event) => {
    if (event.deltaY > 0) requestMoreArchiveImages();
  }, { passive: true });
}

function openArchiveImage(index) {
  const image = archiveImages[index];
  if (!image || !imageViewerDialog || !imageViewerImage || !imageViewerCaption) return;
  imageViewerImage.src = image.dataUrl;
  imageViewerImage.alt = image.imageName;
  imageViewerImage.style.transform = "translate3d(0, 0, 0) scale(1)";
  imageViewerCaption.textContent = `${index + 1} / ${archiveImages.length} · ${image.promptTitle}`;
  const currentState = history.state && typeof history.state === "object" ? history.state : {};
  history.pushState({ ...currentState, promptManagerArchiveViewer: true }, "", location.href);
  archiveViewerHistoryActive = true;
  imageViewerDialog.showModal();
}

function arrangePromptCardMeta() {
  document.querySelectorAll(".prompt-card").forEach((card) => {
    const header = card.querySelector(".prompt-card-header");
    const badge = header?.querySelector(".llm-badge");
    const meta = card.querySelector(":scope > .prompt-meta");
    const favorite = header?.querySelector(".favorite-mark");
    if (!header || !badge || !meta) return;
    let group = header.querySelector(".prompt-card-primary-meta");
    if (!group) {
      group = document.createElement("div");
      group.className = "prompt-card-primary-meta";
      header.insertBefore(group, favorite ?? null);
    }
    group.append(badge, meta);
  });
}

function activateArchive() {
  archiveActive = true;
  document.querySelectorAll(".nav-item").forEach((item) => {
    const active = item.dataset.route === "archive";
    item.classList.toggle("active", active);
    item.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === "archiveScreen"));
  window.scrollTo({ top: 0, behavior: "instant" });
  if (archiveDirty) scheduleArchiveRefresh();
}

function deactivateArchive() {
  archiveActive = false;
  archiveGeneration += 1;
  archiveLoading = false;
  archiveTouchStartY = null;
  clearTimeout(archiveRefreshTimer);
  document.querySelector("#archiveScreen")?.classList.remove("active");
  const archiveNavItem = document.querySelector('.nav-item[data-route="archive"]');
  archiveNavItem?.classList.remove("active");
  archiveNavItem?.setAttribute("aria-current", "false");
  document.querySelector("#imageArchiveGrid")?.replaceChildren();
  const loadStatus = document.querySelector("#archiveLoadMoreStatus");
  if (loadStatus) loadStatus.hidden = true;
  archiveImages = [];
  archiveSummaries = [];
  archiveNextSummaryIndex = 0;
  archiveTotals = { promptCount: 0, imageCount: 0 };
  archiveDirty = true;
}

function installArchiveUi() {
  createArchiveScreen();
  createArchiveNavigation();
  setArchiveColumns(readArchiveColumns());
  setArchiveMode(archiveMode);

  document.querySelectorAll("[data-archive-columns]").forEach((button) => button.addEventListener("click", () => setArchiveColumns(button.dataset.archiveColumns)));
  document.querySelectorAll("[data-archive-mode]").forEach((button) => button.addEventListener("click", () => setArchiveMode(button.dataset.archiveMode)));
  document.querySelector("#imageArchiveGrid")?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-archive-image-index]");
    if (item) openArchiveImage(Number(item.dataset.archiveImageIndex));
  });

  document.querySelector('.nav-item[data-route="archive"]')?.addEventListener("click", () => {
    const currentState = history.state && typeof history.state === "object" ? history.state : {};
    if (!currentState[ARCHIVE_HISTORY_KEY]) history.pushState({ ...currentState, [ARCHIVE_HISTORY_KEY]: true }, "", location.href);
    activateArchive();
  });

  document.querySelectorAll('.nav-item:not([data-route="archive"])').forEach((item) => {
    item.addEventListener("click", () => {
      deactivateArchive();
      const currentState = history.state && typeof history.state === "object" ? history.state : {};
      if (currentState[ARCHIVE_HISTORY_KEY]) {
        const nextState = { ...currentState };
        delete nextState[ARCHIVE_HISTORY_KEY];
        history.replaceState(nextState, "", location.href);
      }
    });
  });

  document.querySelector("#closeImageViewerButton")?.addEventListener("click", (event) => {
    if (!archiveViewerHistoryActive) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    history.back();
  }, { capture: true });
  imageViewerDialog?.addEventListener("cancel", (event) => {
    if (!archiveViewerHistoryActive) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    history.back();
  }, { capture: true });
  imageViewerDialog?.addEventListener("close", () => { archiveViewerHistoryActive = false; });
  window.addEventListener("popstate", (event) => { if (event.state?.[ARCHIVE_HISTORY_KEY]) activateArchive(); else deactivateArchive(); });
  window.addEventListener("prompt-manager:archive-llm-filter-change", scheduleArchiveRefresh);

  if (promptList) {
    const observer = new MutationObserver(() => { arrangePromptCardMeta(); scheduleArchiveRefresh(); });
    observer.observe(promptList, { childList: true, subtree: true });
  }

  bindArchiveLoadGesture();
  arrangePromptCardMeta();
}

installVersionMetadata();
installLibraryLayout();
installArchiveUi();
