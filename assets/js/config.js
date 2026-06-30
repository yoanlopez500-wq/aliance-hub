// assets/js/config.js
// Configuracion de Supabase - inicializacion robusta

var SUPABASE_URL = 'https://qkccyjegkgjzwoxytnqp.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrY2N5amVna2dqendveHl0bnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3Mzc2NTAsImV4cCI6MjA5NzMxMzY1MH0._dODSmSwR2Rv6BnOLrr9dyW8hSApzitAj1AmQHyWThg';

// VAPID Public Key para notificaciones push
var VAPID_PUBLIC_KEY = 'BJFhNV9X6twTQ3ZX7HuF9No14E_gNgAYfjWRKVE6JoNuj_CxK_JrDE07NssWfwfSHNnWklv7Hn7A23tbm6xXUZXCnFxB87Lrivhgy_yHJqakiI01Q';

// Exponer globals
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY;

// Alias para compatibilidad con base.js
window.__AH_SUPABASE_URL = SUPABASE_URL;
window.__AH_SUPABASE_KEY = SUPABASE_ANON_KEY;

// Inicializar Supabase de forma robusta: funciona sin importar el orden de carga de scripts
function initSupabaseClient(attempts) {
    attempts = attempts || 0;
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
        try {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                db: { schema: 'public' },
                auth: { persistSession: true, autoRefreshToken: true }
            });
            window.supabase = window.supabaseClient;
            console.log('[Config] Supabase inicializado correctamente');
        } catch (e) {
            console.error('[Config] Error creando cliente Supabase:', e);
        }
        return;
    }
    if (attempts < 50) {
        setTimeout(function() { initSupabaseClient(attempts + 1); }, 100);
    } else {
        console.error('[Config] No se pudo inicializar Supabase: CDN no cargo despues de 5 segundos');
    }
}
initSupabaseClient();
