/**
 * SESCINC SBGL Dashboard — Overview Charts
 * Renders the overview section with radar and grouped bar charts
 */
(function () {
  'use strict';

  window.SESCINC = window.SESCINC || {};
  window.SESCINC.Charts = window.SESCINC.Charts || {};

  const COLORS = {
    blue: '#00d2ff', cyan: '#00f0ff', green: '#00ff87',
    amber: '#ffd32a', red: '#ff0055', purple: '#b026ff',
    pink: '#ff007f', indigo: '#6366f1', teal: '#14b8a6',
    equipes: { 'ALFA': '#00d2ff', 'BRAVO': '#00ff87', 'CHARLIE': '#ffd32a', 'DELTA': '#ff0055', 'FOLGUISTA': '#b026ff' },
    resultadosTAF: { 'Satisfatório': '#00ff87', 'Insatisfatório': '#ff0055' },
    resultadosTPEPR: { 'Excelente': '#00ff87', 'Bom': '#ffd32a', 'Insatisfatório': '#ff0055' }
  };

  const EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'FOLGUISTA'];
  const chartInstances = {};

  function destroyChart(key) {
    if (chartInstances[key]) {
      chartInstances[key].destroy();
      delete chartInstances[key];
    }
  }

  function safeEl(id) {
    return document.getElementById(id) || document.querySelector(id);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) {
      const valEl = el.querySelector('.kpi-value');
      if (valEl) {
        valEl.textContent = text;
      } else {
        el.textContent = text;
      }
    }
  }

  function getCtx(canvasId) {
    const canvas = document.getElementById(canvasId);
    return canvas ? canvas.getContext('2d') : null;
  }

  /* ── KPI helpers ── */

  function calcTAFPercent(records) {
    if (!records || !records.length) return 0;
    const ok = records.filter(r => r.status === 'ok');
    if (!ok.length) return 0;
    const sat = ok.filter(r => r.resultado === 'Satisfatório').length;
    return Math.round((sat / ok.length) * 100);
  }

  function calcTPEPRPercent(records) {
    if (!records || !records.length) return 0;
    const exc = records.filter(r => r.resultado === 'Excelente').length;
    return Math.round((exc / records.length) * 100);
  }

  function calcTeoricaAvg(records) {
    if (!records || !records.length) return 0;
    const sum = records.reduce((s, r) => s + (r.nota || 0), 0);
    return Math.round((sum / records.length) * 10) / 10;
  }

  function calcTRMeta(records) {
    if (!records || !records.length) return 0;
    const okRecords = records.filter(r => r.status === 'ok' && r.cci === '1°CCI');
    if (!okRecords.length) return 0;
    const withinMeta = okRecords.filter(r => r.tempoSeconds <= 120).length;
    return Math.round((withinMeta / okRecords.length) * 100);
  }

  /* ── Per-equipe calculations ── */

  function calcEquipeMetrics(allData, equipe) {
    const tafRecs = (allData.taf || []).filter(r => r.equipe === equipe && r.status === 'ok');
    const tpeprRecs = (allData.tpepr || []).filter(r => r.equipe === equipe);
    const teoRecs = (allData.teorica || []).filter(r => r.equipe === equipe);
    const trRecs = (allData.tr || []).filter(r => r.equipe === equipe && r.status === 'ok' && r.cci === '1°CCI');

    const tafPct = tafRecs.length ? Math.round((tafRecs.filter(r => r.resultado === 'Satisfatório').length / tafRecs.length) * 100) : 0;
    const tpeprPct = tpeprRecs.length ? Math.round((tpeprRecs.filter(r => r.resultado === 'Excelente').length / tpeprRecs.length) * 100) : 0;
    const teoPct = teoRecs.length ? Math.round((teoRecs.reduce((s, r) => s + (r.nota || 0), 0) / teoRecs.length)) : 0;
    const trPct = trRecs.length ? Math.round((trRecs.filter(r => r.tempoSeconds <= 120).length / trRecs.length) * 100) : 0;

    return { tafPct, tpeprPct, teoPct, trPct };
  }

  /* ── Rendering ── */

  function renderKPIs(allData) {
    setText('kpi-ov-taf', calcTAFPercent(allData.taf) + '%');
    setText('kpi-ov-tpepr', calcTPEPRPercent(allData.tpepr) + '%');
    setText('kpi-ov-teorica', calcTeoricaAvg(allData.teorica).toFixed(1));
    setText('kpi-ov-tr', calcTRMeta(allData.tr) + '%');
  }

  let activeRadarType = 'radar';
  let activeEquipeType = 'bar';
  let currentData = null;
  let listenersAttached = false;

  function setupTypeSelectors() {
    if (listenersAttached) return;
    listenersAttached = true;

    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.btn-chart-type');
      if (!btn) return;

      const selector = btn.closest('.chart-type-selector');
      if (!selector) return;

      const chartKey = selector.getAttribute('data-chart');
      const type = btn.getAttribute('data-type');

      // Update active class
      selector.querySelectorAll('.btn-chart-type').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (chartKey === 'overviewRadar') {
        activeRadarType = type;
        renderRadar(currentData);
      } else if (chartKey === 'overviewEquipe') {
        activeEquipeType = type;
        renderEquipeBar(currentData);
      }
    });
  }

  function renderRadar(allData) {
    destroyChart('overviewRadar');
    const ctx = getCtx('overviewRadar');
    if (!ctx) return;

    const labels = ['TAF (%)', 'TP-EPR (%)', 'Teórica (%)', 'TR Meta (%)'];
    const datasets = EQUIPES.map(equipe => {
      const m = calcEquipeMetrics(allData, equipe);
      const color = COLORS.equipes[equipe];
      
      const config = {
        label: equipe,
        data: [m.tafPct, m.tpeprPct, m.teoPct, m.trPct]
      };

      if (activeRadarType === 'radar') {
        config.backgroundColor = color + '33';
        config.borderColor = color;
        config.borderWidth = 2;
        config.pointBackgroundColor = color;
        config.pointBorderColor = '#fff';
        config.pointRadius = 4;
      } else if (activeRadarType === 'bar') {
        config.backgroundColor = color;
        config.borderColor = color;
        config.borderWidth = 1;
        config.borderRadius = 4;
      } else if (activeRadarType === 'line') {
        config.backgroundColor = color + '22';
        config.borderColor = color;
        config.borderWidth = 3;
        config.pointBackgroundColor = color;
        config.pointRadius = 4;
        config.fill = false;
        config.tension = 0.3;
      }
      return config;
    });

    const config = {
      type: activeRadarType === 'radar' ? 'radar' : (activeRadarType === 'line' ? 'line' : 'bar'),
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: function(evt, elements) {
          if (!elements.length) return;
          const activeElement = elements[0];
          const datasetIndex = activeElement.datasetIndex;
          const team = datasets[datasetIndex].label;

          const NamesMap = {};
          if (currentData.taf) {
            currentData.taf.filter(r => r.equipe === team && r.status === 'ok').forEach(r => { NamesMap[r.nome] = true; });
          }
          if (currentData.tpepr) {
            currentData.tpepr.filter(r => r.equipe === team).forEach(r => { NamesMap[r.nome] = true; });
          }
          const names = Object.keys(NamesMap).sort();
          if (names.length && window.SESCINC.showDetailModal) {
            window.SESCINC.showDetailModal('Efetivo da Equipe ' + team, names);
          }
        },
        plugins: {
          title: { display: true, text: 'Desempenho Geral por Equipe', font: { size: 16 } },
          legend: { position: 'top' }
        }
      }
    };

    if (activeRadarType === 'radar') {
      config.options.scales = {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { stepSize: 20, backdropColor: 'transparent' },
          grid: { color: 'rgba(255,255,255,0.08)' },
          angleLines: { color: 'rgba(255,255,255,0.08)' },
          pointLabels: { font: { size: 12 } }
        }
      };
    } else {
      config.options.scales = {
        y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentual / Nota' } },
        x: { title: { display: true, text: 'Métricas' } }
      };
    }

    chartInstances.overviewRadar = new Chart(ctx, config);
  }

  function renderEquipeBar(allData) {
    destroyChart('overviewEquipe');
    const ctx = getCtx('overviewEquipe');
    if (!ctx) return;

    const metrics = EQUIPES.map(e => calcEquipeMetrics(allData, e));
    const metricLabels = ['TAF Aprovação (%)', 'TPEPR Excelência (%)', 'Teórica Média', 'TR Meta (%)'];
    const metricColors = [COLORS.blue, COLORS.cyan, COLORS.amber, COLORS.green];

    const datasets = metricLabels.map((label, i) => {
      const config = {
        label,
        data: metrics.map(m => [m.tafPct, m.tpeprPct, m.teoPct, m.trPct][i]),
        backgroundColor: metricColors[i],
        borderColor: metricColors[i]
      };

      if (activeEquipeType === 'bar' || activeEquipeType === 'horizontalBar') {
        config.borderWidth = 1;
        config.borderRadius = 4;
      } else if (activeEquipeType === 'line') {
        config.borderWidth = 3;
        config.pointBackgroundColor = metricColors[i];
        config.pointRadius = 4;
        config.fill = false;
        config.tension = 0.2;
      }
      return config;
    });

    const isHorizontal = activeEquipeType === 'horizontalBar';
    const chartType = activeEquipeType === 'line' ? 'line' : 'bar';

    const config = {
      type: chartType,
      data: { labels: EQUIPES, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: function(evt, elements) {
          if (!elements.length) return;
          const activeElement = elements[0];
          const dataIndex = activeElement.index;
          const team = EQUIPES[dataIndex];

          const NamesMap = {};
          if (currentData.taf) {
            currentData.taf.filter(r => r.equipe === team && r.status === 'ok').forEach(r => { NamesMap[r.nome] = true; });
          }
          if (currentData.tpepr) {
            currentData.tpepr.filter(r => r.equipe === team).forEach(r => { NamesMap[r.nome] = true; });
          }
          const names = Object.keys(NamesMap).sort();
          if (names.length && window.SESCINC.showDetailModal) {
            window.SESCINC.showDetailModal('Efetivo da Equipe ' + team, names);
          }
        },
        plugins: {
          title: { display: true, text: 'Comparativo por Equipe', font: { size: 16 } },
          legend: { position: 'top' }
        }
      }
    };

    if (isHorizontal) {
      config.options.indexAxis = 'y';
      config.options.scales = {
        x: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentual / Nota' } },
        y: { title: { display: true, text: 'Equipe' } }
      };
    } else {
      config.options.scales = {
        y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentual / Nota' } },
        x: { title: { display: true, text: 'Equipe' } }
      };
    }

    chartInstances.overviewEquipe = new Chart(ctx, config);
  }

  function render(allData) {
    console.log('[Overview] Rendering overview charts');
    allData = allData || { taf: [], tpepr: [], tr: [], teorica: [] };
    currentData = allData;
    
    // Set up switchers
    setupTypeSelectors();

    const hasData = (allData.taf && allData.taf.length) ||
                    (allData.tpepr && allData.tpepr.length) ||
                    (allData.tr && allData.tr.length) ||
                    (allData.teorica && allData.teorica.length);

    const emptyEl = document.getElementById('overview-empty');
    const chartsContainer = document.querySelector('#section-overview .charts-grid');

    if (emptyEl) emptyEl.style.display = hasData ? 'none' : 'flex';
    if (chartsContainer) chartsContainer.style.display = hasData ? '' : 'none';

    if (!hasData) return;

    renderKPIs(allData);
    renderRadar(allData);
    renderEquipeBar(allData);
  }

  function destroy() {
    destroyChart('overviewRadar');
    destroyChart('overviewEquipe');
  }

  window.SESCINC.Charts.Overview = { render, destroy };
})();
