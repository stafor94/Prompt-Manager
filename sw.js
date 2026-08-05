const CACHE_NAME = "prompt-manager-shell-v22";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=1.0.2",
  "./fixes.css?v=1.0.2",
  "./detail-layout.css?v=1.0.2",
  "./archive-grouping.css?v=1.0.2",
  "./app.js?v=1.0.2",
  "./prompt-version.mjs",
  "./llm-filter.js?v=1.0.2",
  "./editor-tools.js?v=1.0.2",
  "./navigation.js?v=1.0.2",
  "./ui-enhancements.js?v=1.0.2",
  "./manifest.webmanifest?v=1.0.2",
  "./icons/icon.svg",
  "./icons/icon-maskable.svg",
  "./icons/llm-chatgpt.svg",
  "./icons/llm-gemini.svg",
  "./icons/llm-grok.svg",
  "./icons/llm-claude.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function fetchAndCache(request, cacheKey = request) {
  const response = await fetch(request, { cache: "no-cache" });
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
      fetchAndCache(event.request, "./index.html")
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  const networkFirst = new Set(["script", "style", "manifest", "worker"])
    .has(event.request.destination);

  if (networkFirst) {
    event.respondWith(
      fetchAndCache(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetchAndCache(event.request);
    })
  );
});
