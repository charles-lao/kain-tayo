// The cache name combines a manual version with the install date.
// The date alone was not enough: two deploys on the same day produced the same
// cache name, so the activate handler saw nothing to purge and stale assets
// (old CSS frameworks, removed libraries) lived on. Bump CACHE_VERSION whenever
// the asset lists below change.
const CACHE_VERSION = "v5";
const PRECACHE_PREFIX = "kain-tayo-precache-";
const cacheName = `${PRECACHE_PREFIX}${CACHE_VERSION}-${new Date().toISOString().slice(0, 10)}`;

// Meal photos live in their own cache with a stable name. They are large, they
// never change once published, and they are filled in as the user browses — so
// they must survive a precache version bump instead of being purged with it.
const imageCacheName = "kain-tayo-images";

// If you add a new page, list it here so the SW pre-caches it for offline use.
const htmlPages = [
  "./",
  "./index.html",
  "./list.html",
  "./saved-meals.html"
];

const preCacheAssets = [
  "./styles.css",
  "./js/utils.js",
  "./js/layout.js",
  "./js/install.js",
  "./js/sw-register.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./favicon.ico",
  "./favicon.svg",
  "./manifest.json",
  // Self-hosted so offline rendering never depends on a CDN URL or its hash.
  "./fonts/fraunces-latin.woff2",
  "./fonts/plus-jakarta-sans-latin.woff2",
  "./fonts/bootstrap-icons.woff2",
  "https://code.jquery.com/jquery-3.7.1.min.js",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/js/bootstrap.bundle.min.js",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css",
  "https://cdn.jsdelivr.net/npm/medium-zoom@1.1.0/dist/medium-zoom.min.js",
  "images/food-placeholder.png"
];

const networkFirstAssets = [
  "./data/foods.json"
];

const staticAssets = [...htmlPages, ...preCacheAssets, ...networkFirstAssets];

// Install event – cache static assets.
// addAll() is atomic: a single failing CDN request would throw away the whole
// precache. Each asset is cached individually so one bad response can't leave
// the app with nothing offline.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(cacheName).then(cache =>
      Promise.allSettled(
        staticAssets.map(asset =>
          cache.add(asset).catch(err => {
            console.warn("[SW] precache miss:", asset, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// Activate event – purge superseded precaches only. The image cache is left
// alone so a version bump doesn't wipe every meal photo the user has offline.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          // Everything this app has ever named, except the live precache and the
          // durable image cache. Catches legacy names from earlier versions too.
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
 * Normalise a precache entry to a path fragment we can match request URLs against.
 * "./" is dropped entirely — as an empty string it matched every URL, which made
 * the HTML branch below swallow every request and left cacheFirst unreachable.
 */
function matchFragments(list) {
  return list
    .map(entry => entry.replace(/^\.\//, ''))
    .filter(Boolean);
}

const htmlFragments = matchFragments(htmlPages);
const networkFirstFragments = matchFragments(networkFirstAssets);
const cacheFirstFragments = matchFragments(preCacheAssets);

// Fetch event
self.addEventListener("fetch", event => {
  const req = event.request;

  // Only GETs are cacheable.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOriginRoot = url.origin === self.location.origin &&
                           (url.pathname === '/' || url.pathname.endsWith('/'));

  // Navigations and HTML: Network First (fresh content online, cache offline)
  if (req.mode === 'navigate' || isSameOriginRoot ||
      htmlFragments.some(f => url.pathname.endsWith(f))) {
    event.respondWith(networkFirst(req, true));
  }
  // Data that should always be fresh: Network First
  else if (networkFirstFragments.some(f => url.pathname.endsWith(f))) {
    event.respondWith(networkFirst(req, true));
  }
  // Precached static assets (incl. fonts and CDN libs): Cache First
  else if (cacheFirstFragments.some(f => req.url.includes(f))) {
    event.respondWith(cacheFirst(req));
  }
  // Meal photos: Cache First against the long-lived image cache
  else if (req.destination === 'image') {
    event.respondWith(imageCacheFirst(req));
  }
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
  return cachedResponse || networkFirst(req, true);
}

/**
 * Meal photos: serve from the durable image cache, filling it on first view.
 * Falls back to the bundled placeholder when a photo is neither cached nor
 * reachable, so a tile never renders as a broken image.
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
 * @param {boolean} store Only true for assets this cache owns (pages, data,
 *   precached statics). Caching every successful response indiscriminately let
 *   arbitrary fetches bloat the precache, and all of it was thrown away on the
 *   next version bump.
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
    // ignoreSearch so a shared link carrying ?utm_source=… still matches the
    // cached page; ignoreVary so header variation can't cause a phantom miss.
    const opts = { ignoreSearch: true, ignoreVary: true };
    const cachedResponse = await cache.match(req, opts);
    if (cachedResponse) return cachedResponse;

    // A navigation with nothing cached for this exact URL still gets the shell.
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html', opts);
      if (shell) return shell;
    }

    // respondWith(undefined) surfaces as an opaque network error; be explicit.
    return new Response('Offline and not cached.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
