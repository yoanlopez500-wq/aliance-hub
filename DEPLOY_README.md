# 🚀 Checklist de Despliegue - Alliance Hub

## 1. Configurar Supabase (OBLIGATORIO)

Abre `assets/js/config.js` y reemplaza:
```javascript
const SUPABASE_URL = 'https://TU-PROJECT.supabase.co';  // ← Tu URL real
const SUPABASE_ANON_KEY = 'TU-ANON-KEY';                  // ← Tu anon key real
```

**¿Dónde encontrar estos valores?**
1. Ve a https://app.supabase.com
2. Selecciona tu proyecto
3. Click en **Settings** (rueda dentada) → **API**
4. Copia:
   - **Project URL** → SUPABASE_URL
   - **anon public** → SUPABASE_ANON_KEY

## 2. Ejecutar SQL en Supabase (OBLIGATORIO)

En el **SQL Editor** de Supabase, ejecuta en este orden:

### Paso 1: Tablas base
```sql
-- Copia y pega TODO el contenido de database.sql
-- (El archivo database.sql que te di anteriormente)
```

### Paso 2: Auth + Invitaciones
```sql
-- Copia y pega TODO el contenido de database_auth_update.sql
```

### Paso 3: Recálculo automático de rankings
```sql
-- Copia y pega TODO el contenido de database_recalc.sql
```

### Paso 4: Setup inicial
```sql
-- Desactivar confirmación de email (para MVP)
-- Ve a Authentication > Settings > Enable Email Confirmations = OFF

-- Crear tu primer usuario admin
-- Ve a Authentication > Users > Add User

-- Marcar setup como completo
SELECT complete_setup();
```

## 3. Subir a GitHub Pages

### Si usas el repo `Supremacy_proyect`:

```bash
# En tu carpeta local del proyecto
git init
git add .
git commit -m "Alliance Hub MVP"
git remote add origin https://github.com/YoanLopez500-wq/Supremacy_proyect.git
git push -u origin main
```

### Activar GitHub Pages:
1. Ve a tu repo en GitHub
2. **Settings** → **Pages**
3. **Source**: Deploy from a branch
4. **Branch**: main / root
5. Guarda

### URL final:
```
https://yoanlopez500-wq.github.io/Supremacy_proyect/
```

## 4. Verificar que funciona

Abre la URL y revisa la consola (F12):
- ✅ No debería haber errores rojos de 404
- ✅ El SW debería registrarse correctamente
- ✅ Los iconos deberían cargar (no 404)
- ✅ Supabase debería conectar (no 404 en las peticiones)

## 5. Iconos (OPCIONAL pero recomendado)

Los iconos actuales son **placeholders** de color ámbar. Para reemplazarlos:

1. Ve a https://favicon.io/ o similar
2. Sube tu logo/imagen
3. Descarga los PNGs en todos los tamaños
4. Reemplaza los archivos en `assets/icons/`

## ❌ Errores comunes y soluciones

| Error | Solución |
|-------|----------|
| `404` en `service-worker.js` | El archivo no está en la raíz del repo. Verifica que está en `Supremacy_proyect/service-worker.js` |
| `404` en `assets/...` | Las rutas en los HTML deben ser relativas (sin `/` al inicio) |
| `404` en Supabase | Verifica que `config.js` tiene la URL y ANON_KEY correctos |
| `Email not confirmed` | Ve a Supabase → Auth → Settings → Desactiva "Enable Email Confirmations" |
| `Invalid login credentials` | El usuario no existe en `auth.users`. Créalo manualmente en Supabase |
| Rankings no se actualizan | Ejecuta `database_recalc.sql` para crear los triggers automáticos |

## 🎯 Para tu evento del 20

1. **Crea alianza** → `/admin/alliances.html`
2. **Crea partida** → `/admin/games.html`
3. **Comparte link** de la partida a los jugadores
4. **Jugadores se registran** → `/register/index.html?game=UUID`
5. **Después del evento** → Importa CSV en `/admin/import.html`
6. **Rankings se actualizan** automáticamente

¡Listo! 🎉
