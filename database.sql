-- ============================================================
-- Alliance Hub - Esquema de Base de Datos (Supabase)
-- ============================================================
-- Ejecutar esto en el SQL Editor de Supabase (New Query)

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TABLA: alliances (Alianzas)
-- ============================================================
CREATE TABLE alliances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    tag TEXT NOT NULL UNIQUE CHECK (LENGTH(tag) BETWEEN 3 AND 10),
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentarios para documentación
COMMENT ON TABLE alliances IS 'Alianzas de jugadores';
COMMENT ON COLUMN alliances.tag IS 'Tag corto ej: GA, AG, AOE (3-10 caracteres)';
COMMENT ON COLUMN alliances.active IS 'false = alianza penalizada';

-- ============================================================
-- 2. TABLA: players (Jugadores)
-- ============================================================
CREATE TABLE players (
    id BIGINT PRIMARY KEY,
    current_username TEXT NOT NULL,
    current_alliance_id UUID REFERENCES alliances(id) ON DELETE SET NULL,
    total_kills INTEGER DEFAULT 0,
    total_deaths INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE players IS 'Jugadores identificados por su ID del juego';
COMMENT ON COLUMN players.id IS 'ID numérico del jugador en Supremacy 1914';

-- ============================================================
-- 3. TABLA: games (Partidas)
-- ============================================================
CREATE TYPE game_type AS ENUM ('internal', 'duel', 'tournament');
CREATE TYPE game_status AS ENUM ('draft', 'open', 'in_progress', 'finished', 'archived');

CREATE TABLE games (
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

COMMENT ON TABLE games IS 'Partidas y torneos';
COMMENT ON COLUMN games.game_id IS 'ID de la partida en el juego (ej: torneo-aguilas-feb-2025)';
COMMENT ON COLUMN games.status IS 'draft=borrador, open=registro abierto, in_progress=en curso, finished=finalizada, archived=archivada';
COMMENT ON COLUMN games.csv_imported IS 'true = ya se importaron resultados de esta partida';

-- ============================================================
-- 4. TABLA: registrations (Pre-registros)
-- ============================================================
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    accepted_rules BOOLEAN DEFAULT false,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(game_id, player_id)
);

COMMENT ON TABLE registrations IS 'Jugadores registrados en una partida antes de que empiece';

-- ============================================================
-- 5. TABLA: game_results (Resultados por partida)
-- ============================================================
CREATE TABLE game_results (
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

COMMENT ON TABLE game_results IS 'Resultados individuales de cada jugador por partida';
COMMENT ON COLUMN game_results.kd_ratio IS 'Calculado localmente: kills/deaths (ignora el KD del bot)';
COMMENT ON COLUMN game_results.raw_csv_data IS 'Fila completa del CSV original para referencia';

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS) - ABIERTO PARA MVP
-- ============================================================
ALTER TABLE alliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- Políticas abiertas (cualquiera puede leer/escribir)
-- NOTA: Para producción, reemplazar con políticas reales
CREATE POLICY "Allow all" ON alliances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON registrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON game_results FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 7. ÍNDICES (Performance)
-- ============================================================
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_alliance ON games(alliance_id);
CREATE INDEX idx_games_created ON games(created_at DESC);
CREATE INDEX idx_players_alliance ON players(current_alliance_id);
CREATE INDEX idx_players_kills ON players(total_kills DESC);
CREATE INDEX idx_registrations_game ON registrations(game_id);
CREATE INDEX idx_registrations_player ON registrations(player_id);
CREATE INDEX idx_game_results_game ON game_results(game_id);
CREATE INDEX idx_game_results_player ON game_results(player_id);
CREATE INDEX idx_game_results_kd ON game_results(kd_ratio DESC);

-- ============================================================
-- 8. DATOS DE EJEMPLO (Opcional - para testing)
-- ============================================================
-- Descomenta si quieres datos de prueba:

/*
INSERT INTO alliances (name, tag, description) VALUES
    ('Guerreros del Aire', 'GA', 'Alianza principal de la comunidad'),
    ('Águilas de Acero', 'AG', 'Alianza competitiva'),
    ('Alianza de Oro', 'AOE', 'Alianza casual');

INSERT INTO players (id, current_username, current_alliance_id, total_kills, total_deaths, games_played) VALUES
    (99702975, 'Tlaloc27', (SELECT id FROM alliances WHERE tag = 'GA'), 1500, 300, 5),
    (12345678, 'Player2', (SELECT id FROM alliances WHERE tag = 'AG'), 800, 400, 3);

INSERT INTO games (game_id, name, description, type, status, max_players, show_game_id) VALUES
    ('torneo-test-2025', 'Torneo de Prueba', 'Partida de prueba para testing', 'tournament', 'finished', 10, true);
*/

-- ============================================================
-- 9. FUNCIONES ÚTILES (Opcional)
-- ============================================================

-- Función para recalcular stats globales de un jugador
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
$$ LANGUAGE plpgsql;

-- Función para recalcular TODOS los jugadores (útil después de importar)
CREATE OR REPLACE FUNCTION recalc_all_players()
RETURNS VOID AS $$
DECLARE
    p RECORD;
BEGIN
    FOR p IN SELECT id FROM players LOOP
        PERFORM recalc_player_stats(p.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger: auto-recalcular stats al insertar resultado
CREATE OR REPLACE FUNCTION trigger_recalc_player()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalc_player_stats(NEW.player_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_result_insert
    AFTER INSERT ON game_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalc_player();

-- Trigger: auto-recalcular al actualizar resultado
CREATE TRIGGER after_result_update
    AFTER UPDATE ON game_results
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalc_player();

-- ============================================================
-- 10. VISTAS ÚTILES (Opcional)
-- ============================================================

-- Vista: Ranking global de jugadores con KD
CREATE OR REPLACE VIEW player_rankings AS
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

-- Vista: Stats por alianza
CREATE OR REPLACE VIEW alliance_stats AS
SELECT 
    a.id,
    a.name,
    a.tag,
    a.active,
    COUNT(p.id) AS player_count,
    COALESCE(SUM(p.total_kills), 0) AS total_kills,
    COALESCE(SUM(p.total_deaths), 0) AS total_deaths,
    CASE 
        WHEN SUM(p.total_deaths) > 0 THEN ROUND(SUM(p.total_kills)::numeric / SUM(p.total_deaths), 2)
        ELSE SUM(p.total_kills)
    END AS alliance_kd
FROM alliances a
LEFT JOIN players p ON p.current_alliance_id = a.id
GROUP BY a.id, a.name, a.tag, a.active
ORDER BY total_kills DESC;

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
