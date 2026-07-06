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
    const cci1 = ok.filter(r => r.cci === '1°CCI');
    const withinMeta = cci1.filter(r => r.tempoSeconds <= META_SECONDS);
    const avgSeconds = cci1.length
      ? Math.round(cci1.reduce((s, r) => s + (r.tempoSeconds || 0), 0) / cci1.length)
      : 0;
    const pct = cci1.length ? Math.round((withinMeta.length / cci1.length) * 100) : 0;

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

  /* ── Charts ── */

  function renderTimeline(records) {
    destroyChart('trTimeline');
    const ctx = getCtx('trTimeline');
    if (!ctx) return;

    const ok = records.filter(r => r.status === 'ok' && r.cci === '1°CCI');
    const usedMonthIndices = [...new Set(ok.map(r => r.mesIndex))].sort((a, b) => a - b);
    const labels = usedMonthIndices.map(i => MONTHS[i] || `Mês ${i + 1}`);

    const isRadar = activeTimelineType === 'radar';
    const isLine = activeTimelineType === 'line';

    const datasets = EQUIPES.filter(e => ok.some(r => r.equipe === e)).map(equipe => {
      const color = COLORS.equipes[equipe];
      const data = usedMonthIndices.map(mi => {
        const group = ok.filter(r => r.equipe === equipe && r.mesIndex === mi);
        if (!group.length) return null;
        return Math.round(group.reduce((s, r) => s + (r.tempoSeconds || 0), 0) / group.length);
      });

      const config = {
        label: equipe,
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

    // Meta line
    datasets.push({
      label: 'Meta (02:00)',
      data: usedMonthIndices.map(() => META_SECONDS),
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
          title: { display: true, text: 'Evolução Mensal — 1°CCI', font: { size: 16 } },
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

  function renderTimelineAllCCI(records) {
    destroyChart('trTimelineAllCCI');
    const ctx = getCtx('trTimelineAllCCI');
    if (!ctx) return;

    const ok = records.filter(r => r.status === 'ok');
    const ccis = ['1°CCI', '2°CCI', '3°CCI', '4°CCI'];
    const cciColors = { '1°CCI': '#00d2ff', '2°CCI': '#00ff87', '3°CCI': '#ffd32a', '4°CCI': '#b026ff' };

    const usedMonthIndices = [...new Set(ok.map(r => r.mesIndex))].sort((a, b) => a - b);
    const labels = usedMonthIndices.map(i => MONTHS[i] || `Mês ${i + 1}`);

    const datasets = ccis.filter(cci => ok.some(r => r.cci === cci)).map(cci => {
      const color = cciColors[cci];
      const data = usedMonthIndices.map(mi => {
        const group = ok.filter(r => r.cci === cci && r.mesIndex === mi);
        if (!group.length) return null;
        return Math.round(group.reduce((s, r) => s + (r.tempoSeconds || 0), 0) / group.length);
      });

      return {
        label: cci,
        data,
        borderColor: color,
        backgroundColor: color + '33',
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.3,
        spanGaps: true,
        fill: false
      };
    });

    // Meta line
    datasets.push({
      label: 'Meta (02:00)',
      data: usedMonthIndices.map(() => META_SECONDS),
      borderColor: COLORS.red,
      borderDash: [8, 4],
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0
    });

    chartInstances.trTimelineAllCCI = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Evolução Mensal — Todos os CCIs', font: { size: 16 } },
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${formatTime(ctx.parsed.y || ctx.raw)}`
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Mês' } },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Tempo (segundos)' },
            ticks: { callback: v => formatTime(v) }
          }
        }
      }
    });
  }

  function renderCciBar(records) {
    destroyChart('trCci');
    const ctx = getCtx('trCci');
    if (!ctx) return;

    const ok = records.filter(r => r.status === 'ok');
    const ccis = [...new Set(ok.map(r => r.cci))].sort();

    const isHorizontal = activeCciType === 'horizontalBar';
    const isLine = activeCciType === 'line';

    const datasets = EQUIPES.filter(e => ok.some(r => r.equipe === e)).map(equipe => {
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

    const ok = records.filter(r => r.status === 'ok' && r.cci === '1°CCI');
    const usedMonthIndices = [...new Set(ok.map(r => r.mesIndex))].sort((a, b) => a - b);
    const labels = usedMonthIndices.map(i => MONTHS[i] || `Mês ${i + 1}`);
    const equipes = EQUIPES.filter(e => ok.some(r => r.equipe === e));

    const excelData = equipes.map(equipe =>
      usedMonthIndices.map(mi => {
        const group = ok.filter(r => r.equipe === equipe && r.mesIndex === mi);
        return group.filter(r => r.tempoSeconds <= 120).length;
      })
    );

    const satisData = equipes.map(equipe =>
      usedMonthIndices.map(mi => {
        const group = ok.filter(r => r.equipe === equipe && r.mesIndex === mi);
        return group.filter(r => r.tempoSeconds > 120 && r.tempoSeconds <= 180).length;
      })
    );

    const ruimData = equipes.map(equipe =>
      usedMonthIndices.map(mi => {
        const group = ok.filter(r => r.equipe === equipe && r.mesIndex === mi);
        return group.filter(r => r.tempoSeconds > 180).length;
      })
    );

    const isStacked = activeHeatmapType === 'bar';
    const isLine = activeHeatmapType === 'line';

    const datasets = [];
    equipes.forEach((equipe, i) => {
      const excelConfig = {
        label: `${equipe} — Excelente`,
        data: excelData[i],
        backgroundColor: '#00ff87cc',
        borderColor: '#00ff87'
      };

      const satisConfig = {
        label: `${equipe} — Satisfatório`,
        data: satisData[i],
        backgroundColor: '#ffd32acc',
        borderColor: '#ffd32a'
      };

      const ruimConfig = {
        label: `${equipe} — Ruim`,
        data: ruimData[i],
        backgroundColor: '#ff0055cc',
        borderColor: '#ff0055'
      };

      if (isLine) {
        excelConfig.borderWidth = 3;
        excelConfig.pointRadius = 4;
        excelConfig.fill = false;
        excelConfig.tension = 0.2;

        satisConfig.borderWidth = 3;
        satisConfig.pointRadius = 4;
        satisConfig.fill = false;
        satisConfig.tension = 0.2;

        ruimConfig.borderWidth = 3;
        ruimConfig.pointRadius = 4;
        ruimConfig.fill = false;
        ruimConfig.tension = 0.2;
      } else {
        excelConfig.borderWidth = 1;
        excelConfig.stack = equipe;
        excelConfig.borderRadius = 2;

        satisConfig.borderWidth = 1;
        satisConfig.stack = equipe;
        satisConfig.borderRadius = 2;

        ruimConfig.borderWidth = 1;
        ruimConfig.stack = equipe;
        ruimConfig.borderRadius = 2;
      }

      if (!isStacked && !isLine) {
        delete excelConfig.stack;
        delete satisConfig.stack;
        delete ruimConfig.stack;
      }

      datasets.push(excelConfig);
      datasets.push(satisConfig);
      datasets.push(ruimConfig);
    });

    const config = {
      type: isLine ? 'line' : 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Mês' } },
          y: { beginAtZero: true, title: { display: true, text: 'Registros' } }
        },
        plugins: {
          title: { display: true, text: 'Conformidade por Mês e Equipe', font: { size: 16 } },
          legend: { position: 'top' }
        }
      }
    };

    if (isStacked && !isLine) {
      config.options.scales.x.stacked = true;
      config.options.scales.y.stacked = true;
    }

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
      const isWithin = r.status === 'ok' && r.cci === '1°CCI' && r.tempoSeconds <= META_SECONDS;
      const isAbove = r.status === 'ok' && r.cci === '1°CCI' && r.tempoSeconds > META_SECONDS;

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

    // Set up switchers
    setupTypeSelectors();

    const filtered = filterByCabeceira(records, cabeceira);

    const emptyEl = document.getElementById('tr-empty');
    if (emptyEl) emptyEl.style.display = filtered.length ? 'none' : 'flex';

    if (!filtered.length) return;

    renderKPIs(filtered);
    renderTimeline(filtered);
    renderTimelineAllCCI(filtered);
    renderCciBar(filtered);
    renderHeatmap(filtered);
    renderTable(filtered);
  }

  function destroy() {
    destroyChart('trTimeline');
    destroyChart('trTimelineAllCCI');
    destroyChart('trCci');
    destroyChart('trHeatmap');
  }

  window.SESCINC.Charts.TR = { render, destroy };
})();
