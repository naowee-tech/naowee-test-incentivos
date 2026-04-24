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
  let isDirty = false;

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
    wireDropzoneClick();
    wireChipPicker();
    wireSegments();
    wireCodesMode();
    wireInputMasks();
    wireBudgetInputs();
    seedManualRows();
    seedFirstCondition();
    wireDirtyTracking();
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

  /* Clic en stepper:
     - Permite ir a pasos ya completados (s < currentStep) sin validar
     - Permite quedarse en el actual
     - Bloquea saltar hacia adelante — forzar uso del botón "Continuar" */
  function tryGoStep(s){
    if(s <= currentStep){ goStep(s); return; }
    if(!validateStep(currentStep)) return;
    if(s === currentStep + 1){ currentStep = s; renderStep(); }
    // más de un paso adelante: bloqueado, solo secuencial
  }

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
    let firstInvalid = null;
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
        if(!firstInvalid) firstInvalid = field;
      }else{
        clearError(field);
      }
    });
    if(!ok && firstInvalid){
      // Scroll suave dentro del body del modal al primer campo inválido
      const body = document.getElementById('wzBody');
      if(body){
        const bodyRect = body.getBoundingClientRect();
        const fieldRect = firstInvalid.getBoundingClientRect();
        const targetTop = body.scrollTop + (fieldRect.top - bodyRect.top) - 24;
        body.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      }else{
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Relanzar la animación shake después del scroll para que sea visible
      setTimeout(() => {
        pane.querySelectorAll('.naowee-textfield--error, .naowee-dropdown--error').forEach(f => {
          f.classList.remove('wz-shake');
          void f.offsetWidth;
          f.classList.add('wz-shake');
          setTimeout(() => f.classList.remove('wz-shake'), 500);
        });
      }, 260);
    }
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
    isDirty = false;
    renderStep();
    // Recompute segment pill positions once modal is visible (needs layout)
    requestAnimationFrame(() => setTimeout(refreshSegmentPills, 50));
  }

  function closeWizard(){
    const overlay = document.getElementById('wzOverlay');
    if(!overlay) return;
    // Solo pregunta si el usuario realmente editó algo
    if(!isDirty){
      overlay.classList.remove('open');
      return;
    }
    // Cierra el wizard primero, luego abre el warning (nunca apilados)
    overlay.classList.remove('open');
    const warn = document.getElementById('wzWarnCloseOverlay');
    if(warn){
      setTimeout(() => warn.classList.add('open'), 180);
    }
  }
  function confirmDiscardWizard(){
    document.getElementById('wzWarnCloseOverlay')?.classList.remove('open');
    isDirty = false;
    showToast('Cambios descartados.', 'neutral');
  }
  function confirmSaveDraftWizard(){
    document.getElementById('wzWarnCloseOverlay')?.classList.remove('open');
    isDirty = false;
    showToast('Borrador guardado. Puedes retomarlo desde la lista.', 'positive');
  }

  /* ══ Toast (naowee-message --positive/--negative/--informative/--neutral) ══ */
  function getToastWrap(){
    let w = document.getElementById('wzToastWrap');
    if(!w){
      w = document.createElement('div');
      w.id = 'wzToastWrap';
      w.className = 'wz-toast-wrap';
      document.body.appendChild(w);
    }
    return w;
  }
  function showToast(text, variant = 'positive'){
    const wrap = getToastWrap();
    const el = document.createElement('div');
    el.className = `wz-toast naowee-message naowee-message--${variant}`;
    const icons = {
      positive:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      negative:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg>',
      informative: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
      neutral:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
    };
    el.innerHTML = `
      <div class="naowee-message__header">
        <div class="naowee-message__icon">${icons[variant] || icons.positive}</div>
        <div class="naowee-message__text">${text}</div>
        <button type="button" class="wz-toast__dismiss" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    const dismiss = () => {
      el.style.transition = 'opacity .22s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 260);
    };
    el.querySelector('.wz-toast__dismiss').addEventListener('click', dismiss);
    wrap.appendChild(el);
    setTimeout(dismiss, 4000);
  }
  window.showToast = showToast;

  /* Dirty tracking — marca como dirty solo cuando el usuario interactúa */
  function wireDirtyTracking(){
    const overlay = document.getElementById('wzOverlay');
    if(!overlay || overlay.dataset.wzDirtyWired) return;
    overlay.dataset.wzDirtyWired = '1';
    const markDirty = () => { isDirty = true; };
    overlay.addEventListener('input', markDirty, true);
    overlay.addEventListener('change', markDirty, true);
    // Dropdown option clicks
    overlay.addEventListener('click', e => {
      if(e.target.closest('.naowee-dropdown__option')) isDirty = true;
      if(e.target.closest('.naowee-segment__item')) isDirty = true;
      if(e.target.closest('.naowee-tag--choice')) isDirty = true;
      if(e.target.closest('.toggle-card')) isDirty = true;
      if(e.target.closest('.wz-dp__day')) isDirty = true;
    }, true);
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
      const isMulti = dd.hasAttribute('data-wz-multi');

      function updateMultiTrigger(){
        const selected = [...menu.querySelectorAll('.naowee-dropdown__option--selected')];
        if(!valueEl){
          valueEl = document.createElement('span');
          valueEl.className = 'naowee-dropdown__value';
          trigger.insertBefore(valueEl, trigger.firstChild);
        }
        if(selected.length === 0){
          if(placeholderEl) placeholderEl.style.display = '';
          valueEl.style.display = 'none';
          dd.dataset.wzValue = '';
        } else {
          if(placeholderEl) placeholderEl.style.display = 'none';
          valueEl.style.display = '';
          if(selected.length === 1){
            valueEl.textContent = selected[0].textContent.trim();
          } else if(selected.length <= 3){
            valueEl.textContent = selected.map(o => o.textContent.trim()).join(', ');
          } else {
            valueEl.textContent = selected.length + ' seleccionadas';
          }
          dd.dataset.wzValue = selected.map(o => o.dataset.val || '').join(',');
        }
      }

      menu.querySelectorAll('.naowee-dropdown__option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          if(isMulti){
            e.stopPropagation();
            opt.classList.toggle('naowee-dropdown__option--selected');
            updateMultiTrigger();
            clearError(dd);
            // No cerrar el menú en multi — el user puede seguir seleccionando
            return;
          }
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
        // Rango: calcular límite mínimo si este campo es "to" y ya hay un "from"
        const rangeRole = field.dataset.wzRange;      // "from" | "to" | undefined
        const rangeName = field.dataset.wzRangeName;  // nombre compartido
        let minDate = null, maxDate = null;
        if(rangeRole === 'to' && rangeName){
          const fromField = document.querySelector(`[data-wz-datepicker][data-wz-range="from"][data-wz-range-name="${rangeName}"]`);
          const fromIso = fromField?.querySelector('input')?.dataset.wzIso;
          if(fromIso){
            const [fy, fm, fd] = fromIso.split('-').map(Number);
            minDate = new Date(fy, fm - 1, fd);
          }
        } else if(rangeRole === 'from' && rangeName){
          // from puede tener max si ya hay un "to" (opcional, no bloqueante)
          const toField = document.querySelector(`[data-wz-datepicker][data-wz-range="to"][data-wz-range-name="${rangeName}"]`);
          const toIso = toField?.querySelector('input')?.dataset.wzIso;
          if(toIso){
            const [ty, tm, td] = toIso.split('-').map(Number);
            maxDate = new Date(ty, tm - 1, td);
          }
        }

        cells.forEach(c => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'wz-dp__day';
          if(c.muted) b.classList.add('wz-dp__day--muted');
          if(sameDay(c.d, today)) b.classList.add('wz-dp__day--today');
          if(hasSelection && sameDay(c.d, selected)) b.classList.add('wz-dp__day--selected');
          // Disable días fuera del rango permitido
          const outOfRange = (minDate && c.d < minDate) || (maxDate && c.d > maxDate);
          if(outOfRange){
            b.classList.add('wz-dp__day--disabled');
            b.disabled = true;
          }
          b.textContent = c.day;
          b.addEventListener('click', e => {
            e.stopPropagation();
            if(outOfRange) return;
            selected = c.d;
            hasSelection = true;
            viewYear = c.d.getFullYear();
            viewMonth = c.d.getMonth();
            input.value = formatHuman(c.d);
            input.dataset.wzIso = toIso(c.d);
            pop.classList.remove('open');
            clearError(field);

            // Si este es "from", validar que "to" no quede antes; si es así, limpiar "to".
            if(rangeRole === 'from' && rangeName){
              const toField = document.querySelector(`[data-wz-datepicker][data-wz-range="to"][data-wz-range-name="${rangeName}"]`);
              const toInput = toField?.querySelector('input');
              const toIsoVal = toInput?.dataset.wzIso;
              if(toIsoVal){
                const [ty, tm, td] = toIsoVal.split('-').map(Number);
                const toDate = new Date(ty, tm - 1, td);
                if(toDate < c.d){
                  toInput.value = '';
                  delete toInput.dataset.wzIso;
                }
              }
            }
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

  /* ══ Step-5 codes mode (upload vs manual) ══ */
  function wireCodesMode(){
    const seg = document.querySelector('[data-wz-name="codes-mode"]');
    if(!seg || seg.dataset.wzCodesWired) return;
    seg.dataset.wzCodesWired = '1';
    seg.querySelectorAll('.naowee-segment__item').forEach(it => {
      it.addEventListener('click', () => {
        const mode = it.dataset.val;
        document.querySelectorAll('.wz-codes-mode').forEach(pane => {
          pane.hidden = pane.dataset.mode !== mode;
        });
        updateBudget();
      });
    });
  }

  function wireBudgetInputs(){
    ['wzRubroTotal', 'wzValorUnit'].forEach(id => {
      const el = document.getElementById(id);
      if(!el || el.dataset.wzBudgetWired) return;
      el.dataset.wzBudgetWired = '1';
      el.addEventListener('input', updateBudget);
    });
  }

  function seedManualRows(){
    const rows = document.getElementById('wzManualRows');
    if(!rows || rows.children.length > 0) return;
    for(let i = 1; i <= 3; i++){
      const row = makeManualRow(i);
      rows.appendChild(row);
    }
    upgradeDropdowns();
    wireInputMasks();
    rows.addEventListener('input', updateBudget);
  }

  function makeManualRow(defaultIdx){
    const row = document.createElement('div');
    row.className = 'manual-row';
    row.innerHTML = `
      <input type="text" placeholder="2026BEC-${String(defaultIdx || 1).padStart(5, '0')}"/>
      <div class="naowee-dropdown manual-row__cat" data-wz-dropdown data-wz-name="manual-cat">
        <div class="naowee-dropdown__trigger" tabindex="0">
          <span class="naowee-dropdown__placeholder">Categoría</span>
          <div class="naowee-dropdown__controls">
            <span class="naowee-dropdown__chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></span>
          </div>
        </div>
        <div class="naowee-dropdown__menu" role="listbox">
          <div class="naowee-dropdown__option" data-val="bono">Bono</div>
          <div class="naowee-dropdown__option" data-val="beca">Beca</div>
          <div class="naowee-dropdown__option" data-val="kit">Kit</div>
          <div class="naowee-dropdown__option" data-val="transporte">Transporte</div>
          <div class="naowee-dropdown__option" data-val="inscripcion">Inscripción</div>
          <div class="naowee-dropdown__option" data-val="descuento">Descuento</div>
          <div class="naowee-dropdown__option" data-val="pase">Pase / acceso</div>
          <div class="naowee-dropdown__option" data-val="dinero">Dinero</div>
        </div>
      </div>
      <input type="text" inputmode="numeric" placeholder="1.000.000" data-wz-input="money"/>
      <button type="button" class="x-btn" onclick="removeManualRow(this)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
    return row;
  }

  function seedFirstCondition(){
    const builder = document.getElementById('wzCondBuilder');
    if(!builder || builder.children.length > 0) return;
    addConditionGroup();
  }

  function addManualRow(){
    const rows = document.getElementById('wzManualRows');
    if(!rows) return;
    const defaultIdx = rows.children.length + 1;
    const row = makeManualRow(defaultIdx);
    rows.appendChild(row);
    upgradeDropdowns();
    wireInputMasks();
    updateBudget();
    const firstInput = row.querySelector('input');
    if(firstInput) firstInput.focus();
  }

  function removeManualRow(btn){
    const row = btn.closest('.manual-row');
    const rows = document.getElementById('wzManualRows');
    if(rows && rows.children.length <= 1) return;
    row.remove();
    updateBudget();
  }

  /* ══ Step-3 — toggle single vs multi + add/remove incentivos ══ */
  let incTypesMode = 'single';
  let incCounter = 1;

  function setIncTypesMode(el, mode){
    incTypesMode = mode;
    el.parentElement.querySelectorAll('.toggle-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    const addBtn = document.getElementById('wzAddInc');
    if(addBtn) addBtn.hidden = (mode !== 'multi');
    // Si cambió a single: dejar sólo la primera tarjeta
    if(mode === 'single'){
      const list = document.getElementById('wzIncList');
      if(list){
        [...list.querySelectorAll('.wz-inc-card')].slice(1).forEach(c => c.remove());
        incCounter = 1;
      }
    }
  }

  function addIncentive(){
    if(incTypesMode !== 'multi') return;
    const list = document.getElementById('wzIncList');
    if(!list) return;
    incCounter++;
    const idx = incCounter;
    const card = document.createElement('div');
    card.className = 'wz-inc-card';
    card.dataset.idx = idx;
    card.innerHTML = `
      <div class="wz-inc-card__head">
        <span class="wz-inc-card__badge">Incentivo #${idx}</span>
        <button type="button" class="wz-inc-card__remove" onclick="removeIncentive(this)" aria-label="Eliminar incentivo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="wz-grid">
        <div class="naowee-textfield" data-wz-required>
          <label class="naowee-textfield__label naowee-textfield__label--required">Nombre del incentivo</label>
          <div class="naowee-textfield__input-wrap">
            <input class="naowee-textfield__input" type="text" placeholder="Ej. Kit deportivo" data-wz-input="text" maxlength="100"/>
          </div>
        </div>
        <div class="naowee-dropdown" data-wz-dropdown data-wz-name="categoria" data-wz-required>
          <label class="naowee-dropdown__label naowee-dropdown__label--required">Categoría</label>
          <div class="naowee-dropdown__trigger" tabindex="0">
            <span class="naowee-dropdown__placeholder">Selecciona categoría</span>
            <div class="naowee-dropdown__controls">
              <span class="naowee-dropdown__chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></span>
            </div>
          </div>
          <div class="naowee-dropdown__menu" role="listbox">
            <div class="naowee-dropdown__option" data-val="bono">Bono</div>
            <div class="naowee-dropdown__option" data-val="beca">Beca</div>
            <div class="naowee-dropdown__option" data-val="kit">Kit</div>
            <div class="naowee-dropdown__option" data-val="transporte">Transporte</div>
            <div class="naowee-dropdown__option" data-val="inscripcion">Inscripción</div>
            <div class="naowee-dropdown__option" data-val="descuento">Descuento</div>
            <div class="naowee-dropdown__option" data-val="pase">Pase / acceso</div>
            <div class="naowee-dropdown__option" data-val="dinero">Dinero</div>
          </div>
        </div>
      </div>`;
    list.appendChild(card);
    upgradeDropdowns();
    wireInputMasks();
    const firstInput = card.querySelector('input');
    if(firstInput) firstInput.focus();
  }

  function removeIncentive(btn){
    const card = btn.closest('.wz-inc-card');
    if(!card) return;
    const list = document.getElementById('wzIncList');
    if(list && list.children.length <= 1) return; // siempre al menos uno
    card.remove();
  }

  /* ══ Step-4 — condiciones dinámicas (Edad, Género, Categoría, Logros) ══ */
  const COND_FIELDS = {
    edad:      { label: 'Edad',                operators: [['gte','≥'],['lte','≤'],['eq','='],['neq','≠']], valueType: 'number', placeholder: 'Años' },
    genero:    { label: 'Género',              operators: [['eq','='],['neq','≠']],                         valueType: 'select',  options: [['masculino','Masculino'],['femenino','Femenino'],['otro','Otro']] },
    categoria: { label: 'Categoría deportiva', operators: [['eq','='],['in','∈']],                          valueType: 'select',  options: [['infantil','Infantil'],['prejuvenil','Pre-juvenil'],['juvenil','Juvenil'],['junior','Junior'],['sub23','Sub-23'],['mayores','Mayores'],['master','Máster']] },
    logros:    { label: 'Logros',              operators: [['in','∈'],['nin','∉']],                         valueType: 'select',  options: [['oro','Medalla de oro'],['plata','Medalla de plata'],['bronce','Medalla de bronce'],['top10','Top 10'],['participacion','Participación']] }
  };

  let condRowCounter = 0;
  let condGroupCounter = 0;

  function addConditionGroup(){
    const builder = document.getElementById('wzCondBuilder');
    if(!builder) return;
    // Si ya hay al menos un grupo, inserta divider OR antes del nuevo
    if(builder.children.length > 0){
      const divider = document.createElement('div');
      divider.className = 'cond-or-divider';
      divider.innerHTML = `<span class="cond-or-divider__pill">OR</span>`;
      builder.appendChild(divider);
    }
    condGroupCounter++;
    const groupNum = builder.querySelectorAll('.cond-group').length + 1;
    const group = document.createElement('div');
    group.className = 'cond-group';
    group.dataset.groupId = condGroupCounter;
    group.innerHTML = `
      <div class="cond-group__head">
        <span class="cond-group__badge">Grupo ${groupNum} · AND</span>
        <button type="button" class="cond-group__remove" onclick="removeConditionGroup(this)" aria-label="Eliminar grupo"${groupNum === 1 ? ' hidden' : ''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="cond-rows"></div>
      <button type="button" class="add-cond" onclick="addConditionRow(this)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Añadir condición
      </button>`;
    builder.appendChild(group);
    // Auto-añadir la primera condición del grupo
    addConditionRow(group.querySelector('.add-cond'));
    // Re-renumerar badges (por si se quitó uno en medio)
    renumberCondGroups();
  }

  function removeConditionGroup(btn){
    const group = btn.closest('.cond-group');
    if(!group) return;
    // Quitar divider OR hermano (antes o después)
    const prev = group.previousElementSibling;
    const next = group.nextElementSibling;
    if(prev && prev.classList.contains('cond-or-divider')) prev.remove();
    else if(next && next.classList.contains('cond-or-divider')) next.remove();
    group.remove();
    renumberCondGroups();
    refreshCondPreview();
  }

  function renumberCondGroups(){
    const groups = document.querySelectorAll('#wzCondBuilder .cond-group');
    groups.forEach((g, i) => {
      const badge = g.querySelector('.cond-group__badge');
      if(badge) badge.textContent = `Grupo ${i + 1} · AND`;
      const rm = g.querySelector('.cond-group__remove');
      if(rm) rm.hidden = (groups.length === 1);
    });
  }

  function addConditionRow(btnOrNothing){
    // Resolver el grupo: si viene del botón, usa ese grupo; si no, el último grupo
    let group;
    if(btnOrNothing && btnOrNothing.closest){
      group = btnOrNothing.closest('.cond-group');
    }else{
      const groups = document.querySelectorAll('#wzCondBuilder .cond-group');
      group = groups[groups.length - 1];
    }
    if(!group) return;
    const rows = group.querySelector('.cond-rows');
    if(!rows) return;
    condRowCounter++;
    const id = condRowCounter;
    const row = document.createElement('div');
    row.className = 'cond-row';
    row.dataset.rowId = id;
    row.innerHTML = `
      <div class="naowee-dropdown cond-field" data-wz-dropdown data-cond-field data-val="edad">
        <div class="naowee-dropdown__trigger" tabindex="0">
          <span class="naowee-dropdown__value">Edad</span>
          <div class="naowee-dropdown__controls">
            <span class="naowee-dropdown__chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></span>
          </div>
        </div>
        <div class="naowee-dropdown__menu" role="listbox">
          ${Object.entries(COND_FIELDS).map(([k,v], i) => `<div class="naowee-dropdown__option${i === 0 ? ' naowee-dropdown__option--selected' : ''}" data-val="${k}">${v.label}</div>`).join('')}
        </div>
      </div>
      <div class="naowee-dropdown cond-op" data-wz-dropdown data-cond-op>
        <div class="naowee-dropdown__trigger" tabindex="0">
          <span class="naowee-dropdown__value">≥</span>
          <div class="naowee-dropdown__controls">
            <span class="naowee-dropdown__chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></span>
          </div>
        </div>
        <div class="naowee-dropdown__menu" role="listbox"></div>
      </div>
      <span data-cond-value></span>
      <button type="button" class="x-btn" onclick="removeConditionRow(this)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
    rows.appendChild(row);
    rebuildCondRow(row, 'edad');
    // Wire dropdowns (field + op)
    upgradeDropdowns();
    // Custom behavior: when field option picked, rebuild operator + value (after native upgrade)
    const fieldDd = row.querySelector('.cond-field');
    fieldDd.querySelectorAll('.naowee-dropdown__option').forEach(opt => {
      opt.addEventListener('click', () => {
        const newField = opt.dataset.val;
        fieldDd.dataset.val = newField;
        setTimeout(() => rebuildCondRow(row, newField), 0);
      });
    });
    refreshCondPreview();
  }

  function removeConditionRow(btn){
    const row = btn.closest('.cond-row');
    if(!row) return;
    row.remove();
    refreshCondPreview();
  }

  function rebuildCondRow(row, fieldKey){
    const def = COND_FIELDS[fieldKey];
    if(!def) return;
    const opDd = row.querySelector('.cond-op');
    if(opDd){
      const menu = opDd.querySelector('.naowee-dropdown__menu');
      menu.innerHTML = def.operators.map(([v, lbl], i) => `<div class="naowee-dropdown__option${i === 0 ? ' naowee-dropdown__option--selected' : ''}" data-val="${v}">${lbl}</div>`).join('');
      opDd.querySelector('.naowee-dropdown__value').textContent = def.operators[0][1];
      opDd.dataset.val = def.operators[0][0];
      // Re-wire options for op (since menu replaced)
      opDd.removeAttribute('data-wz-wired');
      delete opDd.dataset.wzWired;
      upgradeDropdowns();
      opDd.querySelectorAll('.naowee-dropdown__option').forEach(opt => {
        opt.addEventListener('click', () => {
          opDd.dataset.val = opt.dataset.val;
          refreshCondPreview();
        });
      });
    }
    const valSpan = row.querySelector('[data-cond-value]');
    if(def.valueType === 'number'){
      valSpan.innerHTML = makeStepper({ min: 0, max: 120, value: 18, unit: def.placeholder || '' });
      wireStepper(valSpan.querySelector('[data-cond-val]'));
    }else if(def.valueType === 'select'){
      valSpan.innerHTML = `
        <div class="naowee-dropdown cond-val" data-wz-dropdown data-cond-val>
          <div class="naowee-dropdown__trigger" tabindex="0">
            <span class="naowee-dropdown__placeholder">Selecciona…</span>
            <div class="naowee-dropdown__controls">
              <span class="naowee-dropdown__chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></span>
            </div>
          </div>
          <div class="naowee-dropdown__menu" role="listbox">
            ${def.options.map(([v, lbl]) => `<div class="naowee-dropdown__option" data-val="${v}">${lbl}</div>`).join('')}
          </div>
        </div>`;
      upgradeDropdowns();
      valSpan.querySelectorAll('.naowee-dropdown__option').forEach(opt => {
        opt.addEventListener('click', () => {
          valSpan.querySelector('.cond-val').dataset.val = opt.dataset.val;
          refreshCondPreview();
        });
      });
    }
    refreshCondPreview();
  }

  /* Stepper DS helpers */
  function makeStepper({ min = 0, max = 120, value = 0, unit = '' } = {}){
    return `
      <div class="naowee-input-stepper naowee-input-stepper--small" data-cond-val data-min="${min}" data-max="${max}">
        <div class="naowee-input-stepper__content">
          <div class="naowee-input-stepper__input">
            <button type="button" class="naowee-input-stepper__btn" data-step="-1" aria-label="Restar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <div class="naowee-input-stepper__value">
              <input class="naowee-input-stepper__value-input" type="number" value="${value}" min="${min}" max="${max}"/>
              ${unit ? `<span class="naowee-input-stepper__value-comp">${unit}</span>` : ''}
            </div>
            <button type="button" class="naowee-input-stepper__btn" data-step="1" aria-label="Sumar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  }
  function wireStepper(stepper){
    if(!stepper) return;
    const input = stepper.querySelector('.naowee-input-stepper__value-input');
    const min = Number(stepper.dataset.min) || 0;
    const max = Number(stepper.dataset.max) || 999;
    stepper.querySelectorAll('.naowee-input-stepper__btn').forEach(b => {
      b.addEventListener('click', () => {
        const delta = Number(b.dataset.step);
        let v = Number(input.value) || 0;
        v = Math.max(min, Math.min(max, v + delta));
        input.value = v;
        refreshCondPreview();
      });
    });
    input.addEventListener('input', () => {
      let v = Number(input.value) || 0;
      if(v < min) v = min;
      if(v > max) v = max;
      refreshCondPreview();
    });
    input.addEventListener('focus', () => stepper.classList.add('naowee-input-stepper--active'));
    input.addEventListener('blur', () => stepper.classList.remove('naowee-input-stepper--active'));
  }

  function refreshCondPreview(){
    const pv = document.getElementById('wzCondPreview');
    if(!pv) return;
    const groups = document.querySelectorAll('#wzCondBuilder .cond-group');
    if(!groups.length){
      pv.innerHTML = `Vista previa: <em>agrega al menos una condición para ver la vista previa.</em>`;
      return;
    }
    const groupPieces = [];
    groups.forEach(g => {
      const rows = g.querySelectorAll('.cond-row');
      if(!rows.length) return;
      const rowPieces = [...rows].map(r => {
        const fieldKey = r.querySelector('[data-cond-field]').dataset.val || 'edad';
        const def = COND_FIELDS[fieldKey];
        const opVal = r.querySelector('[data-cond-op]').dataset.val || def.operators[0][0];
        const opLbl = (def.operators.find(o => o[0] === opVal) || ['', '?'])[1];
        const valEl = r.querySelector('[data-cond-val]');
        let rawVal = '';
        if(valEl){
          if(valEl.classList.contains('naowee-input-stepper')){
            rawVal = valEl.querySelector('input').value;
          }else if(valEl.classList.contains('naowee-dropdown')){
            rawVal = valEl.querySelector('.naowee-dropdown__value')?.textContent || '';
          }
        }
        const val = String(rawVal).trim() || '…';
        return `<code>${def.label} ${opLbl} ${val}</code>`;
      });
      const joined = rowPieces.join(` <strong>AND</strong> `);
      groupPieces.push(groups.length > 1 ? `(${joined})` : joined);
    });
    if(!groupPieces.length){
      pv.innerHTML = `Vista previa: <em>agrega al menos una condición para ver la vista previa.</em>`;
      return;
    }
    pv.innerHTML = `Vista previa: ${groupPieces.join(' <strong>OR</strong> ')}`;
  }

  /* ══ Step-5 — dropzone clickeable + file chip + budget live ══ */
  function wireDropzoneClick(){
    const dz = document.getElementById('wzDrop');
    const input = document.getElementById('wzFileInput');
    if(!dz || !input || dz.dataset.wzClickWired) return;
    dz.dataset.wzClickWired = '1';
    dz.addEventListener('click', () => input.click());
    dz.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      if(!f) return;
      const chip = document.getElementById('wzFileChip');
      if(!chip) return;
      chip.hidden = false;
      dz.style.display = 'none';
      chip.innerHTML = `
        <div class="wz-file-chip__ico">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="wz-file-chip__body">
          <div class="wz-file-chip__name">${escapeHtml(f.name)}</div>
          <div class="wz-file-chip__meta">${(f.size/1024).toFixed(1)} KB · listo para procesar</div>
        </div>
        <button type="button" class="wz-file-chip__remove" onclick="resetWzFile()" aria-label="Quitar archivo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>`;
    });
  }
  function resetWzFile(){
    const chip = document.getElementById('wzFileChip');
    const dz = document.getElementById('wzDrop');
    const input = document.getElementById('wzFileInput');
    if(chip){ chip.hidden = true; chip.innerHTML = ''; }
    if(dz) dz.style.display = '';
    if(input) input.value = '';
    updateBudget();
  }
  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function parseMoney(el){
    if(!el) return 0;
    const digits = String(el.value || '').replace(/\D/g, '');
    return digits ? Number(digits) : 0;
  }

  function updateBudget(){
    const bx = document.getElementById('wzBudget');
    if(!bx) return;
    const rubro = parseMoney(document.getElementById('wzRubroTotal'));
    const unit = parseMoney(document.getElementById('wzValorUnit'));
    const mode = (document.querySelector('[data-wz-name="codes-mode"]')?.dataset?.wzValue) || 'upload';
    if(!rubro || !unit){
      bx.hidden = true; bx.innerHTML = '';
      return;
    }
    const expected = Math.floor(rubro / unit);
    const fmt = n => `$${n.toLocaleString('es-CO')}`;
    let variant, iconSvg, text;
    if(mode === 'manual'){
      const rows = [...document.querySelectorAll('#wzManualRows .manual-row')];
      const count = rows.length;
      const sum = rows.reduce((acc, r) => {
        const inputs = r.querySelectorAll('input[data-wz-input="money"], input[inputmode="numeric"]');
        const v = parseMoney(inputs[inputs.length - 1]);
        return acc + (v || unit);
      }, 0);
      if(sum > rubro){
        variant = 'negative';
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
        text = `Los <strong>${count} códigos</strong> suman <strong>${fmt(sum)}</strong>, que excede el rubro disponible de <strong>${fmt(rubro)}</strong>. Ajusta valores o elimina códigos.`;
      }else if(sum === rubro){
        variant = 'positive';
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        text = `<strong>${count} códigos</strong> por un total de <strong>${fmt(sum)}</strong>. Rubro consumido al 100%.`;
      }else{
        variant = 'informative';
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;
        const restante = rubro - sum;
        text = `<strong>${count} de ${expected} códigos</strong> registrados (<strong>${fmt(sum)}</strong> de ${fmt(rubro)}). Faltan <strong>${fmt(restante)}</strong> por asignar.`;
      }
    }else{
      variant = 'informative';
      iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;
      text = `Rubro <strong>${fmt(rubro)}</strong> ÷ valor unitario <strong>${fmt(unit)}</strong> = <strong>${expected} códigos</strong> esperados en el archivo.`;
    }
    bx.hidden = false;
    bx.innerHTML = `
      <div class="naowee-message naowee-message--${variant}">
        <div class="naowee-message__header">
          <div class="naowee-message__icon">${iconSvg}</div>
          <div class="naowee-message__text">${text}</div>
        </div>
      </div>`;
  }

  /* ══ Success modal ══ */
  function showSuccessModal(){
    const overlay = document.getElementById('wzSuccessOverlay');
    if(!overlay) return;
    // Poblar stats
    const rubro = parseMoney(document.getElementById('wzRubroTotal'));
    const unit = parseMoney(document.getElementById('wzValorUnit'));
    const expected = rubro && unit ? Math.floor(rubro / unit) : 0;
    const from = document.querySelector('.wz-pane[data-pane="1"] [data-wz-datepicker]:nth-of-type(1) input')?.value || '—';
    const to = document.querySelector('.wz-pane[data-pane="1"] [data-wz-datepicker]:nth-of-type(2) input')?.value || '—';
    overlay.querySelector('[data-key="rubro"]').textContent = rubro ? `$${rubro.toLocaleString('es-CO')}` : '—';
    overlay.querySelector('[data-key="codigos"]').textContent = expected || '—';
    overlay.querySelector('[data-key="vigencia"]').textContent = (from !== '—' && to !== '—') ? `${from} → ${to}` : (from !== '—' ? from : '—');
    seedConfetti();
    overlay.classList.add('open');
  }

  function seedConfetti(){
    const root = document.getElementById('wzConfetti');
    if(!root) return;
    root.innerHTML = '';
    // Patrón escenario-11: paleta mixta + falling confetti
    const colors = ['#FF7500', '#d74009', '#1f8923', '#1f78d1', '#ffbf75', '#ffffff'];
    const pieces = 42;
    for(let i = 0; i < pieces; i++){
      const p = document.createElement('span');
      p.className = 'wz-confetti__piece';
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.animationDelay = (Math.random() * 0.6).toFixed(2) + 's';
      p.style.animationDuration = (1.8 + Math.random() * 1.4).toFixed(2) + 's';
      p.style.borderRadius = Math.random() > 0.5 ? '2px' : '50%';
      root.appendChild(p);
    }
  }
  function hideSuccessModal(){
    const overlay = document.getElementById('wzSuccessOverlay');
    if(overlay) overlay.classList.remove('open');
  }
  function closeSuccessAndNew(){
    hideSuccessModal();
    currentStep = 1;
    renderStep();
    document.getElementById('wzOverlay').classList.add('open');
  }
  function goToProgramDetail(){
    hideSuccessModal();
    window.location.href = 'incentivo-05-programa-detalle.html?activated=1';
  }

  /* ══ Step-5 activate ══ */
  function activateProgram(){
    // Validar rubro antes de activar
    const rubro = parseMoney(document.getElementById('wzRubroTotal'));
    const mode = (document.querySelector('[data-wz-name="codes-mode"]')?.dataset?.wzValue) || 'upload';
    if(mode === 'manual' && rubro){
      const unit = parseMoney(document.getElementById('wzValorUnit'));
      const rows = [...document.querySelectorAll('#wzManualRows .manual-row')];
      const sum = rows.reduce((acc, r) => {
        const inputs = r.querySelectorAll('input[data-wz-input="money"], input[inputmode="numeric"]');
        const v = parseMoney(inputs[inputs.length - 1]);
        return acc + (v || unit);
      }, 0);
      if(sum > rubro){
        updateBudget();
        const body = document.getElementById('wzBody');
        const bx = document.getElementById('wzBudget');
        if(body && bx){
          const bodyRect = body.getBoundingClientRect();
          const bxRect = bx.getBoundingClientRect();
          body.scrollTo({ top: body.scrollTop + (bxRect.top - bodyRect.top) - 24, behavior: 'smooth' });
        }
        return;
      }
    }
    // Cerrar wizard y mostrar success modal
    const overlay = document.getElementById('wzOverlay');
    overlay.classList.remove('open');
    isDirty = false;
    showSuccessModal();
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
  window.tryGoStep = tryGoStep;
  window.nextStep = nextStep;
  window.prevStep = prevStep;
  window.saveDraft = saveDraft;
  window.activateProgram = activateProgram;
  window.setIncTypesMode = setIncTypesMode;
  window.addIncentive = addIncentive;
  window.removeIncentive = removeIncentive;
  window.addConditionGroup = addConditionGroup;
  window.removeConditionGroup = removeConditionGroup;
  window.addConditionRow = addConditionRow;
  window.removeConditionRow = removeConditionRow;
  window.addManualRow = addManualRow;
  window.removeManualRow = removeManualRow;
  window.resetWzFile = resetWzFile;
  window.closeSuccessAndNew = closeSuccessAndNew;
  window.goToProgramDetail = goToProgramDetail;
  window.confirmDiscardWizard = confirmDiscardWizard;
  window.confirmSaveDraftWizard = confirmSaveDraftWizard;

  /* ══ Auto-mount on load, auto-open if ?new=1 ══ */
  document.addEventListener('DOMContentLoaded', () => {
    mount().then(() => {
      if(new URLSearchParams(location.search).get('new') === '1'){
        setTimeout(openWizard, 200);
      }
    });
  });
})();
