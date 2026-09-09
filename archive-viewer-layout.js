import {
  ARCHIVE_VIEWER_LAYOUT_DUAL,
  ARCHIVE_VIEWER_LAYOUT_SINGLE,
  buildDualViewerCaption,
  normalizeArchiveViewerLayout,
  resolveAdjacentDualPairStart,
  resolveDualPair,
} from "./archive-viewer-layout-core.mjs";
import { formatImageMetadata } from "./image-metadata.mjs";

const APP_VERSION = "1.6.0";
const ARCHIVE_VIEWER_LAYOUT_KEY = "prompt-manager-archive-viewer-layout";
const DUAL_VIEWER_HISTORY_KEY = "promptManagerDualArchiveViewer";
const ARCHIVE_VIEWER_HISTORY_KEY = "promptManagerArchiveViewer";
const SWIPE_THRESHOLD = 56;
const HORIZONTAL_DOMINANCE_RATIO = 1.2;

let archiveViewerLayout = readArchiveViewerLayout();
let dualContext = null;
let dualGesture = null;
let secondaryImage = null;
let dualViewerHistoryActive = false;

function readArchiveViewerLayout() {
  try { return normalizeArchiveViewerLayout(localStorage.getItem(ARCHIVE_VIEWER_LAYOUT_KEY)); }
  catch { return ARCHIVE_VIEWER_LAYOUT_SINGLE; }
}

function saveArchiveViewerLayout(layout) {
  try { localStorage.setItem(ARCHIVE_VIEWER_LAYOUT_KEY, layout); }
  catch { /* 저장소 접근이 제한된 환경에서는 현재 세션 상태만 유지합니다. */ }
}

function installStylesheet() {
  if (document.querySelector("link[data-archive-viewer-layout-style]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `./archive-viewer-layout.css?v=${APP_VERSION}`;
  link.dataset.archiveViewerLayoutStyle = "true";
  document.head.append(link);
}

function syncLayoutButtons() {
  document.querySelectorAll("[data-archive-viewer-layout]").forEach((button) => {
    const active = button.dataset.archiveViewerLayout === archiveViewerLayout;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setArchiveViewerLayout(layout) {
  archiveViewerLayout = normalizeArchiveViewerLayout(layout);
  saveArchiveViewerLayout(archiveViewerLayout);
  syncLayoutButtons();
}

function createLayoutControls(toolbar) {
  let controls = toolbar.querySelector(".archive-viewer-layout-controls");
  if (controls) return controls;
  controls = document.createElement("div");
  controls.className = "archive-viewer-layout-controls";
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "확대 이미지 보기 방식");
  controls.innerHTML = `
    <button class="archive-viewer-layout-button" type="button" data-archive-viewer-layout="SINGLE" aria-label="이미지 한 장씩 보기">1장보기</button>
    <button class="archive-viewer-layout-button" type="button" data-archive-viewer-layout="DUAL" aria-label="이미지 두 장을 좌우로 보기">2장보기</button>
  `;
  toolbar.append(controls);
  controls.querySelectorAll("[data-archive-viewer-layout]").forEach((button) => {
    button.addEventListener("click", () => setArchiveViewerLayout(button.dataset.archiveViewerLayout));
  });
  syncLayoutButtons();
  return controls;
}

function installLayoutControls() {
  const toolbar = document.querySelector("#archiveScreen .archive-toolbar");
  if (!toolbar) return false;
  createLayoutControls(toolbar);
  return true;
}

function waitForLayoutControls() {
  if (installLayoutControls()) return;
  const observer = new MutationObserver(() => {
    if (installLayoutControls()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function isVisibleArchiveItem(button) {
  return Boolean(button && !button.hidden && !button.closest("[hidden]"));
}

function archiveItemFromButton(button, groupedTitle = "") {
  const image = button.querySelector("img");
  if (!image?.src) return null;
  const promptTitle = groupedTitle || button.querySelector(".image-archive-caption")?.textContent?.trim() || "";
  return { src: image.src, imageName: image.alt || "첨부 이미지", promptTitle };
}

function captureDualContext(clickedButton) {
  const group = clickedButton.closest(".archive-prompt-group");
  const container = group ?? document.querySelector("#imageArchiveGrid");
  if (!container) {
    dualContext = null;
    return;
  }
  const groupedTitle = group?.querySelector(".archive-prompt-group-header h3")?.textContent?.trim() ?? "";
  const buttons = [...container.querySelectorAll("[data-archive-image-index]")].filter(isVisibleArchiveItem);
  const items = buttons.map((button) => archiveItemFromButton(button, groupedTitle)).filter(Boolean);
  const index = buttons.indexOf(clickedButton);
  dualContext = index >= 0 && items.length > 0 ? { items, clickedIndex: index, pairStart: 0 } : null;
}

function renderCurrentDualCaption() {
  const viewerDialog = document.querySelector("#imageViewerDialog");
  const viewerImage = document.querySelector("#imageViewerImage");
  const viewerCaption = document.querySelector("#imageViewerCaption");
  if (!dualContext || !viewerDialog || viewerDialog.dataset.archiveViewerLayout !== ARCHIVE_VIEWER_LAYOUT_DUAL
    || !viewerImage || !viewerCaption) return;

  const pair = resolveDualPair(dualContext.pairStart, dualContext.items.length);
  if (pair.length === 0) return;
  const leftMetadata = formatImageMetadata(viewerImage.naturalWidth, viewerImage.naturalHeight);
  const rightMetadata = secondaryImage && !secondaryImage.hidden
    ? formatImageMetadata(secondaryImage.naturalWidth, secondaryImage.naturalHeight)
    : "";
  viewerCaption.textContent = [
    buildDualViewerCaption(dualContext.items, pair),
    leftMetadata ? `왼쪽-${leftMetadata}` : "",
    rightMetadata ? `오른쪽-${rightMetadata}` : "",
  ].filter(Boolean).join(" · ");
}

function ensureSecondaryImage(viewerStage) {
  if (secondaryImage?.isConnected) return secondaryImage;
  secondaryImage = document.createElement("img");
  secondaryImage.className = "archive-dual-view-secondary";
  secondaryImage.alt = "";
  secondaryImage.addEventListener("load", renderCurrentDualCaption);
  viewerStage.append(secondaryImage);
  return secondaryImage;
}

function resetDualViewer() {
  const viewerDialog = document.querySelector("#imageViewerDialog");
  const viewerStage = document.querySelector("#imageViewerStage");
  const viewerImage = document.querySelector("#imageViewerImage");
  viewerDialog?.removeAttribute("data-archive-viewer-layout");
  viewerStage?.classList.remove("archive-dual-view-active");
  viewerImage?.classList.remove("archive-dual-view-primary");
  if (viewerImage) {
    viewerImage.style.transition = "none";
    viewerImage.style.transform = "translate3d(0, 0, 0) scale(1)";
  }
  secondaryImage?.remove();
  secondaryImage = null;
  dualGesture = null;
  dualContext = null;
}

function showDualPair(startIndex) {
  const viewerDialog = document.querySelector("#imageViewerDialog");
  const viewerStage = document.querySelector("#imageViewerStage");
  const viewerImage = document.querySelector("#imageViewerImage");
  const viewerCaption = document.querySelector("#imageViewerCaption");
  if (!dualContext || !viewerDialog || !viewerStage || !viewerImage || !viewerCaption) return;

  const pair = resolveDualPair(startIndex, dualContext.items.length);
  if (pair.length === 0) return;
  dualContext.pairStart = pair[0];
  const leftItem = dualContext.items[pair[0]];
  const rightItem = pair.length > 1 ? dualContext.items[pair[1]] : null;
  const rightImage = ensureSecondaryImage(viewerStage);

  viewerDialog.dataset.archiveViewerLayout = ARCHIVE_VIEWER_LAYOUT_DUAL;
  viewerStage.classList.add("archive-dual-view-active");
  viewerImage.classList.add("archive-dual-view-primary");
  viewerImage.src = leftItem.src;
  viewerImage.alt = leftItem.imageName;
  viewerImage.style.transition = "none";
  viewerImage.style.transform = "translate3d(0, 0, 0) scale(1)";

  if (rightItem) {
    rightImage.hidden = false;
    rightImage.src = rightItem.src;
    rightImage.alt = rightItem.imageName;
  } else {
    rightImage.hidden = true;
    rightImage.removeAttribute("src");
    rightImage.alt = "";
  }

  viewerCaption.textContent = buildDualViewerCaption(dualContext.items, pair);
  if (viewerImage.complete && viewerImage.naturalWidth > 0
    && (!rightItem || (rightImage.complete && rightImage.naturalWidth > 0))) {
    queueMicrotask(renderCurrentDualCaption);
  }
}

function openDualViewer() {
  const viewerDialog = document.querySelector("#imageViewerDialog");
  if (!dualContext || !viewerDialog || viewerDialog.open) return false;
  showDualPair(dualContext.clickedIndex);
  const currentState = history.state && typeof history.state === "object" ? history.state : {};
  history.pushState({
    ...currentState,
    [ARCHIVE_VIEWER_HISTORY_KEY]: true,
    [DUAL_VIEWER_HISTORY_KEY]: true,
  }, "", location.href);
  dualViewerHistoryActive = true;
  viewerDialog.showModal();
  return true;
}

function moveDualPair(direction) {
  if (!dualContext || ![-1, 1].includes(direction)) return;
  const nextStart = resolveAdjacentDualPairStart(dualContext.pairStart, dualContext.items.length, direction);
  if (nextStart === dualContext.pairStart) return;
  showDualPair(nextStart);
}

function isDualViewerActive() {
  return document.querySelector("#imageViewerDialog")?.dataset.archiveViewerLayout === ARCHIVE_VIEWER_LAYOUT_DUAL;
}

function blockSingleViewerGesture(event) {
  if (!isDualViewerActive()) return false;
  event.stopImmediatePropagation();
  return true;
}

function closeDualViewerThroughHistory(event) {
  if (!isDualViewerActive() || !dualViewerHistoryActive) return false;
  event?.preventDefault();
  event?.stopImmediatePropagation();
  history.back();
  return true;
}

function bindDualViewerEvents() {
  const viewerDialog = document.querySelector("#imageViewerDialog");
  const viewerStage = document.querySelector("#imageViewerStage");
  const viewerImage = document.querySelector("#imageViewerImage");
  const closeButton = document.querySelector("#closeImageViewerButton");
  if (!viewerDialog || !viewerStage || !viewerImage) return;

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("#imageArchiveGrid [data-archive-image-index]");
    if (!button || archiveViewerLayout !== ARCHIVE_VIEWER_LAYOUT_DUAL) return;
    captureDualContext(button);
    if (!dualContext) return;
    event.preventDefault();
    event.stopPropagation();
    openDualViewer();
  }, true);

  viewerImage.addEventListener("load", renderCurrentDualCaption);

  viewerStage.addEventListener("pointerdown", (event) => {
    if (!blockSingleViewerGesture(event) || !event.isPrimary) return;
    dualGesture = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
  }, true);

  viewerStage.addEventListener("pointermove", (event) => {
    if (!blockSingleViewerGesture(event)) return;
    if (!dualGesture || dualGesture.pointerId !== event.pointerId) return;
    event.preventDefault();
  }, true);

  viewerStage.addEventListener("pointerup", (event) => {
    if (!blockSingleViewerGesture(event)) return;
    if (!dualGesture || dualGesture.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - dualGesture.startX;
    const deltaY = event.clientY - dualGesture.startY;
    dualGesture = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY) * HORIZONTAL_DOMINANCE_RATIO) return;
    moveDualPair(deltaX < 0 ? 1 : -1);
  }, true);

  viewerStage.addEventListener("pointercancel", (event) => {
    if (!blockSingleViewerGesture(event)) return;
    dualGesture = null;
  }, true);

  viewerStage.addEventListener("dblclick", (event) => {
    if (!blockSingleViewerGesture(event)) return;
    event.preventDefault();
  }, true);

  viewerStage.addEventListener("wheel", (event) => {
    if (!blockSingleViewerGesture(event)) return;
    event.preventDefault();
  }, { capture: true, passive: false });

  viewerDialog.addEventListener("keydown", (event) => {
    if (!isDualViewerActive() || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    moveDualPair(event.key === "ArrowRight" ? 1 : -1);
  }, true);

  closeButton?.addEventListener("click", (event) => closeDualViewerThroughHistory(event), true);
  viewerDialog.addEventListener("cancel", (event) => closeDualViewerThroughHistory(event), true);
  viewerDialog.addEventListener("close", () => {
    dualViewerHistoryActive = false;
    resetDualViewer();
  });
  window.addEventListener("popstate", () => {
    if (!dualViewerHistoryActive) return;
    dualViewerHistoryActive = false;
    if (viewerDialog.open) viewerDialog.close();
  });
}

function initArchiveViewerLayout() {
  installStylesheet();
  waitForLayoutControls();
  bindDualViewerEvents();
}

if (typeof document !== "undefined") initArchiveViewerLayout();
