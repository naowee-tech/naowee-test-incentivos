# Handoff — Aprendizajes de la sesión

**Propósito:** Dar contexto denso a la próxima sesión sobre el sistema de diseño Naowee, los patrones visuales, las reglas de negocio y los detalles que tomaron iteración descubrir, para evitar re-iterar lo mismo.

**Repo:** `naowee-tech/naowee-test-incentivos` · **Branch:** `claude/pensive-mendeleev-1b45f3` · **Demo:** https://naowee-tech.github.io/naowee-test-incentivos/

---

## 1. Design System — reglas duras

- **DS:** `https://cdn.jsdelivr.net/gh/naowee-tech/naowee-design-system@v1.4.0/dist/design-system.css` (siempre cargar primero, antes de styles locales).
- **Ghost button = `naowee-btn--mute`** (NO existe `--ghost`).
- **Primary CTA con elevation naranja = `naowee-btn--loud`** (NO `--accent` ni `--primary`).
- **Tags removibles** usan estructura: `<span class="naowee-tag naowee-tag--accent"><span class="naowee-tag__label">…</span><span class="naowee-tag__active-area"><span class="naowee-tag__close">…</span></span></span>`. NO existe `naowee-tag--quiet`.
- **Mensajes informativos/caution/positive/negative** SIEMPRE usar `naowee-message` con `__header > __icon + __text`. Nunca cajas naranja custom.
- **Paginación DS:** `naowee-pagination naowee-pagination--small` con `__pages` (label + input + total) y `__controls` (prev/next btns). El gap interno lo maneja el DS — no añadir overrides custom.
- **Tooltip DS:** `<span class="naowee-tooltip"><button>…</button><span class="naowee-tooltip__content">Texto</span></span>`.
- **Iconografía centralizada:** `window.CAT_ICONS` en `shared/programs-data.js` define el SVG path por categoría (Beca/Bono/Kit/Inscripción/Transporte/Pase/Descuento/Dinero). Reutilizar siempre vía `iconForType(tipo)` para paridad cross-page.
- **Componentes que faltan en el DS** y se construyeron locales: filter popover, code history popover, evidence lightbox, greeting hero. Mantener el patrón establecido si los toca.

## 2. Layout shell

- `shared/shell.css` define `.shell > .sidebar + .main > .top-header + .page` (page tiene `flex:1; overflow-y:auto`).
- **`.page` ES el scrollport** (no `window`). Cualquier listener de scroll va sobre `.page`.
- **Sidebar colapsable** (patrón validado, NO improvisar):
  - Easing Apple-style `cubic-bezier(.32,.72,0,1)` 360ms en width.
  - Labels con `max-width:0 + opacity:0` (NUNCA `display:none` — corte abrupto rechazado).
  - Hover/active en colapsado = cuadrado 40×40 vía `::before` (gris hover, accent claro active). NO usar el ancho completo del row.
  - `.nav-row { margin: 0 10px }` para que hover/active no toquen los bordes.
  - `.active-bar` en `left:-6px` (negativo) para asomar al borde del sidebar manteniendo el respiro lateral.
  - Animación de entrada de `.active-bar` con `cubic-bezier(.16,1,.3,1)` 420ms (slide+scaleY).
- **Stepper sticky con progressive collapse** (paso 1 patrón maestro):
  - El `.stepper` es el sticky directamente (sin wrapper).
  - JS interpola `progress = 1 - dist/60` y aplica `lerp` a margin/padding/radii/labels max-width.
  - Necesita `padding-bottom:240px` en `.page` o `page-header` arriba para que haya scroll runway suficiente.
  - Aplicar a TODAS las páginas con stepper (incentivo-08/09/10) por consistencia.
- **Footer flotante Naowee:** `shared/footer-scroll.js` + CSS en `shell.css`. Animación scroll up = oculta · scroll down = muestra.

## 3. Cards de métricas (KPI)

Regla unificada en `shell.css`:
- **Estado idle = elevation suave** (`0 1px 3px + 0 6px 16px rgba(145,158,171,...)`).
- **Sin border** (`border:none !important`).
- **Sin hover** (`transform:none !important`, misma sombra).
- Aplica a `.kpi-card` y `.sum-card`. Override con `!important` para vencer declaraciones inline de cada página.

## 4. Tablas

- **Header gris:** `background:#f5f6fa`, `font-size:11px`, `font-weight:600`, `letter-spacing:.3px`, `text-transform:uppercase`, `color:--text-secondary`, `padding:12px 18px`, esquinas redondeadas en first/last child.
- **Body:** `padding:14px 18px`, `font-size:13px`, `border-bottom` entre rows, hover `#fafbfd`.
- Patrón de referencia: `.asig-table` en `incentivo-12-asignaciones.html`.

## 5. Animaciones reusables

- `fadeAndGo(href)` para navegación: fade solo `.page` (NO body — sidebar/header deben quedar fijos).
- Modal/lightbox: `evScaleIn` (.96 → 1) + `evFadeIn`.
- Greeting wave: 👋 con `@keyframes greetWave` (rotación discreta, 2.4s loop).
- Respect `prefers-reduced-motion` en animaciones perpetuas.

## 6. Reglas de negocio

- **Solo `incentives[0].category === 'Bono'` maneja códigos canjeables.** Beca/Kit/Inscripción/Transporte se asignan directo sin código.
- **Reversión = código vuelve a `disp`** (no estado terminal). El historial se guarda en `c.reversionHistory[]` + `localStorage['naowee-reversiones']`. La reversión ya no es estado, es entry de auditoría.
- **Trazabilidad obligatoria:** quién revirtió, quién solicitó, motivo, fecha, beneficiario previo, justificación.
- **Estados de código:** Disponible / Asignado / Reasignado / Revertido (4 colores: gris/verde/morado/rojo).
- **Pausado NO existe** (eliminado de status). Solo: Activo, Borrador, Cerrado.

## 7. Formato de valores

- **Siempre formato es-CO completo:** `$1.000.000` (no `$1M`, no `$1.0M`, no `$1K`).
- `Number(v).toLocaleString('es-CO')`. Solo en KPIs muy grandes (>$100M) admitir compact.
- Font: **Inter siempre** (`font-family:'Inter',sans-serif`) + `font-variant-numeric:tabular-nums`. Nunca dejar herencia que termine en serif/Nuno.
- Casos `null/0` → "Sin valor" italic gris (`#9c9ebf`).

## 8. Componentes custom validados

### Filter popover (reportería)
- **1 botón con badge naranja contador**, no múltiples dropdowns inline.
- Popover único con secciones (Año/Mes/Programa/Logro), cada una con check naranja en seleccionados.
- Tags removibles al lado del botón con close DS.
- Año siempre genera tag (no hay estado "neutral").

### History popover (códigos)
- Trigger: icono ↻ **naranja por default** (`background:#fff3e6;color:#d74009`), no gris. Llama atención.
- Popover **560px de ancho** + body en `grid-template-columns:1fr 1fr` (horizontal, no vertical largo).
- Filas full-width vía `.rv-row--full` para Estados/Beneficiario previo/Justificación.
- Pills DS para timeline: Asignado → Revertido → Disponible (verde/rosa/azul).
- Posicionamiento `position:fixed` con `getBoundingClientRect` del trigger + auto-flip si no cabe.

### Modal "Cargar inventario" (detalle programa)
- **Step 1 = elegir tipo** (5 cards con icono CAT_ICONS). NO tipo en cada fila.
- Step 2 condicional:
  - Bono → segment `Cargar archivo | Manual`. Manual NO incluye columna Categoría (heredada del Step 1).
  - Resto → cantidad + valor (sin código).
- **CTA disabled hasta input válido** (archivo subido / fila con código / cantidad+valor > 0).

### Evidence lightbox (asignaciones)
- Trigger: icono ojo DS ghost con `naowee-tooltip "Ver evidencia"`.
- Modal con foto real (Unsplash) + meta DS estructurada (Beneficiario/Código/Operador/Región/Fecha/Estado).
- Cerrar: backdrop click, X, Esc. Sin botón "Cerrar" redundante en footer.

## 9. Iconos de sidebar (validados)

- **Dashboard:** grid widget asimétrico (panel principal + 3 widgets).
- **Programas:** maletín con tab + línea divisoria.
- **Códigos:** voucher con muescas dashed.
- Mismo SVG en estado default (stroke `#646587`) y active (stroke `#d74009`).
- Cuando agregues una página nueva con sidebar, copia el bloque completo de las páginas existentes.

## 10. Pitfalls confirmados (no repetir)

- **NO usar bulk Python regex sobre archivos .js sin validar con `node`.** En esta sesión rompí `programs-data.js` dejando sintaxis Python literal (`float(m.group(1))`). Romper ese archivo deja vacíos KPIs y tablas en TODAS las páginas.
- **NO `display:none` para colapso de labels en sidebar** — corte abrupto rechazado.
- **NO hover background a todo el ancho del row colapsado** — debe ser cuadrado del icono.
- **NO abreviar valores monetarios** ($1M/$350K rechazado universalmente).
- **NO confundir `<a>`'s default underline con dashed border-bottom** — usar `text-decoration:underline; text-underline-offset:3px` en hover.
- **NO olvidar `?from=...` en links de detalle** para que el botón "Volver" regrese al origen correcto.
- **NO inventar variantes de DS components** — verificar primero (`grep` el codebase + design-system.css local).

## 11. Tooling

- Servidor local: `PORT=4500 node -e "..."` en `SESSION-HANDOFF.md` raíz.
- Validar JS post-edit: `node -e "global.window={};const fs=require('fs');eval(fs.readFileSync('shared/programs-data.js','utf8'));console.log(window.PROGRAMS_DATA.length)"`.
- Demo pública vía GitHub Pages (servida desde `main`). Push directo a la branch del PR + `gh pr merge --merge --admin` propaga en 30–60s.

## 12. Memoria persistente del workflow

Patrón guardado en `~/.claude/projects/.../memory/project_naowee_sidebar_pattern.md` con la receta exacta del sidebar. Cuando el usuario diga "aplica el patrón del sidebar Naowee" en otro proyecto, leer esa memoria.

---

**Para la próxima sesión:** lee este doc + `CLAUDE.md` raíz + memoria del proyecto antes de tocar código. La mayoría de iteraciones se evitaron leyendo este contexto.
