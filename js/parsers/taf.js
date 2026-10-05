/**
 * SESCINC SBGL — Parser de TAF (Teste de Avaliação Física)
 * Detecta e analisa planilhas de aferição do TAF.
 */

window.SESCINC = window.SESCINC || {};
window.SESCINC.Parsers = window.SESCINC.Parsers || {};

window.SESCINC.Parsers.TAF = {

  /** Nomes de meses para detecção de abas */
  _MONTH_NAMES: [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ],

  /**
   * Detecta se o workbook é uma planilha TAF.
   * @param {Object} workbook — Workbook SheetJS
   * @returns {boolean}
   */
  detect: function (workbook) {
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) return false;

    try {
      // Verifica nome da aba (mês ou padrão)
      var firstSheet = workbook.SheetNames[0];
      var hasMonthSheet = false;
      for (var i = 0; i < workbook.SheetNames.length; i++) {
        var sn = workbook.SheetNames[i].toUpperCase().trim();
        if (this._MONTH_NAMES.indexOf(sn) >= 0) {
          hasMonthSheet = true;
          break;
        }
      }

      // Lê dados da primeira aba
      var sheet = workbook.Sheets[firstSheet];
      var data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!data || data.length < 5) return false;

      // Verifica Row 1: deve conter 'AFERIÇÃO' e ('TAF' ou 'AVALIAÇÃO FISICA')
      var row1 = (data[0] || []).join(' ').toUpperCase();
      var hasTitle = row1.indexOf('AFERI') >= 0 &&
        (row1.indexOf('TAF') >= 0 || row1.indexOf('AVALIA') >= 0);

      if (!hasTitle && !hasMonthSheet) return false;

      // Verifica Row 5 (index 4): headers NOME, EQUIPE, FUNÇÃO
      var row5 = data[4] || [];
      var row5Text = row5.map(function (c) { return String(c || '').toUpperCase(); });
      var hasNome = row5Text.some(function (c) { return c.indexOf('NOME') >= 0; });
      var hasEquipe = row5Text.some(function (c) { return c.indexOf('EQUIPE') >= 0; });
      var hasFuncao = row5Text.some(function (c) { return c.indexOf('FUN') >= 0; });

      return hasTitle && hasNome && hasEquipe && hasFuncao;
    } catch (e) {
      console.error('[SESCINC TAF] Erro na detecção:', e);
      return false;
    }
  },

  /**
   * Encontra a aba de dados (mês ou primeira aba).
   * @param {Object} workbook
   * @returns {string} — Nome da aba
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
   * Converte tempo de corrida no formato mm'ss" para segundos.
   * @param {*} value — Valor da célula
   * @returns {number|null} — Tempo em segundos
   */
  _parseCorridaTime: function (value) {
    if (value === null || value === undefined || value === '') return null;

    var str = String(value).trim();

    // Verifica NR
    if (str.toUpperCase() === 'NR') return null;

    // Formato mm'ss" — ex: 11'55"
    var match = str.match(/^(\d+)[''′](\d+)[""″]?$/);
    if (match) {
      var minutes = parseInt(match[1], 10);
      var seconds = parseInt(match[2], 10);
      return minutes * 60 + seconds;
    }

    // Formato mm:ss
    match = str.match(/^(\d+):(\d+)$/);
    if (match) {
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }

    // Formato HH:MM:SS
    match = str.match(/^(\d+):(\d+):(\d+)$/);
    if (match) {
      return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
    }

    // Numérico — trata como minutos decimais
    var num = parseFloat(str);
    if (!isNaN(num)) {
      if (num < 1) {
        // Excel time serial (fração do dia)
        return Math.round(num * 86400);
      }
      // Minutos
      return Math.round(num * 60);
    }

    return null;
  },

  /**
   * Verifica se uma célula contém indicação de férias.
   * @param {*} value
   * @returns {boolean}
   */
  _isFerias: function (value) {
    if (!value) return false;
    return String(value).toUpperCase().indexOf('FERIAS') >= 0 ||
           String(value).toUpperCase().indexOf('FÉRIAS') >= 0;
  },

  /**
   * Verifica se uma linha é de resumo/total (deve ser ignorada).
   * @param {string} nome
   * @returns {boolean}
   */
  _isSummaryRow: function (nome) {
    if (!nome) return true;
    var upper = String(nome).toUpperCase().trim();
    if (/^\d/.test(upper)) return true;
    if (upper.indexOf('TOTAL') >= 0) return true;
    if (upper.indexOf('CONTAGEM') >= 0) return true;
    if (upper.indexOf('MÉDIA') >= 0 || upper.indexOf('MEDIA') >= 0) return true;
    if (upper === '') return true;
    return false;
  },

  /**
   * Analisa a planilha TAF e retorna registros estruturados.
   * @param {Object} workbook — Workbook SheetJS
   * @returns {Object[]} — Array de registros TAF
   */
  parse: function (workbook, fileName) {
    if (!workbook) {
      console.error('[SESCINC TAF] Workbook inválido');
      return [];
    }

    var sheetName = this._findDataSheet(workbook);
    var sheet = workbook.Sheets[sheetName];
    var data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log('[SESCINC TAF] Analisando aba "' + sheetName + '" — ' + data.length + ' linhas');

    var records = [];

    // Detecta colunas dinamicamente a partir da linha 5 (index 4)
    var headers = (data[4] || []).map(function (c) { return String(c || '').trim(); });
    var colMap = {};
    for (var h = 0; h < headers.length; h++) {
      var hu = headers[h].toUpperCase();
      if (hu.indexOf('NOME') >= 0 && colMap.colNome === undefined) colMap.colNome = h;
      else if (hu.indexOf('EQUIPE') >= 0 && colMap.colEquipe === undefined) colMap.colEquipe = h;
      else if (hu.indexOf('FUN') >= 0 && colMap.colFuncao === undefined) colMap.colFuncao = h;
      else if (hu.indexOf('IDADE') >= 0 && colMap.colIdade === undefined) colMap.colIdade = h;
      else if (hu.indexOf('FLEX') >= 0 && colMap.colFlexao === undefined) colMap.colFlexao = h;
      else if (hu.indexOf('ABDOM') >= 0 && colMap.colAbdominal === undefined) colMap.colAbdominal = h;
      else if (hu.indexOf('BARRA') >= 0) colMap.colBarra = h;
      else if (hu.indexOf('POLICHINELO') >= 0 && colMap.colBarra === undefined) colMap.colBarra = h;
      else if (hu.indexOf('CORRIDA') >= 0) colMap.colCorrida = h;
      else if (hu.indexOf('TEMPO') >= 0 && colMap.colCorrida === undefined) colMap.colCorrida = h;
      else if (hu.indexOf('RESULT') >= 0 && colMap.colResultado === undefined) colMap.colResultado = h;
    }

    if (colMap.colBarra === undefined) {
      for (var b = 0; b < headers.length; b++) {
        if (headers[b].toUpperCase().indexOf('POLICHINELO') >= 0) {
          colMap.colBarra = b;
          break;
        }
      }
    }

    var cNome = colMap.colNome !== undefined ? colMap.colNome : 0;
    var cEquipe = colMap.colEquipe !== undefined ? colMap.colEquipe : 1;
    var cFuncao = colMap.colFuncao !== undefined ? colMap.colFuncao : 2;
    var cIdade = colMap.colIdade !== undefined ? colMap.colIdade : 3;
    var cFlexao = colMap.colFlexao !== undefined ? colMap.colFlexao : 4;
    var cAbdominal = colMap.colAbdominal !== undefined ? colMap.colAbdominal : 5;
    var cBarra = colMap.colBarra !== undefined ? colMap.colBarra : 6;
    var cCorrida = colMap.colCorrida !== undefined ? colMap.colCorrida : 7;
    var cResultado = colMap.colResultado !== undefined ? colMap.colResultado : 8;

    // Dados começam na linha 6 (index 5)
    for (var i = 5; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length === 0) continue;

      var nome = row[cNome] != null ? String(row[cNome]).trim() : '';

      // Pula linhas vazias, de cabeçalho ou resumo
      if (!nome || this._isSummaryRow(nome)) continue;
      if (nome.toUpperCase().indexOf('NOME') >= 0) continue;

      // Detecta status especial
      var status = 'ok';
      var rowText = row.map(function (c) { return String(c || '').toUpperCase(); }).join(' ');

      var isPermuta = rowText.indexOf('PERMUTA') >= 0;
      var isFerias = this._isFerias(rowText);
      var isNaoRealizado = rowText.indexOf('NÃO REALIZADO') >= 0 ||
                           rowText.indexOf('NAO REALIZADO') >= 0 ||
                           rowText.indexOf('NÃO REALIZADIO') >= 0 ||
                           rowText.indexOf('NAO REALIZADIO') >= 0;
      var hasFolga = rowText.indexOf('FOLGA') >= 0;
      var hasAtestado = rowText.indexOf('ATESTADO') >= 0;

      var resultadoRaw = row[cResultado] != null ? String(row[cResultado]).trim() : '';
      var resUpper = resultadoRaw.toUpperCase();
      var isExplicitApproved = resUpper.indexOf('ACOP A') >= 0 || resUpper.indexOf('ACOP - A') >= 0 || resUpper.indexOf('ACOP-A') >= 0 || resUpper.indexOf('SATISFAT') >= 0 || resUpper.indexOf('APTO') >= 0;
      var isExplicitB = resUpper.indexOf('ACOP B') >= 0 || resUpper.indexOf('ACOP - B') >= 0 || resUpper.indexOf('ACOP-B') >= 0 || resUpper === 'BOM' || resUpper === 'B';

      var motivo = isFerias ? 'Férias' :
                   (isPermuta ? 'Permuta' :
                   (hasFolga ? 'Folga' :
                   (hasAtestado ? 'Atestado' :
                   (isNaoRealizado ? 'Não Realizado' : ''))));

      if (isFerias) {
        status = 'ferias';
      } else if ((isPermuta || isNaoRealizado || hasFolga || hasAtestado) && !isExplicitApproved && !isExplicitB) {
        status = 'nr';
      }

      // Normaliza equipe
      var equipe = row[cEquipe] != null ? String(row[cEquipe]).trim().toUpperCase() : '';

      // Normaliza função
      var funcao = '';
      if (window.SESCINC && window.SESCINC.Names) {
        funcao = window.SESCINC.Names.normalizeFuncao(row[cFuncao] != null ? String(row[cFuncao]) : '');
      } else {
        funcao = row[cFuncao] != null ? String(row[cFuncao]).trim().toUpperCase() : '';
      }

      // Parse valores numéricos
      var idade = row[cIdade] != null ? parseInt(row[cIdade], 10) : null;
      if (isNaN(idade)) idade = null;

      var flexao = row[cFlexao] != null ? parseFloat(row[cFlexao]) : null;
      if (isNaN(flexao)) flexao = null;

      var abdominal = row[cAbdominal] != null ? parseFloat(row[cAbdominal]) : null;
      if (isNaN(abdominal)) abdominal = null;

      var barra = row[cBarra] != null ? parseFloat(row[cBarra]) : null;
      if (isNaN(barra)) barra = null;

      var corridaRawVal = row[cCorrida] != null ? String(row[cCorrida]).trim() : '';
      var corrida = corridaRawVal;
      var corridaSeconds = this._parseCorridaTime(corridaRawVal);

      if (status === 'nr' || status === 'ferias') {
        flexao = null;
        abdominal = null;
        barra = null;
        corrida = status === 'ferias' ? 'FÉRIAS' : 'Não Realizado';
        corridaSeconds = null;
      }

      var resultado = 'ACOP - A';

      if (isFerias) {
        resultado = 'Férias';
      } else if (status === 'nr') {
        resultado = 'Não Realizado';
      } else if (resultadoRaw) {
        var lowerRes = resultadoRaw.toLowerCase();
        if (lowerRes.indexOf('permuta') >= 0 || lowerRes === 'nr' || lowerRes.indexOf('não realizado') >= 0 || lowerRes.indexOf('nao realizado') >= 0) {
          resultado = 'Não Realizado';
          status = 'nr';
        } else if (lowerRes.indexOf('insatisf') >= 0 || lowerRes === 'b' || lowerRes === 'bom' || lowerRes.indexOf('inapto') >= 0 || ['ACOP - B', 'ACOP B', 'ACOP-B'].indexOf(resultadoRaw.toUpperCase()) >= 0) {
          resultado = 'ACOP - B';
        } else if (lowerRes.indexOf('evolu') >= 0) {
          resultado = 'Em evolução';
        } else if (lowerRes.indexOf('férias') >= 0 || lowerRes.indexOf('ferias') >= 0) {
          resultado = 'Férias';
          status = 'ferias';
        } else {
          resultado = 'ACOP - A';
        }
      } else if (corridaSeconds !== null && corridaSeconds > 240) {
        // Fallback apenas quando a planilha não informa o Resultado.
        resultado = 'Em evolução';
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
        idade: idade,
        flexao: flexao,
        abdominal: abdominal,
        barra: barra,
        corrida: corrida,
        corridaSeconds: corridaSeconds,
        resultado: resultado,
        status: status,
        motivo: motivo || null,
        mes: mesNormalized
      });
    }

    console.log('[SESCINC TAF] ' + records.length + ' registro(s) processado(s)');
    return records;
  }
};
