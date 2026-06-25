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

// FIX: Usar .schema('v2') para leer desde el schema correcto
async function getAdminRole() {
    var sessionData = await supabase.auth.getSession();
    if (!sessionData.data.session) return null;

    var { data: admin } = await supabase
        .schema('v2')
        .from('admin_users')
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

    var inviteResult = await supabase
        .schema('v2')
        .from('admin_invites')
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

    var { data: player } = await supabase
        .schema('v2')
        .from('players')
        .select('id, current_username')
        .eq('id', parseInt(supremacyId))
        .single();

    if (!player) {
        var { error: insertPlayerError } = await supabase.schema('v2').from('players').insert({
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

    await supabase.schema('v2').from('admin_users').insert({
        id: authResult.data.user.id,
        role: invite.role,
        display_name: displayName,
        supremacy_player_id: parseInt(supremacyId),
        approved_by: invite.created_by,
        approved_at: new Date().toISOString(),
        status: 'active'
    });

    await supabase.schema('v2').from('admin_invites').update({
        used: true,
        used_by: authResult.data.user.id,
        used_at: new Date().toISOString()
    }).eq('id', invite.id);

    return { success: true, message: 'Cuenta creada. Ya puedes iniciar sesion.' };
}

async function logout() {
    // Limpiar solo la sesion de admin (Supabase Auth), NO el lazy login de jugador
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

// NUEVO: Alternar entre modo admin y modo jugador
function hasPlayerSession() {
    return !!localStorage.getItem('ah_v2_player_id');
}

function hasAdminSession() {
    return supabase.auth.getSession().then(function(r) {
        return !!r.data.session;
    });
}

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
            { href: ahPath('admin/index.html'), label: '📊 Dashboard', minRole: 'moderator' },
            { href: ahPath('admin/matches.html'), label: '🎮 Partidas', minRole: 'moderator' },
            { href: ahPath('chat.html'), label: '💬 Chat', minRole: 'alliance_leader' },
            { href: ahPath('admin/alliances.html'), label: '🏴 Alianzas', minRole: 'event_admin' },
            { href: ahPath('admin/players.html'), label: '👤 Jugadores', minRole: 'moderator' },
            { href: ahPath('admin/import.html'), label: '📥 Importar CSV', minRole: 'event_admin' },
            { href: ahPath('admin/invites.html'), label: '🔑 Invitar', minRole: 'event_admin' },
            { href: ahPath('admin/leagues.html'), label: '🏆 Ligas', minRole: 'event_admin' },
            { href: ahPath('admin/admins.html'), label: '👥 Admins', minRole: 'event_admin' },
            { href: ahPath('admin/strikes.html'), label: '⚡ Strikes', minRole: 'moderator' },
            { href: ahPath('admin/alliance-members.html'), label: '🏴 Miembros', minRole: 'alliance_leader', requiresAlliance: true },
        ];

        var allowedLinks = links.filter(function(l) {
            if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[l.minRole]) return false;
            if (l.requiresAlliance && !hasAlliance) return false;
            return true;
        });

        // Boton para cambiar a modo jugador si tiene sesion de jugador
        var switchBtn = '';
        if (isPlayer) {
            switchBtn = '<a href="' + ahPath('index.html') + '" class="px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 transition text-white text-sm font-bold" title="Cambiar a vista de jugador">🎮 Modo Jugador</a>';
        }

        nav.innerHTML = `
            <div class="bg-slate-900 text-white p-4">
                <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <a href="${ahPath('index.html')}" class="text-xl font-bold text-amber-400">⚔️ Alliance Hub V2</a>
                        <span class="text-xs bg-amber-500 text-slate-900 px-2 py-1 rounded font-bold">ADMIN</span>
                        ${getRoleBadge(role)}
                    </div>
                    <div class="flex flex-wrap gap-2 text-sm items-center">
                        ${allowedLinks.map(function(l) {
                            return `<a href="${l.href}" class="px-3 py-1.5 rounded hover:bg-slate-700 transition">${l.label}</a>`;
                        }).join('')}
                        ${switchBtn}
                        <span class="text-slate-400 text-xs px-2">${displayName}</span>
                        <button onclick="logout()" class="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 transition">Salir</button>
                    </div>
                </div>
            </div>
        `;
    } else {
        // No hay sesion de admin - mostrar nav publico o login
        var adminBtn = '';
        if (isPlayer) {
            adminBtn = '<a href="' + ahPath('login.html') + '" class="text-sm bg-amber-500 text-slate-900 px-4 py-2 rounded font-bold hover:bg-amber-400 transition">Admin Login</a>';
        } else {
            adminBtn = '<a href="' + ahPath('login.html') + '" class="text-sm bg-amber-500 text-slate-900 px-4 py-2 rounded font-bold hover:bg-amber-400 transition">Admin Login</a>' +
                       '<a href="' + ahPath('login-player.html') + '" class="text-sm bg-green-500 text-white px-4 py-2 rounded font-bold hover:bg-green-400 transition ml-2">Jugador Login</a>';
        }
        nav.innerHTML = `
            <div class="bg-slate-900 text-white p-4">
                <div class="max-w-7xl mx-auto flex items-center justify-between">
                    <a href="${ahPath('index.html')}" class="text-xl font-bold text-amber-400">⚔️ Alliance Hub V2</a>
                    <div>${adminBtn}</div>
                </div>
            </div>
        `;
    }
}

supabase.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_OUT') {
        // Solo redirigir si NO hay sesion de jugador activa
        if (!hasPlayerSession()) {
            window.location.href = ahPath('login.html');
        }
    }
    initAdminNav();
});

document.addEventListener('DOMContentLoaded', initAdminNav);
