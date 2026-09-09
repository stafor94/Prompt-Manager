import { getAllCustomLlmRecords } from "./prompt-db.mjs";
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
