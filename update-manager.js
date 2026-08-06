const UPDATE_QUERY_KEY = "pm-update";
const UPDATE_CHECK_INTERVAL_MS = 60_000;

let updateInFlight = null;
let lastUpdateCheckAt = 0;
let reloadScheduled = false;

function removeUpdateQuery() {
  const url = new URL(location.href);
  if (!url.searchParams.has(UPDATE_QUERY_KEY)) return;
  url.searchParams.delete(UPDATE_QUERY_KEY);
  history.replaceState(history.state, "", url);
}

function reloadWithCacheBust() {
  if (reloadScheduled) return;
  reloadScheduled = true;

  const editorDialog = document.querySelector("#editorDialog");
  if (editorDialog?.open) {
    editorDialog.addEventListener("close", reloadWithCacheBust, { once: true });
    reloadScheduled = false;
    return;
  }

  const url = new URL(location.href);
  url.searchParams.set(UPDATE_QUERY_KEY, Date.now().toString());
  location.replace(url);
}

async function checkForServiceWorkerUpdate({ force = false } = {}) {
  if (!("serviceWorker" in navigator)) return null;

  const now = Date.now();
  if (!force && now - lastUpdateCheckAt < UPDATE_CHECK_INTERVAL_MS) return null;
  if (updateInFlight) return updateInFlight;

  lastUpdateCheckAt = now;
  updateInFlight = navigator.serviceWorker
    .register("./sw.js", {
      scope: "./",
      updateViaCache: "none",
    })
    .then(async (registration) => {
      await registration.update();
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      return registration;
    })
    .catch((error) => {
      console.error("서비스 워커 업데이트 확인 실패", error);
      return null;
    })
    .finally(() => {
      updateInFlight = null;
    });

  return updateInFlight;
}

removeUpdateQuery();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", reloadWithCacheBust);

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => checkForServiceWorkerUpdate({ force: true }),
      { once: true },
    );
  } else {
    checkForServiceWorkerUpdate({ force: true });
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkForServiceWorkerUpdate();
  });
}
