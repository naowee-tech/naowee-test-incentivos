/* ═══════════════════════════════════════════════════════════════
   PROGRAMA · WIZARD (5 pasos) — lógica compartida
   Inyecta el markup desde shared/programa-wizard.html y expone
   window.openWizard(). Upgrade automático de selects nativos a
   naowee-dropdown y de inputs date a date-picker custom.
   ═══════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* totalSteps es dinámico: 4 si hay un incentivo "Bono", 3 si no.
     El paso 4 (Códigos) se omite cuando ningún incentivo es Bono — sólo
     los bonos generan códigos. */
  function hasBonoIncentive(){
    return [...document.querySelectorAll('.wz-pane[data-pane="2"] .wz-inc-card [data-wz-name="categoria"]')]
      .some(dd => (dd.dataset.wzValue || '').toLowerCase() === 'bono');
  }
  function totalStepsNow(){ return hasBonoIncentive() ? 4 : 3; }
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
    upgradeTagMultis();
    upgradeDatepickers();
    wireDropzone();
    wireDropzoneClick();
    wireAnexosUpload();
    wireCategoriaWatcher();
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
    const lastStep = totalStepsNow();
    const showCodes = lastStep === 4;
    // Si los códigos se ocultan y currentStep cayó en 4, regrésalo a 3.
    if(currentStep > lastStep) currentStep = lastStep;
    document.querySelectorAll('.wz-pane').forEach(p => { p.hidden = +p.dataset.pane !== currentStep; });
    document.querySelectorAll('.naowee-stepper__step').forEach(s => {
      const n = +s.dataset.step;
      // Paso 4 (Códigos) sólo aparece si hay un incentivo Bono.
      const hideStep = (n === 4 && !showCodes);
      s.classList.toggle('wz-step-hidden', hideStep);
      s.hidden = hideStep; // mantenemos también el atributo por accesibilidad
      s.classList.toggle('naowee-stepper__step--active', n === currentStep);
      s.classList.toggle('naowee-stepper__step--done', n < currentStep);
      const conn = s.querySelector('.naowee-stepper__connector');
      if(conn){
        conn.classList.toggle('naowee-stepper__connector--done', n < currentStep);
        // El conector tras "Condiciones" sólo tiene sentido si paso 4 está visible.
        if(n === 3) conn.style.display = showCodes ? '' : 'none';
      }
    });
    const btnPrev = document.getElementById('wzBtnPrev');
    btnPrev.style.display = currentStep === 1 ? 'none' : 'inline-flex';
    const spacer = document.getElementById('wzPrevSpacer');
    if(spacer) spacer.style.display = currentStep === 1 ? 'block' : 'none';
    spacer && (spacer.style.flex = '1');

    const btnNext = document.getElementById('wzBtnNext');
    if(currentStep === lastStep){
      btnNext.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Activar programa`;
    }else{
      btnNext.innerHTML = `Continuar <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    }
    document.getElementById('wzBody').scrollTop = 0;
    // Recompute segment pills on the now-visible pane (sync + deferred for safety)
    refreshSegmentPills();
    requestAnimationFrame(refreshSegmentPills);
    setTimeout(refreshSegmentPills, 80);
    // Al entrar al paso 3 (Condiciones), re-evaluar paneles según incentivos.
    if(currentStep === 3) renderCondPanels();
  }

  function goStep(s){ currentStep = s; renderStep(); }

  /* Clic en stepper:
     - Permite ir a pasos ya completados (s < currentStep) sin validar
     - Permite quedarse en el actual
     - Bloquea saltar hacia adelante — forzar uso del botón "Continuar" */
  function tryGoStep(s){
    // Si el paso 4 está oculto (no hay bono), no permitir saltar a él.
    if(s === 4 && !hasBonoIncentive()) return;
    if(s <= currentStep){ goStep(s); return; }
    if(!validateStep(currentStep)) return;
    if(s === currentStep + 1){ currentStep = s; renderStep(); }
    // más de un paso adelante: bloqueado, solo secuencial
  }

  function nextStep(){
    if(!validateStep(currentStep)) return;
    const lastStep = totalStepsNow();
    if(currentStep < lastStep){ currentStep++; renderStep(); }
    else activateProgram();
  }
  function prevStep(){ if(currentStep > 1){ currentStep--; renderStep(); } }

  /* ══ Validation ══ */
  function validateStep(step){
    const pane = document.querySelector(`.wz-pane[data-pane="${step}"]`);
    if(!pane) return true;
    // Regla de negocio step-2: si el modo es "Varios tipos" se requieren
    // al menos 2 incentivos. Con solo 1 no hay razón para estar en multi —
    // el usuario debería volver a "Un solo tipo". Se bloquea Continuar y
    // se orienta con toast caution.
    if(step === 2 && incTypesMode === 'multi'){
      const cards = pane.querySelectorAll('.wz-inc-card');
      if(cards.length < 2){
        // Flash del hint + shake del botón "Agregar otro tipo" — sin toast,
        // el mensaje caution inline ya comunica el requisito.
        const hint = document.getElementById('wzTypesHint');
        if(hint){
          hint.classList.remove('wz-flash-caution');
          void hint.offsetWidth;
          hint.classList.add('wz-flash-caution');
          setTimeout(() => hint.classList.remove('wz-flash-caution'), 1200);
        }
        const addBtn = document.getElementById('wzAddInc');
        if(addBtn){
          addBtn.classList.remove('wz-shake');
          void addBtn.offsetWidth;
          addBtn.classList.add('wz-shake');
          setTimeout(() => addBtn.classList.remove('wz-shake'), 500);
        }
        return false;
      }
    }
    let ok = true;
    let firstInvalid = null;
    // Recolectar campos required: siempre los `data-wz-required` y, sólo en multi
    // mode (paso 2), también los `data-wz-required-multi`.
    const reqFields = [...pane.querySelectorAll('[data-wz-required]')];
    if(step === 2 && incTypesMode === 'multi'){
      reqFields.push(...pane.querySelectorAll('[data-wz-required-multi]'));
    }
    reqFields.forEach(field => {
      const input = field.querySelector('input, textarea');
      const isDropdown = field.classList.contains('naowee-dropdown');
      const isTagMulti = field.classList.contains('wz-tag-multi');
      let val;
      if(isTagMulti){
        val = (field.dataset.wzValue || '').trim();
      } else if(isDropdown){
        val = (field.querySelector('.naowee-dropdown__value')?.textContent || '').trim();
      } else {
        val = (input?.value || '').trim();
      }
      const isEmpty = !val || val === '0' || val === '$';
      if(isEmpty){
        ok = false;
        markError(field);
        if(!firstInvalid) firstInvalid = field;
      }else{
        clearError(field);
      }
    });
    // Paso 2 modo multi: validar que la sumatoria de rubros per-card == rubro total.
    if(step === 2 && incTypesMode === 'multi' && ok){
      const total = parseMoney(document.getElementById('wzRubroTotal'));
      const cards = [...pane.querySelectorAll('.wz-inc-card')];
      const sum = cards.reduce((acc, c) => acc + parseMoney(c.querySelector('.wz-inc-card__rubro input')), 0);
      if(total && sum !== total){
        ok = false;
        updateRubroAllocation();
        const bx = document.getElementById('wzMultiBudget');
        if(bx && !firstInvalid) firstInvalid = bx;
        // Shake del bloque para llamar la atención
        if(bx){
          bx.classList.remove('wz-shake');
          void bx.offsetWidth;
          bx.classList.add('wz-shake');
          setTimeout(() => bx.classList.remove('wz-shake'), 500);
        }
      }
    }
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
    const isTagMulti = field.classList.contains('wz-tag-multi');
    if(isTagMulti){
      field.classList.add('wz-tag-multi--error');
    } else if(isDropdown){
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
    field.classList.remove('wz-tag-multi--error');
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
    resetWizardForm();
    document.getElementById('wzOverlay').classList.add('open');
    currentStep = 1;
    isDirty = false;
    renderStep();
    requestAnimationFrame(() => setTimeout(refreshSegmentPills, 50));
  }

  /* Abre el wizard con los datos del programa pre-cargados (modo edición). */
  function openWizardForEdit(programId){
    if(!isMounted){
      pendingOpen = true;
      mount().then(() => { if(pendingOpen){ pendingOpen = false; openWizardForEdit(programId); } });
      return;
    }
    const prog = (window.PROGRAMS_DATA || []).find(p => p.id === programId);
    if(!prog){ openWizard(); return; }
    resetWizardForm();
    populateWizardFromProgram(prog);
    document.getElementById('wzOverlay').classList.add('open');
    currentStep = 1;
    isDirty = false;
    renderStep();
    requestAnimationFrame(() => setTimeout(refreshSegmentPills, 50));
  }

  /* Reset del formulario completo del wizard a su estado inicial. */
  function resetWizardForm(){
    // Step 1
    const fName = document.getElementById('fName');
    if(fName) fName.value = '';
    const desc = document.querySelector('.wz-pane[data-pane="1"] .naowee-textfield--textarea textarea');
    if(desc) desc.value = '';
    document.querySelectorAll('.wz-pane[data-pane="1"] [data-wz-datepicker] input').forEach(i => { i.value = ''; });
    const cobField = document.querySelector('[data-wz-name="cobertura"]');
    if(cobField){
      cobField.dataset.wzValue = '';
      const chips = cobField.querySelector('[data-chips]');
      if(chips) chips.innerHTML = '<span class="wz-tag-multi__placeholder">Selecciona departamentos o nacional</span>';
      cobField.querySelectorAll('.wz-tag-multi__option.is-selected').forEach(o => o.classList.remove('is-selected'));
    }
    // Step 2
    const rt = document.getElementById('wzRubroTotal');
    if(rt) rt.value = '';
    const list = document.getElementById('wzIncList');
    if(list){
      // Mantener sólo la primera card y limpiarla
      [...list.querySelectorAll('.wz-inc-card')].slice(1).forEach(c => c.remove());
      const first = list.querySelector('.wz-inc-card');
      if(first){
        first.querySelectorAll('input').forEach(i => { i.value = ''; });
        const dd = first.querySelector('[data-wz-name="categoria"]');
        if(dd){
          dd.dataset.wzValue = '';
          const valEl = dd.querySelector('.naowee-dropdown__value');
          if(valEl){ valEl.textContent = ''; valEl.style.display = 'none'; }
          const ph = dd.querySelector('.naowee-dropdown__placeholder');
          if(ph) ph.style.display = '';
          dd.querySelectorAll('.naowee-dropdown__option--selected').forEach(o => o.classList.remove('naowee-dropdown__option--selected'));
        }
      }
    }
    incCounter = 1;
    // Resetear modo a single
    const singleCard = document.querySelector('.toggle-card[data-val="single"]');
    if(singleCard) setIncTypesMode(singleCard, 'single');
    // Step 3 — paneles se regeneran al entrar al paso 3
    const condPanels = document.getElementById('wzCondPanels');
    if(condPanels){ condPanels.innerHTML = ''; condPanels.dataset.wzKey = ''; }
    // Step 4 — limpiar archivo y filas manuales
    resetWzFile && resetWzFile();
    const manualRows = document.getElementById('wzManualRows');
    if(manualRows) manualRows.innerHTML = '';
    seedManualRows();
    // Anexos del paso 1
    if(typeof resetAnexos === 'function') resetAnexos();
  }

  /* Pre-llena el formulario con los valores de un programa existente. */
  function populateWizardFromProgram(p){
    // === Step 1 ===
    const fName = document.getElementById('fName');
    if(fName) fName.value = p.name || '';
    const desc = document.querySelector('.wz-pane[data-pane="1"] .naowee-textfield--textarea textarea');
    if(desc) desc.value = p.longDesc || p.shortDesc || '';
    const fromInput = document.querySelector('[data-wz-range="from"][data-wz-range-name="vigencia"] input');
    const toInput   = document.querySelector('[data-wz-range="to"][data-wz-range-name="vigencia"] input');
    if(fromInput && p.from && p.from !== '—') fromInput.value = p.from;
    if(toInput && p.to && p.to !== '—') toInput.value = p.to;

    // === Step 2 ===
    const rt = document.getElementById('wzRubroTotal');
    if(rt && p.rubro){
      rt.value = Number(p.rubro).toLocaleString('es-CO');
    }
    const incs = Array.isArray(p.incentives) ? p.incentives : [];
    const isMulti = incs.length > 1;
    if(isMulti){
      const multiCard = document.querySelector('.toggle-card[data-val="multi"]');
      if(multiCard) setIncTypesMode(multiCard, 'multi');
      // setIncTypesMode con 'multi' agrega una segunda card si solo hay 1.
      // Asegurar que haya el número correcto de cards.
      const list = document.getElementById('wzIncList');
      while(list && list.querySelectorAll('.wz-inc-card').length < incs.length) addIncentive();
    }
    const cards = [...document.querySelectorAll('.wz-pane[data-pane="2"] .wz-inc-card')];
    incs.forEach((inc, idx) => {
      const card = cards[idx];
      if(!card) return;
      const nameInput = card.querySelector('input[type="text"]');
      if(nameInput) nameInput.value = inc.name || '';
      // Categoría: setear wzValue y replicar el visual del dropdown
      const dd = card.querySelector('[data-wz-name="categoria"]');
      const catKey = String(inc.category || '').toLowerCase();
      if(dd && catKey){
        const opt = dd.querySelector(`.naowee-dropdown__option[data-val="${catKey}"]`);
        if(opt){
          dd.querySelectorAll('.naowee-dropdown__option--selected').forEach(o => o.classList.remove('naowee-dropdown__option--selected'));
          opt.classList.add('naowee-dropdown__option--selected');
          dd.dataset.wzValue = catKey;
          const trigger = dd.querySelector('.naowee-dropdown__trigger');
          let valEl = dd.querySelector('.naowee-dropdown__value');
          if(!valEl && trigger){
            valEl = document.createElement('span');
            valEl.className = 'naowee-dropdown__value';
            trigger.insertBefore(valEl, trigger.firstChild);
          }
          if(valEl){ valEl.textContent = opt.textContent.trim(); valEl.style.display = ''; }
          const ph = dd.querySelector('.naowee-dropdown__placeholder');
          if(ph) ph.style.display = 'none';
        }
      }
      // Rubro per-card (sólo en multi visualmente)
      const rubroInput = card.querySelector('.wz-inc-card__rubro input');
      if(rubroInput && inc.detail){
        const m = String(inc.detail).match(/[\d.,]+/);
        // No siempre hay rubro; saltamos si no se puede inferir
      }
      // Valor unitario
      const unitInput = card.querySelector('.wz-inc-card__unit input');
      if(unitInput && inc.value) unitInput.value = Number(inc.value).toLocaleString('es-CO');
    });
    refreshIncCardHints();
    updateRubroAllocation();

    // === Step 4 — modo de códigos manuales si existen ===
    if(Array.isArray(p.manualCodes) && p.manualCodes.length){
      const seg = document.querySelector('[data-wz-name="codes-mode"]');
      if(seg){
        const manualBtn = seg.querySelector('[data-val="manual"]');
        if(manualBtn) manualBtn.click();
      }
      const rowsEl = document.getElementById('wzManualRows');
      if(rowsEl){
        rowsEl.innerHTML = '';
        p.manualCodes.forEach((code, i) => {
          const row = makeManualRow(i + 1);
          const inp = row.querySelector('.manual-row__code input');
          if(inp) inp.value = code;
          rowsEl.appendChild(row);
        });
        upgradeDropdowns();
        wireInputMasks();
      }
    }
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
    persistDraft();
    document.getElementById('wzWarnCloseOverlay')?.classList.remove('open');
    isDirty = false;
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

  /* ══ Tag-multi (dropdown multi-select con chips + botón Agregar)
     Pattern portado del escenario-08 (reg-multi). Diferente del naowee-dropdown:
     los cambios quedan en temp hasta click en "Agregar". Al confirmar, renderiza
     chips inline en el trigger. ══ */
  function upgradeTagMultis(){
    document.querySelectorAll('[data-wz-tag-multi]').forEach(field => {
      if(field.dataset.wzWired) return;
      field.dataset.wzWired = '1';
      const trigger = field.querySelector('.wz-tag-multi__trigger');
      const menu = field.querySelector('.wz-tag-multi__menu');
      const chipsEl = field.querySelector('[data-chips]');
      const optionsEl = field.querySelector('[data-options]');
      const confirmBtn = field.querySelector('[data-confirm]');
      const allOptions = [...optionsEl.querySelectorAll('.wz-tag-multi__option')];
      const placeholderHtml = chipsEl.innerHTML; // backup del placeholder
      let tempVals = [];     // selección en curso (menu abierto)
      let confirmedVals = []; // selección aplicada (trigger)

      function renderChips(){
        if(confirmedVals.length === 0){
          chipsEl.innerHTML = placeholderHtml;
          field.dataset.wzValue = '';
          return;
        }
        const byVal = Object.fromEntries(
          allOptions.map(o => [o.dataset.val, o.dataset.label])
        );
        const visible = confirmedVals.slice(0, 2);
        const extra = confirmedVals.length - visible.length;
        // Usa el componente .naowee-tag del Design System con tag--accent
        const parts = visible.map(v => {
          const lbl = byVal[v] || v;
          return `
            <span class="naowee-tag naowee-tag--small naowee-tag--accent">
              ${lbl}
              <span class="naowee-tag__active-area" data-remove="${v}" role="button" aria-label="Quitar ${lbl}">
                <span class="naowee-tag__close">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </span>
              </span>
            </span>`;
        });
        if(extra > 0){
          parts.push(`<span class="naowee-tag naowee-tag--small naowee-tag--accent">+${extra}</span>`);
        }
        chipsEl.innerHTML = parts.join('');
        field.dataset.wzValue = confirmedVals.join(',');
        // Wire remove
        chipsEl.querySelectorAll('[data-remove]').forEach(x => {
          x.addEventListener('click', e => {
            e.stopPropagation();
            e.preventDefault();
            const v = x.dataset.remove;
            confirmedVals = confirmedVals.filter(c => c !== v);
            tempVals = [...confirmedVals];
            renderChips();
            renderOptionsState();
            clearTagMultiError(field);
          });
        });
      }

      function renderOptionsState(){
        // Si una opción exclusiva (ej. "Nacional") está en tempVals, las demás
        // se deshabilitan visual y funcionalmente — no tiene sentido combinar
        // "Nacional" con un departamento específico.
        const exclusiveSel = allOptions.find(o => o.dataset.exclusive === 'true' && tempVals.includes(o.dataset.val));
        allOptions.forEach(opt => {
          const isExcl = opt.dataset.exclusive === 'true';
          opt.classList.toggle('is-selected', tempVals.includes(opt.dataset.val));
          opt.classList.toggle('is-disabled', !!exclusiveSel && !isExcl);
          opt.setAttribute('aria-disabled', !!exclusiveSel && !isExcl ? 'true' : 'false');
        });
      }

      allOptions.forEach(opt => {
        opt.addEventListener('click', e => {
          e.stopPropagation();
          const v = opt.dataset.val;
          const isExcl = opt.dataset.exclusive === 'true';
          // Si hay una exclusiva activa y este opt no lo es → bloquear click.
          const exclusiveSel = allOptions.find(o => o.dataset.exclusive === 'true' && tempVals.includes(o.dataset.val));
          if(exclusiveSel && !isExcl) return;
          if(tempVals.includes(v)){
            tempVals = tempVals.filter(x => x !== v);
          } else if(isExcl){
            // Seleccionar exclusiva → reemplaza toda la selección por sólo ella.
            tempVals = [v];
          } else {
            tempVals = [...tempVals, v];
          }
          renderOptionsState();
        });
      });

      // Floating del menu: position:fixed + coords calculadas por JS para
      // escapar del overflow-scroll del modal. El menu queda dentro del
      // componente (no se mueve al body) — así no colapsa el layout.
      let isFloating = false;
      function floatMenu(){
        const rect = trigger.getBoundingClientRect();
        if(rect.width < 40) return; // trigger no rendered yet — no-op
        const vh = window.innerHeight;
        const spaceBelow = vh - rect.bottom;
        const spaceAbove = rect.top;
        const menuMaxH = 320;
        menu.classList.add('wz-tag-multi__menu--floating');
        menu.style.width = rect.width + 'px';
        menu.style.left = rect.left + 'px';
        if(spaceBelow >= menuMaxH + 8 || spaceBelow >= spaceAbove){
          menu.style.top = (rect.bottom + 4) + 'px';
          menu.style.bottom = 'auto';
        } else {
          menu.style.top = 'auto';
          menu.style.bottom = (vh - rect.top + 4) + 'px';
        }
        isFloating = true;
      }
      function unfloatMenu(){
        if(!isFloating) return;
        menu.classList.remove('wz-tag-multi__menu--floating');
        menu.style.width = menu.style.left = menu.style.top = menu.style.bottom = '';
        isFloating = false;
      }
      // Reposicionar en scroll/resize cuando el menu está flotando
      function reposition(){
        if(field.classList.contains('is-open') && isFloating) floatMenu();
      }
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);

      trigger.addEventListener('click', e => {
        e.stopPropagation();
        const wasOpen = field.classList.contains('is-open');
        // Cerrar otros dropdowns abiertos
        document.querySelectorAll('.wz-tag-multi.is-open').forEach(d => {
          if(d !== field){
            d.classList.remove('is-open');
            d.dispatchEvent(new CustomEvent('wz-tag-multi:close'));
          }
        });
        document.querySelectorAll('.naowee-dropdown--open').forEach(d => d.classList.remove('naowee-dropdown--open'));
        if(wasOpen){
          field.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
          unfloatMenu();
        } else {
          tempVals = [...confirmedVals];
          renderOptionsState();
          field.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
          floatMenu();
        }
      });
      field.addEventListener('wz-tag-multi:close', unfloatMenu);

      confirmBtn.addEventListener('click', e => {
        e.stopPropagation();
        confirmedVals = [...tempVals];
        renderChips();
        field.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        unfloatMenu();
        clearTagMultiError(field);
      });
    });
    // Click outside cierra todos (también si se clickea el menu que está
    // flotando en body: hay que ignorarlo).
    document.addEventListener('click', e => {
      if(e.target.closest('.wz-tag-multi') || e.target.closest('.wz-tag-multi__menu')) return;
      document.querySelectorAll('.wz-tag-multi.is-open').forEach(d => {
        d.classList.remove('is-open');
        d.dispatchEvent(new CustomEvent('wz-tag-multi:close'));
      });
    });
  }

  function clearTagMultiError(field){
    field.classList.remove('wz-tag-multi--error');
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

            // Si este es "from", validar que "to" no quede antes; si es así, limpiar
            // "to" y mostrar feedback visual (flash rojo + mensaje explicativo).
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
                  const helper = toField.querySelector('.wz-range-helper');
                  toField.classList.add('wz-flash-error');
                  if(helper){
                    helper.classList.add('is-error');
                    helper.textContent = 'Se limpió porque quedaba antes de la vigencia desde.';
                  }
                  setTimeout(() => {
                    toField.classList.remove('wz-flash-error');
                    if(helper){
                      helper.classList.remove('is-error');
                      helper.textContent = 'Debe ser posterior a la vigencia desde.';
                    }
                  }, 2800);
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
        // El pill está absolute con `left: 0`, que ancla en el PADDING-BOX
        // (justo dentro del border). Para alinearlo con el item hay que
        // restar sólo el border-width, NO el padding (el padding ya está
        // incluido en r.left vs pr.left, y `left: 0` no lo compensa).
        const borderLeft = parseFloat(getComputedStyle(seg).borderLeftWidth) || 0;
        const offset = r.left - pr.left - borderLeft;
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
    const rubro = document.getElementById('wzRubroTotal');
    if(rubro && !rubro.dataset.wzBudgetWired){
      rubro.dataset.wzBudgetWired = '1';
      rubro.addEventListener('input', () => { updateBudget(); updateRubroAllocation(); });
    }
    // Inputs de "Valor unitario" en cada wz-inc-card → recalcular budget al cambiar.
    document.querySelectorAll('.wz-pane[data-pane="2"] .wz-inc-card__unit input').forEach(el => {
      if(el.dataset.wzBudgetWired) return;
      el.dataset.wzBudgetWired = '1';
      el.addEventListener('input', updateBudget);
    });
    wireRubroAllocationInputs();
  }

  /* Wires inputs de rubro per-card → recalcula la asignación en vivo (sólo en multi). */
  function wireRubroAllocationInputs(){
    document.querySelectorAll('.wz-pane[data-pane="2"] .wz-inc-card__rubro input').forEach(el => {
      if(el.dataset.wzAllocWired) return;
      el.dataset.wzAllocWired = '1';
      el.addEventListener('input', updateRubroAllocation);
    });
  }

  /* Renderiza/actualiza el resumen de asignación de rubro (paso 2, modo multi).
     Compara rubro total vs sumatoria de rubros per-card y muestra mensaje DS:
     - positive si exacto
     - informative si falta por asignar
     - negative si excede el total */
  function updateRubroAllocation(){
    const bx = document.getElementById('wzMultiBudget');
    if(!bx) return;
    if(incTypesMode !== 'multi'){
      bx.hidden = true; bx.innerHTML = '';
      return;
    }
    const total = parseMoney(document.getElementById('wzRubroTotal'));
    const cards = [...document.querySelectorAll('.wz-pane[data-pane="2"] .wz-inc-card')];
    const sum = cards.reduce((acc, c) => acc + parseMoney(c.querySelector('.wz-inc-card__rubro input')), 0);
    if(!total){
      bx.hidden = true; bx.innerHTML = '';
      return;
    }
    const fmt = n => `$${n.toLocaleString('es-CO')}`;
    const remaining = total - sum;
    let variant, iconSvg, text;
    if(sum > total){
      variant = 'negative';
      iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      text = `La sumatoria de rubros (<strong>${fmt(sum)}</strong>) excede el rubro total del programa (<strong>${fmt(total)}</strong>) por <strong>${fmt(sum - total)}</strong>.`;
    } else if(sum === total){
      variant = 'positive';
      iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      text = `Rubro asignado al 100% — <strong>${fmt(sum)}</strong> distribuido entre ${cards.length} incentivos.`;
    } else {
      variant = 'informative';
      iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;
      text = `Rubro asignado: <strong>${fmt(sum)}</strong> de <strong>${fmt(total)}</strong>. Restante por asignar: <strong>${fmt(remaining)}</strong>.`;
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
    row.className = 'manual-row manual-row--code-only';
    row.innerHTML = `
      <div class="naowee-textfield manual-row__code">
        <div class="naowee-textfield__input-wrap">
          <input class="naowee-textfield__input" type="text" placeholder="2026BON-${String(defaultIdx || 1).padStart(5, '0')}"/>
        </div>
      </div>
      <button type="button" class="x-btn" onclick="removeManualRow(this)" aria-label="Eliminar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
    return row;
  }

  /* La primera condición ahora se siembra dentro de renderCondPanels(),
     que se encarga de generar los paneles del paso 3 al entrar a ese paso. */
  function seedFirstCondition(){ /* no-op — manejado por renderCondPanels */ }

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

  // Iconos en estilo DS: mismo patrón del info (AlertCircle), swap de
  // path interno — círculo con "i" vs. círculo con "!".
  const TYPES_HINT_ICONS = {
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };

  function setIncTypesMode(el, mode){
    incTypesMode = mode;
    el.parentElement.querySelectorAll('.toggle-card').forEach(c => {
      c.classList.remove('active');
      const r = c.querySelector('.naowee-radio');
      if(r) r.classList.remove('naowee-radio--selected');
    });
    el.classList.add('active');
    const elRadio = el.querySelector('.naowee-radio');
    if(elRadio) elRadio.classList.add('naowee-radio--selected');
    // El botón "Agregar otro tipo" sólo tiene sentido en modo multi.
    const addBtn = document.getElementById('wzAddInc');
    if(addBtn) addBtn.hidden = (mode !== 'multi');
    // Hint contextual — swap variante DS (informative ↔ caution), icono y texto.
    const hint = document.getElementById('wzTypesHint');
    const hintIcon = document.getElementById('wzTypesHintIcon');
    const hintText = document.getElementById('wzTypesHintText');
    if(hint){
      hint.classList.toggle('naowee-message--informative', mode === 'single');
      hint.classList.toggle('naowee-message--caution', mode === 'multi');
    }
    if(hintIcon){
      hintIcon.innerHTML = mode === 'multi' ? TYPES_HINT_ICONS.warn : TYPES_HINT_ICONS.info;
    }
    if(hintText){
      hintText.innerHTML = mode === 'multi'
        ? 'En modo <strong>Varios tipos</strong> debes agregar al menos <strong>2 incentivos</strong>. Usa el botón <em>Agregar otro tipo de incentivo</em> para sumar categorías.'
        : 'Todo el rubro se destinará a este único tipo de incentivo. Si necesitas más de uno, cambia a <strong>Varios tipos</strong>.';
    }
    // Toggle clase en la lista → CSS oculta badge/remove en single
    const list = document.getElementById('wzIncList');
    if(list){
      list.classList.toggle('wz-inc-list--single', mode === 'single');
      list.classList.toggle('wz-inc-list--multi', mode === 'multi');
      // Si cambió a single: dejar sólo la primera tarjeta
      if(mode === 'single'){
        [...list.querySelectorAll('.wz-inc-card')].slice(1).forEach(c => c.remove());
        incCounter = 1;
      } else if(mode === 'multi'){
        // Multi requiere mínimo 2 incentivos: si sólo hay 1, agregar el segundo
        // automáticamente — sin él no tendría sentido elegir "Varios tipos".
        const cards = list.querySelectorAll('.wz-inc-card');
        if(cards.length < 2) addIncentive();
      }
    }
    // Cambiar de modo puede alterar la composición de incentivos → re-evaluar paso 4.
    refreshIncCardHints();
    updateRubroAllocation();
    renderStep();
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
        <span class="wz-inc-card__badge naowee-badge naowee-badge--neutral naowee-badge--quiet naowee-badge--small">Incentivo #${idx}</span>
        <button type="button" class="wz-inc-card__remove" onclick="removeIncentive(this)" aria-label="Eliminar incentivo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="wz-grid wz-inc-card__grid">
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
        <div class="naowee-textfield wz-inc-card__rubro" data-wz-required-multi data-wz-name="rubro">
          <label class="naowee-textfield__label naowee-textfield__label--required">Rubro del incentivo (COP)</label>
          <div class="naowee-textfield__input-wrap">
            <span class="naowee-textfield__prefix" style="padding:0 10px;color:var(--naowee-color-text-secondary)">$</span>
            <input class="naowee-textfield__input" type="text" inputmode="numeric" placeholder="0" data-wz-input="money"/>
          </div>
        </div>
        <div class="naowee-textfield wz-inc-card__unit" data-wz-name="unitario">
          <label class="naowee-textfield__label">Valor unitario <span class="wz-inc-card__optional">(opcional)</span></label>
          <div class="naowee-textfield__input-wrap">
            <span class="naowee-textfield__prefix" style="padding:0 10px;color:var(--naowee-color-text-secondary)">$</span>
            <input class="naowee-textfield__input" type="text" inputmode="numeric" placeholder="0" data-wz-input="money"/>
          </div>
          <div class="naowee-helper"><div class="naowee-helper__text wz-inc-card__unit-hint">Monto por beneficiario.</div></div>
        </div>
      </div>`;
    list.appendChild(card);
    upgradeDropdowns();
    wireInputMasks();
    wireRubroAllocationInputs();
    refreshIncCardHints();
    const firstInput = card.querySelector('input');
    if(firstInput) firstInput.focus();
  }

  /* Cuando un incentivo cambia de categoría (especialmente a/desde "bono"),
     actualizamos:
     1) la visibilidad del paso 4 en el stepper
     2) el label del CTA (Continuar vs Activar) si estamos en el último paso
     3) el helper del Valor unitario (texto explica si genera códigos o no) */
  function onCategoriaChange(){
    refreshIncCardHints();
    renderStep();
  }
  /* Delegado a nivel document — un solo listener para todo el ciclo de vida del wizard. */
  let categoriaWatcherWired = false;
  function wireCategoriaWatcher(){
    if(categoriaWatcherWired) return;
    categoriaWatcherWired = true;
    document.addEventListener('click', e => {
      const opt = e.target.closest('.naowee-dropdown__option');
      if(!opt) return;
      const dd = opt.closest('[data-wz-name="categoria"]');
      if(!dd) return;
      // El handler de upgradeDropdowns corre primero (mismo bubbling) y setea
      // dd.dataset.wzValue. Esperamos al siguiente tick para leerlo ya actualizado.
      setTimeout(onCategoriaChange, 0);
    }, true);
  }

  function refreshIncCardHints(){
    document.querySelectorAll('.wz-pane[data-pane="2"] .wz-inc-card').forEach(card => {
      const cat = (card.querySelector('[data-wz-name="categoria"]')?.dataset?.wzValue || '').toLowerCase();
      const hint = card.querySelector('.wz-inc-card__unit-hint');
      if(!hint) return;
      hint.textContent = cat === 'bono'
        ? 'Valor por código generado.'
        : 'Monto por beneficiario.';
    });
  }

  function removeIncentive(btn){
    const card = btn.closest('.wz-inc-card');
    if(!card) return;
    const list = document.getElementById('wzIncList');
    if(list && list.children.length <= 1) return; // siempre al menos uno
    card.remove();
    onCategoriaChange();
    updateRubroAllocation();
  }

  /* ══ Step-3 — condiciones dinámicas (Edad, Género, Categoría, Logros, Tipo de usuario) ══
     `multi: true` habilita selección múltiple en el dropdown de valor. Para esos
     campos los operadores son ∈ (in) y ∉ (nin) — encajan con un set de valores. */
  const COND_FIELDS = {
    edad:        { label: 'Edad',                operators: [['gte','≥'],['lte','≤'],['eq','='],['neq','≠']], valueType: 'number', placeholder: 'Años' },
    genero:      { label: 'Género',              operators: [['eq','='],['neq','≠']],                         valueType: 'select',  options: [['masculino','Masculino'],['femenino','Femenino'],['otro','Otro']] },
    categoria:   { label: 'Categoría deportiva', operators: [['in','∈'],['nin','∉']],                         valueType: 'select',  multi: true, options: [['infantil','Infantil'],['prejuvenil','Pre-juvenil'],['juvenil','Juvenil'],['junior','Junior'],['sub23','Sub-23'],['mayores','Mayores'],['master','Máster']] },
    logros:      { label: 'Logros',              operators: [['in','∈'],['nin','∉']],                         valueType: 'select',  multi: true, options: [['oro','Medalla de oro'],['plata','Medalla de plata'],['bronce','Medalla de bronce'],['top10','Top 10'],['participacion','Participación']] },
    tipoUsuario: { label: 'Tipo de usuario',     operators: [['in','∈'],['nin','∉']],                         valueType: 'select',  multi: true, options: [['deportista','Deportista'],['personal_apoyo','Personal de apoyo'],['entrenador','Entrenador'],['tecnico','Técnico'],['medico','Médico'],['fisioterapeuta','Fisioterapeuta'],['arbitro','Árbitro / Juez'],['delegado','Delegado'],['ciudadano','Ciudadano']] }
  };

  /* Reglas implícitas que se activan cuando una condición toma cierto valor.
     Se muestran como sub-condición auto-añadida (chip naowee-tag) bajo la fila,
     y se incluyen en la vista previa en lenguaje natural. */
  const COND_IMPLIED = {
    'tipoUsuario:personal_apoyo': 'Debe ser el primer entrenador en su historial.'
  };
  function getImpliedRule(fieldKey, value){
    return COND_IMPLIED[`${fieldKey}:${value}`] || null;
  }

  let condRowCounter = 0;
  let condGroupCounter = 0;

  function addConditionGroup(btn){
    // El botón vive dentro de un .wz-cond-panel — ese panel tiene su propio builder.
    // Si no se pasa botón (llamada interna desde seedFirstCondition), usamos el
    // primer panel que se encuentre.
    const panel = btn && btn.closest ? btn.closest('.wz-cond-panel') : document.querySelector('.wz-cond-panel');
    if(!panel) return;
    const builder = panel.querySelector('.cond-builder');
    if(!builder) return;
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
        <span class="cond-group__badge">Grupo ${groupNum} · Y</span>
      </div>
      <div class="cond-rows"></div>
      <button type="button" class="naowee-btn naowee-btn--mute naowee-btn--small wz-add-cond" onclick="addConditionRow(this)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Añadir condición
      </button>`;
    builder.appendChild(group);
    addConditionRow(group.querySelector('.add-cond'));
    renumberCondGroups(panel);
  }

  function removeConditionGroup(btn){
    const group = btn.closest('.cond-group');
    if(!group) return;
    const panel = group.closest('.wz-cond-panel');
    const prev = group.previousElementSibling;
    const next = group.nextElementSibling;
    if(prev && prev.classList.contains('cond-or-divider')) prev.remove();
    else if(next && next.classList.contains('cond-or-divider')) next.remove();
    group.remove();
    if(panel) renumberCondGroups(panel);
    refreshCondPreview();
  }

  function renumberCondGroups(panel){
    if(!panel){
      document.querySelectorAll('.wz-cond-panel').forEach(p => renumberCondGroups(p));
      return;
    }
    const groups = panel.querySelectorAll('.cond-group');
    groups.forEach((g, i) => {
      const badge = g.querySelector('.cond-group__badge');
      if(badge) badge.textContent = `Grupo ${i + 1} · Y`;
    });
  }

  /* Construye los paneles del paso 3 — uno por incentivo en multi mode,
     uno solo en single mode. Detecta cambios en la lista de incentivos
     comparando una clave; si cambia, regenera todo (los rules anteriores se
     pierden — comportamiento aceptable para demo). */
  function renderCondPanels(){
    const container = document.getElementById('wzCondPanels');
    const sub = document.getElementById('wzCondSub');
    if(!container) return;
    const cards = [...document.querySelectorAll('.wz-pane[data-pane="2"] .wz-inc-card')];
    const isMulti = incTypesMode === 'multi' && cards.length > 1;
    const meta = cards.map((c, i) => {
      const name = (c.querySelector('input[type="text"]')?.value || '').trim() || `Incentivo #${i+1}`;
      const catKey = (c.querySelector('[data-wz-name="categoria"]')?.dataset?.wzValue || '').toLowerCase();
      const catLbl = c.querySelector('[data-wz-name="categoria"] .naowee-dropdown__value')?.textContent?.trim() || '—';
      return { idx: i, name, catKey, catLbl };
    });
    const expectedKey = (isMulti ? 'multi' : 'single') + ':' + meta.map(m => `${m.idx}|${m.name}|${m.catKey}`).join('//');
    if(container.dataset.wzKey === expectedKey) return; // no hay cambios
    container.dataset.wzKey = expectedKey;

    if(sub){
      sub.innerHTML = isMulti
        ? 'Define condiciones <strong>por cada tipo de incentivo</strong>. Dentro de un grupo todas las condiciones se cumplen simultáneamente (<strong>Y</strong>). Agrega otro grupo si aceptas reglas alternativas (<strong>O</strong> entre grupos).'
        : 'Dentro de un grupo todas las condiciones se cumplen simultáneamente (<strong>Y</strong>). Agrega otro grupo si aceptas reglas alternativas (<strong>O</strong> entre grupos).';
    }

    if(!isMulti){
      container.innerHTML = `
        <div class="wz-cond-panel" data-inc-idx="0">
          <div class="cond-builder"></div>
          <button type="button" class="naowee-btn naowee-btn--quiet naowee-btn--small wz-add-group" onclick="addConditionGroup(this)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Añadir grupo alternativo (O)
          </button>
          <div class="wz-cond-preview" data-empty="true">
            <div class="wz-cond-preview__head">
              <div class="wz-cond-preview__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                <div class="wz-cond-preview__title">Así se leerá la regla</div>
                <div class="wz-cond-preview__sub">Vista previa en vivo — lenguaje natural</div>
              </div>
            </div>
            <div class="wz-cond-preview__body"><em>Agrega al menos una condición para ver la vista previa.</em></div>
          </div>
        </div>`;
    } else {
      container.innerHTML = meta.map(m => `
        <div class="wz-cond-panel" data-inc-idx="${m.idx}">
          <div class="wz-cond-panel__head">
            <span class="wz-cond-panel__num">#${m.idx + 1}</span>
            <span class="wz-cond-panel__title">${escapeHtml(m.name)}</span>
            <span class="naowee-badge naowee-badge--neutral naowee-badge--quiet naowee-badge--small">${escapeHtml(m.catLbl)}</span>
          </div>
          <div class="cond-builder"></div>
          <button type="button" class="naowee-btn naowee-btn--quiet naowee-btn--small wz-add-group" onclick="addConditionGroup(this)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Añadir grupo alternativo (O)
          </button>
          <div class="wz-cond-preview" data-empty="true">
            <div class="wz-cond-preview__head">
              <div class="wz-cond-preview__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                <div class="wz-cond-preview__title">Así se leerá la regla — ${escapeHtml(m.name)}</div>
                <div class="wz-cond-preview__sub">Vista previa en vivo — lenguaje natural</div>
              </div>
            </div>
            <div class="wz-cond-preview__body"><em>Agrega al menos una condición para ver la vista previa.</em></div>
          </div>
        </div>
      `).join('');
    }
    // Sembrar primera condición de cada panel
    container.querySelectorAll('.wz-cond-panel').forEach(p => {
      const addBtn = p.querySelector('.wz-add-group');
      if(addBtn) addConditionGroup(addBtn);
    });
  }

  function addConditionRow(btnOrNothing){
    // Resolver el grupo: si viene del botón, usa ese grupo; si no, el último grupo
    // del primer panel disponible.
    let group;
    if(btnOrNothing && btnOrNothing.closest){
      group = btnOrNothing.closest('.cond-group');
    }else{
      const groups = document.querySelectorAll('.wz-cond-panel .cond-group');
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
      const multiAttr = def.multi ? 'data-wz-multi' : '';
      const placeholder = def.multi ? 'Selecciona uno o varios…' : 'Selecciona…';
      valSpan.innerHTML = `
        <div class="naowee-dropdown cond-val" data-wz-dropdown data-cond-val ${multiAttr}>
          <div class="naowee-dropdown__trigger" tabindex="0">
            <span class="naowee-dropdown__placeholder">${placeholder}</span>
            <div class="naowee-dropdown__controls">
              <span class="naowee-dropdown__chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></span>
            </div>
          </div>
          <div class="naowee-dropdown__menu" role="listbox">
            ${def.options.map(([v, lbl]) => `<div class="naowee-dropdown__option" data-val="${v}">${lbl}</div>`).join('')}
          </div>
        </div>`;
      upgradeDropdowns();
      // En modo multi el handler nativo (upgradeDropdowns) ya actualiza
      // dd.dataset.wzValue (csv). Sólo necesitamos refrescar preview e implied.
      valSpan.querySelectorAll('.naowee-dropdown__option').forEach(opt => {
        opt.addEventListener('click', () => {
          if(!def.multi){
            valSpan.querySelector('.cond-val').dataset.val = opt.dataset.val;
          }
          refreshImpliedRule(row);
          refreshCondPreview();
        });
      });
    }
    refreshImpliedRule(row);
    refreshCondPreview();
  }

  /* Renderiza/actualiza el chip "regla implícita" asociado a la fila.
     Soporta multi: si "personal_apoyo" está dentro de la selección, dispara la regla. */
  function refreshImpliedRule(row){
    if(!row) return;
    const fieldKey = row.querySelector('[data-cond-field]')?.dataset?.val || '';
    const valEl = row.querySelector('[data-cond-val]');
    const values = [];
    if(valEl){
      if(valEl.classList.contains('naowee-input-stepper')){
        values.push(valEl.querySelector('input')?.value || '');
      } else if(valEl.classList.contains('naowee-dropdown')){
        const isMulti = valEl.hasAttribute('data-wz-multi');
        if(isMulti){
          (valEl.dataset.wzValue || '').split(',').filter(Boolean).forEach(v => values.push(v));
        } else {
          values.push(valEl.dataset.val || '');
        }
      }
    }
    const text = values.map(v => getImpliedRule(fieldKey, v)).find(Boolean) || null;
    let chip = row.querySelector('.cond-row__implied');
    if(!text){
      if(chip) chip.remove();
      return;
    }
    if(!chip){
      chip = document.createElement('div');
      chip.className = 'cond-row__implied';
      row.appendChild(chip);
    }
    chip.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      <span><strong>Regla implícita:</strong> ${text}</span>`;
  }

  /* Stepper DS helpers */
  function makeStepper({ min = 0, max = 120, value = 0, unit = '' } = {}){
    return `
      <div class="naowee-input-stepper" data-cond-val data-min="${min}" data-max="${max}">
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

  // Operadores en lenguaje natural español — para la vista previa
  const OP_NATURAL = {
    gte: 'es mayor o igual a',
    lte: 'es menor o igual a',
    eq:  'es',
    neq: 'no es',
    in:  'incluye',
    nin: 'no incluye'
  };

  function refreshCondPreview(){
    // Refresca cada panel del paso 3 — uno solo en single, varios en multi.
    document.querySelectorAll('.wz-cond-panel').forEach(panel => refreshPanelPreview(panel));
  }

  /* Une items con comas y "y" final — "a, b y c" */
  function joinWithAnd(arr){
    if(!arr || arr.length === 0) return '';
    if(arr.length === 1) return arr[0];
    if(arr.length === 2) return `${arr[0]} y ${arr[1]}`;
    return arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
  }
  /* Une items con comas y "o" final — "a, b o c" */
  function joinWithOr(arr){
    if(!arr || arr.length === 0) return '';
    if(arr.length === 1) return arr[0];
    if(arr.length === 2) return `${arr[0]} o ${arr[1]}`;
    return arr.slice(0, -1).join(', ') + ' o ' + arr[arr.length - 1];
  }

  /* Convierte una regla {fieldKey, opVal, valueLabels} en una frase natural.
     Si los valores están vacíos, devuelve un placeholder con "…". */
  function ruleToNaturalSentence(fieldKey, opVal, valueLabels){
    const hasValues = valueLabels.length > 0 && valueLabels.some(v => v && v !== '0');
    const dots = `<span class="wz-cond-preview__val wz-cond-preview__val--empty">…</span>`;
    const wrap = s => `<strong>${s}</strong>`;
    const list = valueLabels.map(v => v.toString().toLowerCase());
    const lower = (s) => (s || '').toLowerCase();

    if(fieldKey === 'edad'){
      const v = valueLabels[0];
      if(!hasValues) return `tiene ${dots} años`;
      if(opVal === 'gte') return `tiene al menos ${wrap(v)} años`;
      if(opVal === 'lte') return `tiene como máximo ${wrap(v)} años`;
      if(opVal === 'eq')  return `tiene exactamente ${wrap(v)} años`;
      if(opVal === 'neq') return `no tiene ${wrap(v)} años`;
    }
    if(fieldKey === 'genero'){
      if(!hasValues) return `es de género ${dots}`;
      if(opVal === 'eq')  return `es de género ${wrap(lower(valueLabels[0]))}`;
      if(opVal === 'neq') return `no es de género ${wrap(lower(valueLabels[0]))}`;
    }
    if(fieldKey === 'categoria'){
      if(!hasValues) return `compite en categoría ${dots}`;
      const labels = valueLabels.map(wrap);
      if(opVal === 'in')  return labels.length === 1 ? `compite en categoría ${labels[0]}` : `compite en alguna de las categorías ${joinWithOr(labels)}`;
      if(opVal === 'nin') return `no compite en ${labels.length === 1 ? `categoría ${labels[0]}` : joinWithOr(labels)}`;
    }
    if(fieldKey === 'logros'){
      if(!hasValues) return `ha obtenido ${dots}`;
      const labels = valueLabels.map(wrap);
      if(opVal === 'in')  return `ha obtenido ${joinWithOr(labels)}`;
      if(opVal === 'nin') return `no ha obtenido ${joinWithOr(labels)}`;
    }
    if(fieldKey === 'tipoUsuario'){
      if(!hasValues) return `es ${dots}`;
      const labels = valueLabels.map(v => wrap(lower(v)));
      if(opVal === 'in')  return `es ${joinWithOr(labels)}`;
      if(opVal === 'nin') return `no es ${joinWithOr(labels)}`;
    }
    // Fallback genérico
    return `${COND_FIELDS[fieldKey]?.label || fieldKey} ${opVal} ${valueLabels.length ? wrap(valueLabels.join(', ')) : dots}`;
  }

  /* Refresca el preview de un solo panel. */
  function refreshPanelPreview(panel){
    if(!panel) return;
    const pv   = panel.querySelector('.wz-cond-preview');
    const body = panel.querySelector('.wz-cond-preview__body');
    if(!pv || !body) return;
    const builder = panel.querySelector('.cond-builder');
    const groups = builder ? builder.querySelectorAll('.cond-group') : [];
    const emptyHTML = '<em>Agrega al menos una condición para ver la vista previa.</em>';

    if(!groups.length){
      pv.dataset.empty = 'true';
      body.innerHTML = emptyHTML;
      return;
    }

    const groupSentences = [];
    const impliedNotes = [];
    groups.forEach(g => {
      const rows = g.querySelectorAll('.cond-row');
      if(!rows.length) return;
      const ruleSentences = [];
      [...rows].forEach(r => {
        const fieldKey = r.querySelector('[data-cond-field]').dataset.val || 'edad';
        const def      = COND_FIELDS[fieldKey];
        const opVal    = r.querySelector('[data-cond-op]').dataset.val || def.operators[0][0];
        const valEl    = r.querySelector('[data-cond-val]');
        const valueLabels = [];
        const valueKeys = [];
        if(valEl){
          if(valEl.classList.contains('naowee-input-stepper')){
            const v = valEl.querySelector('input').value;
            if(v){ valueLabels.push(v); valueKeys.push(v); }
          } else if(valEl.classList.contains('naowee-dropdown')){
            const isMulti = valEl.hasAttribute('data-wz-multi');
            if(isMulti){
              const csv = (valEl.dataset.wzValue || '').split(',').filter(Boolean);
              csv.forEach(k => {
                valueKeys.push(k);
                const lbl = (def.options.find(o => o[0] === k) || [k, k])[1];
                valueLabels.push(lbl);
              });
            } else if(valEl.dataset.val){
              valueKeys.push(valEl.dataset.val);
              const lbl = valEl.querySelector('.naowee-dropdown__value')?.textContent || valEl.dataset.val;
              valueLabels.push(lbl);
            }
          }
        }
        ruleSentences.push(ruleToNaturalSentence(fieldKey, opVal, valueLabels));
        // Regla implícita asociada al valor (ej. tipoUsuario=personal_apoyo)
        const implied = valueKeys.map(k => getImpliedRule(fieldKey, k)).find(Boolean);
        if(implied) impliedNotes.push(implied);
      });
      if(ruleSentences.length) groupSentences.push(joinWithAnd(ruleSentences));
    });

    if(!groupSentences.length){
      pv.dataset.empty = 'true';
      body.innerHTML = emptyHTML;
      return;
    }

    pv.dataset.empty = 'false';
    let html;
    if(groupSentences.length === 1){
      html = `<p class="wz-cond-preview__sentence">El atleta es elegible si <span class="wz-cond-preview__chunk">${groupSentences[0]}</span>.</p>`;
    } else {
      const items = groupSentences.map(s => `<li><span class="wz-cond-preview__chunk">${s}</span></li>`).join('');
      html = `<p class="wz-cond-preview__intro">El atleta es elegible si cumple <strong>cualquiera</strong> de estas reglas:</p><ul class="wz-cond-preview__or-list">${items}</ul>`;
    }
    if(impliedNotes.length){
      const uniq = [...new Set(impliedNotes)];
      html += `<p class="wz-cond-preview__implied-note"><strong>Además:</strong> ${joinWithAnd(uniq)}</p>`;
    }
    body.innerHTML = html;
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

  /* ══ Step-1 — Resolución uploader (single file, ghost CTA, % spinner, DS tag) ══ */
  const ANEXOS_MAX_BYTES = 10 * 1024 * 1024;
  let anexosFile = null;
  let anexosUploadTimer = null;
  function wireAnexosUpload(){
    const field = document.getElementById('wzAnexosField');
    const btn = document.getElementById('wzAnexosBtn');
    const input = document.getElementById('wzAnexosInput');
    if(!field || !btn || !input || field.dataset.wzAnxWired) return;
    field.dataset.wzAnxWired = '1';
    btn.addEventListener('click', () => input.click());
    ['dragenter','dragover'].forEach(evt => field.addEventListener(evt, e => {
      e.preventDefault(); e.stopPropagation();
      const wrap = field.closest('.wz-fileinput');
      if(wrap && wrap.dataset.state === 'empty') field.classList.add('is-dragover');
    }));
    ['dragleave','drop'].forEach(evt => field.addEventListener(evt, e => {
      e.preventDefault(); e.stopPropagation(); field.classList.remove('is-dragover');
    }));
    field.addEventListener('drop', e => {
      const wrap = field.closest('.wz-fileinput');
      if(!wrap || wrap.dataset.state !== 'empty') return;
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if(f) startAnexoUpload(f);
    });
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      if(f) startAnexoUpload(f);
      input.value = '';
    });
  }
  function startAnexoUpload(f){
    const accept = ['pdf','doc','docx','jpg','jpeg','png'];
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if(!accept.includes(ext) || f.size > ANEXOS_MAX_BYTES) return;
    anexosFile = f;
    setAnexoState('uploading', 0);
    if(anexosUploadTimer) clearInterval(anexosUploadTimer);
    let pct = 0;
    anexosUploadTimer = setInterval(() => {
      pct = Math.min(100, pct + (6 + Math.random() * 10));
      setAnexoState('uploading', Math.round(pct));
      if(pct >= 100){
        clearInterval(anexosUploadTimer);
        anexosUploadTimer = null;
        setTimeout(() => setAnexoState('uploaded'), 220);
      }
    }, 120);
  }
  function removeAnexo(){
    if(anexosUploadTimer){ clearInterval(anexosUploadTimer); anexosUploadTimer = null; }
    anexosFile = null;
    setAnexoState('empty');
  }
  function setAnexoState(state, pct){
    const wrap = document.querySelector('.wz-fileinput');
    const slot = document.getElementById('wzAnexosSlot');
    const action = document.getElementById('wzAnexosAction');
    if(!wrap || !slot || !action) return;
    const prev = wrap.dataset.state;
    wrap.dataset.state = state;
    const fname = anexosFile ? anexosFile.name : '';

    if(state === 'empty'){
      slot.innerHTML = '<span class="wz-fileinput__placeholder">Sin archivo adjunto</span>';
      action.innerHTML = `
        <button type="button" class="naowee-btn naowee-btn--mute naowee-btn--small wz-fileinput__cta" id="wzAnexosBtn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          <span>Subir documento</span>
        </button>`;
      const newBtn = action.querySelector('#wzAnexosBtn');
      const input = document.getElementById('wzAnexosInput');
      if(newBtn && input) newBtn.addEventListener('click', () => input.click());
      return;
    }

    if(state === 'uploading'){
      const p = Math.max(0, Math.min(100, pct || 0));
      const dash = 100 - p;
      // Left slot: filename (plain, neutral). Mounted only when entering state.
      if(prev !== 'uploading'){
        slot.innerHTML = `
          <span class="wz-fileinput__pending" title="${escapeHtml(fname)}">
            <svg class="wz-fileinput__pending-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span class="wz-fileinput__pending-name">${escapeHtml(fname)}</span>
          </span>`;
        action.innerHTML = `
          <span class="wz-fileinput__progress" role="status" aria-live="polite" aria-label="Subiendo archivo">
            <svg class="wz-fileinput__ring" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <circle class="wz-fileinput__ring-track" cx="12" cy="12" r="10" fill="none" stroke-width="2.4"/>
              <circle class="wz-fileinput__ring-fill"  cx="12" cy="12" r="10" fill="none" stroke-width="2.4"
                stroke-linecap="round" pathLength="100"
                stroke-dasharray="100" stroke-dashoffset="${dash}"
                transform="rotate(-90 12 12)"/>
            </svg>
            <span class="wz-fileinput__progress-pct">${p}%</span>
          </span>`;
      } else {
        // Update only the changing parts to keep animation smooth
        const fill = action.querySelector('.wz-fileinput__ring-fill');
        const pctEl = action.querySelector('.wz-fileinput__progress-pct');
        if(fill) fill.setAttribute('stroke-dashoffset', dash);
        if(pctEl) pctEl.textContent = p + '%';
      }
      return;
    }

    if(state === 'uploaded' && anexosFile){
      slot.innerHTML = `
        <span class="naowee-tag naowee-tag--positive naowee-tag--small wz-fileinput__tag" title="${escapeHtml(fname)}">
          <span class="naowee-tag__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 14 11 16 15 12"/></svg>
          </span>
          <span class="wz-fileinput__tag-name">${escapeHtml(fname)}</span>
          <span class="naowee-tag__active-area" data-anexo-rm role="button" tabindex="0" aria-label="Quitar ${escapeHtml(fname)}">
            <span class="naowee-tag__close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </span>
          </span>
        </span>`;
      action.innerHTML = '';
      const rm = slot.querySelector('[data-anexo-rm]');
      if(rm){
        rm.addEventListener('click', removeAnexo);
        rm.addEventListener('keydown', e => {
          if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); removeAnexo(); }
        });
      }
    }
  }
  function resetAnexos(){ removeAnexo(); }

  function parseMoney(el){
    if(!el) return 0;
    const digits = String(el.value || '').replace(/\D/g, '');
    return digits ? Number(digits) : 0;
  }

  /* Devuelve el input "Valor unitario" del primer incentivo cuya categoría sea Bono.
     Es el unit que aplica para los códigos del programa (sólo bonos generan códigos). */
  function getBonoUnitInput(){
    const cards = [...document.querySelectorAll('.wz-pane[data-pane="2"] .wz-inc-card')];
    for(const c of cards){
      const cat = (c.querySelector('[data-wz-name="categoria"]')?.dataset?.wzValue || '').toLowerCase();
      if(cat === 'bono') return c.querySelector('.wz-inc-card__unit input');
    }
    return null;
  }
  function updateBudget(){
    const bx = document.getElementById('wzBudget');
    if(!bx) return;
    const rubro = parseMoney(document.getElementById('wzRubroTotal'));
    const unit = parseMoney(getBonoUnitInput());
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
    const unit = parseMoney(getBonoUnitInput());
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
    const id = lastCreatedProgramId;
    const url = id
      ? `incentivo-05-programa-detalle.html?id=${encodeURIComponent(id)}&activated=1`
      : 'incentivo-05-programa-detalle.html?activated=1';
    window.location.href = url;
  }

  /* ══ Step-4 activate ══ */
  function activateProgram(){
    // Si el paso 4 (Códigos) está visible (hay incentivo Bono), validar
    // que se hayan ingresado/cargado códigos antes de activar.
    if(hasBonoIncentive()){
      const mode = (document.querySelector('[data-wz-name="codes-mode"]')?.dataset?.wzValue) || 'upload';
      if(mode === 'upload'){
        // Debe haber un archivo cargado: el chip post-upload está visible.
        const chip = document.getElementById('wzFileChip');
        const hasFile = chip && !chip.hidden && chip.innerHTML.trim().length > 0;
        if(!hasFile){
          showCodesError('Debes cargar el archivo de códigos antes de activar el programa.');
          shakeDropzone();
          scrollToCodesError();
          return;
        }
      } else { // manual
        const rows = [...document.querySelectorAll('#wzManualRows .manual-row')];
        const filled = rows.filter(r => {
          const codeInput = r.querySelector('.manual-row__code input');
          return codeInput && (codeInput.value || '').trim().length > 0;
        });
        if(filled.length === 0){
          showCodesError('Debes ingresar al menos un código antes de activar el programa.');
          // Resaltar las filas vacías
          rows.forEach(r => {
            const codeInput = r.querySelector('.manual-row__code input');
            const tf = r.querySelector('.manual-row__code');
            if(tf && codeInput && !(codeInput.value || '').trim()){
              tf.classList.add('naowee-textfield--error');
              tf.classList.remove('wz-shake'); void tf.offsetWidth; tf.classList.add('wz-shake');
              setTimeout(() => tf.classList.remove('wz-shake'), 500);
              codeInput.addEventListener('input', () => {
                if((codeInput.value || '').trim()) tf.classList.remove('naowee-textfield--error');
              }, { once: true });
            }
          });
          scrollToCodesError();
          return;
        }
      }
    }
    // Construir el programa con todo lo parametrizado en el wizard, persistirlo
    // (memoria + sessionStorage para que el detalle lo lea al navegar) y notificar.
    const prog = buildProgramFromForm('active');
    persistProgram(prog);

    // Cerrar wizard y mostrar success modal
    const overlay = document.getElementById('wzOverlay');
    overlay.classList.remove('open');
    isDirty = false;
    showSuccessModal();
    if(typeof window.onProgramCreated === 'function') window.onProgramCreated(prog);
  }
  function showCodesError(text){
    const bx = document.getElementById('wzBudget');
    if(!bx) return;
    bx.hidden = false;
    bx.innerHTML = `
      <div class="naowee-message naowee-message--negative">
        <div class="naowee-message__header">
          <div class="naowee-message__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div class="naowee-message__text">${text}</div>
        </div>
      </div>`;
  }
  function shakeDropzone(){
    const dz = document.getElementById('wzDrop');
    if(!dz) return;
    dz.classList.remove('wz-shake');
    void dz.offsetWidth;
    dz.classList.add('wz-shake');
    setTimeout(() => dz.classList.remove('wz-shake'), 500);
  }
  function scrollToCodesError(){
    const body = document.getElementById('wzBody');
    const bx = document.getElementById('wzBudget');
    if(!body || !bx) return;
    const bodyRect = body.getBoundingClientRect();
    const bxRect = bx.getBoundingClientRect();
    body.scrollTo({ top: body.scrollTop + (bxRect.top - bodyRect.top) - 24, behavior: 'smooth' });
  }

  function saveDraft(){
    persistDraft();
    const overlay = document.getElementById('wzOverlay');
    if(overlay) overlay.classList.remove('open');
    isDirty = false;
  }

  /* Programa recién creado/guardado por activateProgram, para que goToProgramDetail
     pueda navegar al ID correcto. */
  let lastCreatedProgramId = null;

  /* Construye un program completo desde el formulario del wizard (todos los pasos)
     y lo persiste en window.PROGRAMS_DATA + sessionStorage queue (cross-page). */
  function buildProgramFromForm(status){
    const data = window.PROGRAMS_DATA;
    if(!Array.isArray(data)) return null;

    /* === Step 1 — Datos === */
    const name = (document.getElementById('fName')?.value || '').trim() || 'Programa sin nombre';
    const descEl = document.querySelector('.wz-pane[data-pane="1"] .naowee-textfield--textarea textarea');
    const desc = descEl ? (descEl.value || '').trim() : '';
    const fromEl = document.querySelector('[data-wz-range="from"][data-wz-range-name="vigencia"] input');
    const toEl   = document.querySelector('[data-wz-range="to"][data-wz-range-name="vigencia"] input');
    const from = (fromEl?.value || '').trim() || '—';
    const to   = (toEl?.value || '').trim() || '—';
    // Cobertura: leer todos los chips confirmados del tag-multi.
    const cobField = document.querySelector('[data-wz-name="cobertura"]');
    const cobCsv = cobField?.dataset?.wzValue || '';
    const cobLabels = cobCsv ? cobCsv.split(',').map(v => {
      const opt = cobField.querySelector(`.wz-tag-multi__option[data-val="${v}"]`);
      return opt ? (opt.dataset.label || v) : v;
    }) : [];
    const coverage = cobLabels.length === 0 ? '—'
      : cobLabels.length === 1 ? cobLabels[0]
      : cobLabels.length <= 3 ? cobLabels.join(', ')
      : `${cobLabels.length} departamentos`;
    const eventoVal = document.querySelector('[data-wz-name="evento"]')?.dataset?.wzValue || '';
    const eventoLbl = eventoVal ? (document.querySelector(`[data-wz-name="evento"] .naowee-dropdown__option[data-val="${eventoVal}"]`)?.textContent?.trim() || eventoVal) : '';

    /* === Step 2 — Tipos & rubro === */
    const rubro = parseMoney(document.getElementById('wzRubroTotal'));
    const cards = [...document.querySelectorAll('.wz-pane[data-pane="2"] .wz-inc-card')];
    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    const fmtMoney = v => '$' + Number(v||0).toLocaleString('es-CO');
    const VARIANT_BY_CAT = { bono:'positive', beca:'informative', kit:'caution', transporte:'neutral', inscripcion:'informative', descuento:'caution', pase:'neutral', dinero:'positive' };
    const incentives = cards.map(c => {
      const incName = (c.querySelector('.naowee-textfield input[type="text"]')?.value || '').trim() || 'Incentivo sin nombre';
      const catKey = (c.querySelector('[data-wz-name="categoria"]')?.dataset?.wzValue || '').toLowerCase();
      const catLabel = c.querySelector('[data-wz-name="categoria"] .naowee-dropdown__value')?.textContent?.trim() || cap(catKey);
      const incRubro = parseMoney(c.querySelector('.wz-inc-card__rubro input'));
      const unit = parseMoney(c.querySelector('.wz-inc-card__unit input'));
      return {
        name: incName,
        category: catLabel,
        detail: incRubro ? `Rubro asignado: ${fmtMoney(incRubro)}` : 'Rubro pendiente',
        value: unit,
        valueLabel: unit ? fmtMoney(unit) : '—',
        valueFoot: unit ? 'por beneficiario' : '',
        badges: [{ text: catLabel, variant: VARIANT_BY_CAT[catKey] || 'neutral' }]
      };
    });
    const firstCat = (cards[0]?.querySelector('[data-wz-name="categoria"]')?.dataset?.wzValue || '').toLowerCase();
    const ICON_BY_CAT = {
      bono:        { bg: '#e6f4e7', color: '#1f8923' },
      beca:        { bg: '#fff3e6', color: '#d74009' },
      kit:         { bg: '#eef5ff', color: '#1f78d1' },
      transporte:  { bg: '#f3e8ff', color: '#7c3aed' },
      inscripcion: { bg: '#fff3e6', color: '#d74009' },
      descuento:   { bg: '#fff0ee', color: '#b42318' },
      pase:        { bg: '#f5f6fa', color: '#646587' },
      dinero:      { bg: '#e6f4e7', color: '#1f8923' }
    };
    const iconStyle = ICON_BY_CAT[firstCat] || { bg: '#f5f6fa', color: '#646587' };

    /* === Step 3 — Condiciones (por panel — un panel por incentivo en multi) === */
    function extractGroupsFromBuilder(builder){
      if(!builder) return [];
      return [...builder.querySelectorAll('.cond-group')].map(g => {
        const rules = [...g.querySelectorAll('.cond-row')].map(r => {
          const fieldKey = r.querySelector('[data-cond-field]')?.dataset?.val || 'edad';
          const def = COND_FIELDS[fieldKey];
          const opVal = r.querySelector('[data-cond-op]')?.dataset?.val || (def?.operators?.[0]?.[0] || 'eq');
          const opNat = (OP_NATURAL && OP_NATURAL[opVal]) || (def?.operators?.find(o => o[0] === opVal) || ['','?'])[1];
          const valEl = r.querySelector('[data-cond-val]');
          let value = '';
          if(valEl){
            if(valEl.classList.contains('naowee-input-stepper')){
              value = valEl.querySelector('input')?.value || '';
            } else if(valEl.classList.contains('naowee-dropdown')){
              const isMulti = valEl.hasAttribute('data-wz-multi');
              if(isMulti){
                const csv = (valEl.dataset.wzValue || '').split(',').filter(Boolean);
                const labels = csv.map(k => (def?.options?.find(o => o[0] === k) || [k,k])[1]);
                value = labels.length === 0 ? '' : labels.length === 1 ? labels[0] : `{${labels.join(', ')}}`;
              } else {
                value = valEl.querySelector('.naowee-dropdown__value')?.textContent || '';
              }
            }
          }
          return { field: def?.label || fieldKey, op: opNat, value };
        }).filter(r => r.value !== '' && r.value !== undefined);
        return { logic: 'AND', rules };
      }).filter(g => g.rules.length > 0);
    }
    // En multi: cada panel pertenece a un incentivo (data-inc-idx).
    // Adjuntar las condiciones al incentivo correspondiente. Las condiciones
    // a nivel de programa se mantienen vacías (porque viven dentro de cada incentivo).
    const panels = [...document.querySelectorAll('.wz-cond-panel')];
    let groups = [];
    let summary = '';
    if(incTypesMode === 'multi' && cards.length > 1){
      panels.forEach(panel => {
        const idx = parseInt(panel.dataset.incIdx || '0', 10);
        const builder = panel.querySelector('.cond-builder');
        const incGroups = extractGroupsFromBuilder(builder);
        const previewBody = panel.querySelector('.wz-cond-preview__body')?.innerHTML || '';
        const incSummary = previewBody && !previewBody.includes('Agrega al menos') ? previewBody : '';
        if(incentives[idx]){
          incentives[idx].conditions = { groups: incGroups, summary: incSummary };
        }
      });
    } else {
      // Single mode: un solo panel para todo el programa.
      const builder = panels[0]?.querySelector('.cond-builder');
      groups = extractGroupsFromBuilder(builder);
      const previewBody = panels[0]?.querySelector('.wz-cond-preview__body')?.innerHTML || '';
      summary = previewBody && !previewBody.includes('Agrega al menos') ? previewBody : '';
    }

    /* === Step 4 — Códigos === */
    let codeCount = 0;
    let manualCodes = [];
    let codesMode = 'none';
    let codesFile = '';
    if(hasBonoIncentive()){
      codesMode = document.querySelector('[data-wz-name="codes-mode"]')?.dataset?.wzValue || 'upload';
      if(codesMode === 'manual'){
        manualCodes = [...document.querySelectorAll('#wzManualRows .manual-row')]
          .map(r => (r.querySelector('.manual-row__code input')?.value || '').trim())
          .filter(Boolean);
        codeCount = manualCodes.length;
      } else {
        // Modo upload — derivar conteo desde rubro/unit del primer bono
        const unit = parseMoney(getBonoUnitInput());
        codeCount = (rubro && unit) ? Math.floor(rubro / unit) : 0;
        const chip = document.getElementById('wzFileChip');
        codesFile = chip?.querySelector('.wz-file-chip__name')?.textContent?.trim() || '';
      }
    }

    /* === Generar id único === */
    const taken = new Set(data.map(p => p.id));
    let n = data.length + 1;
    let id = 'PRG-2026-' + String(n).padStart(3, '0');
    while(taken.has(id)){ n++; id = 'PRG-2026-' + String(n).padStart(3, '0'); }

    return {
      id,
      name,
      shortDesc: desc.slice(0, 80) || (coverage !== '—' ? coverage : 'Sin descripción'),
      longDesc: desc || '',
      iconBg: iconStyle.bg,
      iconColor: iconStyle.color,
      status,
      event: eventoLbl,
      coverage,
      responsible: 'Doug Vargas',
      rubro,
      exec: 0,
      unit: parseMoney(getBonoUnitInput()) || (cards[0] ? parseMoney(cards[0].querySelector('.wz-inc-card__unit input')) : 0),
      codes: { total: codeCount, avail: codeCount, asig: 0, rev: 0 },
      from, to,
      actoAdmin: '',
      fuente: 'Ministerio del Deporte · 2026',
      incentives,
      conditions: { groups, summary },
      // Marcar como creado por el usuario para que el detalle no use el seed
      // de demo (200 códigos fake, 182 asignaciones fake, etc).
      _userCreated: true,
      manualCodes,
      codesMode,
      codesFile,
      createdAt: new Date().toISOString()
    };
  }

  /* Persiste el programa: lo unshift en PROGRAMS_DATA y lo encola en
     sessionStorage para que otras páginas (detalle, lista) lo absorban. */
  function persistProgram(prog){
    if(!prog) return;
    const data = window.PROGRAMS_DATA;
    if(Array.isArray(data)) data.unshift(prog);
    try {
      const KEY = 'naowee:program-draft-queue';
      const queue = JSON.parse(sessionStorage.getItem(KEY) || '[]');
      queue.push(prog);
      sessionStorage.setItem(KEY, JSON.stringify(queue));
    } catch(e){ /* sessionStorage podría estar bloqueado */ }
    lastCreatedProgramId = prog.id;
  }

  /* Compat alias usado por saveDraft/confirmSaveDraftWizard. */
  function persistDraft(){
    const prog = buildProgramFromForm('draft');
    persistProgram(prog);
    if(typeof window.onDraftSaved === 'function') window.onDraftSaved(prog);
  }

  /* ══ Expose to window ══ */
  window.openWizard = openWizard;
  window.openWizardForEdit = openWizardForEdit;
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
