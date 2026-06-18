
-- ============================================================
-- DIAGNÓSTICO COMPLETO - Códigos de Invitación
-- Ejecutar TODO esto en SQL Editor y copiar resultados
-- ============================================================

-- 1. ¿Existe la tabla admin_invites?
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_invites'
) as tabla_existe;

-- 2. ¿Cuántos códigos hay?
SELECT COUNT(*) as total FROM admin_invites;

-- 3. Ver TODOS los códigos (incluyendo usados y expirados)
SELECT 
    id,
    code,
    used,
    created_at,
    expires_at,
    used_by,
    CASE 
        WHEN expires_at < NOW() THEN 'EXPIRADO'
        WHEN used = true THEN 'USADO'
        ELSE 'ACTIVO'
    END as estado
FROM admin_invites
ORDER BY created_at DESC;

-- 4. Buscar código específico (reemplaza '3551CC00' con tu código)
SELECT * FROM admin_invites WHERE code = '3551CC00';

-- 5. Verificar RLS está activado
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'admin_invites';

-- 6. Verificar políticas de admin_invites
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'admin_invites';

-- 7. Verificar que la función create_invite_code existe
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'create_invite_code';

-- 8. CREAR un código manualmente (si todo lo demás falla)
-- Descomenta y ejecuta:
-- INSERT INTO admin_invites (code, created_by, expires_at)
-- VALUES (
--     'CODIGO1234',  -- tu código personalizado
--     (SELECT id FROM auth.users WHERE email = 'tu-email@gmail.com'),  -- tu UUID
--     NOW() + INTERVAL '7 days'
-- )
-- RETURNING code;

-- 9. Si no tienes usuarios en auth.users, crea uno primero:
-- INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data)
-- VALUES (
--     'tu-email@gmail.com',
--     crypt('password123', gen_salt('bf')),
--     NOW(),
--     '{"provider":"email"}'
-- )
-- ON CONFLICT (email) DO NOTHING;
