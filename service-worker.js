const cacheName = "kain-tayo-cache-v1";

const assetsToCache = [
  "./",
  "./index.html",
  "./list.html",
  "./saved-meals.html",
  "./styles.css",
  "./js/utils.js",
  "./data/foods.json",
  "./icons/icon.png",
  "./favicon.ico",
  "./manifest.json"
];

// Install event – cache the important files
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(cacheName).then(cache => {
      console.log("📦 Caching assets...");
      return cache.addAll(assetsToCache);
    })
  );
});

// Fetch event – return cached version if offline
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});