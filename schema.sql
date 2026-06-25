-- ============================================
-- ALLIANCE HUB V2.2 - SCHEMA COMPLETO (CORREGIDO)
-- Orden de tablas: admin_users ANTES de alliance_memberships
-- ============================================

DROP SCHEMA IF EXISTS v2 CASCADE;
CREATE SCHEMA v2;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TIPOS ENUM
-- ============================================
CREATE TYPE v2.match_type AS ENUM (
    'internal', 'duel', 'public_31', 'public_500', 'public_quick'
);

CREATE TYPE v2.match_status AS ENUM (
    'draft', 'open', 'in_progress', 'finished', 'archived', 'cancelled'
);

CREATE TYPE v2.registration_status AS ENUM (
    'pending', 'confirmed', 'no_show', 'played', 'rejected', 'pending_approval', 'approved'
);

CREATE TYPE v2.admin_role AS ENUM (
    'superadmin', 'event_admin', 'alliance_leader', 'moderator'
);

CREATE TYPE v2.membership_status AS ENUM (
    'pending', 'approved', 'rejected', 'left'
);

-- ============================================
-- TABLA 1: PLAYERS
-- ============================================
CREATE TABLE v2.players (
    id BIGINT PRIMARY KEY,
    current_username TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'banned', 'suspended')),
    strikes INTEGER DEFAULT 0,
    total_kills INTEGER DEFAULT 0,
    total_deaths INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA 2: ALLIANCES
-- ============================================
CREATE TABLE v2.alliances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    tag TEXT NOT NULL UNIQUE CHECK (LENGTH(tag) BETWEEN 2 AND 10),
    description TEXT,
    leader_id BIGINT REFERENCES v2.players(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'penalized')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA 3: ADMIN_USERS (MOVIDA AQUI - antes de alliance_memberships)
-- ============================================
CREATE TABLE v2.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    role v2.admin_role NOT NULL DEFAULT 'alliance_leader',
    alliance_id UUID REFERENCES v2.alliances(id),
    display_name TEXT,
    supremacy_player_id BIGINT REFERENCES v2.players(id),
    approved_by UUID REFERENCES v2.admin_users(id),
    approved_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA 4: ALLIANCE_MEMBERSHIPS (ahora admin_users ya existe)
-- ============================================
CREATE TABLE v2.alliance_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id BIGINT NOT NULL REFERENCES v2.players(id),
    alliance_id UUID NOT NULL REFERENCES v2.alliances(id),
    status v2.membership_status DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_by UUID REFERENCES v2.admin_users(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    UNIQUE(player_id)
);

-- ============================================
-- TABLA 5: LEAGUES
-- ============================================
CREATE TABLE v2.leagues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    season TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA 6: MATCHES
-- ============================================
CREATE TABLE v2.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_type v2.match_type NOT NULL,
    name TEXT NOT NULL,
    game_id TEXT,
    description TEXT,
    alliance_id UUID REFERENCES v2.alliances(id),
    alliance_a_id UUID REFERENCES v2.alliances(id),
    alliance_b_id UUID REFERENCES v2.alliances(id),
    league_id UUID REFERENCES v2.leagues(id),
    round INTEGER,
    max_players INTEGER NOT NULL DEFAULT 10,
    status v2.match_status DEFAULT 'draft',
    winners_declared BOOLEAN DEFAULT false,
    rules_url TEXT,
    password TEXT,
    show_game_id BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT false,
    is_private BOOLEAN DEFAULT false,
    share_token UUID DEFAULT gen_random_uuid(),
    referee_id BIGINT REFERENCES v2.players(id),
    auto_delete_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    csv_imported BOOLEAN DEFAULT false,
    notifications_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA 7: MATCH_WINNERS
-- ============================================
CREATE TABLE v2.match_winners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES v2.matches(id) ON DELETE CASCADE,
    player_id BIGINT NOT NULL REFERENCES v2.players(id),
    position INTEGER NOT NULL CHECK (position IN (1, 2, 3)),
    declared_by UUID REFERENCES v2.admin_users(id),
    declared_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id, position),
    UNIQUE(match_id, player_id)
);

-- ============================================
-- TABLA 8: MATCH_REGISTRATIONS
-- ============================================
CREATE TABLE v2.match_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES v2.matches(id) ON DELETE CASCADE,
    player_id BIGINT REFERENCES v2.players(id),
    nation TEXT,
    status v2.registration_status DEFAULT 'pending',
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID,
    notes TEXT,
    UNIQUE(match_id, player_id)
);

-- ============================================
-- TABLA 9: MATCH_RESULTS
-- ============================================
CREATE TABLE v2.match_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES v2.matches(id) ON DELETE CASCADE,
    player_id BIGINT REFERENCES v2.players(id),
    nation TEXT,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    kd_ratio DECIMAL(10,2) DEFAULT 0,
    raw_csv_data TEXT[],
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id, player_id)
);

-- ============================================
-- TABLA 10: LEAGUE_SCHEDULE
-- ============================================
CREATE TABLE v2.league_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES v2.leagues(id),
    match_id UUID REFERENCES v2.matches(id),
    round INTEGER,
    scheduled_at TIMESTAMPTZ,
    alliance_a_id UUID REFERENCES v2.alliances(id),
    alliance_b_id UUID REFERENCES v2.alliances(id),
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'no_show_a', 'no_show_b', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA 11: ALLIANCE_CHAT
-- ============================================
CREATE TABLE v2.alliance_chat (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES v2.matches(id),
    alliance_id UUID REFERENCES v2.alliances(id),
    sender_id BIGINT REFERENCES v2.players(id),
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA 12: PUSH_SUBSCRIPTIONS
-- ============================================
CREATE TABLE v2.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    player_id BIGINT REFERENCES v2.players(id),
    alliance_id UUID REFERENCES v2.alliances(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA 13: ADMIN_INVITES
-- ============================================
CREATE TABLE v2.admin_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    role v2.admin_role NOT NULL DEFAULT 'alliance_leader',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used BOOLEAN DEFAULT false,
    used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA 14: AUDIT_LOG
-- ============================================
CREATE TABLE v2.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    table_name TEXT,
    record_id TEXT,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA 15: APP_SETTINGS
-- ============================================
CREATE TABLE v2.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA 16: MATCH_CREATION_LOG
-- ============================================
CREATE TABLE v2.match_creation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES v2.admin_users(id),
    match_id UUID REFERENCES v2.matches(id),
    match_type v2.match_type NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA 17: CHAT_REPORTS
-- ============================================
CREATE TABLE v2.chat_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL,
    reported_message_id TEXT,
    reporter_id TEXT NOT NULL,
    reporter_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    context_messages JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    reviewed_by UUID REFERENCES v2.admin_users(id),
    reviewed_at TIMESTAMPTZ,
    resolution TEXT,
    reported_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE v2.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.alliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.alliance_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.match_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.match_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.league_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.alliance_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.admin_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.match_creation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2.chat_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all v2" ON v2.players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.alliances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.admin_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.alliance_memberships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.leagues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.match_winners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.match_registrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.match_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.league_schedule FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.alliance_chat FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.push_subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.admin_invites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.match_creation_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all v2" ON v2.chat_reports FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- INDICES
-- ============================================
CREATE INDEX idx_v2_players_status ON v2.players(status);
CREATE INDEX idx_v2_matches_type ON v2.matches(match_type);
CREATE INDEX idx_v2_matches_status ON v2.matches(status);
CREATE INDEX idx_v2_matches_alliance ON v2.matches(alliance_id);
CREATE INDEX idx_v2_matches_league ON v2.matches(league_id);
CREATE INDEX idx_v2_matches_private ON v2.matches(is_private);
CREATE INDEX idx_v2_matches_share_token ON v2.matches(share_token);
CREATE INDEX idx_v2_matches_created_by ON v2.matches(created_by);
CREATE INDEX idx_v2_winners_match ON v2.match_winners(match_id);
CREATE INDEX idx_v2_winners_player ON v2.match_winners(player_id);
CREATE INDEX idx_v2_registrations_match ON v2.match_registrations(match_id);
CREATE INDEX idx_v2_registrations_player ON v2.match_registrations(player_id);
CREATE INDEX idx_v2_registrations_status ON v2.match_registrations(status);
CREATE INDEX idx_v2_results_match ON v2.match_results(match_id);
CREATE INDEX idx_v2_results_player ON v2.match_results(player_id);
CREATE INDEX idx_v2_chat_match ON v2.alliance_chat(match_id);
CREATE INDEX idx_v2_push_player ON v2.push_subscriptions(player_id);
CREATE INDEX idx_v2_push_alliance ON v2.push_subscriptions(alliance_id);
CREATE INDEX idx_v2_invites_code ON v2.admin_invites(code);
CREATE INDEX idx_v2_schedule_league ON v2.league_schedule(league_id);
CREATE INDEX idx_v2_creation_log_admin ON v2.match_creation_log(admin_id);
CREATE INDEX idx_v2_creation_log_date ON v2.match_creation_log(created_at);
CREATE INDEX idx_chat_reports_status ON v2.chat_reports(status);
CREATE INDEX idx_chat_reports_channel ON v2.chat_reports(channel);
CREATE INDEX idx_chat_reports_reporter ON v2.chat_reports(reporter_id);
CREATE INDEX idx_v2_memberships_player ON v2.alliance_memberships(player_id);
CREATE INDEX idx_v2_memberships_alliance ON v2.alliance_memberships(alliance_id);
CREATE INDEX idx_v2_memberships_status ON v2.alliance_memberships(status);

-- ============================================
-- FUNCIONES RPC
-- ============================================
CREATE OR REPLACE FUNCTION v2.create_invite_code(p_role TEXT DEFAULT 'alliance_leader')
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    exists_check BOOLEAN;
BEGIN
    LOOP
        new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
        SELECT EXISTS(SELECT 1 FROM v2.admin_invites WHERE code = new_code) INTO exists_check;
        EXIT WHEN NOT exists_check;
    END LOOP;
    INSERT INTO v2.admin_invites (code, role, created_by, expires_at)
    VALUES (new_code, p_role::v2.admin_role, auth.uid(), NOW() + INTERVAL '7 days');
    RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION v2.can_create_match(p_admin_id UUID, p_match_type v2.match_type)
RETURNS BOOLEAN AS $$
DECLARE
    admin_role v2.admin_role;
    matches_this_month INTEGER;
BEGIN
    SELECT role INTO admin_role FROM v2.admin_users WHERE id = p_admin_id;
    IF admin_role = 'superadmin' THEN RETURN true; END IF;
    SELECT COUNT(*) INTO matches_this_month
    FROM v2.match_creation_log
    WHERE admin_id = p_admin_id AND match_type = p_match_type AND created_at >= DATE_TRUNC('month', NOW());
    RETURN matches_this_month < 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION v2.log_match_creation(p_match_id UUID)
RETURNS void AS $$
DECLARE
    v_admin_id UUID;
    v_match_type v2.match_type;
BEGIN
    SELECT created_by, match_type INTO v_admin_id, v_match_type FROM v2.matches WHERE id = p_match_id;
    IF v_admin_id IS NOT NULL THEN
        INSERT INTO v2.match_creation_log (admin_id, match_id, match_type) VALUES (v_admin_id, p_match_id, v_match_type);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION v2.can_finish_match(p_match_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    winner_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO winner_count FROM v2.match_winners WHERE match_id = p_match_id;
    RETURN winner_count >= 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION v2.complete_setup()
RETURNS void AS $$
BEGIN
    INSERT INTO v2.app_settings (key, value) VALUES ('setup_complete', 'true')
    ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW();
    INSERT INTO v2.app_settings (key, value) VALUES ('cache_version', 'v2.2')
    ON CONFLICT (key) DO UPDATE SET value = 'v2.2', updated_at = NOW();
    INSERT INTO v2.app_settings (key, value) VALUES ('force_clear_cache', 'false')
    ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION v2.handle_no_show()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'no_show' AND OLD.status != 'no_show' THEN
        UPDATE v2.players SET strikes = strikes + 1, status = CASE WHEN strikes + 1 >= 3 THEN 'suspended' ELSE status END WHERE id = NEW.player_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_no_show_strike
AFTER UPDATE ON v2.match_registrations
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'no_show')
EXECUTE FUNCTION v2.handle_no_show();

CREATE OR REPLACE FUNCTION v2.handle_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending_approval' THEN
        RAISE NOTICE 'Jugador % aprobado en partida %', NEW.player_id, NEW.match_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_approval_notify
AFTER UPDATE ON v2.match_registrations
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'approved')
EXECUTE FUNCTION v2.handle_approval();

CREATE OR REPLACE FUNCTION v2.handle_archive()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'archived' AND OLD.status != 'archived' THEN
        NEW.is_private := true;
        RAISE NOTICE 'Partida % archivada - ahora es privada', NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_archive_private
BEFORE UPDATE ON v2.matches
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'archived')
EXECUTE FUNCTION v2.handle_archive();

CREATE OR REPLACE FUNCTION v2.handle_winners_declared()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE v2.matches SET winners_declared = true WHERE id = NEW.match_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_winners_declared
AFTER INSERT ON v2.match_winners
FOR EACH ROW EXECUTE FUNCTION v2.handle_winners_declared();

CREATE OR REPLACE FUNCTION v2.audit_alliance_membership()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO v2.audit_log (admin_id, action, table_name, record_id, new_data)
        VALUES (auth.uid(), 'alliance_membership_' || NEW.status, 'alliance_memberships', NEW.id::text, row_to_json(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO v2.audit_log (admin_id, action, table_name, record_id, old_data, new_data)
        VALUES (auth.uid(), 'alliance_membership_updated', 'alliance_memberships', NEW.id::text, row_to_json(OLD), row_to_json(NEW));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_audit_membership
AFTER INSERT OR UPDATE ON v2.alliance_memberships
FOR EACH ROW EXECUTE FUNCTION v2.audit_alliance_membership();

CREATE OR REPLACE FUNCTION v2.audit_match_winners()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO v2.audit_log (admin_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), 'winner_declared_position_' || NEW.position, 'match_winners', NEW.id::text, row_to_json(NEW));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_audit_winners
AFTER INSERT ON v2.match_winners
FOR EACH ROW EXECUTE FUNCTION v2.audit_match_winners();

CREATE OR REPLACE FUNCTION v2.recalc_player_stats(p_player_id BIGINT)
RETURNS void AS $$
DECLARE
    total_kills INTEGER; total_deaths INTEGER; games_count INTEGER;
BEGIN
    SELECT COALESCE(SUM(kills), 0), COALESCE(SUM(deaths), 0), COUNT(*) INTO total_kills, total_deaths, games_count FROM v2.match_results WHERE player_id = p_player_id;
    UPDATE v2.players SET total_kills = total_kills, total_deaths = total_deaths, games_played = games_count WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION v2.notify_new_match()
RETURNS TRIGGER AS $$
DECLARE match_url TEXT;
BEGIN
    IF NEW.status = 'open' AND (OLD.status IS NULL OR OLD.status != 'open') THEN
        match_url := 'https://' || current_setting('app.settings.supabase_url') || '/functions/v1/push-notify';
        PERFORM net.http_post(url := match_url, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')), body := jsonb_build_object('match_id', NEW.id, 'match_type', NEW.match_type, 'alliance_id', NEW.alliance_id));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_new_match
AFTER INSERT OR UPDATE ON v2.matches
FOR EACH ROW EXECUTE FUNCTION v2.notify_new_match();

CREATE OR REPLACE FUNCTION v2.cleanup_quick_matches()
RETURNS void AS $$
BEGIN
    DELETE FROM v2.match_registrations WHERE match_id IN (SELECT id FROM v2.matches WHERE match_type = 'public_quick' AND auto_delete_at < NOW());
    DELETE FROM v2.match_results WHERE match_id IN (SELECT id FROM v2.matches WHERE match_type = 'public_quick' AND auto_delete_at < NOW());
    DELETE FROM v2.matches WHERE match_type = 'public_quick' AND auto_delete_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VISTAS
-- ============================================
CREATE OR REPLACE VIEW v2.vw_player_rankings AS
SELECT p.id, p.current_username, a.name AS alliance_name, a.tag AS alliance_tag, p.games_played, p.total_kills, p.total_deaths,
    CASE WHEN p.total_deaths > 0 THEN ROUND(p.total_kills::numeric / p.total_deaths, 2) ELSE p.total_kills END AS kd_ratio,
    p.strikes, p.status
FROM v2.players p
LEFT JOIN v2.alliance_memberships am ON am.player_id = p.id AND am.status = 'approved'
LEFT JOIN v2.alliances a ON am.alliance_id = a.id
WHERE p.total_deaths > 0 OR p.total_kills > 0
ORDER BY p.total_kills DESC;

CREATE OR REPLACE VIEW v2.vw_alliance_rankings AS
SELECT a.id AS alliance_id, a.name AS alliance_name, a.tag AS alliance_tag, p.id AS player_id, p.current_username, p.games_played, p.total_kills, p.total_deaths,
    CASE WHEN p.total_deaths > 0 THEN ROUND(p.total_kills::numeric / p.total_deaths, 2) ELSE p.total_kills END AS kd_ratio, p.strikes, p.status
FROM v2.alliances a
JOIN v2.alliance_memberships am ON am.alliance_id = a.id AND am.status = 'approved'
JOIN v2.players p ON p.id = am.player_id
WHERE p.total_deaths > 0 OR p.total_kills > 0
ORDER BY a.name, p.total_kills DESC;

CREATE OR REPLACE VIEW v2.vw_match_winners AS
SELECT m.id AS match_id, m.name AS match_name, m.match_type, mw.position, p.id AS player_id, p.current_username, mw.declared_at, au.display_name AS declared_by_name
FROM v2.matches m
JOIN v2.match_winners mw ON mw.match_id = m.id
JOIN v2.players p ON p.id = mw.player_id
LEFT JOIN v2.admin_users au ON au.id = mw.declared_by
ORDER BY m.created_at DESC, mw.position ASC;

CREATE OR REPLACE VIEW v2.vw_alliance_matches AS
SELECT m.*, a.name AS alliance_name, a.tag AS alliance_tag, CASE WHEN m.match_type = 'internal' THEN 'Interna' WHEN m.match_type = 'duel' THEN 'Duelo' ELSE 'Pública' END AS type_label
FROM v2.matches m
JOIN v2.alliances a ON a.id = m.alliance_id
WHERE m.is_private = false OR m.match_type = 'internal' OR m.match_type = 'duel';

-- ============================================
-- INSERTS INICIALES
-- ============================================
INSERT INTO v2.alliances (name, tag, description, status) VALUES ('Global', 'GLB', 'Partidas abiertas a todos', 'active') ON CONFLICT DO NOTHING;
INSERT INTO v2.app_settings (key, value) VALUES ('setup_complete', 'false'), ('cache_version', 'v2.2'), ('force_clear_cache', 'false') ON CONFLICT (key) DO NOTHING;
