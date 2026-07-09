/**
 * SESCINC SBGL Dashboard — TR Charts
 * Tempo de Resposta charts, KPIs, and table
 */
(function () {
  'use strict';

  window.SESCINC = window.SESCINC || {};
  window.SESCINC.Charts = window.SESCINC.Charts || {};

  const COLORS = {
    blue: '#00d2ff', cyan: '#00f0ff', green: '#00ff87',
    amber: '#ffd32a', red: '#ff0055', purple: '#b026ff',
    pink: '#ff007f', indigo: '#6366f1', teal: '#14b8a6',
    equipes: { 'ALFA': '#00d2ff', 'BRAVO': '#00ff87', 'CHARLIE': '#ffd32a', 'DELTA': '#ff0055', 'FOLGUISTA': '#b026ff' }
  };

  const EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'FOLGUISTA'];
  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const META_SECONDS = 120; // 2 minutes
  const chartInstances = {};
  // Local filters for Timeline chart
  let timelineLocalCab = 'all';
  let timelineLocalEquipe = 'todas';
  let timelineLocalCci = 'todos';

  // Local filters for CCI Comparativo chart
  let cciLocalCab = 'all';
  let cciLocalEquipe = 'todas';
  let cciLocalCci = 'todos';

  // Local filters for Heatmap chart
  let heatmapLocalCab = 'all';
  let heatmapLocalEquipe = 'todas';
  let heatmapLocalCci = 'todos';

  function getMetaForRecord(r) {
    if (r.cci === '2°CCI') return 180;
    if (r.cci === '3°CCI' || r.cci === '4°CCI') return 240;
    return 120; // 1°CCI / default
  }

  function classifyRecordTR(r) {
    const t = r.tempoSeconds;
    if (t == null || isNaN(t)) return 'na';
    if (r.cci === '2°CCI') {
      if (t <= 180) return 'Excelente';
      if (t <= 240) return 'Satisfatório';
      return 'Insatisfatório';
    }
    if (r.cci === '3°CCI' || r.cci === '4°CCI') {
      if (t <= 240) return 'Excelente';
      if (t <= 300) return 'Satisfatório';
      return 'Insatisfatório';
    }
    // 1°CCI / default
    if (t <= 120) return 'Excelente';
    if (t <= 180) return 'Satisfatório';
    return 'Insatisfatório';
  }

  function destroyChart(key) {
    if (chartInstances[key]) {
      chartInstances[key].destroy();
      delete chartInstances[key];
    }
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

  function formatTime(seconds) {
    if (seconds == null || isNaN(seconds)) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function filterByCabeceira(records, cabeceira) {
    if (!cabeceira || cabeceira === 'all') return records;
    return records.filter(r => r.cabeceira === cabeceira);
  }

  /* ── KPIs ── */

  function renderKPIs(records) {
    const ok = records.filter(r => r.status === 'ok');
    const withinMeta = ok.filter(r => r.tempoSeconds <= getMetaForRecord(r));
    const avgSeconds = ok.length
      ? Math.round(ok.reduce((s, r) => s + (r.tempoSeconds || 0), 0) / ok.length)
      : 0;
    const pct = ok.length ? Math.round((withinMeta.length / ok.length) * 100) : 0;

    setText('kpi-tr-total', ok.length);
    setText('kpi-tr-meta', withinMeta.length);
    setText('kpi-tr-avg', formatTime(avgSeconds));
    setText('kpi-tr-pct', pct + '%');
  }

  /* ── Charts ── */

  let activeTimelineType = 'line';
  let activeCciType = 'bar';
  let activeHeatmapType = 'bar';
  let currentRecords = [];
  let currentCab = 'all';
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

      const filtered = filterByCabeceira(currentRecords, currentCab);

      if (chartKey === 'trTimeline') {
        activeTimelineType = type;
        renderTimeline(filtered);
      } else if (chartKey === 'trCci') {
        activeCciType = type;
        renderCciBar(filtered);
      } else if (chartKey === 'trHeatmap') {
        activeHeatmapType = type;
        renderHeatmap(filtered);
      }
    });
  }

  let localFiltersAttached = false;
  function setupLocalChartFilters() {
    if (localFiltersAttached) return;
    localFiltersAttached = true;

    function registerLocalSwitcher(containerSelector, onActive) {
      document.querySelectorAll(containerSelector + ' .local-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll(containerSelector + ' .local-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const val = tab.getAttribute('data-val');
          onActive(val);
        });
      });
    }

    // 1. Timeline Chart
    registerLocalSwitcher('.timeline-cab-tabs', val => {
      timelineLocalCab = val;
      renderTimeline(currentRecords);
    });
    registerLocalSwitcher('.timeline-equipe-tabs', val => {
      timelineLocalEquipe = val;
      renderTimeline(currentRecords);
    });
    registerLocalSwitcher('.timeline-cci-tabs', val => {
      timelineLocalCci = val;
      renderTimeline(currentRecords);
    });

    // 2. CCI Comparativo Chart
    registerLocalSwitcher('.cci-cab-tabs', val => {
      cciLocalCab = val;
      renderCciBar(currentRecords);
    });
    registerLocalSwitcher('.cci-equipe-tabs', val => {
      cciLocalEquipe = val;
      renderCciBar(currentRecords);
    });
    registerLocalSwitcher('.cci-cci-tabs', val => {
      cciLocalCci = val;
      renderCciBar(currentRecords);
    });

    // 3. Heatmap Chart
    registerLocalSwitcher('.heatmap-cab-tabs', val => {
      heatmapLocalCab = val;
      renderHeatmap(currentRecords);
    });
    registerLocalSwitcher('.heatmap-equipe-tabs', val => {
      heatmapLocalEquipe = val;
      renderHeatmap(currentRecords);
    });
    registerLocalSwitcher('.heatmap-cci-tabs', val => {
      heatmapLocalCci = val;
      renderHeatmap(currentRecords);
    });
  }

  /* ── Charts ── */

  function renderTimeline(records) {
    destroyChart('trTimeline');
    const ctx = getCtx('trTimeline');
    if (!ctx) return;

    let ok = records.filter(r => r.status === 'ok');

    // Local filters for Timeline
    if (timelineLocalCab !== 'all') {
      ok = ok.filter(r => r.cabeceira === timelineLocalCab);
    }
    if (timelineLocalEquipe !== 'todas') {
      ok = ok.filter(r => r.equipe === timelineLocalEquipe);
    }

    const ccis = timelineLocalCci === 'todos' ? ['1°CCI', '2°CCI', '3°CCI', '4°CCI'] : [timelineLocalCci];
    const cciColors = { '1°CCI': '#00d2ff', '2°CCI': '#00ff87', '3°CCI': '#ffd32a', '4°CCI': '#b026ff' };

    const usedMonthIndices = [...new Set(ok.map(r => r.mesIndex))].sort((a, b) => a - b);
    const labels = usedMonthIndices.map(i => MONTHS[i] || `Mês ${i + 1}`);

    const isRadar = activeTimelineType === 'radar';
    const isLine = activeTimelineType === 'line';

    const datasets = ccis.filter(cci => ok.some(r => r.cci === cci)).map(cci => {
      const color = cciColors[cci] || '#ccc';
      const data = usedMonthIndices.map(mi => {
        const group = ok.filter(r => r.cci === cci && r.mesIndex === mi);
        if (!group.length) return null;
        return Math.round(group.reduce((s, r) => s + (r.tempoSeconds || 0), 0) / group.length);
      });

      const config = {
        label: cci,
        data
      };

      if (isRadar) {
        config.backgroundColor = color + '33';
        config.borderColor = color;
        config.borderWidth = 2;
        config.pointBackgroundColor = color;
        config.pointRadius = 4;
      } else if (isLine) {
        config.borderColor = color;
        config.backgroundColor = color + '33';
        config.pointBackgroundColor = color;
        config.pointBorderColor = '#fff';
        config.pointRadius = 5;
        config.pointHoverRadius = 7;
        config.tension = 0.3;
        config.spanGaps = true;
        config.fill = false;
      } else {
        config.backgroundColor = color;
        config.borderColor = color;
        config.borderWidth = 1;
        config.borderRadius = 4;
      }
      return config;
    });

    // Meta line based on active CCI local filter
    const activeCci = timelineLocalCci;
    let currentMetaLimit = 120;
    let metaLabel = 'Meta (02:00)';
    if (activeCci === '2°CCI') {
      currentMetaLimit = 180;
      metaLabel = 'Meta (03:00)';
    } else if (activeCci === '3°CCI' || activeCci === '4°CCI') {
      currentMetaLimit = 240;
      metaLabel = 'Meta (04:00)';
    } else if (activeCci === 'todos') {
      metaLabel = 'Meta 1°CCI (02:00)';
    }

    datasets.push({
      label: metaLabel,
      data: usedMonthIndices.map(() => currentMetaLimit),
      borderColor: COLORS.red,
      borderDash: [8, 4],
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0
    });

    const config = {
      type: isRadar ? 'radar' : (isLine ? 'line' : 'bar'),
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Evolução Mensal por CCI', font: { size: 16 } },
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${formatTime(ctx.parsed.y || ctx.raw)}`
            }
          }
        }
      }
    };

    if (isRadar) {
      config.options.scales = {
        r: {
          beginAtZero: true,
          ticks: { callback: v => formatTime(v), stepSize: 30, backdropColor: 'transparent' },
          grid: { color: 'rgba(255,255,255,0.08)' },
          angleLines: { color: 'rgba(255,255,255,0.08)' }
        }
      };
    } else {
      config.options.scales = {
        x: { title: { display: true, text: 'Mês' } },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Tempo (segundos)' },
          ticks: { callback: v => formatTime(v) }
        }
      };
    }

    chartInstances.trTimeline = new Chart(ctx, config);
  }



  function renderCciBar(records) {
    destroyChart('trCci');
    const ctx = getCtx('trCci');
    if (!ctx) return;

    let ok = records.filter(r => r.status === 'ok');

    // Local filters for CCI Comparativo
    if (cciLocalCab !== 'all') {
      ok = ok.filter(r => r.cabeceira === cciLocalCab);
    }

    const ccis = cciLocalCci === 'todos' ? ['1°CCI', '2°CCI', '3°CCI', '4°CCI'] : [cciLocalCci];

    const isHorizontal = activeCciType === 'horizontalBar';
    const isLine = activeCciType === 'line';

    const selectedEquipes = cciLocalEquipe === 'todas' ? EQUIPES : [cciLocalEquipe];

    const datasets = selectedEquipes.map(equipe => {
      const color = COLORS.equipes[equipe];
      const config = {
        label: equipe,
        data: ccis.map(cci => {
          const group = ok.filter(r => r.equipe === equipe && r.cci === cci);
          return group.length ? Math.round(group.reduce((s, r) => s + (r.tempoSeconds || 0), 0) / group.length) : 0;
        })
      };

      if (isLine) {
        config.borderColor = color;
        config.backgroundColor = color + '22';
        config.borderWidth = 3;
        config.pointBackgroundColor = color;
        config.pointRadius = 4;
        config.fill = false;
        config.tension = 0.2;
      } else {
        config.backgroundColor = color;
        config.borderColor = color;
        config.borderWidth = 1;
        config.borderRadius = 4;
      }
      return config;
    });

    const config = {
      type: isLine ? 'line' : 'bar',
      data: { labels: ccis, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Tempo Médio por CCI e Equipe', font: { size: 16 } },
          legend: { position: 'top' },
          tooltip: {
            callbacks: { label: ctx => `${ctx.dataset.label}: ${formatTime(ctx.parsed.y || ctx.raw)}` }
          }
        }
      }
    };

    if (isHorizontal) {
      config.options.indexAxis = 'y';
      config.options.scales = {
        x: { beginAtZero: true, title: { display: true, text: 'Tempo Médio (segundos)' }, ticks: { callback: v => formatTime(v) } },
        y: { title: { display: true, text: 'CCI' } }
      };
    } else {
      config.options.scales = {
        x: { title: { display: true, text: 'CCI' } },
        y: { beginAtZero: true, title: { display: true, text: 'Tempo Médio (segundos)' }, ticks: { callback: v => formatTime(v) } }
      };
    }

    chartInstances.trCci = new Chart(ctx, config);
  }

  function renderHeatmap(records) {
    destroyChart('trHeatmap');
    const ctx = getCtx('trHeatmap');
    if (!ctx) return;

    let ok = records.filter(r => r.status === 'ok');

    // Apply local chart filters
    if (heatmapLocalCab !== 'all') {
      ok = ok.filter(r => r.cabeceira === heatmapLocalCab);
    }
    if (heatmapLocalCci !== 'todos') {
      ok = ok.filter(r => r.cci === heatmapLocalCci);
    }
    if (heatmapLocalEquipe !== 'todas') {
      ok = ok.filter(r => r.equipe === heatmapLocalEquipe);
    }

    const usedMonthIndices = [...new Set(ok.map(r => r.mesIndex))].sort((a, b) => a - b);
    const labels = usedMonthIndices.map(i => MONTHS[i] || `Mês ${i + 1}`);

    const ccis = heatmapLocalCci === 'todos' ? ['1°CCI', '2°CCI', '3°CCI', '4°CCI'] : [heatmapLocalCci];

    const isStacked = activeHeatmapType === 'bar';
    const isLine = activeHeatmapType === 'line';

    const datasets = [];

    // Order: first all Excelente datasets, then all Satisfatório, then all Insatisfatório
    // So we can index them predictably for the custom legend

    // 1. Excelente
    ccis.forEach(cci => {
      datasets.push({
        label: `${cci} — Excelente`,
        data: usedMonthIndices.map(mi => {
          return ok.filter(r => r.cci === cci && r.mesIndex === mi && classifyRecordTR(r) === 'Excelente').length;
        }),
        backgroundColor: '#00ff87cc',
        borderColor: '#00ff87',
        borderWidth: isLine ? 3 : 1,
        pointRadius: isLine ? 4 : 0,
        fill: false,
        tension: isLine ? 0.2 : 0,
        stack: isStacked ? cci : undefined,
        borderRadius: isLine ? 0 : 2
      });
    });

    // 2. Satisfatório
    ccis.forEach(cci => {
      datasets.push({
        label: `${cci} — Satisfatório`,
        data: usedMonthIndices.map(mi => {
          return ok.filter(r => r.cci === cci && r.mesIndex === mi && classifyRecordTR(r) === 'Satisfatório').length;
        }),
        backgroundColor: '#ffd32acc',
        borderColor: '#ffd32a',
        borderWidth: isLine ? 3 : 1,
        pointRadius: isLine ? 4 : 0,
        fill: false,
        tension: isLine ? 0.2 : 0,
        stack: isStacked ? cci : undefined,
        borderRadius: isLine ? 0 : 2
      });
    });

    // 3. Insatisfatório
    ccis.forEach(cci => {
      datasets.push({
        label: `${cci} — Insatisfatório`,
        data: usedMonthIndices.map(mi => {
          return ok.filter(r => r.cci === cci && r.mesIndex === mi && classifyRecordTR(r) === 'Insatisfatório').length;
        }),
        backgroundColor: '#ff0055cc',
        borderColor: '#ff0055',
        borderWidth: isLine ? 3 : 1,
        pointRadius: isLine ? 4 : 0,
        fill: false,
        tension: isLine ? 0.2 : 0,
        stack: isStacked ? cci : undefined,
        borderRadius: isLine ? 0 : 2
      });
    });

    const config = {
      type: isLine ? 'line' : 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { 
            title: { display: true, text: 'Mês' },
            stacked: isStacked
          },
          y: { 
            beginAtZero: true, 
            title: { display: true, text: 'Registros' },
            stacked: isStacked
          }
        },
        plugins: {
          title: { display: true, text: 'Conformidade por Mês e CCI', font: { size: 16 } },
          legend: {
            position: 'top',
            labels: {
              generateLabels: function(chart) {
                if (!chart.data || !chart.data.datasets.length) return [];
                
                const excelIdx = chart.data.datasets.findIndex(ds => ds.label.includes('Excelente'));
                const satisIdx = chart.data.datasets.findIndex(ds => ds.label.includes('Satisfatório'));
                const ruimIdx = chart.data.datasets.findIndex(ds => ds.label.includes('Insatisfatório'));

                const labels = [];
                if (excelIdx !== -1) {
                  labels.push({
                    text: 'Excelente (≤ 2min)',
                    fillStyle: '#00ff87cc',
                    strokeStyle: '#00ff87',
                    lineWidth: 1,
                    hidden: !chart.isDatasetVisible(excelIdx),
                    index: excelIdx
                  });
                }
                if (satisIdx !== -1) {
                  labels.push({
                    text: 'Satisfatório (2-3min)',
                    fillStyle: '#ffd32acc',
                    strokeStyle: '#ffd32a',
                    lineWidth: 1,
                    hidden: !chart.isDatasetVisible(satisIdx),
                    index: satisIdx
                  });
                }
                if (ruimIdx !== -1) {
                  labels.push({
                    text: 'Insatisfatório (> 3min)',
                    fillStyle: '#ff0055cc',
                    strokeStyle: '#ff0055',
                    lineWidth: 1,
                    hidden: !chart.isDatasetVisible(ruimIdx),
                    index: ruimIdx
                  });
                }
                return labels;
              }
            },
            onClick: function(e, legendItem, legend) {
              const chart = legend.chart;
              const targetIndex = legendItem.index;
              const statusText = legendItem.text.split(' ')[0];
              const isCurrentlyVisible = chart.isDatasetVisible(targetIndex);

              chart.data.datasets.forEach((ds, idx) => {
                if (ds.label.includes(statusText)) {
                  chart.setDatasetVisibility(idx, !isCurrentlyVisible);
                }
              });
              chart.update();
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || '';
                const val = context.raw || 0;
                return `${label}: ${val} registro(s)`;
              }
            }
          }
        }
      }
    };

    chartInstances.trHeatmap = new Chart(ctx, config);
  }

  /* ── Table ── */

  function renderTable(records) {
    const tbody = document.getElementById('tbody-tr');
    if (!tbody) return;

    tbody.innerHTML = '';
    const filtered = records.filter(r => r.status !== 'na' && r.status !== 'empty');

    filtered.forEach(r => {
      const tr = document.createElement('tr');
      const isNr = r.status === 'nr';
      const isWithin = r.status === 'ok' && r.tempoSeconds <= getMetaForRecord(r);
      const isAbove = r.status === 'ok' && r.tempoSeconds > getMetaForRecord(r);

      let tempoBadge = r.tempoFormatted || '—';
      if (isWithin) tempoBadge = `<span class="badge badge-green">${r.tempoFormatted}</span>`;
      else if (isAbove) tempoBadge = `<span class="badge badge-red">${r.tempoFormatted}</span>`;

      let statusBadge = r.status === 'ok' ? 'OK' : '';
      if (isNr) statusBadge = '<span class="badge badge-muted">NR</span>';

      tr.innerHTML = `
        <td>${r.cabeceira || '—'}</td>
        <td>${r.equipe || '—'}</td>
        <td>${r.mes || '—'}</td>
        <td>${r.cci || '—'}</td>
        <td>${tempoBadge}</td>
        <td>${statusBadge}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ── Main render / destroy ── */

  function render(records, cabeceira) {
    console.log('[TR] Rendering TR charts, records:', records ? records.length : 0, 'cabeceira:', cabeceira);
    records = records || [];
    currentRecords = records;
    currentCab = cabeceira || 'all';

    // Set up switchers and local filters
    setupTypeSelectors();
    setupLocalChartFilters();

    const filtered = filterByCabeceira(records, cabeceira);

    const emptyEl = document.getElementById('tr-empty');
    const chartsGrid = document.querySelector('#section-tr .charts-grid');
    const tableWrapper = document.getElementById('table-tr');

    if (emptyEl) emptyEl.style.display = filtered.length ? 'none' : 'flex';
    if (chartsGrid) chartsGrid.style.display = filtered.length ? '' : 'none';
    if (tableWrapper) tableWrapper.style.display = filtered.length ? '' : 'none';

    if (!filtered.length) {
      setText('kpi-tr-total', '0');
      setText('kpi-tr-meta', '0');
      setText('kpi-tr-avg', '—');
      setText('kpi-tr-pct', '0%');
      destroy();
      return;
    }

    renderKPIs(filtered);
    renderTimeline(filtered);
    renderCciBar(filtered);
    renderHeatmap(filtered);
    renderTable(filtered);
  }

  function destroy() {
    destroyChart('trTimeline');
    destroyChart('trCci');
    destroyChart('trHeatmap');

    // Reset local filters state
    timelineLocalCab = 'all';
    timelineLocalEquipe = 'todas';
    timelineLocalCci = 'todos';

    cciLocalCab = 'all';
    cciLocalEquipe = 'todas';
    cciLocalCci = 'todos';

    heatmapLocalCab = 'all';
    heatmapLocalEquipe = 'todas';
    heatmapLocalCci = 'todos';

    // Reset tab active classes for all local switcher groups
    const switcherSelectors = [
      '.timeline-cab-tabs', '.timeline-equipe-tabs', '.timeline-cci-tabs',
      '.cci-cab-tabs', '.cci-equipe-tabs', '.cci-cci-tabs',
      '.heatmap-cab-tabs', '.heatmap-equipe-tabs', '.heatmap-cci-tabs'
    ];

    switcherSelectors.forEach(sel => {
      document.querySelectorAll(sel + ' .local-tab').forEach(t => {
        const val = t.getAttribute('data-val');
        if (val === 'all' || val === 'todas' || val === 'todos') {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });
    });
  }

  window.SESCINC.Charts.TR = { render, destroy };
})();
