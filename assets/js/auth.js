// assets/js/auth.js
// Login con Supabase Auth (email/password) + códigos de invitación
// NOTA: 'supabase' es global (window.supabase), creado en config.js

// Detectar base path automáticamente para GitHub Pages project sites
function getBasePath() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(function(p) { return p.length > 0; });
    // Si estamos en /repo-name/path, base es /repo-name/
    if (parts.length >= 1 && !parts[0].includes('.') && parts[0].length > 0) {
        return '/' + parts[0] + '/';
    }
    return '/';
}

const BASE_PATH = getBasePath();

// Helper para construir rutas relativas
function path(p) {
    // Si la ruta ya empieza con ./ o ../, devolverla tal cual
    if (p.startsWith('./') || p.startsWith('../')) return p;
    // Si empieza con /, quitarla y prepend base path
    if (p.startsWith('/')) p = p.slice(1);
    return BASE_PATH + p;
}

// Verificar si hay sesión activa
async function isAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
}

// Login con email/password
async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error('Login error:', error);
        return false;
    }

    return true;
}

// Sign up con código de invitación
async function signupWithInvite(email, password, inviteCode) {
    const normalizedCode = inviteCode.trim().toUpperCase();

    console.log('Buscando código:', normalizedCode);

    const { data: invites, error: inviteError } = await supabase
        .from('admin_invites')
        .select('*')
        .eq('code', normalizedCode)
        .eq('used', false);

    console.log('Resultado búsqueda:', invites, inviteError);

    if (inviteError) {
        console.error('Error buscando código:', inviteError);
        return { success: false, message: 'Error verificando código: ' + inviteError.message };
    }

    if (!invites || invites.length === 0) {
        return { success: false, message: 'Código de invitación inválido o ya usado' };
    }

    const invite = invites[0];

    if (new Date(invite.expires_at) < new Date()) {
        return { success: false, message: 'Código de invitación expirado' };
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password
    });

    if (authError) {
        console.error('Error creando usuario:', authError);
        return { success: false, message: authError.message };
    }

    const { error: updateError } = await supabase.from('admin_invites').update({ 
        used: true, 
        used_by: authData.user.id,
        used_at: new Date().toISOString()
    }).eq('id', invite.id);

    if (updateError) {
        console.error('Error marcando código:', updateError);
    }

    return { success: true, message: 'Cuenta creada. Ya puedes iniciar sesión.' };
}

// Logout
async function logout() {
    await supabase.auth.signOut();
    window.location.href = path('login.html');
}

// Redirigir si no está logueado
async function requireAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = path('login.html');
    }
}

// Construir navegación según estado de login
async function initAdminNav() {
    const nav = document.getElementById('admin-nav');
    if (!nav) return;

    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        const email = session.user.email;
        nav.innerHTML = `
            <div class="bg-slate-900 text-white p-4">
                <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <a href="${path('index.html')}" class="text-xl font-bold text-amber-400">⚔️ Alliance Hub</a>
                        <span class="text-xs bg-amber-500 text-slate-900 px-2 py-1 rounded font-bold">ADMIN</span>
                    </div>
                    <div class="flex flex-wrap gap-2 text-sm items-center">
                        <a href="${path('admin/index.html')}" class="px-3 py-1.5 rounded hover:bg-slate-700 transition">Dashboard</a>
                        <a href="${path('admin/games.html')}" class="px-3 py-1.5 rounded hover:bg-slate-700 transition">Partidas</a>
                        <a href="${path('admin/alliances.html')}" class="px-3 py-1.5 rounded hover:bg-slate-700 transition">Alianzas</a>
                        <a href="${path('admin/players.html')}" class="px-3 py-1.5 rounded hover:bg-slate-700 transition">Jugadores</a>
                        <a href="${path('admin/import.html')}" class="px-3 py-1.5 rounded bg-amber-500 text-slate-900 font-bold hover:bg-amber-400 transition">📥 Importar CSV</a>
                        <a href="${path('admin/invites.html')}" class="px-3 py-1.5 rounded hover:bg-slate-700 transition">🔑 Invitar</a>
                        <span class="text-slate-400 text-xs px-2">${email}</span>
                        <button onclick="logout()" class="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 transition">Salir</button>
                    </div>
                </div>
            </div>
        `;
    } else {
        nav.innerHTML = `
            <div class="bg-slate-900 text-white p-4">
                <div class="max-w-7xl mx-auto flex items-center justify-between">
                    <a href="${path('index.html')}" class="text-xl font-bold text-amber-400">⚔️ Alliance Hub</a>
                    <a href="${path('login.html')}" class="text-sm bg-amber-500 text-slate-900 px-4 py-2 rounded font-bold hover:bg-amber-400 transition">Admin Login</a>
                </div>
            </div>
        `;
    }
}

// Escuchar cambios de auth
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        window.location.href = path('login.html');
    }
    initAdminNav();
});

// Inicializar nav en todas las páginas
document.addEventListener('DOMContentLoaded', initAdminNav);