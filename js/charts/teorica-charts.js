/**
 * SESCINC SBGL Dashboard — Teórica Charts
 * Avaliação Teórica charts, KPIs, and table
 */
(function () {
  'use strict';

  window.SESCINC = window.SESCINC || {};
  window.SESCINC.Charts = window.SESCINC.Charts || {};

  function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
      isDark,
      textColor: isDark ? '#f8fafc' : '#000000',
      gridColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
      green: isDark ? '#6ee7b7' : '#34d399', // Pastel green
      amber: isDark ? '#fbbf24' : '#d97706',
      red: isDark ? '#ef4444' : '#c62828',
      blue: isDark ? '#38bdf8' : '#0284c7',
      equipes: {
        'ALFA': isDark ? '#38bdf8' : '#0284c7',
        'BRAVO': isDark ? '#6ee7b7' : '#34d399',
        'CHARLIE': isDark ? '#fbbf24' : '#d97706',
        'DELTA': isDark ? '#ef4444' : '#c62828',
        'FOLGUISTA': isDark ? '#c084fc' : '#7c3aed'
      }
    };
  }

  const EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'FOLGUISTA'];
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
    const notas = records.map(r => r.nota).filter(n => n != null && !isNaN(n));
    const total = notas.length;
    const avg = total ? (notas.reduce((s, n) => s + n, 0) / total) : 0;
    const min = total ? Math.min(...notas) : 0;
    const max = total ? Math.max(...notas) : 0;

    setText('kpi-teo-total', total);
    setText('kpi-teo-avg', avg.toFixed(1));
    setText('kpi-teo-min', min.toFixed(1));
    setText('kpi-teo-max', max.toFixed(1));
  }

  let activeHistogramType = 'bar';
  let activeFuncaoType = 'horizontalBar';
  let activeEquipeType = 'bar';
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

      if (chartKey === 'teoricaHistogram') {
        activeHistogramType = type;
        renderHistogram(currentRecords);
      } else if (chartKey === 'teoricaFuncao') {
        activeFuncaoType = type;
        renderFuncaoBar(currentRecords);
      } else if (chartKey === 'teoricaEquipe') {
        activeEquipeType = type;
        renderEquipeBar(currentRecords);
      }
    });
  }

  /* ── Charts ── */

  function renderHistogram(records) {
    destroyChart('teoricaHistogram');
    const ctx = getCtx('teoricaHistogram');
    if (!ctx) return;

    const tc = getThemeColors();
    const buckets = ['75-80', '80-85', '85-90', '90-95', '95-100'];
    const ranges = [[75, 80], [80, 85], [85, 90], [90, 95], [95, 100.01]];

    const counts = ranges.map(([min, max]) =>
      records.filter(r => r.nota >= min && r.nota < max).length
    );

    const gradientColors = [tc.red, tc.amber, tc.amber, tc.green, tc.green];
    const isRadar = activeHistogramType === 'radar';
    const isLine = activeHistogramType === 'line';

    const config = {
      type: isRadar ? 'radar' : (isLine ? 'line' : 'bar'),
      data: {
        labels: buckets,
        datasets: [{
          label: 'Quantidade',
          data: counts,
          backgroundColor: isRadar ? 'rgba(6, 182, 212, 0.2)' : gradientColors.map(c => c + 'cc'),
          borderColor: isRadar || isLine ? tc.blue : gradientColors,
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
          const bucketLabels = ['75-80', '80-85', '85-90', '90-95', '95-100'];
          const rangesList = [[75, 80], [80, 85], [85, 90], [90, 95], [95, 100.01]];
          const [min, max] = rangesList[idx];
          const names = currentRecords.filter(r => r.nota >= min && r.nota < max).map(r => r.nome).filter(Boolean);
          if (names.length && window.SESCINC.showDetailModal) {
            window.SESCINC.showDetailModal('Nota: ' + bucketLabels[idx], names);
          }
        },
        plugins: {
          title: { display: true, text: 'Distribuição de Notas', font: { size: 16, weight: 'bold' }, color: tc.textColor },
          legend: { display: isRadar, labels: { color: tc.textColor } }
        }
      }
    };

    if (isRadar) {
      config.options.scales = {
        r: {
          beginAtZero: true,
          ticks: { stepSize: 5, color: tc.textColor, backdropColor: 'transparent' },
          grid: { color: tc.gridColor },
          angleLines: { color: tc.gridColor },
          pointLabels: { color: tc.textColor }
        }
      };
    } else {
      config.options.scales = {
        x: { title: { display: true, text: 'Faixa de Nota', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } },
        y: { beginAtZero: true, title: { display: true, text: 'Quantidade', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } }
      };
    }

    chartInstances.teoricaHistogram = new Chart(ctx, config);
  }

  function renderFuncaoBar(records) {
    destroyChart('teoricaFuncao');
    const ctx = getCtx('teoricaFuncao');
    if (!ctx) return;

    const tc = getThemeColors();
    const funcoes = [...new Set(records.map(r => r.funcao))].filter(Boolean).sort();

    const data = funcoes.map(f => {
      const group = records.filter(r => r.funcao === f);
      return group.length ? Math.round((group.reduce((s, r) => s + (r.nota || 0), 0) / group.length) * 10) / 10 : 0;
    });

    const isHorizontal = activeFuncaoType === 'horizontalBar';
    const isLine = activeFuncaoType === 'line';

    const config = {
      type: isLine ? 'line' : 'bar',
      data: {
        labels: funcoes,
        datasets: [{
          label: 'Nota Média',
          data,
          backgroundColor: data.map(v => v >= 90 ? tc.green : (v >= 80 ? tc.amber : tc.red)),
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
          title: { display: true, text: 'Nota Média por Função', font: { size: 16, weight: 'bold' }, color: tc.textColor },
          legend: { display: isLine, labels: { color: tc.textColor } }
        }
      }
    };

    if (isHorizontal) {
      config.options.indexAxis = 'y';
      config.options.scales = {
        x: { beginAtZero: false, min: 60, max: 100, title: { display: true, text: 'Nota Média', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } },
        y: { title: { display: true, text: 'Função', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } }
      };
    } else {
      config.options.scales = {
        y: { beginAtZero: false, min: 60, max: 100, title: { display: true, text: 'Nota Média', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } },
        x: { title: { display: true, text: 'Função', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } }
      };
    }

    chartInstances.teoricaFuncao = new Chart(ctx, config);
  }

  function renderEquipeBar(records) {
    destroyChart('teoricaEquipe');
    const ctx = getCtx('teoricaEquipe');
    if (!ctx) return;

    const tc = getThemeColors();
    const equipes = EQUIPES.filter(e => records.some(r => r.equipe === e));

    const data = equipes.map(e => {
      const group = records.filter(r => r.equipe === e);
      return group.length ? Math.round((group.reduce((s, r) => s + (r.nota || 0), 0) / group.length) * 10) / 10 : 0;
    });

    const isHorizontal = activeEquipeType === 'horizontalBar';
    const isLine = activeEquipeType === 'line';

    const minLinePlugin = {
      id: 'minLine',
      afterDraw(chart) {
        const { ctx, chartArea: { left, right, top, bottom } } = chart;
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = tc.red;
        ctx.lineWidth = 2;

        if (isHorizontal) {
          const xScale = chart.scales.x;
          if (!xScale) return;
          const xPixel = xScale.getPixelForValue(70);
          ctx.moveTo(xPixel, top);
          ctx.lineTo(xPixel, bottom);
          ctx.stroke();
          ctx.fillStyle = tc.red;
          ctx.font = '11px Inter';
          ctx.textAlign = 'left';
          ctx.fillText('Mínimo: 70', xPixel + 5, bottom - 10);
        } else {
          const yScale = chart.scales.y;
          if (!yScale) return;
          const yPixel = yScale.getPixelForValue(70);
          ctx.moveTo(left, yPixel);
          ctx.lineTo(right, yPixel);
          ctx.stroke();
          ctx.fillStyle = tc.red;
          ctx.font = '11px Inter';
          ctx.textAlign = 'right';
          ctx.fillText('Mínimo: 70', right - 5, yPixel - 6);
        }
        ctx.restore();
      }
    };

    const config = {
      type: isLine ? 'line' : 'bar',
      data: {
        labels: equipes,
        datasets: [{
          label: 'Nota Média',
          data,
          backgroundColor: equipes.map(e => tc.equipes[e] || tc.blue),
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
        onClick: function(evt, elements) {
          if (!elements.length) return;
          const activeElement = elements[0];
          const dataIndex = activeElement.index;

          const team = equipes[dataIndex];
          const teamRecs = currentRecords.filter(r => r.equipe === team);
          const names = teamRecs.map(r => r.nome + ' (Nota: ' + r.nota.toFixed(1) + ')').filter(Boolean);

          if (names.length && window.SESCINC.showDetailModal) {
            window.SESCINC.showDetailModal('Equipe ' + team + ' — Avaliação Teórica', names);
          }
        },
        plugins: {
          title: { display: true, text: 'Nota Média por Equipe', font: { size: 16, weight: 'bold' }, color: tc.textColor },
          legend: { display: isLine, labels: { color: tc.textColor } }
        }
      },
      plugins: [minLinePlugin]
    };

    if (isHorizontal) {
      config.options.indexAxis = 'y';
      config.options.scales = {
        x: { beginAtZero: false, min: 60, max: 100, title: { display: true, text: 'Nota Média', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } },
        y: { title: { display: true, text: 'Equipe', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } }
      };
    } else {
      config.options.scales = {
        x: { title: { display: true, text: 'Equipe', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } },
        y: { beginAtZero: false, min: 60, max: 100, title: { display: true, text: 'Nota Média', color: tc.textColor }, ticks: { color: tc.textColor }, grid: { color: tc.gridColor } }
      };
    }

    chartInstances.teoricaEquipe = new Chart(ctx, config);
  }

  /* ── Table ── */

  function renderTable(records) {
    const tbody = document.getElementById('tbody-teorica');
    if (!tbody) return;

    tbody.innerHTML = '';
    records.forEach(r => {
      const tr = document.createElement('tr');
      let notaClass = '';
      if (r.nota >= 90) notaClass = 'text-green';
      else if (r.nota >= 80) notaClass = 'text-amber';
      else notaClass = 'text-red';

      tr.innerHTML = `
        <td>${r.nome || '—'}</td>
        <td>${r.mes || '—'}</td>
        <td>${r.funcao || '—'}</td>
        <td>${r.equipe || '—'}</td>
        <td class="${notaClass}" style="font-weight:600">${r.nota != null ? r.nota.toFixed(1) : '—'}</td>
        <td>${r.aeroporto || '—'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ── Main render / destroy ── */

  function render(records) {
    console.log('[Teórica] Rendering Teórica charts, records:', records ? records.length : 0);
    records = records || [];
    currentRecords = records;

    // Set up switchers
    setupTypeSelectors();

    const emptyEl = document.getElementById('teorica-empty');
    const chartsGrid = document.querySelector('#section-teorica .charts-grid');
    const tableWrapper = document.getElementById('table-teorica');

    if (emptyEl) emptyEl.style.display = records.length ? 'none' : 'flex';
    if (chartsGrid) chartsGrid.style.display = records.length ? '' : 'none';
    if (tableWrapper) tableWrapper.style.display = records.length ? '' : 'none';

    if (!records.length) {
      setText('kpi-teo-total', '0');
      setText('kpi-teo-avg', '—');
      setText('kpi-teo-min', '—');
      setText('kpi-teo-max', '—');
      destroy();
      return;
    }

    renderKPIs(records);
    renderHistogram(records);
    renderFuncaoBar(records);
    renderEquipeBar(records);
    renderTable(records);
  }

  function destroy() {
    destroyChart('teoricaHistogram');
    destroyChart('teoricaFuncao');
    destroyChart('teoricaEquipe');
  }

  window.SESCINC.Charts.Teorica = { render, destroy };
})();
