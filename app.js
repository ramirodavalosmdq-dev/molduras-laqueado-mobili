(() => {
  'use strict';

  const DEFAULTS = {
    refilado: 1,
    faja2: 6.3,
    faja3: 6,
    marcoMC: 5.5,
    surcoMC: 3.5,
    fajaSP: 8,
    espBaseSP: 12,
    espFajaSP: 5,
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
  const $espBaseSP = $('esp-base-sp');
  const $espFajaSP = $('esp-faja-sp');
  const $cantoOn = $('canto-on');
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
  let loadedRef = null; // { nro, plano } del frente cargado desde el historial
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
      if (typeof cfg.espBaseSP === 'number') $espBaseSP.value = cfg.espBaseSP;
      if (typeof cfg.espFajaSP === 'number') $espFajaSP.value = cfg.espFajaSP;
      if (typeof cfg.canto === 'boolean') $cantoOn.checked = cfg.canto;
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
        espBaseSP: parseFloat($espBaseSP.value),
        espFajaSP: parseFloat($espFajaSP.value),
        canto: $cantoOn.checked,
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
            <div class="dims">${item.nro != null ? '<span class="nro">N° ' + escapeHtml(String(item.nro)) + '</span> ' : ''}${item.tipo ? '<span class="nro">' + escapeHtml(item.tipo) + '</span> ' : ''}${dimsStr}</div>
            ${item.plano ? `<div class="plano-ref">Plano: ${escapeHtml(item.plano)}</div>` : ''}
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
    if (loadedRef && loadedRef.nro != null) parts.unshift(`<span class="nro-chip">N° ${escapeHtml(String(loadedRef.nro))}${loadedRef.plano ? ' · plano ' + escapeHtml(loadedRef.plano) : ''}</span>`);
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

  const CANTO_STD = 0.1; // 1 mm por borde en cm
  let CANTO = CANTO_STD; // vivo: depende de 'Lleva canto'
  const cantoOf = (it) => (it && it.canto != null) ? it.canto : CANTO_STD;

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
    CANTO = $cantoOn.checked ? CANTO_STD : 0;
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
    // Regla de taller: si mide menos de 18 cm se hace igual en media caña, sin la parte del centro
    d.sinCentro = (d.molduraAlto <= 0 || d.molduraAncho <= 0);
    const molduraStr = d.sinCentro ? 'Sin centro' : `${fmt(d.molduraAlto)} × ${fmt(d.molduraAncho)}`;
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
        <div class="value">${molduraStr}</div>
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
      ${d.sinCentro
        ? `<tr><td colspan="5">Sin centro: mide menos de ${fmt(d.descuento)} cm, va con media caña pero sin la parte del centro</td></tr>`
        : `<tr><td>Marco interior fresa</td><td class="num">—</td><td class="num">—</td><td class="num">${fmt(d.molduraAlto)}</td><td class="num">${fmt(d.molduraAncho)}</td></tr>`}
      <tr class="group-head"><td colspan="5">Refilado post-armado (antes del canto)</td></tr>
      <tr><td>Medida refilado</td><td class="num">—</td><td class="num">—</td><td class="num">${fmt(d.refiladoAlto)}</td><td class="num">${fmt(d.refiladoAncho)}</td></tr>
    `;

    currentResult = { model: 'media-cana', H, A, r, marco, surco, cant, ...d };
  }

  // ============== RENDER SIMPLE PLACAR ==============
  function renderSimplePlacar(H, A, cant, r) {
    const faja = parseFloat($fajaSP.value);
    const eB = parseFloat($espBaseSP.value) || 12, eF = parseFloat($espFajaSP.value) || 5;
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
      <tr><td>Placa base</td><td class="num">${nBase}</td><td class="num">${eB} mm</td><td class="num">${fmt(d.altoBruto)}</td><td class="num">${fmt(d.anchoBruto)}</td></tr>
      <tr class="group-head"><td colspan="5">Moldura — fajas corte ${fmt(d.fajaBruto)} cm (final ${fmt(faja)} cm)</td></tr>
      <tr><td>Verticales</td><td class="num">${nFaja}</td><td class="num">${eF} mm</td><td class="num">${fmt(d.altoBruto)}</td><td class="num">${fmt(d.fajaBruto)}</td></tr>
      <tr><td>Horizontales</td><td class="num">${nFaja}</td><td class="num">${eF} mm</td><td class="num">${fmt(d.fajaBruto)}</td><td class="num">${fmt(d.fajaHoriz)}</td></tr>
    `;

    currentResult = { model: 'simple-placar', H, A, r, faja, espBase: eB, espFaja: eF, cant, ...d };
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

    if (loadedRef && loadedRef.nro != null) lines.push(`PIEZA N° ${loadedRef.nro}${loadedRef.plano ? ' (plano ' + loadedRef.plano + ')' : ''}`);
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
        r.sinCentro
          ? `MOLDURA: media caña SIN CENTRO (menos de ${fmt(r.descuento)} cm)`
          : `MOLDURA INTERIOR (fresa media caña): ${fmt(r.molduraAlto)} × ${fmt(r.molduraAncho)} cm`,
      );
    } else if (r.model === 'simple-placar') {
      const nF = 2 * r.cant;
      lines.push(
        `Modelo: SIMPLE PLACAR`,
        `Medida al corte: ${fmt(r.altoBruto)} × ${fmt(r.anchoBruto)} cm`,
        `Medida refilado (antes del canto): ${fmt(r.refiladoAlto)} × ${fmt(r.refiladoAncho)} cm`,
        ``,
        `BASE`,
        `  ${r.cant} × ${r.espBase} mm — ${fmt(r.altoBruto)} × ${fmt(r.anchoBruto)} cm`,
        ``,
        `MOLDURA — fajas corte ${fmt(r.fajaBruto)} cm (final ${fmt(r.faja)} cm)`,
        `  ${nF} × ${r.espFaja} mm — ${fmt(r.altoBruto)} × ${fmt(r.fajaBruto)} cm (verticales)`,
        `  ${nF} × ${r.espFaja} mm — ${fmt(r.fajaBruto)} × ${fmt(r.fajaHoriz)} cm (horizontales)`,
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
    // Orden de corte compacta: una fila por frente con todas sus piezas (entra en 1–2 hojas A4)
    const esc = escapeHtml;
    const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

    const items = list.map((item, i) => {
      const r = (item.r != null) ? item.r : 1;
      const cant = (item.cant != null && item.cant >= 1) ? item.cant : 1;
      const c = cantoOf(item);
      const altoBruto = item.H - 2 * c + 2 * r;
      const anchoBruto = item.A - 2 * c + 2 * r;
      return { ...item, ref: item.nro != null ? item.nro : i + 1, r, cant, c, altoBruto, anchoBruto,
        eB: item.espBase || DEFAULTS.espBaseSP, eF: item.espFaja || DEFAULTS.espFajaSP };
    }).sort((a, b) => (a.nro != null && b.nro != null) ? a.nro - b.nro : 0);

    const metaLine = [];
    if (cliente) metaLine.push(`<div class="cliente">${esc(cliente)}</div>`);
    if (orden) metaLine.push(`<div><strong>Orden N°:</strong> ${esc(orden)}</div>`);
    metaLine.push(`<div>Fecha: ${hoy}</div>`);

    const mc = items.filter(it => it.model === 'media-cana');
    const st = items.filter(it => it.model === 'step');
    const sp = items.filter(it => it.model === 'simple-placar');
    const tot = { frentes: 0, b12: 0, b18: 0, c9: 0, f3: 0, bases: {}, fajas: {} };
    const chk = '<td class="chk"><span></span></td>';
    const nroCell = (f) => `<td class="ref-cell">N° ${f.ref}${f.cant > 1 ? ` <b class="x">×${f.cant}</b>` : ''}${f.tipo ? `<small class="tipo">${esc(f.tipo)}</small>` : ''}</td>`;
    const finalCell = (f) => `<td class="fin">${fmt(f.H)} × ${fmt(f.A)}${f.plano ? `<small>plano ${esc(f.plano)}</small>` : ''}</td>`;
    const corteCell = (f) => `<td class="medida-cell">${fmt(f.altoBruto)} × ${fmt(f.anchoBruto)}</td>`;
    const piece = (n, alto, ancho) => `<td class="pz"><b>${n}</b> × ${fmt(alto)} × ${fmt(ancho)}</td>`;

    let blocks = '';
    if (mc.length) {
      const rows = mc.map(f => {
        const desc = 2 * ((f.marco || DEFAULTS.marcoMC) + (f.surco || DEFAULTS.surcoMC));
        const mA = f.H - desc, mB = f.A - desc;
        const sin = mA <= 0 || mB <= 0;
        tot.frentes += f.cant; tot.b18 += f.cant; tot.c9 += 2 * f.cant;
        return `<tr>${nroCell(f)}${finalCell(f)}${corteCell(f)}<td class="num">${f.cant}</td><td class="num">${2 * f.cant}</td>${sin ? '<td class="tag">SIN CENTRO</td>' : `<td class="sub">${fmt(mA)} × ${fmt(mB)}</td>`}<td class="sub">${fmt(f.H - 2 * f.c)} × ${fmt(f.A - 2 * f.c)}</td>${chk}</tr>`;
      }).join('');
      blocks += `<div class="section-title"><span>Media caña — 3 placas iguales por frente</span><span class="meta-info">corte en cm, alto × ancho</span></div>
      <table><thead><tr><th>N°</th><th>Final · plano</th><th>Corte</th><th class="num">18 mm</th><th class="num">9 mm</th><th>Moldura int.</th><th>Refilado</th><th class="chk">✓</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    if (st.length) {
      const rows = st.map(f => {
        const c2 = f.c2 || DEFAULTS.faja2, c3 = f.c3 || DEFAULTS.faja3;
        const c2b = c2 - f.c + f.r, c3b = c3 - f.c + f.r;
        tot.frentes += f.cant; tot.b12 += f.cant; tot.f3 += 8 * f.cant;
        return `<tr>${nroCell(f)}${finalCell(f)}${corteCell(f)}${piece(2 * f.cant, f.altoBruto, c2b)}${piece(2 * f.cant, c2b, f.anchoBruto - 2 * c2b)}${piece(2 * f.cant, f.altoBruto, c3b)}${piece(2 * f.cant, c3b, f.anchoBruto - 2 * c3b)}${chk}</tr>`;
      }).join('');
      blocks += `<div class="section-title"><span>Step — base 12 mm + fajas 3 mm</span><span class="meta-info">fajas: cant × alto × ancho</span></div>
      <table><thead><tr><th>N°</th><th>Final · plano</th><th>Base 12 mm</th><th>C2 vert.</th><th>C2 horiz.</th><th>C3 vert.</th><th>C3 horiz.</th><th class="chk">✓</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    const combos = [...new Set(sp.map(f => f.eB + '/' + f.eF))];
    for (const combo of combos) {
      const grp = sp.filter(f => f.eB + '/' + f.eF === combo);
      const [eB, eF] = combo.split('/');
      const sinCanto = grp.every(f => f.c === 0);
      const rows = grp.map(f => {
        const fb = (f.faja || DEFAULTS.fajaSP) - f.c + f.r;
        tot.frentes += f.cant;
        tot.bases[eB] = (tot.bases[eB] || 0) + f.cant;
        tot.fajas[eF] = (tot.fajas[eF] || 0) + 4 * f.cant;
        return `<tr>${nroCell(f)}${finalCell(f)}${corteCell(f)}${piece(2 * f.cant, f.altoBruto, fb)}${piece(2 * f.cant, fb, f.anchoBruto - 2 * fb)}<td class="sub">${fmt(f.H - 2 * f.c)} × ${fmt(f.A - 2 * f.c)}</td>${chk}</tr>`;
      }).join('');
      blocks += `<div class="section-title"><span>Simple placar — base ${eB} mm + fajas ${eF} mm${sinCanto ? ' · SIN CANTO' : ''}</span><span class="meta-info">verticales enteras, horizontales entre medio</span></div>
      <table><thead><tr><th>N°</th><th>Final · plano</th><th>Base ${eB} mm</th><th>Faja vert.</th><th>Faja horiz.</th><th>Refilado</th><th class="chk">✓</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    const totales = [`<span><strong>${tot.frentes}</strong> frentes</span>`];
    if (tot.b12) totales.push(`<span><strong>${tot.b12}</strong> bases 12 mm</span>`);
    if (tot.b18) totales.push(`<span><strong>${tot.b18}</strong> bases 18 mm</span>`);
    if (tot.c9) totales.push(`<span><strong>${tot.c9}</strong> caras 9 mm</span>`);
    if (tot.f3) totales.push(`<span><strong>${tot.f3}</strong> fajas 3 mm</span>`);
    for (const [e, n] of Object.entries(tot.bases)) totales.push(`<span><strong>${n}</strong> bases ${e} mm</span>`);
    for (const [e, n] of Object.entries(tot.fajas)) totales.push(`<span><strong>${n}</strong> fajas ${e} mm</span>`);
    const sumObj = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    totales.push(`<span><strong>${tot.b12 + tot.b18 + tot.c9 + tot.f3 + sumObj(tot.bases) + sumObj(tot.fajas)}</strong> piezas totales</span>`);

    return `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><title>Orden de corte — Mobili</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap">
<style>
  @page { size: A4; margin: 10mm 10mm 10mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Poppins',Arial,sans-serif; color:#0A1B4A; font-size:11px; line-height:1.3; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .header { display:flex; justify-content:space-between; align-items:center; gap:16px; background:#0F2C6B; color:#fff; border-radius:7px; padding:9px 14px; margin-bottom:8px; }
  .brand { display:flex; align-items:center; gap:10px; }
  .brand-icon { width:26px; height:26px; }
  .brand-name { font-size:21px; font-weight:800; letter-spacing:.04em; line-height:1; }
  .subtitle { font-size:13px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; margin-top:3px; }
  .meta { text-align:right; font-size:11px; line-height:1.5; color:#DCE4F5; }
  .meta strong { color:#fff; }
  .meta .cliente { font-size:14px; color:#fff; font-weight:700; }
  .section-title { font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:#0F2C6B; margin:10px 0 4px; padding:4px 9px; background:#E8EEFA; border-left:5px solid #0F2C6B; border-radius:3px; display:flex; justify-content:space-between; align-items:baseline; gap:10px; }
  .section-title .meta-info { font-size:10.5px; font-weight:600; text-transform:none; letter-spacing:0; white-space:nowrap; }
  table { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
  thead { display:table-header-group; }
  tr { page-break-inside:avoid; }
  th { text-align:left; padding:4px 6px; color:#5B6782; font-weight:700; text-transform:uppercase; font-size:9px; letter-spacing:.05em; border-bottom:2px solid #0F2C6B; white-space:nowrap; }
  th.num, td.num { text-align:center; }
  td { padding:4px 6px; border-bottom:1px solid #DCE2EE; font-size:12px; white-space:nowrap; vertical-align:middle; }
  tbody tr:nth-child(even) td { background:#F6F8FC; }
  td.ref-cell { font-weight:800; color:#0F2C6B; font-size:13px; }
  td.ref-cell .x { font-size:11px; color:#B4232A; margin-left:2px; }
  td.ref-cell .tipo { display:block; font-size:9.5px; font-weight:700; color:#5B6782; text-transform:uppercase; letter-spacing:.04em; }
  td.fin { font-size:11px; color:#3A4766; line-height:1.15; }
  td.fin small { display:block; font-size:9px; color:#7A84A0; }
  td.medida-cell { font-size:15px; font-weight:800; }
  td.num { font-weight:800; font-size:14px; }
  td.pz { font-size:12px; font-weight:600; }
  td.pz b { color:#0F2C6B; }
  td.sub { font-size:12.5px; font-weight:600; }
  td.tag { font-size:10.5px; font-weight:800; color:#9A5B00; }
  th.chk, td.chk { width:26px; text-align:center; }
  td.chk span { display:inline-block; width:14px; height:14px; border:1.5px solid #0F2C6B; border-radius:3px; vertical-align:middle; }
  .totales { margin-top:10px; border:2px solid #0F2C6B; border-radius:7px; display:flex; page-break-inside:avoid; }
  .totales > span { flex:1 1 0; padding:5px 8px; text-align:center; font-size:10px; color:#3A4766; border-right:1px solid #C9D3EA; }
  .totales > span:last-child { border-right:none; background:#0F2C6B; color:#fff; }
  .totales strong { display:block; font-size:17px; font-weight:800; color:#0F2C6B; line-height:1.1; }
  .totales > span:last-child strong { color:#fff; }
  .nota { margin-top:6px; font-size:9.5px; color:#5B6782; }
  .firma { margin-top:16px; display:flex; gap:24px; font-size:10px; color:#5B6782; page-break-inside:avoid; }
  .firma div { flex:1; border-top:1px solid #8A94AD; padding-top:3px; }
</style></head><body>
  <div class="header">
    <div class="brand">
      <svg class="brand-icon" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="28" height="28" fill="none" stroke="#FFFFFF" stroke-width="6.5"/></svg>
      <div><div class="brand-name">MOBILI</div><div class="subtitle">Orden de corte</div></div>
    </div>
    <div class="meta">${metaLine.join('')}</div>
  </div>
  ${blocks}
  <div class="totales">${totales.join('')}</div>
  <p class="nota">Medidas en cm. Corte = final − canto + 2 × refilado por lado. Refilado = medida antes de pegar el canto (1 mm por borde; sin canto, igual a la final).${mc.length ? ' Media caña: las placas de 18 mm y 9 mm se cortan a la misma medida; menos de 18 cm va sin centro.' : ''}</p>
  <div class="firma"><div>Cortó</div><div>Controló</div><div>Fecha de corte</div></div>
</body></html>`;
  }

  // ============== PRINT BATCH BY MEASURE (agrupado por ancho de corte) ==============
  function buildBatchByMeasureHTML(list, cliente, orden) {
    const esc = escapeHtml;
    const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

    const items = list.map((item, i) => {
      const r = (item.r != null) ? item.r : 1;
      const cant = (item.cant != null && item.cant >= 1) ? item.cant : 1;
      const c = cantoOf(item);
      const altoBruto = item.H - 2 * c + 2 * r;
      const anchoBruto = item.A - 2 * c + 2 * r;
      return { ...item, ref: item.nro != null ? item.nro : i + 1, r, cant, c, altoBruto, anchoBruto,
        eB: item.espBase || DEFAULTS.espBaseSP, eF: item.espFaja || DEFAULTS.espFajaSP };
    }).sort((a, b) => (a.nro != null && b.nro != null) ? a.nro - b.nro : 0);

    const bases12 = [], bases18 = [], caras9 = [];
    const basesOtras = new Map(); // espesor (mm) → bases de placar con espesor distinto de 12
    const tirasPorAncho = new Map(); // ancho de corte → { ancho, anchoFinal, espesor, tiras }

    for (const it of items) {
      if (it.model === 'step') {
        const c2 = it.c2 || 6.3, c3 = it.c3 || 6;
        const c2b = c2 - it.c + it.r, c3b = c3 - it.c + it.r;
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
        const fb = f - it.c + it.r;
        const fhz = it.anchoBruto - 2 * fb;
        if (it.eB === 12) bases12.push({ ref: it.ref, cant: it.cant, alto: it.altoBruto, ancho: it.anchoBruto });
        else { if (!basesOtras.has(it.eB)) basesOtras.set(it.eB, []); basesOtras.get(it.eB).push({ ref: it.ref, cant: it.cant, alto: it.altoBruto, ancho: it.anchoBruto }); }
        const k = `${it.eF}mm-${fb.toFixed(2)}`;
        if (!tirasPorAncho.has(k)) tirasPorAncho.set(k, { ancho: fb, anchoFinal: f, espesor: it.eF + ' mm', tiras: [] });
        tirasPorAncho.get(k).tiras.push({ ref: it.ref, cant: it.cant * 2, largo: it.altoBruto });
        tirasPorAncho.get(k).tiras.push({ ref: it.ref, cant: it.cant * 2, largo: fhz });
      } else if (it.model === 'media-cana') {
        caras9.push({ ref: it.ref, cant: it.cant * 2, alto: it.altoBruto, ancho: it.anchoBruto });
        bases18.push({ ref: it.ref, cant: it.cant, alto: it.altoBruto, ancho: it.anchoBruto });
      }
    }

    const grupos = Array.from(tirasPorAncho.values()).sort((a, b) => a.ancho - b.ancho);

    const metaLine = [];
    if (cliente) metaLine.push(`<div class="cliente">${esc(cliente)}</div>`);
    if (orden) metaLine.push(`<div><strong>Orden N°:</strong> ${esc(orden)}</div>`);
    metaLine.push(`<div>Fecha: ${hoy}</div>`);

    const indiceItems = items.map(f => `
      <div class="indice-item">
        <span class="ref">N° ${f.ref}</span>
        <span class="cant">×${f.cant}</span>
        <span class="medida">${fmt(f.H)} × ${fmt(f.A)} cm</span>
        ${f.plano ? '<span class="plano">plano ' + esc(f.plano) + '</span>' : ''}
      </div>
    `).join('');

    const fila3col = (b) => `<tr><td class="ref-cell">N° ${b.ref}</td><td class="num">${b.cant}</td><td class="medida-cell">${fmt(b.alto)} × ${fmt(b.ancho)}</td><td class="chk"><span></span></td></tr>`;
    const filaTira = (t) => `<tr><td class="ref-cell">N° ${t.ref}</td><td class="num">${t.cant}</td><td class="medida-cell">${fmt(t.largo)}</td><td class="chk"><span></span></td></tr>`;

    const bloqueBases = (titulo, meta, arr) => arr.length === 0 ? '' : `
      <div class="table-block"><div class="section-title"><span>${titulo}</span><span class="meta-info">${meta}</span></div>
      <table><thead><tr><th>N°</th><th class="num">Cant</th><th>Corte alto × ancho</th><th class="chk">✓</th></tr></thead><tbody>${arr.map(fila3col).join('')}</tbody></table></div>`;

    const bloquesTiras = grupos.map(g => {
      const total = g.tiras.reduce((s, t) => s + t.cant, 0);
      return `<div class="table-block">
        <div class="section-title"><span>Tiras ${g.espesor} × ${fmt(g.ancho)} cm (final ${fmt(g.anchoFinal)} cm)</span><span class="meta-info">${plural(total, 'pieza', 'piezas')}</span></div>
        <table><thead><tr><th>N°</th><th class="num">Cant</th><th>Largo de corte (cm)</th><th class="chk">✓</th></tr></thead><tbody>${g.tiras.map(filaTira).join('')}</tbody></table>
      </div>`;
    }).join('');

    const totalBases12 = bases12.reduce((s, b) => s + b.cant, 0);
    const totalBases18 = bases18.reduce((s, b) => s + b.cant, 0);
    const totalCaras9 = caras9.reduce((s, b) => s + b.cant, 0);
    const totalTiras = grupos.reduce((s, g) => s + g.tiras.reduce((ss, t) => ss + t.cant, 0), 0);
    const totalOtras = [...basesOtras.values()].reduce((s, arr) => s + arr.reduce((ss, b) => ss + b.cant, 0), 0);
    const totalPiezas = totalBases12 + totalBases18 + totalCaras9 + totalTiras + totalOtras;

    const totalesPie = [];
    const nFrentes = items.reduce((s, it) => s + it.cant, 0);
    totalesPie.push(`<span><strong>${nFrentes}</strong> ${nFrentes === 1 ? 'frente' : 'frentes'}</span>`);
    if (totalBases12) totalesPie.push(`<span><strong>${totalBases12}</strong> ${totalBases12 === 1 ? 'base' : 'bases'} 12mm</span>`);
    if (totalBases18) totalesPie.push(`<span><strong>${totalBases18}</strong> ${totalBases18 === 1 ? 'base' : 'bases'} 18mm</span>`);
    if (totalCaras9) totalesPie.push(`<span><strong>${totalCaras9}</strong> caras 9mm</span>`);
    for (const [e, arr] of basesOtras) { const n = arr.reduce((s, b) => s + b.cant, 0); totalesPie.push(`<span><strong>${n}</strong> bases ${e}mm</span>`); }
    for (const g of grupos) {
      const t = g.tiras.reduce((s, x) => s + x.cant, 0);
      totalesPie.push(`<span><strong>${t}</strong> tiras ${fmt(g.ancho)}cm</span>`);
    }
    totalesPie.push(`<span><strong>${totalPiezas}</strong> piezas totales</span>`);

    return `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><title>Corte por medida — Mobili</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap">
<style>
  @page { size: A4; margin: 10mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Poppins',Arial,sans-serif; color:#0A1B4A; font-size:10.5px; line-height:1.3; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .header { display:flex; justify-content:space-between; align-items:center; gap:16px; background:#0F2C6B; color:#fff; border-radius:7px; padding:9px 14px; margin-bottom:8px; }
  .brand { display:flex; align-items:center; gap:10px; }
  .brand-icon { width:26px; height:26px; }
  .brand-name { font-size:21px; font-weight:800; letter-spacing:.04em; line-height:1; }
  .subtitle { font-size:13px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; margin-top:3px; }
  .meta { text-align:right; font-size:11px; line-height:1.5; color:#DCE4F5; }
  .meta strong { color:#fff; }
  .meta .cliente { font-size:14px; color:#fff; font-weight:700; }
  .section-title { font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:#0F2C6B; margin:8px 0 3px; padding:3px 8px; background:#E8EEFA; border-left:4px solid #0F2C6B; border-radius:3px; display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
  .section-title .meta-info { font-size:10px; font-weight:600; text-transform:none; letter-spacing:0; white-space:nowrap; }
  .indice { display:grid; grid-template-columns:repeat(6,1fr); gap:3px; }
  .indice-item { border:1px solid #C9D3EA; border-radius:4px; padding:2px 5px; display:flex; gap:4px; align-items:baseline; flex-wrap:wrap; font-size:9.5px; font-variant-numeric:tabular-nums; }
  .indice-item .ref { font-weight:800; color:#0F2C6B; }
  .indice-item .cant { font-weight:700; color:#B4232A; }
  .indice-item .medida { font-weight:600; }
  .indice-item .plano { display:none; }
  .tables-grid { columns:2; column-gap:14px; }
  .table-block { break-inside:auto; margin-bottom:2px; }
  tr { break-inside:avoid; }
  .section-title { break-after:avoid; }
  table { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
  th { text-align:left; padding:3px 6px; color:#5B6782; font-weight:700; text-transform:uppercase; font-size:8.5px; letter-spacing:.05em; border-bottom:2px solid #0F2C6B; white-space:nowrap; }
  th.num, td.num { text-align:center; }
  td { padding:3px 6px; border-bottom:1px solid #DCE2EE; font-size:11.5px; white-space:nowrap; }
  tbody tr:nth-child(even) td { background:#F6F8FC; }
  td.ref-cell { font-weight:800; color:#0F2C6B; }
  td.num { font-weight:800; }
  td.medida-cell { font-size:13px; font-weight:800; }
  th.chk, td.chk { width:22px; text-align:center; }
  td.chk span { display:inline-block; width:12px; height:12px; border:1.5px solid #0F2C6B; border-radius:3px; vertical-align:middle; }
  .totales { margin-top:8px; border:2px solid #0F2C6B; border-radius:7px; display:flex; flex-wrap:wrap; break-inside:avoid; }
  .totales > span { flex:1 1 0; min-width:70px; padding:4px 6px; text-align:center; font-size:9.5px; color:#3A4766; border-right:1px solid #C9D3EA; }
  .totales > span:last-child { border-right:none; background:#0F2C6B; color:#fff; }
  .totales strong { display:block; font-size:15px; font-weight:800; color:#0F2C6B; line-height:1.1; }
  .totales > span:last-child strong { color:#fff; }
  .firma { margin-top:14px; display:flex; gap:24px; font-size:10px; color:#5B6782; break-inside:avoid; }
  .firma div { flex:1; border-top:1px solid #8A94AD; padding-top:3px; }
</style></head><body>
  <div class="header">
    <div><div class="brand">
      <svg class="brand-icon" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="28" height="28" fill="none" stroke="#FFFFFF" stroke-width="6.5"/>
      </svg>
      <div><div class="brand-name">MOBILI</div><div class="subtitle">Corte por medida</div></div>
    </div></div>
    <div class="meta">${metaLine.join('')}</div>
  </div>
  <div class="section-title"><span>Índice de frentes</span><span class="meta-info">${plural(nFrentes, 'frente', 'frentes')} · ${plural(totalPiezas, 'pieza', 'piezas')} totales</span></div>
  <div class="indice">${indiceItems}</div>
  <div class="tables-grid">
  ${bloqueBases('Placas 12 mm — Bases', `${plural(totalBases12, 'pieza', 'piezas')}`, bases12)}
  ${[...basesOtras].map(([e, arr]) => bloqueBases(`Placas ${e} mm — Bases placar`, plural(arr.reduce((s, b) => s + b.cant, 0), 'pieza', 'piezas'), arr)).join('')}
  ${bloqueBases('Placas 18 mm — Bases media caña', `${plural(totalBases18, 'pieza', 'piezas')}`, bases18)}
  ${bloqueBases('Caras 9 mm — Media caña', `${plural(totalCaras9, 'pieza', 'piezas')}`, caras9)}
  ${bloquesTiras}
  </div>
  <div class="totales">${totalesPie.join('')}</div>
  <div class="firma"><div>Cortó</div><div>Controló</div><div>Fecha de corte</div></div>
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
  [$alto, $ancho, $cantidad, $refilado, $faja2, $faja3, $marcoMC, $surcoMC, $fajaSP, $espBaseSP, $espFajaSP, $cantoOn].forEach(el => {
    el.addEventListener('change', () => { compute(); saveConfig(); });
    el.addEventListener('input', () => {
      // Si cambia el refilado general, actualiza también el chip del frente (si estaba sincronizado)
      if (el === $refilado) {
        setRefiladoFrente(parseFloat($refilado.value));
      }
      if ((el === $alto || el === $ancho) && loadedRef) loadedRef = null;
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
    if (loadedRef && loadedRef.nro != null) { item.nro = loadedRef.nro; }
    item.canto = CANTO;
    if (r.model === 'step') { item.c2 = r.c2; item.c3 = r.c3; }
    else if (r.model === 'media-cana') { item.marco = r.marco; item.surco = r.surco; }
    else if (r.model === 'simple-placar') { item.faja = r.faja; item.espBase = r.espBase; item.espFaja = r.espFaja; }

    const same = item.nro != null ? list.findIndex(x => x.nro === item.nro) : -1;
    if (same >= 0) {
      list[same] = { ...list[same], ...item };
      saveHistory(list);
      renderHistory();
      showToast(`N° ${item.nro} actualizado`);
      return;
    }
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
      loadedRef = item.nro != null ? { nro: item.nro, plano: item.plano || item.tipo || '' } : null;
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
      $espBaseSP.value = item.espBase != null ? item.espBase : DEFAULTS.espBaseSP;
      $espFajaSP.value = item.espFaja != null ? item.espFaja : DEFAULTS.espFajaSP;
      $cantoOn.checked = cantoOf(item) > 0;
      if (item.cliente) $cliente.value = item.cliente;
      if (item.orden) $orden.value = item.orden;
      saveConfig();
      compute();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      updateMeta();
      showToast(item.nro != null ? `N° ${item.nro} cargado` : 'Frente cargado');
    } else if (btn.dataset.act === 'del') {
      list.splice(idx, 1);
      saveHistory(list);
      renderHistory();
    }
  });

  // ============== MENÚ HAMBURGUESA + BIBLIOTECA DE TRABAJOS ==============
  const APP_VERSION = 'v1.5';
  const JOB_KEY = 'mobili-molduras-trabajo-activo-v1';
  const $drawer = $('drawer');
  const $drawerOverlay = $('drawer-overlay');
  const $btnMenu = $('btn-menu');
  const $jobsList = $('jobs-list');
  let jobsCache = null;

  function openDrawer() {
    $drawer.classList.add('open');
    $drawer.setAttribute('aria-hidden', 'false');
    $drawerOverlay.hidden = false;
    $btnMenu.setAttribute('aria-expanded', 'true');
    document.body.classList.add('drawer-lock');
    const n = loadHistory().length;
    $('drawer-hist-count').textContent = n ? n + ' frentes' : '';
    loadJobs();
  }
  function closeDrawer() {
    $drawer.classList.remove('open');
    $drawer.setAttribute('aria-hidden', 'true');
    $drawerOverlay.hidden = true;
    $btnMenu.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-lock');
  }
  $btnMenu.addEventListener('click', openDrawer);
  $('btn-menu-close').addEventListener('click', closeDrawer);
  $drawerOverlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $drawer.classList.contains('open')) closeDrawer(); });
  $('drawer-version').textContent = `Molduras Laqueado · ${APP_VERSION}`;

  function activeJob() { try { return localStorage.getItem(JOB_KEY) || ''; } catch (e) { return ''; } }

  function renderJobs() {
    if (!jobsCache) return;
    const act = activeJob();
    $jobsList.innerHTML = jobsCache.length ? jobsCache.map(t => `
      <div class="job-card${t.archivo === act ? ' active' : ''}">
        <div class="job-name">${escapeHtml(t.nombre)}</div>
        <div class="job-meta">
          <span class="job-tag">${escapeHtml(MODEL_LABELS[t.modelo] || t.modelo)}</span>
          <span>${t.frentes} frentes${t.fecha ? ' · ' + escapeHtml(t.fecha) : ''}</span>
          ${t.archivo === act ? '<span>· cargado</span>' : ''}
        </div>
        <div class="job-actions">
          <button type="button" class="primary" data-job="${escapeHtml(t.archivo)}">${t.archivo === act ? 'Volver a cargar' : 'Cargar'}</button>
        </div>
      </div>`).join('') : '<div class="drawer-hint">Todavía no hay trabajos en la biblioteca.</div>';
  }

  async function loadJobs() {
    if (jobsCache) renderJobs();
    try {
      jobsCache = await fetch('./trabajos/index.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw 0; return r.json(); });
      renderJobs();
    } catch (e) {
      if (!jobsCache) $jobsList.innerHTML = '<div class="drawer-hint">No se pudo leer la biblioteca. Revisá la conexión.</div>';
    }
  }

  async function importJob(file) {
    const job = await fetch('./trabajos/' + file, { cache: 'no-cache' }).then(r => { if (!r.ok) throw 0; return r.json(); });
    const prev = loadHistory();
    if (prev.length && !confirm(`Esto reemplaza el historial actual (${prev.length} frentes) por "${job.nombre}". ¿Seguir?`)) return false;
    const now = Date.now();
    const frentes = job.frentes.slice().sort((a, b) => a.nro - b.nro);
    const list = frentes.map((f, i) => ({
      model: job.modelo, nro: f.nro, tipo: f.tipo || '', plano: f.plano || '', H: f.alto, A: f.ancho, cant: f.cant,
      r: f.r != null ? f.r : (job.refilado != null ? job.refilado : 1),
      marco: job.marco, surco: job.surco, c2: job.c2, c3: job.c3, faja: job.faja,
      espBase: job.espBase, espFaja: job.espFaja, canto: job.canto != null ? job.canto : CANTO_STD,
      cliente: job.cliente || '', orden: job.orden || '', t: now - i,
    }));
    loadedRef = null;
    saveHistory(list.slice(0, MAX_HISTORY));
    try { localStorage.setItem(JOB_KEY, file); } catch (e) { /* ignore */ }
    $cliente.value = job.cliente || '';
    $orden.value = job.orden || '';
    historyFilter = 'all';
    $historyFilters.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));
    saveConfig();
    renderHistory();
    updateMeta();
    showToast(`Cargado: ${list.length} frentes`);
    return true;
  }

  $jobsList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-job]');
    if (!btn) return;
    try {
      if (await importJob(btn.dataset.job)) { closeDrawer(); goTo('historial'); }
    } catch (err) { showToast('No se pudo cargar el trabajo'); }
  });

  function goTo(where) {
    const el = $(where === 'config' ? 'sec-config' : 'sec-historial');
    el.open = true;
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  $drawer.addEventListener('click', async (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { closeDrawer(); goTo(go.dataset.go); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    if (a === 'print-batch' || a === 'print-measure') {
      closeDrawer();
      $(a === 'print-batch' ? 'btn-print-batch' : 'btn-print-batch-measure').click();
    } else if (a === 'copy-list') {
      const list = loadHistory();
      if (!list.length) { showToast('El historial está vacío'); return; }
      const head = [$cliente.value.trim(), $orden.value.trim() && 'Orden ' + $orden.value.trim()].filter(Boolean).join(' · ');
      const txt = (head ? head + '\n' : '') + list.map((it, i) => {
        const cant = it.cant >= 1 ? it.cant : 1;
        return `${it.nro != null ? 'N° ' + it.nro : '#' + (i + 1)} · ${MODEL_LABELS[it.model] || it.model} · ${fmt(it.H)} × ${fmt(it.A)} cm${cant > 1 ? ' ×' + cant : ''}`;
      }).join('\n');
      try { await navigator.clipboard.writeText(txt); showToast('Lista copiada'); }
      catch (err) { showToast('No se pudo copiar'); }
    } else if (a === 'formulas') {
      const f = $('formulas'); f.hidden = !f.hidden;
    } else if (a === 'update') {
      showToast('Actualizando…');
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch (err) { /* ignore */ }
      setTimeout(() => location.reload(), 400);
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
    $espBaseSP.value = DEFAULTS.espBaseSP;
    $espFajaSP.value = DEFAULTS.espFajaSP;
    $cantoOn.checked = true;
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
