# Handoff — Naowee Incentivos · Demo UI/UX

> **Para continuar este proyecto en otra cuenta / sesión de Claude Code.**
> Copia este archivo + todo el repo `~/Desktop/incentivos-ui-ux-demo/`.
> Al abrir una nueva sesión, pégale el prompt de arranque al final de este doc.

---

## 1. Estado del proyecto

### Repo
- **Path local:** `~/Desktop/incentivos-ui-ux-demo/`
- **Servidor local:** `node` inline en puerto **4500** vía `.claude/launch.json`
- **URL local:** `http://localhost:4500`
- **Stack:** HTML + CSS + JS vanilla. Sin build. Sin dependencias locales.
- **Design System:** Consumido via CDN pinneado a **`@v1.4.0`** (no hay copia local)
  ```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/naowee-tech/naowee-design-system@v1.4.0/dist/design-system.css"/>
  ```

### Pantallas construidas (13/13)

| # | Archivo | Estado | Notas |
|---|---|---|---|
| 01 | `incentivo-01-login.html` | **Refactorizado ✅** | Idéntico al de escenarios (misma copy, carrusel, CTAs). Role picker post-login (Gestor/Operador). |
| 02 | `incentivo-02-dashboard.html` | **Refactorizado ✅** | DS components, sidebar con logos Ministerio+SUID, naowee-segment, btn--link para ghosts. |
| 03 | `incentivo-03-programas.html` | **Refactorizado (parcial) ⚠️** | Primera pasada con DS components. **Pendiente:** aplicar el mismo refinamiento del 02 (segments, link btns, badges quiet, progress __fill, thumbnails). |
| 04 | ~~incentivo-04-programa-crear.html~~ | **Eliminada ❌** | Reemplazada por modal dentro de 03. |
| 05 | `incentivo-05-programa-detalle.html` | **Pendiente 🔴** | Aún con componentes custom. No migrado a DS. |
| 06 | `incentivo-06-codigos-carga.html` | **Pendiente 🔴** | Debe convertirse en modal desde 05. |
| 07 | `incentivo-07-codigos.html` | **Pendiente 🔴** | Migrar tabla a `.naowee-table`. |
| 08 | `incentivo-08-asignar-buscar.html` | **Pendiente 🔴** | Aplicar DS components. Sidebar con logos. |
| 09 | `incentivo-09-validar-foto.html` | **Pendiente 🔴** | Renombrado conceptualmente a "Evidencia de entrega". |
| 10 | `incentivo-10-asignar-tipo.html` | **Pendiente 🔴** | |
| 11 | `incentivo-11-asignar-exito.html` | **Pendiente 🔴** | |
| 12 | `incentivo-12-asignaciones.html` | **Pendiente 🔴** | Historial con filtros geo (región/municipio/ciudad). |
| 13 | `incentivo-13-revertir.html` | **Pendiente 🔴** | Confirmación tras revertir. |

### Shell y assets compartidos
- `shared/shell.css` — Sidebar + header + profile switcher + **tokens de elevation naranja** + **override de btn--loud:hover** (no cambia fill, solo elevation)
- `shared/logos/ministerio.svg`, `shared/logos/suid.png` — logos oficiales

---

## 2. Decisiones de diseño tomadas

### 2.1 Terminología y roles (confirmado con stakeholder Danna Arrieta)

- **Gestor de incentivos** (= Admin): persona del ministerio, jerarquía nacional. Parametriza, revierte, audita.
- **Operador** (= Responsable en campo): distribuido por evento. Busca deportista, asigna, sube evidencia. NO puede revertir.
- **NO** interactúan con el módulo: deportistas, entrenadores.

### 2.2 Alcance (Scope 1)

**En scope:**
- Parametrización de programas (Gestor)
- Asignación en campo por ID/cédula (Operador)
- Historial/reporte con filtros geo (Gestor)

**Fuera de scope (nice-to-have futuro):**
- Tab de incentivos en perfil del deportista
- Notificaciones email/SMS
- Dashboard de KPIs "puros" (sin lista)
- Rol de visualizador

### 2.3 Bloqueadores resueltos por Doug (2026-04-22/23)

1. ✅ **Vigencia del código:** sin vencimiento por ahora
2. ✅ **Carga de códigos:** soporta Excel/CSV masiva **O** manual (campos: código, categoría, evento opcional)
3. ✅ **Asignación manual:** el gestor elige el código al consultar, no FIFO automático

### 2.4 Tokens de elevation naranja (propuesta para migrar al DS)

Agregados en `shared/shell.css`:
```css
--naowee-shadow-loud-xs: 0 2px 6px rgba(215,64,9,.14);
--naowee-shadow-loud-sm: 0 4px 12px rgba(215,64,9,.18);
--naowee-shadow-loud-md: 0 6px 16px rgba(215,64,9,.22);
--naowee-shadow-loud-lg: 0 10px 28px rgba(215,64,9,.32);
--naowee-shadow-loud-xl: 0 16px 40px rgba(215,64,9,.38);
--naowee-shadow-brand-md: 0 6px 16px rgba(255,117,0,.24);
--naowee-shadow-brand-lg: 0 12px 32px rgba(255,117,0,.30);
```

Se aplican automáticamente al `.naowee-btn--loud:hover/focus/active`.
**Pendiente:** migrar estos tokens al repo `naowee-tech/naowee-design-system`.

### 2.5 Override del DS: btn--loud:hover

Por feedback de Doug: el hover del loud **no cambia el fill**, solo aplica elevation.
Override en `shared/shell.css`:
```css
.naowee-btn--loud:hover,
.naowee-btn--loud:focus-visible{
  background: var(--naowee-color-interactive-fill-loud-idle);
  box-shadow: var(--naowee-shadow-loud-md);
}
```
**Pendiente:** migrar al DS global.

---

## 3. Mapeo DS — qué componentes usar

### Componentes confirmados
| Necesidad | Clase DS correcta |
|---|---|
| Botón primario | `.naowee-btn.naowee-btn--loud.naowee-btn--large` |
| Botón ghost (CTAs secundarios grandes) | `.naowee-btn.naowee-btn--mute.naowee-btn--large` |
| Ghost discreto en panel heads ("Ver todos") | `.naowee-btn.naowee-btn--link` (padding compacto) |
| Badge de estado | `.naowee-badge.naowee-badge--{positive/caution/negative/informative/neutral}.naowee-badge--quiet.naowee-badge--small` (SIEMPRE `--quiet` para baja contraste en tablas) |
| Avatar/thumbnail | `.naowee-thumbnail.naowee-thumbnail--small` (+ `--positive/--informative/--neutral --quiet` o inline style para colores custom) |
| Barra de progreso | `.naowee-progress` + `.naowee-progress__fill` (NO `__bar`). Variantes: `.naowee-progress--positive`, `--negative`, `--lg`. **Sin gradients.** |
| Filtros segmentados (Hoy/7d/30d) | `.naowee-segment.naowee-segment--small` + `.naowee-segment__pill.naowee-segment__pill--no-anim` + items `.naowee-segment__item` con `--active` |
| Alertas/mensajes | `.naowee-message.naowee-message--{caution/informative/positive/negative}` |
| Card contenedor | `.naowee-card.naowee-card--outline` (+ `--flush` para padding 0) |
| Input de texto | `.naowee-textfield` con `__label`, `__label--required`, `__input-wrap`, `__input` |
| Búsqueda | `.naowee-searchbox` con `__icon` y `__input` |
| Tabla | `.naowee-table` dentro de `.naowee-table-wrap` |
| Tabs horizontales | `.naowee-tabs.naowee-tabs--animated` + `.naowee-tab` con `--selected` |
| Chips seleccionables (territorio) | `.naowee-tag.naowee-tag--choice` con `--selected` |
| Modal | `.naowee-modal-overlay` + `.naowee-modal` (con `--wide` para wizard) |
| Stepper | `.naowee-stepper` + `__step` con `--active/--done`, `__number`, `__label`, `__connector` |

### Helper JS — posicionar pill del segment

```js
function positionSegmentPill(seg, animate = true){
  const pill = seg.querySelector('.naowee-segment__pill');
  const active = seg.querySelector('.naowee-segment__item--active');
  if(!pill || !active) return;
  const segRect = seg.getBoundingClientRect();
  const actRect = active.getBoundingClientRect();
  const x = actRect.left - segRect.left - parseFloat(getComputedStyle(seg).borderLeftWidth || 0);
  if(animate){
    pill.classList.remove('naowee-segment__pill--no-anim');
    pill.style.setProperty('--segment-pill-x', x + 'px');
    pill.style.width = actRect.width + 'px';
  }else{
    pill.classList.add('naowee-segment__pill--no-anim');
    pill.style.setProperty('--segment-pill-x', x + 'px');
    pill.style.width = actRect.width + 'px';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      pill.classList.remove('naowee-segment__pill--no-anim');
    }));
  }
}
// Init: foreach segment, click handler + requestAnimationFrame + window.load + setTimeout 100ms
```

---

## 4. Patrones de layout establecidos

### 4.1 Sidebar + header shell

```html
<div class="shell">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <button class="burger-btn" onclick="...">☰</button>
      <img src="shared/logos/ministerio.svg" class="sb-logo-img"/>
      <div class="logo-sep"></div>
      <img src="shared/logos/suid.png" class="sb-logo-img"/>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section">INCENTIVOS</div>
      <div class="nav-row active"><div class="active-bar"></div>...</div>
      ...
    </nav>
    <div class="sidebar-bottom">
      <div class="nav-row">Cerrar sesión</div>
    </div>
  </aside>

  <div class="main">
    <header class="top-header">
      <div class="profile-switcher">
        <div class="user-chip">...</div>
      </div>
    </header>
    <div class="page">
      <!-- contenido -->
    </div>
  </div>
</div>
```

### 4.2 Patrón "parametrización = modal" (NO página dedicada)

Feedback explícito de Doug: **todas las parametrizaciones van en modal**, no en página.

- Crear programa → modal desde 03 Programas ✅ implementado
- Cargar más códigos → debería ser modal desde 05 Detalle (**pendiente** — hoy es página 06)
- Editar programa → modal
- Reversión → modal (implementado en 12)

### 4.3 Page header estándar

```html
<div class="page-header">
  <div class="page-header__title-group">
    <h1 class="page-title">Título</h1>
    <p class="page-sub">Descripción corta hasta 640px.</p>
  </div>
  <div class="page-header__actions">
    <button class="naowee-btn naowee-btn--mute naowee-btn--large">Acción secundaria</button>
    <button class="naowee-btn naowee-btn--loud naowee-btn--large">Acción primaria</button>
  </div>
</div>
```

---

## 5. Feedback de Doug aplicado (en orden cronológico)

### 5.1 Sobre el dashboard (02) — aplicado ✅

1. Quitar los `naowee-message` de caution/informativo al top
2. "Ver programas" = ghost button **large**, "Nuevo programa" = **large**
3. Badges en tabla: baja contraste (`--quiet`), sin padding extra del dot
4. "Ver todos/Historial/Historial completo": sin arrow, usar `naowee-btn--link` (NO textlink, NO mute-small)
5. Progress sin degradado, usar `__fill` del DS (no `__bar`)
6. Avatars/thumbnails del DS, no degradados custom
7. Iconos de KPI cards: más grandes + baja contraste (thumbnails `--squared --quiet`)
8. Filtros de periodo: usar `naowee-segment` (no custom pills)
9. Agregar más data a tabla de programas activos (7 filas ahora)
10. **btn--loud:hover no cambia fill** (override en shell.css)

### 5.2 Sobre el login (01) — aplicado ✅

- **Idéntico** al de escenarios. Misma copy, mismo carrusel (5 slides sports), mismos CTAs del header, mismo help.
- Único cambio: role picker post-login (Gestor/Operador) y redirect a pantallas de incentivos.

---

## 6. Feedback pendiente de aplicar al resto de pantallas

El mismo refinamiento del dashboard debe aplicarse a:

### Pantalla 03 Programas (parcial, falta)
- Revisar stats cards (usan badge-icon — cambiar a thumbnails squared quiet grandes)
- Tabs de estado: son `naowee-tabs--animated`, pero quizás convertir a `naowee-segment`
- Dentro del modal wizard: botones de "Continuar/Anterior" ya usan DS correctos

### Pantallas 05–13 (no refactorizadas)
Cada una debe:
1. **Sidebar** con Ministerio + SUID logos (usar patrón de shell.css ya creado)
2. **Badges** → `--quiet` variant
3. **Progress bars** → `__fill`, sin gradient
4. **Avatars** → `.naowee-thumbnail` del DS (eliminar custom `.ava-ring`, `.avatar-sm`)
5. **CTAs panel heads** → `naowee-btn--link` (sin arrow)
6. **Filtros segmentados** → `naowee-segment` + pill helper JS
7. **Botones primarios** → `--loud --large`, secundarios `--mute --large`
8. **Inputs** → `.naowee-textfield` completo (label + input-wrap + input + helper)
9. **Tablas** → `.naowee-table` dentro de `.naowee-table-wrap`
10. **Parametrizaciones** → convertir a modales (ej. carga de códigos desde 05)

---

## 7. Documentación relevante en `docs/`

- `docs/transcripcion-entrevista.md` — síntesis narrativa de la entrevista (16 secciones)
- `docs/reglas-de-negocio.md` — 13 bloques de reglas (RN-01 a RN-13)
- `docs/roles-matrix.md` — matriz de permisos Admin × Operador
- `docs/preguntas-abiertas-v2.md` — 8 dudas restantes (3 resueltas)
- `docs/Módulo incentivos y beneficios.xlsx - PARAMETROS.csv` — parámetros confirmados
- `docs/Incentivos - 2026_04_22 14_00 GMT-05_00 - Recording-es-asr.vtt` — transcripción literal (2562 líneas)
- `docs/Incentivos_ 2026_04_22 13_59 GMT-05_00 - Notas de Gemini.md` — notas síntesis Gemini
- `docs/FLUJO MODULO INCENTIVOS (1).pdf` — BPMN general
- `docs/FLUJO DE ESTADOS INCENTIVOS (1).pdf` — BPMN estados

---

## 8. Comandos útiles

### Arrancar preview server
```bash
cd ~/Desktop/incentivos-ui-ux-demo
# .claude/launch.json tiene el inline server en puerto 4500
# Claude Code lo arranca automáticamente con preview_start
```

### Abrir pantallas directo
```
http://localhost:4500/                                    (índice)
http://localhost:4500/incentivo-01-login.html
http://localhost:4500/incentivo-02-dashboard.html
http://localhost:4500/incentivo-03-programas.html
http://localhost:4500/incentivo-03-programas.html?new=1   (abre wizard modal)
http://localhost:4500/incentivo-05-programa-detalle.html?activated=1
```

### Ver DS playground
https://naowee-tech.github.io/naowee-design-system/playground.html

### Descargar DS CSS para inspeccionar
```bash
curl -s "https://cdn.jsdelivr.net/gh/naowee-tech/naowee-design-system@v1.4.0/dist/design-system.css" -o /tmp/naowee-ds.css
```

---

## 9. Prompt de arranque para la nueva sesión

Copia y pega esto al abrir Claude Code en el repo:

```
Soy Doug. Estoy continuando el desarrollo del demo UI/UX del módulo de Incentivos del SUID (Naowee).

Lee HANDOFF.md completo — ahí está todo el contexto del proyecto, el estado de las 13 pantallas, las decisiones de diseño, el mapeo de componentes del DS, los tokens de elevation naranja, y el feedback ya aplicado + pendiente.

También lee docs/reglas-de-negocio.md y docs/roles-matrix.md para entender alcance y roles.

Estado actual:
- Pantallas 01 (login), 02 (dashboard), 03 (programas + modal wizard) refactorizadas con DS components.
- Pantallas 05-13 aún tienen componentes custom que deben migrarse al DS siguiendo el mismo patrón que apliqué al 02.

Próximo paso: continuar el refactor aplicando el patrón del dashboard (sidebar con logos, badges quiet, progress __fill, thumbnails DS, btn--link para ghosts, naowee-segment para filtros) a las pantallas 05, 06, 07, 08, 09, 10, 11, 12, 13 — una por una.

Arranca con la pantalla 05 (detalle del programa). Muéstrame el plan antes de tocar código.
```

---

## 10. Checklist antes de cerrar la sesión actual

- [x] HANDOFF.md creado
- [x] Todos los archivos guardados
- [x] Preview verificado (sin errores de consola)
- [ ] **Commit a git** (opcional pero recomendado):
  ```bash
  cd ~/Desktop/incentivos-ui-ux-demo
  git add -A
  git commit -m "refactor: migrar 01 login, 02 dashboard, 03 programas a DS components + tokens de elevation naranja"
  git push origin main
  ```
- [ ] **Confirmar que el repo está en GitHub** (`naowee-tech/naowee-test-incentivos` o similar) — si no, créalo:
  ```bash
  gh repo create naowee-tech/naowee-test-incentivos --public --source=. --push
  ```
- [ ] **Guardar este HANDOFF** en algún lugar accesible desde la nueva cuenta (Drive, Notion, etc.).

---

**Último update:** 2026-04-23 · Sesión refactor DS + feedback dashboard · 13/13 pantallas existen, 3 refactorizadas, 10 pendientes.
