import {
  assignPromptVersions,
  getPromptVersion,
  isValidPromptVersion,
  resolvePromptVersion,
} from "./prompt-version.mjs";

const DB_NAME = "prompt-vault";
const DB_VERSION = 1;
const STORE_NAME = "prompts";
const BACKUP_SCHEMA_VERSION = 1;
const TITLE_MAX_LENGTH = 50;
const LLM_LABELS = {
  CHATGPT: "ChatGPT",
  GEMINI: "Gemini",
  GROK: "Grok",
  CLAUDE: "Claude",
};
const VALID_LLM_TYPES = new Set(Object.keys(LLM_LABELS));

const state = {
  prompts: [],
  activePromptId: null,
  editingPromptId: null,
  editorSnapshot: null,
  deferredInstallPrompt: null,
  snackbarTimer: null,
};

const elements = {
  navItems: [...document.querySelectorAll(".nav-item")],
  screens: [...document.querySelectorAll(".screen")],
  installButton: document.querySelector("#installButton"),
  addPromptButton: document.querySelector("#addPromptButton"),
  searchInput: document.querySelector("#searchInput"),
  llmFilter: document.querySelector("#llmFilter"),
  sortOrder: document.querySelector("#sortOrder"),
  favoritesOnly: document.querySelector("#favoritesOnly"),
  promptList: document.querySelector("#promptList"),
  promptCount: document.querySelector("#promptCount"),
  emptyState: document.querySelector("#emptyState"),
  editorDialog: document.querySelector("#editorDialog"),
  promptForm: document.querySelector("#promptForm"),
  editorTitle: document.querySelector("#editorTitle"),
  promptLlm: document.querySelector("#promptLlm"),
  promptTitleInput: document.querySelector("#promptTitleInput"),
  promptContentInput: document.querySelector("#promptContentInput"),
  promptFavoriteInput: document.querySelector("#promptFavoriteInput"),
  titleCount: document.querySelector("#titleCount"),
  closeEditorButton: document.querySelector("#closeEditorButton"),
  cancelEditorButton: document.querySelector("#cancelEditorButton"),
  detailDialog: document.querySelector("#detailDialog"),
  detailLlm: document.querySelector("#detailLlm"),
  detailTitle: document.querySelector("#detailTitle"),
  detailVersion: document.querySelector("#detailVersion"),
  detailDates: document.querySelector("#detailDates"),
  detailContent: document.querySelector("#detailContent"),
  closeDetailButton: document.querySelector("#closeDetailButton"),
  deletePromptButton: document.querySelector("#deletePromptButton"),
  favoritePromptButton: document.querySelector("#favoritePromptButton"),
  copyPromptButton: document.querySelector("#copyPromptButton"),
  duplicatePromptButton: document.querySelector("#duplicatePromptButton"),
  editPromptButton: document.querySelector("#editPromptButton"),
  exportButton: document.querySelector("#exportButton"),
  restoreButton: document.querySelector("#restoreButton"),
  restoreMode: document.querySelector("#restoreMode"),
  restoreFileInput: document.querySelector("#restoreFileInput"),
  storageSummary: document.querySelector("#storageSummary"),
  persistStorageButton: document.querySelector("#persistStorageButton"),
  snackbar: document.querySelector("#snackbar"),
};

let dbPromise;

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("llmType", "llmType");
        store.createIndex("isFavorite", "isFavorite");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("데이터베이스를 열 수 없습니다."));
    request.onblocked = () => reject(new Error("다른 탭에서 데이터베이스가 사용 중입니다."));
  });
  return dbPromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("요청을 처리할 수 없습니다."));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("트랜잭션 오류"));
    transaction.onabort = () => reject(transaction.error ?? new Error("트랜잭션 취소"));
  });
}

async function getAllPrompts() {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readonly");
  return requestToPromise(transaction.objectStore(STORE_NAME).getAll());
}

async function getPrompt(id) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readonly");
  return requestToPromise(transaction.objectStore(STORE_NAME).get(id));
}

async function putPrompt(prompt) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const id = await requestToPromise(transaction.objectStore(STORE_NAME).put(prompt));
  await transactionDone(transaction);
  return id;
}

async function deletePrompt(id) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).delete(id);
  await transactionDone(transaction);
}

async function ensurePromptVersions(prompts) {
  const normalized = assignPromptVersions(prompts);
  if (normalized.changedIndexes.length === 0) return normalized.prompts;

  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  normalized.changedIndexes.forEach((index) => store.put(normalized.prompts[index]));
  await transactionDone(transaction);
  return normalized.prompts;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function getCharacterLength(value) {
  return [...value].length;
}

function currentEditorValue() {
  return JSON.stringify({
    llmType: elements.promptLlm.value,
    title: elements.promptTitleInput.value,
    content: elements.promptContentInput.value,
    isFavorite: elements.promptFavoriteInput.checked,
  });
}

function isEditorDirty() {
  return elements.editorDialog.open && state.editorSnapshot !== currentEditorValue();
}

function showSnackbar(message) {
  clearTimeout(state.snackbarTimer);
  elements.snackbar.textContent = message;
  elements.snackbar.classList.add("show");
  state.snackbarTimer = setTimeout(() => elements.snackbar.classList.remove("show"), 2600);
}

function navigate(route) {
  elements.navItems.forEach((item) => {
    const active = item.dataset.route === route;
    item.classList.toggle("active", active);
    item.setAttribute("aria-current", active ? "page" : "false");
  });
  elements.screens.forEach((screen) => screen.classList.toggle("active", screen.id === `${route}Screen`));
  location.hash = route;
  window.scrollTo({ top: 0, behavior: "instant" });
}

function getFilteredPrompts() {
  const query = elements.searchInput.value.trim().toLocaleLowerCase("ko-KR");
  const llm = elements.llmFilter.value;
  const favoritesOnly = elements.favoritesOnly.checked;
  const result = state.prompts.filter((prompt) => {
    if (llm !== "ALL" && prompt.llmType !== llm) return false;
    if (favoritesOnly && !prompt.isFavorite) return false;
    if (!query) return true;
    return prompt.title.toLocaleLowerCase("ko-KR").includes(query)
      || prompt.content.toLocaleLowerCase("ko-KR").includes(query);
  });

  switch (elements.sortOrder.value) {
    case "CREATED_DESC":
      result.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "TITLE_ASC":
      result.sort((a, b) => a.title.localeCompare(b.title, "ko-KR", { sensitivity: "base" }));
      break;
    case "UPDATED_DESC":
    default:
      result.sort((a, b) => b.updatedAt - a.updatedAt);
      break;
  }
  return result;
}

function renderPromptList() {
  const prompts = getFilteredPrompts();
  elements.promptCount.textContent = `${prompts.length}개 표시 · 전체 ${state.prompts.length}개`;
  elements.emptyState.classList.toggle("hidden", prompts.length > 0);
  elements.promptList.innerHTML = prompts.map((prompt) => `
    <button class="prompt-card" type="button" data-prompt-id="${prompt.id}">
      <div class="prompt-card-header">
        <span class="llm-badge" data-llm="${prompt.llmType}">${LLM_LABELS[prompt.llmType] ?? prompt.llmType}</span>
        <span class="favorite-mark" aria-label="${prompt.isFavorite ? "즐겨찾기" : "일반"}">${prompt.isFavorite ? "★" : ""}</span>
      </div>
      <h3>${escapeHtml(prompt.title)}</h3>
      <p class="prompt-preview">${escapeHtml(prompt.content)}</p>
      <div class="prompt-meta">
        <span class="prompt-version">v${getPromptVersion(prompt)}</span>
        <span>수정 ${formatDate(prompt.updatedAt)}</span>
      </div>
    </button>
  `).join("");
}

async function refreshPrompts() {
  const prompts = await getAllPrompts();
  state.prompts = await ensurePromptVersions(prompts);
  renderPromptList();
  await updateStorageSummary();
}

function openEditor(prompt = null, options = {}) {
  const asDuplicate = options.asDuplicate === true;
  state.editingPromptId = asDuplicate ? null : (prompt?.id ?? null);
  elements.editorTitle.textContent = asDuplicate
    ? "프롬프트 복제"
    : (prompt ? "프롬프트 수정" : "새 프롬프트");
  elements.promptLlm.value = prompt?.llmType ?? "CHATGPT";
  elements.promptTitleInput.value = prompt?.title ?? "";
  elements.promptContentInput.value = prompt?.content ?? "";
  elements.promptFavoriteInput.checked = asDuplicate ? false : (prompt?.isFavorite ?? false);
  updateTitleCount();
  state.editorSnapshot = asDuplicate ? null : currentEditorValue();
  elements.editorDialog.showModal();
  setTimeout(() => elements.promptTitleInput.focus(), 0);
}

function tryCloseEditor() {
  if (isEditorDirty() && !confirm("저장되지 않은 변경 사항이 있습니다. 편집을 종료할까요?")) return;
  elements.editorDialog.close();
}

function updateTitleCount() {
  const length = getCharacterLength(elements.promptTitleInput.value);
  elements.titleCount.textContent = `${length} / ${TITLE_MAX_LENGTH}자`;
}

async function submitPrompt(event) {
  event.preventDefault();
  const title = elements.promptTitleInput.value;
  const content = elements.promptContentInput.value;
  const llmType = elements.promptLlm.value;

  if (!VALID_LLM_TYPES.has(llmType)) {
    showSnackbar("LLM 종류를 선택하세요.");
    return;
  }
  if (!title.trim()) {
    showSnackbar("제목을 입력하세요.");
    elements.promptTitleInput.focus();
    return;
  }
  if (getCharacterLength(title) > TITLE_MAX_LENGTH) {
    showSnackbar(`제목은 ${TITLE_MAX_LENGTH}자까지 입력할 수 있습니다.`);
    elements.promptTitleInput.focus();
    return;
  }
  if (!content.trim()) {
    showSnackbar("본문을 입력하세요.");
    elements.promptContentInput.focus();
    return;
  }

  const now = Date.now();
  const previous = state.editingPromptId ? await getPrompt(state.editingPromptId) : null;
  const version = resolvePromptVersion(state.prompts, title, previous);
  const prompt = {
    ...(previous?.id ? { id: previous.id } : {}),
    llmType,
    title,
    content,
    version,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    isFavorite: elements.promptFavoriteInput.checked,
  };
  await putPrompt(prompt);
  state.editorSnapshot = currentEditorValue();
  elements.editorDialog.close();
  await refreshPrompts();
  showSnackbar(previous ? "프롬프트를 수정했습니다." : "프롬프트를 저장했습니다.");
}

async function openDetail(id) {
  const prompt = await getPrompt(Number(id));
  if (!prompt) {
    showSnackbar("프롬프트를 찾을 수 없습니다.");
    return;
  }
  state.activePromptId = prompt.id;
  elements.detailLlm.textContent = LLM_LABELS[prompt.llmType] ?? prompt.llmType;
  elements.detailLlm.dataset.llm = prompt.llmType;
  elements.detailTitle.textContent = prompt.title;
  if (elements.detailVersion) elements.detailVersion.textContent = `v${getPromptVersion(prompt)}`;
  elements.detailDates.textContent = `생성 ${formatDate(prompt.createdAt)} · 수정 ${formatDate(prompt.updatedAt)}`;
  elements.detailContent.textContent = prompt.content;
  elements.favoritePromptButton.textContent = prompt.isFavorite ? "즐겨찾기 해제" : "즐겨찾기";
  elements.detailDialog.showModal();
}

async function copyTextExactly(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("클립보드 복사 실패");
  }
  showSnackbar("본문을 복사했습니다.");
}

function validateBackup(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("백업 파일 형식이 올바르지 않습니다.");
  if (data.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error(`지원하지 않는 schemaVersion입니다: ${data.schemaVersion}`);
  if (!Array.isArray(data.prompts)) throw new Error("prompts 배열이 없습니다.");

  return data.prompts.map((prompt, index) => {
    const fail = (reason) => { throw new Error(`${index + 1}번째 프롬프트: ${reason}`); };
    if (!prompt || typeof prompt !== "object") fail("객체가 아닙니다.");
    if (!VALID_LLM_TYPES.has(prompt.llmType)) fail("LLM 종류가 올바르지 않습니다.");
    if (typeof prompt.title !== "string" || !prompt.title.trim()) fail("제목이 없습니다.");
    if (getCharacterLength(prompt.title) > TITLE_MAX_LENGTH) fail(`제목은 ${TITLE_MAX_LENGTH}자까지 허용됩니다.`);
    if (typeof prompt.content !== "string" || !prompt.content.trim()) fail("본문이 없습니다.");
    if (!Number.isFinite(prompt.createdAt) || prompt.createdAt < 0) fail("생성 일시가 올바르지 않습니다.");
    if (!Number.isFinite(prompt.updatedAt) || prompt.updatedAt < 0) fail("수정 일시가 올바르지 않습니다.");
    if (prompt.version !== undefined && !isValidPromptVersion(prompt.version)) fail("버전 값이 올바르지 않습니다.");
    if (typeof prompt.isFavorite !== "boolean") fail("즐겨찾기 값이 올바르지 않습니다.");
    return {
      llmType: prompt.llmType,
      title: prompt.title,
      content: prompt.content,
      ...(isValidPromptVersion(prompt.version) ? { version: prompt.version } : {}),
      createdAt: prompt.createdAt,
      updatedAt: prompt.updatedAt,
      isFavorite: prompt.isFavorite,
    };
  });
}

async function exportBackup() {
  const backup = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: Date.now(),
    prompts: state.prompts.map(({ id, ...prompt }) => prompt),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().replaceAll(":", "-").replace(".000Z", "Z");
  anchor.href = url;
  anchor.download = `prompt-vault-backup-${stamp}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showSnackbar("백업 파일을 생성했습니다.");
}

async function restoreBackup(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("JSON을 해석할 수 없습니다.");
  }
  const incoming = validateBackup(parsed);
  const mode = elements.restoreMode.value;
  if (mode === "REPLACE" && !confirm(`기존 ${state.prompts.length}개 데이터를 삭제하고 ${incoming.length}개로 교체할까요?`)) return;

  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);

  if (mode === "REPLACE") store.clear();
  let candidates = incoming;
  if (mode === "DEDUPLICATE") {
    const existingKeys = new Set(state.prompts.map((prompt) => `${prompt.llmType}\u0000${prompt.title}\u0000${prompt.content}`));
    candidates = incoming.filter((prompt) => {
      const key = `${prompt.llmType}\u0000${prompt.title}\u0000${prompt.content}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
  }
  candidates.forEach((prompt) => store.add(prompt));
  await transactionDone(transaction);
  await refreshPrompts();
  showSnackbar(`${candidates.length}개 프롬프트를 복원했습니다.`);
}

function applyTheme(theme) {
  const resolved = theme === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]').setAttribute("content", resolved === "dark" ? "#141218" : "#6750a4");
  document.querySelectorAll('input[name="theme"]').forEach((radio) => { radio.checked = radio.value === theme; });
}

async function updateStorageSummary() {
  if (!navigator.storage?.estimate) {
    elements.storageSummary.textContent = `프롬프트 ${state.prompts.length}개 저장됨`;
    return;
  }
  const estimate = await navigator.storage.estimate();
  const usageMb = ((estimate.usage ?? 0) / 1024 / 1024).toFixed(2);
  const quotaMb = ((estimate.quota ?? 0) / 1024 / 1024).toFixed(0);
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  elements.storageSummary.textContent = `프롬프트 ${state.prompts.length}개 · 이 사이트 데이터 약 ${usageMb}MB / 할당량 약 ${quotaMb}MB · 유지 설정 ${persisted ? "적용됨" : "미적용"}`;
}

function bindEvents() {
  elements.navItems.forEach((item) => item.addEventListener("click", () => navigate(item.dataset.route)));
  elements.addPromptButton.addEventListener("click", () => openEditor());
  [elements.searchInput, elements.llmFilter, elements.sortOrder, elements.favoritesOnly]
    .forEach((element) => element.addEventListener("input", renderPromptList));

  elements.promptList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-prompt-id]");
    if (card) openDetail(card.dataset.promptId).catch(handleError);
  });
  elements.promptTitleInput.addEventListener("input", updateTitleCount);
  elements.promptForm.addEventListener("submit", (event) => submitPrompt(event).catch(handleError));
  elements.closeEditorButton.addEventListener("click", tryCloseEditor);
  elements.cancelEditorButton.addEventListener("click", tryCloseEditor);
  elements.editorDialog.addEventListener("cancel", (event) => {
    if (isEditorDirty()) {
      event.preventDefault();
      tryCloseEditor();
    }
  });

  elements.closeDetailButton.addEventListener("click", () => elements.detailDialog.close());
  elements.copyPromptButton.addEventListener("click", async () => {
    const prompt = await getPrompt(state.activePromptId);
    if (prompt) await copyTextExactly(prompt.content);
  });
  elements.duplicatePromptButton.addEventListener("click", async () => {
    const prompt = await getPrompt(state.activePromptId);
    elements.detailDialog.close();
    if (prompt) openEditor(prompt, { asDuplicate: true });
  });
  elements.editPromptButton.addEventListener("click", async () => {
    const prompt = await getPrompt(state.activePromptId);
    elements.detailDialog.close();
    if (prompt) openEditor(prompt);
  });
  elements.favoritePromptButton.addEventListener("click", async () => {
    const prompt = await getPrompt(state.activePromptId);
    if (!prompt) return;
    prompt.isFavorite = !prompt.isFavorite;
    prompt.updatedAt = Date.now();
    await putPrompt(prompt);
    elements.detailDialog.close();
    await refreshPrompts();
    showSnackbar(prompt.isFavorite ? "즐겨찾기에 추가했습니다." : "즐겨찾기에서 해제했습니다.");
  });
  elements.deletePromptButton.addEventListener("click", async () => {
    const prompt = await getPrompt(state.activePromptId);
    if (!prompt || !confirm(`‘${prompt.title}’ 프롬프트를 삭제할까요?`)) return;
    await deletePrompt(prompt.id);
    elements.detailDialog.close();
    await refreshPrompts();
    showSnackbar("프롬프트를 삭제했습니다.");
  });

  elements.exportButton.addEventListener("click", () => exportBackup().catch(handleError));
  elements.restoreButton.addEventListener("click", () => elements.restoreFileInput.click());
  elements.restoreFileInput.addEventListener("change", async () => {
    const [file] = elements.restoreFileInput.files;
    elements.restoreFileInput.value = "";
    if (file) await restoreBackup(file).catch(handleError);
  });

  document.querySelectorAll('input[name="theme"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      localStorage.setItem("prompt-vault-theme", radio.value);
      applyTheme(radio.value);
    });
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if ((localStorage.getItem("prompt-vault-theme") ?? "system") === "system") applyTheme("system");
  });

  elements.persistStorageButton.addEventListener("click", async () => {
    if (!navigator.storage?.persist) {
      showSnackbar("이 브라우저는 저장소 유지 요청을 지원하지 않습니다.");
      return;
    }
    const granted = await navigator.storage.persist();
    await updateStorageSummary();
    showSnackbar(granted ? "저장소 유지 설정이 적용됐습니다." : "브라우저가 유지 요청을 승인하지 않았습니다.");
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    elements.installButton.classList.remove("hidden");
  });
  elements.installButton.addEventListener("click", async () => {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    elements.installButton.classList.add("hidden");
  });
  window.addEventListener("appinstalled", () => showSnackbar("앱 설치가 완료됐습니다."));
  window.addEventListener("beforeunload", (event) => {
    if (isEditorDirty()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}

function handleError(error) {
  console.error(error instanceof Error ? error.message : "알 수 없는 오류");
  showSnackbar(error instanceof Error ? error.message : "오류가 발생했습니다.");
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js", { scope: "./" });
  } catch (error) {
    console.error("서비스 워커 등록 실패", error);
  }
}

async function init() {
  const theme = localStorage.getItem("prompt-vault-theme") ?? "system";
  applyTheme(theme);
  bindEvents();
  const route = location.hash.slice(1);
  navigate(["library", "settings"].includes(route) ? route : "library");
  await refreshPrompts();
  await registerServiceWorker();
}

init().catch(handleError);