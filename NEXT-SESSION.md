# Checklist para la próxima sesión

Cuando vuelvas a Claude Code en este repo, copia-pega este prompt para arrancar con todo el contexto cargado:

```
Lee CLAUDE.md + todo lo que esté en docs/ y .raw/
Luego hazme un resumen de:
  1. Qué documentos subí y qué contiene cada uno
  2. Cuál es el alcance de incentivos según esos docs
  3. Qué pantallas crees que necesitamos (flujo)
  4. Qué reglas de negocio / validaciones críticas detectaste
  5. Qué preguntas abiertas tienes antes de construir

Después NO construyas nada todavía, espera a que yo te dé el ok.
```

## Antes de arrancar, sube a `docs/`

Lo que tengas:

- [ ] **Alcance / SOW** del módulo de incentivos (PDF, Word, Markdown)
- [ ] **Casos de uso / historias de usuario** (CSV, PDF, Notion export)
- [ ] **Estructura de datos / campos** del formulario (CSV, Excel, JSON schema)
- [ ] **BPMN** del proceso (PDF, PNG) o link en `docs/BPMN.md`
- [ ] **Wireframes / Figma** (PDF, PNG, links en `docs/FIGMA.md`)
- [ ] **Reglas de negocio** (validaciones, cálculos, estados)
- [ ] **Entrevistas / transcripciones** relevantes

Puedes ponerlos directamente en `docs/` (plano) o en subcarpetas si son muchos.

## Qué tiene listo este repo ya

- ✅ `CLAUDE.md` con project rules y referencias al DS
- ✅ `.claude/launch.json` con preview server en puerto 4500
- ✅ `docs/README.md` explicando qué va en esa carpeta
- ✅ `shared/logos/` (vacía, listo para copiar logos de escenarios/digitación si hacen falta)
- ✅ `index.html` template con DS via CDN (v1.4.0 pinned)
- ✅ `README.md` del proyecto

## Qué NO tiene todavía (y está bien)

- ❌ Pantallas del flujo — se generan la próxima sesión a partir de los docs
- ❌ Repo de GitHub + Pages — se crea después de tener el MVP o antes si prefieres
- ❌ Templates de pantalla (`incentivo-template.html`) — lo hacemos cuando sepamos qué secciones tienen las pantallas

## Arranque rápido (3 pasos)

```bash
# 1. Sube tus docs a docs/
open ~/Desktop/incentivos-ui-ux-demo/docs

# 2. Abre Claude Code en el repo
cd ~/Desktop/incentivos-ui-ux-demo
claude

# 3. Pégale el prompt de arriba y arrancamos
```

## Notas de contexto

- **Repo**: `naowee-tech/naowee-test-incentivos` (transferido desde `douguizard/incentivos-ui-ux-demo` el 2026-04-24)
- **Puerto preview**: 4500 (digitación 4200, escenarios 4300)
- **DS versión**: v1.4.0 pinned via jsDelivr
- **Día de inicio**: 2026-04-22

---

Buen día. Mañana arrancamos cuando estés listo 💪
