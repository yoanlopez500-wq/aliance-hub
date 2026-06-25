# Alliance Hub V2

Plataforma de rankings, ligas y gestión para comunidades de **Supremacy 1914**.

## Características

- **5 tipos de partida**: Internas, Duelos (5v5), Públicas 31, Eventos 500, Rápidas (auto-delete)
- **Sistema de ligas**: Jornadas, standings, bracket
- **Jerarquía de admins**: Superadmin > Event Admin > Alliance Leader > Moderator
- **Códigos de invitación**: Registro con Supremacy ID
- **Lazy login**: Entrar solo con ID de jugador
- **Chat**: Entre alianzas en duelos, canales por rol
- **Reportes de chat**: Auditoría completa
- **PWA**: Instalable, offline-capable
- **Push notifications**: Via Supabase Edge Functions
- **Sistema de aprobación**: Registros pendientes de aprobación
- **Cache inteligente**: Con kill switch desde la BD

## Estructura del Proyecto

```
/
├── index.html              # Página pública principal
├── login.html              # Login admin (email/password)
├── login-player.html       # Login jugador (lazy, solo ID)
├── reset-password.html     # Recuperar contraseña
├── game.html               # Detalle de partida pública
├── player.html             # Perfil de jugador público
├── rankings.html           # Rankings globales y por filtro
├── chat.html               # Chat entre alianzas
├── 404.html                # SPA redirect para GitHub Pages
├── alliance-panel.html     # Panel de alianza para miembros
├── manifest.json           # PWA manifest
├── service-worker.js       # SW con cache + push
├── schema.sql              # Schema completo de Supabase
├── README.md               # Este archivo
│
├── register/
│   └── index.html          # Registro a partida (jugadores)
│
├── admin/
│   ├── index.html          # Dashboard
│   ├── matches.html        # CRUD partidas
│   ├── match-detail.html   # Gestionar partida específica
│   ├── players.html        # Gestión de jugadores
│   ├── alliances.html      # CRUD alianzas
│   ├── leagues.html        # Gestión de ligas
│   ├── import.html         # Importar CSV de resultados
│   ├── invites.html        # Generar códigos de invitación
│   ├── admins.html         # Gestión de administradores
│   ├── chat-reports.html   # Reportes de chat
│   └── alliance-members.html # Miembros de alianza (para líderes)
│
└── assets/
    ├── js/
    │   ├── config.js         # Supabase config
    │   ├── base.js           # Funciones compartidas + caché + login
    │   ├── auth.js           # Auth admin + jerarquía + nav
    │   └── pwa-utils.js      # Service worker + instalación
    └── css/
        └── style.css         # Overrides y animaciones
```

## Deploy en GitHub Pages

1. Fork este repo
2. En **Settings > Pages**: Source = Deploy from a branch, Branch = `main`, folder = `/` (root)
3. Para rutas SPA: el `404.html` redirige automáticamente

## Configuración de Supabase

1. Crear proyecto en [Supabase](https://supabase.com)
2. Ejecutar `schema.sql` en SQL Editor
3. Copiar URL y anon key en `assets/js/config.js`
4. Habilitar Auth (Email provider)
5. Configurar RLS policies (ya están en el schema)

## Tecnologías

- [Supabase](https://supabase.com) - Backend (Auth, Database, Realtime, Storage)
- [Tailwind CSS](https://tailwindcss.com) - CDN para estilos
- Vanilla JavaScript - Sin framework frontend
- PWA - Service Worker + Manifest
