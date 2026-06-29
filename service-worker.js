const CACHE_NAME = 'alliance-hub-v15';
const BASE_PATH = (() => {
  const parts = self.location.pathname.split('/');
  parts.pop();
  return parts.join('/') + '/';
})();
const BASE_LENGTH = BASE_PATH.length;
const CORE_ASSETS = [
  BASE_PATH + 'index.html',
  BASE_PATH + 'login.html',
  BASE_PATH + 'login-player.html',
  BASE_PATH + 'assets/js/theme.js?v=15',
  BASE_PATH + 'assets/js/base.js?v=15',
  BASE_PATH + 'assets/js/auth.js?v=15',
  BASE_PATH + 'assets/js/config.js?v=15',
  BASE_PATH + 'assets/js/pwa-utils.js?v=15',
  'https://cdn.tailwindcss.com'
];
const HTML_FILES = new Set([
  'index.html',
  'login.html',
  'login-player.html',
  'dashboard.html',
  'rankings.html',
  'player.html',
  'report.html',
  'rules.html',
  'chat.html',
  'game.html',
  'apply-leader.html',
  'leader-dashboard.html',
  'admin/index.html',
  'admin/matches.html',
  'admin/players.html',
  'admin/strikes.html',
  'admin/reports.html',
  'admin/alliances.html',
  'admin/admins.html',
  'admin/invites.html',
  'admin/import.html',
  'admin/leagues.html',
  'admin/chat-reports.html',
  'admin/match-detail.html',
  'admin/game-detail.html',
  'admin/games.html',
  'admin/duel-manager.html',
  'admin/inbox.html',
  'admin/sanctions-engine.html',
  'admin/alliance-members.html',
  'admin/certifications.html',
  'admin/leader-requests.html',
  'admin/officers.html',
  'admin/rules-editor.html'
]);

self.addEventListener('install', (event) => {
  console.log('[SW v15] Instalando...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW v15] Borrando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const path = url.pathname.substring(BASE_LENGTH);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !CORE_ASSETS.includes(request.url)) return;

  const isHTML = HTML_FILES.has(path);
  const isCore = CORE_ASSETS.includes(request.url);
  const isCacheable = isHTML || isCore || path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.png') || path.endsWith('.ico') || path.endsWith('.json');

  if (!isCacheable) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);

      if (isHTML && cached) {
        console.log('[SW v15] Skip cache para HTML:', path);
        return fetch(request).catch(() => cached);
      }

      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        console.log('[SW v15] Offline:', path);
        return cached || new Response('Sin conexion. Intenta mas tarde.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'clear-cache') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW v15] Cache borrado manualmente');
      event.source.postMessage('cache-cleared');
    });
  }
});
