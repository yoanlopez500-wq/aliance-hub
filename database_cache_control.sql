-- ============================================================
-- SISTEMA DE CACHÉ CONTROLADO DESDE SUPABASE
-- ============================================================
-- Ejecutar esto en SQL Editor de Supabase

-- 1. Asegurar que app_settings existe
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insertar versión de caché actual
INSERT INTO app_settings (key, value) VALUES ('cache_version', 'v12')
ON CONFLICT (key) DO UPDATE SET value = 'v12', updated_at = NOW();

-- 3. Verificar
SELECT * FROM app_settings WHERE key = 'cache_version';

-- ============================================================
-- PARA FORZAR LIMPIEZA DE CACHÉ EN TODOS LOS DISPOSITIVOS:
-- ============================================================
-- Simplemente cambia el valor:
-- UPDATE app_settings SET value = 'v13', updated_at = NOW() WHERE key = 'cache_version';
--
-- La próxima vez que cada usuario abra la app, se limpiará su caché
-- automáticamente, pero mantendrá su ID de jugador y username.
-- ============================================================