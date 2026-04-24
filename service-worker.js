const cacheName = "kain-tayo-cache-v5";
const staticAssets = [
  "./",
  "./index.html",
  "./list.html",
  "./saved-meals.html",
  "./styles.css",
  "./js/utils.js",
  "./data/foods.json",
  "./icons/icon.png",
  "./favicon.ico",
  "./manifest.json",
  "https://code.jquery.com/jquery-3.7.1.min.js",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/js/bootstrap.bundle.min.js",
  "https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/lumen/bootstrap.min.css",
  "https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js",
  "https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css",
  "https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js",
  "images/food-placeholder.png"
];

// Install event – cache static assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(cacheName).then(cache => {
      return cache.addAll(staticAssets);
    })
  );
  self.skipWaiting();
});

// Activate event – clean up old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== cacheName).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // Strategy for static assets: Cache First
  if (staticAssets.some(asset => req.url.includes(asset.replace('./', '')))) {
    event.respondWith(cacheFirst(req));
  } 
  // Strategy for images: Cache with Network Fallback & Dynamic Caching
  else if (req.destination === 'image') {
    event.respondWith(cacheFirst(req));
  }
  // Default strategy: Network First
  else {
    event.respondWith(networkFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(req);
  return cachedResponse || networkFirst(req);
}

async function networkFirst(req) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    // Dynamic caching for images
    if (req.destination === 'image' || req.url.includes('data/foods.json')) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (e) {
    const cachedResponse = await cache.match(req);
    return cachedResponse;
  }
}
