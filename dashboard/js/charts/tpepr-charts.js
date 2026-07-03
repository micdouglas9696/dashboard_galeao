/**
 * SESCINC SBGL Dashboard — TPEPR Charts
 * Teste Prático de EPR charts, KPIs, and table
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
    resultadosTPEPR: { 'Excelente': '#00ff87', 'Bom': '#ffd32a', 'Ruim': '#ff0055' }
  };

  const EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'FOLGUISTA'];
  const RESULTADO_ORDER = ['Excelente', 'Bom', 'Ruim'];
  const chartInstances = {};

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

  /* ── KPIs ── */

  function renderKPIs(records) {
    const exc = records.filter(r => r.resultado === 'Excelente').length;
    const bom = records.filter(r => r.resultado === 'Bom').length;
    const ruim = records.filter(r => r.resultado === 'Ruim').length;

    setText('kpi-tpepr-total', records.length);
    setText('kpi-tpepr-exc', exc);
    setText('kpi-tpepr-bom', bom);
    setText('kpi-tpepr-ruim', ruim);
  }

  let activeDonutType = 'doughnut';
  let activeEquipeType = 'bar';
  let activeFuncaoType = 'horizontalBar';
  let activeHistogramType = 'bar';
  let currentRecords = [];
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

      if (chartKey === 'tpeprDonut') {
        activeDonutType = type;
        renderDonut(currentRecords);
      } else if (chartKey === 'tpeprEquipe') {
        activeEquipeType = type;
        renderEquipeBar(currentRecords);
      } else if (chartKey === 'tpeprFuncao') {
        activeFuncaoType = type;
        renderFuncaoBar(currentRecords);
      } else if (chartKey === 'tpeprHistogram') {
        activeHistogramType = type;
        renderHistogram(currentRecords);
      }
    });
  }

  /* ── Charts ── */

  function renderDonut(records) {
    destroyChart('tpeprDonut');
    const ctx = getCtx('tpeprDonut');
    if (!ctx) return;

    const counts = RESULTADO_ORDER.map(r => records.filter(rec => rec.resultado === r).length);
    const isBar = activeDonutType === 'bar';
    const chartType = isBar ? 'bar' : activeDonutType;

    const config = {
      type: chartType,
      data: {
        labels: RESULTADO_ORDER,
        datasets: [{
          data: counts,
          backgroundColor: RESULTADO_ORDER.map(r => COLORS.resultadosTPEPR[r]),
          borderColor: 'rgba(0,0,0,0.3)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Resultado TP-EPR', font: { size: 16 } },
          legend: { position: isBar ? 'top' : 'bottom' }
        }
      }
    };

    if (isBar) {
      config.options.scales = {
        y: { beginAtZero: true, title: { display: true, text: 'Quantidade' } }
      };
    } else {
      config.options.cutout = '65%';
      config.options.plugins.centerText = { text: `${records.length}`, subText: 'avaliados' };
    }

    chartInstances.tpeprDonut = new Chart(ctx, config);
  }

  function renderEquipeBar(records) {
    destroyChart('tpeprEquipe');
    const ctx = getCtx('tpeprEquipe');
    if (!ctx) return;

    const equipes = EQUIPES.filter(e => records.some(r => r.equipe === e));

    const isStacked = activeEquipeType === 'bar';
    const isLine = activeEquipeType === 'line';

    const datasets = RESULTADO_ORDER.map(resultado => {
      const config = {
        label: resultado,
        data: equipes.map(e => records.filter(r => r.equipe === e && r.resultado === resultado).length),
        backgroundColor: COLORS.resultadosTPEPR[resultado],
        borderColor: COLORS.resultadosTPEPR[resultado]
      };

      if (isLine) {
        config.borderWidth = 3;
        config.pointRadius = 4;
        config.fill = false;
        config.tension = 0.3;
      } else {
        config.borderWidth = 1;
        config.borderRadius = 4;
      }

      return config;
    });

    const config = {
      type: isLine ? 'line' : 'bar',
      data: { labels: equipes, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Equipe' } },
          y: { beginAtZero: true, title: { display: true, text: 'Quantidade' } }
        },
        plugins: {
          title: { display: true, text: 'Resultado por Equipe', font: { size: 16 } },
          legend: { position: 'top' }
        }
      }
    };

    if (!isLine) {
      config.options.scales.x.stacked = isStacked;
      config.options.scales.y.stacked = isStacked;
    }

    chartInstances.tpeprEquipe = new Chart(ctx, config);
  }

  function renderFuncaoBar(records) {
    destroyChart('tpeprFuncao');
    const ctx = getCtx('tpeprFuncao');
    if (!ctx) return;

    const funcoes = [...new Set(records.map(r => r.funcao))].filter(Boolean).sort();

    const data = funcoes.map(f => {
      const group = records.filter(r => r.funcao === f);
      return group.length ? Math.round(group.reduce((s, r) => s + (r.tempoSeconds || 0), 0) / group.length) : 0;
    });

    const maxVal = Math.max(...data, 1);
    const isHorizontal = activeFuncaoType === 'horizontalBar';
    const isLine = activeFuncaoType === 'line';

    const config = {
      type: isLine ? 'line' : 'bar',
      data: {
        labels: funcoes,
        datasets: [{
          label: 'Tempo Médio (s)',
          data,
          backgroundColor: data.map(v => {
            const ratio = v / maxVal;
            if (ratio <= 0.5) return COLORS.green;
            if (ratio <= 0.75) return COLORS.amber;
            return COLORS.red;
          }),
          borderColor: isLine ? COLORS.blue : 'rgba(0,0,0,0.1)',
          borderWidth: isLine ? 3 : 1,
          borderRadius: isLine ? 0 : 4,
          fill: false,
          tension: 0.2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Tempo Médio por Função', font: { size: 16 } },
          legend: { display: isLine }
        }
      }
    };

    if (isHorizontal) {
      config.options.indexAxis = 'y';
      config.options.scales = {
        x: { beginAtZero: true, title: { display: true, text: 'Tempo Médio (segundos)' } },
        y: { title: { display: true, text: 'Função' } }
      };
    } else {
      config.options.scales = {
        y: { beginAtZero: true, title: { display: true, text: 'Tempo Médio (segundos)' } },
        x: { title: { display: true, text: 'Função' } }
      };
    }

    chartInstances.tpeprFuncao = new Chart(ctx, config);
  }

  function renderHistogram(records) {
    destroyChart('tpeprHistogram');
    const ctx = getCtx('tpeprHistogram');
    if (!ctx) return;

    const buckets = ['30-40', '40-50', '50-60', '60-70', '70-80', '80-90', '90+'];
    const ranges = [[30, 40], [40, 50], [50, 60], [60, 70], [70, 80], [80, 90], [90, Infinity]];

    const counts = ranges.map(([min, max]) =>
      records.filter(r => r.tempoSeconds >= min && r.tempoSeconds < max).length
    );

    const isRadar = activeHistogramType === 'radar';
    const isLine = activeHistogramType === 'line';

    const config = {
      type: isRadar ? 'radar' : (isLine ? 'line' : 'bar'),
      data: {
        labels: buckets,
        datasets: [{
          label: 'Quantidade',
          data: counts,
          backgroundColor: isRadar ? 'rgba(6, 182, 212, 0.2)' : counts.map((_, i) => {
            const ratio = i / (ranges.length - 1);
            if (ratio <= 0.3) return COLORS.green;
            if (ratio <= 0.6) return COLORS.amber;
            return COLORS.red;
          }),
          borderColor: isRadar || isLine ? COLORS.cyan : 'rgba(0,0,0,0.1)',
          borderWidth: isLine ? 3 : 1,
          borderRadius: isLine || isRadar ? 0 : 4,
          fill: isRadar ? true : false,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Distribuição de Tempos', font: { size: 16 } },
          legend: { display: isRadar }
        }
      }
    };

    if (isRadar) {
      config.options.scales = {
        r: {
          beginAtZero: true,
          ticks: { stepSize: 5, backdropColor: 'transparent' },
          grid: { color: 'rgba(255,255,255,0.08)' }
        }
      };
    } else {
      config.options.scales = {
        x: { title: { display: true, text: 'Tempo (segundos)' } },
        y: { beginAtZero: true, title: { display: true, text: 'Quantidade' } }
      };
    }

    chartInstances.tpeprHistogram = new Chart(ctx, config);
  }

  /* ── Table ── */

  function renderTable(records) {
    const tbody = document.getElementById('tbody-tpepr');
    if (!tbody) return;

    tbody.innerHTML = '';
    records.forEach(r => {
      const tr = document.createElement('tr');
      const badgeClass = r.resultado === 'Excelente' ? 'badge-green' :
                         r.resultado === 'Bom' ? 'badge-amber' : 'badge-red';

      tr.innerHTML = `
        <td>${r.nome || '—'}</td>
        <td>${r.equipe || '—'}</td>
        <td>${r.funcao || '—'}</td>
        <td>${r.tempoFormatted || '—'}</td>
        <td><span class="badge ${badgeClass}">${r.resultado || '—'}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ── Main render / destroy ── */

  function render(records) {
    console.log('[TPEPR] Rendering TPEPR charts, records:', records ? records.length : 0);
    records = records || [];
    currentRecords = records;

    // Set up switchers
    setupTypeSelectors();

    const emptyEl = document.getElementById('tpepr-empty');
    if (emptyEl) emptyEl.style.display = records.length ? 'none' : 'flex';

    if (!records.length) return;

    renderKPIs(records);
    renderDonut(records);
    renderEquipeBar(records);
    renderFuncaoBar(records);
    renderHistogram(records);
    renderTable(records);
  }

  function destroy() {
    destroyChart('tpeprDonut');
    destroyChart('tpeprEquipe');
    destroyChart('tpeprFuncao');
    destroyChart('tpeprHistogram');
  }

  window.SESCINC.Charts.TPEPR = { render, destroy };
})();
