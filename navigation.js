const HOME_ROUTE = "library";
const editorDialog = document.querySelector("#editorDialog");
const detailDialog = document.querySelector("#detailDialog");
const closeEditorButton = document.querySelector("#closeEditorButton");
const closeDetailButton = document.querySelector("#closeDetailButton");

let overlayHistoryActive = false;
let handlingPopState = false;
let closeTimer = null;

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
