# Session Handoff — naowee-test-incentivos

**Fecha:** 2026-04-27
**Branch de trabajo:** `claude/pensive-mendeleev-1b45f3`
**Repo remoto:** https://github.com/naowee-tech/naowee-test-incentivos
**Worktree path:** `/Users/dvargas/Desktop/incentivos-ui-ux-demo/.claude/worktrees/pensive-mendeleev-1b45f3`

---

## Cómo continuar la sesión en otra cuenta

```bash
git clone https://github.com/naowee-tech/naowee-test-incentivos.git
cd naowee-test-incentivos
git checkout claude/pensive-mendeleev-1b45f3
git pull origin claude/pensive-mendeleev-1b45f3

# Servidor local (Node, puerto 4500, cache-control: no-store)
PORT=4500 node -e "const http=require('http'),fs=require('fs'),path=require('path'),url=require('url');const MIME={'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.json':'application/json','.csv':'text/csv','.pdf':'application/pdf'};const ROOT=process.cwd();http.createServer((req,res)=>{let p=url.parse(req.url).pathname;if(p==='/') p='/index.html';let f=path.join(ROOT,p);fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end('Not found: '+f);}else{const ext=path.extname(f).toLowerCase();res.writeHead(200,{'Content-Type':MIME[ext]||'text/plain','Cache-Control':'no-store'});res.end(d);}});}).listen(4500,()=>console.log('on 4500'));"
```

URL principal: http://localhost:4500/incentivo-03-programas.html

> Nota Claude Code: si `preview_start` se queja de que el puerto está ocupado, el servidor de preview oficial usa `.claude/launch.json` del checkout principal — apunta al directorio raíz, no al worktree. Cuando edites en el worktree, lanza el servidor manualmente con el comando de arriba.

---

## Resumen de cambios en esta sesión

### 1. Wizard "Crear programa de incentivos"

**Refactor estructural — 4 pasos (5to condicional)**

- Antes: 5 pasos (Datos · Rubro · Tipos · Condiciones · Códigos)
- Ahora: **4 pasos visibles**, con paso 4 condicional al tipo de incentivo:
  1. **Datos** — nombre, descripción, vigencia, cobertura, justificación + uploader
  2. **Tipos & rubro** — fusión de los antiguos pasos 2 y 3 (rubro total + cards de incentivo)
  3. **Condiciones** — un panel por incentivo en multi mode
  4. **Códigos** — sólo aparece si algún incentivo es categoría "Bono"

**Paso 1 — Datos**
- Justificación + nuevo uploader DS de "Documentación de la resolución":
  - Textfield-style con CTA ghost `naowee-btn--mute`
  - Spinner verde determinado con % al subir (animación rotación + arc)
  - Tag DS verde `naowee-tag--positive` al completar; CTA desaparece
  - Single-file (PDF/DOC/DOCX/JPG/PNG, 10MB máx)
- Cobertura territorial: "Nacional" es exclusiva (selecciónarla deshabilita y limpia los departamentos)

**Paso 2 — Tipos & rubro**
- Rubro total al tope del paso
- "Un solo tipo" → 1 card con nombre + categoría + valor unitario opcional
- "Varios tipos" → auto-agrega 2da card al elegir el toggle. Cada card tiene nombre + categoría + **rubro per-incentivo (obligatorio)** + valor unitario opcional. Sumatoria de rubros validada en vivo (positive cuando suma == total, informative cuando < total, negative cuando > total). Bloquea Continuar si la suma ≠ total.
- Categoría "Bono" enciende paso 4 inmediatamente. Cambiar a otra → paso 4 desaparece.

**Paso 3 — Condiciones**
- En multi mode, **un panel por incentivo** con header (badge categoría + nombre) y su propio cond-builder + preview en lenguaje natural.
- Multi-select habilitado para Categoría deportiva, Logros y Tipo de usuario (operadores `∈` y `∉`).
- Nuevo campo "Tipo de usuario" con opciones: Deportista, Personal de apoyo, Entrenador, Técnico, Médico, Fisioterapeuta, Árbitro/Juez, Delegado, Ciudadano.
- Sistema de **reglas implícitas**: `tipoUsuario:personal_apoyo` → "Debe ser el primer entrenador en su historial" (chip verde DS bajo la fila + sub-frase en preview).
- **Lenguaje natural mejorado** en la preview:
  - "tiene al menos 18 años" en vez de "Edad ≥ 18"
  - "compite en alguna de las categorías Juvenil o Mayores" en vez de "Categoría incluye {Juvenil, Mayores}"
  - "ha obtenido medalla de oro o medalla de plata" en vez de "Logros incluye {Medalla de oro, Medalla de plata}"
  - "es deportista o entrenador" en vez de "Tipo de usuario incluye Deportista, Entrenador"
  - Múltiples grupos OR → lista numerada con intro "El atleta es elegible si cumple cualquiera de estas reglas"
  - Reglas implícitas se acumulan al final como nota verde "**Además:** debe ser el primer entrenador en su historial"

**Paso 4 — Códigos (sólo Bono)**
- Manual rows: sin columna "Categoría" ni "Valor (opcional)" — sólo input de código + X (todos los códigos son bono → categoría redundante; valor unitario ya viene del paso 2).
- Validación al activar:
  - Modo upload: requiere archivo cargado (sino: mensaje DS negative + shake del dropzone)
  - Modo manual: requiere mín 1 fila con código (sino: marca filas vacías con error + scroll)

**Footer del wizard**
- Botón "Anterior" pasó de `--link` a `--mute --large` (mismo tamaño que "Guardar borrador")

**Save Draft / Activate**
- "Guardar borrador" desde cualquier paso: persiste el draft completo en `window.PROGRAMS_DATA` + `sessionStorage['naowee:program-draft-queue']`, cierra wizard, fila aparece de primera. **Sin toast.**
- `confirmSaveDraftWizard` (modal de descarte) usa el mismo flujo.
- "Activar programa" construye un program completo con todos los pasos parametrizados, lo unshift a PROGRAMS_DATA, encola a sessionStorage, navega a `?id={nuevoId}&activated=1` → el detalle muestra toast positive bottom-right "**Programa creado exitosamente.** {nombre} ya está disponible para los operadores en campo."

### 2. Lista de programas (`incentivo-03-programas.html`)

- **Drenaje de cola**: al cargar, lee `sessionStorage['naowee:program-draft-queue']`, hace unshift de cada draft a `PROGRAMS_DATA`, limpia la cola.
- Botón **Editar** ahora pasa el id: `openWizardForEdit('${p.id}')` → abre el wizard pre-poblado.
- `window.onDraftSaved`: re-sincroniza `PROGRAMS` desde `PROGRAMS_DATA`, resetea `state.page=1`, re-renderiza.

### 3. Detalle de programa (`incentivo-05-programa-detalle.html`)

- **Drenaje de cola** igual que la lista, antes del primer render.
- **Tab Resumen**:
  - `#incList` ahora con `display:flex; flex-direction:column; gap:10px` para que las cards respiren.
- **Tab Condiciones**:
  - **Solo el preview rico** (`#condPreview`). Eliminado el bloque duplicado `#condSummary`.
  - Si los incentivos del programa traen sus propias condiciones (multi mode con conditions per-incentive), se renderiza un bloque por incentivo con header (#N · Nombre · Categoría) y sus reglas en lenguaje natural.
- **Tab Códigos**:
  - Si el programa es `_userCreated`, usa `manualCodes` reales en estado "Sin asignación". 0 códigos fake.
  - Si es demo seeded, mantiene la simulación rica escalada con `program.codes.total`.
- **Tab Asignaciones**:
  - Si `_userCreated` → lista vacía (programa recién creado).
  - Si demo seeded → 182 asignaciones simuladas.
- **Tab Historial**:
  - HTML estático eliminado. Ahora dinámico vía `renderHistorial()`:
    - `_userCreated`: mínimo timeline (Programa creado, opcionalmente Cargue de N códigos, Programa activado) con fechas reales del `createdAt`.
    - Seeded: timeline rico simulado.
- **Botones Editar**:
  - Header: "Editar" → `editCurrentProgram()` que llama `openWizardForEdit(CURRENT_PROGRAM.id)`.
  - Tab Condiciones: "Editar reglas" → `editCurrentProgram(3)` (salta directo al paso 3).
- **Toast post-activación**: detecta `?activated=1`, muestra toast DS positive bottom-right por 5.5s, limpia el query param vía `history.replaceState`.

### 4. Página standalone `incentivo-04-programa-crear.html` (legacy)

- `saveDraft()` ya no es alert. Captura nombre, descripción, rubro, vigencia desde/hasta, formatea fechas a `dd mmm yyyy`, encola en `sessionStorage` y navega a la lista.

### 5. Persistencia y sistema de drafts

**Cola compartida** (`naowee:program-draft-queue` en sessionStorage):
- Empuja: cualquier flujo que cree/guarde un programa antes de navegar.
- Drena: cualquier página que use `PROGRAMS_DATA` (lista, detalle).
- Patrón LIFO con `queue.reverse().forEach(p => unshift)` → el último guardado queda primero.

**Modelo de programa creado por usuario**:
- `_userCreated: true` (bandera para distinguir del seeded)
- `manualCodes: string[]`
- `codesMode: 'upload' | 'manual' | 'none'`
- `codesFile: string` (nombre del archivo subido)
- `createdAt: ISO timestamp`
- `incentives[].conditions = { groups, summary }` (cuando hay multi)
- `conditions = { groups, summary }` (cuando hay single)

**Apertura del wizard en modo edición**:
- `openWizardForEdit(id)` busca el programa, llama `resetWizardForm()`, luego `populateWizardFromProgram(p)`.
- Repuebla: nombre, descripción, vigencia desde/hasta, rubro total, modo single/multi (agrega cards si faltan), nombre + categoría + valor unitario por card, modo de códigos (manual con sus filas reales).
- **No repuebla** condiciones del paso 3 (regenera estructura limpia al entrar — comportamiento aceptable para demo).

---

## Cache busting

Todas las páginas linkean `shared/profile-switcher.js?v=role-6`.
La página `incentivo-03-programas.html` linkea `shared/programs-data.js?v=cat-icons-2`.

**Si haces cambios en `shared/profile-switcher.js`**: bump version en todas las páginas:
```bash
python3 -c "
import re, glob
for f in glob.glob('incentivo-*.html'):
  with open(f) as fh: t = fh.read()
  new = re.sub(r'profile-switcher\\.js\\?v=role-\\d+', 'profile-switcher.js?v=role-7', t)
  if new != t:
    with open(f, 'w') as fh: fh.write(new)
"
```

---

## Convenciones del proyecto

- **CSS scope**: estilos del wizard scope con `.wz-modal` para no afectar otros modales.
- **Roles**: `data-role="admin|programa|operador|all"` en cualquier elemento se respeta automáticamente. Excluido `.profile-dd__item`.
- **DS first**: usar componentes `naowee-*` antes de inventar custom (`naowee-tooltip`, `naowee-tag`, `naowee-message`, `naowee-segment`, `naowee-radio`, `naowee-progress`, etc).
- **Tag exclusiva**: `data-exclusive="true"` en una opción de `wz-tag-multi` la convierte en exclusiva (selecciona → reemplaza la lista; deshabilita las demás opciones). Patrón usado por "Nacional" en cobertura.
- **Lenguaje natural de condiciones**: helper `ruleToNaturalSentence(fieldKey, opVal, valueLabels)` en `programa-wizard.js`. Para añadir un nuevo campo, extender `COND_FIELDS` y añadir un branch en el helper.
- **Reglas implícitas**: `COND_IMPLIED['fieldKey:value'] = 'frase natural'`. Se renderizan como chip DS positive bajo la fila + se acumulan en la preview.
- **Drafts cross-page**: empuja a `sessionStorage['naowee:program-draft-queue']` antes de navegar; las páginas que rendericen la lista lo absorberán al cargar.

---

## Pendientes / próximos pasos sugeridos

- [ ] Repoblar condiciones en `populateWizardFromProgram` (paso 3 — actualmente se regenera vacío al editar).
- [ ] Repoblar cobertura territorial al editar (requiere re-render de chips del `wz-tag-multi`).
- [ ] Repoblar fechas con datepicker (actualmente sólo se setea el `value` del input — el datepicker DS podría no reflejarlo).
- [ ] Repoblar Justificación + archivos anexos al editar.
- [ ] Si el cliente quiere, soporte multi-programa (`assignedPrograms: [...]` con > 1 ID en el rol Gestor).
- [ ] Tests visuales/regresión (Playwright) para los flujos críticos.
- [ ] Validar el hero de Gestor de programa con stakeholders.

---

## Archivos modificados en esta sesión

```
shared/programa-wizard.html   — Stepper 4 pasos · paneles condiciones · paso 2 fusionado
shared/programa-wizard.js     — buildProgramFromForm · openWizardForEdit · natural language · multi conditions
shared/programa-wizard.css    — Tokens green DS · spinner · panels · cond preview natural
incentivo-03-programas.html   — Drenaje cola · botón Editar pasa id
incentivo-04-programa-crear.html — saveDraft cross-page (legacy page)
incentivo-05-programa-detalle.html — Drenaje cola · seedCodigos/Asign user-created · historial dinámico · toast activación · editCurrentProgram · removed condSummary · gap entre inc-cards
```

---

## Memoria útil

- El servidor anterior (PID viejo) puede quedar zombie en :4500. Si el servidor responde con paths viejos: `lsof -ti :4500 | xargs kill -9` antes de relanzar.
- Pages activos en demo: `incentivo-01` … `incentivo-14`.
- Los datos vienen de `shared/programs-data.js` (`window.PROGRAMS_DATA`).
- Stakeholders / roles definidos en `shared/profile-switcher.js`.
- El DS está en CDN: `https://cdn.jsdelivr.net/gh/naowee-tech/naowee-design-system@v1.4.0/dist/design-system.css`. La copia local para inspección: `/Users/dvargas/Desktop/naowee-design-system/dist/design-system.css`.
- En este DS, "ghost button" = `naowee-btn--mute`. NO existe `--ghost`.
- En este DS, los tags **no** tienen modificador `--quiet` (algunos call-sites legacy lo usan inocuamente). API real: `naowee-tag` + `--accent | --positive | --caution | --negative` + opcional `--small` + opcional `naowee-tag__active-area > naowee-tag__close` para dismiss.
