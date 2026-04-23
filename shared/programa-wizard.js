/* ═══════════════════════════════════════════════════════════════
   PROGRAMA · WIZARD (5 pasos) — lógica compartida
   Inyecta el markup desde shared/programa-wizard.html y expone
   window.openWizard(). Upgrade automático de selects nativos a
   naowee-dropdown y de inputs date a date-picker custom.
   ═══════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  const totalSteps = 5;
  const stepNames = {
    1: 'Datos del programa',
    2: 'Rubro presupuestal',
    3: 'Tipos de incentivo',
    4: 'Condiciones de elegibilidad',
    5: 'Códigos y activación'
  };
  let currentStep = 1;
  let isMounted = false;
  let pendingOpen = false;

  const MONTHS_LONG = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const WEEKDAYS = ['L','M','X','J','V','S','D'];

  /* ══ Mount ══ */
  function mount(){
    if(isMounted) return Promise.resolve();
    // Deduplicate: if another page already mounted it, reuse.
    if(document.getElementById('wzOverlay')){
      isMounted = true;
      wireAll();
      return Promise.resolve();
    }
    return fetch('shared/programa-wizard.html', {cache: 'no-cache'})
      .then(r => r.text())
      .then(html => {
        const holder = document.createElement('div');
        holder.innerHTML = html;
        while(holder.firstChild) document.body.appendChild(holder.firstChild);
        isMounted = true;
        wireAll();
      })
      .catch(err => { console.error('[wizard] mount failed', err); });
  }

  function wireAll(){
    upgradeDropdowns();
    upgradeDatepickers();
    wireDropzone();
    wireChipPicker();
    wireSegments();
    wireInputMasks();
    // ESC
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape' && document.getElementById('wzOverlay').classList.contains('open')){
        closeWizard();
      }
    });
    // Close on overlay click
    const overlay = document.getElementById('wzOverlay');
    overlay.addEventListener('click', e => { if(e.target === overlay) closeWizard(); });
  }

  /* ══ Step navigation ══ */
  function renderStep(){
    document.querySelectorAll('.wz-pane').forEach(p => { p.hidden = +p.dataset.pane !== currentStep; });
    document.querySelectorAll('.naowee-stepper__step').forEach(s => {
      const n = +s.dataset.step;
      s.classList.toggle('naowee-stepper__step--active', n === currentStep);
      s.classList.toggle('naowee-stepper__step--done', n < currentStep);
      const conn = s.querySelector('.naowee-stepper__connector');
      if(conn) conn.classList.toggle('naowee-stepper__connector--done', n < currentStep);
    });
    const btnPrev = document.getElementById('wzBtnPrev');
    btnPrev.style.display = currentStep === 1 ? 'none' : 'inline-flex';
    const spacer = document.getElementById('wzPrevSpacer');
    if(spacer) spacer.style.display = currentStep === 1 ? 'block' : 'none';
    spacer && (spacer.style.flex = '1');

    const btnNext = document.getElementById('wzBtnNext');
    if(currentStep === totalSteps){
      btnNext.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Activar programa`;
    }else{
      btnNext.innerHTML = `Continuar <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    }
    document.getElementById('wzBody').scrollTop = 0;
    // Recompute segment pills on the now-visible pane (sync + deferred for safety)
    refreshSegmentPills();
    requestAnimationFrame(refreshSegmentPills);
    setTimeout(refreshSegmentPills, 80);
  }

  function goStep(s){ currentStep = s; renderStep(); }

  function nextStep(){
    if(!validateStep(currentStep)) return;
    if(currentStep < totalSteps){ currentStep++; renderStep(); }
    else activateProgram();
  }
  function prevStep(){ if(currentStep > 1){ currentStep--; renderStep(); } }

  /* ══ Validation ══ */
  function validateStep(step){
    const pane = document.querySelector(`.wz-pane[data-pane="${step}"]`);
    if(!pane) return true;
    let ok = true;
    pane.querySelectorAll('[data-wz-required]').forEach(field => {
      const input = field.querySelector('input, textarea');
      const isDropdown = field.classList.contains('naowee-dropdown');
      const val = isDropdown
        ? (field.querySelector('.naowee-dropdown__value')?.textContent || '').trim()
        : (input?.value || '').trim();
      const isEmpty = !val || val === '0' || val === '$';
      if(isEmpty){
        ok = false;
        markError(field);
      }else{
        clearError(field);
      }
    });
    return ok;
  }

  function markError(field){
    field.classList.add('wz-shake');
    setTimeout(() => field.classList.remove('wz-shake'), 500);
    const isDropdown = field.classList.contains('naowee-dropdown');
    if(isDropdown){
      field.classList.add('naowee-dropdown--error');
    }else{
      field.classList.add('naowee-textfield--error');
    }
    // Replace/insert helper
    let helper = field.querySelector('.naowee-helper');
    const helperHtml = `
      <div class="naowee-helper__badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div class="naowee-helper__text">Este campo es obligatorio</div>`;
    if(!helper){
      helper = document.createElement('div');
      helper.className = 'naowee-helper naowee-helper--negative';
      field.appendChild(helper);
    }
    helper.className = 'naowee-helper naowee-helper--negative';
    helper.innerHTML = helperHtml;
  }
  function clearError(field){
    field.classList.remove('naowee-textfield--error');
    field.classList.remove('naowee-dropdown--error');
    const helper = field.querySelector('.naowee-helper');
    if(helper && helper.classList.contains('naowee-helper--negative')){
      helper.remove();
    }
  }

  /* ══ Open / Close ══ */
  function openWizard(){
    if(!isMounted){
      pendingOpen = true;
      mount().then(() => { if(pendingOpen){ pendingOpen = false; openWizard(); } });
      return;
    }
    document.getElementById('wzOverlay').classList.add('open');
    currentStep = 1;
    renderStep();
    // Recompute segment pill positions once modal is visible (needs layout)
    requestAnimationFrame(() => setTimeout(refreshSegmentPills, 50));
  }

  function closeWizard(){
    const overlay = document.getElementById('wzOverlay');
    if(!overlay) return;
    if(confirm('¿Salir? Los cambios no guardados se perderán.')){
      overlay.classList.remove('open');
    }
  }

  /* ══ Dropdown upgrade / behaviour ══ */
  function upgradeDropdowns(){
    document.querySelectorAll('[data-wz-dropdown]').forEach(dd => {
      if(dd.dataset.wzWired) return;
      dd.dataset.wzWired = '1';
      const trigger = dd.querySelector('.naowee-dropdown__trigger');
      const menu = dd.querySelector('.naowee-dropdown__menu');
      const placeholderEl = dd.querySelector('.naowee-dropdown__placeholder');
      let valueEl = dd.querySelector('.naowee-dropdown__value');
      function positionMenu(){
        const tRect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - tRect.bottom - 8;
        const desiredH = Math.min(260, menu.scrollHeight || 260);
        const openUp = spaceBelow < desiredH && tRect.top > desiredH;
        menu.style.width = tRect.width + 'px';
        menu.style.left = tRect.left + 'px';
        if(openUp){
          menu.style.top = (tRect.top - 6 - desiredH) + 'px';
        }else{
          menu.style.top = (tRect.bottom + 6) + 'px';
        }
      }
      trigger.addEventListener('click', e => {
        e.stopPropagation();
        const wasOpen = dd.classList.contains('naowee-dropdown--open');
        // Close any other dropdowns / date pickers
        document.querySelectorAll('.naowee-dropdown--open').forEach(d => d.classList.remove('naowee-dropdown--open'));
        document.querySelectorAll('.wz-datepicker.open').forEach(p => p.classList.remove('open'));
        if(!wasOpen){
          dd.classList.add('naowee-dropdown--open');
          positionMenu();
        }
      });
      // Reposition on scroll inside modal
      const body = document.getElementById('wzBody');
      if(body){ body.addEventListener('scroll', () => {
        if(dd.classList.contains('naowee-dropdown--open')) positionMenu();
      }, true); }
      trigger.addEventListener('keydown', e => {
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); trigger.click(); }
      });
      menu.querySelectorAll('.naowee-dropdown__option').forEach(opt => {
        opt.addEventListener('click', () => {
          menu.querySelectorAll('.naowee-dropdown__option').forEach(o => o.classList.remove('naowee-dropdown__option--selected'));
          opt.classList.add('naowee-dropdown__option--selected');
          const text = opt.textContent.trim();
          if(placeholderEl) placeholderEl.style.display = 'none';
          if(!valueEl){
            valueEl = document.createElement('span');
            valueEl.className = 'naowee-dropdown__value';
            trigger.insertBefore(valueEl, trigger.firstChild);
          }
          valueEl.style.display = '';
          valueEl.textContent = text;
          dd.dataset.wzValue = opt.dataset.val || '';
          dd.classList.remove('naowee-dropdown--open');
          clearError(dd);
        });
      });
    });
    // Click outside to close
    document.addEventListener('click', () => {
      document.querySelectorAll('.naowee-dropdown--open').forEach(d => d.classList.remove('naowee-dropdown--open'));
    });
  }

  /* ══ Date picker ══ */
  function upgradeDatepickers(){
    document.querySelectorAll('[data-wz-datepicker]').forEach(field => {
      if(field.dataset.wzWired) return;
      field.dataset.wzWired = '1';
      const input = field.querySelector('input');
      const wrap = field.querySelector('.naowee-textfield__input-wrap');
      const hasIso = !!input.dataset.wzIso;
      const iso = input.dataset.wzIso || toIso(new Date());
      const [yy, mm, dd] = iso.split('-').map(Number);
      let viewYear = yy, viewMonth = mm - 1;
      let selected = new Date(yy, mm - 1, dd);
      let hasSelection = hasIso;

      const pop = document.createElement('div');
      pop.className = 'wz-datepicker';
      field.appendChild(pop);

      function render(){
        pop.innerHTML = `
          <div class="wz-dp__head">
            <button class="wz-dp__nav" data-nav="-1" type="button" aria-label="Mes anterior">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div class="wz-dp__month">${MONTHS_LONG[viewMonth]} ${viewYear}</div>
            <button class="wz-dp__nav" data-nav="1" type="button" aria-label="Mes siguiente">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div class="wz-dp__weekdays">
            ${WEEKDAYS.map(w => `<div class="wz-dp__weekday">${w}</div>`).join('')}
          </div>
          <div class="wz-dp__days" data-days></div>
        `;
        const grid = pop.querySelector('[data-days]');
        const firstOfMonth = new Date(viewYear, viewMonth, 1);
        const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday=0
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
        const today = new Date();
        const cells = [];
        for(let i = startWeekday - 1; i >= 0; i--){
          cells.push({ day: daysInPrev - i, muted: true, d: new Date(viewYear, viewMonth - 1, daysInPrev - i) });
        }
        for(let i = 1; i <= daysInMonth; i++){
          cells.push({ day: i, muted: false, d: new Date(viewYear, viewMonth, i) });
        }
        while(cells.length % 7 !== 0){
          const d = cells.length - (startWeekday + daysInMonth) + 1;
          cells.push({ day: d, muted: true, d: new Date(viewYear, viewMonth + 1, d) });
        }
        cells.forEach(c => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'wz-dp__day';
          if(c.muted) b.classList.add('wz-dp__day--muted');
          if(sameDay(c.d, today)) b.classList.add('wz-dp__day--today');
          if(hasSelection && sameDay(c.d, selected)) b.classList.add('wz-dp__day--selected');
          b.textContent = c.day;
          b.addEventListener('click', e => {
            e.stopPropagation();
            selected = c.d;
            hasSelection = true;
            viewYear = c.d.getFullYear();
            viewMonth = c.d.getMonth();
            input.value = formatHuman(c.d);
            input.dataset.wzIso = toIso(c.d);
            pop.classList.remove('open');
            clearError(field);
          });
          grid.appendChild(b);
        });
        pop.querySelectorAll('[data-nav]').forEach(btn => {
          btn.addEventListener('click', e => {
            e.stopPropagation();
            const dir = +btn.dataset.nav;
            viewMonth += dir;
            if(viewMonth < 0){ viewMonth = 11; viewYear--; }
            if(viewMonth > 11){ viewMonth = 0; viewYear++; }
            render();
          });
        });
      }

      function positionPop(){
        const r = wrap.getBoundingClientRect();
        const desiredH = pop.offsetHeight || 330;
        const spaceBelow = window.innerHeight - r.bottom - 8;
        const openUp = spaceBelow < desiredH && r.top > desiredH;
        pop.style.left = r.left + 'px';
        pop.style.width = r.width + 'px';
        if(openUp){
          pop.style.top = (r.top - 6 - desiredH) + 'px';
        }else{
          pop.style.top = (r.bottom + 6) + 'px';
        }
      }
      wrap.addEventListener('click', e => {
        e.stopPropagation();
        const wasOpen = pop.classList.contains('open');
        // Close other date pickers and dropdowns
        document.querySelectorAll('.wz-datepicker.open').forEach(p => p.classList.remove('open'));
        document.querySelectorAll('.naowee-dropdown--open').forEach(d => d.classList.remove('naowee-dropdown--open'));
        if(!wasOpen){
          // Sync view to selected
          viewYear = selected.getFullYear();
          viewMonth = selected.getMonth();
          render();
          positionPop();
          pop.classList.add('open');
        }
      });
      const body = document.getElementById('wzBody');
      if(body){ body.addEventListener('scroll', () => {
        if(pop.classList.contains('open')) positionPop();
      }, true); }
      // Click outside closes
      document.addEventListener('click', ev => {
        if(!field.contains(ev.target)) pop.classList.remove('open');
      });
    });
  }

  function sameDay(a, b){
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function toIso(d){
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  function formatHuman(d){
    return `${String(d.getDate()).padStart(2,'0')} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }

  /* ══ naowee-segment wiring (pill slide) ══ */
  function wireSegments(){
    document.querySelectorAll('[data-wz-segment]').forEach(seg => {
      if(seg.dataset.wzWired) return;
      seg.dataset.wzWired = '1';
      const pill = seg.querySelector('.naowee-segment__pill');
      const items = seg.querySelectorAll('.naowee-segment__item');
      function movePillTo(item, animated){
        if(!pill) return;
        const r = item.getBoundingClientRect();
        const pr = seg.getBoundingClientRect();
        if(r.width === 0 || pr.width === 0) return; // pane hidden
        const offset = r.left - pr.left - 4; /* padding-xnano */
        if(!animated) pill.classList.add('naowee-segment__pill--no-anim');
        pill.style.width = r.width + 'px';
        pill.style.setProperty('--segment-pill-x', offset + 'px');
        if(!animated){
          // force reflow then restore animated
          void pill.offsetWidth;
          pill.classList.remove('naowee-segment__pill--no-anim');
        }
      }
      // Initial position (no anim)
      const active = seg.querySelector('.naowee-segment__item--active') || items[0];
      requestAnimationFrame(() => movePillTo(active, false));
      // Recompute on modal open
      seg._wzMoveInit = () => movePillTo(seg.querySelector('.naowee-segment__item--active') || items[0], false);
      items.forEach(it => {
        it.addEventListener('click', () => {
          items.forEach(x => x.classList.remove('naowee-segment__item--active'));
          it.classList.add('naowee-segment__item--active');
          movePillTo(it, true);
          seg.dataset.wzValue = it.dataset.val || '';
        });
      });
    });
  }

  function refreshSegmentPills(){
    document.querySelectorAll('[data-wz-segment]').forEach(seg => {
      if(typeof seg._wzMoveInit === 'function') seg._wzMoveInit();
    });
  }

  /* ══ Input masks / type restriction ══ */
  function wireInputMasks(){
    document.querySelectorAll('[data-wz-input]').forEach(inp => {
      if(inp.dataset.wzMaskWired) return;
      inp.dataset.wzMaskWired = '1';
      const kind = inp.dataset.wzInput;
      if(kind === 'money' || kind === 'integer'){
        inp.addEventListener('input', () => {
          const caretPos = inp.selectionStart;
          const prevLen = inp.value.length;
          const digits = inp.value.replace(/\D/g, '');
          const formatted = digits ? Number(digits).toLocaleString('es-CO') : '';
          inp.value = formatted;
          // Keep caret in roughly the same place
          const delta = formatted.length - prevLen;
          try { inp.setSelectionRange(caretPos + delta, caretPos + delta); } catch(e){}
        });
        inp.addEventListener('keypress', e => {
          if(e.key.length === 1 && !/\d/.test(e.key)){ e.preventDefault(); }
        });
      }else if(kind === 'text'){
        // Allow letters, numbers, spaces and basic puntuation
        inp.addEventListener('input', () => {
          inp.value = inp.value.replace(/[<>{}]/g, '');
        });
      }
    });
  }

  function wireDropzone(){
    const dz = document.getElementById('wzDrop');
    if(!dz) return;
    ['dragenter','dragover'].forEach(evt => dz.addEventListener(evt, e => {
      e.preventDefault(); dz.classList.add('is-dragover');
    }));
    ['dragleave','drop'].forEach(evt => dz.addEventListener(evt, e => {
      e.preventDefault(); dz.classList.remove('is-dragover');
    }));
  }

  function wireChipPicker(){
    document.querySelectorAll('.chip-picker .naowee-tag--choice').forEach(tag => {
      tag.addEventListener('click', e => {
        e.preventDefault();
        tag.classList.toggle('naowee-tag--selected');
      });
    });
  }

  /* ══ Step-3 toggle ══ */
  function toggleIncType(el){
    el.parentElement.querySelectorAll('.toggle-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
  }

  /* ══ Step-4 add condition ══ */
  function addConditionRow(btn){
    const group = btn.closest('.cond-group');
    const row = document.createElement('div');
    row.className = 'cond-row';
    row.innerHTML = `
      <select><option>Edad</option><option>Género</option><option selected>Categoría deportiva</option><option>Logros</option></select>
      <select><option selected>=</option><option>≥</option><option>≤</option></select>
      <input type="text" placeholder="Valor"/>
      <button class="x-btn" onclick="this.closest('.cond-row').remove()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
    group.insertBefore(row, btn);
  }

  /* ══ Step-5 activate ══ */
  function activateProgram(){
    const overlay = document.getElementById('wzOverlay');
    overlay.classList.remove('open');
    if(typeof window.showToast === 'function'){
      window.showToast('Programa creado. Listo para asignaciones.', 'positive');
    }else{
      alert('Programa creado. Listo para asignaciones.');
    }
    // If the host page exposes a refresh hook, call it.
    if(typeof window.onProgramCreated === 'function') window.onProgramCreated();
  }

  function saveDraft(){
    if(typeof window.showToast === 'function'){
      window.showToast('Borrador guardado. Puedes retomarlo desde la lista.', 'informative');
    }else{
      alert('Borrador guardado. Puedes retomarlo desde la lista.');
    }
  }

  /* ══ Expose to window ══ */
  window.openWizard = openWizard;
  window.closeWizard = closeWizard;
  window.goStep = goStep;
  window.nextStep = nextStep;
  window.prevStep = prevStep;
  window.saveDraft = saveDraft;
  window.activateProgram = activateProgram;
  window.toggleIncType = toggleIncType;
  window.addConditionRow = addConditionRow;

  /* ══ Auto-mount on load, auto-open if ?new=1 ══ */
  document.addEventListener('DOMContentLoaded', () => {
    mount().then(() => {
      if(new URLSearchParams(location.search).get('new') === '1'){
        setTimeout(openWizard, 200);
      }
    });
  });
})();
