-- ============================================================
-- Alliance Hub - SQL COMPLETO con recálculo automático
-- ============================================================
-- Ejecutar TODO esto en el SQL Editor de Supabase

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TIPOS ENUM
DROP TYPE IF EXISTS game_type CASCADE;
DROP TYPE IF EXISTS game_status CASCADE;
CREATE TYPE game_type AS ENUM ('internal', 'duel', 'tournament');
CREATE TYPE game_status AS ENUM ('draft', 'open', 'in_progress', 'finished', 'archived');

-- 3. TABLAS
CREATE TABLE IF NOT EXISTS alliances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    tag TEXT NOT NULL UNIQUE CHECK (LENGTH(tag) BETWEEN 3 AND 10),
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
    id BIGINT PRIMARY KEY,
    current_username TEXT NOT NULL,
    current_alliance_id UUID REFERENCES alliances(id) ON DELETE SET NULL,
    total_kills INTEGER DEFAULT 0,
    total_deaths INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    type game_type DEFAULT 'internal',
    status game_status DEFAULT 'draft',
    max_players INTEGER DEFAULT 10,
    alliance_id UUID REFERENCES alliances(id) ON DELETE SET NULL,
    rules_pdf_url TEXT,
    password TEXT,
    show_game_id BOOLEAN DEFAULT true,
    csv_imported BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    accepted_rules BOOLEAN DEFAULT false,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS game_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
    nation TEXT NOT NULL,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    kd_ratio DECIMAL(10,2) DEFAULT 0,
    raw_csv_data TEXT[],
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS admin_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES auth.users(id),
    used BOOLEAN DEFAULT false,
    used_by UUID REFERENCES auth.users(id),
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES ('setup_complete', 'false')
ON CONFLICT (key) DO NOTHING;

-- 4. RLS (Row Level Security)
ALTER TABLE alliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON alliances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON registrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON game_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON admin_invites FOR ALL USING (true) WITH CHECK (true);

-- 5. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_alliance ON games(alliance_id);
CREATE INDEX IF NOT EXISTS idx_players_alliance ON players(current_alliance_id);
CREATE INDEX IF NOT EXISTS idx_registrations_game ON registrations(game_id);
CREATE INDEX IF NOT EXISTS idx_game_results_game ON game_results(game_id);
CREATE INDEX IF NOT EXISTS idx_game_results_player ON game_results(player_id);

-- 6. FUNCIONES DE RECÁLCULO

-- Recalcular stats de un jugador desde cero
CREATE OR REPLACE FUNCTION recalc_player_from_scratch(player_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE players
    SET 
        total_kills = COALESCE((SELECT SUM(kills) FROM game_results WHERE game_results.player_id = player_id), 0),
        total_deaths = COALESCE((SELECT SUM(deaths) FROM game_results WHERE game_results.player_id = player_id), 0),
        games_played = COALESCE((SELECT COUNT(DISTINCT game_id) FROM game_results WHERE game_results.player_id = player_id), 0),
        last_seen = NOW()
    WHERE players.id = player_id;
END;
$$ LANGUAGE plpgsql;

-- Recalcular TODOS los jugadores
CREATE OR REPLACE FUNCTION recalc_all_players()
RETURNS VOID AS $$
DECLARE
    p RECORD;
BEGIN
    FOR p IN SELECT DISTINCT player_id FROM game_results LOOP
        PERFORM recalc_player_from_scratch(p.player_id);
    END LOOP;

    -- Resetear jugadores que ya no tienen resultados
    UPDATE players
    SET total_kills = 0, total_deaths = 0, games_played = 0
    WHERE id NOT IN (SELECT DISTINCT player_id FROM game_results)
    AND (total_kills > 0 OR total_deaths > 0 OR games_played > 0);
END;
$$ LANGUAGE plpgsql;

-- 7. TRIGGERS AUTOMÁTICOS

-- Trigger: Al INSERTAR resultado → recalcular jugador
CREATE OR REPLACE FUNCTION trigger_after_insert_result()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalc_player_from_scratch(NEW.player_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_insert_result ON game_results;
CREATE TRIGGER after_insert_result
    AFTER INSERT ON game_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_after_insert_result();

-- Trigger: Al ACTUALIZAR resultado → recalcular jugador
CREATE OR REPLACE FUNCTION trigger_after_update_result()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalc_player_from_scratch(NEW.player_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_update_result ON game_results;
CREATE TRIGGER after_update_result
    AFTER UPDATE ON game_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_after_update_result();

-- Trigger: Al ELIMINAR resultado → recalcular jugador
CREATE OR REPLACE FUNCTION trigger_after_delete_result()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalc_player_from_scratch(OLD.player_id);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_delete_result ON game_results;
CREATE TRIGGER after_delete_result
    AFTER DELETE ON game_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_after_delete_result();

-- Trigger: Al ELIMINAR partida → recalcular TODOS los jugadores afectados
CREATE OR REPLACE FUNCTION trigger_after_game_delete()
RETURNS TRIGGER AS $$
DECLARE
    affected_player RECORD;
BEGIN
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
    EXECUTE FUNCTION trigger_after_game_delete();

-- 8. FUNCIONES DE GESTIÓN

-- Eliminar partida completa (los triggers recalculan automáticamente)
CREATE OR REPLACE FUNCTION delete_game_complete(game_uuid UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM game_results WHERE game_id = game_uuid;
    DELETE FROM registrations WHERE game_id = game_uuid;
    DELETE FROM games WHERE id = game_uuid;
END;
$$ LANGUAGE plpgsql;

-- Invalidar estadísticas de un jugador en una partida
CREATE OR REPLACE FUNCTION invalidate_player_stats(game_uuid UUID, player_id BIGINT)
RETURNS VOID AS $$
BEGIN
    DELETE FROM game_results WHERE game_id = game_uuid AND player_id = player_id;
END;
$$ LANGUAGE plpgsql;

-- 9. FUNCIONES DE INVITACIÓN

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

CREATE OR REPLACE FUNCTION complete_setup()
RETURNS VOID AS $$
BEGIN
    UPDATE app_settings SET value = 'true', updated_at = NOW() WHERE key = 'setup_complete';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. VISTAS

CREATE OR REPLACE VIEW player_rankings AS
SELECT 
    p.id,
    p.current_username,
    a.name AS alliance_name,
    a.tag AS alliance_tag,
    p.total_kills,
    p.total_deaths,
    CASE WHEN p.total_deaths > 0 THEN ROUND(p.total_kills::numeric / p.total_deaths, 2) ELSE p.total_kills END AS kd_ratio,
    p.games_played,
    p.last_seen
FROM players p
LEFT JOIN alliances a ON p.current_alliance_id = a.id
WHERE p.total_deaths > 0 OR p.total_kills > 0
ORDER BY p.total_kills DESC;

CREATE OR REPLACE VIEW alliance_stats AS
SELECT 
    a.id,
    a.name,
    a.tag,
    a.active,
    COUNT(p.id) AS player_count,
    COALESCE(SUM(p.total_kills), 0) AS total_kills,
    COALESCE(SUM(p.total_deaths), 0) AS total_deaths,
    CASE WHEN SUM(p.total_deaths) > 0 THEN ROUND(SUM(p.total_kills)::numeric / SUM(p.total_deaths), 2) ELSE SUM(p.total_kills) END AS alliance_kd
FROM alliances a
LEFT JOIN players p ON p.current_alliance_id = a.id
GROUP BY a.id, a.name, a.tag, a.active
ORDER BY total_kills DESC;

-- ============================================================
-- INSTRUCCIONES DE SETUP
-- ============================================================
-- 1. Ve a Authentication > Settings → desactiva "Enable Email Confirmations"
-- 2. Ve a Authentication > Users > Add user → crea tu primer admin
-- 3. Ejecuta: SELECT complete_setup();
-- 4. Para crear código: SELECT create_invite_code();
-- 5. Para eliminar partida: SELECT delete_game_complete('UUID-AQUÍ');
-- ============================================================
