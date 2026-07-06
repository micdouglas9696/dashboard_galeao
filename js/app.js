/**
 * SESCINC SBGL Dashboard — Main Application Controller
 * Coordinates navigation, data loading, upload, and chart rendering
 */
(function () {
  'use strict';

  window.SESCINC = window.SESCINC || {};

  /* ── Detail Modal (global function for chart click handlers) ── */
  window.SESCINC.showDetailModal = function (title, names) {
    const overlay = document.getElementById('detail-modal');
    const titleEl = document.getElementById('detail-modal-title');
    const countEl = document.getElementById('detail-modal-count');
    const listEl = document.getElementById('detail-modal-list');
    if (!overlay || !titleEl || !countEl || !listEl) return;

    titleEl.textContent = title;
    countEl.textContent = names.length + ' bombeiro' + (names.length !== 1 ? 's' : '');
    listEl.innerHTML = names.sort().map(n => `<li>${n}</li>`).join('');
    overlay.style.display = 'flex';
  };

  function setupDetailModal() {
    const overlay = document.getElementById('detail-modal');
    const closeBtn = document.getElementById('detail-modal-close');
    if (!overlay) return;
    function close() { overlay.style.display = 'none'; }
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
  }

  /* ── Constants ── */

  const STORAGE_KEYS = {
    TAF: 'sescinc_taf',
    TPEPR: 'sescinc_tpepr',
    TR: 'sescinc_tr',
    TEORICA: 'sescinc_teorica',
    taf: 'sescinc_taf',
    tpepr: 'sescinc_tpepr',
    tr: 'sescinc_tr',
    teorica: 'sescinc_teorica'
  };

  const SECTION_TITLES = {
    overview: 'Visão Geral',
    taf: 'TAF — Teste de Aptidão Física',
    tpepr: 'TP-EPR — Teste Prático EPR',
    tr: 'TR — Tempo de Resposta',
    teorica: 'Avaliação Teórica',
    upload: 'Upload de Dados',
    manual: 'Entrada Manual'
  };

  let currentSection = 'overview';
  let currentCabeceira = 'all';
  let currentMonthFilters = { overview: 'todos', taf: 'todos', tpepr: 'todos', tr: 'todos', teorica: 'todos' };
  let allData = { taf: [], tpepr: [], tr: [], teorica: [] };

  /* ── Storage helpers ── */

  function loadStorage(key) {
    if (window.SESCINC.Storage && window.SESCINC.Storage.load) {
      return window.SESCINC.Storage.load(key);
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveStorage(key, data) {
    if (window.SESCINC.Storage && window.SESCINC.Storage.save) {
      window.SESCINC.Storage.save(key, data);
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('[App] Save error:', e);
    }
  }

  function showToast(msg, type) {
    if (window.SESCINC.Export && window.SESCINC.Export.showToast) {
      window.SESCINC.Export.showToast(msg, type);
    }
  }

  /* ── Data loading ── */

  function loadData() {
    console.log('[App] Loading data from storage');

    let tafData = loadStorage(STORAGE_KEYS.TAF);
    let tpeprData = loadStorage(STORAGE_KEYS.TPEPR);
    let trData = loadStorage(STORAGE_KEYS.TR);
    let teoricaData = loadStorage(STORAGE_KEYS.TEORICA);

    // If storage is empty but SeedData is available, populate it
    const isTafEmpty = !tafData || !tafData.records || !tafData.records.length;
    const isTpeprEmpty = !tpeprData || !tpeprData.records || !tpeprData.records.length;
    const isTrEmpty = !trData || !trData.records || !trData.records.length;
    const isTeoricaEmpty = !teoricaData || !teoricaData.records || !teoricaData.records.length;

    if ((isTafEmpty || isTpeprEmpty || isTrEmpty || isTeoricaEmpty) && window.SESCINC.SeedData) {
      console.log('[App] Seeding missing datasets from initial data');
      const seed = window.SESCINC.SeedData;
      if (isTafEmpty && seed.taf) { saveStorage(STORAGE_KEYS.TAF, seed.taf); tafData = seed.taf; }
      if (isTpeprEmpty && seed.tpepr) { saveStorage(STORAGE_KEYS.TPEPR, seed.tpepr); tpeprData = seed.tpepr; }
      if (isTrEmpty && seed.tr) { saveStorage(STORAGE_KEYS.TR, seed.tr); trData = seed.tr; }
      if (isTeoricaEmpty && seed.teorica) { saveStorage(STORAGE_KEYS.TEORICA, seed.teorica); teoricaData = seed.teorica; }
    }

    allData = {
      taf: (tafData && tafData.records) ? tafData.records.map(function(r) {
        if (!r.mes) r.mes = 'Junho';
        return r;
      }) : [],
      tpepr: (tpeprData && tpeprData.records) ? tpeprData.records.map(function(r) {
        if (!r.mes) r.mes = 'Junho';
        return r;
      }) : [],
      tr: (trData && trData.records) ? trData.records : [],
      teorica: (teoricaData && teoricaData.records) ? teoricaData.records.map(function(r) {
        if (!r.mes) r.mes = 'Junho'; // default theoretical evaluations to June as well
        return r;
      }) : []
    };

    // Build colaborador map if possible
    buildColaboradorMap();

    // Update upload timestamps display
    updateUploadTimestamps({
      taf: tafData,
      tpepr: tpeprData,
      tr: trData,
      teorica: teoricaData
    });

    console.log('[App] Data loaded:', {
      taf: allData.taf.length,
      tpepr: allData.tpepr.length,
      tr: allData.tr.length,
      teorica: allData.teorica.length
    });

    return allData;
  }

  function buildColaboradorMap() {
    const map = {};

    // Build from TAF (has equipe + nome)
    allData.taf.forEach(r => {
      if (r.nome && r.equipe) {
        map[r.nome.toLowerCase()] = { equipe: r.equipe, funcao: r.funcao };
      }
    });

    // Build from TPEPR
    allData.tpepr.forEach(r => {
      if (r.nome && r.equipe) {
        map[r.nome.toLowerCase()] = map[r.nome.toLowerCase()] || { equipe: r.equipe, funcao: r.funcao };
      }
    });

    window.SESCINC._colaboradorMap = map;
  }

  function updateUploadTimestamps(datasets) {
    ['taf', 'tpepr', 'tr', 'teorica'].forEach(key => {
      const el = document.getElementById('upload-date-' + key);
      if (el) {
        const ds = datasets[key];
        if (ds && ds.uploadedAt) {
          el.textContent = new Date(ds.uploadedAt).toLocaleDateString('pt-BR') + ' ' +
                           new Date(ds.uploadedAt).toLocaleTimeString('pt-BR');
        } else {
          el.textContent = 'Nenhum dado';
        }
      }
    });
  }

  /* ── Navigation ── */
  function navigate(section) {
    console.log('[App] Navigating to:', section);
    currentSection = section;

    // Update body class for styling section-specific filters
    document.body.setAttribute('data-section', section);

    // Hide all sections and remove active class
    document.querySelectorAll('.dashboard-section').forEach(el => {
      el.classList.remove('active');
      el.style.display = ''; // Clear inline styles
    });

    // Show target section and add active class
    const target = document.getElementById('section-' + section);
    if (target) {
      target.classList.add('active');
    }

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });

    // Update header title
    const headerTitle = document.getElementById('header-section-title');
    if (headerTitle) headerTitle.textContent = SECTION_TITLES[section] || section;

    // Update filters for this section
    if (window.SESCINC.Filters && window.SESCINC.Filters.updateForSection) {
      window.SESCINC.Filters.updateForSection(section);
    }

    // Render charts
    renderSection(section);
  }

  /* ── Rendering ── */

  function renderSection(section) {
    const data = loadData();

    // Get filtered data
    let filtered;
    if (section === 'overview') {
      const Filters = window.SESCINC.Filters;
      let taf = Filters ? Filters.filterRecords(data.taf, 'overview') : data.taf;
      let tpepr = Filters ? Filters.filterRecords(data.tpepr, 'overview') : data.tpepr;
      let tr = Filters ? Filters.filterRecords(data.tr, 'overview') : data.tr;
      let teorica = Filters ? Filters.filterRecords(data.teorica, 'overview') : data.teorica;
      // Apply month filter for overview
      if (currentMonthFilters.overview && currentMonthFilters.overview !== 'todos') {
        taf = filterByMonth(taf, 'overview');
        tpepr = filterByMonth(tpepr, 'overview');
        tr = filterByMonth(tr, 'overview');
        teorica = filterByMonth(teorica, 'overview');
      }
      filtered = { taf, tpepr, tr, teorica };
    } else {
      const Filters = window.SESCINC.Filters;
      let sectionData = data[section] || [];
      sectionData = Filters ? Filters.filterRecords(sectionData, section) : sectionData;
      // Apply month filter for TAF, TPEPR, TR and Teorica
      if ((section === 'taf' || section === 'tpepr' || section === 'tr' || section === 'teorica') && currentMonthFilters[section] && currentMonthFilters[section] !== 'todos') {
        sectionData = filterByMonth(sectionData, section);
      }
      filtered = sectionData;
    }

    const Charts = window.SESCINC.Charts || {};

    switch (section) {
      case 'overview':
        if (Charts.Overview) {
          Charts.Overview.destroy();
          Charts.Overview.render(filtered);
        }
        // Animate KPIs
        animateKPIs();
        break;

      case 'taf':
        if (Charts.TAF) {
          Charts.TAF.destroy();
          Charts.TAF.render(filtered);
        }
        animateKPIs();
        break;

      case 'tpepr':
        if (Charts.TPEPR) {
          Charts.TPEPR.destroy();
          Charts.TPEPR.render(filtered);
        }
        animateKPIs();
        break;

      case 'tr':
        if (Charts.TR) {
          Charts.TR.destroy();
          Charts.TR.render(filtered, currentCabeceira);
        }
        animateKPIs();
        break;

      case 'teorica':
        if (Charts.Teorica) {
          Charts.Teorica.destroy();
          Charts.Teorica.render(filtered);
        }
        animateKPIs();
        break;

      default:
        break;
    }
  }

  function refresh() {
    console.log('[App] Refreshing current section:', currentSection);
    renderSection(currentSection);
  }

  /* ── Number animation ── */

  function animateValue(element, start, end, duration, suffix) {
    if (!element) return;
    suffix = suffix || '';
    const range = end - start;
    if (range === 0) {
      element.textContent = end + suffix;
      return;
    }

    const startTime = performance.now();
    const isFloat = String(end).includes('.');

    function step(timestamp) {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + range * eased;

      if (isFloat) {
        element.textContent = current.toFixed(1) + suffix;
      } else {
        element.textContent = Math.round(current) + suffix;
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  function animateKPIs() {
    document.querySelectorAll('.kpi-value').forEach(el => {
      const text = el.textContent.trim();
      const suffix = text.includes('%') ? '%' : '';
      const numStr = text.replace('%', '').replace(',', '.');
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) {
        animateValue(el, 0, num, 800, suffix);
      }
    });
    // Wait for the numbers to start animating then trigger the progress bars transition
    setTimeout(updateKPIProgressBars, 50);
  }

  function injectKPIProgressBars() {
    document.querySelectorAll('.kpi-card').forEach(card => {
      if (!card.querySelector('.kpi-progress')) {
        const progress = document.createElement('div');
        progress.className = 'kpi-progress';
        const progressBar = document.createElement('div');
        progressBar.className = 'kpi-progress-bar';
        progress.appendChild(progressBar);
        card.appendChild(progress);
      }
    });
  }

  function updateKPIProgressBars() {
    document.querySelectorAll('.kpi-card').forEach(card => {
      const valEl = card.querySelector('.kpi-value');
      const bar = card.querySelector('.kpi-progress-bar');
      if (!valEl || !bar) return;
      
      const text = valEl.textContent.trim();
      if (text === '—' || text === '0' || text === '0%') {
        bar.style.width = '0%';
        return;
      }
      
      const parentGrid = card.parentElement;
      let pct = 0;
      
      if (text.includes('%')) {
        pct = parseFloat(text.replace('%', ''));
      } else {
        const num = parseFloat(text.replace(',', '.'));
        if (!isNaN(num)) {
          if (card.id.includes('teo') || card.id.includes('teorica')) {
            if (num <= 100) pct = num;
          } else {
            const totalEl = parentGrid.querySelector('[id$="-total"] .kpi-value');
            if (totalEl) {
              const totalText = totalEl.textContent.trim();
              const total = parseFloat(totalText);
              if (total > 0) {
                pct = (num / total) * 100;
              } else {
                pct = Math.min((num / 100) * 100, 100);
              }
            } else {
              pct = Math.min((num / 100) * 100, 100);
            }
          }
        }
      }
      
      // Color scheme customization
      if (card.id.includes('insat') || card.id.includes('ruim')) {
        bar.style.background = 'var(--accent-red)';
        bar.style.boxShadow = '0 0 8px var(--accent-red)';
      } else if (card.id.includes('sat') || card.id.includes('exc') || card.id.includes('meta')) {
        bar.style.background = 'var(--accent-green)';
        bar.style.boxShadow = '0 0 8px var(--accent-green)';
      } else if (card.id.includes('bom')) {
        bar.style.background = 'var(--accent-amber)';
        bar.style.boxShadow = '0 0 8px var(--accent-amber)';
      } else {
        bar.style.background = 'linear-gradient(90deg, var(--accent-blue), var(--accent-cyan))';
        bar.style.boxShadow = '0 0 8px var(--accent-cyan)';
      }
      
      if (!isNaN(pct)) {
        bar.style.width = Math.min(Math.max(pct, 0), 100) + '%';
      }
    });
  }

  function setupRealtimeClock() {
    const clock = document.getElementById('realtime-clock');
    if (!clock) return;
    function update() {
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR');
      clock.textContent = `${dateStr} ${timeStr}`;
    }
    update();
    setInterval(update, 1000);
  }

  /* ── Upload handling ── */

  function setupUpload() {
    const dropZone = document.getElementById('upload-drop-zone');
    const fileInput = document.getElementById('upload-file-input');
    const confirmBtn = document.getElementById('upload-confirm');
    const cancelBtn = document.getElementById('upload-cancel');

    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });

      dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length) handleUploadFile(files[0]);
      });

      dropZone.addEventListener('click', () => {
        if (fileInput) fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleUploadFile(e.target.files[0]);
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', confirmUpload);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelUpload);
    }
  }

  let pendingUpload = null;

  function handleUploadFile(file) {
    console.log('[App] Processing upload file:', file.name);

    if (typeof XLSX === 'undefined') {
      showToast('Biblioteca XLSX não está carregada.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Detect type
        let detectedType = null;
        if (window.SESCINC.Parsers && window.SESCINC.Parsers.detectType) {
          detectedType = window.SESCINC.Parsers.detectType(workbook);
        }

        const typeLabel = document.getElementById('upload-type-label');
        if (typeLabel) {
          const typeNames = { taf: 'TAF', tpepr: 'TP-EPR', tr: 'TR', teorica: 'Teórica' };
          typeLabel.textContent = detectedType
            ? `Tipo detectado: ${typeNames[detectedType] || detectedType}`
            : 'Tipo não identificado';
          typeLabel.className = detectedType ? 'upload-type-detected' : 'upload-type-unknown';
        }

        if (!detectedType) {
          showToast('Não foi possível identificar o tipo da planilha.', 'error');
          return;
        }

        // Parse data
        let parsed = null;
        if (window.SESCINC.Parsers) {
          const parserMap = {
            taf: (wb, fName) => {
              const recs = window.SESCINC.Parsers.TAF ? window.SESCINC.Parsers.TAF.parse(wb, fName) : [];
              return { records: recs };
            },
            tpepr: (wb, fName) => {
              const recs = window.SESCINC.Parsers.TPEPR ? window.SESCINC.Parsers.TPEPR.parse(wb, fName) : [];
              return { records: recs };
            },
            tr: (wb, fName) => {
              const recs = window.SESCINC.Parsers.TR ? window.SESCINC.Parsers.TR.parse(wb, fName) : [];
              return { records: recs };
            },
            teorica: (wb, fName) => {
              const recs = window.SESCINC.Parsers.Teorica ? window.SESCINC.Parsers.Teorica.parse(wb, null, fName) : [];
              return { records: recs };
            }
          };
          const parser = parserMap[detectedType];
          if (parser) parsed = parser(workbook, file.name);
        }

        if (!parsed || !parsed.records || !parsed.records.length) {
          showToast('Nenhum registro encontrado na planilha.', 'error');
          return;
        }

        // Store pending
        pendingUpload = {
          type: detectedType,
          data: parsed,
          fileName: file.name
        };

        // Show preview
        showUploadPreview(pendingUpload);

      } catch (err) {
        console.error('[App] Upload parse error:', err);
        showToast('Erro ao processar a planilha: ' + err.message, 'error');
      }
    };

    reader.readAsArrayBuffer(file);
  }

  function showUploadPreview(upload) {
    const preview = document.getElementById('upload-preview');
    if (!preview) return;

    const typeNames = { taf: 'TAF', tpepr: 'TP-EPR', tr: 'TR', teorica: 'Teórica' };
    const records = upload.data.records;

    let sampleHtml = '';
    const sampleRecords = records.slice(0, 3);

    if (upload.type === 'taf') {
      sampleHtml = sampleRecords.map(r =>
        `<div class="preview-record">${r.nome} — ${r.equipe} — ${r.resultado}</div>`
      ).join('');
    } else if (upload.type === 'tpepr') {
      sampleHtml = sampleRecords.map(r =>
        `<div class="preview-record">${r.nome} — ${r.equipe} — ${r.tempoFormatted} — ${r.resultado}</div>`
      ).join('');
    } else if (upload.type === 'tr') {
      sampleHtml = sampleRecords.map(r =>
        `<div class="preview-record">${r.cabeceira || '—'} — ${r.equipe} — ${r.mes} — ${r.cci} — ${r.tempoFormatted}</div>`
      ).join('');
    } else if (upload.type === 'teorica') {
      sampleHtml = sampleRecords.map(r =>
        `<div class="preview-record">${r.nome} — ${r.funcao} — Nota: ${r.nota}</div>`
      ).join('');
    }

    preview.innerHTML = `
      <div class="preview-header">
        <h4>Pré-visualização — ${typeNames[upload.type]}</h4>
        <p class="text-muted">${records.length} registros encontrados em "${upload.fileName}"</p>
      </div>
      <div class="preview-sample">
        <p class="text-muted text-sm">Amostra:</p>
        ${sampleHtml}
        ${records.length > 3 ? `<p class="text-muted text-sm">... e mais ${records.length - 3} registros</p>` : ''}
      </div>
    `;
    preview.style.display = '';

    const confirmBtn = document.getElementById('upload-confirm');
    const cancelBtn = document.getElementById('upload-cancel');
    if (confirmBtn) confirmBtn.style.display = '';
    if (cancelBtn) cancelBtn.style.display = '';
  }

  function confirmUpload() {
    if (!pendingUpload) return;

    const { type, data } = pendingUpload;
    const storageKey = STORAGE_KEYS[type.toUpperCase()] || STORAGE_KEYS[type];
    if (!storageKey) {
      showToast('Erro interno: chave de armazenamento não encontrada.', 'error');
      return;
    }

    // Enrich teórica with equipe data from colaborador map
    if (type === 'teorica' && window.SESCINC._colaboradorMap) {
      const map = window.SESCINC._colaboradorMap;
      data.records.forEach(r => {
        if (!r.equipe && r.nome) {
          const info = map[r.nome.toLowerCase()];
          if (info) {
            r.equipe = info.equipe;
            if (!r.funcao && info.funcao) r.funcao = info.funcao;
          }
        }
      });
    }

    data.uploadedAt = new Date().toISOString();
    saveStorage(storageKey, data);

    console.log('[App] Upload confirmed:', type, data.records.length, 'records');
    showToast(`${data.records.length} registros importados com sucesso!`, 'success');

    // Clean up preview
    cancelUpload();

    // Navigate to that section's dashboard
    const sectionMap = { taf: 'taf', tpepr: 'tpepr', tr: 'tr', teorica: 'teorica' };
    navigate(sectionMap[type] || 'overview');
  }

  function cancelUpload() {
    pendingUpload = null;
    const preview = document.getElementById('upload-preview');
    if (preview) { preview.innerHTML = ''; preview.style.display = 'none'; }

    const confirmBtn = document.getElementById('upload-confirm');
    const cancelBtn = document.getElementById('upload-cancel');
    if (confirmBtn) confirmBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';

    const typeLabel = document.getElementById('upload-type-label');
    if (typeLabel) { typeLabel.textContent = ''; typeLabel.className = ''; }

    const fileInput = document.getElementById('upload-file-input');
    if (fileInput) fileInput.value = '';
  }

  /* ── Sidebar ── */

  function setupSidebar() {
    // Nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        if (section) navigate(section);
      });
    });

    // Sidebar toggle
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }
  }

  /* ── Export buttons ── */

  function setupExportButtons() {
    document.querySelectorAll('.btn-export-pdf').forEach(btn => {
      btn.addEventListener('click', () => {
        const sectionId = 'section-' + currentSection;
        if (window.SESCINC.Export) window.SESCINC.Export.toPDF(sectionId);
      });
    });

    document.querySelectorAll('.btn-export-png').forEach(btn => {
      btn.addEventListener('click', () => {
        const sectionId = 'section-' + currentSection;
        if (window.SESCINC.Export) window.SESCINC.Export.toPNG(sectionId);
      });
    });
  }

  /* ── Cabeceira tabs ── */

  function setupCabeceiraTabs() {
    document.querySelectorAll('.cabeceira-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cabeceira-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentCabeceira = tab.dataset.cabeceira || 'all';

        if (currentSection === 'tr') {
          renderSection('tr');
        }
      });
    });
  }

  /* ── Month filter tabs ── */

  function setupMonthFilters() {
    document.addEventListener('click', function (e) {
      const tab = e.target.closest('.month-tab');
      if (!tab) return;

      const section = tab.dataset.section;
      const month = tab.dataset.month;
      if (!section || !month) return;

      // Update active tab within this section's filter
      const container = tab.closest('.month-filter-container');
      if (container) {
        container.querySelectorAll('.month-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      }

      currentMonthFilters[section] = month;

      // Sync TR month tabs with the sidebar select dropdown
      if (section === 'tr') {
        const mesSelect = document.getElementById('filter-mes');
        if (mesSelect) {
          mesSelect.value = (month === 'todos') ? '' : month;
          if (window.SESCINC.Filters && window.SESCINC.Filters.apply) {
            window.SESCINC.Filters.apply();
            return;
          }
        }
      }

      renderSection(currentSection);
    });
  }

  function filterByMonth(records, section) {
    const month = currentMonthFilters[section];
    if (!month || month === 'todos') return records;
    // Try filtering by 'mes' field (TR and potentially others)
    // Also try 'mesIndex' mapping
    const MONTHS_MAP = {
      'Janeiro': 0, 'Fevereiro': 1, 'Março': 2, 'Abril': 3,
      'Maio': 4, 'Junho': 5, 'Julho': 6, 'Agosto': 7,
      'Setembro': 8, 'Outubro': 9, 'Novembro': 10, 'Dezembro': 11
    };
    const targetIndex = MONTHS_MAP[month];
    return records.filter(r => {
      if (r.mes && r.mes === month) return true;
      if (r.mesIndex !== undefined && r.mesIndex === targetIndex) return true;
      if (r.mes && r.mes.toLowerCase() === month.toLowerCase()) return true;
      return false;
    });
  }

  /* ── Age chart expand / collapse ── */

  function setupAgeExpandCollapse() {
    const expandBtn = document.getElementById('btn-expand-age');
    const collapseBtn = document.getElementById('btn-collapse-age');
    const detailCard = document.getElementById('tafIdadeDetailCard');

    if (expandBtn && detailCard) {
      expandBtn.addEventListener('click', function () {
        detailCard.style.display = '';
        detailCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    if (collapseBtn && detailCard) {
      collapseBtn.addEventListener('click', function () {
        detailCard.style.display = 'none';
      });
    }
  }

  /* ── Init ── */

  function init() {
    console.log('[App] ═══════════════════════════════════════');
    console.log('[App] SESCINC SBGL Dashboard — Initializing');
    console.log('[App] ═══════════════════════════════════════');

    // Set Chart.js defaults
    if (typeof Chart !== 'undefined') {
      Chart.defaults.color = '#94a3b8';
      Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
      Chart.defaults.font.family = 'Inter';
      console.log('[App] Chart.js defaults configured');
    }

    // Initialize sub-modules
    if (window.SESCINC.Filters) {
      window.SESCINC.Filters.init();
      console.log('[App] Filters initialized');
    }

    if (window.SESCINC.ManualEntry) {
      window.SESCINC.ManualEntry.init();
      console.log('[App] ManualEntry initialized');
    }

    // Setup UI event handlers
    setupSidebar();
    setupUpload();
    setupExportButtons();
    setupCabeceiraTabs();
    setupMonthFilters();
    setupDetailModal();
    setupAgeExpandCollapse();

    // Hook up reset database button
    const resetBtn = document.getElementById('btn-reset-db');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Tem certeza de que deseja resetar todo o sistema e recarregar os dados das planilhas originais?')) {
          localStorage.clear();
          location.reload();
        }
      });
    }

    // Inject high-tech telemetry elements
    injectKPIProgressBars();
    setupRealtimeClock();

    // Load data and render default section
    loadData();
    navigate('overview');

    console.log('[App] Dashboard ready');
  }

  function setMonthFilter(section, month) {
    currentMonthFilters[section] = month;
  }

  /* ── Expose public API ── */

  window.SESCINC.App = {
    init,
    navigate,
    refresh,
    loadData,
    setMonthFilter
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay to ensure all other modules are loaded
    setTimeout(init, 0);
  }
})();
