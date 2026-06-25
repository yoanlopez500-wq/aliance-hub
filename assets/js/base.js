// assets/js/base.js
// Funciones compartidas + sistema de cache + push notifications + lazy login + NOTIFICACIONES INTERNAS

// Detectar base path
window.__AH_BASE_PATH = (function() {
    var path = window.location.pathname;
    var parts = path.split('/').filter(function(p) { return p.length > 0 });
    if (parts.length >= 1 && !parts[0].includes('.') && parts[0].length > 0) {
        return '/' + parts[0] + '/';
    }
    return '/';
})();

function ahPath(p) {
    var base = window.__AH_BASE_PATH;
    if (p.startsWith('./') || p.startsWith('../')) return p;
    if (p.startsWith('/')) p = p.slice(1);
    return base + p;
}

// ============================================
// CACHE CONTROLADO
// ============================================
const CACHE_VERSION_KEY = 'ah_v2_cache_version';
const CURRENT_CACHE_VERSION = 'v2.1';

async function checkCacheVersion() {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'cache_version')
            .maybeSingle();

        if (error) {
            console.log('Cache version check skipped:', error.message);
            return false;
        }

        var serverVersion = (data && data.value) ? data.value : CURRENT_CACHE_VERSION;
        var localVersion = localStorage.getItem(CACHE_VERSION_KEY);

        if (localVersion !== serverVersion) {
            console.log('Cache version mismatch:', localVersion, '->', serverVersion, '- Limpiando cache...');
            var playerId = localStorage.getItem('ah_v2_player_id');
            var username = localStorage.getItem('ah_v2_username');
            var allianceId = localStorage.getItem('ah_v2_alliance_id');

            var keysToKeep = ['ah_v2_player_id', 'ah_v2_username', 'ah_v2_alliance_id', 'ah_v2_push_subscribed'];
            var keysToRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (keysToKeep.indexOf(key) === -1) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(function(k) { localStorage.removeItem(k); });

            if (playerId) localStorage.setItem('ah_v2_player_id', playerId);
            if (username) localStorage.setItem('ah_v2_username', username);
            if (allianceId) localStorage.setItem('ah_v2_alliance_id', allianceId);

            localStorage.setItem(CACHE_VERSION_KEY, serverVersion);
            return true;
        }
        return false;
    } catch (e) {
        console.error('Error checking cache version:', e);
        return false;
    }
}

// ============================================
// LAZY LOGIN (Jugadores normales)
// ============================================
function savePlayerData(playerId, username, allianceId) {
    localStorage.setItem('ah_v2_player_id', playerId);
    localStorage.setItem('ah_v2_username', username);
    if (allianceId) localStorage.setItem('ah_v2_alliance_id', allianceId);
}

function getPlayerData() {
    return {
        playerId: localStorage.getItem('ah_v2_player_id'),
        username: localStorage.getItem('ah_v2_username'),
        allianceId: localStorage.getItem('ah_v2_alliance_id')
    };
}

function clearPlayerData() {
    localStorage.removeItem('ah_v2_player_id');
    localStorage.removeItem('ah_v2_username');
    localStorage.removeItem('ah_v2_alliance_id');
}

async function lazyLogin(playerId, username) {
    try {
        var { data: player, error } = await supabase
            .from('players')
            .select('*, alliances(id, name, tag)')
            .eq('id', playerId)
            .single();

        if (error || !player) {
            var { error: insertError } = await supabase.from('players').insert({
                id: parseInt(playerId),
                current_username: username,
                status: 'active'
            });

            if (insertError) {
                return { success: false, message: 'Error creando jugador: ' + insertError.message };
            }

            savePlayerData(playerId, username, null);
            return { success: true, message: 'Jugador creado', isNew: true };
        }

        if (player.status === 'banned') {
            return { success: false, message: 'Jugador suspendido. Contacta al admin.' };
        }

        await supabase.from('players').update({
            last_seen: new Date().toISOString(),
            current_username: username
        }).eq('id', playerId);

        savePlayerData(playerId, username, player.current_alliance_id);
        return { success: true, message: 'Bienvenido, ' + username, isNew: false, player: player };

    } catch (e) {
        return { success: false, message: 'Error: ' + e.message };
    }
}

function isLazyLoggedIn() {
    return !!localStorage.getItem('ah_v2_player_id');
}

function requireLazyLogin() {
    if (!isLazyLoggedIn()) {
        window.location.href = ahPath('login-player.html');
    }
}

// ============================================
// PUSH NOTIFICATIONS
// ============================================
async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showToast('Tu navegador no soporta notificaciones push', 'warning');
        return false;
    }

    try {
        var registration = await navigator.serviceWorker.ready;
        var subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY)
        });

        var playerData = getPlayerData();

        var { error } = await supabase.from('push_subscriptions').upsert({
            endpoint: subscription.endpoint,
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: arrayBufferToBase64(subscription.getKey('auth')),
            player_id: playerData.playerId ? parseInt(playerData.playerId) : null,
            alliance_id: playerData.allianceId || null
        }, { onConflict: 'endpoint' });

        if (error) {
            console.error('Error saving subscription:', error);
            showToast('Error guardando suscripcion', 'error');
            return false;
        }

        localStorage.setItem('ah_v2_push_subscribed', 'true');
        showToast('Notificaciones activadas', 'success');
        return true;

    } catch (err) {
        console.error('Push subscription error:', err);
        showToast('Error: ' + err.message, 'error');
        return false;
    }
}

async function unsubscribeFromPush() {
    try {
        var registration = await navigator.serviceWorker.ready;
        var subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();
            await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        }

        localStorage.removeItem('ah_v2_push_subscribed');
        showToast('Notificaciones desactivadas', 'success');
        return true;
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
        return false;
    }
}

function isPushSubscribed() {
    return localStorage.getItem('ah_v2_push_subscribed') === 'true';
}

// ============================================
// UTILIDADES CRYPTO (para Web Push)
// ============================================
function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/\-/g, '+').replace(/\_/g, '/');
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    for (var i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// ============================================
// UI UTILS
// ============================================
function showToast(message, type) {
    var colors = { info: 'bg-blue-500', success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500' };
    var toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 ' + (colors[type] || colors.info) + ' text-white px-6 py-3 rounded-lg shadow-lg z-50';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(function() { toast.remove(); }, 500);
    }, 3000);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatNumber(num) {
    return num === undefined || num === null ? '0' : num.toLocaleString();
}

function getStatusBadge(status) {
    var badges = {
        draft: '<span class="px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-700">Borrador</span>',
        open: '<span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Abierta</span>',
        in_progress: '<span class="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">En curso</span>',
        finished: '<span class="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">Finalizada</span>',
        archived: '<span class="px-2 py-1 rounded-full text-xs bg-slate-200 text-slate-600">Archivada</span>',
        cancelled: '<span class="px-2 py-1 rounded-full text-xs bg-red-200 text-red-700">Cancelada</span>',
        pending: '<span class="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">Pendiente</span>',
        confirmed: '<span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Confirmado</span>',
        no_show: '<span class="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">No Show</span>',
        played: '<span class="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">Jugado</span>',
        rejected: '<span class="px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-700">Rechazado</span>',
        pending_approval: '<span class="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">Esperando Aprobacion</span>',
        approved: '<span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Aprobado</span>'
    };
    return badges[status] || status;
}

function getTypeBadge(type) {
    var badges = {
        internal: '<span class="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">Interna</span>',
        duel: '<span class="px-2 py-1 rounded text-xs bg-red-100 text-red-700">Duelo</span>',
        public_31: '<span class="px-2 py-1 rounded text-xs bg-indigo-100 text-indigo-700">Publica 31</span>',
        public_500: '<span class="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700">Evento 500</span>',
        public_quick: '<span class="px-2 py-1 rounded text-xs bg-cyan-100 text-cyan-700">Rapida</span>'
    };
    return badges[type] || type;
}

function getRoleBadge(role) {
    var badges = {
        superadmin: '<span class="px-2 py-1 rounded text-xs bg-red-100 text-red-700 font-bold">Superadmin</span>',
        event_admin: '<span class="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700 font-bold">Event Admin</span>',
        alliance_leader: '<span class="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700 font-bold">Lider</span>',
        moderator: '<span class="px-2 py-1 rounded text-xs bg-green-100 text-green-700 font-bold">Moderador</span>'
    };
    return badges[role] || role;
}

// NUEVO: Badge de estado para jugadores
function getStatusBadgePlayer(status) {
    if (status === 'active') return '<span class="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-bold">ACTIVO</span>';
    if (status === 'banned') return '<span class="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-bold">BANEADO</span>';
    if (status === 'suspended') return '<span class="px-2 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-700 font-bold">SUSPENDIDO</span>';
    return '<span class="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">' + (status || '?') + '</span>';
}

function showLoading(elementId, text) {
    text = text || 'Cargando...';
    var el = document.getElementById(elementId);
    if (el) el.innerHTML = '<div class="flex items-center justify-center py-8 text-slate-400"><div class="animate-spin mr-2">&#9203;</div>' + text + '</div>';
}

function confirmAction(message) { return confirm(message); }

// ============================================
// REGISTRO POR PARTIDA
// ============================================
function saveLastRegisteredMatch(matchId) {
    localStorage.setItem('ah_v2_last_match', matchId);
}

function getLastRegisteredMatch() {
    return localStorage.getItem('ah_v2_last_match');
}

// ============================================
// CHAT LOCAL (Sin persistencia en Supabase)
// ============================================
const CHAT_MAX_LOCAL = 50;
const CHAT_MAX_REPORT = 20;

function getChatKey(channel) {
    return 'ah_v2_chat_' + channel;
}

function saveChatMessage(channel, message) {
    var key = getChatKey(channel);
    var messages = JSON.parse(localStorage.getItem(key) || '[]');
    messages.push({
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        sender_id: message.sender_id,
        sender_name: message.sender_name,
        sender_role: message.sender_role || '',
        text: message.text,
        timestamp: new Date().toISOString(),
        type: message.type || 'text'
    });
    if (messages.length > CHAT_MAX_LOCAL) {
        messages = messages.slice(-CHAT_MAX_LOCAL);
    }
    localStorage.setItem(key, JSON.stringify(messages));
    return messages;
}

function getChatMessages(channel) {
    var key = getChatKey(channel);
    return JSON.parse(localStorage.getItem(key) || '[]');
}

function clearChatChannel(channel) {
    localStorage.removeItem(getChatKey(channel));
}

function getChatChannels() {
    var channels = [];
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.startsWith('ah_v2_chat_')) {
            channels.push(key.replace('ah_v2_chat_', ''));
        }
    }
    return channels;
}

// ============================================
// REPORTE DE CHAT (Auditoria)
// ============================================
async function reportChatMessage(channel, reportedMessageId, reason) {
    var messages = getChatMessages(channel);
    var reportIndex = messages.findIndex(function(m) { return m.id === reportedMessageId; });
    if (reportIndex === -1) reportIndex = messages.length;

    var start = Math.max(0, reportIndex - 10);
    var end = Math.min(messages.length, reportIndex + 10);
    var contextMessages = messages.slice(start, end);

    var playerData = getPlayerData();
    var sessionData = await supabase.auth.getSession();

    var { error } = await supabase.from('chat_reports').insert({
        channel: channel,
        reported_message_id: reportedMessageId,
        reporter_id: sessionData.data.session?.user?.id || playerData.playerId,
        reporter_name: sessionData.data.session?.user?.email || playerData.username,
        reason: reason,
        context_messages: JSON.stringify(contextMessages),
        reported_at: new Date().toISOString()
    });

    if (error) {
        showToast('Error enviando reporte: ' + error.message, 'error');
        return false;
    }

    showToast('Reporte enviado. Los admins revisaran el incidente.', 'success');
    return true;
}

// ============================================
// ACCIONES DE CHAT
// ============================================
function createChatAction(type, data) {
    return {
        type: 'action',
        action_type: type,
        data: data,
        timestamp: new Date().toISOString()
    };
}

// ============================================
// NUEVO: NOTIFICACIONES INTERNAS (Mensajes Directos)
// ============================================
async function countUnreadDirectMessages() {
    try {
        var sessionData = await supabase.auth.getSession();
        if (!sessionData.data.session) return 0;

        var { count, error } = await supabase.schema('v2')
            .from('direct_messages')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_admin_id', sessionData.data.session.user.id)
            .is('read_at', null);

        if (error) {
            console.error('Error counting unread messages:', error);
            return 0;
        }
        return count || 0;
    } catch (e) {
        console.error('countUnreadDirectMessages error:', e);
        return 0;
    }
}

async function fetchRecentDirectMessages(limit) {
    limit = limit || 10;
    try {
        var sessionData = await supabase.auth.getSession();
        if (!sessionData.data.session) return [];

        var { data, error } = await supabase.schema('v2')
            .from('direct_messages')
            .select('*')
            .eq('recipient_admin_id', sessionData.data.session.user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching direct messages:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('fetchRecentDirectMessages error:', e);
        return [];
    }
}

async function markDirectMessageAsRead(messageId) {
    try {
        var { error } = await supabase.schema('v2')
            .from('direct_messages')
            .update({ read_at: new Date().toISOString() })
            .eq('id', messageId);

        if (error) {
            console.error('Error marking message as read:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('markDirectMessageAsRead error:', e);
        return false;
    }
}

async function sendDirectMessage(recipientAdminId, subject, message) {
    try {
        var sessionData = await supabase.auth.getSession();
        var senderId = sessionData.data.session ? sessionData.data.session.user.id : null;
        
        // Obtener nombre del remitente
        var senderName = 'Admin';
        if (senderId) {
            var { data: admin } = await supabase.schema('v2')
                .from('admin_users')
                .select('display_name')
                .eq('id', senderId)
                .single();
            if (admin && admin.display_name) senderName = admin.display_name;
        }

        var { error } = await supabase.schema('v2')
            .from('direct_messages')
            .insert({
                sender_admin_id: senderId,
                sender_name: senderName,
                recipient_admin_id: recipientAdminId,
                subject: subject || null,
                message: message
            });

        if (error) {
            console.error('Error sending direct message:', error);
            return { success: false, message: error.message };
        }
        return { success: true, message: 'Mensaje enviado' };
    } catch (e) {
        console.error('sendDirectMessage error:', e);
        return { success: false, message: e.message };
    }
}

// Obtener lista de admins para enviar mensajes
async function fetchAdminRecipients() {
    try {
        var { data, error } = await supabase.schema('v2')
            .from('admin_users')
            .select('id, display_name, role')
            .eq('status', 'active')
            .order('display_name');

        if (error) {
            console.error('Error fetching admins:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('fetchAdminRecipients error:', e);
        return [];
    }
}

// ============================================
// NUEVO: Forzar actualizacion de cache (boton en footer)
// ============================================
function clearAppCache() {
    if ('caches' in window) {
        caches.keys().then(function(names) {
            names.forEach(function(name) { caches.delete(name); });
        });
    }
    localStorage.removeItem(CACHE_VERSION_KEY);
    showToast('Cache limpiado. Recarga la pagina.', 'success');
    setTimeout(function() { location.reload(true); }, 1500);
}
