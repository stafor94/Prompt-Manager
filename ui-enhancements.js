const ARCHIVE_COLUMNS_KEY = "prompt-manager-archive-columns";
const ARCHIVE_HISTORY_KEY = "promptManagerArchive";
const ARCHIVE_COLUMN_OPTIONS = new Set(["2", "3", "4"]);

const addPromptButton = document.querySelector("#addPromptButton");
const promptList = document.querySelector("#promptList");
const imageViewerDialog = document.querySelector("#imageViewerDialog");
const imageViewerImage = document.querySelector("#imageViewerImage");
const imageViewerCaption = document.querySelector("#imageViewerCaption");

let archiveImages = [];
let archiveRefreshTimer = null;
let archiveViewerHistoryActive = false;

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
      <div class="archive-view-controls" role="group" aria-label="이미지 보기 방식">
        <button class="archive-view-button" type="button" data-archive-columns="2" aria-label="한 행에 이미지 2개" title="큰 썸네일">2열</button>
        <button class="archive-view-button" type="button" data-archive-columns="3" aria-label="한 행에 이미지 3개" title="보통 썸네일">3열</button>
        <button class="archive-view-button" type="button" data-archive-columns="4" aria-label="한 행에 이미지 4개" title="작은 썸네일">4열</button>
      </div>
    </div>
    <div id="imageArchiveGrid" class="image-archive-grid" data-columns="3" aria-live="polite"></div>
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

function openPromptDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("prompt-vault", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("prompts")) {
        const store = db.createObjectStore("prompts", { keyPath: "id", autoIncrement: true });
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("llmType", "llmType");
        store.createIndex("isFavorite", "isFavorite");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("이미지 보관함을 불러올 수 없습니다."));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("이미지 데이터를 읽을 수 없습니다."));
  });
}

async function readArchivePrompts() {
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

function buildArchiveImages(prompts) {
  return [...prompts]
    .sort((first, second) => (second.updatedAt ?? 0) - (first.updatedAt ?? 0))
    .flatMap((prompt) => {
      if (!Array.isArray(prompt.images)) return [];
      return prompt.images
        .filter((image) => image && typeof image.dataUrl === "string" && image.dataUrl.startsWith("data:image/"))
        .map((image, index) => ({
          promptId: prompt.id,
          promptTitle: typeof prompt.title === "string" ? prompt.title : "제목 없음",
          imageName: typeof image.name === "string" && image.name ? image.name : `첨부 이미지 ${index + 1}`,
          dataUrl: image.dataUrl,
        }));
    });
}

function createArchiveImageItem(image, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "image-archive-item";
  button.dataset.archiveImageIndex = String(index);
  button.setAttribute("aria-label", `${image.promptTitle}의 ${image.imageName} 확대 보기`);

  const thumbnail = document.createElement("img");
  thumbnail.src = image.dataUrl;
  thumbnail.alt = image.imageName;
  thumbnail.loading = "lazy";

  const caption = document.createElement("span");
  caption.className = "image-archive-caption";
  caption.textContent = image.promptTitle;

  button.append(thumbnail, caption);
  return button;
}

async function renderArchiveGallery() {
  const grid = document.querySelector("#imageArchiveGrid");
  const count = document.querySelector("#archiveImageCount");
  const empty = document.querySelector("#archiveEmptyState");
  if (!grid || !count || !empty) return;

  const prompts = await readArchivePrompts();
  archiveImages = buildArchiveImages(prompts);
  const promptCount = new Set(archiveImages.map((image) => image.promptId)).size;
  count.textContent = `첨부 이미지 ${archiveImages.length}장 · 연결된 프롬프트 ${promptCount}개`;
  empty.classList.toggle("hidden", archiveImages.length > 0);
  grid.replaceChildren(...archiveImages.map(createArchiveImageItem));
}

function scheduleArchiveRefresh() {
  clearTimeout(archiveRefreshTimer);
  archiveRefreshTimer = setTimeout(() => {
    renderArchiveGallery().catch((error) => {
      console.error(error instanceof Error ? error.message : "이미지 보관함 오류");
    });
  }, 60);
}

function openArchiveImage(index) {
  const image = archiveImages[index];
  if (!image || !imageViewerDialog || !imageViewerImage || !imageViewerCaption) return;
  imageViewerImage.src = image.dataUrl;
  imageViewerImage.alt = image.imageName;
  imageViewerImage.style.transform = "translate3d(0, 0, 0) scale(1)";
  imageViewerCaption.textContent = `${index + 1} / ${archiveImages.length} · ${image.promptTitle} · ${image.imageName}`;
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
  document.querySelectorAll(".nav-item").forEach((item) => {
    const active = item.dataset.route === "archive";
    item.classList.toggle("active", active);
    item.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === "archiveScreen");
  });
  window.scrollTo({ top: 0, behavior: "instant" });
  scheduleArchiveRefresh();
}

function deactivateArchive() {
  document.querySelector('#archiveScreen')?.classList.remove("active");
  const archiveNavItem = document.querySelector('.nav-item[data-route="archive"]');
  archiveNavItem?.classList.remove("active");
  archiveNavItem?.setAttribute("aria-current", "false");
}

function installArchiveUi() {
  createArchiveScreen();
  createArchiveNavigation();
  setArchiveColumns(readArchiveColumns());

  document.querySelectorAll("[data-archive-columns]").forEach((button) => {
    button.addEventListener("click", () => setArchiveColumns(button.dataset.archiveColumns));
  });

  document.querySelector("#imageArchiveGrid")?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-archive-image-index]");
    if (item) openArchiveImage(Number(item.dataset.archiveImageIndex));
  });

  document.querySelector('.nav-item[data-route="archive"]')?.addEventListener("click", () => {
    const currentState = history.state && typeof history.state === "object" ? history.state : {};
    if (!currentState[ARCHIVE_HISTORY_KEY]) {
      history.pushState({ ...currentState, [ARCHIVE_HISTORY_KEY]: true }, "", location.href);
    }
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

  imageViewerDialog?.addEventListener("close", () => {
    archiveViewerHistoryActive = false;
  });

  window.addEventListener("popstate", (event) => {
    if (event.state?.[ARCHIVE_HISTORY_KEY]) {
      activateArchive();
    } else {
      deactivateArchive();
    }
  });

  if (promptList) {
    const observer = new MutationObserver(() => {
      arrangePromptCardMeta();
      scheduleArchiveRefresh();
    });
    observer.observe(promptList, { childList: true, subtree: true });
  }

  arrangePromptCardMeta();
  scheduleArchiveRefresh();
}

installLibraryLayout();
installArchiveUi();
