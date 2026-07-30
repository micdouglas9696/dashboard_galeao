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

  // Coordenadas geográficas mapeadas sobre a maquete 3D do Aeroporto de Galeão (rio_galeao_3d.jpg)
  const HOTSPOTS = [
    { id: 'h-pista-1028', name: 'Pista 10/28 (Pista Principal)', top: 30, left: 50, isExternal: false, keywords: ['10/28', '28', 'Pista 10'] },
    { id: 'h-pista-1533', name: 'Pista 15/33 (Pista Secundária)', top: 62, left: 74, isExternal: false, keywords: ['15/33', '15', 'Pista 15'] },
    { id: 'h-tps2', name: 'Terminal 2 (TPS 2)', top: 48, left: 48, isExternal: false, keywords: ['TPS 2', 'TPS2', 'Terminal 2'] },
    { id: 'h-pier-sul', name: 'Píer Sul (Fingers / Internacional)', top: 36, left: 65, isExternal: false, keywords: ['Píer Sul', 'PIER SUL', 'Píer'] },
    { id: 'h-patio-principal', name: 'Pátio Principal (Posições 05 - 80)', top: 45, left: 56, isExternal: false, keywords: ['Posição', 'Pátio', '59', '25', '32', '29', '77', '80'] },
    { id: 'h-hangar-united', name: 'Hangares de Manutenção (TAP M&E / P16-P18)', top: 56, left: 24, isExternal: false, keywords: ['Hangar', 'UNITED', 'P16', 'P17', 'P18', 'TAP'] },
    { id: 'h-patio-militar', name: 'Pátio Militar (Base Aérea / FAB)', top: 42, left: 34, isExternal: false, keywords: ['Militar', 'FAB', 'C-105', 'Base Aérea'] },
    { id: 'h-teca', name: 'Terminal de Cargas (TECA) & Via V-58', top: 32, left: 28, isExternal: false, keywords: ['TECA', 'V-58', 'Via de Serviço', 'Cargas'] },
    { id: 'h-subestacao', name: 'Subestação Lado Terra (Infraestrutura)', top: 72, left: 42, isExternal: true, keywords: ['Subestação', 'SUBESTAÇÃO', 'Subestacao', 'Lado Terra'] },
    { id: 'h-fora-muro', name: 'Entorno / Fora do Muro (Vegetação/CBMERJ)', top: 16, left: 20, isExternal: true, keywords: ['Fora do sítio', 'Outro lado do muro', 'CBMERJ', 'Vegetação'] },
    { id: 'h-baloeiro-ext', name: 'Zona de Risco Baloeiro (Entorno Baía)', top: 82, left: 78, isExternal: true, keywords: ['Balão', 'Baloeiro', 'Pipa', 'Baía'] }
  ];

  /**
   * Aplica os filtros combinados de mês e âmbito
   */
  function filterDataCombined(data) {
    if (!data) return [];
    let result = data;
    if (currentMonthFilter && currentMonthFilter !== 'todos') {
      result = result.filter(d => d.mes === currentMonthFilter);
    }
    if (currentScopeFilter === 'internal') {
      result = result.filter(d => !d.is_external);
    } else if (currentScopeFilter === 'external') {
      result = result.filter(d => d.is_external);
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
   * Define o filtro de âmbito (todos, interno, externo)
   */
  function setScopeFilter(scope, data, btnEl) {
    currentScopeFilter = scope;
    if (btnEl && btnEl.parentElement) {
      btnEl.parentElement.querySelectorAll('.scope-toggle-btn').forEach(b => b.classList.remove('active'));
      btnEl.classList.add('active');
    }
    if (data) render(data);
  }

  /**
   * Renderiza todo o módulo de Atuação SESCINC
   */
  function render(data) {
    if (!data || !Array.isArray(data)) return;

    // Filtrar dados combinando Mês e Âmbito
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
    const internalEl = document.getElementById('actkpi-internal');
    const externalEl = document.getElementById('actkpi-external');
    const topTypeEl = document.getElementById('actkpi-top-type');
    const topTeamEl = document.getElementById('actkpi-top-team');

    const total = data.length;
    const internal = data.filter(d => !d.is_external).length;
    const external = data.filter(d => d.is_external).length;

    // Tipo mais comum
    const typeCounts = {};
    const teamCounts = {};
    data.forEach(d => {
      typeCounts[d.tipo] = (typeCounts[d.tipo] || 0) + 1;
      if (d.equipe && d.equipe !== 'N/I') {
        teamCounts[d.equipe] = (teamCounts[d.equipe] || 0) + 1;
      }
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

    if (totalEl) totalEl.textContent = total;
    if (internalEl) internalEl.textContent = internal;
    if (externalEl) externalEl.textContent = external;
    if (topTypeEl) topTypeEl.textContent = topType + ' (' + maxTypeCount + ')';
    if (topTeamEl) topTeamEl.textContent = 'Equipe ' + topTeam + ' (' + maxTeamCount + ')';
  }

  /**
   * Filtra registros pelo escopo selecionado
   */
  function filterDataByScope(data, scope) {
    if (scope === 'internal') return data.filter(d => !d.is_external);
    if (scope === 'external') return data.filter(d => d.is_external);
    return data;
  }

  /**
   * Define o filtro de escopo (all, internal, external)
   */
  function setScopeFilter(scope, data) {
    currentScopeFilter = scope;

    // Atualizar botões UI
    const btns = document.querySelectorAll('.scope-toggle-btn');
    btns.forEach(b => {
      if (b.getAttribute('data-scope') === scope) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    render(data);
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

      HOTSPOTS.forEach(h => {
        if (h.keywords.some(kw => fullText.includes(kw.toUpperCase()))) {
          hotspotCounts[h.id]++;
          matched = true;
        }
      });

      // Se for externo e não deu match direto, atribui ao hotspot externo padrão
      if (!matched && d.is_external) {
        hotspotCounts['h-fora-muro']++;
      } else if (!matched) {
        hotspotCounts['h-patio-principal']++;
      }
    });

    // Desenhar manchas de calor no canvas
    HOTSPOTS.forEach(h => {
      const count = hotspotCounts[h.id];
      if (count > 0) {
        const x = (h.left / 100) * width;
        const y = (h.top / 100) * height;
        const radius = Math.min(80, 25 + count * 6);

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        if (h.isExternal) {
          gradient.addColorStop(0, 'rgba(239, 68, 68, 0.65)'); // Red glow for external
          gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.25)');
          gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        } else {
          gradient.addColorStop(0, 'rgba(2, 132, 199, 0.65)'); // Cyan/Blue glow for internal
          gradient.addColorStop(0.5, 'rgba(2, 132, 199, 0.25)');
          gradient.addColorStop(1, 'rgba(2, 132, 199, 0)');
        }

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
      // Se estamos filtrando por interno/externo, só mostrar os relevantes ou com contagem > 0
      if (currentScopeFilter === 'internal' && h.isExternal) return;
      if (currentScopeFilter === 'external' && !h.isExternal) return;

      const pin = document.createElement('div');
      pin.className = 'airport-pin' + (h.isExternal ? ' pin-external' : ' pin-internal') + (count > 0 ? ' active' : ' empty');
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
        const filtered = filterDataByScope(data, currentScopeFilter);
        renderHeatmapAndPins(filtered);
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
        const extBadge = r.is_external
          ? '<span class="badge badge-danger">Externo</span>'
          : '<span class="badge badge-info">Interno</span>';
        
        const viaturasHtml = r.viaturas && r.viaturas.length > 0
          ? r.viaturas.map(v => `<span class="badge badge-secondary">${v}</span>`).join(' ')
          : '<span class="text-muted">Nenhuma informada</span>';

        html += `
          <div class="actuation-modal-item">
            <div class="actuation-item-header">
              <span class="actuation-item-date">${r.data} (${r.mes})</span>
              <span class="actuation-item-tipo">${r.tipo}</span>
              ${extBadge}
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

    // Chart 2: Distribuição Mensal (Jan-Jun)
    const ctxMonthly = document.getElementById('chart-actuation-monthly');
    if (ctxMonthly) {
      if (chartMonthlyInstance) chartMonthlyInstance.destroy();
      const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho'];
      const internalCounts = [0, 0, 0, 0, 0, 0];
      const externalCounts = [0, 0, 0, 0, 0, 0];

      data.forEach(d => {
        const idx = meses.indexOf(d.mes);
        if (idx !== -1) {
          if (d.is_external) externalCounts[idx]++;
          else internalCounts[idx]++;
        }
      });

      const isHorizontal = activeMonthlyType === 'horizontalBar';
      const isLine = activeMonthlyType === 'line';
      const chartType = isLine ? 'line' : 'bar';

      const datasets = [
        {
          label: 'Sítio Aeroportuário (Interno)',
          data: internalCounts,
          backgroundColor: isDark ? '#38bdf8' : '#0284c7',
          borderColor: isDark ? '#38bdf8' : '#0284c7',
          borderWidth: isLine ? 3 : 1,
          borderRadius: isLine ? 0 : 6,
          fill: false,
          tension: 0.3
        },
        {
          label: 'Fora do Sítio (Externo)',
          data: externalCounts,
          backgroundColor: isDark ? '#ef4444' : '#c62828',
          borderColor: isDark ? '#ef4444' : '#c62828',
          borderWidth: isLine ? 3 : 1,
          borderRadius: isLine ? 0 : 6,
          fill: false,
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
            title: { display: true, text: 'Distribuição Mensal por Âmbito', font: { size: 15, weight: 'bold' }, color: textColor },
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
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Nenhum acionamento encontrado.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(r => {
        const scopeBadge = r.is_external
          ? '<span class="badge badge-danger">Externo</span>'
          : '<span class="badge badge-info">Interno</span>';
        
        const viaturasText = r.viaturas && r.viaturas.length > 0 ? r.viaturas.join(', ') : '—';

        return `
          <tr>
            <td><strong>${r.data}</strong><br><small class="text-muted">${r.mes}</small></td>
            <td><strong>${r.tipo}</strong></td>
            <td>${r.localizacao} ${r.quadrante ? '<br><small class="text-muted">Quad. ' + r.quadrante + '</small>' : ''}</td>
            <td>${scopeBadge}</td>
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
    const scopeBadge = item.is_external
      ? '<span class="badge badge-danger">Sítio Externo / Lado Terra 🌐</span>'
      : '<span class="badge badge-info">Sítio Aeroportuário Interno ✈️</span>';

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
          <div>${scopeBadge}</div>
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

  return {
    render: render,
    setScopeFilter: setScopeFilter,
    setMonthFilter: setMonthFilter
  };
})();
