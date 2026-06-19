// service-worker.js v11 - Fixed scope and routing
const CACHE_NAME = 'alliance-hub-v11';

// Detectar base path automáticamente desde la ubicación del SW
const getBasePath = () => {
    const path = self.location.pathname;
    const parts = path.split('/').filter(p => p.length > 0);
    // Si el SW está en /repo-name/service-worker.js, base es /repo-name/
    if (parts.length >= 1) {
        return '/' + parts[0] + '/';
    }
    return '/';
};

const BASE_PATH = getBasePath();

const urlsToCache = [
    BASE_PATH,
    BASE_PATH + 'index.html',
    BASE_PATH + 'login.html',
    BASE_PATH + 'rankings.html',
    BASE_PATH + 'game.html',
    BASE_PATH + 'player.html',
    BASE_PATH + '404.html',
    BASE_PATH + 'manifest.json',
    BASE_PATH + 'assets/js/config.js',
    BASE_PATH + 'assets/js/auth.js',
    BASE_PATH + 'assets/js/ui-utils.js',
    BASE_PATH + 'assets/js/csv-parser.js',
    BASE_PATH + 'assets/js/pwa-utils.js',
    BASE_PATH + 'assets/css/style.css',
    BASE_PATH + 'assets/icons/icon-192x192.png',
    BASE_PATH + 'assets/icons/icon-512x512.png'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Alliance Hub SW: Caching...');
                // Cachear uno por uno para no fallar todo si uno da error
                return Promise.all(
                    urlsToCache.map(url => 
                        cache.add(url).catch(err => {
                            console.log('SW: Skip cache for', url, '-', err.message);
                        })
                    )
                );
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

    // IGNORAR requests con query params de redirect (evita bucles)
    if (url.search.includes('?p=') || url.search.includes('&q=')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(function(response) {
                // Solo cachear respuestas válidas y de nuestro dominio
                if (response && response.status === 200 && response.type === 'basic') {
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
                return caches.match(event.request).then(function(cached) {
                    if (cached) return cached;
                    // Si es una navegación y no está en cache, servir index.html
                    if (event.request.mode === 'navigate') {
                        return caches.match(BASE_PATH + 'index.html');
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});