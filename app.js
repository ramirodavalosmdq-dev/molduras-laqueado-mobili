(() => {
  'use strict';

  const DEFAULTS = {
    refilado: 1,
    faja2: 6.3,
    faja3: 6,
    marcoMC: 5.5,
    surcoMC: 3.5,
    fajaSP: 8,
  };
  const STORAGE_KEY = 'mobili-molduras-historial-v1';
  const CONFIG_KEY = 'mobili-molduras-config-v1';
  const MODEL_KEY = 'mobili-molduras-model-v1';
  const MAX_HISTORY = 30;

  const MODEL_LABELS = {
    'step': 'Step',
    'media-cana': 'Media caña',
    'simple-placar': 'Placar',
  };

  const $ = id => document.getElementById(id);
  const $alto = $('alto');
  const $ancho = $('ancho');
  const $cantidad = $('cantidad');
  const $refilado = $('refilado'); // default general
  const $refiladoChips = $('refilado-chips-frente');
  const $refiladoCustom = $('refilado-frente-custom');
  const $faja2 = $('faja2');
  const $faja3 = $('faja3');
  const $marcoMC = $('marco-mc');
  const $surcoMC = $('surco-mc');
  const $fajaSP = $('faja-sp');
  const $cliente = $('cliente');
  const $orden = $('orden');
  const $error = $('error');
  const $summary = $('summary');
  const $thead = $('thead');
  const $tbody = $('tbody');
  const $metaContext = $('meta-context');
  const $historyBody = $('history-body');
  const $historyActions = $('history-actions');
  const $historyFilters = $('history-filters');
  const $toast = $('toast');
  const $modelSelector = $('model-selector');

  let currentModel = 'step';
  let currentResult = null;
  let historyFilter = 'all';
  let toastTimer = null;

  function fmt(n) {
    const r = Math.round(n * 10) / 10;
    return (r % 1 === 0 ? r.toString() : r.toFixed(1)).replace('.', ',');
  }

  function plural(n, singular, pluralForm) {
    return `${n} ${n === 1 ? singular : pluralForm}`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function showToast(msg, duration = 1800) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), duration);
  }

  // ============== CONFIG ==============
  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return;
      const cfg = JSON.parse(raw);
      if (typeof cfg.refilado === 'number') $refilado.value = cfg.refilado;
      if (typeof cfg.faja2 === 'number') $faja2.value = cfg.faja2;
      if (typeof cfg.faja3 === 'number') $faja3.value = cfg.faja3;
      if (typeof cfg.marcoMC === 'number') $marcoMC.value = cfg.marcoMC;
      if (typeof cfg.surcoMC === 'number') $surcoMC.value = cfg.surcoMC;
      if (typeof cfg.fajaSP === 'number') $fajaSP.value = cfg.fajaSP;
      if (typeof cfg.cliente === 'string') $cliente.value = cfg.cliente;
      if (typeof cfg.orden === 'string') $orden.value = cfg.orden;
    } catch (e) { /* ignore */ }
  }

  function saveConfig() {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify({
        refilado: parseFloat($refilado.value),
        faja2: parseFloat($faja2.value),
        faja3: parseFloat($faja3.value),
        marcoMC: parseFloat($marcoMC.value),
        surcoMC: parseFloat($surcoMC.value),
        fajaSP: parseFloat($fajaSP.value),
        cliente: $cliente.value,
        orden: $orden.value,
      }));
    } catch (e) { /* ignore */ }
  }

  function loadCurrentModel() {
    try {
      const m = localStorage.getItem(MODEL_KEY);
      if (m && MODEL_LABELS[m]) currentModel = m;
    } catch (e) { /* ignore */ }
  }
  function saveCurrentModel() {
    try { localStorage.setItem(MODEL_KEY, currentModel); } catch (e) { /* ignore */ }
  }

  // ============== HISTORIAL ==============
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveHistory(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }

  function renderHistory() {
    const list = loadHistory();
    const filtered = historyFilter === 'all' ? list : list.filter(it => it.model === historyFilter);

    if (list.length === 0) {
      $historyBody.innerHTML = '<div class="history-empty">Aún no guardaste ningún frente.</div>';
      $historyActions.hidden = true;
      return;
    }
    $historyActions.hidden = false;

    if (filtered.length === 0) {
      $historyBody.innerHTML = '<div class="history-empty">No hay frentes de este modelo.</div>';
      return;
    }

    $historyBody.innerHTML = filtered.map((item, idxInFiltered) => {
      // Buscar el índice real en la lista completa para los botones
      const realIdx = list.indexOf(item);
      const when = new Date(item.t);
      const whenStr = when.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) +
                      ' ' + when.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
      const cant = (item.cant != null && item.cant >= 1) ? item.cant : 1;
      const dimsStr = cant > 1
        ? `${fmt(item.H)} × ${fmt(item.A)} cm ×${cant}`
        : `${fmt(item.H)} × ${fmt(item.A)} cm`;
      const modelLabel = MODEL_LABELS[item.model] || item.model;
      const clienteStr = item.cliente ? ' · ' + escapeHtml(item.cliente) : '';
      return `
        <div class="history-item">
          <div class="info">
            <div class="dims">${dimsStr}</div>
            <div class="meta">
              <span class="model-tag">${escapeHtml(modelLabel)}</span>
              <span>${whenStr}${clienteStr}</span>
            </div>
          </div>
          <button data-act="load" data-idx="${realIdx}" type="button">Cargar</button>
          <button data-act="del" data-idx="${realIdx}" aria-label="Eliminar" type="button">✕</button>
        </div>
      `;
    }).join('');
  }

  // ============== META CONTEXT ==============
  function updateMeta() {
    const cliente = $cliente.value.trim();
    const orden = $orden.value.trim();
    const parts = [];
    if (cliente) parts.push(`<span><span class="label">Cliente:</span><strong>${escapeHtml(cliente)}</strong></span>`);
    if (orden) parts.push(`<span><span class="label">Orden N°:</span><strong>${escapeHtml(orden)}</strong></span>`);
    $metaContext.innerHTML = parts.join('');
  }

  // ============== CALCULOS POR MODELO ==============
  // FORMULA UNIFICADA:
  //   Canto = 1 mm por borde (0,1 cm) × 4 bordes = -0,2 cm por dimensión del frente
  //   Refilado = r cm por lado (configurable, default 1)
  //   FRENTE al corte = FINAL - 0,2 + 2*r
  //   FRENTE refilado (antes de pegar canto) = FINAL - 0,2
  //   FAJA al corte (ancho) = FAJA_FINAL - 0,1 + r (solo 1 borde exterior)
  //   HORIZONTAL largo = ancho_bruto_frente - 2 × faja_al_corte

  const CANTO = 0.1; // 1 mm por borde en cm

  function computeFrenteBase(H, A, r) {
    // Medida al corte del frente completo
    const altoBruto = H - 2 * CANTO + 2 * r;
    const anchoBruto = A - 2 * CANTO + 2 * r;
    // Medida después del refilado (antes del canto)
    const refiladoAlto = H - 2 * CANTO;
    const refiladoAncho = A - 2 * CANTO;
    return { altoBruto, anchoBruto, refiladoAlto, refiladoAncho };
  }

  function computeStep(H, A, cant, r, c2, c3) {
    const base = computeFrenteBase(H, A, r);
    const c2Bruto = c2 - CANTO + r;   // ancho corte faja C2
    const c3Bruto = c3 - CANTO + r;   // ancho corte faja C3
    const c2Horiz = base.anchoBruto - 2 * c2Bruto;
    const c3Horiz = base.anchoBruto - 2 * c3Bruto;
    return { ...base, c2, c3, c2Bruto, c3Bruto, c2Horiz, c3Horiz };
  }

  function computeMediaCana(H, A, cant, r, marco, surco) {
    const base = computeFrenteBase(H, A, r);
    // Moldura interior (marcación para la fresa media caña)
    const descuento = 2 * (marco + surco);
    const molduraAlto = H - descuento;
    const molduraAncho = A - descuento;
    return { ...base, marco, surco, descuento, molduraAlto, molduraAncho };
  }

  function computeSimplePlacar(H, A, cant, r, faja) {
    const base = computeFrenteBase(H, A, r);
    const fajaBruto = faja - CANTO + r;
    const fajaHoriz = base.anchoBruto - 2 * fajaBruto;
    return { ...base, faja, fajaBruto, fajaHoriz };
  }

  // ============== REFILADO DEL FRENTE ACTUAL ==============
  function getRefiladoFrente() {
    const activeChip = $refiladoChips.querySelector('.refilado-chip.active');
    const value = activeChip ? activeChip.dataset.value : '1';
    if (value === 'custom') {
      return parseFloat($refiladoCustom.value);
    }
    return parseFloat(value);
  }

  function setRefiladoFrente(value) {
    // value puede ser 1, 0.5, o un número cualquiera
    const chips = $refiladoChips.querySelectorAll('.refilado-chip');
    const v = parseFloat(value);
    let matched = false;
    chips.forEach(ch => {
      if (ch.dataset.value !== 'custom' && parseFloat(ch.dataset.value) === v) {
        ch.classList.add('active');
        matched = true;
      } else {
        ch.classList.remove('active');
      }
    });
    if (!matched) {
      const customChip = $refiladoChips.querySelector('.refilado-chip[data-value="custom"]');
      if (customChip) customChip.classList.add('active');
      $refiladoCustom.value = v;
      $refiladoCustom.hidden = false;
    } else {
      $refiladoCustom.hidden = true;
    }
  }

  // ============== VALIDACION ==============
  function validateCommon() {
    const H = parseFloat($alto.value);
    const A = parseFloat($ancho.value);
    const r = getRefiladoFrente();
    let cant = parseInt($cantidad.value, 10);
    if (isNaN(cant) || cant < 1) cant = 1;
    if ([H, A, r].some(v => isNaN(v)) || H <= 0 || A <= 0 || r < 0) {
      return { ok: false, msg: 'Ingresá valores válidos en alto, ancho y refilado.' };
    }
    return { ok: true, H, A, r, cant };
  }

  // ============== COMPUTE ==============
  function compute() {
    updateMeta();
    const common = validateCommon();
    if (!common.ok) {
      showError(common.msg);
      return;
    }
    const { H, A, r, cant } = common;

    if (currentModel === 'step') return renderStep(H, A, cant, r);
    if (currentModel === 'media-cana') return renderMediaCana(H, A, cant, r);
    if (currentModel === 'simple-placar') return renderSimplePlacar(H, A, cant, r);
  }

  function showError(msg) {
    $error.hidden = false;
    $error.textContent = msg;
    $summary.innerHTML = '';
    $thead.innerHTML = '';
    $tbody.innerHTML = '';
    currentResult = null;
  }

  function clearError() { $error.hidden = true; }

  // ============== RENDER STEP ==============
  function renderStep(H, A, cant, r) {
    const c2 = parseFloat($faja2.value);
    const c3 = parseFloat($faja3.value);
    if (isNaN(c2) || isNaN(c3) || c2 <= 0 || c3 <= 0) {
      showError('Ingresá valores válidos en los anchos de faja.');
      return;
    }
    const d = computeStep(H, A, cant, r, c2, c3);
    if (d.c2Horiz <= 0 || d.c3Horiz <= 0) {
      showError(`El ancho del frente es muy chico. El ancho bruto debe superar ${fmt(2 * Math.max(d.c2Bruto, d.c3Bruto))} cm.`);
      return;
    }
    clearError();

    const nBase = cant, nFaja = 2 * cant;
    const finalStr = cant > 1 ? `${fmt(H)} × ${fmt(A)} cm ×${cant}` : `${fmt(H)} × ${fmt(A)} cm`;

    $summary.className = 'summary three';
    $summary.innerHTML = `
      <div class="stat">
        <div class="label">Medida final${cant > 1 ? ' · ' + cant + ' pzs' : ''}</div>
        <div class="value">${finalStr}</div>
      </div>
      <div class="stat">
        <div class="label">Medida al corte</div>
        <div class="value">${fmt(d.altoBruto)} × ${fmt(d.anchoBruto)}</div>
      </div>
      <div class="stat">
        <div class="label">Refilado (${fmt(r)} cm/lado)</div>
        <div class="value">${fmt(d.refiladoAlto)} × ${fmt(d.refiladoAncho)}</div>
      </div>
    `;

    $thead.innerHTML = `<tr>
      <th>Pieza</th><th class="num">Cant</th><th class="num">Espesor</th><th class="num">Alto</th><th class="num">Ancho</th>
    </tr>`;
    $tbody.innerHTML = `
      <tr class="group-head"><td colspan="5">Base — capa 1</td></tr>
      <tr><td>Placa base</td><td class="num">${nBase}</td><td class="num">12 mm</td><td class="num">${fmt(d.altoBruto)}</td><td class="num">${fmt(d.anchoBruto)}</td></tr>
      <tr class="group-head"><td colspan="5">Capa 2 — fajas corte ${fmt(d.c2Bruto)} cm (final ${fmt(c2)} cm)</td></tr>
      <tr><td>Verticales</td><td class="num">${nFaja}</td><td class="num">3 mm</td><td class="num">${fmt(d.altoBruto)}</td><td class="num">${fmt(d.c2Bruto)}</td></tr>
      <tr><td>Horizontales</td><td class="num">${nFaja}</td><td class="num">3 mm</td><td class="num">${fmt(d.c2Bruto)}</td><td class="num">${fmt(d.c2Horiz)}</td></tr>
      <tr class="group-head"><td colspan="5">Capa 3 — fajas corte ${fmt(d.c3Bruto)} cm (final ${fmt(c3)} cm)</td></tr>
      <tr><td>Verticales</td><td class="num">${nFaja}</td><td class="num">3 mm</td><td class="num">${fmt(d.altoBruto)}</td><td class="num">${fmt(d.c3Bruto)}</td></tr>
      <tr><td>Horizontales</td><td class="num">${nFaja}</td><td class="num">3 mm</td><td class="num">${fmt(d.c3Bruto)}</td><td class="num">${fmt(d.c3Horiz)}</td></tr>
    `;

    currentResult = { model: 'step', H, A, r, c2, c3, cant, ...d };
  }

  // ============== RENDER MEDIA CANA ==============
  function renderMediaCana(H, A, cant, r) {
    const marco = parseFloat($marcoMC.value);
    const surco = parseFloat($surcoMC.value);
    if (isNaN(marco) || isNaN(surco) || marco <= 0 || surco <= 0) {
      showError('Ingresá valores válidos en marco y surco.');
      return;
    }
    const d = computeMediaCana(H, A, cant, r, marco, surco);
    if (d.molduraAlto <= 0 || d.molduraAncho <= 0) {
      showError(`El frente es muy chico para la moldura. Alto y ancho deben superar ${fmt(d.descuento)} cm.`);
      return;
    }
    clearError();

    const nPlacas = cant;
    const finalStr = cant > 1 ? `${fmt(H)} × ${fmt(A)} cm ×${cant}` : `${fmt(H)} × ${fmt(A)} cm`;

    $summary.className = 'summary three';
    $summary.innerHTML = `
      <div class="stat">
        <div class="label">Medida final${cant > 1 ? ' · ' + cant + ' pzs' : ''}</div>
        <div class="value">${finalStr}</div>
      </div>
      <div class="stat">
        <div class="label">Corte (${fmt(r)} cm/lado)</div>
        <div class="value">${fmt(d.altoBruto)} × ${fmt(d.anchoBruto)}</div>
      </div>
      <div class="stat">
        <div class="label">Moldura interior</div>
        <div class="value">${fmt(d.molduraAlto)} × ${fmt(d.molduraAncho)}</div>
      </div>
    `;

    $thead.innerHTML = `<tr>
      <th>Pieza / etapa</th><th class="num">Cant</th><th class="num">Espesor</th><th class="num">Alto</th><th class="num">Ancho</th>
    </tr>`;
    $tbody.innerHTML = `
      <tr class="group-head"><td colspan="5">Corte (3 placas apiladas = 36 mm)</td></tr>
      <tr><td>Cara superior</td><td class="num">${nPlacas}</td><td class="num">9 mm</td><td class="num">${fmt(d.altoBruto)}</td><td class="num">${fmt(d.anchoBruto)}</td></tr>
      <tr><td>Cara inferior</td><td class="num">${nPlacas}</td><td class="num">9 mm</td><td class="num">${fmt(d.altoBruto)}</td><td class="num">${fmt(d.anchoBruto)}</td></tr>
      <tr><td>Base mecanizado</td><td class="num">${nPlacas}</td><td class="num">18 mm</td><td class="num">${fmt(d.altoBruto)}</td><td class="num">${fmt(d.anchoBruto)}</td></tr>
      <tr class="group-head"><td colspan="5">Fresado — moldura interior (surco media caña)</td></tr>
      <tr><td>Marco interior fresa</td><td class="num">—</td><td class="num">—</td><td class="num">${fmt(d.molduraAlto)}</td><td class="num">${fmt(d.molduraAncho)}</td></tr>
      <tr class="group-head"><td colspan="5">Refilado post-armado (antes del canto)</td></tr>
      <tr><td>Medida refilado</td><td class="num">—</td><td class="num">—</td><td class="num">${fmt(d.refiladoAlto)}</td><td class="num">${fmt(d.refiladoAncho)}</td></tr>
    `;

    currentResult = { model: 'media-cana', H, A, r, marco, surco, cant, ...d };
  }

  // ============== RENDER SIMPLE PLACAR ==============
  function renderSimplePlacar(H, A, cant, r) {
    const faja = parseFloat($fajaSP.value);
    if (isNaN(faja) || faja <= 0) {
      showError('Ingresá un valor válido en el ancho de faja.');
      return;
    }
    const d = computeSimplePlacar(H, A, cant, r, faja);
    if (d.fajaHoriz <= 0) {
      showError(`El ancho del frente es muy chico. El ancho bruto debe superar ${fmt(2 * d.fajaBruto)} cm.`);
      return;
    }
    clearError();

    const nBase = cant, nFaja = 2 * cant;
    const finalStr = cant > 1 ? `${fmt(H)} × ${fmt(A)} cm ×${cant}` : `${fmt(H)} × ${fmt(A)} cm`;

    $summary.className = 'summary three';
    $summary.innerHTML = `
      <div class="stat">
        <div class="label">Medida final${cant > 1 ? ' · ' + cant + ' pzs' : ''}</div>
        <div class="value">${finalStr}</div>
      </div>
      <div class="stat">
        <div class="label">Medida al corte (${fmt(r)} cm/lado)</div>
        <div class="value">${fmt(d.altoBruto)} × ${fmt(d.anchoBruto)}</div>
      </div>
      <div class="stat">
        <div class="label">Refilado (antes del canto)</div>
        <div class="value">${fmt(d.refiladoAlto)} × ${fmt(d.refiladoAncho)}</div>
      </div>
    `;

    $thead.innerHTML = `<tr>
      <th>Pieza</th><th class="num">Cant</th><th class="num">Espesor</th><th class="num">Alto</th><th class="num">Ancho</th>
    </tr>`;
    $tbody.innerHTML = `
      <tr class="group-head"><td colspan="5">Base</td></tr>
      <tr><td>Placa base</td><td class="num">${nBase}</td><td class="num">12 mm</td><td class="num">${fmt(d.altoBruto)}</td><td class="num">${fmt(d.anchoBruto)}</td></tr>
      <tr class="group-head"><td colspan="5">Moldura — fajas corte ${fmt(d.fajaBruto)} cm (final ${fmt(faja)} cm)</td></tr>
      <tr><td>Verticales</td><td class="num">${nFaja}</td><td class="num">5 mm</td><td class="num">${fmt(d.altoBruto)}</td><td class="num">${fmt(d.fajaBruto)}</td></tr>
      <tr><td>Horizontales</td><td class="num">${nFaja}</td><td class="num">5 mm</td><td class="num">${fmt(d.fajaBruto)}</td><td class="num">${fmt(d.fajaHoriz)}</td></tr>
    `;

    currentResult = { model: 'simple-placar', H, A, r, faja, cant, ...d };
  }

  // ============== BUILD TEXT (para copiar/compartir) ==============
  function buildText() {
    if (!currentResult) return '';
    const r = currentResult;
    const cliente = $cliente.value.trim();
    const orden = $orden.value.trim();
    const lines = [];
    if (cliente) lines.push(`CLIENTE: ${cliente}`);
    if (orden) lines.push(`ORDEN N°: ${orden}`);
    if (cliente || orden) lines.push('');

    const header = r.cant > 1
      ? `FRENTE ${fmt(r.H)} × ${fmt(r.A)} cm (final) — ${r.cant} PIEZAS`
      : `FRENTE ${fmt(r.H)} × ${fmt(r.A)} cm (final)`;
    lines.push(header);
    lines.push(`Refilado: ${fmt(r.r)} cm por lado`);

    if (r.model === 'step') {
      const nF = 2 * r.cant;
      lines.push(
        `Modelo: STEP (escalonada)`,
        `Medida al corte: ${fmt(r.altoBruto)} × ${fmt(r.anchoBruto)} cm`,
        `Medida refilado (antes del canto): ${fmt(r.refiladoAlto)} × ${fmt(r.refiladoAncho)} cm`,
        ``,
        `BASE — capa 1`,
        `  ${r.cant} × 12 mm — ${fmt(r.altoBruto)} × ${fmt(r.anchoBruto)} cm`,
        ``,
        `CAPA 2 — fajas corte ${fmt(r.c2Bruto)} cm (final ${fmt(r.c2)} cm)`,
        `  ${nF} × 3 mm — ${fmt(r.altoBruto)} × ${fmt(r.c2Bruto)} cm (verticales)`,
        `  ${nF} × 3 mm — ${fmt(r.c2Bruto)} × ${fmt(r.c2Horiz)} cm (horizontales)`,
        ``,
        `CAPA 3 — fajas corte ${fmt(r.c3Bruto)} cm (final ${fmt(r.c3)} cm)`,
        `  ${nF} × 3 mm — ${fmt(r.altoBruto)} × ${fmt(r.c3Bruto)} cm (verticales)`,
        `  ${nF} × 3 mm — ${fmt(r.c3Bruto)} × ${fmt(r.c3Horiz)} cm (horizontales)`,
      );
    } else if (r.model === 'media-cana') {
      lines.push(
        `Modelo: MEDIA CAÑA (fresada)`,
        `Corte: ${fmt(r.altoBruto)} × ${fmt(r.anchoBruto)} cm`,
        `Medida refilado (antes del canto): ${fmt(r.refiladoAlto)} × ${fmt(r.refiladoAncho)} cm`,
        ``,
        `CORTE (3 placas apiladas = 36 mm)`,
        `  ${r.cant} × 9 mm  — ${fmt(r.altoBruto)} × ${fmt(r.anchoBruto)} (cara superior)`,
        `  ${r.cant} × 9 mm  — ${fmt(r.altoBruto)} × ${fmt(r.anchoBruto)} (cara inferior)`,
        `  ${r.cant} × 18 mm — ${fmt(r.altoBruto)} × ${fmt(r.anchoBruto)} (base mecanizado)`,
        ``,
        `MOLDURA INTERIOR (fresa media caña): ${fmt(r.molduraAlto)} × ${fmt(r.molduraAncho)} cm`,
      );
    } else if (r.model === 'simple-placar') {
      const nF = 2 * r.cant;
      lines.push(
        `Modelo: SIMPLE PLACAR`,
        `Medida al corte: ${fmt(r.altoBruto)} × ${fmt(r.anchoBruto)} cm`,
        `Medida refilado (antes del canto): ${fmt(r.refiladoAlto)} × ${fmt(r.refiladoAncho)} cm`,
        ``,
        `BASE`,
        `  ${r.cant} × 12 mm — ${fmt(r.altoBruto)} × ${fmt(r.anchoBruto)} cm`,
        ``,
        `MOLDURA — fajas corte ${fmt(r.fajaBruto)} cm (final ${fmt(r.faja)} cm)`,
        `  ${nF} × 5 mm — ${fmt(r.altoBruto)} × ${fmt(r.fajaBruto)} cm (verticales)`,
        `  ${nF} × 5 mm — ${fmt(r.fajaBruto)} × ${fmt(r.fajaHoriz)} cm (horizontales)`,
      );
    }
    return lines.join('\n');
  }

  // ============== PRINT PREVIEW (OVERLAY) ==============
  function openPrintPreview(html, titulo) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0F2C6B;display:flex;flex-direction:column';

    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'padding:10px 14px;background:#0F2C6B;color:white;display:flex;justify-content:space-between;align-items:center;font-family:Poppins,system-ui,sans-serif;font-size:14px;gap:10px;flex-shrink:0';

    const titleEl = document.createElement('span');
    titleEl.textContent = titulo || 'Vista previa';
    titleEl.style.cssText = 'font-weight:600;letter-spacing:0.02em';

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:8px;align-items:center';

    const printBtn = document.createElement('button');
    printBtn.textContent = 'Imprimir / PDF';
    printBtn.style.cssText = 'padding:9px 14px;background:white;color:#0F2C6B;border:0;border-radius:6px;font-weight:700;font-family:Poppins,sans-serif;font-size:13px;cursor:pointer';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.style.cssText = 'width:36px;height:36px;background:transparent;color:white;border:1px solid rgba(255,255,255,0.4);border-radius:6px;font-size:16px;cursor:pointer;line-height:1';

    btnGroup.appendChild(printBtn);
    btnGroup.appendChild(closeBtn);
    toolbar.appendChild(titleEl);
    toolbar.appendChild(btnGroup);

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'flex:1;border:0;background:white;width:100%;display:block;min-height:0';
    iframe.setAttribute('title', 'PDF a imprimir');

    overlay.appendChild(toolbar);
    overlay.appendChild(iframe);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const cleanup = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.body.style.overflow = '';
    };
    closeBtn.onclick = cleanup;
    printBtn.onclick = () => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
      catch (e) { showToast('No se pudo imprimir'); }
    };

    const htmlWithHelper = html.replace(
      '</body>',
      "<script>window.addEventListener('load', function(){ try{ window.focus(); }catch(e){} });</script></body>"
    );
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(htmlWithHelper);
    doc.close();
  }

  // ============== PRINT BATCH (orden de corte agrupado por operacion) ==============
  function buildBatchPrintHTML(list, cliente, orden) {
    const esc = escapeHtml;
    const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

    // Procesar items (fórmula unificada con canto y refilado por frente)
    const items = list.map((item, i) => {
      const r = (item.r != null) ? item.r : 1;
      const cant = (item.cant != null && item.cant >= 1) ? item.cant : 1;
      const altoBruto = item.H - 2 * CANTO + 2 * r;
      const anchoBruto = item.A - 2 * CANTO + 2 * r;
      return { ...item, ref: i + 1, r, cant, altoBruto, anchoBruto };
    });

    const metaLine = [];
    if (cliente) metaLine.push(`<div><strong>Cliente:</strong> ${esc(cliente)}</div>`);
    if (orden) metaLine.push(`<div><strong>Orden N°:</strong> ${esc(orden)}</div>`);
    metaLine.push(`<div>Fecha: ${hoy}</div>`);

    // Indice (muestra MEDIDA FINAL del plano)
    const indiceItems = items.map(f => `
      <div class="indice-item">
        <span class="ref">#${f.ref}</span>
        <span class="medida">${fmt(f.H)} × ${fmt(f.A)}</span>
        <span class="cant">×${f.cant}</span>
      </div>
    `).join('');

    // Agrupar piezas por operación
    const bases12 = [], bases18 = [], caras9 = [];
    const c2v = [], c2h = [], c3v = [], c3h = [];
    const spV = [], spH = [];

    for (const it of items) {
      const m = it.model;
      if (m === 'step') {
        const c2 = it.c2 || 6.3, c3 = it.c3 || 6;
        const c2b = c2 - CANTO + it.r, c3b = c3 - CANTO + it.r;
        const c2hz = it.anchoBruto - 2 * c2b;
        const c3hz = it.anchoBruto - 2 * c3b;
        bases12.push({ ref: it.ref, cant: it.cant, alto: it.altoBruto, ancho: it.anchoBruto });
        c2v.push({ ref: it.ref, cant: it.cant * 2, alto: it.altoBruto, ancho: c2b });
        c2h.push({ ref: it.ref, cant: it.cant * 2, alto: c2b, ancho: c2hz });
        c3v.push({ ref: it.ref, cant: it.cant * 2, alto: it.altoBruto, ancho: c3b });
        c3h.push({ ref: it.ref, cant: it.cant * 2, alto: c3b, ancho: c3hz });
      } else if (m === 'simple-placar') {
        const f = it.faja || 8;
        const fb = f - CANTO + it.r;
        const fhz = it.anchoBruto - 2 * fb;
        bases12.push({ ref: it.ref, cant: it.cant, alto: it.altoBruto, ancho: it.anchoBruto });
        spV.push({ ref: it.ref, cant: it.cant * 2, alto: it.altoBruto, ancho: fb });
        spH.push({ ref: it.ref, cant: it.cant * 2, alto: fb, ancho: fhz });
      } else if (m === 'media-cana') {
        caras9.push({ ref: it.ref, cant: it.cant * 2, alto: it.altoBruto, ancho: it.anchoBruto });
        bases18.push({ ref: it.ref, cant: it.cant, alto: it.altoBruto, ancho: it.anchoBruto });
      }
    }

    const fila3col = (f) => `
      <tr>
        <td class="ref-cell">#${f.ref}</td>
        <td class="num">${f.cant}</td>
        <td class="num">${fmt(f.alto)} × ${fmt(f.ancho)}</td>
      </tr>
    `;

    const section = (title, meta, rows) => rows.length === 0 ? '' : `
      <div class="table-block">
        <div class="section-title"><span>${title}</span><span class="meta-info">${meta}</span></div>
        <table>
          <thead><tr><th>Ref</th><th class="num">Cant</th><th class="num">Alto × Ancho (cm)</th></tr></thead>
          <tbody>${rows.map(fila3col).join('')}</tbody>
        </table>
      </div>
    `;

    const totalBases12 = bases12.reduce((s, b) => s + b.cant, 0);
    const totalBases18 = bases18.reduce((s, b) => s + b.cant, 0);
    const totalCaras9 = caras9.reduce((s, b) => s + b.cant, 0);
    const totalC2 = c2v.reduce((s, b) => s + b.cant, 0) + c2h.reduce((s, b) => s + b.cant, 0);
    const totalC3 = c3v.reduce((s, b) => s + b.cant, 0) + c3h.reduce((s, b) => s + b.cant, 0);
    const totalSP = spV.reduce((s, b) => s + b.cant, 0) + spH.reduce((s, b) => s + b.cant, 0);
    const totalPiezas = totalBases12 + totalBases18 + totalCaras9 + totalC2 + totalC3 + totalSP;

    return `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><title>Orden de corte — Mobili</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap">
<style>
  @page { size: A4; margin: 12mm 10mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Poppins',Arial,sans-serif; color:#0A1B4A; font-size:10px; line-height:1.35; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #0F2C6B; padding-bottom:8px; margin-bottom:12px; }
  .brand { display:flex; align-items:center; gap:10px; }
  .brand-icon { width:26px; height:26px; }
  .brand-name { font-size:22px; font-weight:800; color:#0F2C6B; letter-spacing:.03em; line-height:1; }
  .subtitle { font-size:9px; color:#4A5568; margin-top:3px; letter-spacing:.08em; text-transform:uppercase; }
  .meta { text-align:right; font-size:10px; color:#4A5568; line-height:1.5; }
  .meta strong { color:#0A1B4A; font-weight:600; }
  .section-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#0F2C6B; margin:14px 0 6px; padding-bottom:3px; border-bottom:1px solid #DDE0E6; display:flex; justify-content:space-between; align-items:baseline; }
  .section-title .meta-info { font-size:9px; color:#4A5568; font-weight:500; text-transform:none; letter-spacing:0; }
  .indice { display:grid; grid-template-columns:repeat(4,1fr); gap:4px 10px; margin-bottom:4px; }
  .indice-item { padding:3px 8px; background:#EDF1FA; border-radius:3px; display:flex; justify-content:space-between; align-items:center; gap:6px; font-size:10px; font-variant-numeric:tabular-nums; }
  .indice-item .ref { font-weight:700; color:#0F2C6B; min-width:22px; }
  .indice-item .medida { color:#0A1B4A; flex:1; text-align:center; }
  .indice-item .cant { color:#4A5568; font-weight:600; }
  .tables-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 12px; }
  .table-block { page-break-inside:avoid; }
  .full-width { grid-column:1 / -1; }
  table { width:100%; border-collapse:collapse; font-size:10px; font-variant-numeric:tabular-nums; }
  th { text-align:left; padding:3px 6px; background:#F5F7FB; color:#0F2C6B; font-weight:600; text-transform:uppercase; font-size:8px; letter-spacing:.05em; border-bottom:1px solid #DDE0E6; }
  th.num { text-align:right; }
  td { padding:3px 6px; border-bottom:.5px solid #EEF0F4; }
  td.num { text-align:right; }
  td.ref-cell { font-weight:600; color:#0F2C6B; }
  .totales { margin-top:14px; padding-top:8px; border-top:2px solid #0F2C6B; display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; font-size:10px; color:#0A1B4A; }
  .totales strong { font-weight:700; color:#0F2C6B; }
</style></head><body>
  <div class="header">
    <div><div class="brand">
      <svg class="brand-icon" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="28" height="28" fill="none" stroke="#0F2C6B" stroke-width="6.5"/>
      </svg>
      <div><div class="brand-name">MOBILI</div><div class="subtitle">Orden de corte</div></div>
    </div></div>
    <div class="meta">${metaLine.join('')}</div>
  </div>
  <div class="section-title"><span>Índice de frentes</span><span class="meta-info">${plural(items.length, 'frente', 'frentes')} · ${plural(totalPiezas, 'pieza', 'piezas')} totales</span></div>
  <div class="indice">${indiceItems}</div>
  ${bases12.length ? `<div class="table-block full-width"><div class="section-title"><span>Base — MDF 12 mm</span><span class="meta-info">${plural(totalBases12, 'pieza', 'piezas')}</span></div>
    <table><thead><tr><th>Ref</th><th class="num">Cant</th><th class="num">Alto × Ancho (cm)</th></tr></thead><tbody>${bases12.map(fila3col).join('')}</tbody></table></div>` : ''}
  ${bases18.length ? `<div class="table-block full-width"><div class="section-title"><span>Base — MDF 18 mm (media caña)</span><span class="meta-info">${plural(totalBases18, 'pieza', 'piezas')}</span></div>
    <table><thead><tr><th>Ref</th><th class="num">Cant</th><th class="num">Alto × Ancho (cm)</th></tr></thead><tbody>${bases18.map(fila3col).join('')}</tbody></table></div>` : ''}
  ${caras9.length ? `<div class="table-block full-width"><div class="section-title"><span>Caras — MDF 9 mm (media caña)</span><span class="meta-info">${plural(totalCaras9, 'pieza', 'piezas')}</span></div>
    <table><thead><tr><th>Ref</th><th class="num">Cant</th><th class="num">Alto × Ancho (cm)</th></tr></thead><tbody>${caras9.map(fila3col).join('')}</tbody></table></div>` : ''}
  <div class="tables-grid">
    ${section('Capa 2 — verticales (3mm)', 'step', c2v)}
    ${section('Capa 2 — horizontales (3mm)', 'step', c2h)}
    ${section('Capa 3 — verticales (3mm)', 'step', c3v)}
    ${section('Capa 3 — horizontales (3mm)', 'step', c3h)}
    ${section('Fajas placar — verticales (5mm)', 'simple placar', spV)}
    ${section('Fajas placar — horizontales (5mm)', 'simple placar', spH)}
  </div>
  <div class="totales">
    <span><strong>${items.length}</strong> ${items.length === 1 ? 'frente' : 'frentes'}</span>
    ${totalBases12 ? `<span><strong>${totalBases12}</strong> ${totalBases12 === 1 ? 'base' : 'bases'} 12mm</span>` : ''}
    ${totalBases18 ? `<span><strong>${totalBases18}</strong> ${totalBases18 === 1 ? 'base' : 'bases'} 18mm</span>` : ''}
    ${totalCaras9 ? `<span><strong>${totalCaras9}</strong> caras 9mm</span>` : ''}
    ${totalC2 ? `<span><strong>${totalC2}</strong> fajas C2 (3mm)</span>` : ''}
    ${totalC3 ? `<span><strong>${totalC3}</strong> fajas C3 (3mm)</span>` : ''}
    ${totalSP ? `<span><strong>${totalSP}</strong> fajas placar (5mm)</span>` : ''}
    <span><strong>${totalPiezas}</strong> piezas totales</span>
  </div>
</body></html>`;
  }

  // ============== PRINT BATCH BY MEASURE (agrupado por ancho de corte) ==============
  function buildBatchByMeasureHTML(list, cliente, orden) {
    const esc = escapeHtml;
    const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

    const items = list.map((item, i) => {
      const r = (item.r != null) ? item.r : 1;
      const cant = (item.cant != null && item.cant >= 1) ? item.cant : 1;
      const altoBruto = item.H - 2 * CANTO + 2 * r;
      const anchoBruto = item.A - 2 * CANTO + 2 * r;
      return { ...item, ref: i + 1, r, cant, altoBruto, anchoBruto };
    });

    const bases12 = [], bases18 = [], caras9 = [];
    const tirasPorAncho = new Map(); // ancho de corte → { ancho, anchoFinal, espesor, tiras }

    for (const it of items) {
      if (it.model === 'step') {
        const c2 = it.c2 || 6.3, c3 = it.c3 || 6;
        const c2b = c2 - CANTO + it.r, c3b = c3 - CANTO + it.r;
        const c2hz = it.anchoBruto - 2 * c2b;
        const c3hz = it.anchoBruto - 2 * c3b;
        bases12.push({ ref: it.ref, cant: it.cant, alto: it.altoBruto, ancho: it.anchoBruto });
        const k2 = `3mm-${c2b.toFixed(2)}`;
        if (!tirasPorAncho.has(k2)) tirasPorAncho.set(k2, { ancho: c2b, anchoFinal: c2, espesor: '3 mm', tiras: [] });
        tirasPorAncho.get(k2).tiras.push({ ref: it.ref, cant: it.cant * 2, largo: it.altoBruto });
        tirasPorAncho.get(k2).tiras.push({ ref: it.ref, cant: it.cant * 2, largo: c2hz });
        const k3 = `3mm-${c3b.toFixed(2)}`;
        if (!tirasPorAncho.has(k3)) tirasPorAncho.set(k3, { ancho: c3b, anchoFinal: c3, espesor: '3 mm', tiras: [] });
        tirasPorAncho.get(k3).tiras.push({ ref: it.ref, cant: it.cant * 2, largo: it.altoBruto });
        tirasPorAncho.get(k3).tiras.push({ ref: it.ref, cant: it.cant * 2, largo: c3hz });
      } else if (it.model === 'simple-placar') {
        const f = it.faja || 8;
        const fb = f - CANTO + it.r;
        const fhz = it.anchoBruto - 2 * fb;
        bases12.push({ ref: it.ref, cant: it.cant, alto: it.altoBruto, ancho: it.anchoBruto });
        const k = `5mm-${fb.toFixed(2)}`;
        if (!tirasPorAncho.has(k)) tirasPorAncho.set(k, { ancho: fb, anchoFinal: f, espesor: '5 mm', tiras: [] });
        tirasPorAncho.get(k).tiras.push({ ref: it.ref, cant: it.cant * 2, largo: it.altoBruto });
        tirasPorAncho.get(k).tiras.push({ ref: it.ref, cant: it.cant * 2, largo: fhz });
      } else if (it.model === 'media-cana') {
        caras9.push({ ref: it.ref, cant: it.cant * 2, alto: it.altoBruto, ancho: it.anchoBruto });
        bases18.push({ ref: it.ref, cant: it.cant, alto: it.altoBruto, ancho: it.anchoBruto });
      }
    }

    const grupos = Array.from(tirasPorAncho.values()).sort((a, b) => a.ancho - b.ancho);

    const metaLine = [];
    if (cliente) metaLine.push(`<div><strong>Cliente:</strong> ${esc(cliente)}</div>`);
    if (orden) metaLine.push(`<div><strong>Orden N°:</strong> ${esc(orden)}</div>`);
    metaLine.push(`<div>Fecha: ${hoy}</div>`);

    const indiceItems = items.map(f => `
      <div class="indice-item">
        <span class="ref">#${f.ref}</span>
        <span class="medida">${fmt(f.H)} × ${fmt(f.A)}</span>
        <span class="cant">×${f.cant}</span>
      </div>
    `).join('');

    const fila3col = (b) => `<tr><td class="ref-cell">#${b.ref}</td><td class="num">${b.cant}</td><td class="num">${fmt(b.alto)} × ${fmt(b.ancho)}</td></tr>`;
    const filaTira = (t) => `<tr><td class="ref-cell">#${t.ref}</td><td class="num">${t.cant}</td><td class="num">${fmt(t.largo)}</td></tr>`;

    const bloqueBases = (titulo, meta, arr) => arr.length === 0 ? '' : `
      <div class="table-block"><div class="section-title"><span>${titulo}</span><span class="meta-info">${meta}</span></div>
      <table><thead><tr><th>Ref</th><th class="num">Cant</th><th class="num">Alto × Ancho (cm)</th></tr></thead><tbody>${arr.map(fila3col).join('')}</tbody></table></div>`;

    const bloquesTiras = grupos.map(g => {
      const total = g.tiras.reduce((s, t) => s + t.cant, 0);
      return `<div class="table-block">
        <div class="section-title"><span>Tiras ${g.espesor} × ${fmt(g.ancho)} cm (final ${fmt(g.anchoFinal)} cm)</span><span class="meta-info">${plural(total, 'pieza', 'piezas')}</span></div>
        <table><thead><tr><th>Ref</th><th class="num">Cant</th><th class="num">Largo (cm)</th></tr></thead><tbody>${g.tiras.map(filaTira).join('')}</tbody></table>
      </div>`;
    }).join('');

    const totalBases12 = bases12.reduce((s, b) => s + b.cant, 0);
    const totalBases18 = bases18.reduce((s, b) => s + b.cant, 0);
    const totalCaras9 = caras9.reduce((s, b) => s + b.cant, 0);
    const totalTiras = grupos.reduce((s, g) => s + g.tiras.reduce((ss, t) => ss + t.cant, 0), 0);
    const totalPiezas = totalBases12 + totalBases18 + totalCaras9 + totalTiras;

    const totalesPie = [];
    totalesPie.push(`<span><strong>${items.length}</strong> ${items.length === 1 ? 'frente' : 'frentes'}</span>`);
    if (totalBases12) totalesPie.push(`<span><strong>${totalBases12}</strong> ${totalBases12 === 1 ? 'base' : 'bases'} 12mm</span>`);
    if (totalBases18) totalesPie.push(`<span><strong>${totalBases18}</strong> ${totalBases18 === 1 ? 'base' : 'bases'} 18mm</span>`);
    if (totalCaras9) totalesPie.push(`<span><strong>${totalCaras9}</strong> caras 9mm</span>`);
    for (const g of grupos) {
      const t = g.tiras.reduce((s, x) => s + x.cant, 0);
      totalesPie.push(`<span><strong>${t}</strong> tiras ${fmt(g.ancho)}cm</span>`);
    }
    totalesPie.push(`<span><strong>${totalPiezas}</strong> piezas totales</span>`);

    return `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><title>Corte por medida — Mobili</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap">
<style>
  @page { size: A4; margin: 12mm 10mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Poppins',Arial,sans-serif; color:#0A1B4A; font-size:10px; line-height:1.35; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #0F2C6B; padding-bottom:8px; margin-bottom:12px; }
  .brand { display:flex; align-items:center; gap:10px; }
  .brand-icon { width:26px; height:26px; }
  .brand-name { font-size:22px; font-weight:800; color:#0F2C6B; letter-spacing:.03em; line-height:1; }
  .subtitle { font-size:9px; color:#4A5568; margin-top:3px; letter-spacing:.08em; text-transform:uppercase; }
  .meta { text-align:right; font-size:10px; color:#4A5568; line-height:1.5; }
  .meta strong { color:#0A1B4A; font-weight:600; }
  .section-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#0F2C6B; margin:14px 0 6px; padding-bottom:3px; border-bottom:1px solid #DDE0E6; display:flex; justify-content:space-between; align-items:baseline; }
  .section-title .meta-info { font-size:9px; color:#4A5568; font-weight:500; text-transform:none; letter-spacing:0; }
  .indice { display:grid; grid-template-columns:repeat(4,1fr); gap:4px 10px; margin-bottom:4px; }
  .indice-item { padding:3px 8px; background:#EDF1FA; border-radius:3px; display:flex; justify-content:space-between; align-items:center; gap:6px; font-size:10px; font-variant-numeric:tabular-nums; }
  .indice-item .ref { font-weight:700; color:#0F2C6B; min-width:22px; }
  .indice-item .medida { color:#0A1B4A; flex:1; text-align:center; }
  .indice-item .cant { color:#4A5568; font-weight:600; }
  .tables-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 12px; }
  .table-block { page-break-inside:avoid; }
  table { width:100%; border-collapse:collapse; font-size:10px; font-variant-numeric:tabular-nums; }
  th { text-align:left; padding:3px 6px; background:#F5F7FB; color:#0F2C6B; font-weight:600; text-transform:uppercase; font-size:8px; letter-spacing:.05em; border-bottom:1px solid #DDE0E6; }
  th.num { text-align:right; }
  td { padding:3px 6px; border-bottom:.5px solid #EEF0F4; }
  td.num { text-align:right; }
  td.ref-cell { font-weight:600; color:#0F2C6B; }
  .totales { margin-top:14px; padding-top:8px; border-top:2px solid #0F2C6B; display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; font-size:10px; color:#0A1B4A; }
  .totales strong { font-weight:700; color:#0F2C6B; }
</style></head><body>
  <div class="header">
    <div><div class="brand">
      <svg class="brand-icon" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="28" height="28" fill="none" stroke="#0F2C6B" stroke-width="6.5"/>
      </svg>
      <div><div class="brand-name">MOBILI</div><div class="subtitle">Corte por medida</div></div>
    </div></div>
    <div class="meta">${metaLine.join('')}</div>
  </div>
  <div class="section-title"><span>Índice de frentes</span><span class="meta-info">${plural(items.length, 'frente', 'frentes')} · ${plural(totalPiezas, 'pieza', 'piezas')} totales</span></div>
  <div class="indice">${indiceItems}</div>
  ${bloqueBases('Placas 12 mm — Bases', `${plural(totalBases12, 'pieza', 'piezas')}`, bases12)}
  ${bloqueBases('Placas 18 mm — Bases media caña', `${plural(totalBases18, 'pieza', 'piezas')}`, bases18)}
  ${bloqueBases('Caras 9 mm — Media caña', `${plural(totalCaras9, 'pieza', 'piezas')}`, caras9)}
  <div class="tables-grid">${bloquesTiras}</div>
  <div class="totales">${totalesPie.join('')}</div>
</body></html>`;
  }

  // ============== EVENT LISTENERS ==============

  // Selector de modelo
  function setModel(model) {
    currentModel = model;
    saveCurrentModel();
    // Update active card
    $modelSelector.querySelectorAll('.model-card').forEach(c => {
      c.classList.toggle('active', c.dataset.model === model);
    });
    // Mostrar/ocultar config avanzada por modelo
    document.querySelectorAll('.cfg-step').forEach(el => el.style.display = model === 'step' ? '' : 'none');
    document.querySelectorAll('.cfg-mc').forEach(el => el.style.display = model === 'media-cana' ? '' : 'none');
    document.querySelectorAll('.cfg-sp').forEach(el => el.style.display = model === 'simple-placar' ? '' : 'none');
    compute();
  }

  $modelSelector.addEventListener('click', (e) => {
    const card = e.target.closest('.model-card');
    if (!card) return;
    setModel(card.dataset.model);
  });

  // Inputs
  [$alto, $ancho, $cantidad, $refilado, $faja2, $faja3, $marcoMC, $surcoMC, $fajaSP].forEach(el => {
    el.addEventListener('input', () => {
      // Si cambia el refilado general, actualiza también el chip del frente (si estaba sincronizado)
      if (el === $refilado) {
        setRefiladoFrente(parseFloat($refilado.value));
      }
      compute();
      saveConfig();
    });
  });
  [$cliente, $orden].forEach(el => {
    el.addEventListener('input', () => {
      updateMeta();
      saveConfig();
    });
  });

  // Chips de refilado por frente
  $refiladoChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.refilado-chip');
    if (!chip) return;
    $refiladoChips.querySelectorAll('.refilado-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    if (chip.dataset.value === 'custom') {
      $refiladoCustom.hidden = false;
      $refiladoCustom.focus();
      $refiladoCustom.select();
    } else {
      $refiladoCustom.hidden = true;
    }
    compute();
  });
  $refiladoCustom.addEventListener('input', () => {
    compute();
  });

  // Botones de resultado
  $('btn-copy').addEventListener('click', async () => {
    const txt = buildText();
    if (!txt) return;
    try { await navigator.clipboard.writeText(txt); showToast('Lista copiada'); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      showToast('Lista copiada');
    }
  });

  $('btn-share').addEventListener('click', async () => {
    const txt = buildText();
    if (!txt) return;
    if (navigator.share) {
      try { await navigator.share({ title: 'Despiece de frente', text: txt }); } catch (e) {}
    } else {
      try { await navigator.clipboard.writeText(txt); showToast('Copiado al portapapeles'); }
      catch (e) { showToast('Compartir no disponible'); }
    }
  });

  $('btn-print').addEventListener('click', () => window.print());

  $('btn-save').addEventListener('click', () => {
    if (!currentResult) return;
    const r = currentResult;
    const list = loadHistory();
    const item = {
      model: r.model,
      H: r.H, A: r.A, r: r.r, cant: r.cant,
      cliente: $cliente.value.trim(),
      orden: $orden.value.trim(),
      t: Date.now(),
    };
    // Guardar params específicos del modelo
    if (r.model === 'step') { item.c2 = r.c2; item.c3 = r.c3; }
    else if (r.model === 'media-cana') { item.marco = r.marco; item.surco = r.surco; }
    else if (r.model === 'simple-placar') { item.faja = r.faja; }

    list.unshift(item);
    if (list.length > MAX_HISTORY) list.length = MAX_HISTORY;
    saveHistory(list);
    renderHistory();
    showToast('Guardado en historial');
  });

  // Historial - clicks (cargar/eliminar)
  $historyBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const list = loadHistory();
    if (isNaN(idx) || !list[idx]) return;
    if (btn.dataset.act === 'load') {
      const item = list[idx];
      setModel(item.model);
      $alto.value = item.H;
      $ancho.value = item.A;
      $cantidad.value = (item.cant != null && item.cant >= 1) ? item.cant : 1;
      // Restaurar refilado específico del frente en los chips
      if (item.r != null) setRefiladoFrente(item.r);
      if (item.c2 != null) $faja2.value = item.c2;
      if (item.c3 != null) $faja3.value = item.c3;
      if (item.marco != null) $marcoMC.value = item.marco;
      if (item.surco != null) $surcoMC.value = item.surco;
      if (item.faja != null) $fajaSP.value = item.faja;
      if (item.cliente) $cliente.value = item.cliente;
      if (item.orden) $orden.value = item.orden;
      saveConfig();
      compute();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('Frente cargado');
    } else if (btn.dataset.act === 'del') {
      list.splice(idx, 1);
      saveHistory(list);
      renderHistory();
    }
  });

  // Filtros historial
  $historyFilters.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    historyFilter = chip.dataset.filter;
    $historyFilters.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c === chip));
    renderHistory();
  });

  // Impresiones batch
  $('btn-print-batch').addEventListener('click', () => {
    const list = loadHistory();
    const filtered = historyFilter === 'all' ? list : list.filter(it => it.model === historyFilter);
    if (filtered.length === 0) { showToast('No hay frentes para imprimir'); return; }
    const html = buildBatchPrintHTML(filtered, $cliente.value.trim(), $orden.value.trim());
    openPrintPreview(html, 'Orden de corte');
  });

  $('btn-print-batch-measure').addEventListener('click', () => {
    const list = loadHistory();
    const filtered = historyFilter === 'all' ? list : list.filter(it => it.model === historyFilter);
    if (filtered.length === 0) { showToast('No hay frentes para imprimir'); return; }
    const html = buildBatchByMeasureHTML(filtered, $cliente.value.trim(), $orden.value.trim());
    openPrintPreview(html, 'Corte por medida');
  });

  $('btn-clear-history').addEventListener('click', () => {
    if (!confirm('¿Vaciar todo el historial? Esta acción no se puede deshacer.')) return;
    saveHistory([]);
    renderHistory();
    showToast('Historial vaciado');
  });

  // Reset config
  $('btn-reset').addEventListener('click', () => {
    $refilado.value = DEFAULTS.refilado;
    $faja2.value = DEFAULTS.faja2;
    $faja3.value = DEFAULTS.faja3;
    $marcoMC.value = DEFAULTS.marcoMC;
    $surcoMC.value = DEFAULTS.surcoMC;
    $fajaSP.value = DEFAULTS.fajaSP;
    setRefiladoFrente(DEFAULTS.refilado);
    saveConfig();
    compute();
    showToast('Valores restaurados');
  });

  // Init
  loadCurrentModel();
  loadConfig();
  // Sincronizar el chip de refilado con el valor default general al arrancar
  setRefiladoFrente(parseFloat($refilado.value) || DEFAULTS.refilado);
  setModel(currentModel);
  renderHistory();

  // Service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
