-- ============================================================
-- FUNCIONES AVANZADAS PARA ALLIANCE HUB (CORREGIDO)
-- Ejecutar en tu base de datos EXISTENTE
-- ============================================================

-- ============================================================
-- PARTE 1: FUNCIONES DE TRIGGERS (crear primero)
-- ============================================================

-- Función para recalcular stats de un jugador
CREATE OR REPLACE FUNCTION recalc_player_from_scratch(player_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE players
    SET 
        total_kills = COALESCE((
            SELECT SUM(kills) 
            FROM game_results 
            WHERE game_results.player_id = recalc_player_from_scratch.player_id
        ), 0),
        total_deaths = COALESCE((
            SELECT SUM(deaths) 
            FROM game_results 
            WHERE game_results.player_id = recalc_player_from_scratch.player_id
        ), 0),
        games_played = COALESCE((
            SELECT COUNT(DISTINCT game_id) 
            FROM game_results 
            WHERE game_results.player_id = recalc_player_from_scratch.player_id
        ), 0),
        last_seen = NOW()
    WHERE players.id = recalc_player_from_scratch.player_id;
END;
$$ LANGUAGE plpgsql;

-- Función del trigger: INSERT
CREATE OR REPLACE FUNCTION trigger_after_insert_result()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalc_player_from_scratch(NEW.player_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función del trigger: UPDATE
CREATE OR REPLACE FUNCTION trigger_after_update_result()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalc_player_from_scratch(NEW.player_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función del trigger: DELETE
CREATE OR REPLACE FUNCTION trigger_after_delete_result()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalc_player_from_scratch(OLD.player_id);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PARTE 2: CREAR TRIGGERS (después de las funciones)
-- ============================================================

DROP TRIGGER IF EXISTS after_insert_result ON game_results;
CREATE TRIGGER after_insert_result
    AFTER INSERT ON game_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_after_insert_result();

DROP TRIGGER IF EXISTS after_update_result ON game_results;
CREATE TRIGGER after_update_result
    AFTER UPDATE ON game_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_after_update_result();

DROP TRIGGER IF EXISTS after_delete_result ON game_results;
CREATE TRIGGER after_delete_result
    AFTER DELETE ON game_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_after_delete_result();

-- ============================================================
-- PARTE 3: OTRAS FUNCIONES ÚTILES
-- ============================================================

-- Recalcular TODOS los jugadores
CREATE OR REPLACE FUNCTION recalc_all_players()
RETURNS VOID AS $$
DECLARE
    p RECORD;
BEGIN
    FOR p IN SELECT DISTINCT player_id FROM game_results LOOP
        PERFORM recalc_player_from_scratch(p.player_id);
    END LOOP;

    UPDATE players
    SET total_kills = 0, total_deaths = 0, games_played = 0
    WHERE id NOT IN (SELECT DISTINCT player_id FROM game_results);
END;
$$ LANGUAGE plpgsql;

-- Eliminar partida completa y recalcular jugadores afectados
CREATE OR REPLACE FUNCTION delete_game_complete(game_uuid UUID)
RETURNS VOID AS $$
DECLARE
    affected_player RECORD;
BEGIN
    FOR affected_player IN 
        SELECT DISTINCT player_id 
        FROM game_results 
        WHERE game_id = game_uuid
    LOOP
        PERFORM recalc_player_from_scratch(affected_player.player_id);
    END LOOP;

    DELETE FROM game_results WHERE game_id = game_uuid;
    DELETE FROM registrations WHERE game_id = game_uuid;
    DELETE FROM games WHERE id = game_uuid;
END;
$$ LANGUAGE plpgsql;

-- Invalidar estadísticas de un jugador en una partida
CREATE OR REPLACE FUNCTION invalidate_player_stats(game_uuid UUID, p_id BIGINT)
RETURNS VOID AS $$
BEGIN
    DELETE FROM game_results WHERE game_id = game_uuid AND player_id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Crear código de invitación
CREATE OR REPLACE FUNCTION create_invite_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
BEGIN
    new_code := upper(substring(md5(random()::text) from 1 for 8));
    INSERT INTO admin_invites (code, created_by) VALUES (new_code, auth.uid());
    RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Completar setup
CREATE OR REPLACE FUNCTION complete_setup()
RETURNS VOID AS $$
BEGIN
    UPDATE app_settings SET value = 'true', updated_at = NOW() WHERE key = 'setup_complete';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar si setup está completo
CREATE OR REPLACE FUNCTION is_setup_complete()
RETURNS BOOLEAN AS $$
DECLARE
    result BOOLEAN;
BEGIN
    SELECT value::boolean INTO result FROM app_settings WHERE key = 'setup_complete';
    RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PARTE 4: VISTAS
-- ============================================================

CREATE OR REPLACE VIEW global_rankings AS
SELECT 
    p.id,
    p.current_username,
    a.name AS alliance_name,
    a.tag AS alliance_tag,
    p.total_kills,
    p.total_deaths,
    CASE 
        WHEN p.total_deaths > 0 THEN ROUND(p.total_kills::numeric / p.total_deaths, 2)
        ELSE p.total_kills
    END AS kd_ratio,
    p.games_played,
    p.last_seen
FROM players p
LEFT JOIN alliances a ON p.current_alliance_id = a.id
ORDER BY p.total_kills DESC;

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================
SELECT 'FUNCIONES CREADAS:' AS info;

SELECT proname AS funcion
FROM pg_proc 
WHERE proname IN (
    'recalc_player_from_scratch',
    'recalc_all_players', 
    'delete_game_complete',
    'invalidate_player_stats',
    'create_invite_code',
    'complete_setup',
    'is_setup_complete',
    'trigger_after_insert_result',
    'trigger_after_update_result',
    'trigger_after_delete_result'
)
ORDER BY proname;

SELECT 'TRIGGERS CREADOS:' AS info;

SELECT tgname AS trigger, tgrelid::regclass AS tabla
FROM pg_trigger
WHERE tgname IN ('after_insert_result', 'after_update_result', 'after_delete_result');
