# Naowee Incentivos — Demo UI/UX

Prototipado de la funcionalidad de Incentivos del SUID. HTML/CSS/JS vanilla, sin build tools.

## Design System

Consumido vía CDN (sin copia local):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/douguizard/naowee-design-system@v1.4.0/dist/design-system.css">
```

Ver todos los componentes en vivo: https://douguizard.github.io/naowee-design-system/playground.html

## Cómo desarrollar

### Server local (preview)

```bash
# Node inline server en puerto 4500
node -e "$(cat .claude/launch.json | grep -oE '\"runtimeArgs\".*\\[\"-e\",\\s*\"[^\"]+\"\\]' | head -1 | sed 's/.*\"-e\", *\"//' | sed 's/\"\\]$//')"
```

O más simple, abre `index.html` directo desde Finder.

### Claude Code

```bash
cd ~/Desktop/incentivos-ui-ux-demo
claude
```

Las reglas del proyecto están en `CLAUDE.md`. Primera vez, pídele:

```
Lee los documentos en docs/ y propón la estructura de pantallas
```

## Estructura

```
incentivos-ui-ux-demo/
├── .claude/launch.json     ← preview server port 4500
├── docs/                   ← documentos funcionales (ver docs/README.md)
├── .raw/                   ← ingesta cruda de transcripciones
├── shared/logos/           ← logos oficiales
├── CLAUDE.md               ← project rules
├── NEXT-SESSION.md         ← checklist para arrancar sesión nueva
├── index.html              ← landing con grid de pantallas
└── incentivo-XX-*.html     ← pantallas del flujo (se irán creando)
```

## Convenciones

- Pantallas numeradas: `incentivo-01-*.html`, `incentivo-02-*.html`, etc.
- Cada pantalla con un propósito claro (login, dashboard, crear, detalle, etc.)
- Todos referencian el DS via CDN pinned
- Sin copias locales de `design-system.css`
- Un `<link>` al DS + Inter de Google Fonts es suficiente para todos los estilos

## Referencias

| Proyecto | Repo | URL |
|----------|------|-----|
| Design System | `douguizard/naowee-design-system` | https://douguizard.github.io/naowee-design-system/ |
| Digitación demo | `douguizard/digitacion-ui-ux-demo` | https://douguizard.github.io/digitacion-ui-ux-demo/ |
| Escenarios demo | `douguizard/escenarios-ux-ui-demo` | https://douguizard.github.io/escenarios-ux-ui-demo/ |
