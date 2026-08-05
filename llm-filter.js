const STORAGE_KEY = "prompt-manager-active-llms";
const LLM_TYPES = ["CHATGPT", "GEMINI", "GROK", "CLAUDE"];
const llmFilterButtons = [...document.querySelectorAll("[data-llm-filter]")];
const promptList = document.querySelector("#promptList");
const promptCount = document.querySelector("#promptCount");
const emptyState = document.querySelector("#emptyState");

function loadActiveLlmTypes() {
  const fallback = new Set(LLM_TYPES);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return fallback;
    return new Set(saved.filter((type) => LLM_TYPES.includes(type)));
  } catch {
    return fallback;
  }
}

let activeLlmTypes = loadActiveLlmTypes();

function saveActiveLlmTypes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...activeLlmTypes]));
}

function renderFilterButtons() {
  llmFilterButtons.forEach((button) => {
    const active = activeLlmTypes.has(button.dataset.llmFilter);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
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

llmFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const type = button.dataset.llmFilter;
    if (!LLM_TYPES.includes(type)) return;

    if (activeLlmTypes.has(type)) activeLlmTypes.delete(type);
    else activeLlmTypes.add(type);

    saveActiveLlmTypes();
    renderFilterButtons();
    applyLlmFilters();
  });
});

if (promptList) {
  new MutationObserver(applyLlmFilters).observe(promptList, { childList: true });
}

renderFilterButtons();
queueMicrotask(applyLlmFilters);
