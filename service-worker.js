// service-worker.js v16 - Alliance Hub PWA
// Network-first: SIEMPRE intenta red primero. Nunca sirve HTML/JS/CSS viejo.
const CACHE_NAME = 'alliance-hub-v16';
var BASE_PATH = (function() {
    var path = self.location.pathname;
    var parts = path.split('/').filter(function(p) { return p.length > 0; });
    if (parts.length >= 1 && !parts[0].includes('.') && parts[0].length > 0) return '/' + parts[0] + '/';
    return '/';
})();
var STATIC_ASSETS = [ BASE_PATH + 'assets/icons/icon-192x192.png', BASE_PATH + 'assets/icons/icon-512x512.png' ];
self.addEventListener('install', function(event) {
    event.waitUntil(caches.open(CACHE_NAME).then(function(cache) { return Promise.all(STATIC_ASSETS.map(function(url) { return cache.add(url).catch(function(err) {})); }));
    self.skipWaiting();
});
self.addEventListener('activate', function(event) {
    event.waitUntil(caches.keys().then(function(cacheNames) { return Promise.all(cacheNames.map(function(cacheName) { if (cacheName !== CACHE_NAME) return caches.delete(cacheName); })); }).then(function() { return self.clients.claim(); }));
});
self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;
    var url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.includes('/rest/') || url.pathname.includes('/auth/') || url.pathname.includes('/storage/') || url.pathname.includes('/realtime/')) return;
    var isDynamic = /\.(html|js|css)$/.test(url.pathname);
    if (isDynamic) {
        event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(function() { return caches.match(event.request); }));
        return;
    }
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(function(networkResponse) { if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') { var responseClone = networkResponse.clone(); caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, responseClone).catch(function(){}); }); } return networkResponse; }).catch(function() { return caches.match(event.request); }));
});
self.addEventListener('push', function(event) {
    if (!event.data) return;
    try { var data = event.data.json(); } catch (e) { var data = { title: 'Alliance Hub', body: event.data.text() }; }
    event.waitUntil(self.registration.showNotification(data.title || 'Alliance Hub', { body: data.body || '', icon: data.icon || BASE_PATH + 'assets/icons/icon-192x192.png', badge: data.badge || BASE_PATH + 'assets/icons/icon-72x72.png', tag: data.tag || 'alliance-hub', data: data.data || { url: BASE_PATH + 'dashboard.html' }, actions: [ { action: 'open', title: 'Ver' }, { action: 'close', title: 'Cerrar' } ] }));
});
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.action === 'close') return;
    var url = event.notification.data && event.notification.data.url ? event.notification.data.url : BASE_PATH + 'dashboard.html';
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) { for (var i = 0; i < clientList.length; i++) { var client = clientList[i]; if (client.url === url && 'focus' in client) return client.focus(); } if (clients.openWindow) return clients.openWindow(url); }));
});
