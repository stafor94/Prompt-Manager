import { getFavoriteMarkState, togglePromptFavorite } from "./card-favorite-core.mjs";
import { getPromptRecord, putPromptRecord } from "./prompt-db.mjs";

const FAVORITE_MARK_SELECTOR = ".favorite-mark";
const promptList = document.querySelector("#promptList");
const snackbar = document.querySelector("#snackbar");
let snackbarTimer;

function showMessage(message) {
  if (!snackbar) return;
  clearTimeout(snackbarTimer);
  snackbar.textContent = message;
  snackbar.classList.add("show");
  snackbarTimer = setTimeout(() => snackbar.classList.remove("show"), 2400);
}

function applyFavoriteMarkState(mark, active) {
  if (!mark) return;
  mark.dataset.cardFavorite = "true";
  mark.classList.toggle("active", active);
  mark.textContent = active ? "★" : "☆";
  mark.setAttribute("role", "button");
  mark.setAttribute("tabindex", "0");
  mark.setAttribute("aria-pressed", String(active));
  mark.setAttribute("aria-label", active ? "즐겨찾기 해제" : "즐겨찾기 등록");
  mark.title = active ? "즐겨찾기 해제" : "즐겨찾기 등록";
}

function decorateFavoriteMark(mark) {
  const { active } = getFavoriteMarkState(mark);
  applyFavoriteMarkState(mark, active);
}

function decorateFavoriteMarks() {
  promptList?.querySelectorAll(FAVORITE_MARK_SELECTOR).forEach(decorateFavoriteMark);
}

function syncPromptMark(promptId, active) {
  const card = promptList?.querySelector(`[data-prompt-id="${promptId}"]`);
  applyFavoriteMarkState(card?.querySelector(FAVORITE_MARK_SELECTOR), active);
}

async function persistFavoriteToggle(promptId) {
  const current = await getPromptRecord(promptId);
  if (!current) throw new Error("프롬프트를 찾을 수 없습니다.");
  const updated = togglePromptFavorite(current);
  await putPromptRecord(updated);
  return updated;
}

async function toggleFromMark(mark) {
  const card = mark.closest("[data-prompt-id]");
  const promptId = Number(card?.dataset.promptId);
  if (!Number.isInteger(promptId) || mark.dataset.favoriteBusy === "true") return;

  mark.dataset.favoriteBusy = "true";
  try {
    const updated = await persistFavoriteToggle(promptId);
    applyFavoriteMarkState(mark, updated.isFavorite);
    const searchInput = document.querySelector("#searchInput");
    searchInput?.dispatchEvent(new Event("input", { bubbles: true }));
    syncPromptMark(promptId, updated.isFavorite);
    showMessage(updated.isFavorite ? "즐겨찾기에 추가했습니다." : "즐겨찾기에서 해제했습니다.");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "즐겨찾기를 변경할 수 없습니다.");
  } finally {
    delete mark.dataset.favoriteBusy;
  }
}

function findFavoriteMark(target) {
  if (!(target instanceof Element)) return null;
  return target.closest(`${FAVORITE_MARK_SELECTOR}[data-card-favorite]`);
}

function handleFavoriteClick(event) {
  const mark = findFavoriteMark(event.target);
  if (!mark) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  toggleFromMark(mark);
}

function handleFavoriteKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const mark = findFavoriteMark(event.target);
  if (!mark) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  toggleFromMark(mark);
}

if (promptList) {
  decorateFavoriteMarks();
  promptList.addEventListener("click", handleFavoriteClick, true);
  promptList.addEventListener("keydown", handleFavoriteKeydown, true);
  new MutationObserver(decorateFavoriteMarks).observe(promptList, { childList: true });
}
