// service-worker.js v2 - Con Push Notifications + Kill Switch
const CACHE_NAME = 'alliance-hub-v2';

// Usar el anon key de config.js (se inyecta al cargar)
// Fallback: leer de window si está disponible, sino hardcodear
const SUPABASE_ANON_KEY = 'sb_publishable_-BBqDHD9LrMiPrk6CihrKA_8p_ABQCK';
const SUPABASE_URL = 'https://qkccyjegkgjzwoxytnqp.supabase.co';
const KILL_SWITCH_URL = SUPABASE_URL + '/rest/v1/app_settings?select=value&key=eq.force_clear_cache';

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
    BASE_PATH + 'login-player.html',
    BASE_PATH + 'reset-password.html',
    BASE_PATH + '404.html',
    BASE_PATH + 'manifest.json',
    BASE_PATH + 'assets/js/base.js',
    BASE_PATH + 'assets/js/auth.js',
    BASE_PATH + 'assets/js/config.js',
    BASE_PATH + 'assets/js/pwa-utils.js',
    BASE_PATH + 'assets/css/style.css',
    BASE_PATH + 'assets/icons/icon-192x192.svg',
    BASE_PATH + 'assets/icons/icon-512x512.svg'
];

async function checkKillSwitch() {
    try {
        var response = await fetch(KILL_SWITCH_URL, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
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
                    console.log('SW: Caching v2...');
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
// WEB PUSH - Mostrar notificación
// ============================================
self.addEventListener('push', function(event) {
    if (!event.data) return;

    var data = event.data.json();

    event.waitUntil(
        self.registration.showNotification(data.title || 'Alliance Hub', {
            body: data.body || '',
            icon: data.icon || BASE_PATH + 'assets/icons/icon-192x192.svg',
            badge: data.badge || BASE_PATH + 'assets/icons/icon-192x192.svg',
            tag: data.tag || 'alliance-hub',
            data: data.data || { url: BASE_PATH },
            actions: [
                { action: 'open', title: 'Ver partida' },
                { action: 'close', title: 'Cerrar' }
            ]
        })
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.action === 'close') return;

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
