// assets/js/base.js
// Funciones compartidas + sistema de caché controlado por Supabase

// Detectar base path
window.__AH_BASE_PATH = (function() {
    var path = window.location.pathname;
    var parts = path.split('/').filter(function(p) { return p.length > 0; });
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
// CACHÉ CONTROLADO
// ============================================
// Versión del caché - se invalida desde Supabase
const CACHE_VERSION_KEY = 'ah_cache_version';
const CURRENT_CACHE_VERSION = 'v12'; // Cambiar esto para forzar limpieza

// Verificar si necesitamos limpiar caché
async function checkCacheVersion() {
    try {
        // Consultar versión de caché desde Supabase
        // Usar .maybeSingle() para evitar 406 cuando no hay fila
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
            console.log('Cache version mismatch:', localVersion, '→', serverVersion, '- Limpiando caché...');
            // Limpiar TODO excepto datos de jugador (ID + username)
            var playerId = localStorage.getItem('ah_player_id');
            var username = localStorage.getItem('ah_username');
            
            // Limpiar localStorage excepto datos esenciales
            var keysToKeep = ['ah_player_id', 'ah_username'];
            var keysToRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (keysToKeep.indexOf(key) === -1) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
            
            // Restaurar datos de jugador
            if (playerId) localStorage.setItem('ah_player_id', playerId);
            if (username) localStorage.setItem('ah_username', username);
            
            // Actualizar versión
            localStorage.setItem(CACHE_VERSION_KEY, serverVersion);
            
            return true; // Se limpió
        }
        return false; // No se necesitó limpiar
    } catch (e) {
        console.error('Error checking cache version:', e);
        return false;
    }
}

// ============================================
// FUNCIONES DE JUGADOR (persisten en caché)
// ============================================
function savePlayerData(playerId, username) {
    localStorage.setItem('ah_player_id', playerId);
    localStorage.setItem('ah_username', username);
}

function getPlayerData() {
    return { 
        playerId: localStorage.getItem('ah_player_id'), 
        username: localStorage.getItem('ah_username') 
    };
}

function clearPlayerData() {
    localStorage.removeItem('ah_player_id');
    localStorage.removeItem('ah_username');
}

// ============================================
// REGISTRO POR PARTIDA (NO persiste en caché, consulta Supabase)
// ============================================
// Guarda solo el último gameId registrado para UX, pero NO el estado de registro
function saveLastRegisteredGame(gameId) {
    localStorage.setItem('ah_last_game', gameId);
}

function getLastRegisteredGame() {
    return localStorage.getItem('ah_last_game');
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

function formatNumber(num) {
    return num === undefined || num === null ? '0' : num.toLocaleString();
}

function getStatusBadge(status) {
    var badges = {
        draft: '<span class="px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-700">Borrador</span>',
        open: '<span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Abierta</span>',
        in_progress: '<span class="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">En curso</span>',
        finished: '<span class="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">Finalizada</span>',
        archived: '<span class="px-2 py-1 rounded-full text-xs bg-slate-200 text-slate-600">Archivada</span>'
    };
    return badges[status] || status;
}

function getTypeBadge(type) {
    var badges = {
        internal: '<span class="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">Interna</span>',
        duel: '<span class="px-2 py-1 rounded text-xs bg-red-100 text-red-700">Duelo</span>',
        tournament: '<span class="px-2 py-1 rounded text-xs bg-indigo-100 text-indigo-700">Torneo</span>'
    };
    return badges[type] || type;
}

function showLoading(elementId, text) {
    text = text || 'Cargando...';
    var el = document.getElementById(elementId);
    if (el) el.innerHTML = '<div class="flex items-center justify-center py-8 text-slate-400"><div class="animate-spin mr-2">⏳</div>' + text + '</div>';
}

function confirmAction(message) { return confirm(message); }