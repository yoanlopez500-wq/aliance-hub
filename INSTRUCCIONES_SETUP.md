# Alliance Hub - Instrucciones de Setup

## 🔑 CÓMO CREAR UN CÓDIGO DE INVITACIÓN EN SUPABASE

### Método 1: Desde la interfaz de Supabase (SQL Editor) - RECOMENDADO

1. Ve a tu proyecto en **Supabase Dashboard**
2. En el menú lateral, click en **SQL Editor**
3. Click en **New query**
4. Pega y ejecuta:

```sql
-- Crear un código de invitación
SELECT create_invite_code();
```

5. Te devolverá algo como: `A3B7C9D2`
6. Copia ese código y dáselo a la persona que quieres invitar

### Método 2: Desde la página web (ya logueado como admin)

1. Entra a tu sitio como admin (`/login.html`)
2. Ve a `/admin/invites.html`
3. Click en **"Generar Código"**
4. Copia el código y compártelo

### Método 3: Insertar manualmente en la tabla

```sql
-- Insertar código manualmente
INSERT INTO admin_invites (code, created_by, expires_at)
VALUES (
    'MICODIGO12',           -- tu código personalizado
    'TU-USER-ID-AQUI',      -- tu UUID de auth.users
    NOW() + INTERVAL '7 days'
);
```

Para obtener tu UUID de usuario:
```sql
SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com';
```

---

## 🔄 MIGRAR USUARIOS DE OTRO PROYECTO SUPABASE

### Opción A: Migrar desde Supabase Auth (más fácil)

Si tu proyecto anterior también usaba **Supabase Auth**, los usuarios ya están en la tabla `auth.users`. Puedes migrarlos de varias formas:

#### 1. Exportar/Importar usuarios (SQL)

En tu proyecto **ANTIGUO**, ejecuta:
```sql
-- Exportar usuarios (solo campos necesarios)
SELECT 
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    last_sign_in_at
FROM auth.users;
```

Copia los resultados y en tu proyecto **NUEVO**:
```sql
-- Insertar usuarios (ajusta los valores)
INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, created_at, raw_app_meta_data
) VALUES (
    'UUID-ANTIGUO',
    'usuario@email.com',
    'HASH-ENCRIPTADO-ANTIGUO',
    '2025-01-15T10:00:00Z',
    '2025-01-15T10:00:00Z',
    '{"provider":"email","providers":["email"]}'
);
```

**⚠️ Problema:** Los hashes de contraseña (`encrypted_password`) usan un "pepper" único por proyecto. Si cambias de proyecto, los hashes **NO funcionarán** y los usuarios tendrían que resetear contraseña.

#### 2. Solución recomendada: Forzar reset de contraseña

En tu proyecto **NUEVO**, crea los usuarios pero con contraseña temporal:

```sql
-- Crear usuario con contraseña temporal (la cambiarán luego)
INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, raw_app_meta_data
) VALUES (
    gen_random_uuid(),  -- o mantén el UUID antiguo
    'usuario@email.com',
    crypt('TempPass123!', gen_salt('bf')),  -- contraseña temporal
    NOW(),
    '{"provider":"email","providers":["email"]}'
);
```

Luego envía a cada usuario un email diciendo:
> "Tu cuenta ha sido migrada. Usa 'TempPass123!' para entrar y cambia tu contraseña en Configuración."

### Opción B: Migrar desde tabla custom (si no usabas Supabase Auth)

Si tu proyecto anterior guardaba usuarios en una tabla custom (ej: `users` o `admins`), necesitas:

1. **Exportar** los datos de tu tabla custom
2. **Crear** los usuarios en `auth.users` del nuevo proyecto
3. **Mapear** los IDs antiguos a los nuevos

#### Paso 1: Exportar datos antiguos

```sql
-- En tu proyecto ANTIGUO
SELECT username, email, password_hash, created_at 
FROM admins;  -- o tu_tabla_de_usuarios
```

#### Paso 2: Crear en auth.users del nuevo proyecto

```sql
-- En tu proyecto NUEVO
-- Por cada usuario, crear entrada en auth.users
INSERT INTO auth.users (
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data
) VALUES (
    'usuario@email.com',
    crypt('NuevaPass123!', gen_salt('bf')),  -- nueva contraseña
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"Tlaloc27","migrated":true}'  -- metadatos extras
);
```

#### Paso 3: Guardar mapeo de IDs (opcional)

Si necesitas mantener relaciones con otras tablas:

```sql
-- Tabla de mapeo
CREATE TABLE user_migration (
    old_id TEXT,           -- ID del proyecto antiguo
    new_id UUID,           -- ID en auth.users del nuevo proyecto
    old_username TEXT,
    migrated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar mapeo
INSERT INTO user_migration (old_id, new_id, old_username)
VALUES ('id-antiguo-123', 'uuid-nuevo-456', 'Tlaloc27');
```

---

## 🎯 SOLUCIÓN MÁS PRÁCTICA PARA TU CASO

Dado que es un proyecto comunitario y quieres que sea fácil:

### Opción recomendada: "Login con link mágico" (sin contraseña)

Supabase soporta **Magic Link** (login sin contraseña, solo email):

1. Ve a **Authentication > Providers** en Supabase
2. Activa **Email > Confirm email** (opcional)
3. En tu `login.html`, añade opción de "Entrar con link mágico"

```javascript
// En login.html
async function sendMagicLink(email) {
    const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
            emailRedirectTo: 'https://tu-sitio.com/admin/index.html'
        }
    });
    if (error) alert(error.message);
    else alert('Revisa tu email para el link de acceso');
}
```

**Ventajas:**
- Los usuarios no necesitan recordar contraseña
- No hay que migrar hashes
- Solo necesitan su email
- Puedes pre-crear los usuarios en auth.users y decirles "usa tu email para entrar"

### Flujo de migración recomendado:

1. **Crea los usuarios en el nuevo proyecto** con sus emails (sin contraseña):
```sql
INSERT INTO auth.users (email, email_confirmed_at, raw_app_meta_data) 
VALUES 
    ('tlaloc27@email.com', NOW(), '{"provider":"email"}'),
    ('otro@email.com', NOW(), '{"provider":"email"}');
```

2. **Diles a tus usuarios:**
> "La plataforma se mudó. Entra con tu email y te enviaremos un link para acceder."

3. **En la página de login**, añaden su email y click "Enviar link mágico"

4. **Reciben email** con link → click → ya están dentro

---

## 📋 RESUMEN RÁPIDO

| Qué quieres | Cómo hacerlo |
|-------------|--------------|
| Crear código de invitación | `SELECT create_invite_code();` en SQL Editor |
| Migrar usuarios de otro Supabase Auth | Problema: hashes no funcionan entre proyectos. Solución: magic links o contraseñas temporales |
| Migrar usuarios de tabla custom | Crear en `auth.users` con `crypt()` + enviar magic links |
| Evitar que usuarios creen cuentas de nuevo | Pre-crear sus emails en `auth.users` + magic links |

¿Quieres que te añada la opción de "Magic Link" al login.html para que sea más fácil?
