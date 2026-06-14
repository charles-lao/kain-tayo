const BUILD_DATE = '2026-06-14'; // ← UPDATE THIS TO TODAY'S DATE ON EACH DEPLOY
const cacheName = `kain-tayo-cache-${BUILD_DATE}`;

const htmlPages = [
  "./",
  "./index.html",
  "./list.html",
  "./saved-meals.html"
];

const preCacheAssets = [
  "./styles.css",
  "./js/utils.js",
  "./icons/icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
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

const networkFirstAssets = [
  "./data/foods.json"
];

const staticAssets = [...htmlPages, ...preCacheAssets, ...networkFirstAssets];

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

  // Strategy for HTML pages: Network First (fresh content when online, fallback to cache)
  if (htmlPages.some(page => req.url.includes(page.replace('./', '')))) {
    event.respondWith(networkFirst(req));
  } 
  // Strategy for data/assets that should always be fresh: Network First
  else if (networkFirstAssets.some(asset => req.url.includes(asset.replace('./', '')))) {
    event.respondWith(networkFirst(req));
  } 
  // Strategy for other static assets: Cache First
  else if (preCacheAssets.some(asset => req.url.includes(asset.replace('./', '')))) {
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

// Listen for skip-waiting message from the page
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
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
