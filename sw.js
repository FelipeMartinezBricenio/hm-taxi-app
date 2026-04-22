const CACHE_NAME = 'hm-taxi-v1';
const assets = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/logo.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});