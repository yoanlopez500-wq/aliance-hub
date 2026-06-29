// assets/js/base.js v12 - Alliance Hub utilities + Session persistence
// __AH_BASE_PATH: detecta el subdirectorio del repo en GitHub Pages
window.__AH_BASE_PATH = (function() {
    var parts = window.location.pathname.split('/').filter(function(p) { return p.length > 0; });
    if (parts.length >= 1 && parts[0] !== 'admin' && parts[0] !== 'chat' && parts[0] !== 'register') {
        var knownPages = ['index.html','login.html','login-player.html','rankings.html','game.html','player.html','dashboard.html','reset-password.html','chat.html','404.html','manifest.json','assets','register','service-worker.js','course','landing.html'];
        if (knownPages.indexOf(parts[0]) === -1) return '/' + parts[0] + '/';
    }
    if (parts.length >= 2) return '/' + parts[0] + '/';
    return '/';
})();

function ahPath(relative) {
    var base = window.__AH_BASE_PATH;
    if (!base.endsWith('/')) base += '/';
    return base + relative.replace(/^\//, '');
}

function showToast(message, type) {
    var toast = document.createElement('div');
    var bg = type === 'error' ? 'rgba(198,40,40,0.9)' : type === 'warning' ? 'rgba(255,143,0,0.9)' : type === 'info' ? 'rgba(33,150,243,0.9)' : 'rgba(46,125,50,0.9)';
    var textColor = type === 'warning' ? '#1a1a2e' : '#fff';
    toast.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:12px 20px;border-radius:12px;font-weight:700;font-size:13px;box-shadow:0 8px 32px rgba(0,0,0,0.3);animation:fadeIn 0.3s ease-out;background:' + bg + ';color:' + textColor + ';';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; setTimeout(function(){toast.remove()}, 500); }, 3000);
}

function formatDate(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    var now = new Date();
    var diff = now - d;
    if (diff < 60000) return 'hace un momento';
    if (diff < 3600000) return 'hace ' + Math.floor(diff / 60000) + ' min';
    if (diff < 86400000) return 'hace ' + Math.floor(diff / 3600000) + ' h';
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function formatDateTime(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function showLoading(containerId, message) {
    var c = document.getElementById(containerId);
    if (c) c.innerHTML = '<div class="text-center py-8" style="color:#9fa8da;">' + (message || 'Cargando...') + '</div>';
}

function confirmAction(message) { return confirm(message || 'Estas seguro?'); }

function getStatusBadge(status) {
    var badges = { draft: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,255,255,0.05);color:#9fa8da">BORRADOR</span>', open: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(76,175,80,0.15);color:#4caf50">ABIERTA</span>', in_progress: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(33,150,243,0.15);color:#2196f3">EN CURSO</span>', finished: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(156,39,176,0.15);color:#ce93d8">FINALIZADA</span>', archived: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,255,255,0.05);color:#9fa8da">ARCHIVADA</span>', cancelled: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(198,40,40,0.15);color:#ef5350">CANCELADA</span>' };
    return badges[status] || '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,255,255,0.05);color:#9fa8da">' + (status || '?') + '</span>';
}

function getStatusBadgePlayer(status) {
    if (status === 'active') return '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(46,125,50,0.15);color:#4caf50">ACTIVO</span>';
    if (status === 'banned') return '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(198,40,40,0.15);color:#ef5350">BANEADO</span>';
    if (status === 'suspended') return '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,143,0,0.15);color:#ff8f00">SUSPENDIDO</span>';
    return '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,255,255,0.05);color:#9fa8da">' + (status || '?') + '</span>';
}

function getTypeBadge(type) {
    var badges = { internal: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,143,0,0.1);color:#ff8f00">INTERNA</span>', duel: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(239,83,80,0.1);color:#ef5350">DUELO</span>', public_31: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(33,150,243,0.1);color:#4fc3f7">PUBLICA 31</span>', public_500: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(156,39,176,0.1);color:#ce93d8">EVENTO 500</span>', public_quick: '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(76,175,80,0.1);color:#81c784">RAPIDA</span>' };
    return badges[type] || '<span class="px-2 py-0.5 rounded text-xs font-bold" style="background:rgba(255,255,255,0.05);color:#9fa8da">' + (type || '?') + '</span>';
}

// ===================== GLOBAL MATCH ADMIN FUNCTIONS =====================
async function removeRegistration(regId, playerName) {
    if (!confirm('\u00bfQuitar a ' + (playerName || 'este jugador') + ' de la partida?')) return;
    try {
        var { error } = await supabase.from('match_registrations').delete().eq('id', regId);
        if (error) { showToast('Error: ' + error.message, 'error'); return; }
        showToast('Jugador quitado de la partida', 'success');
        setTimeout(function() { location.reload(); }, 500);
    } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

function openSuspendModal(playerId, playerName) {
    var modal = document.getElementById('suspend-modal');
    if (!modal) { showToast('Modal no encontrado. Recarga la pagina.', 'error'); return; }
    document.getElementById('su-player-id').value = playerId;
    document.getElementById('su-player-name').textContent = playerName || 'Jugador ' + playerId;
    document.getElementById('su-reason').value = '';
    modal.classList.add('active');
}

function closeSuspendModal() { var m = document.getElementById('suspend-modal'); if (m) m.classList.remove('active'); }

async function unsuspendPlayer(playerId) {
    if (!confirm('\u00bfReactivar este jugador?')) return;
    try { var { error } = await supabase.from('players').update({ status: 'active', suspension_reason: null }).eq('id', playerId); if (error) { showToast('Error: ' + error.message, 'error'); return; } showToast('Jugador reactivado', 'success'); setTimeout(function(){location.reload()},500); }
    catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// ===================== PLAYER SESSION v12 - Persistent Session =====================
// Cada jugador al loguearse recibe un token (device_id) que se guarda en player_tokens.
// La sesion persiste en localStorage y NO se borra al navegar entre paginas.

function getPlayerData() {
    return {
        playerId: localStorage.getItem('ah_v2_player_id'),
        displayName: localStorage.getItem('ah_v2_display_name'),
        token: localStorage.getItem('ah_v2_player_token')
    };
}

function setPlayerData(playerId, displayName, token) {
    if (playerId) localStorage.setItem('ah_v2_player_id', playerId);
    if (displayName) localStorage.setItem('ah_v2_display_name', displayName);
    if (token) localStorage.setItem('ah_v2_player_token', token);
}

// ====== clearPlayerData: Solo borra datos de jugador, NUNCA toca admin session ======
function clearPlayerData() {
    localStorage.removeItem('ah_v2_player_id');
    localStorage.removeItem('ah_v2_display_name');
    localStorage.removeItem('ah_v2_player_token');
    localStorage.removeItem('ah_v2_last_match');
    // NOTA: No borramos ah_device_id para que el dispositivo siga reconocido
}

function isLazyLoggedIn() {
    return !!localStorage.getItem('ah_v2_player_id') && !!localStorage.getItem('ah_v2_player_token');
}

async function lazyLogin(playerId, username) {
    try {
        var pid = parseInt(playerId);
        if (!pid || pid <= 0) return { success: false, message: 'ID de jugador invalido' };
        if (!username || username.trim().length === 0) return { success: false, message: 'Username requerido' };
        var cleanName = username.trim();

        var { data: existing } = await supabase.from('players').select('id, current_username').eq('id', pid).maybeSingle();
        if (existing) {
            if (existing.current_username !== cleanName) {
                await supabase.from('players').update({ current_username: cleanName, last_seen: new Date().toISOString() }).eq('id', pid);
            } else {
                await supabase.from('players').update({ last_seen: new Date().toISOString() }).eq('id', pid);
            }
        } else {
            var { error: insertErr } = await supabase.from('players').insert({
                id: pid, current_username: cleanName, status: 'active', last_seen: new Date().toISOString(),
                games_played: 0, total_kills: 0, total_deaths: 0, reputation_score: 100
            });
            if (insertErr) return { success: false, message: 'Error creando jugador: ' + insertErr.message };
        }

        // Get or create token
        var { data: tokenRow } = await supabase.from('player_tokens').select('token').eq('player_id', pid).maybeSingle();
        var token = tokenRow ? tokenRow.token : null;

        if (!token) {
            token = crypto.randomUUID ? crypto.randomUUID() : 'tk-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            await supabase.from('player_tokens').insert({ player_id: pid, token: token });
        }

        setPlayerData(pid.toString(), cleanName, token);
        return { success: true, message: 'Bienvenido, ' + cleanName, token: token };
    } catch (e) {
        return { success: false, message: 'Error: ' + e.message };
    }
}

async function getLastRegisteredMatch() {
    var playerData = getPlayerData();
    if (!playerData.playerId) return null;
    try {
        var { data } = await supabase.from('match_registrations').select('match_id')
            .eq('player_id', parseInt(playerData.playerId)).order('registered_at', { ascending: false }).limit(1).maybeSingle();
        return data ? data.match_id : null;
    } catch (e) { return null; }
}

function saveLastRegisteredMatch(matchId) { if (matchId) localStorage.setItem('ah_v2_last_match', matchId); }

// ===================== TRANSFER CODE =====================
async function generateTransferCode() {
    var playerData = getPlayerData();
    if (!playerData.playerId) { showToast('No tienes sesion de jugador', 'error'); return null; }
    try {
        var { data, error } = await supabase.rpc('generate_transfer_code', { p_player_id: parseInt(playerData.playerId) });
        if (error) { showToast('Error: ' + error.message, 'error'); return null; }
        return data;
    } catch(e) { showToast('Error generando codigo', 'error'); return null; }
}

// ===================== TOKEN VALIDATION =====================
async function validatePlayerToken(playerId, token) {
    if (!playerId || !token) return false;
    try {
        var { data } = await supabase.from('player_tokens').select('token').eq('player_id', parseInt(playerId)).eq('token', token).maybeSingle();
        return !!data;
    } catch(e) { return false; }
}

// ===================== APP CACHE CONTROL =====================
function clearAppCache() {
    if ('caches' in window) caches.keys().then(function(names) { names.forEach(function(n) { caches.delete(n); }); });
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(function(regs) { regs.forEach(function(r) { r.unregister(); }); });
    localStorage.removeItem('ah_v2_cache_version');
    showToast('Cache limpiado. Recargando...', 'success');
    setTimeout(function() { window.location.reload(true); }, 1500);
}

// ===================== PUSH NOTIFICATIONS =====================
function isPushSubscribed() { return localStorage.getItem('ah_v2_push_subscribed') === 'true'; }

async function subscribeToPush() {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) { showToast('Tu navegador no soporta notificaciones push', 'warning'); return false; }
        var reg = await navigator.serviceWorker.ready;
        var sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY) });
        var subJson = sub.toJSON();
        var playerData = getPlayerData();
        var { error } = await supabase.from('push_subscriptions').upsert({ endpoint: subJson.endpoint, p256dh: subJson.keys ? subJson.keys.p256dh : null, auth: subJson.keys ? subJson.keys.auth : null, player_id: playerData.playerId ? parseInt(playerData.playerId) : null }, { onConflict: 'endpoint' });
        if (error) console.error('Error guardando sub:', error);
        localStorage.setItem('ah_v2_push_subscribed', 'true');
        showToast('Notificaciones activadas', 'success');
        return true;
    } catch(e) { showToast('Error activando notificaciones', 'error'); return false; }
}

async function unsubscribeFromPush() {
    try { var reg = await navigator.serviceWorker.ready; var sub = await reg.pushManager.getSubscription(); if (sub) { await supabase.from('push_subscriptions').delete().eq('endpoint', sub.toJSON().endpoint); await sub.unsubscribe(); } localStorage.removeItem('ah_v2_push_subscribed'); showToast('Notificaciones desactivadas', 'info'); return true; }
    catch(e) { return false; }
}

function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

// ===================== DIRECT MESSAGES =====================
async function countUnreadDirectMessages() {
    try { var sd = await supabase.auth.getSession(); if (!sd.data.session) return 0; var { count } = await supabase.from('direct_messages').select('*', { count: 'exact', head: true }).eq('recipient_admin_id', sd.data.session.user.id).is('read_at', null); return count || 0; } catch(e) { return 0; }
}
async function fetchRecentDirectMessages(limit) {
    try { var sd = await supabase.auth.getSession(); if (!sd.data.session) return []; var { data } = await supabase.from('direct_messages').select('*').eq('recipient_admin_id', sd.data.session.user.id).order('created_at', { ascending: false }).limit(limit || 10); return data || []; } catch(e) { return []; }
}
async function markDirectMessageAsRead(messageId) { try { await supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).eq('id', messageId); } catch(e) {} }
async function sendDirectMessage(recipientId, subject, message) {
    try { var sd = await supabase.auth.getSession(); if (!sd.data.session) return { success: false, message: 'No hay sesion' }; var { data: sender } = await supabase.from('admin_users').select('display_name').eq('id', sd.data.session.user.id).single(); var { error } = await supabase.from('direct_messages').insert({ sender_admin_id: sd.data.session.user.id, recipient_admin_id: recipientId, sender_name: sender?.display_name || 'Admin', subject: subject || null, message: message }); if (error) return { success: false, message: error.message }; return { success: true }; } catch(e) { return { success: false, message: e.message }; }
}
async function fetchAdminRecipients() {
    try { var sd = await supabase.auth.getSession(); if (!sd.data.session) return []; var { data } = await supabase.from('admin_users').select('id, display_name, role').eq('status', 'active').neq('id', sd.data.session.user.id).order('display_name'); return data || []; } catch(e) { return []; }
}
