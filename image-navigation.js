const DEFAULT_SWIPE_THRESHOLD = 56;
const HORIZONTAL_DOMINANCE_RATIO = 1.2;

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
  let swipeStart = null;
  let pendingDuplicateWithoutImages = false;
  let duplicateResetTimer = null;

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

  function showViewerItem(index) {
    if (!viewerContext) return;
    const item = viewerContext.items[index];
    if (!item) return;

    viewerContext.index = index;
    viewerImage.src = item.src;
    viewerImage.alt = item.imageName;
    viewerImage.style.transform = "translate3d(0, 0, 0) scale(1)";
    viewerCaption.textContent = buildViewerCaption(item, index, viewerContext.items.length);
  }

  function moveViewer(direction) {
    if (!viewerContext || !viewerIsAtBaseScale()) return;
    const nextIndex = resolveAdjacentIndex(
      viewerContext.index,
      viewerContext.items.length,
      direction,
    );
    if (nextIndex !== viewerContext.index) showViewerItem(nextIndex);
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
    if (!event.isPrimary || !viewerIsAtBaseScale()) return;
    swipeStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  });

  viewerStage.addEventListener("pointerup", (event) => {
    if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
    const direction = getSwipeDirection(
      swipeStart.x,
      swipeStart.y,
      event.clientX,
      event.clientY,
    );
    swipeStart = null;
    if (direction !== 0) moveViewer(direction);
  });

  viewerStage.addEventListener("pointercancel", () => {
    swipeStart = null;
  });

  viewerDialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveViewer(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveViewer(1);
    }
  });

  viewerDialog.addEventListener("close", () => {
    viewerContext = null;
    swipeStart = null;
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
