# Archivos Huérfanos - Alliance Hub

## Lista de archivos que NO son referenciados por ningun enlace en la aplicacion

### Paginas HTML no referenciadas

| Archivo | Razon |
|---------|-------|
| `admin/chat.html` | No hay link desde la navegacion ni desde ninguna pagina |
| `admin/game-detail.html` | Solo referenciado desde `admin/games.html` (fue corregido el link) |
| `admin/inbox.html` | No referenciado desde la navegacion ni otras paginas |
| `admin/officers.html` | No referenciado desde la navegacion (reemplazado por `leader-requests.html`) |
| `admin/rankings.html` | No referenciado desde la navegacion (el ranking principal es `rankings.html` en raiz) |
| `admin/chat-reports.html` | No referenciado desde la navegacion ni otras paginas |
| `admin/alliance-members.html` | No referenciado desde la navegacion |
| `course/index.html` | Sistema de curso reemplazado por `apply-leader.html` |

### Archivos SQL/DB (no son parte de la app web)

| Archivo | Razon |
|---------|-------|
| `database.sql` | Archivo de setup de base de datos - no se sirve en produccion |
| `database_auth_update.sql` | Update de auth - ya aplicado |
| `database_cache_control.sql` | Cache control - ya aplicado |
| `database_completo.sql` | DB completo - ya aplicado |
| `database_diagnostico.sql` | Diagnostico - ya aplicado |
| `database_fixes.sql` | Fixes - ya aplicados |
| `database_funciones_CORREGIDO.sql` | Funciones - ya aplicadas |
| `database_funciones_avanzadas.sql` | Funciones avanzadas - ya aplicadas |
| `database_functions.sql` | Functions - ya aplicadas |
| `database_recalc.sql` | Recalc - ya aplicado |
| `database_rls_fix.sql` | RLS fix - ya aplicado |
| `database_triggers.sql` | Triggers - ya aplicados |
| `kill_switch_setup.sql` | Kill switch - ya aplicado |
| `schema.sql` | Schema - ya aplicado |

### Archivos de documentacion viejos

| Archivo | Razon |
|---------|-------|
| `DEPLOY_README.md` | Documentacion de deploy vieja |
| `INSTRUCCIONES_SETUP.md` | Instrucciones de setup viejas |

### Archivos JS potencialmente huerfanos

| Archivo | Estado |
|---------|--------|
| `assets/js/csv-parser.js` | Referenciado solo desde `admin/import.html` |
| `assets/js/nav.js` | Duplicado - la navegacion esta en `auth.js`, este archivo no se carga en ninguna pagina |

### Resumen
- **8** paginas HTML huerfanas
- **14** archivos SQL de base de datos (solo necesarios para setup)
- **2** archivos de documentacion viejos
- **2** archivos JS con problemas
- **Total: 26 archivos** candidatos para eliminacion manual

---
*Generado automaticamente - Revisar manualmente antes de eliminar*
