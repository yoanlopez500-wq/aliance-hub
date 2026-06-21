// assets/js/config.js
// ⚠️ REEMPLAZA ESTOS VALORES con los de tu proyecto Supabase
// Ve a tu dashboard de Supabase → Project Settings → API
// Copia la URL y la anon key

var SUPABASE_URL = 'https://qkccyjegkgjzwoxytnqp.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_-BBqDHD9LrMiPrk6CihrKA_8p_ABQCK';

// Exponer para que base.js (kill switch) pueda usarlos
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// El CDN de Supabase carga 'window.supabase' como namespace.
// Creamos el cliente y lo asignamos a window.supabase (global)
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);