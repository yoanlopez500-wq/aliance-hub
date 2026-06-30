// assets/js/auth.js v3.4
// Autenticacion dual: Admin (Supabase Auth) + Jugador (localStorage lazy login)
// + Session persistence + PWA support + bfcache handling

// ============================================
// PLAYER SESSION (localStorage + sessionStorage para PWA)
// ============================================
function getPlayerData() {
    try {
        var raw = localStorage.getItem('ah_v2_player');
        if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    var pid = localStorage.getItem('ah_v2_player_id');
    var name = localStorage.getItem('ah_v2_player_name');
    if (pid) return { playerId: parseInt(pid), username: name || '' };
    return { playerId: null, username: '' };
}

function hasPlayerSession() {
    return !!localStorage.getItem('ah_v2_player_id');
}

function savePlayerSession(playerId, username) {
    var data = { playerId: parseInt(playerId), username: username || '', savedAt: Date.now() };
    localStorage.setItem('ah_v2_player_id', playerId);
    localStorage.setItem('ah_v2_player_name', username || '');
    localStorage.setItem('ah_v2_player', JSON.stringify(data));
    // Tambien en sessionStorage para bfcache
    try { sessionStorage.setItem('ah_v2_player_snapshot', JSON.stringify(data)); } catch(e) {}
}

function clearPlayerSession() {
    localStorage.removeItem('ah_v2_player_id');
    localStorage.removeItem('ah_v2_player_name');
    localStorage.removeItem('ah_v2_player');
    try { sessionStorage.removeItem('ah_v2_player_snapshot'); } catch(e) {}
}

// ============================================
// ADMIN SESSION (Supabase Auth)
// ============================================
function hasAdminSession() {
    try {
        var key = 'sb-' + (__AH_SUPABASE_URL ? __AH_SUPABASE_URL.split('//')[1].split('.')[0] : '') + '-auth-token';
        return !!localStorage.getItem(key);
    } catch(e) { return false; }
}

async function getAdminRole() {
    try {
        var { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;
        var { data: admin } = await supabase.from('admin_users').select('role').eq('id', session.user.id).single();
        return admin || null;
    } catch(e) { return null; }
}

function adminLogout() {
    supabase.auth.signOut().then(function() {
        window.__adminRole = '';
        showToast('Sesion de admin cerrada', 'info');
        setTimeout(function() { window.location.href = '../index.html'; }, 500);
    });
}

// ============================================
// DUAL SESSION NAV
// ============================================
function renderFluidNav() {
    // Solo en paginas publicas (no admin)
    if (document.body.getAttribute('data-role') === 'admin') return;

    var isPlayer = hasPlayerSession();
    var isAdmin = hasAdminSession();
    var nav = document.getElementById('admin-nav');
    if (!nav) return;

    var links = [];
    var playerId = localStorage.getItem('ah_v2_player_id');

    // Links de navegacion principal
    links.push({ href: 'index.html', text: '\u2694\ufe0f Alliance Hub', bold: true });
    links.push({ href: 'rankings.html', text: 'Rankings' });
    links.push({ href: 'rules.html', text: '\ud83d\udcdc Reglas' });
    links.push({ href: 'game.html', text: '\ud83c\udfae Partidas' });
    if (isPlayer) {
        links.push({ href: 'player.html?id=' + playerId, text: '\ud83d\udc64 Mi Perfil' });
    }

    // Auth buttons
    var authButtons = '';
    if (isPlayer && isAdmin) {
        // Dual: mostrar switch
        authButtons = '<a href="admin/index.html" class="px-3 py-1 bg-purple-600 text-white rounded text-xs font-bold hover:bg-purple-500">\u2699\ufe0f Admin</a>' +
                      '<button onclick="playerLogout()" class="text-red-400 hover:text-red-300 text-xs font-bold">Salir Jugador</button>';
    } else if (isPlayer) {
        authButtons = '<button onclick="playerLogout()" class="text-red-400 hover:text-red-300 text-xs font-bold">Cerrar sesion</button>';
    } else if (isAdmin) {
        authButtons = '<a href="admin/index.html" class="px-3 py-1 bg-purple-600 text-white rounded text-xs font-bold hover:bg-purple-500">\u2699\ufe0f Admin</a>' +
                      '<button onclick="adminLogout()" class="text-red-400 hover:text-red-300 text-xs font-bold">Salir Admin</button>';
    } else {
        authButtons = '<a href="login-player.html" class="px-3 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-500">\ud83c\udfae Entrar</a>' +
                      '<a href="admin/login.html" class="px-3 py-1 bg-slate-600 text-white rounded text-xs font-bold hover:bg-slate-500">\u2699\ufe0f Admin</a>';
    }

    var linksHtml = links.map(function(l) {
        return '<a href="' + l.href + '" class="text-slate-300 hover:text-white text-sm ' + (l.bold ? 'font-bold' : 'font-medium') + ' transition">' + l.text + '</a>';
    }).join('');

    nav.innerHTML =
        '<nav class="bg-slate-800 border-b border-slate-700">' +
            '<div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">' +
                '<div class="flex items-center gap-4 flex-wrap">' + linksHtml + '</div>' +
                '<div class="flex items-center gap-2 flex-wrap">' + authButtons + '</div>' +
            '</div>' +
        '</nav>';
}

function playerLogout() {
    clearPlayerSession();
    showToast('Sesion de jugador cerrada', 'info');
    setTimeout(function() { window.location.reload(); }, 500);
}

// ============================================
// ROLE HELPERS
// ============================================
function requireAdmin() {
    if (!hasAdminSession()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

async function getAdminRole() {
    try {
        var { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;
        var { data: admin } = await supabase.from('admin_users').select('role').eq('id', session.user.id).single();
        return admin || null;
    } catch(e) { return null; }
}

// ============================================
// BFCACHE HANDLER (PWA session persistence)
// ============================================
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        // Pagina restaurada desde bfcache
        var snap = sessionStorage.getItem('ah_v2_player_snapshot');
        if (snap) {
            try {
                var data = JSON.parse(snap);
                if (data.playerId) {
                    localStorage.setItem('ah_v2_player_id', data.playerId);
                    localStorage.setItem('ah_v2_player_name', data.username || '');
                    localStorage.setItem('ah_v2_player', JSON.stringify(data));
                }
            } catch(e) {}
        }
        renderAdminNav();
    }
});

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

    // Modo admin (data-role="admin")
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
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Restaurar sesion desde sessionStorage si existe (para bfcache)
    try {
        var snapshot = sessionStorage.getItem('ah_v2_player_snapshot');
        if (snapshot && !hasPlayerSession()) {
            var data = JSON.parse(snapshot);
            if (data && data.playerId) savePlayerSession(data.playerId, data.username);
        }
    } catch(e) {}

    renderFluidNav();

    // Detectar navegacion entre paginas
    window.addEventListener('pageshow', function(e) {
        if (e.persisted) {
            // Pagina restaurada desde bfcache - re-verificar sesiones
            renderFluidNav();
        }
    });
});
