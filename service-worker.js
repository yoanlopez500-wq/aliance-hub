// service-worker.js v10 - Alliance Hub PWA
// FIX v10: Sin Supabase hardcoded, fetch filtering correcto, iconos PNG
const CACHE_NAME = 'alliance-hub-v10';

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
    BASE_PATH + 'game.html',
    BASE_PATH + 'player.html',
    BASE_PATH + 'login-player.html',
    BASE_PATH + '404.html',
    BASE_PATH + 'manifest.json',
    BASE_PATH + 'assets/js/base.js',
    BASE_PATH + 'assets/js/auth.js',
    BASE_PATH + 'assets/js/config.js',
    BASE_PATH + 'assets/js/pwa-utils.js',
    BASE_PATH + 'assets/icons/icon-192x192.png',
    BASE_PATH + 'assets/icons/icon-512x512.png'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            console.log('[SW v10] Cache abierto');
            return Promise.all(
                urlsToCache.map(function(url) {
                    return cache.add(url).catch(function(err) {
                        console.log('[SW v10] Skip cache:', url);
                    });
                })
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
                        console.log('[SW v10] Borrando cache viejo:', cacheName);
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

    // No interceptar peticiones a otros origenes (Supabase, CDNs, etc)
    if (url.origin !== self.location.origin) return;

    // No interceptar API de Supabase
    if (url.pathname.includes('/rest/') ||
        url.pathname.includes('/auth/') ||
        url.pathname.includes('/storage/') ||
        url.pathname.includes('/realtime/')) return;

    // No cachear paginas de admin - siempre fresh
    if (url.pathname.includes('/admin/')) return;

    // No cachear paginas de registro
    if (url.pathname.includes('/register/')) return;

    event.respondWith(
        caches.match(event.request).then(function(cached) {
            // Si esta en cache, devolverlo y refrescar en background
            var fetchPromise = fetch(event.request, { cache: 'no-store' })
                .then(function(networkResponse) {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        var responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, responseClone).catch(function(){});
                        });
                    }
                    return networkResponse;
                })
                .catch(function() {
                    // Si falla la red y no hay cache, devolver offline
                    if (cached) return cached;
                    if (event.request.mode === 'navigate') {
                        return caches.match(BASE_PATH + 'index.html');
                    }
                    return new Response('Offline', { status: 503 });
                });

            return cached || fetchPromise;
        })
    );
});

self.addEventListener('push', function(event) {
    if (!event.data) return;
    try {
        var data = event.data.json();
    } catch (e) {
        var data = { title: 'Alliance Hub', body: event.data.text() };
    }
    event.waitUntil(
        self.registration.showNotification(data.title || 'Alliance Hub', {
            body: data.body || '',
            icon: data.icon || BASE_PATH + 'assets/icons/icon-192x192.png',
            badge: data.badge || BASE_PATH + 'assets/icons/icon-72x72.png',
            tag: data.tag || 'alliance-hub',
            data: data.data || { url: BASE_PATH },
            actions: [
                { action: 'open', title: 'Ver' },
                { action: 'close', title: 'Cerrar' }
            ]
        })
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.action === 'close') return;
    var url = event.notification.data && event.notification.data.url ? event.notification.data.url : BASE_PATH;
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
