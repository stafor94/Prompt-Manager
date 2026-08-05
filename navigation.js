const HOME_ROUTE = "library";
const LAST_NEW_PROMPT_LLM_KEY = "prompt-manager-last-new-prompt-llm";
const VALID_LLM_TYPES = new Set(["CHATGPT", "GEMINI", "GROK", "CLAUDE"]);

const editorDialog = document.querySelector("#editorDialog");
const detailDialog = document.querySelector("#detailDialog");
const closeEditorButton = document.querySelector("#closeEditorButton");
const closeDetailButton = document.querySelector("#closeDetailButton");
const addPromptButton = document.querySelector("#addPromptButton");
const editPromptButton = document.querySelector("#editPromptButton");
const duplicatePromptButton = document.querySelector("#duplicatePromptButton");
const promptLlm = document.querySelector("#promptLlm");

let overlayHistoryActive = false;
let handlingPopState = false;
let closeTimer = null;
let openingNewPrompt = false;
let newPromptSession = false;

function readLastNewPromptLlm(fallback) {
  try {
    const stored = localStorage.getItem(LAST_NEW_PROMPT_LLM_KEY);
    return VALID_LLM_TYPES.has(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function storeLastNewPromptLlm(llmType) {
  if (!VALID_LLM_TYPES.has(llmType)) return;
  try {
    localStorage.setItem(LAST_NEW_PROMPT_LLM_KEY, llmType);
  } catch {
    // 저장소 접근이 제한된 환경에서는 현재 세션의 선택값만 사용합니다.
  }
}

function installNewPromptLlmDefault() {
  if (!promptLlm || !addPromptButton) return;

  const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  if (valueDescriptor?.get && valueDescriptor?.set) {
    Object.defineProperty(promptLlm, "value", {
      configurable: true,
      enumerable: valueDescriptor.enumerable,
      get() {
        return valueDescriptor.get.call(this);
      },
      set(value) {
        const resolvedValue = openingNewPrompt ? readLastNewPromptLlm(value) : value;
        valueDescriptor.set.call(this, resolvedValue);
      },
    });
  }

  addPromptButton.addEventListener("click", () => {
    openingNewPrompt = true;
    newPromptSession = true;
    queueMicrotask(() => { openingNewPrompt = false; });
  }, { capture: true });

  [editPromptButton, duplicatePromptButton].forEach((button) => {
    button?.addEventListener("click", () => {
      openingNewPrompt = false;
      newPromptSession = false;
    }, { capture: true });
  });

  promptLlm.addEventListener("change", () => {
    if (newPromptSession) storeLastNewPromptLlm(promptLlm.value);
  });

  editorDialog?.addEventListener("close", () => {
    openingNewPrompt = false;
    newPromptSession = false;
  });
}

function renderRoute(route) {
  const resolvedRoute = ["library", "settings"].includes(route) ? route : HOME_ROUTE;
  document.querySelectorAll(".nav-item").forEach((item) => {
    const active = item.dataset.route === resolvedRoute;
    item.classList.toggle("active", active);
    item.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === `${resolvedRoute}Screen`);
  });
  if (resolvedRoute === HOME_ROUTE) window.scrollTo({ top: 0, behavior: "instant" });
}

function openDialogType() {
  if (editorDialog?.open) return "editor";
  if (detailDialog?.open) return "detail";
  return null;
}

function pushOverlayHistory(type) {
  const currentState = history.state && typeof history.state === "object" ? history.state : {};
  const nextState = { ...currentState, promptManagerOverlay: type };
  if (overlayHistoryActive) {
    history.replaceState(nextState, "", location.href);
  } else {
    history.pushState(nextState, "", location.href);
    overlayHistoryActive = true;
  }
}

function scheduleHistoryCleanup() {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (!handlingPopState && overlayHistoryActive && !openDialogType()) {
      history.back();
    }
  }, 0);
}

function syncDialogHistory() {
  const type = openDialogType();
  if (type) {
    clearTimeout(closeTimer);
    pushOverlayHistory(type);
  } else {
    scheduleHistoryCleanup();
  }
}

function closeOverlayFromBack() {
  const type = openDialogType();
  if (!type) {
    overlayHistoryActive = false;
    renderRoute(HOME_ROUTE);
    return;
  }

  handlingPopState = true;
  if (type === "editor") {
    closeEditorButton?.click();
    if (editorDialog?.open) {
      history.pushState({ ...(history.state ?? {}), promptManagerOverlay: "editor" }, "", location.href);
      overlayHistoryActive = true;
      handlingPopState = false;
      return;
    }
  } else {
    closeDetailButton?.click();
  }

  overlayHistoryActive = false;
  handlingPopState = false;
  renderRoute(HOME_ROUTE);
}

installNewPromptLlmDefault();

const dialogObserver = new MutationObserver(syncDialogHistory);
[editorDialog, detailDialog].forEach((dialog) => {
  if (!dialog) return;
  dialogObserver.observe(dialog, { attributes: true, attributeFilter: ["open"] });
  dialog.addEventListener("close", scheduleHistoryCleanup);
});

window.addEventListener("popstate", () => {
  if (overlayHistoryActive || openDialogType()) {
    closeOverlayFromBack();
    return;
  }
  renderRoute(location.hash.slice(1));
});

window.addEventListener("hashchange", () => {
  if (!overlayHistoryActive && !openDialogType()) renderRoute(location.hash.slice(1));
});
