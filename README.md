# Alliance Hub - MVP

Plataforma de rankings y gestión para comunidades de **Supremacy 1914**.

## 🎯 Propósito

Permite a comunidades de jugadores de Supremacy 1914:
- Crear y gestionar partidas/torneos
- Registrar jugadores con pre-registro
- Importar resultados desde CSV exportado por bot de Discord
- Visualizar rankings globales por jugador y alianza
- Editar manualmente la base de datos desde panel de admin

## 📁 Estructura del Proyecto

```
alliance-hub/
├── index.html              ← Home público (listado de partidas, stats)
├── login.html              ← Login simple para admin (1 solo admin)
├── rankings.html           ← Rankings públicos (jugadores + alianzas)
├── game.html               ← Página pública de una partida (reglas, resultados)
├── player.html             ← Perfil público de jugador (historial, stats)
├── 404.html                ← Redirect para SPA routing en GitHub Pages
├── register/
│   └── index.html          ← Formulario de pre-registro a partida
├── admin/
│   ├── index.html          ← Dashboard con stats y top jugadores
│   ├── games.html          ← CRUD completo de partidas (crear/editar/eliminar)
│   ├── game-detail.html    ← Detalle de partida: registrados, resultados, cambiar estado
│   ├── alliances.html      ← CRUD de alianzas (activar/penalizar)
│   ├── players.html        ← Edición manual de jugadores (username, stats, alianza)
│   └── import.html         ← Importador de CSV del bot de Discord
└── assets/
    ├── js/
    │   ├── config.js       ← Variables Supabase (URL, ANON_KEY, password admin)
    │   ├── auth.js         ← Login simple con sessionStorage (1 solo admin)
    │   ├── csv-parser.js   ← Parser específico para CSV del bot de Supremacy 1914
    │   └── ui-utils.js     ← Funciones compartidas (toast, formatos, badges)
    └── css/
        └── style.css       ← Estilos adicionales (scrollbar, animaciones, responsive)
```

## 🗄️ Esquema de Base de Datos (Supabase)

### Tablas

#### `alliances`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid (PK) | ID único |
| name | text | Nombre de la alianza |
| tag | text (3-10 chars) | Tag corto ej: GA, AG |
| description | text | Descripción opcional |
| active | boolean | true = activa, false = penalizada |
| created_at | timestamptz | Fecha creación |

#### `players`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | bigint (PK) | ID del jugador en el juego (ej: 99702975) |
| current_username | text | Username actual |
| current_alliance_id | uuid (FK) | Alianza actual |
| total_kills | integer | Bajas totales acumuladas |
| total_deaths | integer | Muertes totales acumuladas |
| games_played | integer | Partidas jugadas |
| last_seen | timestamptz | Última actualización |
| created_at | timestamptz | Fecha primer registro |

#### `games`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid (PK) | ID único interno |
| game_id | text | ID de la partida en el juego |
| name | text | Nombre visible |
| description | text | Descripción |
| type | enum | internal (max 10), duel, tournament |
| status | enum | draft, open, in_progress, finished, archived |
| max_players | integer | Máximo de jugadores |
| alliance_id | uuid (FK) | Alianza asociada (null = global) |
| rules_pdf_url | text | URL del PDF de reglas (Drive) |
| password | text | Contraseña de partida (null = pública) |
| show_game_id | boolean | Mostrar ID públicamente |
| csv_imported | boolean | Ya se importaron resultados |
| created_at | timestamptz | Fecha creación |

#### `registrations`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid (PK) | ID único |
| game_id | uuid (FK) | Partida |
| player_id | bigint (FK) | Jugador |
| username | text | Username al registrarse |
| accepted_rules | boolean | Aceptó reglas |
| registered_at | timestamptz | Fecha registro |

#### `game_results`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid (PK) | ID único |
| game_id | uuid (FK) | Partida |
| player_id | bigint (FK) | Jugador |
| nation | text | Nación jugada |
| kills | integer | Bajas en esta partida |
| deaths | integer | Muertes en esta partida |
| kd_ratio | decimal(10,2) | KD calculado localmente |
| raw_csv_data | text[] | Fila CSV original completa |
| imported_at | timestamptz | Fecha importación |

## 🔧 Configuración Inicial

### 1. Crear proyecto en Supabase
- Ir a [supabase.com](https://supabase.com)
- Crear nuevo proyecto
- Guardar **Project URL** y **anon public API key**

### 2. Configurar Auth en Supabase

1. Ve a **Authentication > Settings** en tu dashboard de Supabase
2. Desactiva **"Enable Email Confirmations"** (para MVP, sin verificación por email)
3. En **Authentication > Users > Add user**, crea tu primer admin con email + password

### 3. Ejecutar SQL de tablas

```sql
-- Habilitar UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de alianzas
CREATE TABLE alliances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    tag TEXT NOT NULL UNIQUE CHECK (LENGTH(tag) BETWEEN 3 AND 10),
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de jugadores
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

-- Tabla de partidas
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

-- Tabla de registros
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    accepted_rules BOOLEAN DEFAULT false,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(game_id, player_id)
);

-- Tabla de resultados
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

-- Políticas RLS (Row Level Security) - ABIERTAS para MVP
ALTER TABLE alliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON alliances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON registrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON game_results FOR ALL USING (true) WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_alliance ON games(alliance_id);
CREATE INDEX idx_players_alliance ON players(current_alliance_id);
CREATE INDEX idx_registrations_game ON registrations(game_id);
CREATE INDEX idx_game_results_game ON game_results(game_id);
CREATE INDEX idx_game_results_player ON game_results(player_id);
```

### 3. Configurar `assets/js/config.js`

Editar el archivo y reemplazar:

```javascript
const SUPABASE_URL = 'https://TU-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'TU-ANON-KEY-public';
const ADMIN_PASSWORD_HASH = 'tu-contraseña-segura-aqui';
```

### 4. Subir a GitHub Pages

```bash
# Crear repo en GitHub
git init
git add .
git commit -m "MVP Alliance Hub"
git remote add origin https://github.com/TU-USUARIO/alliance-hub.git
git push -u origin main

# Activar GitHub Pages en Settings > Pages > Source: main branch
```

## 📊 Flujo de Uso (Evento del 20)

### Antes del evento:
1. Crear alianza en `/admin/alliances.html`
2. Crear partida en `/admin/games.html` (estado: `draft`)
3. Cambiar estado a `open` cuando quieras abrir registro
4. Compartir link de la partida pública

### Durante el evento:
1. Jugadores se registran en `/register/index.html?game=UUID`
2. Ves registrados en `/admin/game-detail.html?id=UUID`
3. Cierras registro → cambias estado a `in_progress`

### Después del evento:
1. Finalizas partida → cambias estado a `finished`
2. Vas a `/admin/import.html`
3. Seleccionas la partida, subes el CSV del bot
4. Verificas preview, confirmas importación
5. Rankings se actualizan automáticamente

## 📋 Formato CSV Esperado

El bot de Discord exporta CSV con este formato:

```csv
Nation,Username,Id ,Infantería,Artillería,...,Total
"Orhan ""Kangal"" Demir",Tlaloc27,99702975,100,50,...,877/190 (4.62 kd)
```

### Reglas del parser:
- **Ignora bots**: Filas donde `Id` no sea un número puro
- **Extrae Total**: `"877/190 (4.62 kd)"` → kills=877, deaths=190
- **Recalcula KD**: Ignora el KD del bot, calcula `kills/deaths` localmente
- **Maneja comillas**: `"""` dentro de campos con comillas

## 🔐 Seguridad

- **Supabase Auth real**: Email + password con JWT tokens (no contraseña en código)
- **RLS protegido**: Lectura pública, escritura solo para usuarios autenticados
- **Códigos de invitación**: Para invitar nuevos admins sin compartir credenciales
- **Sin confirmación de email**: Desactivada en Supabase para MVP (puedes activarla luego)
- **Session persistente**: Supabase maneja tokens automáticamente

## 🎨 Tecnologías

- **Frontend**: HTML5 + Tailwind CSS (CDN) + Vanilla JS
- **Backend**: Supabase (PostgreSQL + PostgREST)
- **Hosting**: GitHub Pages (gratis)
- **CSV**: Parser nativo en JS (sin librerías externas)

## 👥 Invitar Nuevos Admins

1. Ve a `/admin/invites.html` (o ejecuta en SQL: `SELECT create_invite_code();`)
2. Copia el código generado (ej: `A3B7C9D2`)
3. Compártelo con la persona
4. La persona va a `/login.html` → pestaña "Nuevo Admin (código)"
5. Ingresa email, password y el código
6. ¡Listo! Tiene acceso admin

## 📝 Notas

- El `404.html` es esencial para GitHub Pages (SPA routing)
- `show_game_id` permite ocultar el ID real de la partida al público
- Los jugadores se identifican por su ID numérico del juego (bigint)
- El localStorage guarda ID/username del jugador para futuros registros
- Las alianzas penalizadas (`active=false`) siguen visibles pero marcadas

## 🚀 Roadmap Post-MVP

- [ ] Autenticación con Supabase Auth
- [ ] Múltiples niveles de admin
- [ ] Sistema de notificaciones
- [ ] Gráficos de evolución de KD
- [ ] Filtros avanzados en rankings
- [ ] Exportar rankings a PDF/Excel
- [ ] Sistema de torneos con brackets
- [ ] Comentarios en partidas
- [ ] Integración directa con API del bot
