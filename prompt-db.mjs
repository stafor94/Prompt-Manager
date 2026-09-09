const DB_NAME = "prompt-vault";
const DB_VERSION = 3;
const PROMPT_STORE = "prompts";
const SUMMARY_STORE = "promptSummaries";
const CUSTOM_LLM_STORE = "customLlms";

let dbPromise;

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

function createPromptStore(db) {
  const store = db.createObjectStore(PROMPT_STORE, { keyPath: "id", autoIncrement: true });
  store.createIndex("updatedAt", "updatedAt");
  store.createIndex("llmType", "llmType");
  store.createIndex("isFavorite", "isFavorite");
  return store;
}

function createSummaryStore(db) {
  const store = db.createObjectStore(SUMMARY_STORE, { keyPath: "id" });
  store.createIndex("updatedAt", "updatedAt");
  store.createIndex("llmType", "llmType");
  store.createIndex("isFavorite", "isFavorite");
  return store;
}

export function buildPromptSummary(prompt) {
  const imageCount = Array.isArray(prompt?.images)
    ? prompt.images.length
    : (Number.isInteger(prompt?.imageCount) && prompt.imageCount >= 0 ? prompt.imageCount : 0);
  const tags = Array.isArray(prompt?.tags)
    ? prompt.tags.filter((tag) => typeof tag === "string")
    : [];

  const summary = {
    id: prompt?.id,
    llmType: prompt?.llmType,
    title: prompt?.title,
    content: prompt?.content,
    createdAt: prompt?.createdAt,
    updatedAt: prompt?.updatedAt,
    isFavorite: Boolean(prompt?.isFavorite),
    tags,
    imageCount,
  };

  if (prompt?.version !== undefined) summary.version = prompt.version;
  return summary;
}

function rebuildSummaries(upgradeTransaction) {
  const promptStore = upgradeTransaction.objectStore(PROMPT_STORE);
  const summaryStore = upgradeTransaction.objectStore(SUMMARY_STORE);
  const cursorRequest = promptStore.openCursor();

  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    summaryStore.put(buildPromptSummary(cursor.value));
    cursor.continue();
  };
  cursorRequest.onerror = () => upgradeTransaction.abort();
}

export function openPromptDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROMPT_STORE)) createPromptStore(db);
      if (!db.objectStoreNames.contains(SUMMARY_STORE)) {
        createSummaryStore(db);
        rebuildSummaries(request.transaction);
      }
      if (!db.objectStoreNames.contains(CUSTOM_LLM_STORE)) {
        db.createObjectStore(CUSTOM_LLM_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = undefined;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = undefined;
      reject(request.error ?? new Error("데이터베이스를 열 수 없습니다."));
    };
    request.onblocked = () => {
      dbPromise = undefined;
      reject(new Error("다른 탭에서 데이터베이스가 사용 중입니다. 다른 Prompt Manager 창을 닫고 다시 시도하세요."));
    };
  });

  return dbPromise;
}

export async function getAllPromptSummaries() {
  const db = await openPromptDatabase();
  const transaction = db.transaction(SUMMARY_STORE, "readonly");
  return requestToPromise(transaction.objectStore(SUMMARY_STORE).getAll());
}

export async function getAllPromptRecords() {
  const db = await openPromptDatabase();
  const transaction = db.transaction(PROMPT_STORE, "readonly");
  return requestToPromise(transaction.objectStore(PROMPT_STORE).getAll());
}

export async function getAllCustomLlmRecords() {
  const db = await openPromptDatabase();
  const transaction = db.transaction(CUSTOM_LLM_STORE, "readonly");
  return requestToPromise(transaction.objectStore(CUSTOM_LLM_STORE).getAll());
}

export async function putCustomLlmRecord(record) {
  const db = await openPromptDatabase();
  const transaction = db.transaction(CUSTOM_LLM_STORE, "readwrite");
  transaction.objectStore(CUSTOM_LLM_STORE).put(record);
  await transactionDone(transaction);
}

export async function getPromptRecord(id) {
  if (!Number.isInteger(id)) return undefined;
  const db = await openPromptDatabase();
  const transaction = db.transaction(PROMPT_STORE, "readonly");
  return requestToPromise(transaction.objectStore(PROMPT_STORE).get(id));
}

export async function getPromptRecords(ids) {
  const normalizedIds = [...new Set(ids)].filter(Number.isInteger);
  if (normalizedIds.length === 0) return [];

  const db = await openPromptDatabase();
  const transaction = db.transaction(PROMPT_STORE, "readonly");
  const store = transaction.objectStore(PROMPT_STORE);
  const requests = normalizedIds.map((id) => requestToPromise(store.get(id)));
  const records = await Promise.all(requests);
  return records.filter(Boolean);
}

export async function putPromptRecord(prompt) {
  const db = await openPromptDatabase();
  const transaction = db.transaction([PROMPT_STORE, SUMMARY_STORE], "readwrite");
  const promptStore = transaction.objectStore(PROMPT_STORE);
  const summaryStore = transaction.objectStore(SUMMARY_STORE);
  const request = promptStore.put(prompt);
  let id;

  request.onsuccess = () => {
    id = request.result;
    summaryStore.put(buildPromptSummary({ ...prompt, id }));
  };
  request.onerror = () => transaction.abort();

  await transactionDone(transaction);
  return id;
}

export async function deletePromptRecord(id) {
  const db = await openPromptDatabase();
  const transaction = db.transaction([PROMPT_STORE, SUMMARY_STORE], "readwrite");
  transaction.objectStore(PROMPT_STORE).delete(id);
  transaction.objectStore(SUMMARY_STORE).delete(id);
  await transactionDone(transaction);
}

export async function restorePromptRecords(records, {
  replace = false,
  customLlms,
  replaceCustomLlms = false,
} = {}) {
  const db = await openPromptDatabase();
  const includeCustomLlms = Array.isArray(customLlms) || replaceCustomLlms;
  const storeNames = [PROMPT_STORE, SUMMARY_STORE, ...(includeCustomLlms ? [CUSTOM_LLM_STORE] : [])];
  const transaction = db.transaction(storeNames, "readwrite");
  const promptStore = transaction.objectStore(PROMPT_STORE);
  const summaryStore = transaction.objectStore(SUMMARY_STORE);
  const customLlmStore = includeCustomLlms ? transaction.objectStore(CUSTOM_LLM_STORE) : null;

  if (replace) {
    promptStore.clear();
    summaryStore.clear();
  }
  if (replaceCustomLlms) customLlmStore?.clear();

  for (const prompt of records) {
    const request = promptStore.add(prompt);
    request.onsuccess = () => {
      summaryStore.put(buildPromptSummary({ ...prompt, id: request.result }));
    };
    request.onerror = () => transaction.abort();
  }

  if (customLlmStore && Array.isArray(customLlms)) {
    for (const customLlm of customLlms) customLlmStore.put(customLlm);
  }

  await transactionDone(transaction);
}
