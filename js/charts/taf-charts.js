/**
 * SESCINC SBGL Dashboard — TAF Charts
 * Teste de Aptidão Física charts, KPIs, and table
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
    resultadosTAF: { 'Satisfatório': '#00ff87', 'Insatisfatório': '#ff0055' }
  };

  const EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'FOLGUISTA'];
  const AGE_BUCKETS = ['18-25', '26-30', '31-35', '36-40', '41-45', '46-50', '51+'];
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

  function getAgeBucket(age) {
    if (age == null || isNaN(age)) return null;
    if (age <= 25) return '18-25';
    if (age <= 30) return '26-30';
    if (age <= 35) return '31-35';
    if (age <= 40) return '36-40';
    if (age <= 45) return '41-45';
    if (age <= 50) return '46-50';
    return '51+';
  }

  /* ── Center text plugin for Doughnut ── */
  const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
      if (chart.config.type !== 'doughnut') return;
      const { ctx, chartArea: { width, height, top, left } } = chart;
      
      const plugins = chart.options && chart.options.plugins;
      const meta = plugins && plugins.centerText;
      if (!meta || meta.text === undefined || meta.text === null || isNaN(meta.text)) return;
      
      ctx.save();
      ctx.font = `bold ${Math.min(width, height) * 0.15}px Inter`;
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(meta.text), left + width / 2, top + height / 2 - 10);
      ctx.font = `${Math.min(width, height) * 0.08}px Inter`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(String(meta.subText || ''), left + width / 2, top + height / 2 + 15);
      ctx.restore();
    }
  };

  if (typeof Chart !== 'undefined' && !Chart.registry.plugins.get('centerText')) {
    Chart.register(centerTextPlugin);
  }

  /* ── KPIs ── */

  function renderKPIs(records) {
    const ok = records.filter(r => r.status === 'ok');
    const sat = ok.filter(r => r.resultado === 'Satisfatório');
    const insat = ok.filter(r => r.resultado === 'Insatisfatório');
    const pct = ok.length ? Math.round((sat.length / ok.length) * 100) : 0;

    setText('kpi-taf-total', ok.length);
    setText('kpi-taf-sat', sat.length);
    setText('kpi-taf-insat', insat.length);
    setText('kpi-taf-pct', pct + '%');
  }

  let activeDonutType = 'doughnut';
  let activeEquipeType = 'bar';
  let activeFuncaoType = 'horizontalBar';
  let activeRadarType = 'radar';
  let activeIdadeType = 'bar';
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

      if (chartKey === 'tafDonut') {
        activeDonutType = type;
        renderDonut(currentRecords);
      } else if (chartKey === 'tafEquipe') {
        activeEquipeType = type;
        renderEquipeBar(currentRecords);
      } else if (chartKey === 'tafFuncao') {
        activeFuncaoType = type;
        renderFuncaoBar(currentRecords);
      } else if (chartKey === 'tafRadar') {
        activeRadarType = type;
        renderRadar(currentRecords);
      } else if (chartKey === 'tafIdade') {
        activeIdadeType = type;
        renderIdadeHistogram(currentRecords);
      }
    });
  }

  /* ── Charts ── */

  function renderDonut(records) {
    destroyChart('tafDonut');
    const ctx = getCtx('tafDonut');
    if (!ctx) return;

    const ok = records.filter(r => r.status === 'ok');
    const sat = ok.filter(r => r.resultado === 'Satisfatório').length;
    const insat = ok.filter(r => r.resultado === 'Insatisfatório').length;

    const isBar = activeDonutType === 'bar';
    const chartType = isBar ? 'bar' : activeDonutType;

    const config = {
      type: chartType,
      data: {
        labels: ['Satisfatório', 'Insatisfatório'],
        datasets: [{
          data: [sat, insat],
          backgroundColor: [COLORS.green, COLORS.red],
          borderColor: 'rgba(0,0,0,0.3)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Resultado TAF', font: { size: 16 } },
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
      config.options.plugins.centerText = { text: `${sat + insat}`, subText: 'avaliados' };
    }

    chartInstances.tafDonut = new Chart(ctx, config);
  }

  function renderEquipeBar(records) {
    destroyChart('tafEquipe');
    const ctx = getCtx('tafEquipe');
    if (!ctx) return;

    const ok = records.filter(r => r.status === 'ok');
    const equipes = EQUIPES.filter(e => ok.some(r => r.equipe === e));

    const satData = equipes.map(e => ok.filter(r => r.equipe === e && r.resultado === 'Satisfatório').length);
    const insatData = equipes.map(e => ok.filter(r => r.equipe === e && r.resultado === 'Insatisfatório').length);

    const isStacked = activeEquipeType === 'bar';
    const isLine = activeEquipeType === 'line';

    const datasets = [
      { label: 'Satisfatório', data: satData, backgroundColor: COLORS.green, borderColor: COLORS.green },
      { label: 'Insatisfatório', data: insatData, backgroundColor: COLORS.red, borderColor: COLORS.red }
    ];

    datasets.forEach(d => {
      if (isLine) {
        d.borderWidth = 3;
        d.pointRadius = 4;
        d.fill = false;
        d.tension = 0.3;
      } else {
        d.borderWidth = 1;
        d.borderRadius = 4;
      }
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

    chartInstances.tafEquipe = new Chart(ctx, config);
  }

  function renderFuncaoBar(records) {
    destroyChart('tafFuncao');
    const ctx = getCtx('tafFuncao');
    if (!ctx) return;

    const ok = records.filter(r => r.status === 'ok');
    const funcoes = [...new Set(ok.map(r => r.funcao))].filter(Boolean).sort();

    const data = funcoes.map(f => {
      const group = ok.filter(r => r.funcao === f);
      const sat = group.filter(r => r.resultado === 'Satisfatório').length;
      return group.length ? Math.round((sat / group.length) * 100) : 0;
    });

    const isHorizontal = activeFuncaoType === 'horizontalBar';
    const isLine = activeFuncaoType === 'line';

    const config = {
      type: isLine ? 'line' : 'bar',
      data: {
        labels: funcoes,
        datasets: [{
          label: '% Aprovação',
          data,
          backgroundColor: data.map(v => v >= 80 ? COLORS.green : (v >= 50 ? COLORS.amber : COLORS.red)),
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
          title: { display: true, text: 'Aprovação por Função', font: { size: 16 } },
          legend: { display: isLine }
        }
      }
    };

    if (isHorizontal) {
      config.options.indexAxis = 'y';
      config.options.scales = {
        x: { beginAtZero: true, max: 100, title: { display: true, text: '% Aprovação' } },
        y: { title: { display: true, text: 'Função' } }
      };
    } else {
      config.options.scales = {
        y: { beginAtZero: true, max: 100, title: { display: true, text: '% Aprovação' } },
        x: { title: { display: true, text: 'Função' } }
      };
    }

    chartInstances.tafFuncao = new Chart(ctx, config);
  }

  function renderRadar(records) {
    destroyChart('tafRadar');
    const ctx = getCtx('tafRadar');
    if (!ctx) return;

    const ok = records.filter(r => r.status === 'ok');
    const labels = ['Flexão', 'Abdominal', 'Barra', 'Corrida'];
    const equipes = EQUIPES.filter(e => ok.some(r => r.equipe === e));

    const maxFlexao = Math.max(...ok.map(r => r.flexao || 0), 1);
    const maxAbdominal = Math.max(...ok.map(r => r.abdominal || 0), 1);
    const maxBarra = Math.max(...ok.map(r => r.barra || 0), 1);
    const maxCorrida = Math.max(...ok.map(r => r.corridaSeconds || 0), 1);

    const datasets = equipes.map(equipe => {
      const group = ok.filter(r => r.equipe === equipe);
      if (!group.length) return null;

      const avgFlexao = group.reduce((s, r) => s + (r.flexao || 0), 0) / group.length;
      const avgAbdominal = group.reduce((s, r) => s + (r.abdominal || 0), 0) / group.length;
      const avgBarra = group.reduce((s, r) => s + (r.barra || 0), 0) / group.length;
      const avgCorrida = group.reduce((s, r) => s + (r.corridaSeconds || 0), 0) / group.length;

      const color = COLORS.equipes[equipe] || COLORS.blue;

      const config = {
        label: equipe,
        data: [
          Math.round((avgFlexao / maxFlexao) * 100),
          Math.round((avgAbdominal / maxAbdominal) * 100),
          Math.round((avgBarra / maxBarra) * 100),
          Math.round(((maxCorrida - avgCorrida) / maxCorrida) * 100)
        ]
      };

      if (activeRadarType === 'radar') {
        config.backgroundColor = color + '33';
        config.borderColor = color;
        config.borderWidth = 2;
        config.pointBackgroundColor = color;
        config.pointRadius = 4;
      } else if (activeRadarType === 'bar') {
        config.backgroundColor = color;
        config.borderColor = color;
        config.borderWidth = 1;
        config.borderRadius = 4;
      } else if (activeRadarType === 'line') {
        config.backgroundColor = color + '11';
        config.borderColor = color;
        config.borderWidth = 3;
        config.pointBackgroundColor = color;
        config.pointRadius = 4;
        config.fill = false;
        config.tension = 0.3;
      }

      return config;
    }).filter(Boolean);

    const isRadar = activeRadarType === 'radar';

    const config = {
      type: isRadar ? 'radar' : (activeRadarType === 'line' ? 'line' : 'bar'),
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Média por Modalidade (Normalizado)', font: { size: 16 } },
          legend: { position: 'top' }
        }
      }
    };

    if (isRadar) {
      config.options.scales = {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { stepSize: 20, backdropColor: 'transparent' },
          grid: { color: 'rgba(255,255,255,0.08)' },
          angleLines: { color: 'rgba(255,255,255,0.08)' }
        }
      };
    } else {
      config.options.scales = {
        y: { beginAtZero: true, max: 100, title: { display: true, text: 'Desempenho (%)' } },
        x: { title: { display: true, text: 'Modalidade' } }
      };
    }

    chartInstances.tafRadar = new Chart(ctx, config);
  }

  function renderIdadeHistogram(records) {
    destroyChart('tafIdade');
    const ctx = getCtx('tafIdade');
    if (!ctx) return;

    const ok = records.filter(r => r.status === 'ok');

    const bucketCounts = AGE_BUCKETS.map(bucket => {
      const group = ok.filter(r => getAgeBucket(r.idade) === bucket);
      const sat = group.filter(r => r.resultado === 'Satisfatório').length;
      const total = group.length;
      return { total, sat, ratio: total ? sat / total : 0 };
    });

    const isRadar = activeIdadeType === 'radar';
    const isLine = activeIdadeType === 'line';

    const config = {
      type: isRadar ? 'radar' : (isLine ? 'line' : 'bar'),
      data: {
        labels: AGE_BUCKETS,
        datasets: [{
          label: 'Avaliados',
          data: bucketCounts.map(b => b.total),
          backgroundColor: isRadar ? 'rgba(6, 182, 212, 0.2)' : bucketCounts.map(b => b.ratio >= 0.8 ? COLORS.green : (b.ratio >= 0.5 ? COLORS.amber : COLORS.red)),
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
          title: { display: true, text: 'Distribuição por Faixa Etária', font: { size: 16 } },
          legend: { display: isRadar },
          tooltip: {
            callbacks: {
              afterLabel(ctx) {
                const b = bucketCounts[ctx.dataIndex];
                return `Aprovação: ${Math.round(b.ratio * 100)}%`;
              }
            }
          }
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
        x: { title: { display: true, text: 'Faixa Etária' } },
        y: { beginAtZero: true, title: { display: true, text: 'Quantidade' } }
      };
    }

    chartInstances.tafIdade = new Chart(ctx, config);
  }

  /* ── Table ── */

  function renderTable(records) {
    const tbody = document.getElementById('tbody-taf');
    if (!tbody) return;

    tbody.innerHTML = '';
    records.forEach(r => {
      const tr = document.createElement('tr');
      const isMuted = r.status === 'ferias' || r.status === 'nr';
      if (isMuted) tr.classList.add('row-muted');

      const badgeClass = r.resultado === 'Satisfatório' ? 'badge-green' : 'badge-red';
      const statusLabel = r.status === 'ferias' ? 'Férias' : r.status === 'nr' ? 'NR' : '';

      tr.innerHTML = `
        <td>${r.nome || '—'}</td>
        <td>${r.equipe || '—'}</td>
        <td>${r.funcao || '—'}</td>
        <td>${r.idade != null ? r.idade : '—'}</td>
        <td>${r.flexao != null ? r.flexao : '—'}</td>
        <td>${r.abdominal != null ? r.abdominal : '—'}</td>
        <td>${r.barra != null ? r.barra : '—'}</td>
        <td>${r.corrida || '—'}</td>
        <td>${isMuted ? `<span class="badge badge-muted">${statusLabel}</span>` : `<span class="badge ${badgeClass}">${r.resultado}</span>`}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ── Main render / destroy ── */

  function render(records) {
    console.log('[TAF] Rendering TAF charts, records:', records ? records.length : 0);
    records = records || [];
    currentRecords = records;

    // Set up switchers
    setupTypeSelectors();

    const emptyEl = document.getElementById('taf-empty');
    if (emptyEl) emptyEl.style.display = records.length ? 'none' : 'flex';

    if (!records.length) return;

    renderKPIs(records);
    renderDonut(records);
    renderEquipeBar(records);
    renderFuncaoBar(records);
    renderRadar(records);
    renderIdadeHistogram(records);
    renderTable(records);
  }

  function destroy() {
    destroyChart('tafDonut');
    destroyChart('tafEquipe');
    destroyChart('tafFuncao');
    destroyChart('tafRadar');
    destroyChart('tafIdade');
  }

  window.SESCINC.Charts.TAF = { render, destroy };
})();
