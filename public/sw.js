const CACHE = 'infinity-v2-offline-2';
const staticPath = path => path === '/' || path === '/index.html' ||
  path === '/manifest.webmanifest' || path === '/icon.svg' || path.startsWith('/assets/');
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(['/', '/manifest.webmanifest', '/icon.svg']))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('infinity-v2-offline-') && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Never cache account responses or personal snapshots.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      url.pathname.startsWith('/api/') || !staticPath(url.pathname)) return;
  event.respondWith(fetch(event.request, { cache: 'no-cache' }).then(response => {
    if (response.ok && !response.redirected && !/no-store|private/i.test(response.headers.get('Cache-Control') || '')) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {}));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    return cached || (event.request.mode === 'navigate' ? await caches.match('/') : undefined) || Response.error();
  }));
});
