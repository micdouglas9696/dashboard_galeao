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

    // Detecta cabeçalho para offset de coluna
    var colOffset = 0;
    for (var h = 0; h < Math.min(data.length, 6); h++) {
      var hRow = data[h] || [];
      for (var c = 0; c < hRow.length; c++) {
        if (String(hRow[c] || '').toUpperCase().indexOf('NOME') >= 0) {
          colOffset = c;
          break;
        }
      }
    }

    for (var i = 5; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length === 0) continue;

      var nome = row[colOffset] != null ? String(row[colOffset]).trim() : '';

      // Pula linhas vazias ou de resumo
      if (!nome || this._isSummaryRow(nome)) continue;
      if (nome.toUpperCase().indexOf('NOME') >= 0) continue;

      var rowText = row.map(function (c) { return String(c || '').toUpperCase(); }).join(' ');

      // Detecta status especial: Permuta ou Férias
      var isPermuta = rowText.indexOf('PERMUTA') >= 0;
      var isFerias = rowText.indexOf('FERIAS') >= 0 || rowText.indexOf('FÉRIAS') >= 0;
      var isNaoRealizado = rowText.indexOf('NÃO REALIZADO') >= 0 ||
                           rowText.indexOf('NAO REALIZADO') >= 0 ||
                           rowText.indexOf('NÃO REALIZADIO') >= 0 ||
                           rowText.indexOf('NAO REALIZADIO') >= 0 ||
                           rowText.indexOf('FOLGA') >= 0 ||
                           rowText.indexOf('ATESTADO') >= 0;
      var motivo = isPermuta ? 'Permuta' :
                   (rowText.indexOf('FOLGA') >= 0 ? 'Folga' :
                   (rowText.indexOf('ATESTADO') >= 0 ? 'Atestado' :
                   (isNaoRealizado ? 'Não Realizado' : (isFerias ? 'Férias' : ''))));

      // Equipe
      var equipe = row[colOffset + 1] != null ? String(row[colOffset + 1]).trim().toUpperCase() : '';

      // Função normalizada
      var funcao = '';
      if (window.SESCINC && window.SESCINC.Names) {
        funcao = window.SESCINC.Names.normalizeFuncao(row[colOffset + 2] != null ? String(row[colOffset + 2]) : '');
      } else {
        funcao = row[colOffset + 2] != null ? String(row[colOffset + 2]).trim().toUpperCase() : '';
      }

      // Tempo
      var tempoSeconds = isPermuta || isNaoRealizado || isFerias ? null : this._parseTime(row[colOffset + 3]);
      var tempoFormatted = isPermuta || (isNaoRealizado && !isFerias) ? 'Não Realizado' : (isFerias ? 'Férias' : this._formatTime(tempoSeconds));

      // Status
      var status = 'ok';
      if (isPermuta || (isNaoRealizado && !isFerias)) {
        status = 'nr';
      } else if (isFerias) {
        status = 'ferias';
      } else if (tempoSeconds === null && String(row[colOffset + 3] || '').toUpperCase() === 'NR') {
        status = 'nr';
        motivo = motivo || 'Não Realizado';
      }

      // Resultado
      var resultadoRaw = row[colOffset + 4] != null ? String(row[colOffset + 4]).trim() : '';
      var resultado = '';

      if (isPermuta || (isNaoRealizado && !isFerias)) {
        resultado = 'Não Realizado';
      } else if (isFerias) {
        resultado = 'Férias';
      } else if (resultadoRaw) {
        var lowerRes = resultadoRaw.toLowerCase();
        if (lowerRes.indexOf('permuta') >= 0 || lowerRes === 'nr' || lowerRes.indexOf('não realizado') >= 0) {
          resultado = 'Não Realizado';
          status = 'nr';
        } else if (lowerRes.indexOf('excelente') >= 0 || lowerRes.indexOf('satisfat') >= 0 || ['ACOP - A', 'ACOP A', 'ACOP-A'].indexOf(resultadoRaw.toUpperCase()) >= 0) {
          resultado = 'ACOP - A';
        } else if (lowerRes === 'bom' || ['ACOP - B', 'ACOP B', 'ACOP-B'].indexOf(resultadoRaw.toUpperCase()) >= 0) {
          resultado = 'ACOP - B';
        } else if (lowerRes.indexOf('ruim') >= 0 || lowerRes.indexOf('insatisf') >= 0 || lowerRes.indexOf('insatisfe') >= 0 || lowerRes.indexOf('evolu') >= 0) {
          resultado = 'Em evolução';
        } else if (lowerRes.indexOf('férias') >= 0 || lowerRes.indexOf('ferias') >= 0) {
          resultado = 'Férias';
          status = 'ferias';
        } else {
          resultado = resultadoRaw;
        }
      }

      // Se resultado vazio e status ok, classifica automaticamente pelo tempo:
      // ≤ 60s: ACOP - A | 61s-90s: ACOP - B | > 90s: Em evolução
      if (!resultado && status === 'ok' && tempoSeconds !== null) {
        if (tempoSeconds <= 60) {
          resultado = 'ACOP - A';
        } else if (tempoSeconds <= 90) {
          resultado = 'ACOP - B';
        } else {
          resultado = 'Em evolução';
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
        resultado: resultado || (status === 'nr' ? 'Não Realizado' : 'ACOP - A'),
        status: status,
        motivo: motivo || null,
        mes: mesNormalized
      });
    }

    console.log('[SESCINC TPEPR] ' + records.length + ' registro(s) processado(s)');
    return records;
  }
};
