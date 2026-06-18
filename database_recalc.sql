
-- ============================================================
-- SISTEMA DE RECÁLCULO AUTOMÁTICO DE RANKINGS GLOBALES
-- ============================================================
-- Al eliminar una partida o un resultado, las stats globales
-- se recalculan automáticamente.

-- 1. FUNCIÓN: Recalcular stats de un jugador desde CERO
-- (suma todos los resultados de todas las partidas)
CREATE OR REPLACE FUNCTION recalc_player_from_scratch(player_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE players
    SET 
        total_kills = COALESCE((
            SELECT SUM(kills) 
            FROM game_results 
            WHERE game_results.player_id = player_id
        ), 0),
        total_deaths = COALESCE((
            SELECT SUM(deaths) 
            FROM game_results 
            WHERE game_results.player_id = player_id
        ), 0),
        games_played = COALESCE((
            SELECT COUNT(DISTINCT game_id) 
            FROM game_results 
            WHERE game_results.player_id = player_id
        ), 0),
        last_seen = NOW()
    WHERE players.id = player_id;
END;
$$ LANGUAGE plpgsql;

-- 2. FUNCIÓN: Recalcular TODOS los jugadores (útil después de eliminar partida)
CREATE OR REPLACE FUNCTION recalc_all_players()
RETURNS VOID AS $$
DECLARE
    p RECORD;
BEGIN
    FOR p IN SELECT DISTINCT player_id FROM game_results LOOP
        PERFORM recalc_player_from_scratch(p.player_id);
    END LOOP;

    -- También resetear jugadores que ya no tienen resultados
    UPDATE players
    SET total_kills = 0, total_deaths = 0, games_played = 0
    WHERE id NOT IN (SELECT DISTINCT player_id FROM game_results);
END;
$$ LANGUAGE plpgsql;

-- 3. TRIGGER: Al eliminar un resultado, recalcular ese jugador
CREATE OR REPLACE FUNCTION trigger_recalc_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalcular el jugador afectado
    PERFORM recalc_player_from_scratch(OLD.player_id);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS after_result_delete ON game_results;

-- Crear trigger
CREATE TRIGGER after_result_delete
    AFTER DELETE ON game_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalc_on_delete();

-- 4. TRIGGER: Al eliminar una partida COMPLETA, recalcular TODOS los jugadores afectados
CREATE OR REPLACE FUNCTION trigger_recalc_on_game_delete()
RETURNS TRIGGER AS $$
DECLARE
    affected_player RECORD;
BEGIN
    -- Recalcular cada jugador que tenía resultados en esta partida
    FOR affected_player IN 
        SELECT DISTINCT player_id 
        FROM game_results 
        WHERE game_id = OLD.id
    LOOP
        PERFORM recalc_player_from_scratch(affected_player.player_id);
    END LOOP;

    -- Resetear jugadores que ya no tienen ningún resultado
    UPDATE players
    SET total_kills = 0, total_deaths = 0, games_played = 0
    WHERE id NOT IN (SELECT DISTINCT player_id FROM game_results)
    AND (total_kills > 0 OR total_deaths > 0 OR games_played > 0);

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_game_delete ON games;

CREATE TRIGGER after_game_delete
    BEFORE DELETE ON games
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalc_on_game_delete();

-- 5. TRIGGER: Al actualizar (cambiar) kills/deaths en un resultado
CREATE OR REPLACE FUNCTION trigger_recalc_on_update()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalc_player_from_scratch(NEW.player_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_result_update ON game_results;

CREATE TRIGGER after_result_update
    AFTER UPDATE ON game_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalc_on_update();

-- 6. FUNCIÓN: Invalidar resultado de un jugador en una partida
-- (pone kills=0, deaths=0 pero mantiene el registro)
CREATE OR REPLACE FUNCTION invalidate_player_result(game_id UUID, player_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE game_results
    SET kills = 0, deaths = 0, kd_ratio = 0
    WHERE game_results.game_id = $1 AND game_results.player_id = $2;

    -- El trigger after_result_update recalculará automáticamente
END;
$$ LANGUAGE plpgsql;

-- 7. FUNCIÓN: Eliminar resultado de un jugador en una partida
CREATE OR REPLACE FUNCTION remove_player_result(game_id UUID, player_id BIGINT)
RETURNS VOID AS $$
BEGIN
    DELETE FROM game_results
    WHERE game_results.game_id = $1 AND game_results.player_id = $2;

    -- El trigger after_result_delete recalculará automáticamente
END;
$$ LANGUAGE plpgsql;

-- 8. VISTA: Ranking global actualizado (siempre recalculado)
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
-- INSTRUCCIONES DE USO:
-- ============================================================
-- 
-- A) Para recalcular todo después de cambios manuales:
--    SELECT recalc_all_players();
--
-- B) Para invalidar un resultado (stats se ajustan solas):
--    SELECT invalidate_player_result('uuid-partida', 99702975);
--
-- C) Para eliminar un resultado (stats se ajustan solas):
--    SELECT remove_player_result('uuid-partida', 99702975);
--
-- D) Al eliminar una partida completa:
--    DELETE FROM games WHERE id = 'uuid-partida';
--    -- Los triggers recalculan automáticamente todos los jugadores afectados
--
-- ============================================================
