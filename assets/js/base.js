// Base utilities - V2
window.__AH_BASE_PATH = (function() {
    var path = window.location.pathname;
    var base = path.substring(0, path.indexOf('/', path.indexOf('/', 1) + 1) + 1);
    return base || '/';
})();

function ahPath(relative) {
    var base = window.__AH_BASE_PATH;
    if (!base.endsWith('/')) base += '/';
    return base + relative.replace(/^\//, '');
}

function showToast(message, type) {
    var toast = document.createElement('div');
    var bg = type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : type === 'info' ? 'bg-blue-500' : 'bg-green-500';
    var textColor = type === 'warning' ? 'text-slate-900' : 'text-white';
    toast.className = 'fixed top-4 right-4 ' + bg + ' ' + textColor + ' px-6 py-3 rounded-xl shadow-lg z-50 font-bold';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3000);
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
    var d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function showLoading(containerId, message) {
    var container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<div class="text-center py-8 text-slate-400">' + (message || 'Cargando...') + '</div>';
    }
}

function confirmAction(message) {
    return confirm(message || 'Estas seguro?');
}

function getStatusBadge(status) {
    var badges = {
        draft: '<span class="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">BORRADOR</span>',
        open: '<span class="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 font-bold">ABIERTA</span>',
        in_progress: '<span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-bold">EN CURSO</span>',
        finished: '<span class="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 font-bold">FINALIZADA</span>',
        archived: '<span class="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-400">ARCHIVADA</span>',
        cancelled: '<span class="px-2 py-0.5 rounded text-xs bg-red-100 text-red-500">CANCELADA</span>'
    };
    return badges[status] || '<span class="px-2 py-0.5 rounded text-xs bg-slate-100">' + (status || '?') + '</span>';
}

function getStatusBadgePlayer(status) {
    if (status === 'active') return '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">ACTIVO</span>';
    if (status === 'banned') return '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">BANEADO</span>';
    if (status === 'suspended') return '<span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold">SUSPENDIDO</span>';
    return '<span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">' + (status || '?') + '</span>';
}

function getTypeBadge(type) {
    var badges = {
        internal: '<span class="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">INTERNA</span>',
        duel: '<span class="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">DUELO</span>',
        public_31: '<span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">PUBLICA 31</span>',
        public_500: '<span class="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-700">EVENTO 500</span>',
        public_quick: '<span class="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">RAPIDA</span>'
    };
    return badges[type] || '<span class="px-2 py-0.5 rounded text-xs bg-slate-100">' + (type || '?') + '</span>';
}

// ===================== DIRECT MESSAGES =====================
async function countUnreadDirectMessages() {
    try {
        var sessionData = await supabase.auth.getSession();
        if (!sessionData.data.session) return 0;
        var adminId = sessionData.data.session.user.id;
        var { count, error } = await supabase
            .from('direct_messages')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_admin_id', adminId)
            .is('read_at', null);
        if (error) { console.error('countUnread error:', error); return 0; }
        return count || 0;
    } catch (e) { return 0; }
}

async function fetchRecentDirectMessages(limit) {
    try {
        var sessionData = await supabase.auth.getSession();
        if (!sessionData.data.session) return [];
        var adminId = sessionData.data.session.user.id;
        var lim = limit || 10;
        var { data, error } = await supabase
            .from('direct_messages')
            .select('*')
            .eq('recipient_admin_id', adminId)
            .order('created_at', { ascending: false })
            .limit(lim);
        if (error) { console.error('fetchRecent error:', error); return []; }
        return data || [];
    } catch (e) { return []; }
}

async function markDirectMessageAsRead(messageId) {
    try {
        var { error } = await supabase
            .from('direct_messages')
            .update({ read_at: new Date().toISOString() })
            .eq('id', messageId);
        if (error) console.error('markRead error:', error);
    } catch (e) { console.error('markRead error:', e); }
}

async function sendDirectMessage(recipientId, subject, message) {
    try {
        var sessionData = await supabase.auth.getSession();
        if (!sessionData.data.session) return { success: false, message: 'No hay sesion' };
        var senderId = sessionData.data.session.user.id;
        
        // Get sender display name
        var { data: sender } = await supabase
            .from('admin_users')
            .select('display_name')
            .eq('id', senderId)
            .single();
        
        var { error } = await supabase
            .from('direct_messages')
            .insert({
                sender_admin_id: senderId,
                recipient_admin_id: recipientId,
                sender_name: sender?.display_name || 'Admin',
                subject: subject || null,
                message: message
            });
        
        if (error) return { success: false, message: error.message };
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

async function fetchAdminRecipients() {
    try {
        var sessionData = await supabase.auth.getSession();
        if (!sessionData.data.session) return [];
        var adminId = sessionData.data.session.user.id;
        var { data, error } = await supabase
            .from('admin_users')
            .select('id, display_name, role')
            .eq('status', 'active')
            .neq('id', adminId)
            .order('display_name');
        if (error) { console.error('fetchRecipients error:', error); return []; }
        return data || [];
    } catch (e) { return []; }
}
