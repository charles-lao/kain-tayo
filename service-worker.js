// Bump CACHE_VERSION when the asset lists change. Keep the name constant: the
// browser re-runs this script on every worker restart, so a date in the name
// pointed at an empty cache the day after install.
const CACHE_VERSION = "v6";
const cacheName = `kain-tayo-precache-${CACHE_VERSION}`;

// Meal photos are large and never change, so they get their own cache that a
// version bump does not purge.
const imageCacheName = "kain-tayo-images";

// Add new pages here so they work offline.
const htmlPages = [
  "./",
  "./index.html",
  "./list.html",
  "./saved-meals.html"
];

// Files that never change at the same URL: CDN libraries are pinned by version,
// and fonts and icons are regenerated rarely enough to go with a version bump.
const preCacheAssets = [
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./favicon.ico",
  "./favicon.svg",
  "./fonts/fraunces-latin.woff2",
  "./fonts/plus-jakarta-sans-latin.woff2",
  "./fonts/bootstrap-icons.woff2",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/js/bootstrap.bundle.min.js",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css",
  "https://cdn.jsdelivr.net/npm/medium-zoom@1.1.0/dist/medium-zoom.min.js",
  "images/food-placeholder.png"
];

// Our own code and data change at the same URL on every deploy. Serving them
// network-first like the HTML keeps pages and scripts from the same deploy,
// without needing a version bump for every code change.
const networkFirstAssets = [
  "./styles.css",
  "./js/utils.js",
  "./js/layout.js",
  "./js/install.js",
  "./js/sw-register.js",
  "./manifest.json",
  "./data/foods.json"
];

const staticAssets = [...htmlPages, ...preCacheAssets, ...networkFirstAssets];

// Not addAll(): it is atomic, so one failing CDN request would discard the whole
// precache. cache: 'reload' skips the HTTP cache so a fresh install never stores
// files from the previous deploy.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(cacheName).then(cache =>
      Promise.allSettled(
        staticAssets.map(asset =>
          cache.add(new Request(asset, { cache: 'reload' })).catch(err => {
            console.warn("[SW] precache miss:", asset, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// Delete every other kain-tayo cache, including legacy names, but keep photos.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('kain-tayo') &&
                         key !== cacheName &&
                         key !== imageCacheName)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/**
 * Turn list entries into path fragments to match request URLs against.
 * "./" is dropped because an empty string matches every URL.
 */
function matchFragments(list) {
  return list
    .map(entry => entry.replace(/^\.\//, ''))
    .filter(Boolean);
}

const htmlFragments = matchFragments(htmlPages);
const networkFirstFragments = matchFragments(networkFirstAssets);
const cacheFirstFragments = matchFragments(preCacheAssets);

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOriginRoot = url.origin === self.location.origin &&
                           (url.pathname === '/' || url.pathname.endsWith('/'));

  if (req.mode === 'navigate' || isSameOriginRoot ||
      htmlFragments.some(f => url.pathname.endsWith(f)) ||
      networkFirstFragments.some(f => url.pathname.endsWith(f))) {
    event.respondWith(networkFirst(req, true));
  }
  else if (cacheFirstFragments.some(f => req.url.includes(f))) {
    event.respondWith(cacheFirst(req));
  }
  else if (req.destination === 'image') {
    event.respondWith(imageCacheFirst(req));
  }
  else {
    event.respondWith(networkFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(req);
  return cachedResponse || networkFirst(req, true);
}

/**
 * Meal photos: serve from the image cache, filling it on first view. Falls back
 * to the placeholder when a photo is neither cached nor reachable.
 */
async function imageCacheFirst(req) {
  const cache = await caches.open(imageCacheName);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (e) {
    const precache = await caches.open(cacheName);
    const placeholder = await precache.match('images/food-placeholder.png');
    if (placeholder) return placeholder;

    return new Response('', { status: 504, statusText: 'Image unavailable' });
  }
}

/**
 * @param {Request} req
 * @param {boolean} store True only for files listed above. Storing every
 *   response let unrelated fetches bloat the precache.
 */
async function networkFirst(req, store = false) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);

    // Opaque cross-origin responses (status 0) are passed through, not stored.
    if (store && fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (e) {
    // ignoreSearch so a link with ?utm_source=... still matches the cached page.
    const opts = { ignoreSearch: true, ignoreVary: true };
    const cachedResponse = await cache.match(req, opts);
    if (cachedResponse) return cachedResponse;

    // A navigation with nothing cached for this exact URL still gets the shell.
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html', opts);
      if (shell) return shell;
    }

    return new Response('Offline and not cached.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
