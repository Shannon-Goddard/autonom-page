const SHELL_VERSION = 'shell-v2';
const DYNAMIC_CACHE = 'dynamic-v2';

// Only truly static assets that never change after deploy
const SHELL_ASSETS = [
  '/assets/favicon.ico',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/games/tetris.js',
  '/games/pacman.js',
  '/games/snake.js',
  '/games/breakout.js',
  '/games/spaceinvaders.js',
];

// HTML, JS, CSS — network first so template updates always reach the user
const NETWORK_FIRST_SHELL = [
  '/',
  '/index.html',
  '/gallery.html',
  '/music.html',
  '/videos.html',
  '/friends.html',
  '/guestbook.html',
  '/games.html',
  '/404.html',
  '/auth.js',
  '/nav.js',
  '/theme.js',
  '/styles.css',
  '/manifest.json',
  '/github-api.js',
  '/media.js',
  '/feeds.js',
  '/business.js',
  '/admin.js',
  '/index.js',
];

// ─── Install — cache shell assets ────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_VERSION)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate — clean up old shell caches ────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => (k.startsWith('shell-') && k !== SHELL_VERSION) || (k.startsWith('dynamic-') && k !== DYNAMIC_CACHE))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Always bypass cache for .json and .xml — never store site-config.json
  if (url.endsWith('.json') || url.endsWith('.xml')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => {
      return caches.match(e.request).then(cached =>
        cached || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } })
      );
    }));
    return;
  }

  // Icons and game files — cache first (never change)
  if (isShellAsset(url)) {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  // HTML/JS/CSS — network first, fall back to cache
  if (isNetworkFirstShell(url)) {
    e.respondWith(networkFirstDynamic(e.request));
    return;
  }

  // User-editable assets — always fetch fresh
  if (url.includes('/assets/cover.webp') || url.includes('/assets/profile.webp') || url.includes('/assets/background.webp')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request)));
    return;
  }

  // Gallery images, MP3, posts — network first, cache on success
  if (url.includes('/assets/gallery/') || url.includes('/assets/music/') || url.includes('/assets/posts/')) {
    e.respondWith(networkFirstDynamic(e.request));
    return;
  }

  // Everything else — network first
  e.respondWith(networkFirstDynamic(e.request));
});

// ─── Strategies ───────────────────────────────────────────────────────────────

// Cache first — for shell assets
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// Network first for .json/.xml — fall back to cache with stale indicator header
async function networkFirstWithIndicator(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      if (request.method === 'GET') {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    }
    throw new Error('Network response not ok');
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      // Clone and add header so the page can show "viewing cached version" indicator
      const headers = new Headers(cached.headers);
      headers.set('X-Autonom-Stale', 'true');
      const body = await cached.blob();
      return new Response(body, { status: 200, headers });
    }
    return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

// Network first — for dynamic assets, cache on success
async function networkFirstDynamic(request) {
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// ─── Shell asset check ────────────────────────────────────────────────────────
function isShellAsset(url) {
  return SHELL_ASSETS.some(asset => url.endsWith(asset));
}

function isNetworkFirstShell(url) {
  return NETWORK_FIRST_SHELL.some(asset => url.endsWith(asset));
}

// ─── configVersion cache invalidation ────────────────────────────────────────
// Main thread posts a message when configVersion changes — triggers shell cache bust
self.addEventListener('message', e => {
  if (e.data?.type === 'INVALIDATE_SHELL') {
    caches.delete(SHELL_VERSION).then(() => {
      caches.open(SHELL_VERSION).then(cache => cache.addAll(SHELL_ASSETS));
    });
  }
});
