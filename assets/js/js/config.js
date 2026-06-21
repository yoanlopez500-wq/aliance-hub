// assets/js/config.js
// ⚠️ REEMPLAZA ESTOS VALORES con los de tu proyecto Supabase
// Ve a tu dashboard de Supabase → Project Settings → API
// Copia la URL y la anon key

const SUPABASE_URL = 'https://qkccyjegkgjzwoxytnqp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-BBqDHD9LrMiPrk6CihrKA_8p_ABQCK';

// El CDN de Supabase carga 'window.supabase' como namespace.
// Creamos el cliente y lo asignamos a window.supabase (global)
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
