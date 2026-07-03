/**
 * SESCINC SBGL Dashboard — Manual Entry
 * Manual data entry forms for TAF, TPEPR, TR, and Teórica
 */
(function () {
  'use strict';

  window.SESCINC = window.SESCINC || {};

  const EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'FOLGUISTA'];
  const FUNCOES = ['BA', 'BA2', 'BA-MC', 'BA-LR', 'BA-RE', 'BA-CE', 'BA-MA', 'OC'];
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const CCIS = ['1°CCI', '2°CCI', '3°CCI'];

  const FORMS = ['form-taf', 'form-tpepr', 'form-tr', 'form-teorica'];

  /* ── Helpers ── */

  function $(sel) { return document.querySelector(sel); }
  function $id(id) { return document.getElementById(id); }

  function showToast(msg, type) {
    if (window.SESCINC.Export && window.SESCINC.Export.showToast) {
      window.SESCINC.Export.showToast(msg, type);
    }
  }

  function populateSelect(selectId, options, placeholder) {
    const sel = $id(selectId);
    if (!sel) return;
    sel.innerHTML = '';
    if (placeholder) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = placeholder;
      opt.disabled = true;
      opt.selected = true;
      sel.appendChild(opt);
    }
    options.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      sel.appendChild(opt);
    });
  }

  function getStorageKey(type) {
    const keys = window.SESCINC.STORAGE_KEYS || {};
    const map = {
      taf: keys.TAF || 'sescinc_taf',
      tpepr: keys.TPEPR || 'sescinc_tpepr',
      tr: keys.TR || 'sescinc_tr',
      teorica: keys.TEORICA || 'sescinc_teorica'
    };
    return map[type] || null;
  }

  function loadFromStorage(key) {
    if (window.SESCINC.Storage && window.SESCINC.Storage.load) {
      return window.SESCINC.Storage.load(key);
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveToStorage(key, data) {
    if (window.SESCINC.Storage && window.SESCINC.Storage.save) {
      window.SESCINC.Storage.save(key, data);
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('[ManualEntry] Save error:', e);
    }
  }

  /* ── Form visibility ── */

  function showForm(type) {
    console.log('[ManualEntry] Showing form for:', type);

    FORMS.forEach(formId => {
      const el = $id(formId);
      if (el) el.style.display = 'none';
    });

    const targetForm = $id('form-' + type);
    if (targetForm) targetForm.style.display = '';

    // Populate selects for the form
    switch (type) {
      case 'taf':
        populateSelect('manual-taf-equipe', EQUIPES, 'Selecione a equipe');
        populateSelect('manual-taf-funcao', FUNCOES, 'Selecione a função');
        break;
      case 'tpepr':
        populateSelect('manual-tpepr-equipe', EQUIPES, 'Selecione a equipe');
        populateSelect('manual-tpepr-funcao', FUNCOES, 'Selecione a função');
        break;
      case 'tr':
        populateSelect('manual-tr-equipe', EQUIPES, 'Selecione a equipe');
        populateSelect('manual-tr-mes', MESES, 'Selecione o mês');
        populateSelect('manual-tr-cci', CCIS, 'Selecione o CCI');
        break;
      case 'teorica':
        populateSelect('manual-teorica-equipe', EQUIPES, 'Selecione a equipe');
        populateSelect('manual-teorica-funcao', FUNCOES, 'Selecione a função');
        break;
    }
  }

  /* ── Record creation ── */

  function createTAFRecord() {
    const nome = ($id('manual-taf-nome') || {}).value || '';
    const equipe = ($id('manual-taf-equipe') || {}).value || '';
    const funcao = ($id('manual-taf-funcao') || {}).value || '';
    const idade = parseInt(($id('manual-taf-idade') || {}).value) || null;
    const flexao = parseInt(($id('manual-taf-flexao') || {}).value) || 0;
    const abdominal = parseInt(($id('manual-taf-abdominal') || {}).value) || 0;
    const barra = parseInt(($id('manual-taf-barra') || {}).value) || 0;
    const corrida = ($id('manual-taf-corrida') || {}).value || '';
    const resultado = ($id('manual-taf-resultado') || {}).value || '';

    if (!nome || !equipe || !resultado) {
      showToast('Preencha os campos obrigatórios: Nome, Equipe e Resultado.', 'error');
      return null;
    }

    // Parse corrida to seconds
    let corridaSeconds = 0;
    if (corrida) {
      const parts = corrida.split(':');
      if (parts.length === 2) {
        corridaSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      } else {
        corridaSeconds = parseInt(corrida) || 0;
      }
    }

    return {
      nome, equipe, funcao, idade, flexao, abdominal, barra,
      corrida, corridaSeconds, resultado,
      status: 'ok',
      _manual: true,
      _addedAt: new Date().toISOString()
    };
  }

  function createTPEPRRecord() {
    const nome = ($id('manual-tpepr-nome') || {}).value || '';
    const equipe = ($id('manual-tpepr-equipe') || {}).value || '';
    const funcao = ($id('manual-tpepr-funcao') || {}).value || '';
    const tempoInput = ($id('manual-tpepr-tempo') || {}).value || '';

    if (!nome || !equipe || !tempoInput) {
      showToast('Preencha os campos obrigatórios: Nome, Equipe e Tempo.', 'error');
      return null;
    }

    let tempoSeconds = 0;
    let tempoFormatted = tempoInput;
    if (tempoInput.includes(':')) {
      const parts = tempoInput.split(':');
      tempoSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else {
      tempoSeconds = parseInt(tempoInput) || 0;
      const m = Math.floor(tempoSeconds / 60);
      const s = tempoSeconds % 60;
      tempoFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // Determine resultado based on time (aligned with spreadsheet: Excelente <= 60s, Bom <= 90s, Ruim > 90s)
    let resultado = 'Ruim';
    if (tempoSeconds <= 60) resultado = 'Excelente';
    else if (tempoSeconds <= 90) resultado = 'Bom';

    return {
      nome, equipe, funcao, tempoSeconds, tempoFormatted, resultado,
      _manual: true,
      _addedAt: new Date().toISOString()
    };
  }

  function createTRRecord() {
    const cabeceira = ($id('manual-tr-cabeceira') || {}).value || '';
    const equipe = ($id('manual-tr-equipe') || {}).value || '';
    const mes = ($id('manual-tr-mes') || {}).value || '';
    const cci = ($id('manual-tr-cci') || {}).value || '';
    const tempoInput = ($id('manual-tr-tempo') || {}).value || '';

    if (!equipe || !mes || !cci || !tempoInput) {
      showToast('Preencha os campos obrigatórios: Equipe, Mês, CCI e Tempo.', 'error');
      return null;
    }

    let tempoSeconds = 0;
    let tempoFormatted = tempoInput;
    if (tempoInput.includes(':')) {
      const parts = tempoInput.split(':');
      tempoSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else {
      tempoSeconds = parseInt(tempoInput) || 0;
      const m = Math.floor(tempoSeconds / 60);
      const s = tempoSeconds % 60;
      tempoFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    const mesIndex = MESES.indexOf(mes);

    return {
      cabeceira, equipe, mes, mesIndex, cci, tempoSeconds, tempoFormatted,
      status: 'ok',
      _manual: true,
      _addedAt: new Date().toISOString()
    };
  }

  function createTeoricaRecord() {
    const nome = ($id('manual-teorica-nome') || {}).value || '';
    const funcao = ($id('manual-teorica-funcao') || {}).value || '';
    const equipe = ($id('manual-teorica-equipe') || {}).value || '';
    const nota = parseFloat(($id('manual-teorica-nota') || {}).value);
    const aeroporto = ($id('manual-teorica-aeroporto') || {}).value || 'SBGL';

    if (!nome || !equipe || isNaN(nota)) {
      showToast('Preencha os campos obrigatórios: Nome, Equipe e Nota.', 'error');
      return null;
    }

    return {
      id: 'M-' + Date.now(),
      nome, funcao, funcaoOriginal: funcao, aeroporto, nota, equipe,
      questoes: [],
      _manual: true,
      _addedAt: new Date().toISOString()
    };
  }

  /* ── Save record ── */

  function saveRecord() {
    const typeSelect = $id('manual-type-select');
    const type = typeSelect ? typeSelect.value : '';
    if (!type) {
      showToast('Selecione o tipo de registro.', 'error');
      return;
    }

    let record = null;
    switch (type) {
      case 'taf': record = createTAFRecord(); break;
      case 'tpepr': record = createTPEPRRecord(); break;
      case 'tr': record = createTRRecord(); break;
      case 'teorica': record = createTeoricaRecord(); break;
    }

    if (!record) return;

    // Load existing data and append
    const storageKey = getStorageKey(type);
    if (!storageKey) {
      showToast('Erro interno: chave de armazenamento não encontrada.', 'error');
      return;
    }

    const existing = loadFromStorage(storageKey) || { records: [], uploadedAt: null };
    existing.records.push(record);
    existing.uploadedAt = existing.uploadedAt || new Date().toISOString();
    saveToStorage(storageKey, existing);

    console.log('[ManualEntry] Record saved:', type, record);
    showToast('Registro salvo com sucesso!', 'success');

    // Clear form
    clearForm(type);

    // Refresh dashboard
    if (window.SESCINC.App && window.SESCINC.App.refresh) {
      window.SESCINC.App.refresh();
    }

    // Update manual records list
    renderManualRecords();
  }

  /* ── Clear form ── */

  function clearForm(type) {
    const form = $id('form-' + type);
    if (!form) return;
    form.querySelectorAll('input:not([type="button"]):not([type="submit"])').forEach(input => {
      input.value = '';
    });
    form.querySelectorAll('select').forEach(sel => {
      sel.selectedIndex = 0;
    });
  }

  /* ── Delete record ── */

  function deleteManualRecord(type, addedAt) {
    const storageKey = getStorageKey(type);
    if (!storageKey) return;

    const data = loadFromStorage(storageKey);
    if (!data || !data.records) return;

    data.records = data.records.filter(r => r._addedAt !== addedAt);
    saveToStorage(storageKey, data);

    showToast('Registro removido.', 'success');
    renderManualRecords();

    if (window.SESCINC.App && window.SESCINC.App.refresh) {
      window.SESCINC.App.refresh();
    }
  }

  /* ── Render manual records list ── */

  function renderManualRecords() {
    const container = $id('manual-records');
    if (!container) return;

    container.innerHTML = '';
    const types = ['taf', 'tpepr', 'tr', 'teorica'];
    const typeLabels = { taf: 'TAF', tpepr: 'TP-EPR', tr: 'TR', teorica: 'Teórica' };
    let hasRecords = false;

    types.forEach(type => {
      const storageKey = getStorageKey(type);
      if (!storageKey) return;

      const data = loadFromStorage(storageKey);
      if (!data || !data.records) return;

      const manualRecords = data.records.filter(r => r._manual);
      if (!manualRecords.length) return;
      hasRecords = true;

      manualRecords.forEach(r => {
        const div = document.createElement('div');
        div.className = 'manual-record-item';

        const label = r.nome || r.cabeceira || r.id || '—';
        const date = r._addedAt ? new Date(r._addedAt).toLocaleDateString('pt-BR') : '';

        div.innerHTML = `
          <div class="manual-record-info">
            <span class="badge badge-sm badge-blue">${typeLabels[type]}</span>
            <strong>${label}</strong>
            ${r.equipe ? `<span class="text-muted">— ${r.equipe}</span>` : ''}
            <span class="text-muted text-sm">${date}</span>
          </div>
          <button class="btn-icon btn-delete" data-type="${type}" data-added="${r._addedAt}" title="Remover">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
            </svg>
          </button>
        `;

        container.appendChild(div);
      });
    });

    if (!hasRecords) {
      container.innerHTML = '<p class="text-muted text-center">Nenhum registro manual adicionado.</p>';
    }

    // Attach delete handlers
    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const addedAt = btn.dataset.added;
        if (confirm('Tem certeza que deseja remover este registro?')) {
          deleteManualRecord(type, addedAt);
        }
      });
    });
  }

  /* ── Init ── */

  function init() {
    console.log('[ManualEntry] Initializing manual entry system');

    // Type select handler
    const typeSelect = $id('manual-type-select');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        showForm(typeSelect.value);
      });
    }

    // Save button handler
    const saveBtn = $id('manual-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        saveRecord();
      });
    }

    // Initial render of manual records list
    renderManualRecords();
  }

  window.SESCINC.ManualEntry = { init, showForm };
})();
