# Naowee Incentivos — Project Rules

## Project Overview
Nueva funcionalidad de **Incentivos** del SUID. Standalone HTML files con CSS + JS embebido para prototipado UI/UX. No build tools, no external dependencies except Google Fonts Inter y el Design System via CDN.

> **Este proyecto usa el Design System publicado en https://naowee-tech.github.io/naowee-design-system/** (repo `naowee-tech/naowee-design-system`). No hay copia local de `design-system.css` — siempre se consume via CDN pinneado.

## Tech Stack
- **Language**: HTML, CSS, JavaScript (vanilla)
- **Fonts**: Google Fonts Inter (400, 500, 600, 700, 800)
- **No build tools, no dependencies**
- **Design System**: consumido via jsDelivr CDN pinneado a `@v1.4.0`
- **Servidor local**: Node inline via `.claude/launch.json` en puerto **4500** (Digitación usa 4200, Escenarios 4300 — incentivos 4500)

## Consumir el Design System

SIEMPRE en cada archivo HTML:

```html
<!-- Design System pinneado -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/naowee-tech/naowee-design-system@v1.4.0/dist/design-system.css">

<!-- Opcional: helper para tabs animados -->
<script src="https://cdn.jsdelivr.net/gh/naowee-tech/naowee-design-system@v1.4.0/dist/tabs.js"></script>
```

Para dev/local puedes usar `@main` (refresca cada ~12h); en producción siempre pin a tag (`@v1.4.0` o superior).

### Tokens y componentes disponibles
Ver el playground para preview en vivo: https://naowee-tech.github.io/naowee-design-system/playground.html

Componentes claves del DS:
- `.naowee-btn` + variantes (`--loud`, `--quiet`, `--mute`, `--on-fill`)
- `.naowee-textfield`, `.naowee-searchbox`
- `.naowee-tabs` + `.naowee-tabs--animated` con sliding indicator
- `.naowee-segment` + `.naowee-segment__pill` (sliding pill)
- `.naowee-breadcrumb`, `.naowee-badge`, `.naowee-tag`, `.naowee-message`
- `.naowee-modal` + `.naowee-modal__dismiss`
- `.naowee-floating-footer`
- `.naowee-file-uploader`, `.naowee-toggle`, `.naowee-checkbox`, `.naowee-radio`

### Design tokens que debo usar
| Token | Valor | Uso |
|-------|-------|-----|
| `--naowee-color-text-accent` / `--accent` | `#d74009` | CTAs primarios, filtros activos |
| `--naowee-color-text-primary` / `#282834` | Texto principal | |
| `--naowee-color-text-secondary` / `#646587` | Texto secundario | |
| Inter | Font family | Todo |
| `--naowee-font-size-14` (13-14px) | Body | |
| `--naowee-font-size-12` (12px) | Helpers, labels | |

## Estructura del repo

```
incentivos-ui-ux-demo/
├── .claude/
│   └── launch.json        ← preview server port 4500
├── .raw/                  ← documentos crudos para ingestar (transcripts, PDFs)
├── docs/                  ← documentos curados del usuario (casos de uso, fichas, BPMN)
│   └── README.md          ← qué va aquí
├── shared/
│   ├── logos/             ← logos oficiales Ministerio + SUID + Naowee
│   └── transitions.css    ← solo CSS específico de este proyecto (si hace falta)
├── CLAUDE.md              ← este archivo
├── NEXT-SESSION.md        ← checklist de arranque
├── README.md
├── index.html             ← landing con grid de escenarios
├── incentivo-template.html ← template para nuevas pantallas
└── incentivo-XX-*.html    ← pantallas del flujo
```

## Cómo nombrar pantallas nuevas

Mismo patrón que Digitación / Escenarios:
```
incentivo-01-login.html
incentivo-02-dashboard.html
incentivo-03-crear.html
...
```

Los números ayudan a ordenar y reflejan el flujo en el índice.

## Approach
- **Antes de construir nada, estudiar los documentos en `docs/`** — son la fuente de verdad. No inventar campos, flujos ni reglas.
- **Reutilizar componentes del DS** — antes de crear un componente nuevo, buscar su equivalente en el playground: https://naowee-tech.github.io/naowee-design-system/playground.html
- **No copiar `design-system.css` localmente** — siempre CDN pinneado
- Think before acting. Read existing files before writing code.
- Prefer editing over rewriting whole files.
- Do not re-read files you have already read unless the file may have changed.
- Test your code before declaring done.
- Keep solutions simple and direct.
- User instructions always override this file.

## Referencias cruzadas

- **Design System source**: https://github.com/naowee-tech/naowee-design-system
- **Playground DS**: https://naowee-tech.github.io/naowee-design-system/playground.html
- **Digitación demo**: https://naowee-tech.github.io/naowee-test-digitacion/ (referencia de patrones UI)
- **Escenarios demo**: https://naowee-tech.github.io/naowee-test-escenarios/ (referencia de flujo CRUD + mapas)

## Puertos locales
- 4200 — Digitación
- 4300 — Escenarios
- 4500 — **Incentivos** (este repo)
