/* ═══════════════════════════════════════════════════════════════
   PROFILE SWITCHER — script compartido (auto-wire)
   Se monta sobre cualquier elemento con .profile-switcher:
   - Si falta id="profileSwitcher", lo añade.
   - Si falta el <div class="profile-dd">, lo inyecta con los roles.
   - Wire-up de clic en chip + chevron sin necesidad de onclick inline.
   - Cierra al clickear fuera.
   - Aplica el rol persistido en localStorage.
   ═══════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  const STORAGE_KEY = 'naowee-incentivos-role';

  const ROLES = {
    admin:    { name:'Doug Vargas', label:'Gestor de incentivos', initials:'DV', bg:'#c4b5fd', fg:'#4c1d95', meta:'Parametriza y audita' },
    operador: { name:'Doug Vargas', label:'Operador',             initials:'DV', bg:'#ffdfb5', fg:'#92400e', meta:'Asigna incentivos en campo' },
    gestor:   { name:'Doug Vargas', label:'Gestor',               initials:'DV', bg:'#ffdfb5', fg:'#92400e', meta:'Asigna y revierte incentivos' }
  };

  // Qué roles muestra el dropdown por default cuando se auto-inyecta.
  // Paridad con las páginas legacy (dashboard, detalle, asignar): admin + operador.
  const DEFAULT_ROLES_IN_DD = ['admin', 'operador'];

  function currentRole(){
    return localStorage.getItem(STORAGE_KEY) || 'admin';
  }

  function applyRole(role){
    const r = ROLES[role] || ROLES.admin;
    // Actualiza el avatar del chip
    document.querySelectorAll('.user-chip .ava-ring').forEach(ring => {
      ring.textContent = r.initials;
      ring.style.background = r.bg;
      ring.style.color = r.fg;
    });
    // Actualiza la etiqueta del rol en el chip
    document.querySelectorAll('.user-chip .user-role').forEach(lbl => {
      lbl.textContent = r.label;
    });
    // Mantiene compatibilidad con IDs antiguos del template
    const ring = document.getElementById('avaRing');
    if(ring){ ring.textContent = r.initials; ring.style.background = r.bg; ring.style.color = r.fg; }
    const lblById = document.getElementById('userRoleLabel');
    if(lblById) lblById.textContent = r.label;
    // Active state en los items del dropdown
    document.querySelectorAll('.profile-dd__item').forEach(el => {
      el.classList.toggle('active', el.dataset.role === role);
    });
    // Visibilidad de sidebar por rol (si la página usa el patrón)
    document.querySelectorAll('.nav-row[data-role]').forEach(el => {
      const dr = el.dataset.role;
      el.style.display = (dr === 'all' || dr === role) ? '' : 'none';
    });
  }

  // Mapeo de páginas por rol: en qué vive cada perfil por default.
  // Si el rol seleccionado no corresponde al tipo de página actual,
  // se redirige al "home" del perfil para que la UX refleje el cambio.
  const OPERATOR_PAGES = /incentivo-(08|09|10|11|14)/;
  const ADMIN_PAGES    = /incentivo-(02|03|04|05|06|07|12|13)/;
  const OPERATOR_HOME  = 'incentivo-08-asignar-buscar.html';
  const ADMIN_HOME     = 'incentivo-02-dashboard.html';

  function switchRole(role){
    localStorage.setItem(STORAGE_KEY, role);
    applyRole(role);
    closeAllSwitchers();

    const path = location.pathname;
    const onOperadorPage = OPERATOR_PAGES.test(path);
    const onAdminPage    = ADMIN_PAGES.test(path);

    if(role === 'operador' && !onOperadorPage){
      setTimeout(() => { window.location.href = OPERATOR_HOME; }, 180);
    } else if((role === 'admin' || role === 'gestor') && !onAdminPage){
      // Gestor de incentivos (admin) vive en el dashboard; si estoy en
      // pages del operador, redirijo.
      setTimeout(() => { window.location.href = ADMIN_HOME; }, 180);
    }
  }

  function toggleProfileDD(ev){
    if(ev) ev.stopPropagation();
    const sw = ev?.currentTarget?.closest?.('.profile-switcher')
            || document.querySelector('.profile-switcher');
    if(!sw) return;
    const isOpen = sw.classList.contains('open');
    closeAllSwitchers();
    if(!isOpen) sw.classList.add('open');
  }

  function closeAllSwitchers(){
    document.querySelectorAll('.profile-switcher').forEach(sw => sw.classList.remove('open'));
  }

  // Construye el dropdown (profile-dd) cuando una página no lo tiene.
  function buildProfileDD(activeRole){
    const items = DEFAULT_ROLES_IN_DD.map(key => {
      const r = ROLES[key];
      if(!r) return '';
      const isActive = key === activeRole ? ' active' : '';
      return `
        <div class="profile-dd__item${isActive}" data-role="${key}">
          <div class="ava"><div class="ava-ring" style="background:${r.bg};color:${r.fg};width:28px;height:28px;font-size:11px">${r.initials}</div></div>
          <div class="role-meta">
            <strong>${r.label}</strong>
            <small>${r.meta}</small>
          </div>
          <svg class="dd-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>`;
    }).join('');
    const dd = document.createElement('div');
    dd.className = 'profile-dd';
    dd.innerHTML = `<div class="profile-dd__label">Cambiar de perfil</div>${items}`;
    return dd;
  }

  function mountSwitcher(sw){
    if(sw.dataset.wzMounted === '1') return;
    sw.dataset.wzMounted = '1';

    // Asegura id (no es estrictamente necesario, pero mantiene compat con
    // código legacy que buscaba por #profileSwitcher)
    if(!sw.id) sw.id = 'profileSwitcher';

    // Wire-up del chip → toggle. Skipeamos si ya tiene onclick inline
    // (páginas legacy con toggleProfileDD inline) para evitar doble fire.
    const chip = sw.querySelector('.user-chip');
    if(chip && !chip.dataset.wzClick && !chip.hasAttribute('onclick')){
      chip.dataset.wzClick = '1';
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', toggleProfileDD);
    }
    // Chevron sólo necesita stopPropagation para no doble-togglear con el chip
    const chevron = sw.querySelector('.user-chip__chevron');
    if(chevron && !chevron.dataset.wzClick){
      chevron.dataset.wzClick = '1';
      chevron.addEventListener('click', (e) => { e.stopPropagation(); toggleProfileDD(e); });
    }

    // Inyecta profile-dd si no existe
    if(!sw.querySelector('.profile-dd')){
      const dd = buildProfileDD(currentRole());
      sw.appendChild(dd);
    }

    // Wire-up de los items del dropdown. Skipeamos si ya tienen onclick
    // inline (páginas legacy) para evitar doble-fire de switchRole.
    sw.querySelectorAll('.profile-dd__item').forEach(item => {
      if(item.dataset.wzClick || item.hasAttribute('onclick')) return;
      item.dataset.wzClick = '1';
      item.addEventListener('click', () => switchRole(item.dataset.role));
    });
  }

  function mountAll(){
    document.querySelectorAll('.profile-switcher').forEach(mountSwitcher);
    applyRole(currentRole());
  }

  // Cerrar al clickear fuera de cualquier switcher
  document.addEventListener('click', (e) => {
    const inside = e.target.closest?.('.profile-switcher');
    if(!inside) closeAllSwitchers();
  });

  // Logout (opcional)
  document.addEventListener('DOMContentLoaded', () => {
    mountAll();
    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout){
      btnLogout.addEventListener('click', () => {
        window.location.href = 'incentivo-01-login.html';
      });
    }
  });

  // Si el DOM ya está listo cuando se carga el script, montar ya.
  if(document.readyState !== 'loading'){
    mountAll();
  }

  // Exposición global para compatibilidad con onclick inline en páginas viejas
  window.ROLES = ROLES;
  window.currentRole = currentRole;
  window.applyRole = applyRole;
  window.switchRole = switchRole;
  window.toggleProfileDD = toggleProfileDD;
})();
