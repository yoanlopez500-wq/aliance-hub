# Alliance Hub

Plataforma de torneos, rankings y gestion de comunidades para Supremacy 1914.

## Flujos Principales

### 1. Jugador (Sesion Pública)
- **Landing** (`index.html`) - Estadisticas, features, preview del reglamento con precedentes
- **Reglas** (`rules.html`) - Reglamento nativo desde `rule_sections` + precedentes/jurisprudencia desde `rule_precedents`
- **Rankings** (`rankings.html`) - Rankings globales con kills efectivas (penalizadas por strikes/sanciones)
- **Reportar** (`report.html`) - Reportar jugador seleccionando seccion del reglamento violada
- **Solicitar Liderazgo** (`apply-leader.html`) - Formulario para registrar nueva alianza (reemplaza curso)

### 2. Jugador (Sesion Autenticada)
- **Dashboard** (`dashboard.html`) - Lista de partidas disponibles
- **Game** (`game.html`) - Detalle de partida con reglamento nativo cargado desde Supabase
- **Player** (`player.html`) - Perfil publico con kills efectivas calculadas por strike penalty
- **Chat** (`chat.html`) - Chat global
- **Alianza** (`alliance-panel.html`) - Panel de alianza del jugador

### 3. Admin (Panel de Control)
#### Gestión Principal
- **Dashboard** (`admin/index.html`) - Panel principal con estadisticas
- **Partidas** (`admin/matches.html`) - CRUD de partidas
- **Detalle Partida** (`admin/match-detail.html`) - Editar partida + importar CSV de resultados
- **Jugadores** (`admin/players.html`) - Lista de jugadores con busqueda

#### Reglamento y Sanciones
- **Editor de Reglamento** (`admin/rules-editor.html`) - CRUD de `rule_sections` + gestion de precedentes
- **Motor de Sanciones** (`admin/sanctions-engine.html`) - Fórmulas de penalizacion + simulador
- **Strikes** (`admin/strikes.html`) - Aplicar strikes conectados a secciones del reglamento

#### Reportes y Solicitudes
- **Reportes** (`admin/reports.html`) - Gestion de reportes con filtro por regla + sugerencias de precedentes
- **Certificaciones** (`admin/certifications.html`) - Vista de solicitudes de liderazgo
- **Solicitudes de Liderazgo** (`admin/leader-requests.html`) - Aprobar/rechazar solicitudes de liderazgo

#### Configuración
- **Alianzas** (`admin/alliances.html`) - Gestion de alianzas
- **Admins** (`admin/admins.html`) - Gestion de administradores
- **Invitaciones** (`admin/invites.html`) - Codigos de invitacion
- **Importar CSV** (`admin/import.html`) - Importar resultados masivos

## Arquitectura Técnica

### Frontend
- HTML5 + Tailwind CSS (via CDN) + Vanilla JavaScript
- Supabase Client v2 (`assets/js/config.js`)
- Service Worker con Workbox (auto-update, network-first para HTML)
- PWA con `manifest.json` e iconos

### JS Core
| Archivo | Función |
|---------|---------|
| `assets/js/config.js` | Inicializacion de Supabase client |
| `assets/js/base.js` | Utilidades (formatDate, showToast, getStatusBadge, etc.) |
| `assets/js/auth.js` | Auth dual + navegación fluida + ROLE_PANELS |
| `assets/js/theme.js` | Variables CSS del tema oscuro |
| `assets/js/sw-register.js` | Registro inteligente del SW con detección de versiones |

### Base de Datos (Supabase)
- **Tablas principales**: `players`, `alliances`, `matches`, `match_registrations`, `match_results`
- **Sistema de reglas**: `rule_sections` (jerarquico), `rule_precedents` (jurisprudencia)
- **Sistema de strikes**: `player_strikes`, `strike_types`, `player_sanctions`
- **Reportes**: `player_reports` (con `rule_section_id`)
- **Solicitudes**: `alliance_leader_requests`
- **Auth**: `admin_users`, `admin_invites`, `player_tokens`

### Sistema de Penalizacion por Strikes
Las kills efectivas se calculan restando strikes activos:
- 1 strike = -10% kills
- 2 strikes = -30% kills
- 3+ strikes = -50% kills
- El motor de sanciones (`admin/sanctions-engine.html`) permite crear fórmulas custom

**IMPORTANTE**: `players.strikes` NO EXISTE. Siempre contar desde `player_strikes`.

## Service Worker
- **Workbox CDN** v7.1.0 con strategies:
  - HTML: `NetworkFirst` (siempre fresco)
  - JS/CSS: `StaleWhileRevalidate`
  - Imagenes/Fuentes: `CacheFirst`
  - Supabase API: `NetworkOnly`
- Auto-limpieza de caches viejos al instalar
- Deteccion de version via `sw-register.js`

## Deploy
- GitHub Pages: `https://yoanlopez500-wq.github.io/aliance-hub/`

## Version
**v16.1** - Sistema nativo de reglas, motor de sanciones, solicitud de liderazgo, Workbox SW
