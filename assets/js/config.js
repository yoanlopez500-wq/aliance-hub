// assets/js/config.js
// Configuracion de Supabase para V2

var SUPABASE_URL = 'https://qkccyjegkgjzwoxytnqp.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_-BBqDHD9LrMiPrk6CihrKA_8p_ABQCK';

// VAPID Public Key para notificaciones push
// Generado para el proyecto Supremacy_proyect (qkccyjegkgjzwoxytnqp)
// Edge Function: push-notify
var VAPID_PUBLIC_KEY = 'gNjAYfjWRKVE6JoNuj_CxK_JrDE07NssWfwfSHNnWklv7Hn7A23tbm6xXUZXCnFxB87Lrivhgy_yHJqakiI01Q';

// Exponer para que base.js pueda usarlos
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY;

// El CDN de Supabase carga 'window.supabase' como namespace.
// Creamos el cliente y lo asignamos a window.supabase (global)
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'v2' }  // <-- IMPORTANTE: apunta al schema v2
});
