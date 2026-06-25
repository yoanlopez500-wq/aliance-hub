// assets/js/auth.js
// Login con Supabase Auth para admins (V2) - CON JERARQUIA + DISPLAY NAME + PASSWORD RESET
// Depende de base.js (window.__AH_BASE_PATH, ahPath)

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

// Usa public schema por defecto
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
    var result = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });
    if (result.error) {
        console.error('Login error:', result.error);
        return false;
    }
    return true;
}

async function sendPasswordReset(email) {
    var { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.__AH_BASE_PATH + 'reset-password.html'
    });
    if (error) {
        return { success: false, message: error.message };
    }
    return { success: true, message: 'Revisa tu email para el enlace de recuperacion' };
}

async function updatePassword(newPassword) {
    var { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
        return { success: false, message: error.message };
    }
    return { success: true, message: 'Contrasena actualizada' };
}

async function signupWithInvite(email, password, inviteCode, supremacyId, displayName) {
    var normalizedCode = inviteCode.trim().toUpperCase();

    var inviteResult = await supabase.from('admin_invites')
        .select('*')
        .eq('code', normalizedCode)
        .eq('used', false);

    if (inviteResult.error) {
        return { success: false, message: 'Error verificando codigo: ' + inviteResult.error.message };
    }

    if (!inviteResult.data || inviteResult.data.length === 0) {
        return { success: false, message: 'Codigo de invitacion invalido o ya usado' };
    }

    var invite = inviteResult.data[0];

    if (new Date(invite.expires_at) < new Date()) {
        return { success: false, message: 'Codigo de invitacion expirado' };
    }

    var { data: player } = await supabase.from('players')
        .select('id, current_username')
        .eq('id', parseInt(supremacyId))
        .single();

    if (!player) {
        var { error: insertPlayerError } = await supabase.from('players').insert({
            id: parseInt(supremacyId),
            current_username: displayName,
            status: 'active'
        });
        if (insertPlayerError) {
            return { success: false, message: 'Error creando jugador: ' + insertPlayerError.message };
        }
    }

    var authResult = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (authResult.error) {
        return { success: false, message: authResult.error.message };
    }

    await supabase.from('admin_users').insert({
        id: authResult.data.user.id,
        role: invite.role,
        display_name: displayName,
        supremacy_player_id: parseInt(supremacyId),
        approved_by: invite.created_by,
        approved_at: new Date().toISOString(),
        status: 'active'
    });

    await supabase.from('admin_invites').update({
        used: true,
        used_by: authResult.data.user.id,
        used_at: new Date().toISOString()
    }).eq('id', invite.id);

    return { success: true, message: 'Cuenta creada. Ya puedes iniciar sesion.' };
}

async function logout() {
    if (window.__ahNotifInterval) {
        clearInterval(window.__ahNotifInterval);
        window.__ahNotifInterval = null;
    }
    await supabase.auth.signOut();
    window.location.href = ahPath('login.html');
}

async function requireAdmin() {
    var sessionData = await supabase.auth.getSession();
    if (!sessionData.data.session) {
        window.location.href = ahPath('login.html');
        return;
    }
    var admin = await getAdminRole();
    if (admin && admin.status === 'suspended') {
        showToast('Tu cuenta ha sido suspendida. Contacta al superadmin.', 'error');
        await supabase.auth.signOut();
        window.location.href = ahPath('login.html');
    }
}

async function requireRole(roles) {
    var admin = await getAdminRole();
    if (!admin || roles.indexOf(admin.role) === -1) {
        showToast('No tienes permiso para acceder aqui', 'error');
        window.location.href = ahPath('index.html');
    }
}

async function requireMinRole(minRole) {
    var admin = await getAdminRole();
    if (!admin || ROLE_HIERARCHY[admin.role] < ROLE_HIERARCHY[minRole]) {
        showToast('No tienes permiso para acceder aqui', 'error');
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

function hasPlayerSession() {
    return !!localStorage.getItem('ah_v2_player_id');
}

function hasAdminSession() {
    return supabase.auth.getSession().then(function(r) {
        return !!r.data.session;
    });
}

// ===================== NOTIFICACIONES INTERNAS =====================
var __ahNotifCount = 0;
var __ahNotifMessages = [];

function buildNotificationBell() {
    return '<div class="relative" id="ah-notif-wrapper">' +
        '<button onclick="toggleNotifDropdown()" class="relative px-2 py-1.5 rounded hover:bg-slate-700 transition" title="Mensajes directos">' +
            '&#128276;' +
            '<span id="ah-notif-badge" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center hidden">0</span>' +
        '</button>' +
        '<div id="ah-notif-dropdown" class="hidden absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">' +
            '<div class="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">' +
                '<span class="text-sm font-bold text-slate-700">&#128276; Mensajes Directos</span>' +
                '<span id="ah-notif-count-label" class="text-xs text-slate-400">0 sin leer</span>' +
            '</div>' +
            '<div id="ah-notif-list" class="max-h-64 overflow-y-auto">' +
                '<div class="p-4 text-center text-xs text-slate-400">Cargando...</div>' +
            '</div>' +
            '<div class="p-2 border-t border-slate-100 bg-slate-50 text-center">' +
                '<a href="' + ahPath('admin/inbox.html') + '" class="text-xs text-blue-600 font-bold hover:text-blue-700">Ver todos los mensajes</a>' +
            '</div>' +
        '</div>' +
    '</div>';
}

function toggleNotifDropdown() {
    var dropdown = document.getElementById('ah-notif-dropdown');
    if (!dropdown) return;
    if (dropdown.classList.contains('hidden')) {
        dropdown.classList.remove('hidden');
        renderNotifList();
        markVisibleNotifsAsRead();
    } else {
        dropdown.classList.add('hidden');
    }
}

function closeNotifDropdown() {
    var dropdown = document.getElementById('ah-notif-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

async function renderNotifList() {
    var list = document.getElementById('ah-notif-list');
    if (!list) return;
    if (__ahNotifMessages.length === 0) {
        list.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">No tienes mensajes directos</div>';
        return;
    }
    list.innerHTML = __ahNotifMessages.slice(0, 5).map(function(m) {
        var isUnread = !m.read_at;
        return '<div class="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer ' + (isUnread ? 'bg-blue-50/50' : '') + '" onclick="window.location.href=\'' + ahPath('admin/inbox.html?id=' + m.id) + '\'">' +
            '<div class="flex items-center justify-between mb-1">' +
                '<span class="text-xs font-bold text-slate-700 truncate max-w-[180px]">' + (m.subject || 'Sin asunto') + '</span>' +
                '<span class="text-[10px] text-slate-400">' + formatDateTime(m.created_at) + '</span>' +
            '</div>' +
            '<p class="text-xs text-slate-500 truncate">' + m.message + '</p>' +
            '<p class="text-[10px] text-slate-400 mt-1">De: ' + (m.sender_name || 'Admin') + '</p>' +
        '</div>';
    }).join('');
}

async function markVisibleNotifsAsRead() {
    var unreadIds = __ahNotifMessages.filter(function(m) { return !m.read_at; }).map(function(m) { return m.id; });
    if (unreadIds.length === 0) return;
    var visibleIds = unreadIds.slice(0, 5);
    for (var i = 0; i < visibleIds.length; i++) {
        await markDirectMessageAsRead(visibleIds[i]);
    }
    setTimeout(refreshNotifBadge, 500);
}

async function refreshNotifBadge() {
    var count = await countUnreadDirectMessages();
    __ahNotifCount = count;
    var badge = document.getElementById('ah-notif-badge');
    var label = document.getElementById('ah-notif-count-label');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    if (label) label.textContent = count + ' sin leer';
    var messages = await fetchRecentDirectMessages(10);
    __ahNotifMessages = messages || [];
}

function startNotifPolling() {
    if (window.__ahNotifInterval) clearInterval(window.__ahNotifInterval);
    refreshNotifBadge();
    window.__ahNotifInterval = setInterval(refreshNotifBadge, 60000);
}

document.addEventListener('click', function(e) {
    var wrapper = document.getElementById('ah-notif-wrapper');
    if (wrapper && !wrapper.contains(e.target)) closeNotifDropdown();
});

// ===================== ADMIN NAV =====================
async function initAdminNav() {
    var nav = document.getElementById('admin-nav');
    if (!nav) return;
    var sessionData = await supabase.auth.getSession();
    var session = sessionData.data.session;
    var playerData = getPlayerData();
    var isPlayer = !!playerData.playerId;
    if (session) {
        var admin = await getAdminRole();
        var role = admin ? admin.role : 'unknown';
        var displayName = admin && admin.display_name ? admin.display_name : session.user.email;
        var hasAlliance = admin && admin.alliance_id;
        var links = [
            { href: ahPath('admin/index.html'), label: '&#128202; Dashboard', minRole: 'moderator' },
            { href: ahPath('admin/matches.html'), label: '&#127918; Partidas', minRole: 'moderator' },
            { href: ahPath('chat.html'), label: '&#128172; Chat', minRole: 'alliance_leader' },
            { href: ahPath('admin/alliances.html'), label: '&#127988; Alianzas', minRole: 'event_admin' },
            { href: ahPath('admin/players.html'), label: '&#128100; Jugadores', minRole: 'moderator' },
            { href: ahPath('admin/import.html'), label: '&#128229; Importar CSV', minRole: 'event_admin' },
            { href: ahPath('admin/invites.html'), label: '&#128273; Invitar', minRole: 'event_admin' },
            { href: ahPath('admin/leagues.html'), label: '&#127942; Ligas', minRole: 'event_admin' },
            { href: ahPath('admin/admins.html'), label: '&#128101; Admins', minRole: 'event_admin' },
            { href: ahPath('admin/strikes.html'), label: '&#9889; Strikes', minRole: 'moderator' },
            { href: ahPath('admin/alliance-members.html'), label: '&#127988; Miembros', minRole: 'alliance_leader', requiresAlliance: true },
        ];
        var allowedLinks = links.filter(function(l) {
            if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[l.minRole]) return false;
            if (l.requiresAlliance && !hasAlliance) return false;
            return true;
        });
        var switchBtn = '';
        if (isPlayer) switchBtn = '<a href="' + ahPath('index.html') + '" class="px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 transition text-white text-sm font-bold">&#127918; Modo Jugador</a>';
        var notifBell = buildNotificationBell();
        nav.innerHTML = '<div class="bg-slate-900 text-white p-4"><div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4"><div class="flex items-center gap-3"><a href="' + ahPath('index.html') + '" class="text-xl font-bold text-amber-400">&#9876;&#65039; Alliance Hub V2</a><span class="text-xs bg-amber-500 text-slate-900 px-2 py-1 rounded font-bold">ADMIN</span>' + getRoleBadge(role) + '</div><div class="flex flex-wrap gap-2 text-sm items-center">' + allowedLinks.map(function(l) { return '<a href="' + l.href + '" class="px-3 py-1.5 rounded hover:bg-slate-700 transition">' + l.label + '</a>'; }).join('') + notifBell + switchBtn + '<span class="text-slate-400 text-xs px-2">' + displayName + '</span><button onclick="logout()" class="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 transition">Salir</button></div></div></div>';
        startNotifPolling();
    } else {
        var adminBtn = '<a href="' + ahPath('login.html') + '" class="text-sm bg-amber-500 text-slate-900 px-4 py-2 rounded font-bold hover:bg-amber-400 transition">Admin Login</a>' +
                       (isPlayer ? '' : '<a href="' + ahPath('login-player.html') + '" class="text-sm bg-green-500 text-white px-4 py-2 rounded font-bold hover:bg-green-400 transition ml-2">Jugador Login</a>');
        nav.innerHTML = '<div class="bg-slate-900 text-white p-4"><div class="max-w-7xl mx-auto flex items-center justify-between"><a href="' + ahPath('index.html') + '" class="text-xl font-bold text-amber-400">&#9876;&#65039; Alliance Hub V2</a><div>' + adminBtn + '</div></div></div>';
    }
}

supabase.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_OUT' && !hasPlayerSession()) window.location.href = ahPath('login.html');
    initAdminNav();
});
document.addEventListener('DOMContentLoaded', initAdminNav);
function renderAdminNav() { initAdminNav(); }
function adminLogout() { logout(); }
