/**
 * SESCINC SBGL — Módulo de Gráficos e Mapa de Calor da Atuação SESCINC
 * Gerencia a renderização do Mapa 3D do Aeroporto (SBGL), zonas térmicas de calor,
 * marcadores interativos, filtros interno/externo e gráficos analíticos.
 */

window.SESCINC = window.SESCINC || {};

window.SESCINC.ActuationCharts = (function () {
  'use strict';

  let chartTypesInstance = null;
  let chartMonthlyInstance = null;
  let chartTeamsInstance = null;
  let chartVehiclesInstance = null;

  let currentMonthFilter = 'todos';
  let currentScopeFilter = 'all'; // 'all', 'internal', 'external'

  // Coordenadas geográficas otimizadas para visibilidade total em telas de 14 polegadas (com recuo de bordas)
  const HOTSPOTS = [
    { id: 'h-cab-28', name: 'Cabeceira 28 (CAB 28)', top: 10.0, left: 86.0, align: 'pin-align-left-down', keywords: ['CABECEIRA 28', 'CAB 28', '28'] },
    { id: 'h-cab-10', name: 'Cabeceira 10 (CAB 10)', top: 25.0, left: 22.0, align: 'pin-align-right', keywords: ['CABECEIRA 10', 'CAB 10', '10'] },
    { id: 'h-cab-15', name: 'Cabeceira 15 (CAB 15)', top: 44.0, left: 12.0, align: 'pin-align-right', keywords: ['CABECEIRA 15', 'CAB 15', '15'] },
    { id: 'h-cab-33', name: 'Cabeceira 33 (CAB 33)', top: 85.0, left: 60.0, align: 'pin-align-top', keywords: ['CABECEIRA 33', 'CAB 33', '33'] },
    { id: 'h-patio-lider', name: 'Pátio Líder', top: 27.0, left: 69.0, align: 'pin-align-center', keywords: ['LÍDER', 'LIDER', 'HANGAR LÍDER'] },
    { id: 'h-patio-united', name: 'Pátio United / Hangar TAP', top: 26.0, left: 80.0, align: 'pin-align-left', keywords: ['UNITED', 'TAP', 'HANGAR UNITED', 'HANGAR'] },
    { id: 'h-patio-1', name: 'Pátio 1 (TPS 1)', top: 50.0, left: 28.0, align: 'pin-align-center', keywords: ['PÁTIO 1', 'PATIO 1', 'TPS 1', 'TPS1', 'TERMINAL 1'] },
    { id: 'h-patio-2', name: 'Pátio 2 (TPS 2 / Principal)', top: 57.0, left: 37.0, align: 'pin-align-center', keywords: ['PÁTIO 2', 'PATIO 2', 'TPS 2', 'TPS2', 'TERMINAL 2', 'POSIÇÃO', 'PÁTIO DE AERONAVES', 'PÁTIO'] },
    { id: 'h-patio-3', name: 'Pátio 3 (Píer Sul)', top: 65.0, left: 49.0, align: 'pin-align-center', keywords: ['PÁTIO 3', 'PATIO 3', 'PÍER SUL', 'PIER SUL', 'PÍER', 'FINGERS'] },
    { id: 'h-patio-militar', name: 'Pátio Militar (FAB / Base Aérea)', top: 78.0, left: 53.0, align: 'pin-align-center', keywords: ['MILITAR', 'FAB', 'C-105', 'BASE AÉREA', 'BASE AEREA'] },
    { id: 'h-teca-imp', name: 'TECA Importação', top: 82.0, left: 39.0, align: 'pin-align-right', keywords: ['IMPORTAÇÃO', 'IMPORTACAO', 'TECA IMPORTAÇÃO', 'TECA', 'SUBESTAÇÃO', 'SUBESTACAO', 'V-58', 'CARGAS'] },
    { id: 'h-teca-exp', name: 'TECA Exportação', top: 86.0, left: 45.0, align: 'pin-align-center', keywords: ['EXPORTAÇÃO', 'EXPORTACAO', 'TECA EXPORTAÇÃO'] },
    { id: 'h-patio-5', name: 'Pátio 5', top: 90.0, left: 52.0, align: 'pin-align-top', keywords: ['PÁTIO 5', 'PATIO 5'] }
  ];

  /**
   * Aplica o filtro de mês
   */
  function filterDataCombined(data) {
    if (!data) return [];
    let result = data;
    if (currentMonthFilter && currentMonthFilter !== 'todos') {
      result = result.filter(d => d.mes === currentMonthFilter);
    }
    return result;
  }

  /**
   * Define o filtro de mês
   */
  function setMonthFilter(month, data, btnEl) {
    currentMonthFilter = month;
    if (btnEl && btnEl.parentElement) {
      btnEl.parentElement.querySelectorAll('.month-tab').forEach(b => b.classList.remove('active'));
      btnEl.classList.add('active');
    }
    if (data) render(data);
  }

  /**
   * Renderiza todo o módulo de Atuação SESCINC
   */
  function render(data) {
    if (!data || !Array.isArray(data)) return;

    // Filtrar dados por mês
    const filteredData = filterDataCombined(data);

    // 1. Atualizar KPIs
    updateKPIs(filteredData);

    // 2. Renderizar Mapa de Calor 3D
    renderHeatmapAndPins(filteredData);

    // 3. Renderizar Gráficos Analíticos
    renderCharts(filteredData);

    // 4. Renderizar Tabela de Acionamentos
    renderTable(filteredData);
  }

  /**
   * Atualiza os cards de KPI superiores
   */
  function updateKPIs(data) {
    const totalEl = document.getElementById('actkpi-total');
    const topLocEl = document.getElementById('actkpi-top-location');
    const topLocCountEl = document.getElementById('actkpi-top-location-count');
    const topTypeEl = document.getElementById('actkpi-top-type');
    const topTypeCountEl = document.getElementById('actkpi-top-type-count');
    const topTeamEl = document.getElementById('actkpi-top-team');
    const topTeamCountEl = document.getElementById('actkpi-top-team-count');

    const total = data.length;

    // Tipo, Equipe e Local mais comuns
    const typeCounts = {};
    const teamCounts = {};
    const hotspotCounts = {};

    HOTSPOTS.forEach(h => { hotspotCounts[h.id] = 0; });

    data.forEach(d => {
      typeCounts[d.tipo] = (typeCounts[d.tipo] || 0) + 1;
      if (d.equipe && d.equipe !== 'N/I') {
        teamCounts[d.equipe] = (teamCounts[d.equipe] || 0) + 1;
      }
      const fullText = (d.descricao + ' ' + d.acoes + ' ' + d.localizacao).toUpperCase();
      let matched = false;
      for (let i = 0; i < HOTSPOTS.length; i++) {
        const h = HOTSPOTS[i];
        if (h.keywords.some(kw => fullText.includes(kw.toUpperCase()))) {
          hotspotCounts[h.id]++;
          matched = true;
          break;
        }
      }
      if (!matched) hotspotCounts['h-patio-2']++;
    });

    let topType = 'Nenhum';
    let maxTypeCount = 0;
    Object.keys(typeCounts).forEach(t => {
      if (typeCounts[t] > maxTypeCount) {
        maxTypeCount = typeCounts[t];
        topType = t;
      }
    });

    let topTeam = 'Nenhum';
    let maxTeamCount = 0;
    Object.keys(teamCounts).forEach(tm => {
      if (teamCounts[tm] > maxTeamCount) {
        maxTeamCount = teamCounts[tm];
        topTeam = tm;
      }
    });

    let topLoc = 'Nenhum';
    let maxLocCount = 0;
    HOTSPOTS.forEach(h => {
      if (hotspotCounts[h.id] > maxLocCount) {
        maxLocCount = hotspotCounts[h.id];
        topLoc = h.name.split('(')[0].trim();
      }
    });

    if (totalEl) totalEl.textContent = total;

    if (topLocEl) topLocEl.textContent = topLoc;
    if (topLocCountEl) topLocCountEl.textContent = maxLocCount + ' acionamento' + (maxLocCount !== 1 ? 's' : '');

    if (topTypeEl) topTypeEl.textContent = topType;
    if (topTypeCountEl) topTypeCountEl.textContent = maxTypeCount + ' acionamento' + (maxTypeCount !== 1 ? 's' : '');

    if (topTeamEl) topTeamEl.textContent = topTeam.startsWith('Equipe') ? topTeam : 'Equipe ' + topTeam;
    if (topTeamCountEl) topTeamCountEl.textContent = maxTeamCount + ' acionamento' + (maxTeamCount !== 1 ? 's' : '');
  }

  /**
   * Renderiza os marcadores de hotspot e o canvas térmico sobre a maquete 3D
   */
  function renderHeatmapAndPins(data) {
    const container = document.getElementById('airport-3d-container');
    const canvas = document.getElementById('airport-heatmap-canvas');
    if (!container || !canvas) return;

    // Ajustar tamanho do canvas ao tamanho real do container
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    // Contar acionamentos por hotspot
    const hotspotCounts = {};
    HOTSPOTS.forEach(h => {
      hotspotCounts[h.id] = 0;
    });

    data.forEach(d => {
      const fullText = (d.descricao + ' ' + d.acoes + ' ' + d.localizacao).toUpperCase();
      let matched = false;

      for (let i = 0; i < HOTSPOTS.length; i++) {
        const h = HOTSPOTS[i];
        if (h.keywords.some(kw => fullText.includes(kw.toUpperCase()))) {
          hotspotCounts[h.id]++;
          matched = true;
          break;
        }
      }

      // Realloca ocorrências sem match específico no Pátio Principal
      if (!matched) {
        hotspotCounts['h-patio-2']++;
      }
    });

    // Desenhar manchas de calor no canvas
    HOTSPOTS.forEach(h => {
      const count = hotspotCounts[h.id];
      if (count > 0) {
        const x = (h.left / 100) * width;
        const y = (h.top / 100) * height;
        const radius = Math.min(85, 28 + count * 5);

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(2, 132, 199, 0.70)');
        gradient.addColorStop(0.5, 'rgba(2, 132, 199, 0.25)');
        gradient.addColorStop(1, 'rgba(2, 132, 199, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Atualizar marcadores HTML
    const pinContainer = document.getElementById('airport-pins-container');
    if (!pinContainer) return;
    pinContainer.innerHTML = '';

    HOTSPOTS.forEach(h => {
      const count = hotspotCounts[h.id];

      const pin = document.createElement('div');
      pin.className = 'airport-pin ' + (h.align || 'pin-align-center') + (count > 0 ? ' active' : ' empty');
      pin.style.top = h.top + '%';
      pin.style.left = h.left + '%';
      pin.setAttribute('title', h.name + ': ' + count + ' acionamentos');

      pin.innerHTML = `
        <div class="pin-badge">${count}</div>
        <div class="pin-label">${h.name}</div>
      `;

      pin.addEventListener('click', function () {
        showHotspotDetails(h, data);
      });

      pinContainer.appendChild(pin);
    });
  }

  // Recalcular posições do mapa em resize de tela
  window.addEventListener('resize', function () {
    const section = document.getElementById('section-actuation');
    if (section && section.classList.contains('active')) {
      const data = window.SESCINC && window.SESCINC.AppData ? window.SESCINC.AppData.actuation : null;
      if (data) {
        renderHeatmapAndPins(data);
      }
    }
  });

  /**
   * Exibe modal com detalhes das ocorrências no hotspot clicado
   */
  function showHotspotDetails(hotspot, data) {
    const matchedRecords = data.filter(d => {
      const fullText = (d.descricao + ' ' + d.acoes + ' ' + d.localizacao).toUpperCase();
      return hotspot.keywords.some(kw => fullText.includes(kw.toUpperCase()));
    });

    const overlay = document.getElementById('actuation-modal-overlay');
    const titleEl = document.getElementById('actuation-modal-title');
    const bodyEl = document.getElementById('actuation-modal-body');
    if (!overlay || !titleEl || !bodyEl) return;

    titleEl.textContent = hotspot.name + ' (' + matchedRecords.length + ' ocorrências)';

    if (matchedRecords.length === 0) {
      bodyEl.innerHTML = '<p class="text-muted p-4 text-center">Nenhum acionamento registrado neste setor para o filtro selecionado.</p>';
    } else {
      let html = '<div class="actuation-modal-list">';
      matchedRecords.forEach(r => {
        const viaturasHtml = r.viaturas && r.viaturas.length > 0
          ? r.viaturas.map(v => `<span class="badge badge-secondary">${v}</span>`).join(' ')
          : '<span class="text-muted">Nenhuma informada</span>';

        html += `
          <div class="actuation-modal-item">
            <div class="actuation-item-header">
              <span class="actuation-item-date">${r.data} (${r.mes})</span>
              <span class="actuation-item-tipo">${r.tipo}</span>
              <span class="badge badge-primary">Equipe ${r.equipe}</span>
            </div>
            <div class="actuation-item-location"><strong>Local:</strong> ${r.localizacao} ${r.quadrante ? '(Quadrante ' + r.quadrante + ')' : ''}</div>
            <div class="actuation-item-desc"><strong>Descrição:</strong> ${r.descricao}</div>
            <div class="actuation-item-acoes"><strong>Ações SESCINC:</strong> ${r.acoes}</div>
            <div class="actuation-item-viaturas"><strong>Viaturas:</strong> ${viaturasHtml}</div>
          </div>
        `;
      });
      html += '</div>';
      bodyEl.innerHTML = html;
    }

    overlay.style.display = 'flex';
  }

  let activeTypesType = 'doughnut';
  let activeMonthlyType = 'bar';
  let activeTeamsType = 'bar';
  let activeVehiclesType = 'horizontalBar';
  let currentActuationData = null;
  let actuationListenersAttached = false;

  function setupTypeSelectors() {
    if (actuationListenersAttached) return;
    actuationListenersAttached = true;

    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.btn-chart-type');
      if (!btn) return;

      const selector = btn.closest('.chart-type-selector');
      if (!selector) return;

      const chartKey = selector.getAttribute('data-chart');
      const type = btn.getAttribute('data-type');
      if (!chartKey || !chartKey.startsWith('actuation')) return;

      selector.querySelectorAll('.btn-chart-type').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (chartKey === 'actuationTypes') {
        activeTypesType = type;
      } else if (chartKey === 'actuationMonthly') {
        activeMonthlyType = type;
      } else if (chartKey === 'actuationTeams') {
        activeTeamsType = type;
      } else if (chartKey === 'actuationVehicles') {
        activeVehiclesType = type;
      }

      const rawData = window.SESCINC && window.SESCINC.AppData ? window.SESCINC.AppData.actuation : null;
      if (rawData) {
        const filtered = filterDataCombined(rawData);
        renderCharts(filtered);
      }
    });
  }

  /**
   * Renderiza os 4 gráficos analíticos de Atuação com suporte a 3 tipos de visualização por gráfico
   */
  function renderCharts(data) {
    setupTypeSelectors();
    currentActuationData = data;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#f8fafc' : '#000000';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)';

    // Colors matching overall app palette
    const teamColors = {
      'ALFA': isDark ? '#38bdf8' : '#0284c7',
      'BRAVO': isDark ? '#6ee7b7' : '#34d399', // Pastel green
      'CHARLIE': isDark ? '#fbbf24' : '#d97706',
      'DELTA': isDark ? '#ef4444' : '#c62828'
    };

    // Chart 1: Ocorrências por Tipo
    const ctxTypes = document.getElementById('chart-actuation-types');
    if (ctxTypes) {
      if (chartTypesInstance) chartTypesInstance.destroy();
      const typeCounts = {};
      data.forEach(d => { typeCounts[d.tipo] = (typeCounts[d.tipo] || 0) + 1; });
      
      const labels = Object.keys(typeCounts);
      const values = Object.values(typeCounts);

      const typeColors = [
        '#ef4444', '#0284c7', '#34d399', '#d97706', '#7c3aed',
        '#e11d48', '#0891b2', '#10b981', '#f59e0b', '#8b5cf6'
      ];

      const chartType = activeTypesType === 'doughnut' ? 'doughnut' : (activeTypesType === 'pie' ? 'pie' : 'bar');

      const config = {
        type: chartType,
        data: {
          labels: labels,
          datasets: [{
            label: 'Acionamentos',
            data: values,
            backgroundColor: typeColors.slice(0, labels.length),
            borderWidth: 2,
            borderColor: isDark ? '#1e293b' : '#ffffff',
            borderRadius: chartType === 'bar' ? 6 : 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'Tipos de Ocorrência', font: { size: 15, weight: 'bold' }, color: textColor },
            legend: {
              display: chartType !== 'bar',
              position: 'bottom',
              labels: { color: textColor, font: { family: 'Inter', size: 11 }, padding: 12 }
            },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  return ' ' + ctx.label + ': ' + (ctx.raw || ctx.parsed.y) + ' acionamentos';
                }
              }
            }
          }
        }
      };

      if (chartType === 'bar') {
        config.options.scales = {
          x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
          y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true }
        };
      }

      chartTypesInstance = new Chart(ctxTypes, config);
    }

    // Chart 2: Distribuição Mensal (Jan-Jul)
    const ctxMonthly = document.getElementById('chart-actuation-monthly');
    if (ctxMonthly) {
      if (chartMonthlyInstance) chartMonthlyInstance.destroy();
      const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho'];
      const monthlyCounts = meses.map(() => 0);

      data.forEach(d => {
        const idx = meses.indexOf(d.mes);
        if (idx !== -1) {
          monthlyCounts[idx]++;
        }
      });

      const isHorizontal = activeMonthlyType === 'horizontalBar';
      const isLine = activeMonthlyType === 'line';
      const chartType = isLine ? 'line' : 'bar';

      const datasets = [
        {
          label: 'Total de Acionamentos',
          data: monthlyCounts,
          backgroundColor: isDark ? '#38bdf8' : '#0284c7',
          borderColor: isDark ? '#38bdf8' : '#0284c7',
          borderWidth: isLine ? 3 : 1,
          borderRadius: isLine ? 0 : 6,
          fill: isLine,
          tension: 0.3
        }
      ];

      const config = {
        type: chartType,
        data: { labels: meses, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'Distribuição Mensal de Acionamentos', font: { size: 15, weight: 'bold' }, color: textColor },
            legend: { position: 'top', labels: { color: textColor, font: { family: 'Inter', size: 11 } } }
          }
        }
      };

      if (isHorizontal) {
        config.options.indexAxis = 'y';
        config.options.scales = {
          x: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true },
          y: { ticks: { color: textColor }, grid: { color: gridColor } }
        };
      } else {
        config.options.scales = {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true }
        };
      }

      chartMonthlyInstance = new Chart(ctxMonthly, config);
    }

    // Chart 3: Atuação por Equipe
    const ctxTeams = document.getElementById('chart-actuation-teams');
    if (ctxTeams) {
      if (chartTeamsInstance) chartTeamsInstance.destroy();
      const teams = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA'];
      const counts = [0, 0, 0, 0];
      data.forEach(d => {
        const idx = teams.indexOf(d.equipe);
        if (idx !== -1) counts[idx]++;
      });

      const isHorizontal = activeTeamsType === 'horizontalBar';
      const isLine = activeTeamsType === 'line';
      const chartType = isLine ? 'line' : 'bar';

      const config = {
        type: chartType,
        data: {
          labels: teams.map(t => 'Equipe ' + t),
          datasets: [{
            label: 'Ocorrências Atendidas',
            data: counts,
            backgroundColor: teams.map(t => teamColors[t] || '#0284c7'),
            borderColor: isLine ? (isDark ? '#38bdf8' : '#0284c7') : teams.map(t => teamColors[t] || '#0284c7'),
            borderWidth: isLine ? 3 : 1,
            borderRadius: isLine ? 0 : 8,
            fill: false,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'Acionamentos por Equipe', font: { size: 15, weight: 'bold' }, color: textColor },
            legend: { display: isLine, labels: { color: textColor } }
          }
        }
      };

      if (isHorizontal) {
        config.options.indexAxis = 'y';
        config.options.scales = {
          x: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true },
          y: { ticks: { color: textColor }, grid: { color: gridColor } }
        };
      } else {
        config.options.scales = {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true }
        };
      }

      chartTeamsInstance = new Chart(ctxTeams, config);
    }

    // Chart 4: Viaturas / Equipamentos Utilizados
    const ctxVehicles = document.getElementById('chart-actuation-vehicles');
    if (ctxVehicles) {
      if (chartVehiclesInstance) chartVehiclesInstance.destroy();
      const vehicleCounts = {};
      data.forEach(d => {
        if (d.viaturas && Array.isArray(d.viaturas)) {
          d.viaturas.forEach(v => {
            vehicleCounts[v] = (vehicleCounts[v] || 0) + 1;
          });
        }
      });

      const labels = Object.keys(vehicleCounts).sort((a, b) => vehicleCounts[b] - vehicleCounts[a]);
      const values = labels.map(l => vehicleCounts[l]);

      const isVertical = activeVehiclesType === 'bar';
      const isLine = activeVehiclesType === 'line';
      const chartType = isLine ? 'line' : 'bar';

      const config = {
        type: chartType,
        data: {
          labels: labels,
          datasets: [{
            label: 'Acionamentos por Viatura',
            data: values,
            backgroundColor: isDark ? '#22d3ee' : '#0891b2',
            borderColor: isDark ? '#22d3ee' : '#0891b2',
            borderWidth: isLine ? 3 : 1,
            borderRadius: isLine ? 0 : 6,
            fill: false,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'Viaturas e Recursos Empregados', font: { size: 15, weight: 'bold' }, color: textColor },
            legend: { display: isLine, labels: { color: textColor } }
          }
        }
      };

      if (!isVertical && !isLine) {
        config.options.indexAxis = 'y';
        config.options.scales = {
          x: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true },
          y: { ticks: { color: textColor, font: { size: 11 } }, grid: { color: gridColor } }
        };
      } else {
        config.options.scales = {
          x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
          y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true }
        };
      }

      chartVehiclesInstance = new Chart(ctxVehicles, config);
    }
  }

  /**
   * Renderiza a tabela de acionamentos
   */
  function renderTable(data) {
    const tbody = document.getElementById('actuation-table-body');
    const searchInput = document.getElementById('actuation-search-input');
    if (!tbody) return;

    function buildTable(list) {
      if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Nenhum acionamento encontrado.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(r => {
        const viaturasText = r.viaturas && r.viaturas.length > 0 ? r.viaturas.join(', ') : '—';

        return `
          <tr>
            <td><strong>${r.data}</strong><br><small class="text-muted">${r.mes}</small></td>
            <td><strong>${r.tipo}</strong></td>
            <td>${r.localizacao} ${r.quadrante ? '<br><small class="text-muted">Quad. ' + r.quadrante + '</small>' : ''}</td>
            <td><span class="badge badge-secondary">Equipe ${r.equipe}</span></td>
            <td><small>${viaturasText}</small></td>
            <td>
              <button class="btn btn-sm btn-secondary view-report-btn" data-id="${r.id}">Ver Relatório</button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.view-report-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          const id = this.getAttribute('data-id');
          const item = list.find(x => x.id === id);
          if (item) {
            showSingleReportModal(item);
          }
        });
      });
    }

    buildTable(data);

    if (searchInput) {
      searchInput.oninput = function () {
        const q = this.value.toLowerCase().trim();
        if (!q) {
          buildTable(data);
          return;
        }
        const filtered = data.filter(d =>
          d.data.includes(q) ||
          d.tipo.toLowerCase().includes(q) ||
          d.localizacao.toLowerCase().includes(q) ||
          d.equipe.toLowerCase().includes(q) ||
          d.descricao.toLowerCase().includes(q) ||
          d.acoes.toLowerCase().includes(q)
        );
        buildTable(filtered);
      };
    }
  }

  /**
   * Modal individual de visualização do relatório de um acionamento
   */
  function showSingleReportModal(item) {
    const overlay = document.getElementById('actuation-modal-overlay');
    const titleEl = document.getElementById('actuation-modal-title');
    const bodyEl = document.getElementById('actuation-modal-body');
    if (!overlay || !titleEl || !bodyEl) return;

    titleEl.textContent = 'Relatório de Acionamento SESCINC #' + item.id;

    const viaturasHtml = item.viaturas && item.viaturas.length > 0
      ? item.viaturas.map(v => `<span class="badge badge-secondary">${v}</span>`).join(' ')
      : '<span class="text-muted">Nenhuma viatura especificada</span>';

    bodyEl.innerHTML = `
      <div class="single-report-container p-2">
        <div class="report-header-banner flex justify-between items-center mb-4">
          <div>
            <h4 class="text-lg font-bold" style="color: var(--accent-red);">${item.tipo}</h4>
            <div class="text-sm text-muted">Data: ${item.data} | Mês: ${item.mes}</div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="card p-3">
            <span class="text-xs text-muted font-bold">EQUIPE RESPONSÁVEL</span>
            <div class="text-md font-bold mt-1">Equipe ${item.equipe}</div>
          </div>
          <div class="card p-3">
            <span class="text-xs text-muted font-bold">LOCALIZAÇÃO / QUADRANTE</span>
            <div class="text-md font-bold mt-1">${item.localizacao} ${item.quadrante ? '(Quad. ' + item.quadrante + ')' : ''}</div>
          </div>
        </div>

        <div class="card p-3 mb-3">
          <span class="text-xs text-muted font-bold">DESCRIÇÃO DA OCORRÊNCIA</span>
          <p class="mt-1 text-sm">${item.descricao}</p>
        </div>

        <div class="card p-3 mb-3">
          <span class="text-xs text-muted font-bold">AÇÕES E PROCEDIMENTOS SESCINC</span>
          <p class="mt-1 text-sm white-space-pre-line" style="white-space: pre-line;">${item.acoes}</p>
        </div>

        <div class="card p-3">
          <span class="text-xs text-muted font-bold mb-1 block">VIATURAS E RECURSOS EMPREGADOS</span>
          <div>${viaturasHtml}</div>
        </div>
      </div>
    `;

    overlay.style.display = 'flex';
  }

  function setScopeFilter(scope, data, btnEl) {
    // No-op for backward compatibility
  }

  return {
    render: render,
    setScopeFilter: setScopeFilter,
    setMonthFilter: setMonthFilter
  };
})();
