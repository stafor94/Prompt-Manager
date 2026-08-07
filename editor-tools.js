import { extractTitleFromPromptText } from "./editor-title-extractor.mjs";

const promptTitleInput = document.querySelector("#promptTitleInput");
const promptContentInput = document.querySelector("#promptContentInput");
const clearPromptContentButton = document.querySelector("#clearPromptContentButton");
const pastePromptContentButton = document.querySelector("#pastePromptContentButton");
const snackbar = document.querySelector("#snackbar");

let snackbarTimer = null;

function showMessage(message) {
  if (!snackbar) return;
  clearTimeout(snackbarTimer);
  snackbar.textContent = message;
  snackbar.classList.add("show");
  snackbarTimer = setTimeout(() => snackbar.classList.remove("show"), 2600);
}

function notifyContentChanged() {
  promptContentInput?.dispatchEvent(new Event("input", { bubbles: true }));
}

function fillTitleFromContentIfEmpty() {
  if (!promptTitleInput || !promptContentInput || promptTitleInput.value.trim()) return false;

  const maxLength = promptTitleInput.maxLength > 0 ? promptTitleInput.maxLength : undefined;
  const extractedTitle = extractTitleFromPromptText(promptContentInput.value, { maxLength });
  if (!extractedTitle) return false;

  promptTitleInput.value = extractedTitle;
  promptTitleInput.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

clearPromptContentButton?.addEventListener("click", () => {
  if (!promptContentInput) return;
  if (!promptContentInput.value) {
    showMessage("본문이 이미 비어 있습니다.");
    return;
  }

  promptContentInput.value = "";
  notifyContentChanged();
  promptContentInput.focus();
  showMessage("본문을 지웠습니다.");
});

pastePromptContentButton?.addEventListener("click", async () => {
  if (!promptContentInput) return;
  if (!navigator.clipboard?.readText) {
    showMessage("이 브라우저에서는 클립보드 붙여넣기를 지원하지 않습니다.");
    return;
  }

  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      showMessage("클립보드가 비어 있습니다.");
      return;
    }

    const start = Number.isInteger(promptContentInput.selectionStart)
      ? promptContentInput.selectionStart
      : promptContentInput.value.length;
    const end = Number.isInteger(promptContentInput.selectionEnd)
      ? promptContentInput.selectionEnd
      : start;

    promptContentInput.setRangeText(text, start, end, "end");
    notifyContentChanged();
    const titleFilled = fillTitleFromContentIfEmpty();
    promptContentInput.focus();
    showMessage(titleFilled
      ? "클립보드 내용을 붙여넣고 제목을 자동 입력했습니다."
      : "클립보드 내용을 붙여넣었습니다.");
  } catch {
    showMessage("클립보드를 읽을 수 없습니다. 브라우저 권한을 확인하세요.");
  }
});
