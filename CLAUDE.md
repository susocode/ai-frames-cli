# ai-frames — Project Context

## Idea general

Construir una herramienta CLI llamada **ai-frames** (inspirada en el plugin `aicontext` de asdf usado en Inditex) que permita gestionar contexto de IA para proyectos de desarrollo. Nace bajo **susocode** pero está diseñada para ser general y usable por cualquier equipo o desarrollador individual.

**Dominio**: ai-frames.org  
**Repo CLI**: https://github.com/susocode/ai-frames-cli.git

---

## Arquitectura implementada

### Config global en disco

```
~/.ai-frames/
  config.yaml                          ← índice de contextos + activo
  contexts/
    <uuid>/                            ← directorio por contexto (UUID)
      context.yaml                     ← config del contexto (sin token)
      assistants.yaml                  ← asistentes habilitados con prefix
      selections.yaml                  ← items seleccionados del marketplace por tipo
      custom-dirs.yaml                 ← mapeos custom globales
      custom-dirs-<assistant>.yaml     ← mapeos custom por asistente
      lock.yaml                        ← { hash, synced_at }
      repo/                            ← git clone del resources repo
        .aicontext/
          rules/
          agents/
          skills/
          prompts/
          mcps/
          contexts/
          templates/
```

Token guardado en **keychain del sistema** (keytar) — nunca en disco.

### Estructura del workspace

```
<workspace>/
  .aicontext/                          ← fuente canónica de contexto
    rules/                             ← shared → todos los asistentes
    agents/
    skills/
    prompts/
    mcps/
    contexts/                          ← documentación por proyecto (org/repo/CLAUDE.md etc.)
    templates/
    rules/.claude/                     ← overrides específicos de Claude Code
    rules/.copilot/                    ← overrides específicos de Copilot
    agents/.claude/
    prompts/.claude/
    ...
  .claude/                             ← generado por Claude Code (no gestionado directamente)
  .github/                             ← generado por Copilot
  .cursor/                             ← generado por Cursor
  .windsurf/                           ← generado por Windsurf
```

### Tabla de transformación Sync → Install (pendiente)

| Origen en `.aicontext/` | Claude Code | GitHub Copilot | Cursor | Windsurf |
|---|---|---|---|---|
| `rules/` + `rules/.claude/` | `.claude/rules/` | `.github/instructions/` | `.cursor/rules/` | `.windsurf/rules/` |
| `agents/` + `agents/.claude/` | `.claude/agents/` | `.github/agents/` | — | — |
| `skills/` + `skills/.claude/` | `.claude/skills/` | `.github/skills/` | — | — |
| `prompts/` + `prompts/.claude/` | `.claude/commands/` | `.github/prompts/` | — | `.windsurf/workflows/` |
| `mcps/` | `.mcp.json` | `.vscode/mcp.json` | `.cursor/mcp.json` | — |
| `contexts/<org>/<repo>/CLAUDE.md` | `<repo>/CLAUDE.md` | — | — | — |
| `contexts/<org>/<repo>/AGENTS.md` | — | `<repo>/AGENTS.md` | — | — |

### Directorio `.aicontext/contexts/`

```
contexts/
  <org>/
    <repo>/
      CONTEXT.md   ← contexto general (todos los asistentes)
      CLAUDE.md    ← Claude Code specific → se copia como CLAUDE.md en el repo
      AGENTS.md    ← Copilot/agentes specific → se copia como AGENTS.md
```

---

## Stack técnico

- **Backend**: TypeScript + Node.js + Express
- **Frontend**: React + Vite
- **Monorepo**: `packages/server` + `packages/ui`
- **Seguridad**: tokens en keychain (keytar), HTTPS via devcert en producción
- **Git ops**: simple-git con `allowUnsafePager` workaround
- **Comando principal**: `ai-frames` (arranca servidor + abre browser)
- **Comando secundario**: `ai-frames install` (sin UI)

---

## Funcionalidades implementadas

### Setup wizard (4 pasos)
1. Nombre del contexto (solo `[a-zA-Z0-9_-]`, `-` se guarda como `_`)
2. Proveedor git (GitHub, GitLab, Bitbucket)
3. Repo de recursos con verificación (token o SSH) + creación de repo nuevo
4. Workspace directory (ruta absoluta con validación)

### Dashboard — Páginas

| Ruta | Estado | Descripción |
|---|---|---|
| `/` | ✅ | Overview con cards por sección |
| `/workspace` | ✅ | AI Context — dirs + asistentes + custom mappings |
| `/repositories` | 🔜 | Repos vinculados al contexto |
| `/templates` | ✅ | Templates marketplace — bundles de recursos |
| `/agents` | ✅ | Agents marketplace |
| `/skills` | ✅ | Skills marketplace |
| `/rules` | ✅ | Rules marketplace |
| `/prompts` | ✅ | Prompts marketplace |
| `/mcps` | 🔜 | MCPs marketplace |
| `/contexts` | 🔜 | App Contexts marketplace |
| `/summary` | 🔜 | Summary + Sync & Install |

### Marketplace
- Lee del repo clonado (`~/.ai-frames/contexts/<uuid>/repo/`)
- Muestra items disponibles con `title`, `description`, `version`, `scope` (shared/.claude/.copilot)
- Selección persiste en `selections.yaml`
- **Save & Sync**: guarda selección + copia archivos al workspace
- **Templates**: bundles YAML que agrupan múltiples tipos de recursos — fan-out al instalar
- Botón de lectura (hoja) abre modal con contenido del `.md` renderizado con `marked`

### AI Context page (`/workspace`)
- Tabla de dirs `.aicontext/` con estado **Created** / **Missing** y **Synced** / **Outdated**
- Outdated solo si hay items seleccionados Y el repo tiene cambios más recientes
- Asistentes: enable/disable por card con checkbox → crea/elimina subdirs en `.aicontext/`
- Custom mappings: `repo_path → local_path` con estado y botón Remove
- Custom mappings por asistente en `custom-dirs-<id>.yaml`
- Guard: si se deshabilita un asistente con selecciones activas pide confirmación
- `assistants.yaml` persiste `{ id, label, prefix, enabled }` — configurable por usuario

### Sync
- Compara hash local vs remoto (`lock.yaml`)
- Siempre sincroniza al workspace aunque `up_to_date: true` (para recuperar dirs borrados)
- Solo copia los items **seleccionados** — no todo el repo
- `git clean -fd + checkout -- .` antes del pull para evitar conflictos
- Evento `aiframes:synced` notifica a las páginas para recargar

### Repo de recursos (`susocode/ai-context`)
- Inicialización crea estructura `.aicontext/` en el repo remoto vía API
- Tras init → clona localmente + primer sync
- Detección de repo vacío: busca si existe `.aicontext/` (no si el repo está vacío)

### UI/UX
- **Tema claro/oscuro** con `ThemeContext` + `data-theme` en `<html>` + localStorage
- **Sidebar colapsable** con animación 250ms, iconos 22px en colapsado, tooltips portal
- **Móvil responsive**: sidebar como drawer overlay, grids adaptativos, tablas scrollables
- **i18n**: EN / ES / PL con `LangContext`, portal-based para evitar overflow:hidden
- **Favicon** SVG con concepto frame+AI node
- **ContextSelector** custom con dropdown portal, punto de color por proveedor
- **SidebarLink** con tooltips en modo colapsado y badge `●` para items en desarrollo
- **Footer marketplace** con transición pegada al sidebar via CSS var `--sidebar-w`

---

## Endpoints implementados

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/contexts` | Lista contextos + setup_required |
| POST | `/api/contexts` | Crear contexto |
| PUT | `/api/contexts/active` | Cambiar contexto activo |
| PUT | `/api/contexts/:id` | Actualizar contexto |
| GET/PUT | `/api/resources` | Manifest del contexto activo |
| POST | `/api/verify` | Verificar si repo existe |
| POST | `/api/repo-create` | Crear repo en proveedor |
| POST | `/api/repo-init` | Inicializar estructura .aicontext en repo remoto |
| POST | `/api/repo-sync/clone` | Clonar repo + sync workspace |
| POST | `/api/repo-sync/pull` | Pull + sync workspace |
| GET | `/api/repo-sync/status` | Comparar hash local vs remoto |
| GET | `/api/repo-status` | ¿Existe .aicontext/ en el repo? |
| GET | `/api/workspace-dirs` | Estado de dirs con Created/Synced/Outdated |
| POST | `/api/workspace-dirs/assistant` | Enable/disable dirs de asistente |
| POST | `/api/assistant-init/:assistant` | Crear dirs asistente en repo + sync |
| GET/PUT | `/api/assistants` | Cargar/guardar config de asistentes |
| GET | `/api/assistants/selections` | Asistentes con selecciones activas |
| GET | `/api/marketplace/:type` | Items disponibles + seleccionados |
| GET | `/api/marketplace/:type/file` | Contenido de un archivo del repo |
| PUT | `/api/marketplace/:type` | Guardar selección + sync workspace |
| PUT | `/api/marketplace/templates` | Instalar template (fan-out) |
| GET/PUT | `/api/custom-dirs` | Mapeos custom globales |
| GET/PUT | `/api/custom-dirs/:assistant` | Mapeos custom por asistente |
| DELETE | `/api/custom-dirs/local` | Eliminar directorio local |
| POST | `/api/workspace-check` | Verificar si directorio existe |

---

## Fases pendientes

### Fase 2 — Install
- Implementar tabla de transformación Sync → Install
- `ai-frames install` que transforma `.aicontext/` al formato nativo de cada asistente

### Fase 3 — Repositories
- Clonar repos de proyectos con symlinks a `.claude/`, `.github/` etc.
- Gestión de repos desde la UI

### Fase 4 — Recursos faltantes
- Repositories page
- MCPs page
- App Contexts page
- Summary / Deploy page

### Fase 5 — Distribución
- npm package + binario standalone (pkg/bun)
- Homebrew formula con `depends_on "openssl"`
- asdf plugin

---

## Notas técnicas importantes

- El token nunca viaja después del wizard — keychain (keytar), recuperado por contextId
- `delete process.env['PAGER']` + `process.env['EDITOR']` necesarios para simple-git
- `allowUnsafePager` no existe en el tipo de SimpleGitOptions — usar env vars
- El botón Sync siempre materializa aunque `up_to_date: true`
- `isSynced` solo compara archivos seleccionados, no todos los del directorio
- CSS transitions no animan custom properties — usar clases en `body` + `left: Xpx`
- Sidebar collapsed en móvil = drawer overlay, no modo icono
- `selections.yaml` es la fuente de verdad de qué se sincroniza al workspace
