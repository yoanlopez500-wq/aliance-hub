// assets/js/auth.js
// Login con Supabase Auth para admins (V2) - CON JERARQUÍA + DISPLAY NAME + PASSWORD RESET
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

async function getAdminRole() {
    var sessionData = await supabase.auth.getSession();
    if (!sessionData.data.session) return null;

    var { data: admin } = await supabase
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
    return { success: true, message: 'Revisa tu email para el enlace de recuperación' };
}

async function updatePassword(newPassword) {
    var { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
        return { success: false, message: error.message };
    }
    return { success: true, message: 'Contraseña actualizada' };
}

async function signupWithInvite(email, password, inviteCode, supremacyId, displayName) {
    var normalizedCode = inviteCode.trim().toUpperCase();

    var inviteResult = await supabase
        .from('admin_invites')
        .select('*')
        .eq('code', normalizedCode)
        .eq('used', false);

    if (inviteResult.error) {
        return { success: false, message: 'Error verificando código: ' + inviteResult.error.message };
    }

    if (!inviteResult.data || inviteResult.data.length === 0) {
        return { success: false, message: 'Código de invitación inválido o ya usado' };
    }

    var invite = inviteResult.data[0];

    if (new Date(invite.expires_at) < new Date()) {
        return { success: false, message: 'Código de invitación expirado' };
    }

    var { data: player } = await supabase
        .from('players')
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

    var authResult = await supabase.auth.signUp({
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

    return { success: true, message: 'Cuenta creada. Ya puedes iniciar sesión.' };
}

async function logout() {
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
        showToast('No tienes permiso para acceder aquí', 'error');
        window.location.href = ahPath('index.html');
    }
}

async function requireMinRole(minRole) {
    var admin = await getAdminRole();
    if (!admin || ROLE_HIERARCHY[admin.role] < ROLE_HIERARCHY[minRole]) {
        showToast('No tienes permiso para acceder aquí', 'error');
        window.location.href = ahPath('index.html');
    }
}

async function initAdminNav() {
    var nav = document.getElementById('admin-nav');
    if (!nav) return;

    var sessionData = await supabase.auth.getSession();
    var session = sessionData.data.session;

    if (session) {
        var admin = await getAdminRole();
        var role = admin ? admin.role : 'unknown';
        var displayName = admin && admin.display_name ? admin.display_name : session.user.email;
        var hasAlliance = admin && admin.alliance_id;

        var links = [
            { href: ahPath('admin/index.html'), label: 'Dashboard', minRole: 'moderator' },
            { href: ahPath('admin/matches.html'), label: 'Partidas', minRole: 'moderator' },
            { href: ahPath('admin/alliances.html'), label: 'Alianzas', minRole: 'event_admin' },
            { href: ahPath('admin/players.html'), label: 'Jugadores', minRole: 'moderator' },
            { href: ahPath('admin/import.html'), label: 'Importar CSV', minRole: 'event_admin' },
            { href: ahPath('admin/invites.html'), label: 'Invitar', minRole: 'event_admin' },
            { href: ahPath('admin/leagues.html'), label: 'Ligas', minRole: 'event_admin' },
            { href: ahPath('admin/admins.html'), label: '👥 Admins', minRole: 'event_admin' },
            // NUEVO: Link de gestión de membresías para líderes de alianza
            { href: ahPath('admin/alliance-members.html'), label: '🏴 Miembros', minRole: 'alliance_leader', requiresAlliance: true },
        ];

        var allowedLinks = links.filter(function(l) {
            if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[l.minRole]) return false;
            if (l.requiresAlliance && !hasAlliance) return false;
            return true;
        });

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
                        <span class="text-slate-400 text-xs px-2">${displayName}</span>
                        <button onclick="logout()" class="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 transition">Salir</button>
                    </div>
                </div>
            </div>
        `;
    } else {
        nav.innerHTML = `
            <div class="bg-slate-900 text-white p-4">
                <div class="max-w-7xl mx-auto flex items-center justify-between">
                    <a href="${ahPath('index.html')}" class="text-xl font-bold text-amber-400">⚔️ Alliance Hub V2</a>
                    <a href="${ahPath('login.html')}" class="text-sm bg-amber-500 text-slate-900 px-4 py-2 rounded font-bold hover:bg-amber-400 transition">Admin Login</a>
                </div>
            </div>
        `;
    }
}

supabase.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_OUT') {
        window.location.href = ahPath('login.html');
    }
    initAdminNav();
});

document.addEventListener('DOMContentLoaded', initAdminNav);
