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

URL principal: http://localhost:4500/incentivo-02-dashboard.html

---

## Resumen de cambios en esta sesión

### 1. Wizard "Crear programa de incentivos" (`shared/programa-wizard.*`)
- **Paso 3 · Tipos de incentivo**:
  - Radio buttons del DS (`naowee-radio` + `naowee-radio__circle` con `--selected`).
  - Cards `.toggle-card` con `align-items: center`.
  - Badge `Incentivo #N` ahora usa `naowee-badge --neutral --quiet --small` (low contrast).
- **Paso 4 · Condiciones**:
  - Stepper de Edad sin modifier `--small` (alto 48px = mismo que dropdown).
  - Bug pill del segment corregido: `padLeft` → `borderLeft` en `wireSegments`.
  - Vista preview en lenguaje natural con font-weights bajados (700→600, 600→500).
- **Paso 5 · Códigos**:
  - Pill del segment "Cargar archivo / Manual" respeta padding-left.
- **Required marker**:
  - Asterisco naranja unificado en `naowee-dropdown__label--required` y `naowee-textfield__label--required`.
  - Helper informativo se oculta cuando el field entra en error (scope `.wz-modal`).

### 2. Lista de programas (`incentivo-03-programas.html`)
- Iconos por categoría dinámicos vía `window.CAT_ICONS` (8 íconos: Beca, Kit, Bono, Transporte, Inscripción, Descuento, Pase, Dinero).
- Tooltip "Editar" del DS (`naowee-tooltip` + `naowee-tooltip__content`).
- Botón Editar único en color accent naranja, removido el menú de 3 puntos.
- Padding-right de columna Acciones aumentado a 32px.
- **Vista diferenciada por rol**: para Gestor de programa se muestra un `prog-hero` (single-program command center) en lugar de la tabla.

### 3. Detalle de programa (`incentivo-05-programa-detalle.html`)
- Hero card unificado: header + 4 KPIs en un solo container con divider sutil. KPI "Ejecutado" como hero (font 28px accent + barra 6px).
- Tab Condiciones: usa el mismo UI de `wz-cond-preview` que el wizard + resumen humano "En lenguaje natural".
- Tab Resumen → Información general: removidos dividers entre items (ritmo por spacing).
- Botón "Cargar códigos" igualado al alto de search/dropdown (34px).

### 4. Códigos (`incentivo-07-codigos.html`)
- **Modal Revertir código completamente refactorizado**:
  - Card del programa rediseñada (top con código + monto, divider, filas Programa/Beneficiario).
  - Helpers removidos, sólo aparece "Este campo es obligatorio" en estado error usando `.naowee-dropdown__helper.rv-error-only`.
  - Asteriscos dobles eliminados (sólo el del DS).
  - "Realizado por" como card readonly con icono de persona, no input editable.
- **Toast de éxito**: estructura DS correcta (`naowee-message__title` + `__content` + `__action` + `__dismiss`).

### 5. Dashboard (`incentivo-02-dashboard.html`)
- Sidebar slide animation: removidos los `view-transition-name` en icon/lbl que causaban bug visual entre páginas con SVGs distintos. Sólo el bar naranja desliza.
- 4 íconos del sidebar nuevos (bar chart, 2 cards apiladas, hashtag itálico, timeline vertical).
- Programas activos: 7 → 5 filas (preview).
- Actividad reciente: 5 → 5 filas (preview, mismo alto).
- Distribución geográfica: progress de 8px → 4px (sin `--lg`).
- KPI cards hidratados desde `PROGRAMS_DATA` (agregados de inventario, asignados, revertidos, ejecución).

### 6. Mis asignaciones (`incentivo-14-mis-asignaciones.html`)
- Banner "Doug Vargas Operador en campo" removido.
- Period tabs reemplazado por `naowee-segment` del DS con pill animado e init en page load.
- Bug `p.budget` (no existe) → `p.rubro` corregido (los valores ya no muestran $NaN).

### 7. Validar foto (`incentivo-09-validar-foto.html`)
- Evidencia: texto verde reemplazado por `naowee-tag --positive --small --quiet` con icono de archivo.

### 8. Asignar incentivo (`incentivo-08-asignar-buscar.html`)
- Stepper labels ya no se cortan al final (Math.ceil + 2px safety en el measurement inicial).

### 9. Asignación exitosa (`incentivo-11-asignar-exito.html`)
- Removida opción "Índice" del sidebar.

### 10. Iconos sidebar (8 páginas)
- Dashboard: bar chart con eje
- Programas: 2 cards apiladas
- Códigos: hashtag itálico (#)
- Historial: timeline vertical (3 dots conectados)

### 11. Nuevo perfil "Gestor de programa" (`shared/profile-switcher.js`)
- Persona: **Camila Restrepo** (CR, avatar azul `#bfdbfe`/`#1e3a8a`).
- Programa asignado: **PRG-2026-003** (Bono transporte intercolegiados).
- API genérica: `window.getRoleAssignments()` retorna IDs asignados o `null`.
- API genérica: `window.onRoleApplied(role)` callback que cada página puede implementar para reaccionar a cambios de rol sin depender del timing de scripts deferred.
- Switcher dropdown: `DEFAULT_ROLES_IN_DD = ['admin', 'programa', 'operador']` aplica en todas las páginas.
- Páginas que tenían `<div class="profile-dd">` hardcodeado fueron limpiadas para que el JS auto-inyecte el dd con los 3 roles (dashboard, detalle, asignar-buscar, template).

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

---

## Pendientes / próximos pasos sugeridos

- [ ] Validar el hero de Gestor de programa con stakeholders (¿es la jerarquía correcta? ¿faltan métricas?).
- [ ] Considerar agregar una segunda vista para Gestor de programa con asignaciones de su programa (timeline filtrado).
- [ ] Si el cliente quiere, soporte multi-programa (`assignedPrograms: [...]` con > 1 ID).
- [ ] Tests visuales/regresión (Playwright) para los flujos críticos.

---

## Memoria útil

- El servidor anterior (PID viejo) puede quedar zombie en :4500. Si el servidor responde con paths viejos: `lsof -ti :4500 | xargs kill -9` antes de relanzar.
- Pages activos en demo: `incentivo-01` … `incentivo-14`.
- Los datos vienen de `shared/programs-data.js` (`window.PROGRAMS_DATA`).
- Stakeholders / roles definidos en `shared/profile-switcher.js`.
