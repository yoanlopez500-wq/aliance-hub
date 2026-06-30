// assets/js/auth.js v3.3 - Session persistence + Fluid mode + Rules nav + Leader requests
// Depende de base.js (window.__AH_BASE_PATH, ahPath, getPlayerData, setPlayerData, clearPlayerData)

var ROLE_HIERARCHY = { superadmin: 4, event_admin: 3, alliance_leader: 2, moderator: 1 };
function canManage(myRole, targetRole) { if (myRole === targetRole) return false; return ROLE_HIERARCHY[myRole] > ROLE_HIERARCHY[targetRole]; }
function canView(myRole, targetRole) { if (myRole === 'superadmin') return true; if (myRole === 'event_admin') return targetRole !== 'superadmin'; if (myRole === 'alliance_leader') return targetRole === 'moderator' || targetRole === 'alliance_leader'; return false; }
async function isAdmin() { var sd = await supabase.auth.getSession(); return !!sd.data.session; }
async function getAdminRole() { var sd = await supabase.auth.getSession(); if (!sd.data.session) return null; var { data: admin } = await supabase.from('admin_users').select('role, alliance_id, status, display_name, supremacy_player_id').eq('id', sd.data.session.user.id).single(); return admin; }
async function login(email, password) { var r = await supabase.auth.signInWithPassword({ email: email, password: password }); if (r.error) { console.error('Login error:', r.error); return false; } return true; }
async function sendPasswordReset(email) { var { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.__AH_BASE_PATH + 'reset-password.html' }); if (error) return { success: false, message: error.message }; return { success: true, message: 'Revisa tu email para el enlace de recuperacion' }; }
async function updatePassword(newPassword) { var { error } = await supabase.auth.updateUser({ password: newPassword }); if (error) return { success: false, message: error.message }; return { success: true, message: 'Contrasena actualizada' }; }
async function signupWithInvite(email, password, inviteCode, supremacyId, displayName) { var nc = inviteCode.trim().toUpperCase(); var ir = await supabase.from('admin_invites').select('*').eq('code', nc).eq('used', false); if (ir.error) return { success: false, message: 'Error verificando codigo: ' + ir.error.message }; if (!ir.data || ir.data.length === 0) return { success: false, message: 'Codigo de invitacion invalido o ya usado' }; var inv = ir.data[0]; if (new Date(inv.expires_at) < new Date()) return { success: false, message: 'Codigo de invitacion expirado' }; var { data: player } = await supabase.from('players').select('id, current_username').eq('id', parseInt(supremacyId)).single(); if (!player) { var { error: ipe } = await supabase.from('players').insert({ id: parseInt(supremacyId), current_username: displayName, status: 'active' }); if (ipe) return { success: false, message: 'Error creando jugador: ' + ipe.message }; } var ar = await supabase.auth.signInWithPassword({ email: email, password: password }); if (ar.error) return { success: false, message: ar.error.message }; await supabase.from('admin_users').insert({ id: ar.data.user.id, role: inv.role, display_name: displayName, supremacy_player_id: parseInt(supremacyId), approved_by: inv.created_by, approved_at: new Date().toISOString(), status: 'active' }); await supabase.from('admin_invites').update({ used: true, used_by: ar.data.user.id, used_at: new Date().toISOString() }).eq('id', inv.id); return { success: true, message: 'Cuenta creada. Ya puedes iniciar sesion.' }; }
async function logout() { if (window.__ahNotifInterval) { clearInterval(window.__ahNotifInterval); window.__ahNotifInterval = null; } await supabase.auth.signOut(); if (hasPlayerSession()) { window.location.href = ahPath('dashboard.html'); } else { window.location.href = ahPath('login.html'); } }
async function switchToPlayerMode() { if (!hasPlayerSession()) { window.location.href = ahPath('login-player.html'); return; } window.location.href = ahPath('dashboard.html'); }
async function switchToAdminMode() { window.location.href = ahPath('admin/index.html'); }
async function logoutAll() { localStorage.removeItem('ah_v2_player_id'); localStorage.removeItem('ah_v2_display_name'); localStorage.removeItem('ah_v2_player_token'); localStorage.removeItem('ah_v2_last_match'); if (window.__ahNotifInterval) { clearInterval(window.__ahNotifInterval); window.__ahNotifInterval = null; } await supabase.auth.signOut(); window.location.href = ahPath('index.html'); }
function hasPlayerSession() { return !!(localStorage.getItem('ah_v2_player_id') && localStorage.getItem('ah_v2_player_token')); }
function getPlayerData() { var id = localStorage.getItem('ah_v2_player_id'); if (!id) return null; return { playerId: id, displayName: localStorage.getItem('ah_v2_display_name'), token: localStorage.getItem('ah_v2_player_token') }; }
function setPlayerData(playerId, displayName, token) { if (playerId) localStorage.setItem('ah_v2_player_id', playerId); if (displayName) localStorage.setItem('ah_v2_display_name', displayName); if (token) localStorage.setItem('ah_v2_player_token', token); }
function clearPlayerData() { localStorage.removeItem('ah_v2_player_id'); localStorage.removeItem('ah_v2_display_name'); localStorage.removeItem('ah_v2_player_token'); localStorage.removeItem('ah_v2_last_match'); }
async function playerLogout() { clearPlayerData(); await supabase.auth.signOut(); window.location.href = ahPath('index.html'); }
async function requireAdmin() { var sd = await supabase.auth.getSession(); if (!sd.data.session) { window.location.href = ahPath('login.html'); return false; } var admin = await getAdminRole(); if (admin && admin.status === 'suspended') { if (typeof showToast === 'function') showToast('Tu cuenta ha sido suspendida. Contacta al superadmin.', 'error'); await supabase.auth.signOut(); window.location.href = ahPath('login.html'); return false; } return true; }
async function requireRole(roles) { var admin = await getAdminRole(); if (!admin || roles.indexOf(admin.role) === -1) { if (typeof showToast === 'function') showToast('No tienes permiso para acceder aqui', 'error'); window.location.href = ahPath('index.html'); } }
async function requireMinRole(minRole) { var admin = await getAdminRole(); if (!admin || ROLE_HIERARCHY[admin.role] < ROLE_HIERARCHY[minRole]) { if (typeof showToast === 'function') showToast('No tienes permiso para acceder aqui', 'error'); window.location.href = ahPath('index.html'); } }
function getRoleBadge(role) { var badges = { superadmin: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(239,83,80,0.15);color:#ef5350;">SUPERADMIN</span>', event_admin: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(33,150,243,0.15);color:#2196f3;">ADMIN EVENTOS</span>', alliance_leader: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(76,175,80,0.15);color:#4caf50;">LIDER</span>', moderator: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(156,39,176,0.15);color:#ce93d8;">MODERADOR</span>' }; return badges[role] || '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,255,255,0.05);color:#9fa8da;">' + (role || '?') + '</span>'; }

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
            { href: 'admin/leagues.html', label: '&#127942; Ligas', section: 'tools', devBadge: true },
            { href: 'admin/admins.html', label: '&#128101; Admins', section: 'tools' },
            { href: 'admin/strikes.html', label: '&#9889; Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '&#128680; Reportes', section: 'tools' },
            { href: 'admin/rules-editor.html', label: '&#128220; Reglamento', section: 'tools' },
            { href: 'admin/sanctions-engine.html', label: '&#9878;&#65039; Sanciones', section: 'tools' },
            { href: 'admin/leader-requests.html', label: '&#127941; Liderazgo', section: 'tools' },
            { href: 'chat.html', label: '&#128172; Chat', section: 'comms' },
        ],
        quickActions: [
            { label: '&#10133; Nueva Partida', action: 'openMatchModal()', color: 'amber' },
            { label: '&#128220; Reglamento', href: 'rules.html', color: 'blue' },
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
            { href: 'admin/leagues.html', label: '&#127942; Ligas', section: 'tools', devBadge: true },
            { href: 'admin/admins.html', label: '&#128101; Admins', section: 'tools' },
            { href: 'admin/strikes.html', label: '&#9889; Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '&#128680; Reportes', section: 'tools' },
            { href: 'admin/rules-editor.html', label: '&#128220; Reglamento', section: 'tools' },
            { href: 'admin/sanctions-engine.html', label: '&#9878;&#65039; Sanciones', section: 'tools' },
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
window.ROLE_PANELS = ROLE_PANELS;

function renderAdminNav(nav, session, admin, isPlayer) {
    var role = admin.role;
    var panel = ROLE_PANELS[role] || ROLE_PANELS.moderator;
    var displayName = admin.display_name || session.user.email;
    var hasAlliance = !!admin.alliance_id;
    var warningBanner = '';
    if (role === 'alliance_leader' && !hasAlliance) { warningBanner = '<div class="max-w-7xl mx-auto px-4"><div class="rounded-lg p-3 mb-4 text-center" style="background: rgba(255,143,0,0.1); border: 1px solid rgba(255,143,0,0.2);"><p class="text-sm font-medium" style="color: #ff8f00;">&#9888;&#65039; No tienes una alianza asignada. Contacta a un superadmin.</p></div></div>'; }
    var mainLinks = panel.navLinks.filter(function(l) { return l.section === 'main'; });
    var toolsLinks = panel.navLinks.filter(function(l) { return l.section === 'tools'; });
    var commsLinks = panel.navLinks.filter(function(l) { return l.section === 'comms'; });
    var mkLink = function(l) { var devBadge = l.devBadge ? ' <span class="text-[9px] px-1 py-0.5 rounded font-bold ml-1" style="background: #ff6f00; color: white;">DEV</span>' : ''; return '<a href="' + ahPath(l.href) + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap hover:bg-white/10 hover:text-white" style="color: rgba(255,255,255,0.7);">' + l.label + devBadge + '</a>'; };
    var mainHTML = mainLinks.map(mkLink).join('');
    var toolsHTML = toolsLinks.map(mkLink).join('');
    var commsHTML = commsLinks.map(mkLink).join('');
    var quickHTML = panel.quickActions.map(function(a) { if (a.action) return '<button onclick="' + a.action + '" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: linear-gradient(135deg, #ff6f00, #ff8f00); color: white;">' + a.label + '</button>'; if (a.href) return '<a href="' + ahPath(a.href) + '" class="px-3 py-1.5 rounded-lg text-xs font-bold transition inline-block" style="background: #1a237e; color: white;">' + a.label + '</a>'; return ''; }).join('');
    var switchBtn = isPlayer ? '<button onclick="switchToPlayerMode()" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: #2e7d32; color: white;">&#127918; Modo Jugador</button>' : '';
    var logoutHTML = '<div class="relative group"><button class="px-3 py-1.5 rounded-lg text-xs font-bold transition" style="background: rgba(198,40,40,0.8); color: white;">Salir &#9662;</button><div class="hidden group-hover:block absolute right-0 top-full mt-1 w-40 rounded-lg shadow-xl z-50" style="background: #11183a; border: 1px solid #1a237e;">' + (isPlayer ? '<button onclick="logout()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5" style="color: #e8eaf6;">Cerrar sesion admin</button>' : '') + '<button onclick="logoutAll()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5" style="color: #ef5350;">Salir de todo</button></div></div>';
    var notifHTML = ''; try { notifHTML = buildNotificationBell(); } catch(e) { notifHTML = ''; }
    var separator = '<div class="w-px mx-1" style="background: rgba(255,255,255,0.1);"></div>';
    nav.innerHTML = '<nav style="background: #0a0e27; border-bottom: 1px solid #1a237e;" class="sticky top-0 z-50"><div class="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3"><div class="flex items-center gap-3"><a href="' + ahPath(role === 'alliance_leader' ? 'leader-dashboard.html' : 'admin/index.html') + '" class="text-lg font-bold flex items-center gap-2" style="color: #ff8f00;"><span>&#9876;&#65039;</span><span class="hidden sm:inline">Alliance Hub</span></a><span class="text-[10px] px-2 py-1 rounded font-bold ' + panel.badgeClass + '">' + panel.label + '</span></div><div class="flex items-center gap-2 flex-wrap"><div class="hidden md:flex items-center gap-1 p-1 rounded-lg" style="background: rgba(255,255,255,0.03);">' + quickHTML + '</div>' + notifHTML + switchBtn + '<span class="text-xs hidden lg:inline max-w-[100px] truncate" style="color: #9fa8da;">' + displayName + '</span>' + logoutHTML + '</div></div><div class="max-w-7xl mx-auto px-4 pb-2"><div class="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">' + mainHTML + (toolsHTML ? separator + toolsHTML : '') + (commsHTML ? separator + commsHTML : '') + '</div></div>' + warningBanner + '</nav>';
    try { startNotifPolling(); } catch(e) {}
}

function renderPlayerNav(nav, playerData, adminSession) {
    var name = (playerData && playerData.displayName) ? playerData.displayName : 'Jugador';
    var adminBtn = adminSession ? '<button onclick="switchToAdminMode()" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: #ff6f00; color: white;">&#128202; Admin</button>' : '';
    nav.innerHTML = '<nav style="background: #0a0e27; border-bottom: 1px solid #1a237e;" class="sticky top-0 z-50"><div class="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3"><div class="flex items-center gap-3"><a href="' + ahPath('dashboard.html') + '" class="text-lg font-bold flex items-center gap-2" style="color: #ff8f00;"><span>&#9876;&#65039;</span><span class="hidden sm:inline">Alliance Hub</span></a><span class="text-[10px] px-2 py-1 rounded font-bold" style="background: #2e7d32; color: white;">JUGADOR</span></div><div class="flex items-center gap-2"><a href="' + ahPath('dashboard.html') + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:bg-white/10 hover:text-white" style="color: rgba(255,255,255,0.7);">&#127918; Partidas</a><a href="' + ahPath('rankings.html') + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:bg-white/10 hover:text-white" style="color: rgba(255,255,255,0.7);">&#127942; Rankings</a><a href="' + ahPath('rules.html') + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:bg-white/10 hover:text-white" style="color: rgba(255,255,255,0.7);">&#128220; Reglas</a><a href="' + ahPath('alliance-panel.html') + '" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:bg-white/10 hover:text-white" style="color: rgba(255,255,255,0.7);">&#127988; Alianza</a></div><div class="flex items-center gap-2">' + adminBtn + '<span class="text-xs hidden md:inline max-w-[100px] truncate" style="color: #9fa8da;">' + name + '</span><div class="relative group"><button class="px-3 py-1.5 rounded-lg text-xs font-bold transition" style="background: rgba(198,40,40,0.8); color: white;">Salir &#9662;</button><div class="hidden group-hover:block absolute right-0 top-full mt-1 w-40 rounded-lg shadow-xl z-50" style="background: #11183a; border: 1px solid #1a237e;"><button onclick="playerLogout()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5" style="color: #e8eaf6;">Cerrar sesion jugador</button><button onclick="logoutAll()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5" style="color: #ef5350;">Salir de todo</button></div></div></div></div></nav>';
}

function renderAdminOnPublicNav(nav, session) {
    nav.innerHTML = '<nav style="background: #0a0e27; border-bottom: 1px solid #1a237e;" class="sticky top-0 z-50"><div class="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3"><a href="' + ahPath('index.html') + '" class="text-lg font-bold flex items-center gap-2" style="color: #ff8f00;"><span>&#9876;&#65039;</span><span>Alliance Hub</span></a><div class="flex items-center gap-2"><button onclick="switchToAdminMode()" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: #ff6f00; color: white;">&#128202; Ir a Admin</button><div class="relative group"><button class="px-3 py-1.5 rounded-lg text-xs font-bold transition" style="background: rgba(198,40,40,0.8); color: white;">Salir &#9662;</button><div class="hidden group-hover:block absolute right-0 top-full mt-1 w-40 rounded-lg shadow-xl z-50" style="background: #11183a; border: 1px solid #1a237e;"><button onclick="logout()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5" style="color: #e8eaf6;">Cerrar sesion</button><button onclick="logoutAll()" class="block w-full text-left px-3 py-2 text-xs hover:bg-white/5" style="color: #ef5350;">Salir de todo</button></div></div></div></div></nav>';
}

function renderPublicNav(nav) {
    nav.innerHTML = '<nav style="background: #0a0e27; border-bottom: 1px solid #1a237e;" class="sticky top-0 z-50"><div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3"><a href="' + ahPath('index.html') + '" class="text-lg font-bold flex items-center gap-2" style="color: #ff8f00;"><span>&#9876;&#65039;</span><span>Alliance Hub</span></a><div class="flex items-center gap-2"><a href="' + ahPath('rules.html') + '" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: #1a237e; color: white;">&#128220; Reglamento</a><a href="' + ahPath('apply-leader.html') + '" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: #2e7d32; color: white;">&#127941; Liderar Alianza</a><a href="' + ahPath('login.html') + '" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: #ff6f00; color: white;">Admin Login</a><a href="' + ahPath('login-player.html') + '" class="px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-[0.98]" style="background: #7b1fa2; color: white;">Jugador Login</a></div></div></nav>';
}

function buildNotificationBell() { return '<div class="relative"><button class="p-2 rounded-lg transition hover:bg-white/5" style="color: #9fa8da;">&#128276;</button></div>'; }
function startNotifPolling() { if (window.__ahNotifInterval) clearInterval(window.__ahNotifInterval); window.__ahNotifInterval = null; }

async function initAdminNav() {
    var navContainers = document.querySelectorAll('#admin-nav');
    if (!navContainers.length) return;
    var nav = navContainers[0];
    var pageRole = document.body.dataset.role || 'public';
    try {
        var sd = await supabase.auth.getSession();
        var hasAdmin = !!sd.data.session;
        var playerData = getPlayerData();
        var hasPlayer = !!playerData;
        if (pageRole === 'admin' && hasAdmin) { var admin = await getAdminRole(); if (admin) renderAdminNav(nav, sd.data.session, admin, hasPlayer); else renderPublicNav(nav); }
        else if (hasPlayer) { renderPlayerNav(nav, playerData, hasAdmin ? sd.data.session : null); }
        else if (hasAdmin) { renderAdminOnPublicNav(nav, sd.data.session); }
        else { renderPublicNav(nav); }
    } catch(e) { console.error('[AdminNav]', e); renderPublicNav(nav); }
}

supabase.auth.onAuthStateChange(function(event, session) { initAdminNav(); });
document.addEventListener('DOMContentLoaded', initAdminNav);
window.initAdminNav = initAdminNav;

// ====== NOTIFICATION SYSTEM ======
async function getUnreadMessageCount() {
    try { var sd = await supabase.auth.getSession(); if (!sd.data.session) return 0; var { count } = await supabase.from('direct_messages').select('*', { count: 'exact', head: true }).eq('recipient_admin_id', sd.data.session.user.id).is('read_at', null); return count || 0; } catch(e) { return 0; }
}
async function getRecentMessages(limit) {
    try { var sd = await supabase.auth.getSession(); if (!sd.data.session) return []; var { data } = await supabase.from('direct_messages').select('*').eq('recipient_admin_id', sd.data.session.user.id).order('created_at', { ascending: false }).limit(limit || 10); return data || []; } catch(e) { return []; }
}
async function markDirectMessageAsRead(messageId) { try { await supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).eq('id', messageId); } catch(e) {} }
async function sendDirectMessage(recipientId, subject, message) {
    try { var sd = await supabase.auth.getSession(); if (!sd.data.session) return { success: false, message: 'No hay sesion' }; var { data: sender } = await supabase.from('admin_users').select('display_name').eq('id', sd.data.session.user.id).single(); var { error } = await supabase.from('direct_messages').insert({ sender_admin_id: sd.data.session.user.id, recipient_admin_id: recipientId, sender_name: sender?.display_name || 'Admin', subject: subject || null, message: message }); if (error) return { success: false, message: error.message }; return { success: true }; } catch(e) { return { success: false, message: e.message }; }
}
async function getAdminRecipients() {
    try { var sd = await supabase.auth.getSession(); if (!sd.data.session) return []; var { data } = await supabase.from('admin_users').select('id, display_name, role').eq('status', 'active').neq('id', sd.data.session.user.id).order('display_name'); return data || []; } catch(e) { return []; }
}
