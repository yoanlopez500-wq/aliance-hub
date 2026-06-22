-- ============================================
-- KILL SWITCH: Control de versiones y caché
-- ============================================
-- Ejecutar esto en Supabase SQL Editor para activar

-- 1. Insertar/actualizar versión de la app
-- Cuando subas una nueva versión, cambia el valor:
INSERT INTO app_settings (key, value) VALUES ('app_version', '12')
ON CONFLICT (key) DO UPDATE SET value = '12', updated_at = NOW();

-- 2. Forzar recarga de emergencia (cambia a 'true' para activar)
-- Esto hará que TODOS los usuarios limpien su caché al recargar
INSERT INTO app_settings (key, value) VALUES ('force_reload', 'false')
ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = NOW();

-- 3. Verificar configuración actual
SELECT key, value, updated_at FROM app_settings WHERE key IN ('app_version', 'force_reload', 'setup_complete');

-- ============================================
-- INSTRUCCIONES DE USO:
-- ============================================
-- Para forzar limpieza de caché a todos:
-- UPDATE app_settings SET value = 'true' WHERE key = 'force_reload';
--
-- Para actualizar versión (menos agresivo, solo si cambió la versión local):
-- UPDATE app_settings SET value = '13' WHERE key = 'app_version';
--
-- Para verificar:
-- SELECT * FROM app_settings;
