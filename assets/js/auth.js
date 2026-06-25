// assets/js/auth.js
// Autenticacion dual: Admin (Supabase Auth) + Jugador (localStorage lazy login)

// ============================================
// PLAYER SESSION (localStorage - lazy login)
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
    localStorage.setItem('ah_v2_player_id', playerId);
    localStorage.setItem('ah_v2_player_name', username || '');
    localStorage.setItem('ah_v2_player', JSON.stringify({ playerId: playerId, username: username || '' }));
}

function clearPlayerSession() {
    localStorage.removeItem('ah_v2_player_id');
    localStorage.removeItem('ah_v2_player_name');
    localStorage.removeItem('ah_v2_player');
}

// ============================================
// ADMIN SESSION (Supabase Auth)
// ============================================
function hasAdminSession() {
    // Verificamos si hay una sesion activa en Supabase
    return !!localStorage.getItem('sb-' + (__AH_SUPABASE_URL ? __AH_SUPABASE_URL.split('//')[1].split('.')[0] : '') + '-auth-token');
}

async function getAdminRole() {
    try {
        var { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        var { data: admin } = await supabase.schema('v2')
            .from('admins')
            .select('role')
            .eq('id', session.user.id)
            .single();

        var role = admin ? admin.role : 'viewer';
        window.__adminRole = role;
        return role;
    } catch (e) {
        console.log('getAdminRole error:', e);
        return null;
    }
}

function requireAdmin() {
    // Verificar autenticacion de admin
    if (!supabase || !supabase.auth) {
        console.error('[auth] Supabase no inicializado');
        return;
    }

    supabase.auth.getSession().then(function(result) {
        if (!result.data.session) {
            // No hay sesion de admin, redirigir a login si estamos en pagina admin
            if (document.body.getAttribute('data-role') === 'admin') {
                window.location.href = 'login-admin.html';
            }
        } else {
            // Hay sesion, cargar rol
            getAdminRole().then(function(role) {
                renderAdminNav();
            });
        }
    });
}

function requireAuth() {
    // Requiere admin auth (alias de requireAdmin para compatibilidad)
    requireAdmin();
}

async function adminLogout() {
    try {
        await supabase.auth.signOut();
    } catch (e) { /* ignore */ }
    window.__adminRole = null;
    renderAdminNav();
    showToast('Sesion de admin cerrada', 'info');
    setTimeout(function() {
        window.location.href = '../index.html';
    }, 500);
}

// ============================================
// INICIALIZAR: detectar sesion al cargar
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Solo inicializar nav, requireAdmin se llama explicitamente en cada pagina
    renderAdminNav();
});
