
-- ============================================================
-- ARREGLO RLS PARA MVP - Políticas más permisivas
-- ============================================================
-- El problema: Las políticas actuales requieren 'authenticated' pero
-- durante el signup el usuario aún NO está autenticado.
-- Solución: Políticas abiertas para lectura en admin_invites, 
-- y autenticación solo para escritura.

-- 1. DESACTIVAR RLS temporalmente en admin_invites para diagnosticar
-- (solo si quieres probar rápido, luego reactiva)
-- ALTER TABLE admin_invites DISABLE ROW LEVEL SECURITY;

-- 2. POLÍTICA CORRECTA para admin_invites:
-- Cualquiera puede LEER códigos (necesario para signup)
-- Solo autenticados pueden CREAR/MODIFICAR
DROP POLICY IF EXISTS "Auth manage invites" ON admin_invites;
DROP POLICY IF EXISTS "Public read invites" ON admin_invites;

CREATE POLICY "Public read invites" ON admin_invites
    FOR SELECT USING (true);

CREATE POLICY "Auth write invites" ON admin_invites
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 3. VERIFICAR que RLS está activado
ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;

-- 4. VERIFICAR políticas existentes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'admin_invites';

-- 5. PROBAR consulta directa (debería funcionar ahora)
SELECT * FROM admin_invites WHERE used = false LIMIT 1;

-- ============================================================
-- SI SIGUE FALLANDO: Desactivar RLS completamente para MVP
-- (menos seguro pero funcional para tu evento del 20)
-- ============================================================

-- Descomenta estas líneas si necesitas que funcione YA:
-- ALTER TABLE admin_invites DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE alliances DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE players DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE games DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE registrations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE game_results DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- INSTRUCCIONES:
-- 1. Ejecuta este SQL completo en Supabase SQL Editor
-- 2. Prueba el signup de nuevo
-- 3. Si funciona, RLS era el problema
-- 4. Para producción, vuelve a activar RLS con políticas correctas
-- ============================================================
