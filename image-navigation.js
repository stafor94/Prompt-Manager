const DEFAULT_SWIPE_THRESHOLD = 56;
const HORIZONTAL_DOMINANCE_RATIO = 1.2;
const SWIPE_START_DISTANCE = 8;
const EDGE_RESISTANCE = 0.28;
const SWIPE_ANIMATION_MS = 220;
const SNAP_BACK_ANIMATION_MS = 180;
const SWIPE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export function getSwipeDirection(startX, startY, endX, endY, threshold = DEFAULT_SWIPE_THRESHOLD) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  if (Math.abs(deltaX) < threshold) return 0;
  if (Math.abs(deltaX) <= Math.abs(deltaY) * HORIZONTAL_DOMINANCE_RATIO) return 0;
  return deltaX < 0 ? 1 : -1;
}

export function resolveAdjacentIndex(currentIndex, itemCount, direction) {
  if (!Number.isInteger(currentIndex) || itemCount <= 0 || ![-1, 1].includes(direction)) {
    return currentIndex;
  }
  return Math.min(itemCount - 1, Math.max(0, currentIndex + direction));
}

export function getSwipeDragOffset(deltaX, hasAdjacent, resistance = EDGE_RESISTANCE) {
  if (!Number.isFinite(deltaX)) return 0;
  if (hasAdjacent) return deltaX;
  return deltaX * Math.min(1, Math.max(0, resistance));
}

export function buildViewerCaption(item, index, total) {
  const position = `${index + 1} / ${total}`;
  return [position, item.promptTitle, item.imageName].filter(Boolean).join(" · ");
}

function installImageNavigation() {
  const root = document.documentElement;
  if (root.dataset.imageNavigationInstalled === "true") return;
  root.dataset.imageNavigationInstalled = "true";

  const viewerDialog = document.querySelector("#imageViewerDialog");
  const viewerStage = document.querySelector("#imageViewerStage");
  const viewerImage = document.querySelector("#imageViewerImage");
  const viewerCaption = document.querySelector("#imageViewerCaption");
  const editorDialog = document.querySelector("#editorDialog");
  const editorImageList = document.querySelector("#editorImageList");
  const snackbar = document.querySelector("#snackbar");

  if (!viewerDialog || !viewerStage || !viewerImage || !viewerCaption) return;

  let viewerContext = null;
  let swipeGesture = null;
  let previewImage = null;
  let previewIndex = null;
  let isAnimating = false;
  let animationTimer = null;
  let animationFrame = null;
  let pendingDuplicateWithoutImages = false;
  let duplicateResetTimer = null;

  viewerImage.style.gridArea = "1 / 1";

  function isVisible(element) {
    if (!element || element.hidden || element.closest("[hidden]")) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none"
      && style.visibility !== "hidden"
      && element.getClientRects().length > 0;
  }

  function imageItemFromButton(button, promptTitle = "") {
    const image = button.querySelector("img");
    if (!image?.src) return null;
    return {
      src: image.src,
      imageName: image.alt || "첨부 이미지",
      promptTitle,
    };
  }

  function captureDetailContext(clickedButton) {
    const buttons = [...document.querySelectorAll("#detailImageStrip [data-detail-image-index]")]
      .filter(isVisible);
    const items = buttons
      .map((button) => imageItemFromButton(button))
      .filter(Boolean);
    const index = buttons.indexOf(clickedButton);
    if (index < 0 || items.length === 0) return;
    viewerContext = { items, index };
  }

  function captureArchiveContext(clickedButton) {
    const group = clickedButton.closest(".archive-prompt-group");
    const container = group ?? document.querySelector("#imageArchiveGrid");
    if (!container) return;

    const promptTitle = group?.querySelector(".archive-prompt-group-header h3")?.textContent?.trim() ?? "";
    const buttons = [...container.querySelectorAll("[data-archive-image-index]")]
      .filter(isVisible);
    const items = buttons
      .map((button) => {
        const itemTitle = promptTitle
          || button.querySelector(".image-archive-caption")?.textContent?.trim()
          || "";
        return imageItemFromButton(button, itemTitle);
      })
      .filter(Boolean);
    const index = buttons.indexOf(clickedButton);
    if (index < 0 || items.length === 0) return;
    viewerContext = { items, index };
  }

  function viewerIsAtBaseScale() {
    const transform = viewerImage.style.transform;
    const match = transform.match(/scale\(([-\d.]+)\)/);
    return !match || Number(match[1]) <= 1.001;
  }

  function getStageWidth() {
    return Math.max(viewerStage.clientWidth, 1);
  }

  function setImageOffset(image, offset, transition = "none") {
    image.style.transition = transition;
    image.style.transform = `translate3d(${offset}px, 0, 0) scale(1)`;
  }

  function clearAnimationHandles() {
    clearTimeout(animationTimer);
    animationTimer = null;
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function removePreviewImage() {
    previewImage?.remove();
    previewImage = null;
    previewIndex = null;
  }

  function resetSwipeVisuals({ preserveTransform = false } = {}) {
    clearAnimationHandles();
    removePreviewImage();
    isAnimating = false;
    viewerImage.style.transition = "none";
    if (!preserveTransform) {
      viewerImage.style.transform = "translate3d(0, 0, 0) scale(1)";
    }
  }

  function showViewerItem(index) {
    if (!viewerContext) return;
    const item = viewerContext.items[index];
    if (!item) return;

    viewerContext.index = index;
    viewerImage.style.transition = "none";
    viewerImage.src = item.src;
    viewerImage.alt = item.imageName;
    viewerImage.style.transform = "translate3d(0, 0, 0) scale(1)";
    viewerCaption.textContent = buildViewerCaption(item, index, viewerContext.items.length);
  }

  function ensurePreviewImage(index, initialOffset) {
    if (!viewerContext) return null;
    if (previewImage && previewIndex === index) return previewImage;

    removePreviewImage();
    const item = viewerContext.items[index];
    if (!item) return null;

    const image = viewerImage.cloneNode(false);
    image.removeAttribute("id");
    image.src = item.src;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.style.gridArea = "1 / 1";
    image.style.transition = "none";
    image.style.transform = `translate3d(${initialOffset}px, 0, 0) scale(1)`;
    viewerStage.append(image);
    previewImage = image;
    previewIndex = index;
    return image;
  }

  function resolveSwipeTarget(direction) {
    if (!viewerContext) return null;
    const nextIndex = resolveAdjacentIndex(
      viewerContext.index,
      viewerContext.items.length,
      direction,
    );
    return nextIndex === viewerContext.index ? null : nextIndex;
  }

  function updateSwipePreview(deltaX) {
    if (!viewerContext || deltaX === 0) return;
    const direction = deltaX < 0 ? 1 : -1;
    const nextIndex = resolveSwipeTarget(direction);
    const hasAdjacent = nextIndex !== null;
    const offset = getSwipeDragOffset(deltaX, hasAdjacent);
    setImageOffset(viewerImage, offset);

    if (!hasAdjacent) {
      removePreviewImage();
      return;
    }

    const width = getStageWidth();
    const previewStart = direction === 1 ? width : -width;
    const image = ensurePreviewImage(nextIndex, previewStart);
    if (image) setImageOffset(image, previewStart + offset);
  }

  function finishAnimation(callback, duration) {
    clearTimeout(animationTimer);
    animationTimer = setTimeout(() => {
      animationTimer = null;
      callback();
    }, duration + 34);
  }

  function snapBack() {
    const transition = `transform ${SNAP_BACK_ANIMATION_MS}ms ${SWIPE_EASING}`;
    const width = getStageWidth();
    const previewDirection = previewIndex !== null && viewerContext
      ? Math.sign(previewIndex - viewerContext.index)
      : 0;

    isAnimating = true;
    animationFrame = requestAnimationFrame(() => {
      animationFrame = null;
      setImageOffset(viewerImage, 0, transition);
      if (previewImage && previewDirection !== 0) {
        setImageOffset(previewImage, previewDirection > 0 ? width : -width, transition);
      }
      finishAnimation(() => resetSwipeVisuals(), SNAP_BACK_ANIMATION_MS);
    });
  }

  function animateViewer(direction) {
    if (!viewerContext || isAnimating || !viewerIsAtBaseScale()) return;
    const nextIndex = resolveSwipeTarget(direction);
    if (nextIndex === null) {
      snapBack();
      return;
    }

    const width = getStageWidth();
    const outgoingTarget = direction === 1 ? -width : width;
    const incomingStart = direction === 1 ? width : -width;
    const incomingImage = ensurePreviewImage(nextIndex, incomingStart);
    if (!incomingImage) return;

    const transition = `transform ${SWIPE_ANIMATION_MS}ms ${SWIPE_EASING}`;
    isAnimating = true;
    animationFrame = requestAnimationFrame(() => {
      animationFrame = null;
      setImageOffset(viewerImage, outgoingTarget, transition);
      setImageOffset(incomingImage, 0, transition);
      finishAnimation(() => {
        showViewerItem(nextIndex);
        removePreviewImage();
        isAnimating = false;
      }, SWIPE_ANIMATION_MS);
    });
  }

  function markDuplicateWithoutImages() {
    pendingDuplicateWithoutImages = true;
    clearTimeout(duplicateResetTimer);
    duplicateResetTimer = setTimeout(() => {
      pendingDuplicateWithoutImages = false;
    }, 5000);
  }

  function clearPendingDuplicate() {
    pendingDuplicateWithoutImages = false;
    clearTimeout(duplicateResetTimer);
  }

  function removeDuplicateImages() {
    if (!editorImageList) return;
    let removedCount = 0;
    let removeButton = editorImageList.querySelector("[data-remove-image-id]");
    while (removeButton && removedCount < 10) {
      removeButton.click();
      removedCount += 1;
      removeButton = editorImageList.querySelector("[data-remove-image-id]");
    }

    if (removedCount > 0 && snackbar) {
      snackbar.textContent = "첨부 이미지를 제외하고 복제했습니다.";
      snackbar.classList.add("show");
    }
  }

  document.addEventListener("click", (event) => {
    const detailButton = event.target.closest?.("#detailImageStrip [data-detail-image-index]");
    if (detailButton) {
      captureDetailContext(detailButton);
      return;
    }

    const archiveButton = event.target.closest?.("#imageArchiveGrid [data-archive-image-index]");
    if (archiveButton) {
      captureArchiveContext(archiveButton);
      return;
    }

    if (event.target.closest?.("#duplicatePromptButton")) {
      markDuplicateWithoutImages();
      return;
    }

    if (event.target.closest?.("#addPromptButton, #editPromptButton")) {
      clearPendingDuplicate();
    }
  }, true);

  viewerStage.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary) {
      swipeGesture = null;
      resetSwipeVisuals({ preserveTransform: true });
      return;
    }
    if (isAnimating || !viewerIsAtBaseScale()) return;
    swipeGesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      horizontal: false,
    };
  });

  viewerStage.addEventListener("pointermove", (event) => {
    if (!swipeGesture || swipeGesture.pointerId !== event.pointerId || isAnimating) return;
    if (!viewerIsAtBaseScale()) {
      swipeGesture = null;
      resetSwipeVisuals({ preserveTransform: true });
      return;
    }

    swipeGesture.currentX = event.clientX;
    swipeGesture.currentY = event.clientY;
    const deltaX = event.clientX - swipeGesture.startX;
    const deltaY = event.clientY - swipeGesture.startY;

    if (!swipeGesture.horizontal) {
      if (Math.abs(deltaX) < SWIPE_START_DISTANCE && Math.abs(deltaY) < SWIPE_START_DISTANCE) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY) * HORIZONTAL_DOMINANCE_RATIO) return;
      swipeGesture.horizontal = true;
    }

    event.preventDefault();
    updateSwipePreview(deltaX);
  });

  viewerStage.addEventListener("pointerup", (event) => {
    if (!swipeGesture || swipeGesture.pointerId !== event.pointerId) return;
    const gesture = swipeGesture;
    swipeGesture = null;

    if (!gesture.horizontal) {
      resetSwipeVisuals();
      return;
    }

    const direction = getSwipeDirection(
      gesture.startX,
      gesture.startY,
      event.clientX,
      event.clientY,
    );
    if (direction === 0 || resolveSwipeTarget(direction) === null) {
      snapBack();
      return;
    }
    animateViewer(direction);
  });

  viewerStage.addEventListener("pointercancel", () => {
    swipeGesture = null;
    if (!isAnimating) snapBack();
  });

  viewerDialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      animateViewer(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      animateViewer(1);
    }
  });

  viewerDialog.addEventListener("close", () => {
    viewerContext = null;
    swipeGesture = null;
    resetSwipeVisuals();
  });

  if (editorDialog && editorImageList) {
    const observer = new MutationObserver(() => {
      if (!editorDialog.open || !pendingDuplicateWithoutImages) return;
      clearPendingDuplicate();
      queueMicrotask(removeDuplicateImages);
    });
    observer.observe(editorDialog, { attributes: true, attributeFilter: ["open"] });
  }
}

if (typeof document !== "undefined") {
  installImageNavigation();
}
