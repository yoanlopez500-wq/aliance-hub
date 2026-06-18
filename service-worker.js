// service-worker.js
const CACHE_NAME = 'alliance-hub-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/rankings.html',
  '/game.html',
  '/player.html',
  '/assets/js/config.js',
  '/assets/js/auth.js',
  '/assets/js/ui-utils.js',
  '/assets/js/csv-parser.js',
  '/assets/css/style.css',
  '/manifest.json'
];

// Instalar: cachear recursos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.log('Cache install error:', err))
  );
  self.skipWaiting();
});

// Activar: limpiar caches viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: estrategia Network First, fallback a cache
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, actualizar cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, servir desde cache
        return caches.match(event.request);
      })
  );
});
