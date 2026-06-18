// service-worker.js
const CACHE_NAME = 'alliance-hub-v1';

const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './rankings.html',
  './game.html',
  './player.html',
  './admin/index.html',
  './admin/games.html',
  './admin/game-detail.html',
  './admin/alliances.html',
  './admin/players.html',
  './admin/import.html',
  './admin/invites.html',
  './register/index.html',
  './assets/js/config.js',
  './assets/js/auth.js',
  './assets/js/ui-utils.js',
  './assets/js/csv-parser.js',
  './assets/js/pwa-utils.js',
  './assets/css/style.css',
  './manifest.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Alliance Hub SW: Caching...');
        return cache.addAll(urlsToCache);
      })
      .catch(function(err) {
        console.log('SW Cache install error:', err);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // IGNORAR requests que no son GET
  if (event.request.method !== 'GET') {
    return;
  }

  // IGNORAR requests de terceros (Supabase, analytics, extensiones)
  var url = new URL(event.request.url);
  if (url.hostname !== self.location.hostname) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Solo cachear respuestas válidas
        if (response && response.status === 200) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone).catch(function(err) {
              console.log('Cache put error:', err);
            });
          });
        }
        return response;
      })
      .catch(function() {
        // Fallback a cache
        return caches.match(event.request);
      })
  );
});
