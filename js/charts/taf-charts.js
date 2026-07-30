/**
 * SESCINC SBGL Dashboard — TAF Charts
 * Teste de Aptidão Física charts, KPIs, and table
 */
(function () {
  'use strict';

  window.SESCINC = window.SESCINC || {};
  window.SESCINC.Charts = window.SESCINC.Charts || {};

  const COLORS = {
    blue: '#38bdf8', cyan: '#22d3ee', green: '#34d399',
    amber: '#fbbf24', red: '#ef4444', purple: '#c084fc',
    pink: '#f472b6', indigo: '#818cf8', teal: '#2dd4bf',
    equipes: { 'ALFA': '#38bdf8', 'BRAVO': '#34d399', 'CHARLIE': '#fbbf24', 'DELTA': '#ef4444', 'FOLGUISTA': '#c084fc' },
    resultadosTAF: { 'Satisfatório': '#34d399', 'Insatisfatório': '#ef4444' }
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
      
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      ctx.save();
      ctx.font = `bold ${Math.min(width, height) * 0.15}px Inter`;
      ctx.fillStyle = isDark ? '#f8fafc' : '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(meta.text), left + width / 2, top + height / 2 - 10);
      ctx.font = `600 ${Math.min(width, height) * 0.08}px Inter`;
      ctx.fillStyle = isDark ? '#cbd5e1' : '#1e293b';
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
  let activeIdadeSimplifiedType = 'bar';
  let currentRecords = [];
  let listenersAttached = false;

  function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
      isDark,
      textColor: isDark ? '#f8fafc' : '#000000',
      gridColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
      green: isDark ? '#6ee7b7' : '#34d399', // Verde Pastel
      amber: isDark ? '#fbbf24' : '#d97706',
      red: isDark ? '#ef4444' : '#c62828',
      blue: isDark ? '#38bdf8' : '#0284c7',
      cyan: isDark ? '#22d3ee' : '#0891b2',
      equipes: {
        'ALFA': isDark ? '#38bdf8' : '#0284c7',
        'BRAVO': isDark ? '#6ee7b7' : '#34d399',
        'CHARLIE': isDark ? '#fbbf24' : '#d97706',
        'DELTA': isDark ? '#ef4444' : '#c62828',
        'FOLGUISTA': isDark ? '#c084fc' : '#7c3aed'
      }
    };
  }

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
      } else if (chartKey === 'tafIdadeSimplified') {
        activeIdadeSimplifiedType = type;
        renderIdadeSimplified(currentRecords);
      }
    });
  }

  /* ── Charts ── */

  function renderDonut(records) {
    destroyChart('tafDonut');
    const ctx = getCtx('tafDonut');
    if (!ctx) return;

    const tc = getThemeColors();
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
          backgroundColor: [tc.green, tc.red],
          borderColor: 'rgba(0,0,0,0.3)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Resultado TAF', font: { size: 16, weight: 'bold' }, color: tc.textColor },
          legend: { position: isBar ? 'top' : 'bottom', labels: { color: tc.textColor } }
        }
      }
    };

    if (isBar) {
      config.options.scales = {
        y: { beginAtZero: true, title: { display: true, text: 'Quantidade', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } },
        x: { ticks: { color: tc.textColor }, grid: { color: tc.gridColor } }
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

    const tc = getThemeColors();
    const ok = records.filter(r => r.status === 'ok');
    const equipes = EQUIPES.filter(e => ok.some(r => r.equipe === e));

    const satData = equipes.map(e => ok.filter(r => r.equipe === e && r.resultado === 'Satisfatório').length);
    const insatData = equipes.map(e => ok.filter(r => r.equipe === e && r.resultado === 'Insatisfatório').length);

    const isStacked = activeEquipeType === 'bar';
    const isLine = activeEquipeType === 'line';

    const datasets = [
      { label: 'Satisfatório', data: satData, backgroundColor: tc.green, borderColor: tc.green },
      { label: 'Insatisfatório', data: insatData, backgroundColor: tc.red, borderColor: tc.red }
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
        onClick: function(evt, elements) {
          if (!elements.length) return;
          const activeElement = elements[0];
          const dataIndex = activeElement.index;
          const datasetIndex = activeElement.datasetIndex;

          const team = equipes[dataIndex];
          const resultType = datasetIndex === 0 ? 'Satisfatório' : 'Insatisfatório';

          const okRecs = currentRecords.filter(r => r.status === 'ok');
          const names = okRecs.filter(r => r.equipe === team && r.resultado === resultType)
                              .map(r => r.nome).filter(Boolean);

          if (names.length && window.SESCINC.showDetailModal) {
            window.SESCINC.showDetailModal('Equipe ' + team + ' — ' + resultType, names);
          }
        },
        scales: {
          x: { title: { display: true, text: 'Equipe', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } },
          y: { beginAtZero: true, title: { display: true, text: 'Quantidade', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } }
        },
        plugins: {
          title: { display: true, text: 'Resultado por Equipe', font: { size: 16, weight: 'bold' }, color: tc.textColor },
          legend: { position: 'top', labels: { color: tc.textColor } }
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

    const tc = getThemeColors();
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
          backgroundColor: data.map(v => v >= 80 ? tc.green : (v >= 50 ? tc.amber : tc.red)),
          borderColor: isLine ? tc.blue : 'rgba(0,0,0,0.1)',
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
          title: { display: true, text: 'Aprovação por Função', font: { size: 16, weight: 'bold' }, color: tc.textColor },
          legend: { display: isLine, labels: { color: tc.textColor } }
        }
      }
    };

    if (isHorizontal) {
      config.options.indexAxis = 'y';
      config.options.scales = {
        x: { beginAtZero: true, max: 100, title: { display: true, text: '% Aprovação', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } },
        y: { title: { display: true, text: 'Função', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } }
      };
    } else {
      config.options.scales = {
        y: { beginAtZero: true, max: 100, title: { display: true, text: '% Aprovação', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } },
        x: { title: { display: true, text: 'Função', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } }
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
        onClick: function(evt, elements) {
          if (!elements.length) return;
          const activeElement = elements[0];
          const datasetIndex = activeElement.datasetIndex;
          const dataIndex = activeElement.index;

          const team = datasets[datasetIndex].label;
          const exercise = labels[dataIndex];

          const okRecs = currentRecords.filter(r => r.status === 'ok' && r.equipe === team);
          const names = okRecs.map(r => {
            let val = '';
            if (exercise.indexOf('Flexão') >= 0) val = r.flexao != null ? r.flexao : '—';
            else if (exercise.indexOf('Abdominal') >= 0) val = r.abdominal != null ? r.abdominal : '—';
            else if (exercise.indexOf('Barra') >= 0) val = r.barra != null ? r.barra : '—';
            else if (exercise.indexOf('Corrida') >= 0) val = r.corrida || '—';
            return `${r.nome} (${exercise}: ${val})`;
          }).filter(Boolean);

          if (names.length && window.SESCINC.showDetailModal) {
            window.SESCINC.showDetailModal('Equipe ' + team + ' — ' + exercise, names);
          }
        },
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
        onClick: function(evt, elements) {
          if (!elements.length) return;
          const idx = elements[0].index;
          const bucket = AGE_BUCKETS[idx];
          const okRecs = currentRecords.filter(r => r.status === 'ok');
          const names = okRecs.filter(r => getAgeBucket(r.idade) === bucket).map(r => r.nome).filter(Boolean);
          if (names.length && window.SESCINC.showDetailModal) {
            window.SESCINC.showDetailModal('Faixa Etária: ' + bucket, names);
          }
        },
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

  function renderIdadeSimplified(records) {
    destroyChart('tafIdadeSimplified');
    const ctx = getCtx('tafIdadeSimplified');
    if (!ctx) return;

    const tc = getThemeColors();
    const ok = records.filter(r => r.status === 'ok');

    const buckets = [
      { label: '0–40', filter: r => r.idade <= 40 },
      { label: '41+',  filter: r => r.idade > 40 }
    ];

    const bucketData = buckets.map(b => {
      const group = ok.filter(b.filter);
      const sat = group.filter(r => r.resultado === 'Satisfatório').length;
      const total = group.length;
      const ratio = total ? sat / total : 0;
      return { total, sat, ratio, names: group.map(r => r.nome).filter(Boolean) };
    });

    const isHorizontal = activeIdadeSimplifiedType === 'horizontalBar';
    const isLine = activeIdadeSimplifiedType === 'line';
    const chartType = isLine ? 'line' : 'bar';

    const config = {
      type: chartType,
      data: {
        labels: buckets.map(b => b.label),
        datasets: [{
          label: 'Avaliados',
          data: bucketData.map(b => b.total),
          backgroundColor: isLine ? (tc.isDark ? '#38bdf8' : '#0284c7') : bucketData.map(b => b.ratio >= 0.8 ? tc.green : (b.ratio >= 0.5 ? tc.amber : tc.red)),
          borderColor: isLine ? (tc.isDark ? '#38bdf8' : '#0284c7') : 'rgba(0,0,0,0.1)',
          borderWidth: isLine ? 3 : 1,
          borderRadius: isLine ? 0 : 4,
          fill: false,
          tension: 0.2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: function(evt, elements) {
          if (!elements.length) return;
          const idx = elements[0].index;
          const b = bucketData[idx];
          if (b.names.length && window.SESCINC.showDetailModal) {
            window.SESCINC.showDetailModal('Faixa Etária: ' + buckets[idx].label, b.names);
          }
        },
        plugins: {
          title: { display: true, text: 'Idade Simplificada', font: { size: 16, weight: 'bold' }, color: tc.textColor },
          legend: { display: isLine, labels: { color: tc.textColor } },
          tooltip: {
            callbacks: {
              afterLabel(ctx) {
                const b = bucketData[ctx.dataIndex];
                return `Aprovação: ${Math.round(b.ratio * 100)}%`;
              }
            }
          }
        }
      }
    };

    if (isHorizontal) {
      config.options.indexAxis = 'y';
      config.options.scales = {
        x: { beginAtZero: true, title: { display: true, text: 'Quantidade', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } },
        y: { title: { display: true, text: 'Faixa Etária', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } }
      };
    } else {
      config.options.scales = {
        x: { title: { display: true, text: 'Faixa Etária', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } },
        y: { beginAtZero: true, title: { display: true, text: 'Quantidade', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } }
      };
    }

    chartInstances.tafIdadeSimplified = new Chart(ctx, config);
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
        <td>${r.mes || '—'}</td>
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
    const chartsGrid = document.querySelector('#section-taf .charts-grid');
    const tableWrapper = document.getElementById('table-taf');

    if (emptyEl) emptyEl.style.display = records.length ? 'none' : 'flex';
    if (chartsGrid) chartsGrid.style.display = records.length ? '' : 'none';
    if (tableWrapper) tableWrapper.style.display = records.length ? '' : 'none';

    if (!records.length) {
      setText('kpi-taf-total', '0');
      setText('kpi-taf-sat', '0');
      setText('kpi-taf-insat', '0');
      setText('kpi-taf-pct', '0%');
      destroy();
      return;
    }

    renderKPIs(records);
    renderDonut(records);
    renderEquipeBar(records);
    renderFuncaoBar(records);
    renderRadar(records);
    renderIdadeHistogram(records);
    renderIdadeSimplified(records);
    renderTable(records);
  }

  function destroy() {
    destroyChart('tafDonut');
    destroyChart('tafEquipe');
    destroyChart('tafFuncao');
    destroyChart('tafRadar');
    destroyChart('tafIdade');
    destroyChart('tafIdadeSimplified');
  }

  window.SESCINC.Charts.TAF = { render, destroy };
})();
