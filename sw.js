const CACHE_NAME = 'shepu-ai-v3.1';
const ASSETS = [
  './ai.html',
  './ai5.css',
  './ai5.js',
  './manifest.json',
  './pai.png',
  './hai.ico'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});
