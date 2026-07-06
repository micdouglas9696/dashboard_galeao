/**
 * SESCINC SBGL — Parser de TP-EPR (Tempo de Resposta / Equipamento de Proteção Respiratória)
 * Detecta e analisa planilhas de aferição de tempo de resposta.
 */

window.SESCINC = window.SESCINC || {};
window.SESCINC.Parsers = window.SESCINC.Parsers || {};

window.SESCINC.Parsers.TPEPR = {

  /** Nomes de meses para detecção de abas */
  _MONTH_NAMES: [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ],

  /**
   * Detecta se o workbook é uma planilha TP-EPR.
   * @param {Object} workbook — Workbook SheetJS
   * @returns {boolean}
   */
  detect: function (workbook) {
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) return false;

    try {
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!data || data.length < 2) return false;

      // Verifica primeiras linhas por indicadores
      for (var i = 0; i < Math.min(data.length, 5); i++) {
        var rowText = (data[i] || []).join(' ').toUpperCase();
        if (rowText.indexOf('TEMPO') >= 0 && rowText.indexOf('RESPOSTA') >= 0) {
          if (rowText.indexOf('TP') >= 0 || rowText.indexOf('EPR') >= 0) {
            return true;
          }
        }
      }

      return false;
    } catch (e) {
      console.error('[SESCINC TPEPR] Erro na detecção:', e);
      return false;
    }
  },

  /**
   * Encontra a aba de dados.
   * @param {Object} workbook
   * @returns {string}
   */
  _findDataSheet: function (workbook) {
    for (var i = 0; i < workbook.SheetNames.length; i++) {
      var sn = workbook.SheetNames[i].toUpperCase().trim();
      if (this._MONTH_NAMES.indexOf(sn) >= 0) {
        return workbook.SheetNames[i];
      }
    }
    return workbook.SheetNames[0];
  },

  /**
   * Converte valor de tempo (Excel serial ou string) para segundos.
   * @param {*} value — Valor da célula
   * @returns {number|null} — Tempo em segundos
   */
  _parseTime: function (value) {
    if (value === null || value === undefined || value === '') return null;

    // Numérico — Excel serial time (fração do dia)
    if (typeof value === 'number') {
      if (value < 1) {
        // Fração do dia → segundos
        return Math.round(value * 86400);
      }
      // Já em segundos ou outro formato
      return Math.round(value);
    }

    var str = String(value).trim();

    // Formato HH:MM:SS
    var match = str.match(/^(\d+):(\d+):(\d+)$/);
    if (match) {
      return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
    }

    // Formato MM:SS
    match = str.match(/^(\d+):(\d+)$/);
    if (match) {
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }

    // Tentativa numérica
    var num = parseFloat(str);
    if (!isNaN(num)) {
      if (num < 1) return Math.round(num * 86400);
      return Math.round(num);
    }

    return null;
  },

  /**
   * Formata segundos para mm:ss.
   * @param {number} seconds
   * @returns {string}
   */
  _formatTime: function (seconds) {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '';
    var mins = Math.floor(seconds / 60);
    var secs = Math.round(seconds % 60);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  },

  /**
   * Verifica se uma linha é de resumo/total.
   * @param {string} nome
   * @returns {boolean}
   */
  _isSummaryRow: function (nome) {
    if (!nome) return true;
    var upper = String(nome).toUpperCase().trim();
    if (upper === '') return true;
    if (upper.indexOf('CONTAGEM') >= 0) return true;
    if (upper.indexOf('TOTAL') >= 0) return true;
    if (upper.indexOf('MÉDIA') >= 0 || upper.indexOf('MEDIA') >= 0) return true;
    if (upper.indexOf('%') >= 0) return true;
    return false;
  },

  /**
   * Analisa a planilha TP-EPR e retorna registros estruturados.
   * @param {Object} workbook — Workbook SheetJS
   * @returns {Object[]} — Array de registros TP-EPR
   */
  parse: function (workbook, fileName) {
    if (!workbook) {
      console.error('[SESCINC TPEPR] Workbook inválido');
      return [];
    }

    var sheetName = this._findDataSheet(workbook);
    var sheet = workbook.Sheets[sheetName];
    var data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log('[SESCINC TPEPR] Analisando aba "' + sheetName + '" — ' + data.length + ' linhas');

    var records = [];

    // NOTA: Coluna A é vazia (offset de 1)
    // Colunas: B(1)=Nome, C(2)=Equipe, D(3)=Função, E(4)=Tempo, F(5)=Resultado
    // Dados começam na linha 6 (index 5)
    for (var i = 5; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length === 0) continue;

      var nome = row[1] != null ? String(row[1]).trim() : '';

      // Pula linhas vazias ou de resumo
      if (!nome || this._isSummaryRow(nome)) continue;
      if (nome.toUpperCase().indexOf('NOME') >= 0) continue;

      // Equipe
      var equipe = row[2] != null ? String(row[2]).trim().toUpperCase() : '';

      // Função normalizada
      var funcao = '';
      if (window.SESCINC && window.SESCINC.Names) {
        funcao = window.SESCINC.Names.normalizeFuncao(row[3] != null ? String(row[3]) : '');
      } else {
        funcao = row[3] != null ? String(row[3]).trim().toUpperCase() : '';
      }

      // Tempo
      var tempoSeconds = this._parseTime(row[4]);
      var tempoFormatted = this._formatTime(tempoSeconds);

      // Resultado (da planilha)
      var resultado = row[5] != null ? String(row[5]).trim() : '';

      // Se resultado vazio, classifica automaticamente
      if (!resultado && tempoSeconds !== null) {
        if (tempoSeconds <= 60) {
          resultado = 'Excelente';
        } else if (tempoSeconds <= 90) {
          resultado = 'Bom';
        } else {
          resultado = 'Ruim';
        }
      }

      var mesNormalized = '';
      if (window.SESCINC && window.SESCINC.Names && window.SESCINC.Names.extractMonth) {
        mesNormalized = window.SESCINC.Names.extractMonth(fileName, sheetName, workbook);
      } else {
        mesNormalized = sheetName.charAt(0).toUpperCase() + sheetName.slice(1).toLowerCase();
      }
      records.push({
        nome: nome,
        equipe: equipe,
        funcao: funcao,
        tempoSeconds: tempoSeconds,
        tempoFormatted: tempoFormatted,
        resultado: resultado,
        mes: mesNormalized
      });
    }

    console.log('[SESCINC TPEPR] ' + records.length + ' registro(s) processado(s)');
    return records;
  }
};
