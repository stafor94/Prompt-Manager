import {
  BASE_VIEWER_TRANSFORM,
  getViewerScale,
  shouldResetViewerTransform,
} from "./image-viewer-fit-core.mjs";

function installImageViewerFit() {
  const root = document.documentElement;
  if (root.dataset.imageViewerFitInstalled === "true") return;
  root.dataset.imageViewerFitInstalled = "true";

  const dialog = document.querySelector("#imageViewerDialog");
  const stage = document.querySelector("#imageViewerStage");
  const image = document.querySelector("#imageViewerImage");
  if (!dialog || !stage || !image) return;

  let frameId = null;

  function removeSwipePreviewImages() {
    stage.querySelectorAll("img").forEach((candidate) => {
      if (candidate !== image) candidate.remove();
    });
  }

  function resetViewerForViewportChange() {
    frameId = null;
    if (!dialog.open) return;

    removeSwipePreviewImages();
    image.style.transition = "none";

    const transform = image.style.transform;
    if (getViewerScale(transform) > 1.001) {
      stage.dispatchEvent(new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
    }

    if (shouldResetViewerTransform(image.style.transform)) {
      image.style.transform = BASE_VIEWER_TRANSFORM;
    }
  }

  function scheduleReset() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(resetViewerForViewportChange);
  }

  image.draggable = false;
  image.addEventListener("load", scheduleReset);
  window.addEventListener("resize", scheduleReset, { passive: true });
  window.addEventListener("orientationchange", scheduleReset, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleReset, { passive: true });

  dialog.addEventListener("close", () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    removeSwipePreviewImages();
    image.style.transition = "none";
    image.style.transform = BASE_VIEWER_TRANSFORM;
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installImageViewerFit, { once: true });
  } else {
    installImageViewerFit();
  }
}
