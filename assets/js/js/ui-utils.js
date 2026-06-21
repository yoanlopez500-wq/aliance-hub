// assets/js/ui-utils.js
function showToast(message, type = 'info') {
    const colors = { info: 'bg-blue-500', success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500' };
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; setTimeout(() => toast.remove(), 500); }, 3000);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatNumber(num) {
    return num === undefined || num === null ? '0' : num.toLocaleString();
}

function getStatusBadge(status) {
    const badges = {
        draft: '<span class="px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-700">Borrador</span>',
        open: '<span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Abierta</span>',
        in_progress: '<span class="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">En curso</span>',
        finished: '<span class="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">Finalizada</span>',
        archived: '<span class="px-2 py-1 rounded-full text-xs bg-slate-200 text-slate-600">Archivada</span>'
    };
    return badges[status] || status;
}

function getTypeBadge(type) {
    const badges = {
        internal: '<span class="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">Interna</span>',
        duel: '<span class="px-2 py-1 rounded text-xs bg-red-100 text-red-700">Duelo</span>',
        tournament: '<span class="px-2 py-1 rounded text-xs bg-indigo-100 text-indigo-700">Torneo</span>'
    };
    return badges[type] || type;
}

function showLoading(elementId, text = 'Cargando...') {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = `<div class="flex items-center justify-center py-8 text-slate-400"><div class="animate-spin mr-2">⏳</div>${text}</div>`;
}

function confirmAction(message) { return confirm(message); }

function savePlayerData(playerId, username) {
    localStorage.setItem('ah_player_id', playerId);
    localStorage.setItem('ah_username', username);
}

function getPlayerData() {
    return { playerId: localStorage.getItem('ah_player_id'), username: localStorage.getItem('ah_username') };
}

function clearPlayerData() {
    localStorage.removeItem('ah_player_id');
    localStorage.removeItem('ah_username');
}
