// assets/js/auth.js v3.1 - Session persistence + Fluid mode
// Depende de base.js (window.__AH_BASE_PATH, ahPath, getPlayerData, setPlayerData, clearPlayerData)

var ROLE_HIERARCHY = {
    superadmin: 4,
    event_admin: 3,
    alliance_leader: 2,
    moderator: 1
};

function canManage(myRole, targetRole) {
    if (myRole === targetRole) return false;
    return ROLE_HIERARCHY[myRole] > ROLE_HIERARCHY[targetRole];
}

function canView(myRole, targetRole) {
    if (myRole === 'superadmin') return true;
    if (myRole === 'event_admin') return targetRole !== 'superadmin';
    if (myRole === 'alliance_leader') return targetRole === 'moderator' || targetRole === 'alliance_leader';
    return false;
}

async function isAdmin() {
    var sessionData = await supabase.auth.getSession();
    return !!sessionData.data.session;
}

async function getAdminRole() {
    var sessionData = await supabase.auth.getSession();
    if (!sessionData.data.session) return null;
    var { data: admin } = await supabase.from('admin_users')
        .select('role, alliance_id, status, display_name, supremacy_player_id')
        .eq('id', sessionData.data.session.user.id)
        .single();
    return admin;
}

async function login(email, password) {
    var result = await supabase.auth.signInWithPassword({ email: email, password: password });
    if (result.error) { console.error('Login error:', result.error); return false; }
    return true;
}

async function sendPasswordReset(email) {
    var { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.__AH_BASE_PATH + 'reset-password.html'
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Revisa tu email para el enlace de recuperacion' };
}

async function updatePassword(newPassword) {
    var { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Contrasena actualizada' };
}

async function signupWithInvite(email, password, inviteCode, supremacyId, displayName) {
    var normalizedCode = inviteCode.trim().toUpperCase();
    var inviteResult = await supabase.from('admin_invites').select('*').eq('code', normalizedCode).eq('used', false);
    if (inviteResult.error) return { success: false, message: 'Error verificando codigo: ' + inviteResult.error.message };
    if (!inviteResult.data || inviteResult.data.length === 0) return { success: false, message: 'Codigo de invitacion invalido o ya usado' };
    var invite = inviteResult.data[0];
    if (new Date(invite.expires_at) < new Date()) return { success: false, message: 'Codigo de invitacion expirado' };

    var { data: player } = await supabase.from('players').select('id, current_username').eq('id', parseInt(supremacyId)).single();
    if (!player) {
        var { error: insertPlayerError } = await supabase.from('players').insert({ id: parseInt(supremacyId), current_username: displayName, status: 'active' });
        if (insertPlayerError) return { success: false, message: 'Error creando jugador: ' + insertPlayerError.message };
    }

    var authResult = await supabase.auth.signInWithPassword({ email: email, password: password });
    if (authResult.error) return { success: false, message: authResult.error.message };

    await supabase.from('admin_users').insert({
        id: authResult.data.user.id, role: invite.role, display_name: displayName,
        supremacy_player_id: parseInt(supremacyId), approved_by: invite.created_by,
        approved_at: new Date().toISOString(), status: 'active'
    });
    await supabase.from('admin_invites').update({ used: true, used_by: authResult.data.user.id, used_at: new Date().toISOString() }).eq('id', invite.id);
    return { success: true, message: 'Cuenta creada. Ya puedes iniciar sesion.' };
}

// ====== LOGOUT: SOLO cierra la sesion activa, NO borra la otra ======
async function logout() {
    // Solo cierra sesion de Supabase Auth (admin)
    // NO toca la sesion de jugador en localStorage
    if (window.__ahNotifInterval) { clearInterval(window.__ahNotifInterval); window.__ahNotifInterval = null; }
    await supabase.auth.signOut();
    // Si hay sesion de jugador, ir a dashboard (modo jugador)
    // Si no hay sesion de jugador, ir a login
    if (hasPlayerSession()) {
        window.location.href = ahPath('dashboard.html');
    } else {
        window.location.href = ahPath('login.html');
    }
}

async function switchToPlayerMode() {
    if (!hasPlayerSession()) { window.location.href = ahPath('login-player.html'); return; }
    window.location.href = ahPath('dashboard.html');
}

async function switchToAdminMode() {
    var admin = await getAdminRole();
    if (!admin) { window.location.href = ahPath('login.html'); return; }
    var target = admin.role === 'alliance_leader' ? 'leader-dashboard.html' : 'admin/index.html';
    window.location.href = ahPath(target);
}

async function logoutToPlayerMode() { await switchToPlayerMode(); }

// ====== PLAYER LOGOUT: Solo borra datos de jugador, NO toca admin ======
function playerLogout() {
    if (typeof clearPlayerData === 'function') clearPlayerData();
    // Si tiene sesion de admin, ir al dashboard de admin
    // Si no, ir al index
    isAdmin().then(function(isAdmin) {
        if (isAdmin) window.location.href = ahPath('admin/index.html');
        else window.location.href = ahPath('index.html');
    });
}

// ====== LOGOUT TOTAL: Borra TODO ======
async function logoutAll() {
    if (window.__ahNotifInterval) { clearInterval(window.__ahNotifInterval); window.__ahNotifInterval = null; }
    if (typeof clearPlayerData === 'function') clearPlayerData();
    await supabase.auth.signOut();
    window.location.href = ahPath('index.html');
}

async function requireAdmin() {
    var sessionData = await supabase.auth.getSession();
    if (!sessionData.data.session) { window.location.href = ahPath('login.html'); return; }
    var admin = await getAdminRole();
    if (admin && admin.status === 'suspended') {
        if (typeof showToast === 'function') showToast('Tu cuenta ha sido suspendida. Contacta al superadmin.', 'error');
        await supabase.auth.signOut();
        window.location.href = ahPath('login.html');
    }
}

async function requireRole(roles) {
    var admin = await getAdminRole();
    if (!admin || roles.indexOf(admin.role) === -1) {
        if (typeof showToast === 'function') showToast('No tienes permiso para acceder aqui', 'error');
        window.location.href = ahPath('index.html');
    }
}

async function requireMinRole(minRole) {
    var admin = await getAdminRole();
    if (!admin || ROLE_HIERARCHY[admin.role] < ROLE_HIERARCHY[minRole]) {
        if (typeof showToast === 'function') showToast('No tienes permiso para acceder aqui', 'error');
        window.location.href = ahPath('index.html');
    }
}

function getRoleBadge(role) {
    var badges = {
        superadmin: '<span class="text-[10px] bg-red-500 text-white px-2 py-1 rounded font-bold">SUPERADMIN</span>',
        event_admin: '<span class="text-[10px] bg-blue-500 text-white px-2 py-1 rounded font-bold">ADMIN EVENTOS</span>',
        alliance_leader: '<span class="text-[10px] bg-green-500 text-white px-2 py-1 rounded font-bold">LIDER</span>',
        moderator: '<span class="text-[10px] bg-purple-500 text-white px-2 py-1 rounded font-bold">MODERADOR</span>'
    };
    return badges[role] || '<span class="text-[10px] bg-slate-500 text-white px-2 py-1 rounded">' + role + '</span>';
}

function hasPlayerSession() { return !!localStorage.getItem('ah_v2_player_id'); }

function hasAdminSession() {
    return supabase.auth.getSession().then(function(r) { return !!r.data.session; });
}

// ===================== NOTIFICACIONES INTERNAS =====================
var __ahNotifCount = 0;
var __ahNotifMessages = [];

function buildNotificationBell() {
    return '<div class="relative" id="ah-notif-wrapper">' +
        '<button onclick="toggleNotifDropdown()" class="relative px-2 py-1.5 rounded hover:bg-slate-700 transition">&#128276;' +
            '<span id="ah-notif-badge" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center hidden">0</span>' +
        '</button>' +
        '<div id="ah-notif-dropdown" class="hidden absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">' +
            '<div class="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">' +
                '<span class="text-sm font-bold text-slate-700">&#128276; Mensajes Directos</span>' +
                '<span id="ah-notif-count-label" class="text-xs text-slate-400">0 sin leer</span></div>' +
            '<div id="ah-notif-list" class="max-h-64 overflow-y-auto"><div class="p-4 text-center text-xs text-slate-400">Cargando...</div></div>' +
            '<div class="p-2 border-t border-slate-100 bg-slate-50 text-center">' +
                '<a href="' + ahPath('admin/inbox.html') + '" class="text-xs text-blue-600 font-bold hover:text-blue-700">Ver todos los mensajes</a></div></div></div>';
}

function toggleNotifDropdown() {
    var dropdown = document.getElementById('ah-notif-dropdown');
    if (!dropdown) return;
    if (dropdown.classList.contains('hidden')) { dropdown.classList.remove('hidden'); renderNotifList(); markVisibleNotifsAsRead(); }
    else { dropdown.classList.add('hidden'); }
}
function closeNotifDropdown() { var d = document.getElementById('ah-notif-dropdown'); if (d) d.classList.add('hidden'); }

async function renderNotifList() {
    var list = document.getElementById('ah-notif-list');
    if (!list) return;
    if (__ahNotifMessages.length === 0) { list.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">No tienes mensajes directos</div>'; return; }
    list.innerHTML = __ahNotifMessages.slice(0, 5).map(function(m) {
        var isUnread = !m.read_at;
        return '<div class="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer ' + (isUnread ? 'bg-blue-50/50' : '') + '" onclick="window.location.href=\'' + ahPath('admin/inbox.html?id=' + m.id) + '\'">' +
            '<div class="flex items-center justify-between mb-1"><span class="text-xs font-bold text-slate-700 truncate max-w-[180px]">' + (m.subject || 'Sin asunto') + '</span><span class="text-[10px] text-slate-400">' + formatDateTime(m.created_at) + '</span></div>' +
            '<p class="text-xs text-slate-500 truncate">' + m.message + '</p><p class="text-[10px] text-slate-400 mt-1">De: ' + (m.sender_name || 'Admin') + '</p></div>';
    }).join('');
}

async function markVisibleNotifsAsRead() {
    var unreadIds = __ahNotifMessages.filter(function(m) { return !m.read_at; }).map(function(m) { return m.id; });
    if (unreadIds.length === 0) return;
    var visibleIds = unreadIds.slice(0, 5);
    for (var i = 0; i < visibleIds.length; i++) { await markDirectMessageAsRead(visibleIds[i]); }
    setTimeout(refreshNotifBadge, 500);
}

async function refreshNotifBadge() {
    try {
        var count = await countUnreadDirectMessages();
        __ahNotifCount = count;
        var badge = document.getElementById('ah-notif-badge');
        var label = document.getElementById('ah-notif-count-label');
        if (badge) { if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.classList.remove('hidden'); } else { badge.classList.add('hidden'); } }
        if (label) label.textContent = count + ' sin leer';
        var messages = await fetchRecentDirectMessages(10);
        __ahNotifMessages = messages || [];
    } catch (e) { console.error('[Notif] Error:', e); }
}

function startNotifPolling() {
    if (window.__ahNotifInterval) clearInterval(window.__ahNotifInterval);
    setTimeout(function() { refreshNotifBadge().catch(function(e) { console.error('[Notif] Init error:', e); }); }, 2000);
    window.__ahNotifInterval = setInterval(function() { refreshNotifBadge().catch(function(e) { console.error('[Notif] Polling error:', e); }); }, 60000);
}

document.addEventListener('click', function(e) { var w = document.getElementById('ah-notif-wrapper'); if (w && !w.contains(e.target)) closeNotifDropdown(); });

// ===================== PANELES POR ROL =====================
var ROLE_PANELS = {
    superadmin: {
        label: 'Super Admin', badgeClass: 'bg-red-500 text-white', icon: '&#128081;',
        navLinks: [
            { href: 'admin/index.html', label: '&#128202; Dashboard', section: 'main' },
            { href: 'admin/matches.html', label: '&#127918; Partidas', section: 'main' },
            { href: 'admin/players.html', label: '&#128100; Jugadores', section: 'main' },
            { href: 'admin/alliances.html', label: '&#127988; Alianzas', section: 'main' },
            { href: 'admin/certifications.html', label: '&#127891; Certificaciones', section: 'main' },
            { href: 'admin/import.html', label: '&#128229; Importar CSV', section: 'tools' },
            { href: 'admin/invites.html', label: '&#128273; Invitar', section: 'tools' },
            { href: 'admin/leagues.html', label: '&#127942; Ligas', section: 'tools' },
            { href: 'admin/admins.html', label: '&#128101; Admins', section: 'tools' },
            { href: 'admin/strikes.html', label: '&#9889; Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '&#128680; Reportes', section: 'tools' },
            { href: 'chat.html', label: '&#128172; Chat', section: 'comms' },
        ],
        quickActions: [
            { label: '&#10133; Nueva Partida', action: 'openMatchModal()', color: 'amber' },
            { label: '&#127891; Ver Cursos', href: 'course/', color: 'blue' },
        ]
    },
    event_admin: {
        label: 'Admin Eventos', badgeClass: 'bg-blue-500 text-white', icon: '&#127919;',
        navLinks: [
            { href: 'admin/index.html', label: '&#128202; Dashboard', section: 'main' },
            { href: 'admin/matches.html', label: '&#127918; Partidas', section: 'main' },
            { href: 'admin/players.html', label: '&#128100; Jugadores', section: 'main' },
            { href: 'admin/alliances.html', label: '&#127988; Alianzas', section: 'main' },
            { href: 'admin/certifications.html', label: '&#127891; Certificaciones', section: 'main' },
            { href: 'admin/import.html', label: '&#128229; Importar CSV', section: 'tools' },
            { href: 'admin/invites.html', label: '&#128273; Invitar', section: 'tools' },
            { href: 'admin/leagues.html', label: '&#127942; Ligas', section: 'tools' },
            { href: 'admin/admins.html', label: '&#128101; Admins', section: 'tools' },
            { href: 'admin/strikes.html', label: '&#9889; Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '&#128680; Reportes', section: 'tools' },
            { href: 'chat.html', label: '&#128172; Chat', section: 'comms' },
        ],
        quickActions: [{ label: '&#10133; Nueva Partida', action: 'openMatchModal()', color: 'amber' }]
    },
    alliance_leader: {
        label: 'Lider de Alianza', badgeClass: 'bg-green-500 text-white', icon: '&#127988;',
        navLinks: [
            { href: 'leader-dashboard.html', label: '&#127968; Mi Alianza', section: 'main' },
            { href: 'admin/matches.html', label: '&#127918; Partidas', section: 'main' },
            { href: 'admin/players.html', label: '&#128100; Jugadores', section: 'main' },
            { href: 'admin/duel-manager.html', label: '&#9876;&#65039; Duelos', section: 'main' },
            { href: 'admin/strikes.html', label: '&#9889; Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '&#128680; Reportes', section: 'tools' },
            { href: 'chat.html', label: '&#128172; Chat', section: 'comms' },
        ],
        quickActions: [
            { label: '&#10133; Crear Partida', action: 'openMatchModal()', color: 'amber' },
            { label: '&#9876;&#65039; Preparar Duelo', href: 'admin/duel-manager.html', color: 'blue' },
        ]
    },
    moderator: {
        label: 'Moderador', badgeClass: 'bg-purple-500 text-white', icon: '&#128737;&#65039;',
        navLinks: [
            { href: 'admin/index.html', label: '&#128202; Dashboard', section: 'main' },
            { href: 'admin/matches.html', label: '&#127918; Partidas', section: 'main' },
            { href: 'admin/players.html', label: '&#128100; Jugadores', section: 'main' },
            { href: 'admin/strikes.html', label: '&#9889; Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '&#128680; Reportes', section: 'tools' },
        ],
        quickActions: [{ label: '&#128220; Ver Reportes', href: 'admin/reports.html', color: 'red' }]
    }
};

// ===================== NAVEGACION MODULAR =====================
async function initAdminNav() {
    var nav = document.getElementById('admin-nav');
    if (!nav) return;

    var sessionData = await supabase.auth.getSession();
    var session = sessionData.data.session;
    var playerData = getPlayerData ? getPlayerData() : {};
    var isPlayer = !!(playerData && playerData.playerId);
    var isAdminPage = document.body.getAttribute('data-role') === 'admin';
    var isLeaderPage = document.body.getAttribute('data-role') === 'alliance_leader';
    var isPublicPage = document.body.getAttribute('data-role') === 'public';

    // ====== ADMIN en pagina admin/leader ======
    if (session && (isAdminPage || isLeaderPage)) {
        var admin = await getAdminRole();
        if (!admin) { /* No redirigir, mostrar nav basico */ }
        else {
            renderAdminNav(nav, session, admin, isPlayer);
            return;
        }
    }

    // ====== JUGADOR logueado en pagina publica ======
    if (isPlayer) {
        renderPlayerNav(nav, playerData, session);
        return;
    }

    // ====== ADMIN logueado en pagina publica (modo fluido) ======
    if (session) {
        renderAdminOnPublicNav(nav, session);
        return;
    }

    // ====== Publico ======
    renderPublicNav(nav);
}

function renderAdminNav(nav, session, admin, isPlayer) {
    var role = admin.role;
    var panel = ROLE_PANELS[role] || ROLE_PANELS.moderator;
    var displayName = admin.display_name || session.user.email;
    var hasAlliance = !!admin.alliance_id;

    var warningBanner = '';
    if (role === 'alliance_leader' && !hasAlliance) {
        warningBanner = '<div class="max-w-7xl mx-auto px-4"><div class="rounded-lg p-3 mb-4 text-center" style="background: rgba(255,143,0,0.1); border: 1px solid rgba(255,143,0,0.2);">' +
            '<p class="text-sm font-medium" style="color: #ff8f00;">&#9888;&#65039; No tienes una alianza asignada. Contacta a un superadmin.</p></div></div>';
    }

    var mainLinks = panel.navLinks.filter(function(l) { return l.section === 'main'; });
    var toolsLinks = panel.navLinks.filter(function(l) { return l.section === 'tools'; });
    var commsLinks = panel.navLinks.filter(function(l) { return l.section === 'comms'; });

    var mkLink = function(l) {
        return '<a href="' + ahPath(l.href) + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap hover:bg-white/10 hover:text-white" style="color: rgba(255,255,255,0.7);">' + l.label + '</a>';
    };

    var mainHTML = mainLinks.map(mkLink).join('');
    var toolsHTML = toolsLinks.map(mkLink).join('');
    var commsHTML = commsLinks.map(mkLink).join('');

    var quickHTML = panel.quickActions.map(function(a) {
        if (a.action) return '<button onclick="' + a.action + '" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: linear-gradient(135deg, #ff6f00, #ff8f00); color: white;">' + a.label + '</button>';
        if (a.href) return '<a href="' + ahPath(a.href) + '" class="px-3 py-1.5 rounded-lg text-xs font-bold transition inline-block" style="background: #1a237e; color: white;">' + a.label + '</a>';
        return '';
    }).join('');

    // Modo fluido: boton "Modo Jugador" si tiene ambas sesiones
    var switchBtn = isPlayer ? '<button onclick="switchToPlayerMode()" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: #2e7d32; color: white;">&#127918; Modo Jugador</button>' : '';

    // Salir: dropdown para elegir salir como admin o salir de todo
    var logoutHTML = '<div class="relative group">' +
        '<button class="px-3 py-1.5 rounded-lg text-xs font-bold transition" style="background: rgba(198,40,40,0.8); color: white;">Salir &#9662;</button>' +
        '<div class="hidden group-hover:block absolute right-0 top-full mt-1 w-40 rounded-lg shadow-xl z-50" style="background: #11183a; border: 1px solid #1a237e;">' +
            (isPlayer ? '<button onclick="logout()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5" style="color: #e8eaf6;">Cerrar sesion admin</button>' : '') +
            '<button onclick="logoutAll()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5" style="color: #ef5350;">Salir de todo</button>' +
        '</div></div>';

    var notifHTML = '';
    try { notifHTML = buildNotificationBell(); } catch(e) { notifHTML = ''; }
    var separator = '<div class="w-px mx-1" style="background: rgba(255,255,255,0.1);"></div>';

    nav.innerHTML =
        '<nav style="background: #0a0e27; border-bottom: 1px solid #1a237e;" class="sticky top-0 z-50">' +
            '<div class="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">' +
                '<div class="flex items-center gap-3">' +
                    '<a href="' + ahPath(role === 'alliance_leader' ? 'leader-dashboard.html' : 'admin/index.html') + '" class="text-lg font-bold flex items-center gap-2" style="color: #ff8f00;">' +
                        '<span>&#9876;&#65039;</span><span class="hidden sm:inline">Alliance Hub</span>' +
                    '</a>' +
                    '<span class="text-[10px] px-2 py-1 rounded font-bold ' + panel.badgeClass + '">' + panel.label + '</span>' +
                '</div>' +
                '<div class="flex items-center gap-2 flex-wrap">' +
                    '<div class="hidden md:flex items-center gap-1 p-1 rounded-lg" style="background: rgba(255,255,255,0.03);">' + quickHTML + '</div>' +
                    notifHTML + switchBtn +
                    '<span class="text-xs hidden lg:inline max-w-[100px] truncate" style="color: #9fa8da;">' + displayName + '</span>' +
                    logoutHTML +
                '</div>' +
            '</div>' +
            '<div class="max-w-7xl mx-auto px-4 pb-2">' +
                '<div class="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">' + mainHTML +
                    (toolsHTML ? separator + toolsHTML : '') +
                    (commsHTML ? separator + commsHTML : '') +
                '</div>' +
            '</div>' +
            warningBanner +
        '</nav>';

    try { startNotifPolling(); } catch(e) {}
}

function renderPlayerNav(nav, playerData, adminSession) {
    var name = (playerData && playerData.displayName) ? playerData.displayName : 'Jugador';
    var playerId = (playerData && playerData.playerId) ? playerData.playerId : '';

    // Modo fluido: si tiene sesion de admin, mostrar boton "Modo Admin"
    var adminBtn = adminSession
        ? '<button onclick="switchToAdminMode()" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: #ff6f00; color: white;">&#128202; Admin</button>'
        : '';

    nav.innerHTML =
        '<nav style="background: #0a0e27; border-bottom: 1px solid #1a237e;" class="sticky top-0 z-50">' +
            '<div class="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">' +
                '<div class="flex items-center gap-3">' +
                    '<a href="' + ahPath('dashboard.html') + '" class="text-lg font-bold flex items-center gap-2" style="color: #ff8f00;">' +
                        '<span>&#9876;&#65039;</span><span class="hidden sm:inline">Alliance Hub</span>' +
                    '</a>' +
                    '<span class="text-[10px] px-2 py-1 rounded font-bold" style="background: #2e7d32; color: white;">JUGADOR</span>' +
                '</div>' +
                '<div class="flex items-center gap-2">' +
                    '<a href="' + ahPath('dashboard.html') + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:bg-white/10 hover:text-white" style="color: rgba(255,255,255,0.7);">&#127918; Partidas</a>' +
                    '<a href="' + ahPath('rankings.html') + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:bg-white/10 hover:text-white" style="color: rgba(255,255,255,0.7);">&#127942; Rankings</a>' +
                    '<a href="' + ahPath('alliance-panel.html') + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:bg-white/10 hover:text-white" style="color: rgba(255,255,255,0.7);">&#127988; Alianza</a>' +
                '</div>' +
                '<div class="flex items-center gap-2">' +
                    adminBtn +
                    '<span class="text-xs hidden md:inline max-w-[100px] truncate" style="color: #9fa8da;">' + name + '</span>' +
                    '<div class="relative group">' +
                        '<button class="px-3 py-1.5 rounded-lg text-xs font-bold transition" style="background: rgba(198,40,40,0.8); color: white;">Salir &#9662;</button>' +
                        '<div class="hidden group-hover:block absolute right-0 top-full mt-1 w-40 rounded-lg shadow-xl z-50" style="background: #11183a; border: 1px solid #1a237e;">' +
                            '<button onclick="playerLogout()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5" style="color: #e8eaf6;">Cerrar sesion jugador</button>' +
                            '<button onclick="logoutAll()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5" style="color: #ef5350;">Salir de todo</button>' +
                        '</div></div>' +
                '</div>' +
            '</div>' +
        '</nav>';
}

// Admin logueado en pagina publica: modo fluido
function renderAdminOnPublicNav(nav, session) {
    nav.innerHTML =
        '<nav style="background: #0a0e27; border-bottom: 1px solid #1a237e;" class="sticky top-0 z-50">' +
            '<div class="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">' +
                '<a href="' + ahPath('index.html') + '" class="text-lg font-bold flex items-center gap-2" style="color: #ff8f00;">' +
                    '<span>&#9876;&#65039;</span><span>Alliance Hub</span>' +
                '</a>' +
                '<div class="flex items-center gap-2">' +
                    '<button onclick="switchToAdminMode()" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: #ff6f00; color: white;">&#128202; Ir a Admin</button>' +
                    '<div class="relative group">' +
                        '<button class="px-3 py-1.5 rounded-lg text-xs font-bold transition" style="background: rgba(198,40,40,0.8); color: white;">Salir &#9662;</button>' +
                        '<div class="hidden group-hover:block absolute right-0 top-full mt-1 w-40 rounded-lg shadow-xl z-50" style="background: #11183a; border: 1px solid #1a237e;">' +
                            '<button onclick="logout()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5" style="color: #e8eaf6;">Cerrar sesion</button>' +
                            '<button onclick="logoutAll()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5" style="color: #ef5350;">Salir de todo</button>' +
                        '</div></div>' +
                '</div>' +
            '</div>' +
        '</nav>';
}

function renderPublicNav(nav) {
    nav.innerHTML =
        '<nav style="background: #0a0e27; border-bottom: 1px solid #1a237e;" class="sticky top-0 z-50">' +
            '<div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">' +
                '<a href="' + ahPath('index.html') + '" class="text-lg font-bold flex items-center gap-2" style="color: #ff8f00;">' +
                    '<span>&#9876;&#65039;</span><span>Alliance Hub</span>' +
                '</a>' +
                '<div class="flex items-center gap-2">' +
                    '<a href="' + ahPath('course/') + '" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: #1a237e; color: white;">&#127891; Curso de Certificacion</a>' +
                    '<a href="' + ahPath('login.html') + '" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: #ff6f00; color: white;">Admin Login</a>' +
                    '<a href="' + ahPath('login-player.html') + '" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: #2e7d32; color: white;">Jugador Login</a>' +
                '</div>' +
            '</div>' +
        '</nav>';
}

supabase.auth.onAuthStateChange(function(event, session) {
    // No redirigir automaticamente, solo reconstruir nav
    initAdminNav();
});
document.addEventListener('DOMContentLoaded', initAdminNav);

window.initAdminNav = initAdminNav;
window.ROLE_PANELS = ROLE_PANELS;
window.renderPlayerNav = renderPlayerNav;
window.renderPublicNav = renderPublicNav;
window.switchToAdminMode = switchToAdminMode;
window.logoutAll = logoutAll;
