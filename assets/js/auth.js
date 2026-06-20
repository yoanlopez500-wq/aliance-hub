// assets/js/auth.js
// Login con Supabase Auth
// Depende de base.js (window.__AH_BASE_PATH, ahPath)

async function isAdmin() {
    var sessionData = await supabase.auth.getSession();
    return !!sessionData.data.session;
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

async function signupWithInvite(email, password, inviteCode) {
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

    var authResult = await supabase.auth.signUp({
        email: email,
        password: password
    });

    if (authResult.error) {
        return { success: false, message: authResult.error.message };
    }

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
    }
}

async function initAdminNav() {
    var nav = document.getElementById('admin-nav');
    if (!nav) return;

    var sessionData = await supabase.auth.getSession();
    var session = sessionData.data.session;

    if (session) {
        nav.innerHTML = `
            <div class="bg-slate-900 text-white p-4">
                <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <a href="${ahPath('index.html')}" class="text-xl font-bold text-amber-400">⚔️ Alliance Hub</a>
                        <span class="text-xs bg-amber-500 text-slate-900 px-2 py-1 rounded font-bold">ADMIN</span>
                    </div>
                    <div class="flex flex-wrap gap-2 text-sm items-center">
                        <a href="${ahPath('admin/index.html')}" class="px-3 py-1.5 rounded hover:bg-slate-700 transition">Dashboard</a>
                        <a href="${ahPath('admin/games.html')}" class="px-3 py-1.5 rounded hover:bg-slate-700 transition">Partidas</a>
                        <a href="${ahPath('admin/alliances.html')}" class="px-3 py-1.5 rounded hover:bg-slate-700 transition">Alianzas</a>
                        <a href="${ahPath('admin/players.html')}" class="px-3 py-1.5 rounded hover:bg-slate-700 transition">Jugadores</a>
                        <a href="${ahPath('admin/import.html')}" class="px-3 py-1.5 rounded bg-amber-500 text-slate-900 font-bold hover:bg-amber-400 transition">📥 Importar CSV</a>
                        <a href="${ahPath('admin/invites.html')}" class="px-3 py-1.5 rounded hover:bg-slate-700 transition">🔑 Invitar</a>
                        <span class="text-slate-400 text-xs px-2">${session.user.email}</span>
                        <button onclick="logout()" class="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 transition">Salir</button>
                    </div>
                </div>
            </div>
        `;
    } else {
        nav.innerHTML = `
            <div class="bg-slate-900 text-white p-4">
                <div class="max-w-7xl mx-auto flex items-center justify-between">
                    <a href="${ahPath('index.html')}" class="text-xl font-bold text-amber-400">⚔️ Alliance Hub</a>
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