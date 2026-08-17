const CACHE_NAME = "prompt-manager-shell-v49";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=1.5.5",
  "./fixes.css?v=1.5.5",
  "./detail-layout.css?v=1.5.5",
  "./archive-grouping.css?v=1.5.5",
  "./image-viewer-fit.css?v=1.5.5",
  "./tag-ui-fixes.css?v=1.5.5",
  "./favorite-editor-ui.css?v=1.5.5",
  "./app.js?v=1.5.5",
  "./prompt-db.mjs",
  "./archive-pagination-core.mjs",
  "./card-favorite.js?v=1.5.5",
  "./card-favorite-core.mjs",
  "./prompt-version.mjs",
  "./llm-filter.js?v=1.5.5",
  "./editor-tools.js?v=1.5.5",
  "./editor-title-extractor.mjs",
  "./navigation.js?v=1.5.5",
  "./ui-enhancements.js?v=1.5.5",
  "./archive-llm-filter.js?v=1.5.5",
  "./update-manager.js?v=1.5.5",
  "./version-display.js?v=1.5.5",
  "./library-controls.js?v=1.5.5",
  "./library-controls.css?v=1.5.5",
  "./archive-six-columns.js?v=1.5.5",
  "./archive-six-columns.css?v=1.5.5",
  "./archive-viewer-layout.js?v=1.5.5",
  "./archive-viewer-layout-core.mjs",
  "./archive-viewer-layout.css?v=1.5.5",
  "./image-navigation.js?v=1.5.5",
  "./image-metadata.mjs",
  "./image-viewer-fit.js?v=1.5.5",
  "./image-viewer-fit-core.mjs",
  "./tab-persistence.js?v=1.5.5",
  "./storage-summary.js?v=1.5.5",
  "./storage-quota.mjs",
  "./release-notes.js?v=1.5.5",
  "./release-notes-core.mjs",
  "./release-notes.css?v=1.5.5",
  "./CHANGELOG.md?v=1.5.5",
  "./prompt-organization-backup.js?v=1.5.5",
  "./prompt-organization-backup-core.mjs",
  "./prompt-organization-backup.css?v=1.5.5",
  "./prompt-tag-core.mjs",
  "./manifest.webmanifest?v=1.5.5",
  "./icons/icon.svg",
  "./icons/icon-maskable.svg",
  "./icons/llm-chatgpt.svg",
  "./icons/llm-gemini.svg",
  "./icons/llm-grok.svg",
  "./icons/llm-claude.svg"
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(APP_SHELL.map(async (asset) => {
    const url = new URL(asset, self.registration.scope);
    url.searchParams.set("pm-shell", CACHE_NAME);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`앱 셸 캐시 실패: ${asset}`);
    await cache.put(asset, response);
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function createFreshNavigationRequest(request) {
  const url = new URL(request.url);
  url.searchParams.set("pm-shell", CACHE_NAME);
  return new Request(url, request);
}

async function fetchAndCache(request, cacheKey = request) {
  const response = await fetch(request, { cache: "no-store" });
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(cacheKey, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetchAndCache(createFreshNavigationRequest(event.request), "./index.html")
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  const networkFirst = new Set(["script", "style", "manifest", "worker"])
    .has(event.request.destination);

  if (networkFirst) {
    event.respondWith(fetchAndCache(event.request).catch(() => caches.match(event.request)));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetchAndCache(event.request))
  );
});
