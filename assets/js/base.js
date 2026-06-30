// assets/js/base.js
// Utilidades compartidas, UI helpers, navegacion
// NOTA: Supabase se inicializa en config.js (window.supabase = cliente)

// ============================================
// CLIENTE SUPABASE - usar el ya inicializado por config.js
// config.js hace: window.supabase = window.supabase.createClient(...)
// Entonces window.supabase YA ES el cliente listo para usar.
// ============================================
var supabase = window.supabase || null;

// Fallback: si config.js no cargo todavia, esperar al DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    if (!supabase) {
        supabase = window.supabase || null;
    }
    renderAdminNav();
});

// ============================================
// UI: TOAST
// ============================================
function showToast(message, type) {
    type = type || 'info';
    var colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500 text-slate-900',
        info: 'bg-blue-500'
    };
    var color = colors[type] || colors.info;

    var existing = document.getElementById('toast-container');
    if (!existing) {
        existing = document.createElement('div');
        existing.id = 'toast-container';
        existing.className = 'fixed bottom-4 right-4 z-[9999] space-y-2';
        document.body.appendChild(existing);
    }

    var toast = document.createElement('div');
    toast.className = color + ' text-white px-4 py-3 rounded-lg shadow-lg text-sm font-bold animate-fade-in max-w-sm';
    toast.textContent = message;
    if (type === 'warning') toast.classList.add('text-slate-900');

    existing.appendChild(toast);
    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 3000);
}

// ============================================
// UI: LOADING
// ============================================
function showLoading(elementId) {
    var el = document.getElementById(elementId);
    if (el) el.innerHTML = '<div class="text-center py-8 text-slate-400"><div class="animate-spin inline-block text-2xl mb-2">&#9203;</div><p>Cargando...</p></div>';
}

// ============================================
// UI: CONFIRM
// ============================================
function confirmAction(message) {
    return confirm(message || '\u00bfEstas seguro?');
}

// ============================================
// FORMATTERS
// ============================================
function formatDate(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ============================================
// BADGES
// ============================================
function getStatusBadge(status) {
    var map = {
        draft: '<span class="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-bold">BORRADOR</span>',
        open: '<span class="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-bold">ABIERTA</span>',
        in_progress: '<span class="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-bold">EN CURSO</span>',
        finished: '<span class="px-2 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 font-bold">FINALIZADA</span>',
        archived: '<span class="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 font-bold">ARCHIVADA</span>'
    };
    return map[status] || '<span class="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">' + (status || '?') + '</span>';
}

function getTypeBadge(type) {
    var map = {
        internal: '<span class="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 font-bold">INTERNA</span>',
        duel: '<span class="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-bold">DUELO</span>',
        public_31: '<span class="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-bold">PUBLICA 31</span>',
        public_500: '<span class="px-2 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 font-bold">EVENTO 500</span>',
        public_quick: '<span class="px-2 py-0.5 rounded text-[10px] bg-cyan-100 text-cyan-700 font-bold">RAPIDA</span>'
    };
    return map[type] || '<span class="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">' + (type || '?') + '</span>';
}

function getStatusBadgePlayer(status) {
    if (status === 'active') return '<span class="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-bold">ACTIVO</span>';
    if (status === 'banned') return '<span class="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-bold">BANEADO</span>';
    if (status === 'suspended') return '<span class="px-2 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-700 font-bold">SUSPENDIDO</span>';
    return '<span class="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">' + (status || '?') + '</span>';
}

// ============================================
// NAV: Admin Navigation v3.4
// ============================================
function renderAdminNav() {
    var nav = document.getElementById('admin-nav');
    if (!nav) return;

    var isPlayer = hasPlayerSession();
    var isAdmin = hasAdminSession();
    var role = window.__adminRole || '';

    if (document.body.getAttribute('data-role') !== 'admin') {
        if (isAdmin) {
            nav.innerHTML =
                '<nav class="bg-slate-800 border-b border-slate-700">' +
                    '<div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">' +
                        '<div class="flex items-center gap-4 flex-wrap">' +
                            '<a href="index.html" class="text-amber-400 font-bold text-sm">\u2694\ufe0f Alliance Hub</a>' +
                            '<a href="matches.html" class="text-slate-300 hover:text-white text-sm">Partidas</a>' +
                            '<a href="players.html" class="text-slate-300 hover:text-white text-sm">Jugadores</a>' +
                            '<a href="alliances.html" class="text-slate-300 hover:text-white text-sm">Alianzas</a>' +
                            '<a href="rankings.html" class="text-slate-300 hover:text-white text-sm">Rankings</a>' +
                            '<a href="admins.html" class="text-slate-300 hover:text-white text-sm">Admins</a>' +
                            '<a href="strikes.html" class="text-slate-300 hover:text-white text-sm">\u26a1 Strikes</a>' +
                            '<a href="chat.html" class="text-slate-300 hover:text-white text-sm">Chat</a>' +
                        '</div>' +
                        '<div class="flex items-center gap-2 flex-wrap">' +
                            (isPlayer ? '<a href="../index.html" class="px-3 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-500">\ud83c\udfae Modo Jugador</a>' : '') +
                            '<span class="text-slate-400 text-xs">' + (role || 'admin') + '</span>' +
                            '<button onclick="adminLogout()" class="text-red-400 hover:text-red-300 text-xs font-bold">Cerrar sesion</button>' +
                        '</div>' +
                    '</div>' +
                '</nav>';
        }
        return;
    }

    var links = [
        { href: 'matches.html', text: 'Partidas' },
        { href: 'players.html', text: 'Jugadores' },
        { href: 'alliances.html', text: 'Alianzas' },
        { href: 'rankings.html', text: 'Rankings' },
        { href: 'admins.html', text: 'Admins' },
        { href: 'import.html', text: 'Importar' },
        { href: 'strikes.html', text: '\u26a1 Strikes' },
        { href: 'chat.html', text: 'Chat' }
    ];

    var linksHtml = links.map(function(l) {
        return '<a href="' + l.href + '" class="text-slate-300 hover:text-white text-sm font-medium transition">' + l.text + '</a>';
    }).join('');

    var switchBtn = '';
    if (isPlayer) {
        switchBtn = '<a href="../index.html" class="px-3 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-500 transition">\ud83c\udfae Modo Jugador</a>';
    }

    nav.innerHTML =
        '<nav class="bg-slate-800 border-b border-slate-700">' +
            '<div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">' +
                '<div class="flex items-center gap-4 flex-wrap">' +
                    '<a href="index.html" class="text-amber-400 font-bold text-sm hover:text-amber-300">\u2694\ufe0f Alliance Hub</a>' +
                    linksHtml +
                '</div>' +
                '<div class="flex items-center gap-2 flex-wrap">' +
                    switchBtn +
                    '<span class="text-slate-400 text-xs px-2 py-0.5 bg-slate-700 rounded">' + (role || 'admin') + '</span>' +
                    '<button onclick="adminLogout()" class="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-0.5">Cerrar sesion</button>' +
                '</div>' +
            '</div>' +
        '</nav>';
}

// ============================================
// CACHE CLEAR
// ============================================
function clearAppCache() {
    nuclearCacheClear();
}

function nuclearCacheClear() {
    showToast('Limpiando todo el cache...', 'warning');

    var steps = [];

    if ('serviceWorker' in navigator) {
        steps.push(
            navigator.serviceWorker.getRegistrations().then(function(regs) {
                return Promise.all(regs.map(function(r) {
                    console.log('[Nuclear] Desregistrando SW:', r.scope);
                    return r.unregister();
                }));
            })
        );
    }

    if ('caches' in window) {
        steps.push(
            caches.keys().then(function(names) {
                return Promise.all(names.map(function(n) {
                    console.log('[Nuclear] Borrando cache:', n);
                    return caches.delete(n);
                }));
            })
        );
    }

    localStorage.removeItem('ah_sw_version');
    localStorage.removeItem('ah_v2_app_installed');

    Promise.all(steps).then(function() {
        showToast('Cache limpiado. Recargando...', 'success');
        setTimeout(function() {
            var buster = Date.now();
            var url = location.pathname + '?nuclear=' + buster;
            location.href = url;
        }, 800);
    }).catch(function() {
        location.href = location.pathname + '?nuclear=' + Date.now();
    });
}
