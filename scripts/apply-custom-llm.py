from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one occurrence, found {count}: {old[:80]!r}")
    write(path, text.replace(old, new, 1))


def replace_regex(path, pattern, replacement, flags=0):
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{path}: pattern matched {count} times: {pattern}")
    write(path, updated)


LLM_REGISTRY = r'''export const CUSTOM_LLM_NAME_MAX_LENGTH = 10;
export const BUILTIN_LLMS = Object.freeze([
  Object.freeze({ type: "CHATGPT", label: "ChatGPT", custom: false }),
  Object.freeze({ type: "GEMINI", label: "Gemini", custom: false }),
  Object.freeze({ type: "GROK", label: "Grok", custom: false }),
  Object.freeze({ type: "CLAUDE", label: "Claude", custom: false }),
]);

function characterLength(value) {
  return [...String(value ?? "")].length;
}

function normalizedLabelKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("ko-KR");
}

export function createCustomLlmType(name) {
  const normalized = String(name ?? "").trim();
  try {
    return `CUSTOM:${encodeURIComponent(normalized)}`;
  } catch {
    throw new Error("LLM 이름에 사용할 수 없는 문자가 포함되어 있습니다.");
  }
}

function validateNameShape(value) {
  if (typeof value !== "string") throw new Error("LLM 이름이 올바르지 않습니다.");
  const name = value.trim();
  if (!name) throw new Error("LLM 이름을 입력하세요.");
  if (characterLength(name) > CUSTOM_LLM_NAME_MAX_LENGTH) {
    throw new Error(`LLM 이름은 ${CUSTOM_LLM_NAME_MAX_LENGTH}자까지 입력할 수 있습니다.`);
  }
  if (/[\u0000-\u001f\u007f]/u.test(name)) throw new Error("LLM 이름에 제어 문자를 사용할 수 없습니다.");
  createCustomLlmType(name);
  return name;
}

export function normalizeCustomLlms(values, { strict = false } = {}) {
  if (!Array.isArray(values)) {
    if (strict) throw new Error("사용자 정의 LLM 목록이 올바르지 않습니다.");
    return [];
  }

  const result = [];
  const ids = new Set();
  const labels = new Set(BUILTIN_LLMS.map(({ label }) => normalizedLabelKey(label)));

  for (const value of values) {
    try {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("사용자 정의 LLM 항목이 올바르지 않습니다.");
      const name = validateNameShape(value.name);
      const id = createCustomLlmType(name);
      if (value.id !== id) throw new Error(`사용자 정의 LLM ID가 이름과 일치하지 않습니다: ${name}`);
      const labelKey = normalizedLabelKey(name);
      if (ids.has(id) || labels.has(labelKey)) throw new Error(`중복된 LLM 이름입니다: ${name}`);
      ids.add(id);
      labels.add(labelKey);
      result.push({ id, name });
    } catch (error) {
      if (strict) throw error;
    }
  }
  return result;
}

export function createCustomLlmRecord(value, existingCustomLlms = []) {
  const name = validateNameShape(value);
  const labelKey = normalizedLabelKey(name);
  const definitions = getLlmDefinitions(existingCustomLlms);
  if (definitions.some(({ label }) => normalizedLabelKey(label) === labelKey)) {
    throw new Error("이미 등록된 LLM 이름입니다.");
  }
  return { id: createCustomLlmType(name), name };
}

export function getLlmDefinitions(customLlms = []) {
  return [
    ...BUILTIN_LLMS.map((item) => ({ ...item })),
    ...normalizeCustomLlms(customLlms).map(({ id, name }) => ({ type: id, label: name, custom: true })),
  ];
}

export function isKnownLlmType(type, customLlms = []) {
  return getLlmDefinitions(customLlms).some((item) => item.type === type);
}

export function getLlmLabel(type, customLlms = []) {
  return getLlmDefinitions(customLlms).find((item) => item.type === type)?.label ?? String(type ?? "");
}

export function mergeCustomLlms(current, incoming) {
  const merged = normalizeCustomLlms(current, { strict: true });
  const seenIds = new Set(merged.map(({ id }) => id));
  const seenLabels = new Set(merged.map(({ name }) => normalizedLabelKey(name)));
  for (const item of normalizeCustomLlms(incoming, { strict: true })) {
    if (seenIds.has(item.id)) continue;
    const labelKey = normalizedLabelKey(item.name);
    if (seenLabels.has(labelKey)) throw new Error(`중복된 LLM 이름입니다: ${item.name}`);
    seenIds.add(item.id);
    seenLabels.add(labelKey);
    merged.push(item);
  }
  return merged;
}
'''
write("llm-registry.mjs", LLM_REGISTRY)

# IndexedDB: add a dedicated custom LLM store without touching existing prompt records.
replace_once("prompt-db.mjs", 'const DB_VERSION = 2;\nconst PROMPT_STORE = "prompts";\nconst SUMMARY_STORE = "promptSummaries";\n', 'const DB_VERSION = 3;\nconst PROMPT_STORE = "prompts";\nconst SUMMARY_STORE = "promptSummaries";\nconst CUSTOM_LLM_STORE = "customLlms";\n')
replace_once("prompt-db.mjs", '      if (!db.objectStoreNames.contains(SUMMARY_STORE)) {\n        createSummaryStore(db);\n        rebuildSummaries(request.transaction);\n      }\n', '      if (!db.objectStoreNames.contains(SUMMARY_STORE)) {\n        createSummaryStore(db);\n        rebuildSummaries(request.transaction);\n      }\n      if (!db.objectStoreNames.contains(CUSTOM_LLM_STORE)) {\n        db.createObjectStore(CUSTOM_LLM_STORE, { keyPath: "id" });\n      }\n')
replace_once("prompt-db.mjs", 'export async function getAllPromptRecords() {\n  const db = await openPromptDatabase();\n  const transaction = db.transaction(PROMPT_STORE, "readonly");\n  return requestToPromise(transaction.objectStore(PROMPT_STORE).getAll());\n}\n', 'export async function getAllPromptRecords() {\n  const db = await openPromptDatabase();\n  const transaction = db.transaction(PROMPT_STORE, "readonly");\n  return requestToPromise(transaction.objectStore(PROMPT_STORE).getAll());\n}\n\nexport async function getAllCustomLlmRecords() {\n  const db = await openPromptDatabase();\n  const transaction = db.transaction(CUSTOM_LLM_STORE, "readonly");\n  return requestToPromise(transaction.objectStore(CUSTOM_LLM_STORE).getAll());\n}\n\nexport async function putCustomLlmRecord(record) {\n  const db = await openPromptDatabase();\n  const transaction = db.transaction(CUSTOM_LLM_STORE, "readwrite");\n  transaction.objectStore(CUSTOM_LLM_STORE).put(record);\n  await transactionDone(transaction);\n}\n')
replace_regex(
    "prompt-db.mjs",
    r'export async function restorePromptRecords\(records, \{ replace = false \} = \{\}\) \{.*?\n\}',
    '''export async function restorePromptRecords(records, {\n  replace = false,\n  customLlms,\n  replaceCustomLlms = false,\n} = {}) {\n  const db = await openPromptDatabase();\n  const includeCustomLlms = Array.isArray(customLlms) || replaceCustomLlms;\n  const storeNames = [PROMPT_STORE, SUMMARY_STORE, ...(includeCustomLlms ? [CUSTOM_LLM_STORE] : [])];\n  const transaction = db.transaction(storeNames, "readwrite");\n  const promptStore = transaction.objectStore(PROMPT_STORE);\n  const summaryStore = transaction.objectStore(SUMMARY_STORE);\n  const customLlmStore = includeCustomLlms ? transaction.objectStore(CUSTOM_LLM_STORE) : null;\n\n  if (replace) {\n    promptStore.clear();\n    summaryStore.clear();\n  }\n  if (replaceCustomLlms) customLlmStore?.clear();\n\n  for (const prompt of records) {\n    const request = promptStore.add(prompt);\n    request.onsuccess = () => {\n      summaryStore.put(buildPromptSummary({ ...prompt, id: request.result }));\n    };\n    request.onerror = () => transaction.abort();\n  }\n\n  if (customLlmStore && Array.isArray(customLlms)) {\n    for (const customLlm of customLlms) customLlmStore.put(customLlm);\n  }\n\n  await transactionDone(transaction);\n}''',
    flags=re.S,
)

# Main app: load and render custom LLMs, validate them, and include them in JSON backup compatibility.
replace_once("app.js", '  deletePromptRecord,\n  getAllPromptRecords,\n  getAllPromptSummaries,\n  getPromptRecord,\n  putPromptRecord,\n  restorePromptRecords,\n} from "./prompt-db.mjs";\n', '  deletePromptRecord,\n  getAllCustomLlmRecords,\n  getAllPromptRecords,\n  getAllPromptSummaries,\n  getPromptRecord,\n  putCustomLlmRecord,\n  putPromptRecord,\n  restorePromptRecords,\n} from "./prompt-db.mjs";\nimport {\n  CUSTOM_LLM_NAME_MAX_LENGTH,\n  createCustomLlmRecord,\n  getLlmDefinitions,\n  getLlmLabel,\n  isKnownLlmType,\n  mergeCustomLlms,\n  normalizeCustomLlms,\n} from "./llm-registry.mjs";\n')
replace_once("app.js", 'const BACKUP_SCHEMA_VERSION = 2;\nconst SUPPORTED_BACKUP_SCHEMA_VERSIONS = new Set([1, 2]);\nconst TITLE_MAX_LENGTH = 50;\nconst MAX_IMAGES = 5;\nconst LLM_LABELS = {\n  CHATGPT: "ChatGPT",\n  GEMINI: "Gemini",\n  GROK: "Grok",\n  CLAUDE: "Claude",\n};\nconst VALID_LLM_TYPES = new Set(Object.keys(LLM_LABELS));\n', 'const BACKUP_SCHEMA_VERSION = 3;\nconst SUPPORTED_BACKUP_SCHEMA_VERSIONS = new Set([1, 2, 3]);\nconst TITLE_MAX_LENGTH = 50;\nconst MAX_IMAGES = 5;\n')
replace_once("app.js", 'const state = {\n  prompts: [],\n', 'const state = {\n  prompts: [],\n  customLlms: [],\n')
replace_once("app.js", '  persistStorageButton: document.querySelector("#persistStorageButton"),\n  snackbar: document.querySelector("#snackbar"),\n', '  persistStorageButton: document.querySelector("#persistStorageButton"),\n  customLlmForm: document.querySelector("#customLlmForm"),\n  customLlmNameInput: document.querySelector("#customLlmNameInput"),\n  customLlmNameCount: document.querySelector("#customLlmNameCount"),\n  customLlmList: document.querySelector("#customLlmList"),\n  supportedLlmsValue: document.querySelector("#supportedLlmsValue"),\n  snackbar: document.querySelector("#snackbar"),\n')
replace_once("app.js", 'function getCharacterLength(value) {\n  return [...value].length;\n}\n', '''function getCharacterLength(value) {\n  return [...value].length;\n}\n\nfunction updateCustomLlmNameCount() {\n  if (!elements.customLlmNameInput || !elements.customLlmNameCount) return;\n  const length = getCharacterLength(elements.customLlmNameInput.value);\n  elements.customLlmNameCount.textContent = `${length} / ${CUSTOM_LLM_NAME_MAX_LENGTH}자`;\n}\n\nfunction renderLlmConfiguration() {\n  const definitions = getLlmDefinitions(state.customLlms);\n  if (elements.promptLlm) {\n    const previous = elements.promptLlm.value;\n    const options = definitions.map(({ type, label }) => {\n      const option = document.createElement("option");\n      option.value = type;\n      option.textContent = label;\n      return option;\n    });\n    elements.promptLlm.replaceChildren(...options);\n    if (definitions.some(({ type }) => type === previous)) elements.promptLlm.value = previous;\n  }\n\n  if (elements.customLlmList) {\n    if (state.customLlms.length === 0) {\n      const empty = document.createElement("p");\n      empty.className = "supporting-text custom-llm-empty";\n      empty.textContent = "추가한 LLM이 없습니다.";\n      elements.customLlmList.replaceChildren(empty);\n    } else {\n      elements.customLlmList.replaceChildren(...state.customLlms.map(({ name }) => {\n        const chip = document.createElement("span");\n        chip.className = "custom-llm-chip";\n        chip.textContent = name;\n        return chip;\n      }));\n    }\n  }\n  if (elements.supportedLlmsValue) {\n    elements.supportedLlmsValue.textContent = definitions.map(({ label }) => label).join(" · ");\n  }\n  updateCustomLlmNameCount();\n}\n\nasync function refreshCustomLlms() {\n  state.customLlms = normalizeCustomLlms(await getAllCustomLlmRecords());\n  renderLlmConfiguration();\n}\n\nasync function addCustomLlm(event) {\n  event.preventDefault();\n  if (!elements.customLlmNameInput) return;\n  const record = createCustomLlmRecord(elements.customLlmNameInput.value, state.customLlms);\n  await putCustomLlmRecord(record);\n  elements.customLlmNameInput.value = "";\n  await refreshCustomLlms();\n  window.dispatchEvent(new CustomEvent("prompt-manager:llms-changed", {\n    detail: { customLlms: state.customLlms.map((item) => ({ ...item })) },\n  }));\n  showSnackbar(`${record.name} LLM을 추가했습니다.`);\n}\n''')
replace_once("app.js", '          <span class="llm-badge" data-llm="${prompt.llmType}">${LLM_LABELS[prompt.llmType] ?? prompt.llmType}</span>', '          <span class="llm-badge" data-llm="${escapeHtml(prompt.llmType)}">${escapeHtml(getLlmLabel(prompt.llmType, state.customLlms))}</span>')
replace_once("app.js", '  if (!VALID_LLM_TYPES.has(llmType)) {\n', '  if (!isKnownLlmType(llmType, state.customLlms)) {\n')
replace_once("app.js", '  elements.detailLlm.textContent = LLM_LABELS[prompt.llmType] ?? prompt.llmType;\n', '  elements.detailLlm.textContent = getLlmLabel(prompt.llmType, state.customLlms);\n')
replace_regex(
    "app.js",
    r'function validateBackup\(data\) \{.*?\n\}\n\nasync function exportBackup',
    '''function validateBackup(data) {\n  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("백업 파일 형식이 올바르지 않습니다.");\n  if (!SUPPORTED_BACKUP_SCHEMA_VERSIONS.has(data.schemaVersion)) {\n    throw new Error(`지원하지 않는 schemaVersion입니다: ${data.schemaVersion}`);\n  }\n  if (!Array.isArray(data.prompts)) throw new Error("prompts 배열이 없습니다.");\n  const customLlms = data.schemaVersion >= 3\n    ? normalizeCustomLlms(data.customLlms ?? [], { strict: true })\n    : [];\n  const prompts = data.prompts.map((prompt, index) => {\n    const fail = (reason) => { throw new Error(`${index + 1}번째 프롬프트: ${reason}`); };\n    if (!prompt || typeof prompt !== "object") fail("객체가 아닙니다.");\n    if (!isKnownLlmType(prompt.llmType, customLlms)) fail("LLM 종류가 올바르지 않습니다.");\n    if (typeof prompt.title !== "string" || !prompt.title.trim()) fail("제목이 없습니다.");\n    if (getCharacterLength(prompt.title) > TITLE_MAX_LENGTH) fail(`제목은 ${TITLE_MAX_LENGTH}자까지 허용됩니다.`);\n    if (typeof prompt.content !== "string" || !prompt.content.trim()) fail("본문이 없습니다.");\n    if (!Number.isFinite(prompt.createdAt) || prompt.createdAt < 0) fail("생성 일시가 올바르지 않습니다.");\n    if (!Number.isFinite(prompt.updatedAt) || prompt.updatedAt < 0) fail("수정 일시가 올바르지 않습니다.");\n    if (prompt.version !== undefined && !isValidPromptVersion(prompt.version)) fail("버전 값이 올바르지 않습니다.");\n    if (typeof prompt.isFavorite !== "boolean") fail("즐겨찾기 값이 올바르지 않습니다.");\n    const images = validateBackupImages(prompt.images, fail);\n    return {\n      llmType: prompt.llmType,\n      title: prompt.title,\n      content: prompt.content,\n      images,\n      ...(isValidPromptVersion(prompt.version) ? { version: prompt.version } : {}),\n      createdAt: prompt.createdAt,\n      updatedAt: prompt.updatedAt,\n      isFavorite: prompt.isFavorite,\n    };\n  });\n  return { customLlms, prompts };\n}\n\nasync function exportBackup''',
    flags=re.S,
)
replace_once("app.js", '    exportedAt: Date.now(),\n    prompts: prompts.map(({ id, ...prompt }) => ({\n', '    exportedAt: Date.now(),\n    customLlms: normalizeCustomLlms(state.customLlms, { strict: true }),\n    prompts: prompts.map(({ id, ...prompt }) => ({\n')
replace_regex(
    "app.js",
    r'async function restoreBackup\(file\) \{.*?\n\}\n\nfunction applyTheme',
    '''async function restoreBackup(file) {\n  const text = await file.text();\n  let parsed;\n  try {\n    parsed = JSON.parse(text);\n  } catch {\n    throw new Error("JSON을 해석할 수 없습니다.");\n  }\n  const validated = validateBackup(parsed);\n  const incoming = validated.prompts;\n  const mode = elements.restoreMode.value;\n  if (mode === "REPLACE" && !confirm(`기존 ${state.prompts.length}개 데이터를 삭제하고 ${incoming.length}개로 교체할까요?`)) return;\n\n  let candidates = incoming;\n  if (mode === "DEDUPLICATE") {\n    const existingKeys = new Set(state.prompts.map((prompt) => `${prompt.llmType}\\u0000${prompt.title}\\u0000${prompt.content}`));\n    candidates = incoming.filter((prompt) => {\n      const key = `${prompt.llmType}\\u0000${prompt.title}\\u0000${prompt.content}`;\n      if (existingKeys.has(key)) return false;\n      existingKeys.add(key);\n      return true;\n    });\n  }\n\n  const customLlms = mode === "REPLACE"\n    ? validated.customLlms\n    : mergeCustomLlms(state.customLlms, validated.customLlms);\n  await restorePromptRecords(candidates, {\n    replace: mode === "REPLACE",\n    customLlms,\n    replaceCustomLlms: true,\n  });\n  await refreshCustomLlms();\n  await refreshPrompts();\n  window.dispatchEvent(new CustomEvent("prompt-manager:llms-changed", {\n    detail: { customLlms: state.customLlms.map((item) => ({ ...item })) },\n  }));\n  showSnackbar(`${candidates.length}개 프롬프트를 복원했습니다.`);\n}\n\nfunction applyTheme''',
    flags=re.S,
)
replace_once("app.js", '  elements.restoreFileInput.addEventListener("change", async () => {\n    const [file] = elements.restoreFileInput.files;\n    elements.restoreFileInput.value = "";\n    if (file) await restoreBackup(file).catch(handleError);\n  });\n', '  elements.restoreFileInput.addEventListener("change", async () => {\n    const [file] = elements.restoreFileInput.files;\n    elements.restoreFileInput.value = "";\n    if (file) await restoreBackup(file).catch(handleError);\n  });\n  elements.customLlmNameInput?.addEventListener("input", updateCustomLlmNameCount);\n  elements.customLlmForm?.addEventListener("submit", (event) => addCustomLlm(event).catch(handleError));\n')
replace_once("app.js", 'async function init() {\n  const theme = localStorage.getItem("prompt-vault-theme") ?? "system";\n  applyTheme(theme);\n  renderEditorImages();\n', 'async function init() {\n  const theme = localStorage.getItem("prompt-vault-theme") ?? "system";\n  applyTheme(theme);\n  await refreshCustomLlms();\n  renderEditorImages();\n')

# Settings UI and user-facing metadata.
replace_once("index.html", '  <meta name="description" content="ChatGPT, Gemini, Grok, Claude 프롬프트를 기기 안에 저장하고 관리하는 오프라인 PWA">', '  <meta name="description" content="여러 LLM의 프롬프트를 기기 안에 저장하고 관리하는 오프라인 PWA">')
replace_once("index.html", '''          <section class="card" aria-labelledby="backupHeading">\n            <h3 id="backupHeading">백업 및 복원</h3>''', '''          <section class="card" aria-labelledby="llmSettingsHeading">\n            <h3 id="llmSettingsHeading">LLM</h3>\n            <p class="supporting-text">기본 LLM 외에 직접 사용할 LLM을 추가할 수 있습니다. 이름은 10자까지 입력할 수 있습니다.</p>\n            <form id="customLlmForm" class="custom-llm-form">\n              <label for="customLlmNameInput">\n                <span>LLM 이름</span>\n                <input id="customLlmNameInput" type="text" autocomplete="off" maxlength="10" placeholder="예: Perplexity" required>\n              </label>\n              <div class="custom-llm-form-row">\n                <small id="customLlmNameCount">0 / 10자</small>\n                <button class="filled-button" type="submit">추가</button>\n              </div>\n            </form>\n            <div id="customLlmList" class="custom-llm-list" aria-live="polite"></div>\n          </section>\n\n          <section class="card" aria-labelledby="backupHeading">\n            <h3 id="backupHeading">백업 및 복원</h3>''')
replace_once("index.html", '<div><dt>지원 LLM</dt><dd>ChatGPT · Gemini · Grok · Claude</dd></div>', '<div><dt>지원 LLM</dt><dd id="supportedLlmsValue">ChatGPT · Gemini · Grok · Claude</dd></div>')
index = read("index.html").replace("1.5.6", "1.6.0")
write("index.html", index)

# Styling for settings and custom LLM badges.
replace_once("styles.css", '\n.snackbar {\n', '''\n.custom-llm-form {\n  display: grid;\n  gap: 10px;\n  margin-top: 14px;\n}\n.custom-llm-form-row {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 10px;\n}\n.custom-llm-form-row .filled-button { min-width: 88px; }\n.custom-llm-list {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n  margin-top: 14px;\n}\n.custom-llm-chip {\n  display: inline-flex;\n  align-items: center;\n  min-height: 34px;\n  padding: 5px 11px;\n  border-radius: 999px;\n  background: var(--primary-container);\n  color: var(--on-primary-container);\n  font-size: .86rem;\n  font-weight: 750;\n}\n.custom-llm-empty { width: 100%; }\n.llm-badge[data-llm^="CUSTOM:"]::before { content: "+ · "; }\n\n.snackbar {\n''')
replace_once("styles.css", '@media (max-width: 520px) {\n  .screen-heading { align-items: stretch; flex-direction: column; }', '@media (max-width: 520px) {\n  .custom-llm-form-row { grid-template-columns: 1fr; align-items: stretch; }\n  .custom-llm-form-row .filled-button { width: 100%; }\n  .screen-heading { align-items: stretch; flex-direction: column; }')

# Dynamic library filter supporting built-in and custom LLMs.
write("llm-filter.js", r'''import { getAllCustomLlmRecords } from "./prompt-db.mjs";
import { getLlmDefinitions, normalizeCustomLlms } from "./llm-registry.mjs";

const STORAGE_KEY = "prompt-manager-active-llms";
const KNOWN_STORAGE_KEY = "prompt-manager-known-llms";
const llmFilterButtons = document.querySelector("#llmFilterButtons");
const promptList = document.querySelector("#promptList");
const promptCount = document.querySelector("#promptCount");
const emptyState = document.querySelector("#emptyState");
let definitions = [];
let activeLlmTypes = new Set();

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : null;
  } catch {
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...activeLlmTypes]));
    localStorage.setItem(KNOWN_STORAGE_KEY, JSON.stringify(definitions.map(({ type }) => type)));
  } catch {
    // 저장소 접근이 제한된 환경에서는 현재 세션에만 적용합니다.
  }
}

function reconcileState() {
  const validTypes = new Set(definitions.map(({ type }) => type));
  const savedActive = readArray(STORAGE_KEY);
  const savedKnown = new Set(readArray(KNOWN_STORAGE_KEY) ?? ["CHATGPT", "GEMINI", "GROK", "CLAUDE"]);
  activeLlmTypes = new Set((savedActive ?? [...validTypes]).filter((type) => validTypes.has(type)));
  for (const type of validTypes) {
    if (!savedKnown.has(type)) activeLlmTypes.add(type);
  }
  saveState();
}

function renderFilterButtons() {
  if (!llmFilterButtons) return;
  const buttons = definitions.map(({ type, label }) => {
    const button = document.createElement("button");
    button.className = "llm-filter-button";
    button.type = "button";
    button.dataset.llmFilter = type;
    button.textContent = label;
    const active = activeLlmTypes.has(type);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    return button;
  });
  llmFilterButtons.replaceChildren(...buttons);
}

function applyLlmFilters() {
  if (!promptList || !promptCount || !emptyState) return;
  const cards = [...promptList.querySelectorAll(".prompt-card")];
  cards.forEach((card) => {
    const type = card.querySelector(".llm-badge")?.dataset.llm;
    card.hidden = !type || !activeLlmTypes.has(type);
  });
  const visibleCount = cards.filter((card) => !card.hidden).length;
  const totalMatch = promptCount.textContent.match(/전체\s+(\d+)개/);
  const totalCount = totalMatch ? Number(totalMatch[1]) : cards.length;
  promptCount.textContent = `${visibleCount}개 표시 · 전체 ${totalCount}개`;
  emptyState.classList.toggle("hidden", visibleCount > 0);
}

async function refreshDefinitions() {
  const customLlms = normalizeCustomLlms(await getAllCustomLlmRecords());
  definitions = getLlmDefinitions(customLlms);
  reconcileState();
  renderFilterButtons();
  applyLlmFilters();
}

llmFilterButtons?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-llm-filter]");
  if (!button || !definitions.some(({ type }) => type === button.dataset.llmFilter)) return;
  const type = button.dataset.llmFilter;
  if (activeLlmTypes.has(type)) activeLlmTypes.delete(type);
  else activeLlmTypes.add(type);
  saveState();
  renderFilterButtons();
  applyLlmFilters();
  window.dispatchEvent(new CustomEvent("prompt-manager:llm-filter-change", {
    detail: { activeTypes: [...activeLlmTypes] },
  }));
});

if (promptList) new MutationObserver(applyLlmFilters).observe(promptList, { childList: true });
window.addEventListener("prompt-manager:llms-changed", () => refreshDefinitions().catch(console.error));
refreshDefinitions().catch(console.error);
''')

# Archive filter: same dynamic registry and active-state behavior.
write("archive-llm-filter.js", r'''import { getAllCustomLlmRecords } from "./prompt-db.mjs";
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
''')

# New-prompt default selection should accept any option currently registered in the editor.
replace_once("navigation.js", 'const VALID_LLM_TYPES = new Set(["CHATGPT", "GEMINI", "GROK", "CLAUDE"]);\n\n', '')
replace_regex(
    "navigation.js",
    r'function readLastNewPromptLlm\(fallback\) \{.*?\n\}\n\nfunction storeLastNewPromptLlm\(llmType\) \{.*?\n\}',
    '''function hasPromptLlmType(llmType) {\n  return Boolean(promptLlm && [...promptLlm.options].some((option) => option.value === llmType));\n}\n\nfunction readLastNewPromptLlm(fallback) {\n  try {\n    const stored = localStorage.getItem(LAST_NEW_PROMPT_LLM_KEY);\n    return hasPromptLlmType(stored) ? stored : fallback;\n  } catch {\n    return fallback;\n  }\n}\n\nfunction storeLastNewPromptLlm(llmType) {\n  if (!hasPromptLlmType(llmType)) return;\n  try {\n    localStorage.setItem(LAST_NEW_PROMPT_LLM_KEY, llmType);\n  } catch {\n    // 저장소 접근이 제한된 환경에서는 현재 세션의 선택값만 사용합니다.\n  }\n}''',
    flags=re.S,
)

# Lazy archive reads the active types from the dynamic archive filter buttons.
replace_once("ui-enhancements.js", 'const ARCHIVE_LLM_TYPES = ["CHATGPT", "GEMINI", "GROK", "CLAUDE"];\n', 'const ARCHIVE_BUILTIN_LLM_TYPES = ["CHATGPT", "GEMINI", "GROK", "CLAUDE"];\n')
replace_regex(
    "ui-enhancements.js",
    r'function readActiveArchiveLlmTypes\(\) \{.*?\n\}',
    '''function readKnownArchiveLlmTypes() {\n  const rendered = [...document.querySelectorAll("[data-archive-llm-filter]")]\n    .map((button) => button.dataset.archiveLlmFilter)\n    .filter(Boolean);\n  return rendered.length > 0 ? rendered : ARCHIVE_BUILTIN_LLM_TYPES;\n}\n\nfunction readActiveArchiveLlmTypes() {\n  const knownTypes = readKnownArchiveLlmTypes();\n  const fallback = new Set(knownTypes);\n  try {\n    const saved = JSON.parse(localStorage.getItem(ARCHIVE_LLM_FILTER_KEY));\n    if (!Array.isArray(saved)) return fallback;\n    const validTypes = new Set(knownTypes);\n    return new Set(saved.filter((type) => validTypes.has(type)));\n  } catch {\n    return fallback;\n  }\n}''',
    flags=re.S,
)
replace_once("ui-enhancements.js", '    const filtered = activeTypes.size !== ARCHIVE_LLM_TYPES.length;\n', '    const filtered = activeTypes.size !== readKnownArchiveLlmTypes().length;\n')

# ZIP/legacy backup core: schema 4 adds custom LLM definitions while preserving v3 ZIP and v1-v2 JSON.
replace_once("prompt-organization-backup-core.mjs", 'export const BACKUP_FORMAT = "prompt-manager-backup";\nexport const BACKUP_SCHEMA_VERSION = 3;\n', 'import { BUILTIN_LLMS, isKnownLlmType, normalizeCustomLlms } from "./llm-registry.mjs";\n\nexport const BACKUP_FORMAT = "prompt-manager-backup";\nexport const BACKUP_SCHEMA_VERSION = 4;\n')
replace_once("prompt-organization-backup-core.mjs", 'export const VALID_LLM_TYPES = new Set(["CHATGPT", "GEMINI", "GROK", "CLAUDE"]);\n', 'export const VALID_LLM_TYPES = new Set(BUILTIN_LLMS.map(({ type }) => type));\n')
replace_once("prompt-organization-backup-core.mjs", 'function validatePromptBase(prompt, index) {\n', 'function validatePromptBase(prompt, index, customLlms = []) {\n')
replace_once("prompt-organization-backup-core.mjs", '  if (!VALID_LLM_TYPES.has(prompt.llmType)) fail("LLM 종류가 올바르지 않습니다.");\n', '  if (!isKnownLlmType(prompt.llmType, customLlms)) fail("LLM 종류가 올바르지 않습니다.");\n')
replace_once("prompt-organization-backup-core.mjs", 'export function createBackupZip(prompts, { appVersion = "0.0.0", exportedAt = Date.now() } = {}) {\n  if (!Array.isArray(prompts)) throw new Error("백업할 프롬프트 목록이 올바르지 않습니다.");\n  const entries = [];\n', 'export function createBackupZip(prompts, { appVersion = "0.0.0", exportedAt = Date.now(), customLlms = [] } = {}) {\n  if (!Array.isArray(prompts)) throw new Error("백업할 프롬프트 목록이 올바르지 않습니다.");\n  const normalizedCustomLlms = normalizeCustomLlms(customLlms, { strict: true });\n  const entries = [];\n')
replace_once("prompt-organization-backup-core.mjs", '    const base = validatePromptBase(source, promptIndex);\n', '    const base = validatePromptBase(source, promptIndex, normalizedCustomLlms);\n')
replace_once("prompt-organization-backup-core.mjs", '  const promptsBytes = jsonBytes({ prompts: promptRecords });\n', '  const promptsBytes = jsonBytes({ customLlms: normalizedCustomLlms, prompts: promptRecords });\n')
replace_once("prompt-organization-backup-core.mjs", '    promptCount: promptRecords.length,\n    imageCount,\n', '    promptCount: promptRecords.length,\n    customLlmCount: normalizedCustomLlms.length,\n    imageCount,\n')
replace_once("prompt-organization-backup-core.mjs", '  if (manifest.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error(`지원하지 않는 schemaVersion입니다: ${manifest.schemaVersion}`);\n', '  if (![3, BACKUP_SCHEMA_VERSION].includes(manifest.schemaVersion)) throw new Error(`지원하지 않는 schemaVersion입니다: ${manifest.schemaVersion}`);\n')
replace_once("prompt-organization-backup-core.mjs", '  const parsed = parseJsonBytes(promptsBytes, "prompts.json");\n  if (!Array.isArray(parsed?.prompts)) throw new Error("prompts 배열이 없습니다.");\n  const prompts = parsed.prompts.map((prompt, index) => {\n    const base = validatePromptBase(prompt, index);\n', '  const parsed = parseJsonBytes(promptsBytes, "prompts.json");\n  if (!Array.isArray(parsed?.prompts)) throw new Error("prompts 배열이 없습니다.");\n  const customLlms = manifest.schemaVersion >= 4\n    ? normalizeCustomLlms(parsed.customLlms ?? [], { strict: true })\n    : [];\n  const prompts = parsed.prompts.map((prompt, index) => {\n    const base = validatePromptBase(prompt, index, customLlms);\n')
replace_once("prompt-organization-backup-core.mjs", '  if (manifest.promptCount !== prompts.length) throw new Error("매니페스트의 프롬프트 수가 일치하지 않습니다.");\n  const imageCount = prompts.reduce((sum, prompt) => sum + prompt.images.length, 0);\n', '  if (manifest.promptCount !== prompts.length) throw new Error("매니페스트의 프롬프트 수가 일치하지 않습니다.");\n  if (manifest.schemaVersion >= 4 && manifest.customLlmCount !== customLlms.length) throw new Error("매니페스트의 사용자 정의 LLM 수가 일치하지 않습니다.");\n  const imageCount = prompts.reduce((sum, prompt) => sum + prompt.images.length, 0);\n')
replace_once("prompt-organization-backup-core.mjs", '  return { manifest, prompts };\n}\n\nexport function parseLegacyJsonBackup(data) {\n  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("백업 파일 형식이 올바르지 않습니다.");\n  if (![1, 2].includes(data.schemaVersion)) throw new Error(`지원하지 않는 schemaVersion입니다: ${data.schemaVersion}`);\n  if (!Array.isArray(data.prompts)) throw new Error("prompts 배열이 없습니다.");\n  return data.prompts.map((prompt, index) => {\n    const base = validatePromptBase(prompt, index);\n', '  return { manifest, prompts, customLlms };\n}\n\nexport function parseLegacyJsonBackup(data) {\n  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("백업 파일 형식이 올바르지 않습니다.");\n  if (![1, 2, 3].includes(data.schemaVersion)) throw new Error(`지원하지 않는 schemaVersion입니다: ${data.schemaVersion}`);\n  if (!Array.isArray(data.prompts)) throw new Error("prompts 배열이 없습니다.");\n  const customLlms = data.schemaVersion >= 3\n    ? normalizeCustomLlms(data.customLlms ?? [], { strict: true })\n    : [];\n  const prompts = data.prompts.map((prompt, index) => {\n    const base = validatePromptBase(prompt, index, customLlms);\n')
replace_once("prompt-organization-backup-core.mjs", '    return { ...base, images };\n  });\n}\n', '    return { ...base, images };\n  });\n  return { prompts, customLlms };\n}\n')

# Runtime tag/ZIP layer: use the registry in filtering, labels, export and restore.
replace_once("prompt-organization-backup.js", 'import { getAllPromptRecords, getAllPromptSummaries, getPromptRecord, putPromptRecord, restorePromptRecords } from "./prompt-db.mjs";\n', 'import { getAllCustomLlmRecords, getAllPromptRecords, getAllPromptSummaries, getPromptRecord, putPromptRecord, restorePromptRecords } from "./prompt-db.mjs";\n')
replace_once("prompt-organization-backup.js", 'import { collectTagOptions, matchesPromptQuery } from "./prompt-tag-core.mjs";\n', 'import { collectTagOptions, matchesPromptQuery } from "./prompt-tag-core.mjs";\nimport { getLlmDefinitions, getLlmLabel, mergeCustomLlms, normalizeCustomLlms } from "./llm-registry.mjs";\n')
replace_once("prompt-organization-backup.js", 'const ACTIVE_LLM_STORAGE_KEY = "prompt-manager-active-llms";\nconst LLM_TYPES = ["CHATGPT", "GEMINI", "GROK", "CLAUDE"];\nconst LLM_LABELS = { CHATGPT: "ChatGPT", GEMINI: "Gemini", GROK: "Grok", CLAUDE: "Claude" };\n', 'const ACTIVE_LLM_STORAGE_KEY = "prompt-manager-active-llms";\n')
replace_once("prompt-organization-backup.js", 'const state = { selectedPromptId:null, editorMode:"new", editorTargetId:null, editorSourceId:null, editorTags:[], editorSnapshot:"", editorBaseUpdatedAt:null, promptMutationOwned:false, renderScheduled:false, prompts:[], selectedTag:localStorage.getItem(TAG_FILTER_KEY) ?? "", snackbarTimer:null };\n', 'const state = { selectedPromptId:null, editorMode:"new", editorTargetId:null, editorSourceId:null, editorTags:[], editorSnapshot:"", editorBaseUpdatedAt:null, promptMutationOwned:false, renderScheduled:false, prompts:[], customLlms:[], llmDefinitions:[], selectedTag:localStorage.getItem(TAG_FILTER_KEY) ?? "", snackbarTimer:null };\n')
replace_regex(
    "prompt-organization-backup.js",
    r'function loadActiveLlmTypes\(\)\{.*?\}\n',
    '''function loadActiveLlmTypes(){ try{const stored=JSON.parse(localStorage.getItem(ACTIVE_LLM_STORAGE_KEY));const validTypes=new Set(state.llmDefinitions.map(({type})=>type));if(!Array.isArray(stored))return new Set(validTypes);return new Set(stored.filter((type)=>validTypes.has(type)));}catch{return new Set(state.llmDefinitions.map(({type})=>type));} }\nfunction llmLabel(type){ return getLlmLabel(type,state.customLlms); }\nasync function refreshLlmDefinitions(){ state.customLlms=normalizeCustomLlms(await getAllCustomLlmRecords());state.llmDefinitions=getLlmDefinitions(state.customLlms); }\n''',
)
replace_once("prompt-organization-backup.js", '${LLM_LABELS[prompt.llmType]??escapeHtml(prompt.llmType)}', '${escapeHtml(llmLabel(prompt.llmType))}')
replace_once("prompt-organization-backup.js", 'data-llm="${prompt.llmType}"', 'data-llm="${escapeHtml(prompt.llmType)}"')
replace_once("prompt-organization-backup.js", 'const zip=createBackupZip(prompts,{appVersion:APP_VERSION,exportedAt});', 'const zip=createBackupZip(prompts,{appVersion:APP_VERSION,exportedAt,customLlms:state.customLlms});')
replace_once("prompt-organization-backup.js", 'if(isZip)return parseBackupZip(bytes).prompts;', 'if(isZip)return parseBackupZip(bytes);')
replace_once("prompt-organization-backup.js", 'return parseLegacyJsonBackup(parsed);', 'return parseLegacyJsonBackup(parsed);')
replace_regex(
    "prompt-organization-backup.js",
    r'async function restoreBackup\(file\)\{.*?\n\}',
    '''async function restoreBackup(file){\n  const parsed=await parseRestoreFile(file);const incoming=parsed.prompts;const incomingCustomLlms=parsed.customLlms??[];const existing=await getAllPrompts();const mode=elements.restoreMode?.value??"DEDUPLICATE";const existingKeys=new Set(existing.map(buildPromptDedupKey));const dedupKeys=new Set(existingKeys);const candidates=mode==="DEDUPLICATE"?incoming.filter((prompt)=>{const key=buildPromptDedupKey(prompt);if(dedupKeys.has(key))return false;dedupKeys.add(key);return true;}):incoming;const duplicates=incoming.length-candidates.length;const imageCount=incoming.reduce((sum,prompt)=>sum+getImageCount(prompt),0);const customLlms=mode==="REPLACE"?normalizeCustomLlms(incomingCustomLlms,{strict:true}):mergeCustomLlms(state.customLlms,incomingCustomLlms);const message=mode==="REPLACE"?`기존 ${existing.length}개 데이터를 삭제하고 프롬프트 ${incoming.length}개와 이미지 ${imageCount}장으로 교체할까요?`:`프롬프트 ${incoming.length}개와 이미지 ${imageCount}장을 확인했습니다.${mode==="DEDUPLICATE"?` 중복 ${duplicates}개를 제외하고 ${candidates.length}개를 추가합니다.`:` 기존 데이터에 ${candidates.length}개를 추가합니다.`}\\n복원을 진행할까요?`;if(!confirm(message))return;await restorePromptRecords(candidates,{replace:mode==="REPLACE",customLlms,replaceCustomLlms:true});await refreshLlmDefinitions();await renderLibrary();window.dispatchEvent(new CustomEvent("prompt-manager:llms-changed",{detail:{customLlms:state.customLlms.map((item)=>({...item}))}}));showSnackbar(`${candidates.length}개 프롬프트를 복원했습니다.`);setTimeout(()=>location.reload(),700);\n}''',
    flags=re.S,
)
replace_once("prompt-organization-backup.js", '  document.querySelectorAll("[data-llm-filter]").forEach((button)=>button.addEventListener("click",()=>setTimeout(scheduleLibraryRender,0)));\n', '  document.querySelectorAll("[data-llm-filter]").forEach((button)=>button.addEventListener("click",()=>setTimeout(scheduleLibraryRender,0)));\n  window.addEventListener("prompt-manager:llm-filter-change",scheduleLibraryRender);\n  window.addEventListener("prompt-manager:llms-changed",()=>{refreshLlmDefinitions().then(scheduleLibraryRender).catch(handleError);});\n')
replace_once("prompt-organization-backup.js", 'async function init(){ if(!elements.promptList||!elements.promptForm)return;localStorage.removeItem("prompt-manager-collection-filter");const style=document.createElement("link");style.rel="stylesheet";style.href=`./prompt-organization-backup.css?v=${APP_VERSION}`;document.head.append(style);injectTagFilters();injectEditorTags();injectDetailTags();updateBackupUi();bindEvents();await renderLibrary(); }', 'async function init(){ if(!elements.promptList||!elements.promptForm)return;localStorage.removeItem("prompt-manager-collection-filter");const style=document.createElement("link");style.rel="stylesheet";style.href=`./prompt-organization-backup.css?v=${APP_VERSION}`;document.head.append(style);await refreshLlmDefinitions();injectTagFilters();injectEditorTags();injectDetailTags();updateBackupUi();bindEvents();await renderLibrary(); }')

# Current version values in runtime modules.
for path in ROOT.glob("*.js"):
    text = path.read_text(encoding="utf-8")
    updated = text.replace('const APP_VERSION = "1.5.6";', 'const APP_VERSION = "1.6.0";')
    if updated != text:
        path.write_text(updated, encoding="utf-8")

# Service worker cache + new registry asset.
sw = read("sw.js").replace('prompt-manager-shell-v50', 'prompt-manager-shell-v51').replace('1.5.6', '1.6.0')
if '"./llm-registry.mjs"' not in sw:
    sw = sw.replace('  "./prompt-db.mjs",\n', '  "./prompt-db.mjs",\n  "./llm-registry.mjs",\n')
write("sw.js", sw)

# Changelog + fallback release notes.
changelog = read("CHANGELOG.md")
marker = '## [미출시]\n\n현재 예정된 변경 사항이 없습니다.\n\n\n'
entry = '''## [1.6.0] - 2026-09-09\n\n### 추가\n\n- 설정에서 이름이 10자 이하인 사용자 정의 LLM을 추가할 수 있습니다.\n- 추가한 LLM은 프롬프트 작성·수정, 목록 필터, 이미지 보관함 필터, 최근 선택 LLM 기억에서 기본 LLM과 동일하게 동작합니다.\n- 사용자 정의 LLM 목록을 IndexedDB에 저장하고 ZIP·JSON 백업 및 복원에 포함합니다.\n\n### 호환성\n\n- IndexedDB 버전을 3으로 올려 `customLlms` 저장소를 추가하며 기존 프롬프트와 첨부 데이터는 변경하지 않습니다.\n- ZIP 백업 스키마는 4로 확장하지만 기존 스키마 3 ZIP과 스키마 1·2 JSON 백업을 계속 복원할 수 있습니다.\n- 중복 프롬프트 판정 기준은 기존과 같이 `LLM 종류 + 제목 + 본문`을 유지합니다.\n\n### 테스트\n\n- 사용자 정의 LLM 이름 길이·중복·ID 정규화, 백업 왕복, UI/캐시 연결을 검증하는 회귀 테스트를 추가했습니다.\n- 앱 버전과 Service Worker 캐시를 `v1.6.0` / `v51` 기준으로 갱신했습니다.\n\n'''
if marker not in changelog:
    raise RuntimeError("CHANGELOG marker not found")
write("CHANGELOG.md", changelog.replace(marker, marker + entry, 1))
release = read("release-notes.js")
fallback_marker = 'const FALLBACK_CHANGELOG = `\n'
fallback_entry = '''## [1.6.0] - 2026-09-09\n\n### 추가\n\n- 설정에서 이름 10자 이하의 사용자 정의 LLM을 추가할 수 있습니다.\n- 추가한 LLM은 프롬프트 편집, 필터, 보관함, 백업 및 복원에서 기본 LLM과 동일하게 동작합니다.\n- 사용자 정의 LLM은 IndexedDB에 저장되며 기존 백업 형식은 계속 복원할 수 있습니다.\n\n'''
if fallback_marker not in release:
    raise RuntimeError("release fallback marker not found")
write("release-notes.js", release.replace(fallback_marker, fallback_marker + fallback_entry, 1))

# Tests for registry, backup compatibility, and wiring.
write("test/llm-registry.test.mjs", r'''import test from "node:test";
import assert from "node:assert/strict";
import {
  createCustomLlmRecord,
  createCustomLlmType,
  getLlmLabel,
  isKnownLlmType,
  mergeCustomLlms,
  normalizeCustomLlms,
} from "../llm-registry.mjs";

test("사용자 정의 LLM 이름은 10자까지 허용하고 안정적인 ID를 만든다", () => {
  const record = createCustomLlmRecord("Perplexity");
  assert.deepEqual(record, { id: createCustomLlmType("Perplexity"), name: "Perplexity" });
  assert.throws(() => createCustomLlmRecord("12345678901"), /10자/);
});

test("기본 LLM 또는 기존 사용자 정의 LLM과 같은 이름은 거부한다", () => {
  assert.throws(() => createCustomLlmRecord("chatgpt"), /이미 등록/);
  const first = createCustomLlmRecord("Llama");
  assert.throws(() => createCustomLlmRecord("llama", [first]), /이미 등록/);
});

test("사용자 정의 LLM은 라벨 조회와 유효성 검사에서 기본 LLM과 동일하게 취급한다", () => {
  const record = createCustomLlmRecord("Llama");
  assert.equal(isKnownLlmType(record.id, [record]), true);
  assert.equal(getLlmLabel(record.id, [record]), "Llama");
});

test("복원용 목록은 무결성을 검증하고 기존 목록과 병합한다", () => {
  const llama = createCustomLlmRecord("Llama");
  const mistral = createCustomLlmRecord("Mistral");
  assert.deepEqual(mergeCustomLlms([llama], [llama, mistral]), [llama, mistral]);
  assert.throws(() => normalizeCustomLlms([{ id: "CUSTOM:bad", name: "Llama" }], { strict: true }), /ID/);
});
''')

backup_test = read("tests/prompt-organization-backup.test.mjs")
backup_test = backup_test.replace('} from "../prompt-organization-backup-core.mjs";\n', '} from "../prompt-organization-backup-core.mjs";\nimport { createCustomLlmRecord } from "../llm-registry.mjs";\n')
backup_test = backup_test.replace('  assert.equal(restored.manifest.schemaVersion, 3);', '  assert.equal(restored.manifest.schemaVersion, 4);')
backup_test = backup_test.replace('  const prompts = parseLegacyJsonBackup({ schemaVersion: 2, prompts: [samplePrompt] });\n  assert.deepEqual(prompts[0], samplePrompt);', '  const restored = parseLegacyJsonBackup({ schemaVersion: 2, prompts: [samplePrompt] });\n  assert.deepEqual(restored.prompts[0], samplePrompt);\n  assert.deepEqual(restored.customLlms, []);')
backup_test += r'''

test("사용자 정의 LLM 정의와 프롬프트를 ZIP 백업에서 함께 왕복한다", () => {
  const customLlm = createCustomLlmRecord("Perplexity");
  const customPrompt = { ...samplePrompt, llmType: customLlm.id, title: "사용자 LLM" };
  const zip = createBackupZip([customPrompt], { customLlms: [customLlm] });
  const restored = parseBackupZip(zip);
  assert.deepEqual(restored.customLlms, [customLlm]);
  assert.deepEqual(restored.prompts[0], customPrompt);
});
'''
write("tests/prompt-organization-backup.test.mjs", backup_test)

write("test/custom-llm-ui.test.mjs", r'''import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("설정과 편집기 및 필터가 사용자 정의 LLM 레지스트리에 연결된다", async () => {
  const [index, app, filter, archive, organization] = await Promise.all([
    read("index.html"), read("app.js"), read("llm-filter.js"), read("archive-llm-filter.js"), read("prompt-organization-backup.js"),
  ]);
  assert.match(index, /id="customLlmForm"/);
  assert.match(index, /maxlength="10"/);
  assert.match(app, /getAllCustomLlmRecords/);
  assert.match(app, /isKnownLlmType\(llmType, state\.customLlms\)/);
  assert.match(filter, /getLlmDefinitions/);
  assert.match(archive, /getLlmDefinitions/);
  assert.match(organization, /customLlms:state\.customLlms/);
});

test("1.6.0 정적 자산과 LLM 레지스트리가 새 Service Worker 캐시에 포함된다", async () => {
  const [index, sw, changelog] = await Promise.all([read("index.html"), read("sw.js"), read("CHANGELOG.md")]);
  assert.match(index, /v1\.6\.0/);
  assert.match(sw, /prompt-manager-shell-v51/);
  assert.match(sw, /\.\/llm-registry\.mjs/);
  assert.match(changelog, /## \[1\.6\.0\] - 2026-09-09/);
});
''')

# Update the existing version regression test and rename it to the current version.
version_test_old = ROOT / "test/version-1.5.4-assets.test.mjs"
version_test = version_test_old.read_text(encoding="utf-8")
version_test = version_test.replace("1.5.6", "1.6.0").replace("1\\.5\\.6", "1\\.6\\.0").replace("v50", "v51")
version_test = version_test.replace("동적으로 스타일을 불러오는 모듈도 1.6.0를 사용한다", "동적으로 스타일을 불러오는 모듈도 1.6.0을 사용한다")
write("test/version-1.6.0-assets.test.mjs", version_test)
version_test_old.unlink()

# Current dynamic assets should all use the new app version constant.
for path in ROOT.glob("*.js"):
    text = path.read_text(encoding="utf-8")
    if 'const APP_VERSION = "1.5.6";' in text:
        raise RuntimeError(f"stale APP_VERSION in {path.name}")

print("custom LLM implementation applied")
