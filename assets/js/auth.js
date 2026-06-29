// assets/js/auth.js v5.0 - Fix emojis + Sistema Oficiales + Visibilidad Reglamento
// Depende de base.js (window.__AH_BASE_PATH, ahPath, getPlayerData, setPlayerData, clearPlayerData)

var ROLE_HIERARCHY = {
    superadmin: 5,
    event_admin: 4,
    alliance_leader: 3,
    moderator: 2,
    co_leader: 2,
    officer: 1
};

function canManage(myRole, targetRole) {
    if (myRole === targetRole) return false;
    return ROLE_HIERARCHY[myRole] > ROLE_HIERARCHY[targetRole];
}

function canView(myRole, targetRole) {
    if (myRole === 'superadmin') return true;
    if (myRole === 'event_admin') return targetRole !== 'superadmin';
    if (myRole === 'alliance_leader') return targetRole === 'officer' || targetRole === 'co_leader' || targetRole === 'alliance_leader';
    if (myRole === 'co_leader') return targetRole === 'officer';
    return false;
}

async function isAdmin() {
    try {
        var sessionData = await supabase.auth.getSession();
        return !!sessionData.data.session;
    } catch(e) { return false; }
}

async function getAdminRole() {
    try {
        var sessionData = await supabase.auth.getSession();
        if (!sessionData.data.session) return null;
        var { data: admin } = await supabase.from('admin_users')
            .select('role, alliance_id, status, display_name, supremacy_player_id')
            .eq('id', sessionData.data.session.user.id)
            .single();
        return admin;
    } catch(e) { return null; }
}

// ========== NUEVO: Detectar si jugador es Oficial/Co-líder de alianza ==========
async function getAllianceOfficerRole(playerId, allianceId) {
    if (!playerId) return null;
    try {
        var { data } = await supabase.from('alliance_officers')
            .select('role, title, permissions')
            .eq('player_id', parseInt(playerId))
            .eq('is_active', true)
            .maybeSingle();
        if (data) return data;
        // También verificar alliance_memberships
        if (allianceId) {
            var { data: mem } = await supabase.from('alliance_memberships')
                .select('role')
                .eq('player_id', parseInt(playerId))
                .eq('alliance_id', allianceId)
                .eq('status', 'approved')
                .maybeSingle();
            if (mem && (mem.role === 'officer' || mem.role === 'co_leader')) {
                return { role: mem.role, title: mem.role === 'co_leader' ? 'Co-Líder' : 'Oficial', permissions: null };
            }
        }
        return null;
    } catch(e) { return null; }
}

async function isAllianceOfficer() {
    var playerData = (typeof getPlayerData === 'function') ? getPlayerData() : {};
    if (!playerData || !playerData.playerId) return null;
    return getAllianceOfficerRole(playerData.playerId, playerData.allianceId);
}

// ========== NUEVO: Resolver visibilidad de reglamento ==========
// Devuelve el rol mÃ¡s alto del usuario actual para filtrar rule_sections
async function resolveUserVisibilityRole() {
    // 1. Super Admin?
    try {
        var admin = await getAdminRole();
        if (admin) {
            if (admin.role === 'superadmin') return 'superadmin';
            if (admin.role === 'event_admin') return 'admin';
            if (admin.role === 'moderator') return 'admin';
            if (admin.role === 'alliance_leader') return 'leader';
        }
    } catch(e) {}

    // 2. Oficial/Co-líder?
    var officer = await isAllianceOfficer();
    if (officer) {
        if (officer.role === 'co_leader') return 'leader';
        return 'official';
    }

    // 3. Jugador logueado?
    if (hasPlayerSession()) return 'player';

    // 4. PÃºblico
    return 'public';
}

// Verifica si una secciÃ³n de reglamento es visible para el rol dado
function canSeeRuleSection(userRole, sectionVisibility) {
    var order = { public: 0, player: 1, official: 2, leader: 3, admin: 4, superadmin: 5 };
    var userLevel = order[userRole] || 0;
    var sectionLevel = order[sectionVisibility] || 0;
    return userLevel >= sectionLevel;
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

// ====== LOGOUT ======
async function logout() {
    if (window.__ahNotifInterval) { clearInterval(window.__ahNotifInterval); window.__ahNotifInterval = null; }
    await supabase.auth.signOut();
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
    try {
        var admin = await getAdminRole();
        if (!admin) { window.location.href = ahPath('login.html'); return; }
        var target = admin.role === 'alliance_leader' ? 'leader-dashboard.html' : 'admin/index.html';
        window.location.href = ahPath(target);
    } catch(e) { window.location.href = ahPath('login.html'); }
}

function playerLogout() {
    if (typeof clearPlayerData === 'function') clearPlayerData();
    isAdmin().then(function(isAdmin) {
        if (isAdmin) window.location.href = ahPath('admin/index.html');
        else window.location.href = ahPath('index.html');
    });
}

async function logoutAll() {
    if (window.__ahNotifInterval) { clearInterval(window.__ahNotifInterval); window.__ahNotifInterval = null; }
    if (typeof clearPlayerData === 'function') clearPlayerData();
    await supabase.auth.signOut();
    window.location.href = ahPath('index.html');
}

async function requireAdmin() {
    try {
        var sessionData = await supabase.auth.getSession();
        if (!sessionData.data.session) { window.location.href = ahPath('login.html'); return; }
        var admin = await getAdminRole();
        if (admin && admin.status === 'suspended') {
            if (typeof showToast === 'function') showToast('Tu cuenta ha sido suspendida. Contacta al superadmin.', 'error');
            await supabase.auth.signOut();
            window.location.href = ahPath('login.html');
        }
    } catch(e) { window.location.href = ahPath('login.html'); }
}

async function requireRole(roles) {
    try {
        var admin = await getAdminRole();
        if (!admin || roles.indexOf(admin.role) === -1) {
            if (typeof showToast === 'function') showToast('No tienes permiso para acceder aqui', 'error');
            window.location.href = ahPath('index.html');
        }
    } catch(e) { window.location.href = ahPath('index.html'); }
}

async function requireMinRole(minRole) {
    try {
        var admin = await getAdminRole();
        if (!admin || ROLE_HIERARCHY[admin.role] < ROLE_HIERARCHY[minRole]) {
            if (typeof showToast === 'function') showToast('No tienes permiso para acceder aqui', 'error');
            window.location.href = ahPath('index.html');
        }
    } catch(e) { window.location.href = ahPath('index.html'); }
}

function getRoleBadge(role) {
    var badges = {
        superadmin: '<span class="text-[10px] bg-red-500 text-white px-2 py-1 rounded font-bold">SUPERADMIN</span>',
        event_admin: '<span class="text-[10px] bg-blue-500 text-white px-2 py-1 rounded font-bold">ADMIN EVENTOS</span>',
        alliance_leader: '<span class="text-[10px] bg-green-500 text-white px-2 py-1 rounded font-bold">LIDER</span>',
        co_leader: '<span class="text-[10px] bg-emerald-500 text-white px-2 py-1 rounded font-bold">CO-LIDER</span>',
        officer: '<span class="text-[10px] bg-teal-500 text-white px-2 py-1 rounded font-bold">OFICIAL</span>',
        moderator: '<span class="text-[10px] bg-purple-500 text-white px-2 py-1 rounded font-bold">MODERADOR</span>'
    };
    return badges[role] || '<span class="text-[10px] bg-slate-500 text-white px-2 py-1 rounded">' + role + '</span>';
}

function hasPlayerSession() {
    return !!localStorage.getItem('ah_v2_player_id') && !!localStorage.getItem('ah_v2_player_token');
}

function hasAdminSession() {
    return supabase.auth.getSession().then(function(r) { return !!r.data.session; }).catch(function() { return false; });
}

// ===================== NOTIFICACIONES INTERNAS =====================
var __ahNotifCount = 0;
var __ahNotifMessages = [];

function buildNotificationBell() {
    return '<div class="relative" id="ah-notif-wrapper">' +
        '<button onclick="toggleNotifDropdown()" class="relative px-2 py-1.5 rounded hover:bg-white/10 transition text-white/70">🔔' +
            '<span id="ah-notif-badge" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center hidden">0</span>' +
        '</button>' +
        '<div id="ah-notif-dropdown" class="hidden absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">' +
            '<div class="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">' +
                '<span class="text-sm font-bold text-slate-700">🔔 Mensajes Directos</span>' +
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
        label: 'Super Admin', badgeClass: 'bg-red-500', icon: '👑',
        navLinks: [
            { href: 'admin/index.html', label: '📊 Dashboard', section: 'main' },
            { href: 'admin/matches.html', label: '🎮 Partidas', section: 'main' },
            { href: 'admin/players.html', label: '👤 Jugadores', section: 'main' },
            { href: 'admin/alliances.html', label: '🏳️ Alianzas', section: 'main' },
            { href: 'admin/import.html', label: '📥 Importar', section: 'tools' },
            { href: 'admin/invites.html', label: '🔑 Invitar', section: 'tools' },
            { href: 'admin/leagues.html', label: '🏆 Ligas', section: 'tools', devBadge: true },
            { href: 'admin/admins.html', label: '👥 Admins', section: 'tools' },
            { href: 'admin/strikes.html', label: '⚡ Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '🚨 Reportes', section: 'tools' },
            { href: 'admin/rules-editor.html', label: '📜 Reglas', section: 'tools' },
            { href: 'admin/sanctions-engine.html', label: '🔧 Sanciones', section: 'tools' },
            { href: 'admin/leader-requests.html', label: '📋 Solicitudes Lider', section: 'tools' },
            { href: 'chat.html', label: '💬 Chat', section: 'comms' },
        ],
        quickActions: [
            { label: '➕ Nueva Partida', action: 'openMatchModal()' },
        ]
    },
    event_admin: {
        label: 'Admin Eventos', badgeClass: 'bg-blue-500', icon: '🎯',
        navLinks: [
            { href: 'admin/index.html', label: '📊 Dashboard', section: 'main' },
            { href: 'admin/matches.html', label: '🎮 Partidas', section: 'main' },
            { href: 'admin/players.html', label: '👤 Jugadores', section: 'main' },
            { href: 'admin/alliances.html', label: '🏳️ Alianzas', section: 'main' },
            { href: 'admin/import.html', label: '📥 Importar', section: 'tools' },
            { href: 'admin/invites.html', label: '🔑 Invitar', section: 'tools' },
            { href: 'admin/leagues.html', label: '🏆 Ligas', section: 'tools', devBadge: true },
            { href: 'admin/admins.html', label: '👥 Admins', section: 'tools' },
            { href: 'admin/strikes.html', label: '⚡ Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '🚨 Reportes', section: 'tools' },
            { href: 'admin/rules-editor.html', label: '📜 Reglas', section: 'tools' },
            { href: 'admin/leader-requests.html', label: '📋 Solicitudes Lider', section: 'tools' },
            { href: 'chat.html', label: '💬 Chat', section: 'comms' },
        ],
        quickActions: [{ label: '➕ Nueva Partida', action: 'openMatchModal()' }]
    },
    alliance_leader: {
        label: 'Lider de Alianza', badgeClass: 'bg-green-500', icon: '🏳️',
        navLinks: [
            { href: 'leader-dashboard.html', label: '🏠 Mi Alianza', section: 'main' },
            { href: 'admin/matches.html', label: '🎮 Partidas', section: 'main' },
            { href: 'admin/players.html', label: '👤 Jugadores', section: 'main' },
            { href: 'admin/duel-manager.html', label: '⚔️ Duelos', section: 'main' },
            { href: 'admin/officers.html', label: '⭐ Mi Equipo', section: 'main' },
            { href: 'admin/strikes.html', label: '⚡ Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '🚨 Reportes', section: 'tools' },
            { href: 'chat.html', label: '💬 Chat', section: 'comms' },
        ],
        quickActions: [
            { label: '➕ Crear Partida', action: 'openMatchModal()' },
            { label: '⚔️ Preparar Duelo', href: 'admin/duel-manager.html' },
        ]
    },
    moderator: {
        label: 'Moderador', badgeClass: 'bg-purple-500', icon: '🛡️',
        navLinks: [
            { href: 'admin/index.html', label: '📊 Dashboard', section: 'main' },
            { href: 'admin/matches.html', label: '🎮 Partidas', section: 'main' },
            { href: 'admin/players.html', label: '👤 Jugadores', section: 'main' },
            { href: 'admin/strikes.html', label: '⚡ Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '🚨 Reportes', section: 'tools' },
        ],
        quickActions: [{ label: '📜 Ver Reportes', href: 'admin/reports.html' }]
    }
};

// ===================== NAVEGACION =====================
window.__ahNavRetryCount = 0;

async function initAdminNav() {
    var nav = document.getElementById('admin-nav');
    if (!nav) return;

    try {
        var sessionData = await supabase.auth.getSession();
        var adminSession = sessionData.data.session;

        var playerData = (typeof getPlayerData === 'function') ? getPlayerData() : {};
        var isPlayer = !!(playerData && playerData.playerId && playerData.token);

        var isAdminPage = document.body.getAttribute('data-role') === 'admin';
        var isLeaderPage = document.body.getAttribute('data-role') === 'alliance_leader';

        // DUAL MODE
        if (adminSession && isPlayer) {
            var admin = await getAdminRole();
            renderFluidNav(nav, adminSession, admin || { role: 'moderator' }, playerData, isAdminPage || isLeaderPage);
            return;
        }

        // Retry si supabase tarda
        if (isPlayer && !adminSession && window.__ahNavRetryCount < 3) {
            window.__ahNavRetryCount++;
            console.log('[Auth] Retry nav detection #' + window.__ahNavRetryCount);
            setTimeout(function() { initAdminNav(); }, 500);
            renderPlayerNav(nav, playerData, null);
            return;
        }

        // Solo ADMIN
        if (adminSession && (isAdminPage || isLeaderPage)) {
            var admin = await getAdminRole();
            renderAdminNav(nav, adminSession, admin || { role: 'moderator' });
            return;
        }

        // Solo ADMIN en pagina publica
        if (adminSession) {
            renderAdminOnPublicNav(nav, adminSession);
            return;
        }

        // Solo JUGADOR
        if (isPlayer) {
            renderPlayerNav(nav, playerData, null);
            return;
        }

        // Publico
        renderPublicNav(nav);

    } catch (err) {
        console.error('[Auth] initAdminNav error:', err);
        var playerData = (typeof getPlayerData === 'function') ? getPlayerData() : {};
        var isPlayer = !!(playerData && playerData.playerId && playerData.token);
        if (isPlayer) {
            renderPlayerNav(nav, playerData, null);
        } else {
            renderPublicNav(nav);
        }
    }
}

// ====== FLUID NAV ======
function renderFluidNav(nav, session, admin, playerData, onAdminPage) {
    var role = (admin && admin.role) || 'moderator';
    var panel = ROLE_PANELS[role] || ROLE_PANELS.moderator;

    var logoLink = onAdminPage
        ? ahPath(role === 'alliance_leader' ? 'leader-dashboard.html' : 'admin/index.html')
        : ahPath('dashboard.html');

    var mkLink = function(l) {
        var devBadge = l.devBadge ? '<span class="text-[9px] px-1 py-0.5 rounded font-bold ml-1 bg-orange-500 text-white">DEV</span>' : '';
        return '<a href="' + ahPath(l.href) + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap hover:bg-white/10 hover:text-white text-white/70">' + l.label + devBadge + '</a>';
    };

    var mainLinks = panel.navLinks.filter(function(l) { return l.section === 'main'; });

    nav.innerHTML =
        '<nav class="sticky top-0 z-50 bg-slate-900 border-b border-indigo-900/50">' +
            '<div class="max-w-7xl mx-auto px-3 sm:px-4 py-3">' +
                '<div class="flex items-center justify-between gap-2 flex-wrap">' +
                    '<div class="flex items-center gap-2 min-w-0">' +
                        '<a href="' + logoLink + '" class="text-lg font-bold flex items-center gap-2 text-orange-400 shrink-0">' +
                            '<span>⚔️</span><span class="hidden sm:inline">Alliance Hub</span>' +
                        '</a>' +
                        '<span class="text-[10px] px-2 py-1 rounded font-bold ' + panel.badgeClass + ' text-white shrink-0">' + panel.label + '</span>' +
                    '</div>' +
                    '<div class="flex items-center gap-1.5 shrink-0">' +
                        '<button onclick="switchToPlayerMode()" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-green-700 hover:bg-green-600 text-white">🎮 Jugador</button>' +
                        '<button onclick="switchToAdminMode()" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-orange-600 hover:bg-orange-500 text-white">📊 Admin</button>' +
                        '<div class="relative group">' +
                            '<button class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-500/80 hover:bg-red-500 text-white transition">▾</button>' +
                            '<div class="hidden group-hover:block absolute right-0 top-full mt-1 w-44 rounded-lg shadow-xl z-50 bg-slate-900 border border-indigo-900/50 overflow-hidden">' +
                                '<button onclick="logout()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-slate-300">Cerrar sesion admin</button>' +
                                '<button onclick="playerLogout()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-slate-300">Cerrar sesion jugador</button>' +
                                '<button onclick="logoutAll()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-red-400">Salir de todo</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="flex gap-1 mt-2 overflow-x-auto pb-1 scrollbar-hide">' + mainLinks.map(mkLink).join('') + '</div>' +
            '</div>' +
        '</nav>';

    try { startNotifPolling(); } catch(e) {}
}

// ====== ADMIN NAV ======
function renderAdminNav(nav, session, admin) {
    var role = (admin && admin.role) || 'moderator';
    var panel = ROLE_PANELS[role] || ROLE_PANELS.moderator;

    var hasPlayer = hasPlayerSession();
    var playerBtn = hasPlayer
        ? '<button onclick="switchToPlayerMode()" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-green-700 hover:bg-green-600 text-white">🎮 Modo Jugador</button>'
        : '<a href="' + ahPath('login-player.html') + '" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-green-700 hover:bg-green-600 text-white">🎮 Entrar como Jugador</a>';

    var mkLink = function(l) {
        var devBadge = l.devBadge ? '<span class="text-[9px] px-1 py-0.5 rounded font-bold ml-1 bg-orange-500 text-white">DEV</span>' : '';
        return '<a href="' + ahPath(l.href) + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap hover:bg-white/10 hover:text-white text-white/70">' + l.label + devBadge + '</a>';
    };

    var mainLinks = panel.navLinks.filter(function(l) { return l.section === 'main'; });
    var toolsLinks = panel.navLinks.filter(function(l) { return l.section === 'tools'; });

    var logoutHTML = '<div class="relative group">' +
        '<button class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-500/80 hover:bg-red-500 text-white transition">Salir ▾</button>' +
        '<div class="hidden group-hover:block absolute right-0 top-full mt-1 w-44 rounded-lg shadow-xl z-50 bg-slate-900 border border-indigo-900/50 overflow-hidden">' +
            '<button onclick="logoutAll()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-red-400">Salir de todo</button>' +
        '</div></div>';

    var notifHTML = '';
    try { notifHTML = buildNotificationBell(); } catch(e) { notifHTML = ''; }

    var homeLink = (role === 'alliance_leader') ? 'leader-dashboard.html' : 'admin/index.html';

    nav.innerHTML =
        '<nav class="sticky top-0 z-50 bg-slate-900 border-b border-indigo-900/50">' +
            '<div class="max-w-7xl mx-auto px-3 sm:px-4 py-3">' +
                '<div class="flex items-center justify-between gap-2 flex-wrap">' +
                    '<div class="flex items-center gap-2 min-w-0">' +
                        '<a href="' + ahPath(homeLink) + '" class="text-lg font-bold flex items-center gap-2 text-orange-400 shrink-0">' +
                            '<span>⚔️</span><span class="hidden sm:inline">Alliance Hub</span>' +
                        '</a>' +
                        '<span class="text-[10px] px-2 py-1 rounded font-bold ' + panel.badgeClass + ' text-white shrink-0">' + panel.label + '</span>' +
                    '</div>' +
                    '<div class="flex items-center gap-1.5 shrink-0">' + notifHTML + playerBtn + logoutHTML + '</div>' +
                '</div>' +
                '<div class="flex gap-1 mt-2 overflow-x-auto pb-1 scrollbar-hide">' + mainLinks.map(mkLink).join('') +
                    (toolsLinks.length ? '<div class="w-px mx-1 bg-white/10 shrink-0"></div>' + toolsLinks.map(mkLink).join('') : '') +
                '</div>' +
            '</div>' +
        '</nav>';

    try { startNotifPolling(); } catch(e) {}
}

// ====== PLAYER NAV ======
function renderPlayerNav(nav, playerData, adminSession) {
    var name = (playerData && playerData.displayName) ? playerData.displayName : 'Jugador';

    var adminBtn = adminSession
        ? '<button onclick="switchToAdminMode()" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-orange-600 hover:bg-orange-500 text-white">📊 Admin</button>'
        : '<a href="' + ahPath('login.html') + '" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-orange-600 hover:bg-orange-500 text-white">📊 Login Admin</a>';

    nav.innerHTML =
        '<nav class="sticky top-0 z-50 bg-slate-900 border-b border-indigo-900/50">' +
            '<div class="max-w-7xl mx-auto px-3 sm:px-4 py-3">' +
                '<div class="flex items-center justify-between gap-2 flex-wrap">' +
                    '<div class="flex items-center gap-2 min-w-0">' +
                        '<a href="' + ahPath('dashboard.html') + '" class="text-lg font-bold flex items-center gap-2 text-orange-400 shrink-0">' +
                            '<span>⚔️</span><span class="hidden sm:inline">Alliance Hub</span>' +
                        '</a>' +
                        '<span class="text-[10px] px-2 py-1 rounded font-bold bg-green-700 text-white shrink-0">JUGADOR</span>' +
                    '</div>' +
                    '<div class="flex items-center gap-1.5 shrink-0">' + adminBtn +
                        '<span class="text-xs hidden md:inline max-w-[80px] truncate text-slate-400">' + name + '</span>' +
                        '<div class="relative group">' +
                            '<button class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-500/80 hover:bg-red-500 text-white transition">▾</button>' +
                            '<div class="hidden group-hover:block absolute right-0 top-full mt-1 w-44 rounded-lg shadow-xl z-50 bg-slate-900 border border-indigo-900/50 overflow-hidden">' +
                                '<button onclick="playerLogout()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-slate-300">Cerrar sesion jugador</button>' +
                                '<button onclick="logoutAll()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-red-400">Salir de todo</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="flex gap-1 mt-2 overflow-x-auto pb-1 scrollbar-hide">' +
                    '<a href="' + ahPath('dashboard.html') + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap hover:bg-white/10 hover:text-white text-white/70">🎮 Partidas</a>' +
                    '<a href="' + ahPath('rankings.html') + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap hover:bg-white/10 hover:text-white text-white/70">🏆 Rankings</a>' +
                    '<a href="' + ahPath('rules.html') + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap hover:bg-white/10 hover:text-white text-white/70">📜 Reglas</a>' +
                    '<a href="' + ahPath('alliance-panel.html') + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap hover:bg-white/10 hover:text-white text-white/70">🏳️ Alianza</a>' +
                '</div>' +
            '</div>' +
        '</nav>';
}

// ====== ADMIN on PUBLIC page ======
function renderAdminOnPublicNav(nav, session) {
    var hasPlayer = hasPlayerSession();
    var playerBtn = hasPlayer
        ? '<button onclick="switchToPlayerMode()" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-green-700 hover:bg-green-600 text-white">🎮 Modo Jugador</button>'
        : '<a href="' + ahPath('login-player.html') + '" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-green-700 hover:bg-green-600 text-white">🎮 Entrar como Jugador</a>';

    nav.innerHTML =
        '<nav class="sticky top-0 z-50 bg-slate-900 border-b border-indigo-900/50">' +
            '<div class="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2 flex-wrap">' +
                '<a href="' + ahPath('index.html') + '" class="text-lg font-bold flex items-center gap-2 text-orange-400 shrink-0">' +
                    '<span>⚔️</span><span class="hidden sm:inline">Alliance Hub</span>' +
                '</a>' +
                '<div class="flex items-center gap-1.5 shrink-0">' + playerBtn +
                    '<button onclick="switchToAdminMode()" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-orange-600 hover:bg-orange-500 text-white">📊 Ir a Admin</button>' +
                    '<div class="relative group">' +
                        '<button class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-500/80 hover:bg-red-500 text-white transition">Salir ▾</button>' +
                        '<div class="hidden group-hover:block absolute right-0 top-full mt-1 w-44 rounded-lg shadow-xl z-50 bg-slate-900 border border-indigo-900/50 overflow-hidden">' +
                            '<button onclick="logout()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-slate-300">Cerrar sesion</button>' +
                            '<button onclick="logoutAll()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-red-400">Salir de todo</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</nav>';
}

// ====== PUBLIC NAV ======
function renderPublicNav(nav) {
    nav.innerHTML =
        '<nav class="sticky top-0 z-50 bg-slate-900 border-b border-indigo-900/50">' +
            '<div class="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2 flex-wrap">' +
                '<a href="' + ahPath('index.html') + '" class="text-lg font-bold flex items-center gap-2 text-orange-400 shrink-0">' +
                    '<span>⚔️</span><span class="hidden sm:inline">Alliance Hub</span>' +
                '</a>' +
                '<div class="flex items-center gap-1.5 shrink-0">' +
                    '<a href="' + ahPath('rules.html') + '" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-white/[0.08] hover:bg-white/10 text-slate-300">📜 Reglas</a>' +
                    '<a href="' + ahPath('login.html') + '" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-orange-600 hover:bg-orange-500 text-white">📊 Admin</a>' +
                    '<a href="' + ahPath('login-player.html') + '" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-green-700 hover:bg-green-600 text-white">🎮 Entrar</a>' +
                '</div>' +
            '</div>' +
        '</nav>';
}

// ===================== CAPACITACIÓN POR CARGO =====================
var __ahTrainingShown = false;

async function checkTrainingRequired() {
    if (__ahTrainingShown) return;
    var admin = await getAdminRole();
    if (!admin) return;

    var trainingKey = 'ah_training_' + admin.role + '_' + admin.id;
    if (localStorage.getItem(trainingKey) === 'completed') return;

    var { data: sections } = await supabase.from('rule_sections')
        .select('id, title, section_number')
        .eq('is_active', true)
        .eq('training_for', admin.role === 'alliance_leader' ? 'leader' : admin.role)
        .order('order_index');

    if (!sections || sections.length === 0) return;

    var { data: completed } = await supabase.from('training_progress')
        .select('section_id')
        .eq('admin_id', admin.id);

    var completedIds = (completed || []).map(function(c) { return c.section_id; });
    var pending = sections.filter(function(s) { return completedIds.indexOf(s.id) === -1; });

    if (pending.length === 0) {
        localStorage.setItem(trainingKey, 'completed');
        return;
    }

    __ahTrainingShown = true;
    showTrainingModal(pending, admin.role, trainingKey);
}

function showTrainingModal(pendingSections, role, storageKey) {
    var roleLabel = { leader: 'Líder de Alianza', officer: 'Oficial', admin: 'Administrador', moderator: 'Moderador', superadmin: 'Super Admin' };
    var title = '📚 Capacitación para ' + (roleLabel[role] || role);

    var modal = document.createElement('div');
    modal.id = 'training-modal';
    modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4';
    modal.style.cssText = 'background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);';

    modal.innerHTML =
        '<div class="bg-slate-800 rounded-2xl border border-indigo-900/50 max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl">' +
            '<div class="p-5 border-b border-slate-700">' +
                '<h2 class="text-xl font-bold text-white">' + title + '</h2>' +
                '<p class="text-sm text-slate-400 mt-1">Debes completar las siguientes lecturas para tu cargo.</p>' +
            '</div>' +
            '<div class="p-5 overflow-y-auto max-h-[50vh] space-y-3">' +
                pendingSections.map(function(s) {
                    return '<div class="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 border border-slate-600">' +
                        '<span class="text-2xl">📖</span>' +
                        '<div class="flex-1">' +
                            '<p class="text-sm font-bold text-white">' + (s.section_number ? s.section_number + ' ' : '') + s.title + '</p>' +
                        '</div>' +
                        '<a href="' + ahPath('rules.html?section=' + s.id) + '" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-400 text-white transition">Leer</a>' +
                    '</div>';
                }).join('') +
            '</div>' +
            '<div class="p-5 border-t border-slate-700 flex gap-3">' +
                '<button onclick="dismissTrainingModal(\'' + storageKey + '\')" class="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold bg-slate-600 hover:bg-slate-500 text-white transition">Ver más tarde</button>' +
                '<a href="' + ahPath('rules.html?training=' + role) + '" class="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold bg-orange-500 hover:bg-orange-400 text-white transition text-center">📥 Descargar PDF</a>' +
            '</div>' +
        '</div>';

    document.body.appendChild(modal);
}

function dismissTrainingModal(storageKey) {
    var modal = document.getElementById('training-modal');
    if (modal) modal.remove();
}

function completeTraining(storageKey) {
    localStorage.setItem(storageKey, 'completed');
    dismissTrainingModal();
}

// ===================== INICIALIZACIÓN =====================
try {
    supabase.auth.onAuthStateChange(function(event, session) {
        window.__ahNavRetryCount = 0;
        initAdminNav();
    });
} catch(e) { console.error('[Auth] onAuthStateChange error:', e); }

document.addEventListener('DOMContentLoaded', function() {
    window.__ahNavRetryCount = 0;
    initAdminNav().catch(function(e) {
        console.error('[Auth] DOMContentLoaded init error:', e);
        var nav = document.getElementById('admin-nav');
        if (nav) renderPublicNav(nav);
    });
    // Check training after nav loads
    setTimeout(function() { checkTrainingRequired().catch(function(){}); }, 3000);
});

window.initAdminNav = initAdminNav;
window.ROLE_PANELS = ROLE_PANELS;
window.renderPlayerNav = renderPlayerNav;
window.renderPublicNav = renderPublicNav;
window.switchToAdminMode = switchToAdminMode;
window.logoutAll = logoutAll;
window.getAllianceOfficerRole = getAllianceOfficerRole;
window.isAllianceOfficer = isAllianceOfficer;
window.resolveUserVisibilityRole = resolveUserVisibilityRole;
window.canSeeRuleSection = canSeeRuleSection;
window.completeTraining = completeTraining;
window.dismissTrainingModal = dismissTrainingModal;