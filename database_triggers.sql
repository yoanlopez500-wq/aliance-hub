
-- ============================================================
-- TRIGGERS: Ranking Global Conectado a Partidas
-- ============================================================
-- Esto asegura que cuando:
-- 1. Se elimina una partida → se restan sus stats del global
-- 2. Se elimina un resultado → se restan sus stats del global
-- 3. Se actualiza un resultado → se recalcula el global
-- ============================================================

-- 1. FUNCIÓN: Recalcular stats globales de un jugador
CREATE OR REPLACE FUNCTION recalc_player_stats(player_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE players
    SET 
        total_kills = COALESCE((SELECT SUM(kills) FROM game_results WHERE game_results.player_id = players.id), 0),
        total_deaths = COALESCE((SELECT SUM(deaths) FROM game_results WHERE game_results.player_id = players.id), 0),
        games_played = COALESCE((SELECT COUNT(*) FROM game_results WHERE game_results.player_id = players.id), 0)
    WHERE players.id = player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. FUNCIÓN: Recalcular TODOS los jugadores
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

-- 3. TRIGGER: Al ELIMINAR un resultado → recalcular jugador
CREATE OR REPLACE FUNCTION trigger_after_delete_result()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalc_player_stats(OLD.player_id);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS after_delete_result ON game_results;
CREATE TRIGGER after_delete_result
    AFTER DELETE ON game_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_after_delete_result();

-- 4. TRIGGER: Al ACTUALIZAR un resultado → recalcular jugador
CREATE OR REPLACE FUNCTION trigger_after_update_result()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalc_player_stats(NEW.player_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS after_update_result ON game_results;
CREATE TRIGGER after_update_result
    AFTER UPDATE ON game_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_after_update_result();

-- 5. TRIGGER: Al INSERTAR un resultado → recalcular jugador
CREATE OR REPLACE FUNCTION trigger_after_insert_result()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalc_player_stats(NEW.player_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS after_insert_result ON game_results;
CREATE TRIGGER after_insert_result
    AFTER INSERT ON game_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_after_insert_result();

-- 6. FUNCIÓN: Eliminar partida y todos sus resultados (con recálculo automático)
CREATE OR REPLACE FUNCTION delete_game_complete(game_uuid UUID)
RETURNS VOID AS $$
DECLARE
    r RECORD;
BEGIN
    -- Guardar jugadores afectados
    CREATE TEMP TABLE affected_players AS
    SELECT DISTINCT player_id FROM game_results WHERE game_id = game_uuid;

    -- Eliminar resultados (los triggers recalcularán automáticamente)
    DELETE FROM game_results WHERE game_id = game_uuid;

    -- Eliminar registros
    DELETE FROM registrations WHERE game_id = game_uuid;

    -- Eliminar partida
    DELETE FROM games WHERE id = game_uuid;

    -- Recalcular jugadores afectados (por si acaso)
    FOR r IN SELECT player_id FROM affected_players LOOP
        PERFORM recalc_player_stats(r.player_id);
    END LOOP;

    DROP TABLE affected_players;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. FUNCIÓN: Invalidar estadísticas de un jugador en una partida específica
CREATE OR REPLACE FUNCTION invalidate_player_stats(game_uuid UUID, player_id BIGINT)
RETURNS VOID AS $$
BEGIN
    -- Eliminar el resultado (el trigger recalculará automáticamente el global)
    DELETE FROM game_results WHERE game_id = game_uuid AND player_id = player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. VISTA: Ranking global actualizado (usa los triggers automáticos)
CREATE OR REPLACE VIEW player_rankings_live AS
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
WHERE p.total_deaths > 0 OR p.total_kills > 0
ORDER BY p.total_kills DESC;

-- ============================================================
-- INSTRUCCIONES:
-- ============================================================
-- Ahora el ranking global SIEMPRE está conectado a las partidas:
-- 
-- • Al importar CSV → stats se suman automáticamente
-- • Al eliminar un resultado → stats se restan automáticamente
-- • Al eliminar una partida → TODOS los stats de esa partida se restan
-- • Al invalidar un jugador → solo sus stats de esa partida se restan
--
-- Para eliminar una partida completa:
-- SELECT delete_game_complete('UUID-DE-LA-PARTIDA');
--
-- Para invalidar un jugador en una partida:
-- SELECT invalidate_player_stats('UUID-PARTIDA', 99702975);
-- ============================================================
