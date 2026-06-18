
-- ============================================================
-- DIAGNÓSTICO Y ARREGLOS RÁPIDOS
-- Ejecutar esto si tienes problemas con códigos o login
-- ============================================================

-- 1. VER códigos de invitación existentes
SELECT 
    id,
    code,
    used,
    created_at,
    expires_at,
    CASE 
        WHEN expires_at < NOW() THEN 'EXPIRADO'
        WHEN used = true THEN 'USADO'
        ELSE 'ACTIVO'
    END as estado
FROM admin_invites
ORDER BY created_at DESC;

-- 2. VER usuarios en auth.users
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- 3. CREAR un nuevo código de invitación manualmente
-- (si la función RPC no funciona)
INSERT INTO admin_invites (code, created_by, expires_at)
VALUES (
    upper(substring(md5(random()::text) from 1 for 8)),
    (SELECT id FROM auth.users LIMIT 1),  -- usa el primer usuario como creador
    NOW() + INTERVAL '7 days'
)
RETURNING code;

-- 4. LIMPIAR códigos expirados (opcional)
-- DELETE FROM admin_invites WHERE expires_at < NOW() AND used = false;

-- 5. VERIFICAR que la tabla admin_invites existe y tiene datos
SELECT COUNT(*) as total_invites FROM admin_invites;
SELECT COUNT(*) as activos FROM admin_invites WHERE used = false AND expires_at > NOW();

-- 6. SI EL LOGIN FALLA con "Invalid credentials", verificar que el usuario existe
-- y que email_confirmed_at no es NULL (si tienes confirmación activada)

-- 7. FORZAR confirmación de email para un usuario (si la tienes desactivada en settings
-- pero el usuario fue creado antes)
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'tu-email@ejemplo.com';

-- 8. CREAR un usuario manualmente (si el signup no funciona)
-- Primero, asegúrate de que la extensión pgcrypto esté disponible
-- (Supabase ya la tiene por defecto)

-- Insertar usuario con contraseña conocida
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data
) VALUES (
    gen_random_uuid(),
    'nuevo-admin@ejemplo.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"admin"}'
)
ON CONFLICT (email) DO NOTHING;

-- 9. RESETEAR contraseña de un usuario existente
UPDATE auth.users 
SET encrypted_password = crypt('nueva-password', gen_salt('bf'))
WHERE email = 'tu-email@ejemplo.com';
