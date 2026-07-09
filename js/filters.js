/**
 * SESCINC SBGL Dashboard — Filters
 * Dynamic filter panel with section-aware controls
 */
(function () {
  'use strict';

  window.SESCINC = window.SESCINC || {};

  const EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'FOLGUISTA'];
  const FUNCOES = ['BA', 'BA2', 'BA-MC', 'BA-LR', 'BA-RE', 'BA-CE', 'BA-MA', 'OC'];

  const SECTION_FILTERS = {
    overview:  ['equipe'],
    taf:       ['equipe', 'funcao', 'resultado', 'idade', 'search'],
    tpepr:     ['equipe', 'funcao', 'resultado', 'search'],
    tr:        ['mes'],
    teorica:   ['equipe', 'funcao', 'nota', 'search'],
    upload:    [],
    manual:    []
  };

  const RESULTADOS_BY_SECTION = {
    taf: ['Satisfatório', 'Insatisfatório'],
    tpepr: ['Excelente', 'Bom', 'Insatisfatório']
  };

  let currentSection = 'overview';
  let isOpen = false;

  /* ── DOM helpers ── */

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function showEl(el) { if (el) el.style.display = ''; }
  function hideEl(el) { if (el) el.style.display = 'none'; }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* ── Filter groups visibility ── */

  function showFilterGroup(name) {
    const el = document.getElementById('filter-group-' + name);
    if (el) el.style.display = '';
  }

  function hideFilterGroup(name) {
    const el = document.getElementById('filter-group-' + name);
    if (el) el.style.display = 'none';
  }

  /* ── Populate dynamic controls ── */

  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  function populateEquipeCheckboxes() {
    const container = document.getElementById('filter-equipe-list');
    if (!container) return;
    container.innerHTML = '';
    EQUIPES.forEach(eq => {
      const label = document.createElement('label');
      label.className = 'filter-checkbox';
      label.innerHTML = `<input type="checkbox" value="${eq}" checked> ${eq}`;
      container.appendChild(label);
    });
  }

  function populateMonthCheckboxes() {
    const container = document.getElementById('filter-mes-list');
    if (!container) return;
    container.innerHTML = '';
    MONTHS.forEach(m => {
      const label = document.createElement('label');
      label.className = 'filter-checkbox';
      label.innerHTML = `<input type="checkbox" value="${m}" checked> ${m}`;
      container.appendChild(label);
    });
  }

  function populateFuncaoCheckboxes() {
    const container = document.getElementById('filter-funcao-list');
    if (!container) return;
    container.innerHTML = '';

    // Get unique funções from current data
    let funcoesAvailable = [...FUNCOES];
    try {
      const allData = window.SESCINC.App ? window.SESCINC.App.loadData() : null;
      if (allData) {
        const allFuncoes = new Set();
        ['taf', 'tpepr', 'teorica'].forEach(key => {
          (allData[key] || []).forEach(r => { if (r.funcao) allFuncoes.add(r.funcao); });
        });
        if (allFuncoes.size) funcoesAvailable = [...allFuncoes].sort();
      }
    } catch (e) { /* ignore */ }

    funcoesAvailable.forEach(f => {
      const label = document.createElement('label');
      label.className = 'filter-checkbox';
      label.innerHTML = `<input type="checkbox" value="${f}" checked> ${f}`;
      container.appendChild(label);
    });
  }

  function populateResultadoCheckboxes(section) {
    const container = document.getElementById('filter-resultado-list');
    if (!container) return;
    container.innerHTML = '';

    const resultados = RESULTADOS_BY_SECTION[section] || [];
    resultados.forEach(r => {
      const label = document.createElement('label');
      label.className = 'filter-checkbox';
      label.innerHTML = `<input type="checkbox" value="${r}" checked> ${r}`;
      container.appendChild(label);
    });
  }

  /* ── Read filter values ── */

  function getCheckedValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return [...container.querySelectorAll('input[type="checkbox"]:checked')].map(cb => cb.value);
  }

  function getActiveFilters() {
    const searchEl = document.getElementById('filter-search');
    const cabeceiraEl = document.getElementById('filter-cabeceira');
    const cciEl = document.getElementById('filter-cci');
    const idadeMinEl = document.getElementById('filter-idade-min');
    const idadeMaxEl = document.getElementById('filter-idade-max');
    const notaMinEl = document.getElementById('filter-nota-min');
    const notaMaxEl = document.getElementById('filter-nota-max');

    return {
      equipes: getCheckedValues('filter-equipe-list'),
      funcoes: getCheckedValues('filter-funcao-list'),
      resultados: getCheckedValues('filter-resultado-list'),
      meses: getCheckedValues('filter-mes-list'),
      search: searchEl ? searchEl.value.trim().toLowerCase() : '',
      cabeceira: cabeceiraEl ? cabeceiraEl.value : 'all',
      cci: cciEl ? cciEl.value : 'all',
      idadeMin: idadeMinEl && idadeMinEl.value ? parseInt(idadeMinEl.value) : null,
      idadeMax: idadeMaxEl && idadeMaxEl.value ? parseInt(idadeMaxEl.value) : null,
      notaMin: notaMinEl && notaMinEl.value ? parseFloat(notaMinEl.value) : null,
      notaMax: notaMaxEl && notaMaxEl.value ? parseFloat(notaMaxEl.value) : null
    };
  }

  /* ── Apply filters to data ── */

  function filterRecords(records, section) {
    if (!records || !records.length) return [];
    const f = getActiveFilters();
    const allowedFilters = SECTION_FILTERS[section] || [];

    return records.filter(r => {
      // Equipe filter
      if (allowedFilters.includes('equipe')) {
        if (f.equipes.length && r.equipe && !f.equipes.includes(r.equipe)) return false;
      }

      // Função filter
      if (allowedFilters.includes('funcao')) {
        if (f.funcoes.length && r.funcao && !f.funcoes.includes(r.funcao)) return false;
      }

      // Resultado filter (section-dependent)
      if (allowedFilters.includes('resultado')) {
        if (f.resultados.length && r.resultado && !f.resultados.includes(r.resultado)) return false;
      }

      // Search filter
      if (allowedFilters.includes('search') && f.search) {
        const searchable = (r.nome || '').toLowerCase() + ' ' + (r.funcao || '').toLowerCase();
        if (!searchable.includes(f.search)) return false;
      }

      // TR-specific filters
      if (section === 'tr') {
        if (f.cabeceira && f.cabeceira !== 'all' && r.cabeceira && r.cabeceira !== f.cabeceira) return false;
        if (f.meses && f.meses.length && r.mes && !f.meses.includes(r.mes)) return false;
        if (f.cci && f.cci !== 'all' && r.cci && r.cci !== f.cci) return false;
      }

      // Age range filter
      if (section === 'taf' && allowedFilters.includes('idade')) {
        if (f.idadeMin != null && r.idade != null && r.idade < f.idadeMin) return false;
        if (f.idadeMax != null && r.idade != null && r.idade > f.idadeMax) return false;
      }

      // Nota range filter
      if (section === 'teorica' && allowedFilters.includes('nota')) {
        if (f.notaMin != null && r.nota != null && r.nota < f.notaMin) return false;
        if (f.notaMax != null && r.nota != null && r.nota > f.notaMax) return false;
      }

      return true;
    });
  }

  /* ── Public API ── */

  function init() {
    console.log('[Filters] Initializing filter system');

    // Populate initial checkboxes
    populateEquipeCheckboxes();
    populateMonthCheckboxes();
    populateFuncaoCheckboxes();

    // Toggle filter panel
    const toggleBtns = document.querySelectorAll('.btn-filter-toggle');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = document.getElementById('filters-panel');
        if (panel) {
          isOpen = !isOpen;
          panel.classList.toggle('open', isOpen);
        }
      });
    });

    // Close button inside panel
    const closeBtn = document.getElementById('filter-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const panel = document.getElementById('filters-panel');
        if (panel) {
          isOpen = false;
          panel.classList.remove('open');
        }
      });
    }

    // Clear filters button
    const clearBtn = document.getElementById('filter-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', clear);
    }

    // Apply on any checkbox change (event delegation)
    const panel = document.getElementById('filters-panel');
    if (panel) {
      panel.addEventListener('change', () => {
        apply();
      });

      panel.addEventListener('input', (e) => {
        if (e.target.matches('#filter-search, #filter-idade-min, #filter-idade-max, #filter-nota-min, #filter-nota-max')) {
          // Debounce text inputs
          clearTimeout(panel._debounce);
          panel._debounce = setTimeout(() => apply(), 300);
        }
      });
    }

    // Select change handlers
    ['filter-cabeceira', 'filter-cci'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          apply();
        });
      }
    });
  }

  function updateForSection(sectionName) {
    currentSection = sectionName;
    console.log('[Filters] Updating for section:', sectionName);

    const allGroups = ['equipe', 'funcao', 'resultado', 'search', 'cabeceira', 'mes', 'cci', 'idade', 'nota'];
    const visibleGroups = SECTION_FILTERS[sectionName] || [];

    // Hide all, show relevant
    allGroups.forEach(g => hideFilterGroup(g));
    visibleGroups.forEach(g => showFilterGroup(g));

    // Update resultado checkboxes based on section
    if (visibleGroups.includes('resultado')) {
      populateResultadoCheckboxes(sectionName);
    }

    // Hide panel for upload/manual sections
    const panel = document.getElementById('filters-panel');
    const toggleBtns = document.querySelectorAll('.btn-filter-toggle');
    if (sectionName === 'upload' || sectionName === 'manual') {
      if (panel) { panel.classList.remove('open'); isOpen = false; }
      toggleBtns.forEach(btn => hideEl(btn));
    } else {
      toggleBtns.forEach(btn => showEl(btn));
    }

    // Update filter count
    updateFilterCount();
  }

  function apply() {
    console.log('[Filters] Applying filters for section:', currentSection);
    updateFilterCount();

    const activeFilters = getActiveFilters();

    if (window.SESCINC.App && window.SESCINC.App.syncTrEquipeTabs) {
      window.SESCINC.App.syncTrEquipeTabs(activeFilters.equipes || []);
    }

    if (window.SESCINC.App && window.SESCINC.App.syncTrMonthTabs) {
      window.SESCINC.App.syncTrMonthTabs(activeFilters.meses || []);
    }

    if (window.SESCINC.App && window.SESCINC.App.refresh) {
      window.SESCINC.App.refresh();
    }
  }

  function clear() {
    console.log('[Filters] Clearing all filters');

    // Re-check all checkboxes
    const panel = document.getElementById('filters-panel');
    if (panel) {
      panel.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = true; });
    }

    // Reset search
    const search = document.getElementById('filter-search');
    if (search) search.value = '';

    // Reset selects
    ['filter-cabeceira', 'filter-cci'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.value = '';
      }
    });

    // Sync with TR month tabs (reset to "Todos" active)
    const trFilterContainer = document.getElementById('tr-month-filter');
    if (trFilterContainer) {
      trFilterContainer.querySelectorAll('.month-tab').forEach(tab => {
        if (tab.dataset.month === 'todos') {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
    }

    if (window.SESCINC.App && window.SESCINC.App.setMonthFilter) {
      window.SESCINC.App.setMonthFilter('tr', ['todos']);
    }

    // Reset ranges
    ['filter-idade-min', 'filter-idade-max', 'filter-nota-min', 'filter-nota-max'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    apply();
  }

  function updateFilterCount() {
    const f = getActiveFilters();
    let count = 0;

    // Count active filters (non-default states)
    const allEquipesChecked = f.equipes.length === EQUIPES.length;
    if (!allEquipesChecked && f.equipes.length > 0) count++;
    const allMonthsChecked = f.meses.length === MONTHS.length;
    if (!allMonthsChecked && f.meses.length > 0) count++;
    if (f.search) count++;
    if (f.cabeceira !== 'all') count++;
    if (f.cci !== 'all') count++;
    if (f.idadeMin != null) count++;
    if (f.idadeMax != null) count++;
    if (f.notaMin != null) count++;
    if (f.notaMax != null) count++;

    setText('filter-count', count > 0 ? count : '');
  }

  // Expose filterRecords for use by App.refresh
  function getFilteredRecords(records, section) {
    return filterRecords(records, section || currentSection);
  }

  window.SESCINC.Filters = {
    init,
    apply,
    clear,
    getActiveFilters,
    updateForSection,
    filterRecords: getFilteredRecords,
    getCurrentSection: () => currentSection
  };
})();
