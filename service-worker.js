// service-worker.js v12 - Con Kill Switch remoto
const CACHE_NAME = 'alliance-hub-v12';
const KILL_SWITCH_URL = 'https://qkccyjegkgjzwoxytnqp.supabase.co/rest/v1/app_settings?select=value&key=eq.force_clear_cache';

// Detectar base path
var BASE_PATH = (function() {
    var path = self.location.pathname;
    var parts = path.split('/').filter(function(p) { return p.length > 0; });
    if (parts.length >= 1 && !parts[0].includes('.') && parts[0].length > 0) {
        return '/' + parts[0] + '/';
    }
    return '/';
})();

var urlsToCache = [
    BASE_PATH,
    BASE_PATH + 'index.html',
    BASE_PATH + 'login.html',
    BASE_PATH + 'rankings.html',
    BASE_PATH + 'game.html',
    BASE_PATH + 'player.html',
    BASE_PATH + '404.html',
    BASE_PATH + 'manifest.json',
    BASE_PATH + 'assets/js/base.js',
    BASE_PATH + 'assets/js/auth.js',
    BASE_PATH + 'assets/js/config.js',
    BASE_PATH + 'assets/js/pwa-utils.js',
    BASE_PATH + 'assets/js/csv-parser.js',
    BASE_PATH + 'assets/css/style.css',
    BASE_PATH + 'assets/icons/icon-192x192.png',
    BASE_PATH + 'assets/icons/icon-512x512.png'
];

// ============================================
// KILL SWITCH: Verificar si hay limpieza forzada
// ============================================
async function checkKillSwitch() {
    try {
        var response = await fetch(KILL_SWITCH_URL, {
            headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrY2N5amVna2dqendveHl0bnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTY0MDAsImV4cCI6MjA2NTI3MjQwMH0.XXXXXXXXXXXXXXXX' }
        });
        var data = await response.json();
        if (data && data.length > 0 && data[0].value === 'true') {
            console.log('SW: Kill switch activado - limpiando caché');
            var keys = await caches.keys();
            await Promise.all(keys.map(function(key) { return caches.delete(key); }));
            return true;
        }
    } catch (e) {
        console.log('SW: Kill switch check failed', e);
    }
    return false;
}

self.addEventListener('install', function(event) {
    event.waitUntil(
        checkKillSwitch().then(function(cleared) {
            if (!cleared) {
                return caches.open(CACHE_NAME).then(function(cache) {
                    console.log('SW: Caching v12...');
                    return Promise.all(
                        urlsToCache.map(function(url) {
                            return cache.add(url).catch(function(err) {
                                console.log('SW: Skip cache for', url);
                            });
                        })
                    );
                });
            }
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
        }).then(function() {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;

    var url = new URL(event.request.url);
    if (url.hostname !== self.location.hostname) return;

    if (url.search.includes('?p=') || url.search.includes('&q=')) return;

    event.respondWith(
        fetch(event.request).then(function(response) {
            if (response && response.status === 200 && response.type === 'basic') {
                var responseClone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseClone).catch(function(){});
                });
            }
            return response;
        }).catch(function() {
            return caches.match(event.request).then(function(cached) {
                if (cached) return cached;
                if (event.request.mode === 'navigate') {
                    return caches.match(BASE_PATH + 'index.html');
                }
                return new Response('Offline', { status: 503 });
            });
        })
    );
});

// ============================================
// WEB PUSH (preparado para futuro)
// ============================================
self.addEventListener('push', function(event) {
    if (!event.data) return;
    var data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title || 'Alliance Hub', {
            body: data.body || '',
            icon: BASE_PATH + 'assets/icons/icon-192x192.png',
            badge: BASE_PATH + 'assets/icons/icon-72x72.png',
            tag: data.tag || 'alliance-hub',
            data: { url: data.url || BASE_PATH, game_id: data.game_id }
        })
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    var url = event.notification.data?.url || BASE_PATH;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url === url && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});