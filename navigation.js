const HOME_ROUTE = "library";
const LAST_NEW_PROMPT_LLM_KEY = "prompt-manager-last-new-prompt-llm";
const editorDialog = document.querySelector("#editorDialog");
const detailDialog = document.querySelector("#detailDialog");
const closeEditorButton = document.querySelector("#closeEditorButton");
const closeDetailButton = document.querySelector("#closeDetailButton");
const addPromptButton = document.querySelector("#addPromptButton");
const editPromptButton = document.querySelector("#editPromptButton");
const duplicatePromptButton = document.querySelector("#duplicatePromptButton");
const promptLlm = document.querySelector("#promptLlm");
const promptContentInput = document.querySelector("#promptContentInput");
const snackbar = document.querySelector("#snackbar");

let overlayHistoryActive = false;
let handlingPopState = false;
let closeTimer = null;
let openingNewPrompt = false;
let newPromptSession = false;
let editorToolSnackbarTimer = null;

function hasPromptLlmType(llmType) {
  return Boolean(promptLlm && [...promptLlm.options].some((option) => option.value === llmType));
}

function readLastNewPromptLlm(fallback) {
  try {
    const stored = localStorage.getItem(LAST_NEW_PROMPT_LLM_KEY);
    return hasPromptLlmType(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function storeLastNewPromptLlm(llmType) {
  if (!hasPromptLlmType(llmType)) return;
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

function showEditorToolMessage(message) {
  if (!snackbar) return;
  clearTimeout(editorToolSnackbarTimer);
  snackbar.textContent = message;
  snackbar.classList.add("show");
  editorToolSnackbarTimer = setTimeout(() => snackbar.classList.remove("show"), 2600);
}

function dispatchContentInput() {
  promptContentInput?.dispatchEvent(new Event("input", { bubbles: true }));
}

function installContentEditorTools() {
  if (!promptContentInput) return;
  const originalLabel = promptContentInput.closest("label");
  if (!originalLabel || document.querySelector("#clearPromptContentButton")) return;

  const field = document.createElement("div");
  field.className = "content-editor-field";

  const labelRow = document.createElement("div");
  labelRow.className = "field-label-row";

  const contentLabel = document.createElement("label");
  contentLabel.htmlFor = promptContentInput.id;
  contentLabel.textContent = "본문";

  const actions = document.createElement("div");
  actions.className = "field-action-buttons";
  actions.setAttribute("aria-label", "본문 입력 도구");
  actions.innerHTML = `
    <button id="clearPromptContentButton" class="field-icon-button" type="button" aria-label="본문 전체 지우기" title="본문 전체 지우기">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
      </svg>
    </button>
    <button id="pastePromptContentButton" class="field-icon-button" type="button" aria-label="클립보드 내용 붙여넣기" title="클립보드 내용 붙여넣기">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M9 5h6M9 3h6v4H9zM8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8M16 13v8M12 17h8" />
      </svg>
    </button>
  `;

  labelRow.append(contentLabel, actions);
  originalLabel.replaceWith(field);
  field.append(labelRow, promptContentInput);

  const clearButton = actions.querySelector("#clearPromptContentButton");
  const pasteButton = actions.querySelector("#pastePromptContentButton");

  clearButton?.addEventListener("click", () => {
    if (!promptContentInput.value) {
      showEditorToolMessage("본문이 이미 비어 있습니다.");
      return;
    }
    promptContentInput.value = "";
    dispatchContentInput();
    showEditorToolMessage("본문을 지웠습니다.");
  });

  pasteButton?.addEventListener("click", async () => {
    if (!navigator.clipboard?.readText) {
      showEditorToolMessage("이 브라우저에서는 클립보드 붙여넣기를 지원하지 않습니다.");
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        showEditorToolMessage("클립보드가 비어 있습니다.");
        return;
      }

      const start = Number.isInteger(promptContentInput.selectionStart)
        ? promptContentInput.selectionStart
        : promptContentInput.value.length;
      const end = Number.isInteger(promptContentInput.selectionEnd)
        ? promptContentInput.selectionEnd
        : start;
      promptContentInput.setRangeText(text, start, end, "end");
      dispatchContentInput();
      showEditorToolMessage("클립보드 내용을 붙여넣었습니다.");
    } catch {
      showEditorToolMessage("클립보드를 읽을 수 없습니다. 브라우저 권한을 확인하세요.");
    }
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
installContentEditorTools();

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
