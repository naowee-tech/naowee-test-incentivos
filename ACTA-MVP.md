# ACTA DE ALCANCE MVP — Epic: Incentivos

**Proyecto:** Naowee — Sistema Único de Información del Deporte (SUID)
**Epic:** Incentivos (Parametrización de programas, asignación en campo, trazabilidad y reportería)
**Fecha:** 28 de abril de 2026
**Versión:** 1.0.0
**Roles involucrados:** Gestor de Incentivos (Administrador) y Operador (Responsable en campo)

---

## 1. Resumen Ejecutivo

El MVP de Incentivos permite al Ministerio del Deporte parametrizar programas de incentivos (becas, bonos, dotaciones, accesos preferentes), cargar y administrar el inventario de códigos asociados, asignarlos en campo a deportistas y personal de apoyo previa validación de condiciones de elegibilidad, registrar evidencia de entrega y mantener trazabilidad completa con un historial nacional auditable. Un Gestor con jerarquía nacional administra programas, códigos y reversiones, mientras múltiples Operadores distribuidos por evento ejecutan la entrega en campo desde dispositivos móviles o tablets.

El módulo cubre **15 pantallas**, **2 roles operativos**, **3 estados del código** (sin asignar / asignado / revertido), parametrización de programas con condiciones lógicas AND/OR, carga masiva o manual del inventario, asignación con evidencia de entrega, reversión con motivo obligatorio, reportería consolidada con filtros multi-dimensión y exportación CSV, todo construido sobre el Design System Naowee `@v1.4.0` consumido vía CDN.

---

## 2. Historias de Usuario — Gestor de Incentivos (Administrador)

### HU-GI-01: Login y Selección de Rol

**Como** funcionario del ministerio
**quiero** acceder al SUID con mis credenciales y elegir el rol con el que voy a operar
**para** entrar a las funcionalidades correspondientes a mi sesión.

**Criterios de aceptación:**
- Pantalla de login con carrusel de 5 slides motivacionales (deporte colombiano)
- Campos: correo electrónico (validación email), contraseña (toggle visibilidad)
- Header institucional: logos Ministerio del Deporte + SUID con divider
- Selector de rol post-login: **Gestor de incentivos** o **Operador en campo**
- Cambio de rol en sesión disponible desde el chip de perfil del header
- Avatar con color plano por rol (naranja brand para Gestor, morado para Operador)

---

### HU-GI-02: Dashboard del Gestor

**Como** gestor de incentivos
**quiero** ver el estado nacional de los programas, rubros y asignaciones recientes
**para** monitorear la ejecución y detectar puntos de atención.

**Criterios de aceptación:**
- KPIs principales: programas activos, rubro total ejecutado, códigos asignados, asignaciones del periodo
- Filtros segmentados (`naowee-segment`) Hoy / 7 días / 30 días con sliding pill animado
- Tabla de programas activos con: nombre, rubro, ejecutado, disponible, progreso, asignaciones
- Barras de progreso del DS (`naowee-progress__fill`, sin gradient)
- Badges de estado en variante `--quiet` para baja contraste
- Sección "Últimas asignaciones" con thumbnails del DS
- CTAs principales: "Ver programas" (ghost large) + "Nuevo programa" (loud large)
- Sidebar con logos institucionales Ministerio del Deporte + SUID

---

### HU-GI-03: Listado de Programas

**Como** gestor
**quiero** ver todos los programas parametrizados con su estado, rubro y avance
**para** administrar el portafolio nacional de incentivos.

**Criterios de aceptación:**
- Tabla con columnas: nombre, evento asociado, rubro total, ejecutado, disponible, vigencia, estado, acciones
- Estados visibles: Borrador, Activo, Pausado, Cerrado (con badges DS por color)
- Buscador por nombre de programa o evento
- Filtros por estado y por evento
- Botón "Crear programa" (CTA principal `--loud --large`) → abre wizard modal
- Click en row → detalle del programa
- Datos persistidos vía `programs-data.js` compartido entre pantallas

---

### HU-GI-04: Wizard de Creación / Edición de Programa (Modal)

**Como** gestor
**quiero** parametrizar un programa nuevo en pasos guiados
**para** definir su rubro, condiciones, tipos de incentivo y vigencia sin salir de la pantalla de programas.

**Criterios de aceptación:**
- Modal a pantalla completa con stepper interno de 5 pasos visibles y conectores
- **Paso 1 — Datos generales:** nombre, evento asociado (opcional), descripción, cobertura territorial multiselect (tag-input con dropdown de departamentos / municipios), vigencia desde-hasta con validación de rango
- **Paso 2 — Condiciones de elegibilidad:** dimensiones disponibles (edad, género, estrato, disciplina, categoría deportiva, zona urbana/rural, logros, matrícula activa) combinables con operadores lógicos **AND / OR** y agrupaciones
- **Paso 3 — Tipos de incentivo:** lista libre de tipos asociados al programa, cada uno marcable como cualitativo / monetario / ambos, con valor unitario cuando aplica
- **Paso 4 — Rubro:** monto total del programa, descuento automático por asignación, validación de coherencia con valor unitario (si cada código vale $1M, el rubro/100 debe permitir 100 códigos exactos)
- **Paso 5 — Resumen y activación:** revisión final, opción "Guardar borrador" o "Activar programa"
- Validación bloqueante por paso (wiggle + scroll automático al primer error)
- Stepper sticky en el header del modal con padding alineado al header del DS
- Modal con confetti + success message al activar
- El programa puede **editarse después de activarse** para ampliar rubro o agregar códigos (RN-01.4)

---

### HU-GI-05: Detalle del Programa

**Como** gestor
**quiero** ver toda la información de un programa, sus códigos y sus asignaciones
**para** auditar su ejecución y tomar decisiones de ampliación o cierre.

**Criterios de aceptación:**
- Header con: nombre, evento, vigencia, estado (badge), CTAs (Editar / Pausar / Ampliar rubro)
- Tarjetas resumen: rubro total, ejecutado, disponible, # códigos, # asignaciones, # revertidas
- Tabs: Información general, Códigos, Asignaciones, Historial
- Tab Información general: datos del wizard en read-only (cobertura, condiciones, tipos, vigencia)
- Tab Códigos: tabla del inventario filtrable por estado, con CTA "Cargar inventario" (modal)
- Tab Asignaciones: tabla cronológica de entregas del programa
- Tab Historial: timeline de eventos (creación, ampliación de rubro, cargas de códigos, pausas)

---

### HU-GI-06: Cargar Inventario de Códigos (Modal)

**Como** gestor
**quiero** cargar códigos al programa de forma masiva o manual
**para** poblar el inventario sin salir del detalle del programa.

**Criterios de aceptación:**
- Modal lanzado desde el detalle del programa (parametrización siempre en modal — feedback Doug)
- Tabs internos por **tipo de carga**: Excel / CSV (masiva) y Manual (uno a uno)
- **Modo masivo:**
  - Drop zone `naowee-file-uploader` para `.xlsx` o `.csv`
  - Preview de primeras filas + validación de columnas requeridas (`código`, `categoría`, `evento` opcional)
  - Resumen pre-carga: # códigos a importar, valor unitario detectado, total a sumar al rubro
  - Validación de coherencia: si cada código vale $1M y el rubro disponible no alcanza, bloquea con mensaje
- **Modo manual:**
  - Formulario con campos: código de incentivo, categoría/tipo, evento asociado (opcional)
  - Botón "Agregar otro" para acumular varios antes de confirmar
  - Lista en vivo de códigos pendientes con opción de eliminar
- Botón "Cargar inventario" (loud large) confirma y persiste
- Toast de éxito + cierre del modal + refresh del tab Códigos

---

### HU-GI-07: Inventario Consolidado de Códigos

**Como** gestor
**quiero** ver todos los códigos del sistema en una vista consolidada
**para** auditar el inventario nacional y filtrar por programa, estado o beneficiario.

**Criterios de aceptación:**
- Tabla con columnas: código, programa asociado, categoría, valor unitario, estado, beneficiario (si aplica), fecha de asignación
- Estados visibles: Sin asignación (neutral), Asignado (positive), Revertido (caution)
- Filtros: por programa (dropdown), por estado, búsqueda por código o beneficiario
- Paginador con input de página
- Click en row → drill-down a la asignación si existe

---

### HU-GI-08: Historial de Asignaciones (Nacional)

**Como** gestor
**quiero** un registro completo de todas las asignaciones entregadas en el país
**para** auditar el flujo, consolidar reportes y revertir cuando un operador me lo solicite.

**Criterios de aceptación:**
- Tabla con: fecha, beneficiario, documento, programa, código, valor, operador, región/municipio, estado
- Filtros: programa, región, municipio, ciudad, estado, rango de fechas
- Buscador por nombre o documento del beneficiario
- Paginador
- Acción "Revertir" disponible por fila (RN-07.1: solo admin)
- Acción "Ver detalle" → ficha de la asignación con foto/archivo de evidencia y geo-stamp

---

### HU-GI-09: Reversión de Asignación con Motivo

**Como** gestor
**quiero** revertir una asignación específica e ingresar el motivo
**para** corregir errores reportados por el operador y devolver el código al inventario.

**Criterios de aceptación:**
- Modal de reversión con: resumen de la asignación + textarea obligatorio para motivo
- Validación: motivo no vacío
- Al confirmar:
  - El código pasa a estado `Sin asignación` y queda disponible para reasignación
  - La asignación queda en estado `Revertido` con: admin que revirtió, motivo, fecha, referencia a la asignación original
  - Se agrega evento al historial del programa
- Pantalla de éxito con confirmación visual + opción "Volver al historial"
- El motivo persiste en la trazabilidad (auditoría)

---

### HU-GI-10: Reportería Consolidada

**Como** gestor
**quiero** generar reportes filtrados por periodo, programa y logro
**para** rendir cuentas, auditar y entregar consolidados al ministerio.

**Criterios de aceptación:**
- KPIs del periodo filtrado: # beneficiarios, valor entregado, # documentos/resoluciones
- Selector de filtros avanzados via popover anclado al botón "Filtros":
  - Año (con default `2026`)
  - Mes (todo el año o específico)
  - Programa (todos o uno específico)
  - Logro (cualquiera, oro, plata, bronce)
- Tags activos al lado del botón Filtros con X para remover
- Badge en el botón Filtros con el conteo de filtros aplicados (incluye Año por defecto)
- Tabla del reporte con: beneficiario, documento, disciplina, departamento, logro (con medalla), programa, resolución (link a acto administrativo), fecha, valor
- Paginación pequeña (`naowee-pagination--small`)
- Botón "Descargar reporte" (CTA loud) genera CSV con BOM UTF-8 separado por `;` para apertura directa en Excel
- Nombre del archivo derivado dinámicamente del título y periodo

---

## 3. Historias de Usuario — Operador (Responsable en Campo)

### HU-OP-01: Buscar Beneficiario por Documento

**Como** operador en campo
**quiero** buscar a un deportista por su cédula
**para** validar que cumple condiciones y proceder con la asignación.

**Criterios de aceptación:**
- Campo de búsqueda principal por documento (cédula, tarjeta de identidad, pasaporte)
- Dropdown de tipo de documento
- Búsqueda alternativa por nombre
- Resultado muestra: foto, nombre completo, edad, género, disciplina, departamento, categoría
- El sistema **filtra automáticamente** contra las condiciones de los programas activos
- Si la persona **no cumple** ninguna condición → mensaje "no tiene incentivos aplicables" (RN-04.5)
- Si cumple → lista de programas/incentivos disponibles con CTA "Asignar"
- Soporte para personal de apoyo (fisios, médicos) además de deportistas

---

### HU-OP-02: Seleccionar Tipo de Incentivo y Código

**Como** operador
**quiero** elegir el tipo de incentivo aplicable y el código del inventario que voy a entregar
**para** completar la asignación de forma trazable.

**Criterios de aceptación:**
- Lista de tipos de incentivo disponibles para el beneficiario (cualitativos y/o monetarios)
- Selector de código del inventario disponible (asignación **manual**, no FIFO automático — RN-05.10)
- Vista previa: programa, tipo, valor, código seleccionado
- Botón "Continuar" lleva a la pantalla de evidencia

---

### HU-OP-03: Subir Evidencia de Entrega

**Como** operador
**quiero** adjuntar foto del beneficiario recibiendo el incentivo o un archivo de respaldo
**para** dejar la trazabilidad de la entrega física.

**Criterios de aceptación:**
- Componente `naowee-file-uploader` para foto (cámara o galería) o archivo (PDF, imagen)
- Aclaración explícita: la "validación de fotografía" **NO es biométrica** — es evidencia de entrega (RN-06.5)
- Campo opcional de notas
- Captura automática de geo-stamp y dispositivo
- Botón "Confirmar asignación" (CTA loud large)
- Validación: evidencia obligatoria antes de confirmar

---

### HU-OP-04: Confirmación de Asignación Exitosa

**Como** operador
**quiero** confirmación visual de que la asignación quedó registrada
**para** continuar con el siguiente beneficiario sin dudas.

**Criterios de aceptación:**
- Pantalla de éxito con: nombre del beneficiario, tipo de incentivo, código, fecha y hora
- Mensaje: "El incentivo quedó registrado en el historial del beneficiario dentro del sistema" (RN-06.9)
- CTAs: "Asignar a otro beneficiario" (loud) y "Volver al inicio" (mute)
- Toast de éxito persistente

---

### HU-OP-05: Mis Asignaciones (Vista del Operador)

**Como** operador
**quiero** ver únicamente las asignaciones que yo he entregado
**para** revisar mi gestión personal del día / evento.

**Criterios de aceptación:**
- Tabla scoped al operador autenticado (no ve asignaciones de otros operadores)
- Columnas: fecha, beneficiario, programa, código, valor, evento, estado
- KPIs personales: # entregas hoy, # entregas semana, valor total entregado
- Filtros: programa, fecha, estado
- Sin acción "Revertir" (solo admin — RN-07.1)
- Click en row → ficha read-only de la asignación

---

## 4. Historias de Usuario — Transversales

### HU-TR-01: Header Institucional + Sidebar

**Como** usuario del sistema
**quiero** ver el branding del Ministerio del Deporte y del SUID en cada pantalla
**para** reconocer que estoy en la plataforma oficial.

**Criterios de aceptación:**
- Header pre-login: logos Ministerio del Deporte + divider + SUID
- Sidebar post-login con burger toggle (collapsed 72px / expanded 274px), logos institucionales arriba
- Navegación por rol:
  - Gestor: Dashboard, Programas, Códigos, Historial, Reportería
  - Operador: Asignar, Mis asignaciones
- Indicador visual del item activo (barra naranja izquierda con slide animado)
- Sección inferior: Cerrar sesión
- Sin marca "Naowee" ni "Comité Olímpico Colombiano" en el header (decisión de marca)
- Footer flotante `naowee-floating-footer` con marca Naowee + copyright

---

### HU-TR-02: Chip de Perfil + Cambio de Rol

**Como** usuario logueado
**quiero** ver mi nombre, rol y avatar en el header derecho y poder cambiar de rol
**para** alternar entre vistas de Gestor y Operador sin reingresar credenciales.

**Criterios de aceptación:**
- Chip de perfil con avatar circular + nombre + rol + chevron
- Avatar con color plano por rol (naranja brand para Gestor, morado para Operador)
- Punto verde de presencia
- Click → dropdown con opciones de cambio de rol marcadas con icono + descripción
- Cambiar rol redirige a la pantalla principal del rol seleccionado
- Estado del rol persiste vía `profile-switcher.js`

---

### HU-TR-03: Tokens de Elevation Naranja del Brand

**Como** sistema
**quiero** que los CTAs primarios usen sombras naranjas alineadas con el brand
**para** proyectar la identidad de Naowee de forma consistente.

**Criterios de aceptación:**
- Tokens custom en `shared/shell.css`:
  - `--naowee-shadow-loud-xs/sm/md/lg/xl` (rgba 215,64,9)
  - `--naowee-shadow-brand-md/lg` (rgba 255,117,0)
- Override del DS: `naowee-btn--loud:hover` aplica solo elevation, **no cambia el fill** (feedback Doug)
- Aplicado a hover/focus/active de todos los botones loud
- Pendiente migración al repo `naowee-tech/naowee-design-system` para que sea token oficial

---

### HU-TR-04: Transiciones Entre Páginas

**Como** usuario
**quiero** transiciones suaves entre pantallas
**para** percibir el sistema como cohesivo.

**Criterios de aceptación:**
- View Transitions API para navegación con crossfade
- Sidebar y header persistentes entre rutas (no parpadean)
- `fadeAndGo()` helper para transiciones programáticas con fade-out + redirect
- Crossfade del sidebar sincronizado con slide del indicador activo

---

### HU-TR-05: Componentes del Design System Naowee `@v1.4.0`

**Como** sistema
**quiero** usar el DS publicado como única fuente de verdad visual
**para** mantener consistencia con los demás módulos del SUID.

**Componentes utilizados:**
- `naowee-btn` (variantes: loud, mute, link, large, small, icon)
- `naowee-textfield` (text, textarea, label, helper, error states)
- `naowee-searchbox` (con clear button)
- `naowee-tabs` + `naowee-tabs--animated` con sliding indicator
- `naowee-segment` + `naowee-segment__pill` (sliding pill animado)
- `naowee-badge` (positive, negative, caution, neutral, informative; size small; variante `--quiet` para tablas)
- `naowee-tag` + `naowee-tag--accent --small` (tags activos en filtros) + `naowee-tag--choice` (chips seleccionables)
- `naowee-message` (informative, positive, caution, negative)
- `naowee-progress` + `naowee-progress__fill` (sin gradient)
- `naowee-thumbnail` + `--small/squared/quiet` (avatares y KPI icons)
- `naowee-modal` + `naowee-modal-overlay` (variante `--wide` para wizard)
- `naowee-stepper` + `__step --active/--done`
- `naowee-table` dentro de `naowee-table-wrap`
- `naowee-pagination` + `naowee-pagination--small`
- `naowee-file-uploader` (drop zone + cámara móvil)
- `naowee-checkbox`, `naowee-toggle`, `naowee-radio`
- `naowee-floating-footer`
- DS consumido vía CDN pinneado: `https://cdn.jsdelivr.net/gh/naowee-tech/naowee-design-system@v1.4.0/dist/design-system.css`

---

## 5. Modelo de Datos

### HU-DB-01: Estructura de un Programa

**Como** sistema
**quiero** un modelo de datos completo y trazable para cada programa
**para** soportar parametrización, ejecución y auditoría.

**Estructura (`PROGRAMS_DATA` en `shared/programs-data.js`):**

```js
{
  id: string,
  name: string,
  evento: string | null,
  descripcion: string,
  cobertura: { departamentos: string[], municipios: string[] },
  vigencia: { from: string, to: string },

  // Condiciones de elegibilidad
  condiciones: [{
    grupo: string,
    operador: 'AND' | 'OR',
    reglas: [{ dimension, operador, valor }]
  }],

  // Tipos de incentivo
  incentives: [{
    name: string,
    category: string,
    cualitativo: boolean,
    monetario: boolean,
    value: number | null
  }],

  // Rubro
  unit: number,                    // valor unitario por código
  rubro: { total, ejecutado, disponible },

  // Inventario
  codes: { total, asignados, disponibles, revertidos, asig: number },
  iconColor: string,               // color del thumbnail

  // Estado del programa
  status: 'borrador' | 'activo' | 'pausado' | 'cerrado',
  from: string,                    // vigencia desde (string legible)
  to: string,                      // vigencia hasta
  actoAdmin: string | null,        // resolución / acto administrativo

  // Metadata
  createdAt: number,
  updatedAt: number,
  _userCreated: boolean
}
```

---

### HU-DB-02: Estados del Código

**Estados estables del código (RN-05.9):**

| Estado | Descripción | Transición |
|---|---|---|
| `Sin asignación` | Código cargado al inventario, disponible para entrega | → Asignado |
| `Asignado` | Operador entregó el incentivo y subió evidencia | → Revertido (solo admin) |
| `Revertido` | Admin anuló la asignación con motivo; vuelve al pool | → Sin asignación |

---

### HU-DB-03: Estados del Programa

| Estado | Descripción | Transiciones |
|---|---|---|
| `Borrador` | Programa parametrizado pero no activado | → Activo |
| `Activo` | Programa ejecutándose, operadores asignan | → Pausado, → Cerrado |
| `Pausado` | Asignación bloqueada temporalmente | → Activo, → Cerrado |
| `Cerrado` | Programa finalizado; sin asignaciones nuevas | (terminal) |

---

## 6. Flujo End-to-End del Sistema

```
GESTOR DE INCENTIVOS                                      OPERADOR EN CAMPO
====================                                      ==================

1. Login + selección de rol Gestor (HU-GI-01)             1. Login + selección de rol Operador (HU-GI-01)

2. Dashboard (HU-GI-02)                                   2. Asignar incentivo
   └─> KPIs nacionales + tabla activos                       └─> Buscar beneficiario por cédula (HU-OP-01)
                                                                ├─ Validación contra condiciones de programas activos
3. Programas (HU-GI-03)                                         └─ Si no cumple → "no tiene incentivos aplicables"
   └─> Crear programa (modal wizard 5 pasos, HU-GI-04)
       ├─ Datos generales + cobertura + vigencia          3. Si cumple:
       ├─ Condiciones AND/OR                                 ├─ Seleccionar tipo de incentivo + código (HU-OP-02)
       ├─ Tipos de incentivo                                 ├─ Subir evidencia (foto/archivo) (HU-OP-03)
       ├─ Rubro                                              └─ Confirmar asignación
       └─ Activar → status='activo'                              └─> Código pasa a 'Asignado'
                                                                       Rubro descontado automáticamente
4. Detalle del programa (HU-GI-05)                                     Geo-stamp y dispositivo registrados
   └─> Tab Códigos                                                     Pantalla de éxito (HU-OP-04)
       └─> Cargar inventario (modal, HU-GI-06)
           ├─ Masivo Excel/CSV                            4. Mis asignaciones (HU-OP-05)
           │   └─ Validación columnas + valor unitario       └─> Solo las que el operador entregó
           └─ Manual uno a uno                                  KPIs personales del día/semana
                                                                Sin acción "Revertir"

5. Inventario consolidado (HU-GI-07)
   └─> Filtros: programa / estado / búsqueda
                                                          ─── Operador detecta error ───
6. Historial de asignaciones (HU-GI-08)                   ─── Contacta al gestor (offline) ──>
   └─> Filtros geo: región / municipio / ciudad
       └─> Click "Revertir" en una fila
           └─> Modal de reversión con motivo (HU-GI-09)
               ├─ Validación: motivo obligatorio
               ├─ Código vuelve a 'Sin asignación'
               ├─ Asignación queda 'Revertida' con audit
               └─ Pantalla de éxito + redirect

7. Reportería (HU-GI-10)
   └─> Filtros avanzados (popover): año, mes, programa, logro
       ├─ Tags activos al lado del botón Filtros con X
       ├─ Badge en botón Filtros con conteo
       └─ Descargar CSV (BOM UTF-8 + ; para Excel)
```

---

## 7. Mapa de Estados y Transiciones

**Estados del programa:**

| Estado actual | Acción del gestor | Próximo estado |
|---|---|---|
| (no existe) | Crear programa (wizard) | `borrador` |
| `borrador` | Activar programa | `activo` |
| `activo` | Ampliar rubro / agregar códigos | `activo` (mismo) |
| `activo` | Pausar | `pausado` |
| `activo` | Cerrar | `cerrado` |
| `pausado` | Reactivar | `activo` |
| `pausado` | Cerrar | `cerrado` |

**Estados del código:**

| Estado actual | Actor | Acción | Próximo estado |
|---|---|---|---|
| (no existe) | Gestor | Cargar inventario | `Sin asignación` |
| `Sin asignación` | Operador | Asignar a beneficiario + evidencia | `Asignado` |
| `Asignado` | Gestor | Revertir con motivo | `Revertido` → vuelve al pool como `Sin asignación` |

---

## 8. Páginas del Sistema

| # | Página | Archivo | Rol Principal | Función |
|---|---|---|---|---|
| 01 | Login | `incentivo-01-login.html` | Ambos | Autenticación + selector de rol |
| 02 | Dashboard | `incentivo-02-dashboard.html` | Gestor | KPIs nacionales, programas activos, recientes |
| 03 | Programas | `incentivo-03-programas.html` | Gestor | Listado + wizard modal de creación |
| 04 | _(eliminada — modal en 03)_ | ~~`incentivo-04-programa-crear.html`~~ | — | Reemplazada por modal wizard en pantalla 03 |
| 05 | Detalle del programa | `incentivo-05-programa-detalle.html` | Gestor | Información, códigos, asignaciones, historial |
| 06 | Cargar códigos | `incentivo-06-codigos-carga.html` | Gestor | Modal de carga masiva o manual al inventario |
| 07 | Inventario de códigos | `incentivo-07-codigos.html` | Gestor | Tabla consolidada nacional con filtros |
| 08 | Asignar — buscar | `incentivo-08-asignar-buscar.html` | Operador | Búsqueda por cédula + validación de condiciones |
| 09 | Evidencia de entrega | `incentivo-09-validar-foto.html` | Operador | Subida de foto/archivo de respaldo |
| 10 | Asignar — tipo y código | `incentivo-10-asignar-tipo.html` | Operador | Selección de tipo de incentivo + código |
| 11 | Asignación exitosa | `incentivo-11-asignar-exito.html` | Operador | Confirmación post-asignación |
| 12 | Historial de asignaciones | `incentivo-12-asignaciones.html` | Gestor | Trazabilidad nacional + acción Revertir |
| 13 | Reversión exitosa | `incentivo-13-revertir.html` | Gestor | Confirmación post-reversión |
| 14 | Mis asignaciones | `incentivo-14-mis-asignaciones.html` | Operador | Vista personal del operador |
| 15 | Reportería | `incentivo-15-reporteria.html` | Gestor | Reportes filtrados + descarga CSV |

**Módulos compartidos:**
- `shared/shell.css` — sidebar + header + tokens elevation naranja + override `btn--loud:hover`
- `shared/programs-data.js` — fuente de verdad de programas (mock)
- `shared/profile-switcher.js` — chip de perfil + cambio de rol
- `shared/programa-wizard.html|css|js` — wizard modular reutilizable de programa
- `shared/footer-scroll.js` — footer flotante con scroll-behavior
- `shared/logos/` — Ministerio, SUID, Naowee
- Design System Naowee `@v1.4.0` vía CDN jsDelivr

---

## 9. Backlog para JIRA — Resumen Sugerido

**Epic:** SUID — Módulo Incentivos

**Stories sugeridas (16):**

| # | Story | Story Points sugeridos | Etiquetas |
|---|---|---|---|
| 1 | Login + selector de rol Gestor / Operador | 5 | frontend, auth, mvp |
| 2 | Dashboard nacional con KPIs y filtros segmentados | 8 | frontend, dashboard |
| 3 | Listado de programas con buscador y filtros | 5 | frontend, programas |
| 4 | Wizard modal de creación de programa (5 pasos) | 13 | frontend, wizard, ds |
| 5 | Cobertura territorial multiselect (tag-input + dropdown) | 5 | frontend, wizard |
| 6 | Condiciones de elegibilidad AND/OR con agrupaciones | 8 | frontend, wizard, logic |
| 7 | Detalle de programa con tabs (info, códigos, asignaciones, historial) | 8 | frontend, detalle |
| 8 | Modal de carga de inventario (masivo Excel/CSV + manual) | 8 | frontend, codigos, fileupload |
| 9 | Inventario consolidado de códigos con filtros y paginación | 5 | frontend, codigos |
| 10 | Flujo de asignación operador (búsqueda + tipo + evidencia + éxito) | 13 | frontend, operador, mobile |
| 11 | Validación de condiciones de programa contra beneficiario | 8 | frontend, validation |
| 12 | Historial de asignaciones nacional con filtros geo | 8 | frontend, audit |
| 13 | Reversión con motivo obligatorio + pantalla de éxito | 5 | frontend, reversion, audit |
| 14 | Mis asignaciones (vista scoped por operador) | 5 | frontend, operador |
| 15 | Reportería con popover de filtros + tags + badge + CSV | 8 | frontend, reportes, csv |
| 16 | Shell persistente: sidebar + header + chip de rol + view transitions | 8 | frontend, shell, ds |

**Subtareas técnicas transversales:**
- Tokens de elevation naranja: migrar al repo `naowee-tech/naowee-design-system`
- Override del DS: `btn--loud:hover` solo elevation (migrar al DS global)
- Refactor pendiente de pantallas 05–13 al patrón del dashboard (badges quiet, progress `__fill`, thumbnails DS)
- Tests E2E del flujo gestor↔operador (Playwright cuando se integre)

---

## 10. Entregables del MVP

### Entregables de Diseño
- 15 pantallas implementadas en HTML / CSS / JS vanilla
- Componentes del Design System Naowee `@v1.4.0` consumidos vía CDN
- Branding institucional completo (Ministerio del Deporte + SUID)
- Tokens de elevation naranja propuestos para migración al DS global
- Override de hover de `btn--loud` (solo elevation, no fill)
- Animaciones de transición entre pantallas (View Transitions API)
- Wizard modal reutilizable con stepper sticky alineado al header del DS

### Entregables Funcionales
- Flujo end-to-end Gestor ↔ Operador con datos mockeados
- Parametrización completa de programas (datos, cobertura, vigencia, condiciones AND/OR, tipos, rubro)
- Carga masiva o manual de códigos al inventario
- Asignación en campo con validación de elegibilidad y captura de evidencia
- Reversión con motivo obligatorio y devolución del código al pool
- Historial nacional con filtros geo y drill-down
- Reportería con filtros avanzados, tags activos y exportación CSV (BOM UTF-8)
- Cambio de rol en sesión (Gestor ↔ Operador)
- 3 estados del código (sin asignar / asignado / revertido) con transiciones validadas
- 4 estados del programa (borrador / activo / pausado / cerrado)

### Entregables Técnicos
- Estructura de datos `PROGRAMS_DATA` documentada
- Helper `positionSegmentPill()` para sliding pill de segments
- View Transitions API para navegación smooth con shell persistente
- Repositorio público en `naowee-tech/naowee-test-incentivos`
- Servidor local inline en puerto **4500** vía `.claude/launch.json`
- Sin build tools, sin dependencias locales (solo Google Fonts + DS via CDN)

### Entregables de Documentación
- Acta de alcance MVP (este documento)
- `CLAUDE.md` con convenciones del proyecto, ports, design tokens
- `HANDOFF.md` con estado por pantalla, decisiones de diseño, mapeo DS
- `NEXT-SESSION.md` checklist de arranque para sesiones siguientes
- `docs/transcripcion-entrevista.md` — entrevista con stakeholder Danna Arrieta
- `docs/reglas-de-negocio.md` — 13 bloques de reglas (RN-01 a RN-13)
- `docs/roles-matrix.md` — matriz Admin × Operador
- `docs/preguntas-abiertas-v2.md` — bloqueadores y resoluciones
- `docs/Módulo incentivos y beneficios.xlsx - PARAMETROS.csv` — parámetros confirmados
- BPMNs originales en PDF (flujo módulo + flujo de estados)

---

## 11. Criterios de Aceptación Globales del MVP

Para considerar el MVP de Incentivos completado:

- [x] Un gestor puede crear un programa completo desde el wizard modal con condiciones AND/OR
- [x] El gestor puede cargar el inventario de códigos en modo masivo (Excel/CSV) o manual desde un modal
- [x] El programa puede editarse después de activarse para ampliar rubro o agregar códigos
- [x] Un operador puede buscar un beneficiario por cédula y ver solo programas aplicables a su elegibilidad
- [x] Si el beneficiario no cumple condiciones, el operador ve "no tiene incentivos aplicables"
- [x] El operador puede asignar un incentivo eligiendo manualmente el código del inventario
- [x] El operador adjunta evidencia (foto o archivo) antes de confirmar la asignación
- [x] El sistema descuenta automáticamente del rubro y marca el código como `Asignado`
- [x] El gestor ve todas las asignaciones en un historial nacional con filtros geo (región / municipio / ciudad)
- [x] El gestor puede revertir cualquier asignación ingresando un motivo obligatorio
- [x] Al revertir, el código vuelve al pool como `Sin asignación` y la asignación queda con audit completo
- [x] El operador ve solo sus propias asignaciones en "Mis asignaciones" (sin acción Revertir)
- [x] El gestor puede generar reportes filtrados por año, mes, programa y logro
- [x] Los filtros aplicados se muestran como tags removibles + badge con conteo en el botón Filtros
- [x] El reporte se descarga como CSV con BOM UTF-8 separado por `;` para apertura directa en Excel
- [x] El cambio entre rol Gestor y Operador funciona desde el header sin reingresar credenciales
- [x] Todos los componentes visuales usan el Design System Naowee `@v1.4.0` (DS via CDN, sin copia local)
- [x] El branding del header es solo Ministerio del Deporte + SUID (sin Naowee ni COC)
- [x] Las parametrizaciones siempre suceden en modal, nunca en página dedicada (feedback Doug)

---

## 12. Alcance Excluido del MVP

- Backend real con base de datos (todo es mock en `programs-data.js` y estado en memoria)
- Autenticación y autorización con tokens (login es mock visual)
- Notificaciones email/SMS reales al beneficiario (sólo dentro del perfil del sistema — RN-06.9)
- Tab de incentivos en el perfil del deportista en SUID (RN-11.2)
- Carga real de archivos Excel/CSV a un parser productivo (validación visual del flujo)
- Generación de PDF de reportes (solo CSV en MVP)
- Vencimiento / vigencia del código (RN-05.8: sin vencimiento por ahora; parametrizable en futuro)
- Asignación FIFO automática del código (RN-05.10: en MVP es manual)
- Cupo máximo por persona por programa (RN-06.8: abierto)
- Tope por zona / rubro (RN-08.4: abierto)
- Ventana de tiempo para revertir (RN-07.4: sin ventana en MVP)
- Reasignación automática de operadores por evento
- Dashboard de KPIs "puros" sin lista detallada (RN-13.6: nice-to-have futuro)
- Rol de Visualizador con dashboard de transparencia (RN-09.5: nice-to-have)
- Alertas automáticas de anulación excesiva o inventario bajo (RN-10.5)
- Drill-down completo desde KPIs agregados a asignaciones individuales (RN-13.5: parcial)
- Búsqueda full-text avanzada o indexación
- Internacionalización (todo en español)
- Modo oscuro
- Accesibilidad WCAG AA completa (queda parcial: alt texts y labels en formularios)

---

## 13. Notas Técnicas

- **Stack:** HTML + CSS + JavaScript vanilla, sin framework ni build tools
- **Fuente:** Google Fonts Inter (400, 500, 600, 700, 800)
- **Design System:** Naowee `@v1.4.0` vía jsDelivr CDN (sin copia local)
- **Persistencia:** mock en memoria + `programs-data.js` (sin localStorage en MVP actual)
- **Servidor local:** Node inline en puerto **4500** vía `.claude/launch.json`
- **Responsive:** Breakpoint principal 900px (sidebar colapsa); secundario 640px (oculta logos secundarios)
- **Animaciones:** View Transitions API + cubic-bezier para chevrons / segments / steppers
- **Compatibilidad:** Chrome / Edge / Firefox modernos (uso de `:has()`, `?.`, template strings, View Transitions)
- **Hosting actual:** GitHub Pages en `https://naowee-tech.github.io/naowee-test-incentivos/`
- **Repositorio principal:** `naowee-tech/naowee-test-incentivos`
- **Puertos por demo Naowee:** Digitación 4200 · Escenarios 4300 · Incentivos 4500
- **Tokens de elevation naranja:** definidos localmente en `shared/shell.css`, propuestos para migración a `naowee-tech/naowee-design-system`
- **Override del DS:** `btn--loud:hover` aplica solo elevation (no cambia fill) — feedback explícito de Doug, propuesto para migración al DS global

---

## 14. Próximos Pasos Sugeridos (Roadmap Post-MVP)

**Fase 2 — Hardening del flujo:**
- Vencimiento parametrizable del código por programa
- Ventana de tiempo para revertir asignaciones (audit más estricto)
- Cupo máximo por persona / programa
- Lista cerrada de motivos de reversión + opción "Otro" con texto libre
- Reasignación automática de operadores por evento

**Fase 3 — Integración:**
- Backend real con API REST (handoff a Daniel)
- Autenticación real con SUID central + RBAC
- Parser productivo de Excel/CSV con validaciones server-side
- Notificaciones in-app dentro del perfil del beneficiario en SUID
- Geo-stamp validado contra el evento autorizado

**Fase 4 — Analítica y reporting:**
- Dashboard de KPIs nacionales para alta dirección del ministerio
- Exportación de reportes a PDF y Excel (no solo CSV)
- Drill-down completo desde métricas agregadas a asignaciones individuales
- Auditoría avanzada (quién vio qué, búsqueda en historial)
- Alertas automáticas de anulación excesiva o inventario bajo

**Fase 5 — Vista pública / transparencia:**
- Tab de incentivos en perfil del deportista en SUID
- Rol de Visualizador con dashboard de transparencia
- Reportes públicos agregados sin datos personales
- Mapa nacional de ejecución de incentivos

---

*Documento generado el 28 de abril de 2026*
*MVP versión 1.0.0 — Epic Incentivos*
*Para entregar a: Isa (Scrum Master)*
