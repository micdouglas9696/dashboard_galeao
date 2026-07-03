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
  parse: function (workbook) {
    if (!workbook) {
      console.error('[SESCINC TAF] Workbook inválido');
      return [];
    }

    var sheetName = this._findDataSheet(workbook);
    var sheet = workbook.Sheets[sheetName];
    var data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log('[SESCINC TAF] Analisando aba "' + sheetName + '" — ' + data.length + ' linhas');

    var records = [];

    // Dados começam na linha 6 (index 5)
    for (var i = 5; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length === 0) continue;

      // Colunas: A=Nome(0), B=Equipe(1), C=Função(2), D=Idade(3),
      //          E=Flexão(4), F=Abdominal(5), G=Barra(6), H=Corrida(7), I=Resultado(8)
      var nome = row[0] != null ? String(row[0]).trim() : '';

      // Pula linhas vazias, de cabeçalho ou resumo
      if (!nome || this._isSummaryRow(nome)) continue;
      if (nome.toUpperCase().indexOf('NOME') >= 0) continue;

      // Detecta status especial
      var status = 'ok';
      var rowText = row.map(function (c) { return String(c || '').toUpperCase(); }).join(' ');

      if (this._isFerias(rowText)) {
        status = 'ferias';
      }

      var corridaRaw = row[7] != null ? String(row[7]).trim() : '';
      if (corridaRaw.toUpperCase() === 'NR' || rowText.indexOf(' NR ') >= 0 || rowText.indexOf(' NR') >= 0) {
        if (status === 'ok') status = 'nr';
      }

      // Normaliza equipe
      var equipe = row[1] != null ? String(row[1]).trim().toUpperCase() : '';

      // Normaliza função
      var funcao = '';
      if (window.SESCINC && window.SESCINC.Names) {
        funcao = window.SESCINC.Names.normalizeFuncao(row[2] != null ? String(row[2]) : '');
      } else {
        funcao = row[2] != null ? String(row[2]).trim().toUpperCase() : '';
      }

      // Parse valores numéricos
      var idade = row[3] != null ? parseInt(row[3], 10) : null;
      if (isNaN(idade)) idade = null;

      var flexao = row[4] != null ? parseFloat(row[4]) : null;
      if (isNaN(flexao)) flexao = null;

      var abdominal = row[5] != null ? parseFloat(row[5]) : null;
      if (isNaN(abdominal)) abdominal = null;

      var barra = row[6] != null ? parseFloat(row[6]) : null;
      if (isNaN(barra)) barra = null;

      var corrida = row[7] != null ? String(row[7]).trim() : '';
      var corridaSeconds = this._parseCorridaTime(row[7]);

      var resultado = row[8] != null ? String(row[8]).trim() : '';

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
        status: status
      });
    }

    console.log('[SESCINC TAF] ' + records.length + ' registro(s) processado(s)');
    return records;
  }
};
