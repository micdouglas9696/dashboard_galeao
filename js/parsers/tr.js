/**
 * SESCINC SBGL — Parser de TR (Tempo de Resposta por Cabeceira)
 * Detecta e analisa planilhas de controle de desempenho por cabeceira.
 * Suporta múltiplas abas (CABECEIRA 28, 33, 15) com unpivot dinâmico.
 */

window.SESCINC = window.SESCINC || {};
window.SESCINC.Parsers = window.SESCINC.Parsers || {};

window.SESCINC.Parsers.TR = {

  /** Mapeamento de nomes de meses */
  _MONTHS: {
    'JANEIRO': { name: 'Janeiro', index: 0 },
    'FEVEREIRO': { name: 'Fevereiro', index: 1 },
    'MARÇO': { name: 'Março', index: 2 },
    'MARCO': { name: 'Março', index: 2 },
    'ABRIL': { name: 'Abril', index: 3 },
    'MAIO': { name: 'Maio', index: 4 },
    'JUNHO': { name: 'Junho', index: 5 },
    'JULHO': { name: 'Julho', index: 6 },
    'AGOSTO': { name: 'Agosto', index: 7 },
    'SETEMBRO': { name: 'Setembro', index: 8 },
    'OUTUBRO': { name: 'Outubro', index: 9 },
    'NOVEMBRO': { name: 'Novembro', index: 10 },
    'DEZEMBRO': { name: 'Dezembro', index: 11 }
  },

  /** Nomes de equipes esperados */
  _EQUIPES: ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA'],

  /**
   * Detecta se o workbook é uma planilha TR.
   * @param {Object} workbook — Workbook SheetJS
   * @returns {boolean}
   */
  detect: function (workbook) {
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) return false;

    try {
      // Verifica se tem aba 'CABECEIRA'
      var hasCabeceira = workbook.SheetNames.some(function (sn) {
        return sn.toUpperCase().indexOf('CABECEIRA') >= 0;
      });
      if (hasCabeceira) return true;

      // Verifica conteúdo da primeira aba
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!data || data.length < 2) return false;

      for (var i = 0; i < Math.min(data.length, 5); i++) {
        var rowText = (data[i] || []).join(' ').toUpperCase();
        if (rowText.indexOf('CONTROLE') >= 0 && rowText.indexOf('DESEMPENHO') >= 0) {
          return true;
        }
      }

      return false;
    } catch (e) {
      console.error('[SESCINC TR] Erro na detecção:', e);
      return false;
    }
  },

  /**
   * Converte valor de tempo para segundos.
   * @param {*} value — Valor da célula
   * @returns {number|null}
   */
  _parseTime: function (value) {
    if (value === null || value === undefined || value === '') return null;

    // Excel represents CCI stopwatch times shifted (minutes as hours, seconds as minutes)
    // So we must scale down by 60
    if (typeof value === 'number') {
      if (value < 1) {
        // (value * 86400) / 60
        return Math.round(value * 1440);
      }
      return Math.round(value / 60);
    }

    var str = String(value).trim();

    // Formato HH:MM:SS (Excel format where HH is actually minutes and MM is seconds)
    var match = str.match(/^(\d+):(\d+):(\d+)$/);
    if (match) {
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }

    // Formato MM:SS
    match = str.match(/^(\d+):(\d+)$/);
    if (match) {
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }

    // Tentativa numérica
    var num = parseFloat(str);
    if (!isNaN(num)) {
      if (num < 1) return Math.round(num * 1440);
      return Math.round(num / 60);
    }

    return null;
  },

  /**
   * Formata segundos para mm:ss.
   * @param {number} seconds
   * @returns {string|null}
   */
  _formatTime: function (seconds) {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return null;
    var mins = Math.floor(seconds / 60);
    var secs = Math.round(seconds % 60);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  },

  /**
   * Extrai número da cabeceira a partir do nome da aba.
   * @param {string} sheetName
   * @returns {string|null} — ex: '28', '33', '15'
   */
  _extractCabeceira: function (sheetName) {
    var match = String(sheetName).match(/(\d+)/);
    return match ? match[1] : null;
  },

  /**
   * Verifica se uma string é um nome de mês.
   * @param {string} value
   * @returns {boolean}
   */
  _isMonth: function (value) {
    if (!value) return false;
    var upper = String(value).toUpperCase().trim();
    return this._MONTHS.hasOwnProperty(upper);
  },

  /**
   * Verifica se uma string é um identificador CCI.
   * @param {string} value
   * @returns {boolean}
   */
  _isCCI: function (value) {
    if (!value) return false;
    var str = String(value).trim();
    // Começa com dígito (ex: "1°CCI") ou contém "CCI"
    return /^\d/.test(str) || str.toUpperCase().indexOf('CCI') >= 0;
  },

  /**
   * Constrói mapeamento dinâmico de colunas para meses e CCIs.
   * @param {Array} row7 — Linha 7 (index 6) com nomes dos meses
   * @param {Array} row8 — Linha 8 (index 7) com nomes dos CCIs
   * @returns {Object[]} — Array de { col, month, monthInfo, cci }
   */
  _buildColumnMap: function (row7, row8) {
    var mapping = [];
    var currentMonth = null;
    var currentMonthInfo = null;

    var maxCol = Math.max(row7 ? row7.length : 0, row8 ? row8.length : 0);

    for (var col = 1; col < maxCol; col++) {
      // Verifica se há um novo mês na row7
      var monthVal = row7 && row7[col] != null ? String(row7[col]).trim() : '';
      if (monthVal !== '') {
        var monthUpper = monthVal.toUpperCase();
        if (this._MONTHS.hasOwnProperty(monthUpper)) {
          currentMonth = monthUpper;
          currentMonthInfo = this._MONTHS[monthUpper];
        }
      }

      // Verifica CCI na row8
      var cciVal = row8 && row8[col] != null ? String(row8[col]).trim() : '';
      if (cciVal !== '' && this._isCCI(cciVal) && currentMonth) {
        // Normaliza CCI: garante formato N°CCI
        var normalizedCCI = cciVal;
        if (!/°/.test(normalizedCCI) && /^\d/.test(normalizedCCI)) {
          // Formato "1CCI" → "1°CCI"
          normalizedCCI = normalizedCCI.replace(/^(\d+)\s*/, '$1°');
          if (normalizedCCI.toUpperCase().indexOf('CCI') < 0) {
            normalizedCCI += 'CCI';
          }
        }

        mapping.push({
          col: col,
          month: currentMonth,
          monthInfo: currentMonthInfo,
          cci: normalizedCCI
        });
      }
    }

    return mapping;
  },

  /**
   * Determina status e valor de uma célula de tempo.
   * @param {*} cellValue
   * @returns {{ tempoSeconds: number|null, tempoFormatted: string|null, status: string }}
   */
  _parseCellValue: function (cellValue) {
    if (cellValue === null || cellValue === undefined || cellValue === '') {
      return { tempoSeconds: null, tempoFormatted: null, status: 'empty' };
    }

    var str = String(cellValue).trim().toUpperCase();

    if (str === 'NR') {
      return { tempoSeconds: null, tempoFormatted: null, status: 'nr' };
    }

    if (str === 'X') {
      return { tempoSeconds: null, tempoFormatted: null, status: 'na' };
    }

    var seconds = this._parseTime(cellValue);
    if (seconds !== null) {
      return {
        tempoSeconds: seconds,
        tempoFormatted: this._formatTime(seconds),
        status: 'ok'
      };
    }

    // Valor não reconhecido
    console.warn('[SESCINC TR] Valor não reconhecido: "' + cellValue + '"');
    return { tempoSeconds: null, tempoFormatted: null, status: 'empty' };
  },

  /**
   * Analisa uma única aba de cabeceira.
   * @param {Object} workbook
   * @param {string} sheetName
   * @returns {Object[]}
   */
  _parseSheet: function (workbook, sheetName) {
    var sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    var data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!data || data.length < 9) {
      console.warn('[SESCINC TR] Aba "' + sheetName + '" possui dados insuficientes');
      return [];
    }

    var cabeceira = this._extractCabeceira(sheetName);
    if (!cabeceira) {
      console.warn('[SESCINC TR] Não foi possível extrair número da cabeceira de "' + sheetName + '"');
      return [];
    }

    console.log('[SESCINC TR] Analisando cabeceira ' + cabeceira + ' (aba "' + sheetName + '")');

    // Row 7 (index 6): meses
    // Row 8 (index 7): CCIs
    var row7 = data[6] || [];
    var row8 = data[7] || [];

    var columnMap = this._buildColumnMap(row7, row8);
    console.log('[SESCINC TR] Mapeamento de colunas: ' + columnMap.length + ' coluna(s) de dados');

    if (columnMap.length === 0) {
      console.warn('[SESCINC TR] Nenhuma coluna mapeada para cabeceira ' + cabeceira);
      return [];
    }

    var records = [];

    // Rows 9-12 (index 8-11): equipes
    for (var rowIdx = 8; rowIdx < Math.min(data.length, 20); rowIdx++) {
      var row = data[rowIdx];
      if (!row || row.length === 0) continue;

      // Primeira coluna não-vazia deve ser o nome da equipe
      var equipeRaw = row[0] != null ? String(row[0]).trim().toUpperCase() : '';

      // Tenta também coluna 1 se coluna 0 estiver vazia
      if (!equipeRaw && row[1] != null) {
        equipeRaw = String(row[1]).trim().toUpperCase();
      }

      // Verifica se é uma equipe conhecida
      var equipe = null;
      for (var e = 0; e < this._EQUIPES.length; e++) {
        if (equipeRaw.indexOf(this._EQUIPES[e]) >= 0) {
          equipe = this._EQUIPES[e];
          break;
        }
      }

      if (!equipe) continue;

      // Para cada coluna mapeada, extrai o valor
      for (var m = 0; m < columnMap.length; m++) {
        var mapping = columnMap[m];
        var cellValue = row[mapping.col] != null ? row[mapping.col] : null;
        var parsed = this._parseCellValue(cellValue);

        records.push({
          cabeceira: cabeceira,
          equipe: equipe,
          mes: mapping.monthInfo.name,
          mesIndex: mapping.monthInfo.index,
          cci: mapping.cci,
          tempoFormatted: parsed.tempoFormatted,
          tempoSeconds: parsed.tempoSeconds,
          status: parsed.status
        });
      }
    }

    return records;
  },

  /**
   * Analisa a planilha TR completa (todas as cabeceiras).
   * @param {Object} workbook — Workbook SheetJS
   * @returns {Object[]} — Array de registros TR
   */
  parse: function (workbook) {
    if (!workbook) {
      console.error('[SESCINC TR] Workbook inválido');
      return [];
    }

    var records = [];
    var self = this;

    // Filtra abas de cabeceira (ignora 'TESTE GRAFICO' e similares)
    var cabeceiraSheets = workbook.SheetNames.filter(function (sn) {
      var upper = sn.toUpperCase();
      return upper.indexOf('CABECEIRA') >= 0 && upper.indexOf('GRAFICO') < 0 && upper.indexOf('GRÁFICO') < 0;
    });

    if (cabeceiraSheets.length === 0) {
      console.warn('[SESCINC TR] Nenhuma aba de cabeceira encontrada');
      // Tenta todas as abas exceto gráficos
      cabeceiraSheets = workbook.SheetNames.filter(function (sn) {
        var upper = sn.toUpperCase();
        return upper.indexOf('GRAFICO') < 0 && upper.indexOf('GRÁFICO') < 0 && upper.indexOf('TESTE') < 0;
      });
    }

    console.log('[SESCINC TR] Abas a processar: ' + cabeceiraSheets.join(', '));

    cabeceiraSheets.forEach(function (sheetName) {
      var sheetRecords = self._parseSheet(workbook, sheetName);
      records = records.concat(sheetRecords);
    });

    console.log('[SESCINC TR] Total: ' + records.length + ' registro(s) processado(s)');
    return records;
  }
};
