// assets/js/base.js v13 - Alliance Hub utilities + Session persistence
// Depends on: config.js

window.__AH_BASE_PATH = (function() {
    var parts = window.location.pathname.split('/').filter(function(p) { return p.length > 0; });
    // Admin/chat/register subfolders: base is root (hrefs already include the subfolder)
    if (parts.length >= 1 && (parts[0] === 'admin' || parts[0] === 'chat' || parts[0] === 'register')) {
        return '/';
    }
    // Subfolder deployments (e.g. /aliance-hub/)
    if (parts.length >= 1) {
        var knownPages = ['index.html','login.html','login-player.html','rankings.html','game.html','player.html','dashboard.html','reset-password.html','chat.html','404.html','manifest.json','assets','register','service-worker.js','course','landing.html','leader-dashboard.html','alliance-panel.html'];
        if (knownPages.indexOf(parts[0]) === -1) return '/' + parts[0] + '/';
    }
    if (parts.length >= 2) return '/' + parts[0] + '/';
    return '/';
})();

window.ahPath = function(relative) {
    var base = window.__AH_BASE_PATH;
    if (base === '/') return '/' + relative;
    return base + relative;
};

// ---- Utilities ----
function formatDate(d) {
    if (!d) return '-';
    var date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function getStatusBadge(status) {
    var map = {
        open: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(76,175,80,0.15);color:#4caf50;">ABIERTA</span>',
        in_progress: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(33,150,243,0.15);color:#2196f3;">EN CURSO</span>',
        finished: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(156,39,176,0.15);color:#ce93d8;">FINALIZADA</span>',
        archived: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(120,144,156,0.15);color:#78909c;">ARCHIVADA</span>',
        draft: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,143,0,0.15);color:#ff8f00;">BORRADOR</span>',
        pending: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,143,0,0.15);color:#ff8f00;">PENDIENTE</span>',
        confirmed: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(76,175,80,0.15);color:#4caf50;">CONFIRMADO</span>',
        active: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(76,175,80,0.15);color:#4caf50;">ACTIVO</span>',
        suspended: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(239,83,80,0.15);color:#ef5350;">SUSPENDIDO</span>',
        approved: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(76,175,80,0.15);color:#4caf50;">APROBADO</span>',
        rejected: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(198,40,40,0.15);color:#ef5350;">RECHAZADO</span>'
    };
    return map[status] || '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,255,255,0.05);color:#9fa8da;">' + (status || '-') + '</span>';
}
function getTypeBadge(type) {
    var map = {
        duel: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(198,40,40,0.15);color:#ef5350;">DUELO</span>',
        internal: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(33,150,243,0.15);color:#2196f3;">INTERNA</span>',
        tournament: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(156,39,176,0.15);color:#ce93d8;">TORNEO</span>',
        public_31: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(0,150,136,0.15);color:#009688;">PUBLICA 31</span>',
        public_500: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(0,150,136,0.15);color:#009688;">EVENTO 500</span>',
        public_quick: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(0,150,136,0.15);color:#009688;">RAPIDA</span>'
    };
    return map[type] || '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,255,255,0.05);color:#9fa8da;">' + (type || '-') + '</span>';
}
function getPlayerStatusBadge(status) {
    var map = {
        active: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(76,175,80,0.15);color:#4caf50;">ACTIVO</span>',
        suspended: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,143,0,0.15);color:#ff8f00;">SUSPENDIDO</span>',
        banned: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(198,40,40,0.15);color:#ef5350;">BANEADO</span>'
    };
    return map[status] || '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,255,255,0.05);color:#9fa8da;">' + (status || '-') + '</span>';
}
function showToast(message, type) {
    var el = document.createElement('div');
    var colors = { success: '#4caf50', error: '#ef5350', warning: '#ff8f00', info: '#2196f3' };
    el.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:700;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.3);transform:translateY(100px);transition:transform 0.3s ease;background:' + (colors[type] || colors.info) + ';';
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(function() { el.style.transform = 'translateY(0)'; });
    setTimeout(function() { el.style.transform = 'translateY(100px)'; setTimeout(function() { el.remove(); }, 300); }, 3000);
}
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- Player Session (localStorage) ----
function getPlayerData() {
    try {
        var id = localStorage.getItem('ah_v2_player_id');
        var token = localStorage.getItem('ah_v2_player_token');
        if (!id || !token) return null;
        return { playerId: id, token: token, displayName: localStorage.getItem('ah_v2_player_name') || '' };
    } catch(e) { return null; }
}
function clearPlayerData() {
    localStorage.removeItem('ah_v2_player_id');
    localStorage.removeItem('ah_v2_player_token');
    localStorage.removeItem('ah_v2_player_name');
}
function getModePreference() {
    try { return localStorage.getItem('ah_v2_mode'); } catch(e) { return null; }
}
function setModePreference(mode) {
    try { localStorage.setItem('ah_v2_mode', mode); } catch(e) {}
}
function clearModePreference() {
    try { localStorage.removeItem('ah_v2_mode'); } catch(e) {}
}

// ---- Auto-hide nav on mobile ----
document.addEventListener('click', function(e) {
    var nav = document.getElementById('mobile-nav');
    if (nav && nav.classList.contains('open') && !nav.contains(e.target) && (!e.target.closest || !e.target.closest('#mobile-menu-btn'))) {
        nav.classList.remove('open');
    }
});
