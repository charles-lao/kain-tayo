const cacheName = "kain-tayo-cache-v4";

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

// Clean up old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== cacheName).map(key => caches.delete(key))
      );
    })
  );
});

// Install event – cache the important files
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(cacheName).then(cache => {
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