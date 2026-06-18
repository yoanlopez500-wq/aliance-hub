
-- ============================================================
-- ACTUALIZACIÓN: Sistema de Auth Seguro + Códigos de Invitación
-- Ejecutar DESPUÉS del SQL inicial (database.sql)
-- ============================================================

-- 1. Tabla de códigos de invitación para nuevos admins
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

COMMENT ON TABLE admin_invites IS 'Códigos de invitación para crear nuevas cuentas de admin';

-- 2. Tabla para marcar quién es el admin principal (el que crea códigos)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar flag de setup completado (solo si no existe)
INSERT INTO app_settings (key, value) VALUES ('setup_complete', 'false')
ON CONFLICT (key) DO NOTHING;

-- 3. ACTUALIZAR RLS - Más seguro: lectura pública, escritura solo autenticada
-- NOTA: PostgreSQL NO soporta CREATE POLICY IF NOT EXISTS
-- Usamos DROP POLICY IF EXISTS + CREATE POLICY

-- alliances
DROP POLICY IF EXISTS "Public read alliances" ON alliances;
CREATE POLICY "Public read alliances" ON alliances FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth write alliances" ON alliances;
CREATE POLICY "Auth write alliances" ON alliances FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- players
DROP POLICY IF EXISTS "Public read players" ON players;
CREATE POLICY "Public read players" ON players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth write players" ON players;
CREATE POLICY "Auth write players" ON players FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- games
DROP POLICY IF EXISTS "Public read games" ON games;
CREATE POLICY "Public read games" ON games FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth write games" ON games;
CREATE POLICY "Auth write games" ON games FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- registrations
DROP POLICY IF EXISTS "Public read registrations" ON registrations;
CREATE POLICY "Public read registrations" ON registrations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth write registrations" ON registrations;
CREATE POLICY "Auth write registrations" ON registrations FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- game_results
DROP POLICY IF EXISTS "Public read game_results" ON game_results;
CREATE POLICY "Public read game_results" ON game_results FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth write game_results" ON game_results;
CREATE POLICY "Auth write game_results" ON game_results FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- admin_invites
DROP POLICY IF EXISTS "Auth manage invites" ON admin_invites;
CREATE POLICY "Auth manage invites" ON admin_invites FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 4. FUNCIÓN para crear códigos de invitación (solo si eres admin autenticado)
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

-- 5. FUNCIÓN para verificar si el setup inicial está completo
CREATE OR REPLACE FUNCTION is_setup_complete()
RETURNS BOOLEAN AS $$
DECLARE
    result BOOLEAN;
BEGIN
    SELECT value::boolean INTO result FROM app_settings WHERE key = 'setup_complete';
    RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FUNCIÓN para completar setup
CREATE OR REPLACE FUNCTION complete_setup()
RETURNS VOID AS $$
BEGIN
    UPDATE app_settings SET value = 'true', updated_at = NOW() WHERE key = 'setup_complete';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. VISTA para ver admins activos
CREATE OR REPLACE VIEW admin_users AS
SELECT 
    au.id,
    au.email,
    au.created_at,
    au.last_sign_in_at
FROM auth.users au
WHERE au.email_confirmed_at IS NOT NULL;

-- ============================================================
-- INSTRUCCIONES DE SETUP INICIAL EN SUPABASE:
-- ============================================================
-- 
-- PASO 1: Ve a Authentication > Settings en tu dashboard de Supabase
-- PASO 2: Asegúrate de que "Enable Email Confirmations" esté DESACTIVADO 
--         (para MVP, sin confirmación por email)
-- PASO 3: Ve a Authentication > Users > Add user
-- PASO 4: Crea tu primer usuario admin con email + password
-- PASO 5: EJECUTA en SQL Editor: SELECT complete_setup();
-- PASO 6: Para invitar a alguien más, ejecuta: SELECT create_invite_code();
--         Te devolverá un código como "A3B7C9D2"
-- PASO 7: Dale ese código a la persona, que lo usará en la pestaña 
--         "Nuevo Admin (código)" del login
--
-- ============================================================
