
-- ============================================================
-- FUNCIONES QUE FALTAN EN TU BASE DE DATOS
n-- Ejecutar esto en Supabase SQL Editor
-- ============================================================

-- 1. Función para crear códigos de invitación
CREATE OR REPLACE FUNCTION create_invite_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
BEGIN
    new_code := upper(substring(md5(random()::text) from 1 for 8));

    INSERT INTO admin_invites (code, created_by)
    VALUES (new_code, auth.uid());

    RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función para verificar si el setup está completo
CREATE OR REPLACE FUNCTION is_setup_complete()
RETURNS BOOLEAN AS $$
DECLARE
    result BOOLEAN;
BEGIN
    SELECT value::boolean INTO result FROM app_settings WHERE key = 'setup_complete';
    RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función para completar setup
CREATE OR REPLACE FUNCTION complete_setup()
RETURNS VOID AS $$
BEGIN
    UPDATE app_settings SET value = 'true', updated_at = NOW() WHERE key = 'setup_complete';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función para recalcular stats de un jugador
CREATE OR REPLACE FUNCTION recalc_player_stats(player_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE players
    SET 
        total_kills = (SELECT COALESCE(SUM(kills), 0) FROM game_results WHERE game_results.player_id = players.id),
        total_deaths = (SELECT COALESCE(SUM(deaths), 0) FROM game_results WHERE game_results.player_id = players.id),
        games_played = (SELECT COUNT(*) FROM game_results WHERE game_results.player_id = players.id)
    WHERE players.id = player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Función para recalcular TODOS los jugadores
CREATE OR REPLACE FUNCTION recalc_all_players()
RETURNS VOID AS $$
DECLARE
    p RECORD;
BEGIN
    FOR p IN SELECT id FROM players LOOP
        PERFORM recalc_player_stats(p.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Insertar flag de setup si no existe
INSERT INTO app_settings (key, value) VALUES ('setup_complete', 'false')
ON CONFLICT (key) DO NOTHING;

-- 7. Verificar que las funciones se crearon correctamente
SELECT proname, proargnames, prosrc 
FROM pg_proc 
WHERE proname IN ('create_invite_code', 'is_setup_complete', 'complete_setup', 'recalc_player_stats', 'recalc_all_players')
ORDER BY proname;
