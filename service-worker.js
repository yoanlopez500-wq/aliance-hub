// service-worker.js v16
// Estrategia: Network-First + Auto-limpieza de caches viejos
var CACHE_NAME = 'ah-sw-v16';

self.addEventListener('install', function(event) {
    console.log('[SW v16] Instalando...');
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    console.log('[SW v16] Activando...');
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(name) {
                    if (name !== CACHE_NAME) {
                        console.log('[SW v16] Eliminando cache viejo:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function(event) {
    var req = event.request;
    if (req.url.includes('supabase.co') || req.url.includes('.google.')) return;

    event.respondWith(
        fetch(req, { cache: 'no-store' })
            .then(function(response) {
                if (req.method === 'GET' && /\.(png|jpg|jpeg|svg|gif|ico|woff|woff2|ttf)$/.test(req.url)) {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) { cache.put(req, clone); });
                }
                return response;
            })
            .catch(function() { return caches.match(req); })
    );
});
