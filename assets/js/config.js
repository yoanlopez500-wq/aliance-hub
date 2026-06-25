// assets/js/config.js
// Configuración de Supabase para V2
// ⚠️ REEMPLAZA ESTOS VALORES con los de tu proyecto Supabase

var SUPABASE_URL = 'https://qkccyjegkgjzwoxytnqp.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_-BBqDHD9LrMiPrk6CihrKA_8p_ABQCK';

// VAPID Public Key para notificaciones push (generar con deno run https://raw.githubusercontent.com/negrel/webpush/master/cmd/generate-vapid-keys.ts)
var VAPID_PUBLIC_KEY = 'BAUIElSXP0_GdhRu7IIRZ85y_XpW398yQPUIq5QNJ7tqKMvRBHD9nnFldlUEGbxMaFUAFz02qepp5vfoWWz2nD0';

// Exponer para que base.js pueda usarlos
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY;

// El CDN de Supabase carga 'window.supabase' como namespace.
// Creamos el cliente y lo asignamos a window.supabase (global)
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'v2' }  // <-- IMPORTANTE: apunta al schema v2
});
