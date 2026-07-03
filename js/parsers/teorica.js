/**
 * SESCINC SBGL — Parser de Avaliação Teórica
 * Detecta e analisa planilhas de avaliação teórica exportadas do Microsoft Forms.
 */

window.SESCINC = window.SESCINC || {};
window.SESCINC.Parsers = window.SESCINC.Parsers || {};

window.SESCINC.Parsers.Teorica = {

  /**
   * Detecta se o workbook é uma planilha de Avaliação Teórica.
   * @param {Object} workbook — Workbook SheetJS
   * @returns {boolean}
   */
  detect: function (workbook) {
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) return false;

    try {
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!data || data.length < 1) return false;

      // Verifica headers na Row 1 (index 0)
      var headers = (data[0] || []).map(function (h) {
        return String(h || '').toUpperCase();
      });
      var headerText = headers.join(' ');

      // Indicadores: 'Avaliação Teórica' ou 'Total de pontos'
      var hasAvaliacao = headerText.indexOf('AVALIA') >= 0 && headerText.indexOf('TEOR') >= 0;
      var hasTotalPontos = headerText.indexOf('TOTAL') >= 0 && headerText.indexOf('PONTOS') >= 0;
      // Verificações adicionais: 'Nome completo' e 'Função'
      var hasNome = headerText.indexOf('NOME') >= 0;

      return (hasAvaliacao || hasTotalPontos) && hasNome;
    } catch (e) {
      console.error('[SESCINC Teórica] Erro na detecção:', e);
      return false;
    }
  },

  /**
   * Normaliza nome do aeroporto para código ICAO.
   * @param {string} value
   * @returns {string}
   */
  _normalizeAeroporto: function (value) {
    if (!value) return 'SBGL';
    var upper = String(value).toUpperCase().trim();
    // Remove acentos para comparação
    if (typeof upper.normalize === 'function') {
      upper = upper.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    // Qualquer variação → SBGL
    if (upper.indexOf('SBGL') >= 0 || upper.indexOf('GALEAO') >= 0 ||
        upper.indexOf('GALEÃO') >= 0 || upper.indexOf('ANTONIO') >= 0 ||
        upper.indexOf('JOBIM') >= 0 || upper.indexOf('RIO') >= 0) {
      return 'SBGL';
    }
    return upper || 'SBGL';
  },

  /**
   * Extrai pontuações individuais por questão.
   * As colunas de questões começam no índice 17 e seguem em grupos de 3:
   *   [resposta, pontos, comentário]
   * Os índices de pontos são: 18, 21, 24, 27, ...
   * @param {Array} row — Linha de dados
   * @param {number} startCol — Coluna inicial (padrão: 17)
   * @returns {Object[]} — Array de { num, pontos }
   */
  _extractQuestoes: function (row, startCol) {
    if (typeof startCol === 'undefined') startCol = 17;

    var questoes = [];
    var questionNum = 1;

    // Índices de pontos: startCol + 1, startCol + 4, startCol + 7, ...
    for (var col = startCol + 1; col < row.length; col += 3) {
      var pontosVal = row[col];
      var pontos = 0;

      if (pontosVal !== null && pontosVal !== undefined && pontosVal !== '') {
        pontos = parseFloat(pontosVal);
        if (isNaN(pontos)) pontos = 0;
      }

      questoes.push({
        num: questionNum,
        pontos: pontos
      });

      questionNum++;
    }

    return questoes;
  },

  /**
   * Analisa a planilha de Avaliação Teórica.
   * @param {Object} workbook — Workbook SheetJS
   * @param {Object} [colaboradorMap] — Mapa de colaboradores para enriquecimento de equipe
   * @returns {Object[]} — Array de registros Teórica
   */
  parse: function (workbook, colaboradorMap) {
    if (!workbook) {
      console.error('[SESCINC Teórica] Workbook inválido');
      return [];
    }

    var sheetName = workbook.SheetNames[0];
    var sheet = workbook.Sheets[sheetName];
    var data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log('[SESCINC Teórica] Analisando aba "' + sheetName + '" — ' + data.length + ' linhas');

    if (!data || data.length < 2) {
      console.warn('[SESCINC Teórica] Dados insuficientes');
      return [];
    }

    // Headers na row 1 (index 0)
    var headers = data[0] || [];
    console.log('[SESCINC Teórica] ' + headers.length + ' colunas detectadas');

    // Determina índices de coluna (valores padrão do Forms export)
    var COL_ID = 0;
    var COL_NOTA = 5;         // F: Total de pontos
    var COL_NOME = 8;         // I: Nome completo
    var COL_FUNCAO = 11;      // L: Função
    var COL_AEROPORTO = 14;   // O: Aeroporto
    var COL_QUESTOES_START = 17; // R em diante: questões

    // Tenta localizar colunas pelo nome do header (fallback dinâmico)
    for (var h = 0; h < headers.length; h++) {
      var hText = String(headers[h] || '').toUpperCase();
      if (hText.indexOf('TOTAL') >= 0 && hText.indexOf('PONTOS') >= 0) COL_NOTA = h;
      if (hText.indexOf('NOME') >= 0 && hText.indexOf('COMPLETO') >= 0) COL_NOME = h;
      if (hText.indexOf('FUN') >= 0 && h > 8) COL_FUNCAO = h;
      if (hText.indexOf('AEROPORTO') >= 0) COL_AEROPORTO = h;
    }

    var records = [];

    // Dados começam na row 2 (index 1)
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length === 0) continue;

      // Nome
      var nome = row[COL_NOME] != null ? String(row[COL_NOME]).trim() : '';
      if (!nome) continue;

      // ID
      var id = row[COL_ID] != null ? parseInt(row[COL_ID], 10) : i;
      if (isNaN(id)) id = i;

      // Nota (total de pontos)
      var nota = row[COL_NOTA] != null ? parseFloat(row[COL_NOTA]) : 0;
      if (isNaN(nota)) nota = 0;

      // Função
      var funcaoOriginal = row[COL_FUNCAO] != null ? String(row[COL_FUNCAO]).trim() : '';
      var funcao = '';
      if (window.SESCINC && window.SESCINC.Names) {
        funcao = window.SESCINC.Names.normalizeFuncao(funcaoOriginal);
      } else {
        funcao = funcaoOriginal.toUpperCase();
      }

      // Aeroporto
      var aeroporto = this._normalizeAeroporto(row[COL_AEROPORTO]);

      // Questões individuais
      var questoes = this._extractQuestoes(row, COL_QUESTOES_START);

      records.push({
        id: id,
        nome: nome,
        funcao: funcao,
        funcaoOriginal: funcaoOriginal,
        aeroporto: aeroporto,
        nota: nota,
        equipe: '',  // Será preenchido pelo enriquecimento
        questoes: questoes
      });
    }

    console.log('[SESCINC Teórica] ' + records.length + ' registro(s) processado(s)');

    // Enriquece com equipe do mapa de colaboradores
    if (colaboradorMap && window.SESCINC && window.SESCINC.Names) {
      records = window.SESCINC.Names.enrichWithEquipe(records, colaboradorMap);
      console.log('[SESCINC Teórica] Registros enriquecidos com dados de equipe');
    }

    return records;
  }
};


// ─────────────────────────────────────────────────────────
// Detector de tipo unificado
// Deve ser carregado por último (após todos os parsers)
// ─────────────────────────────────────────────────────────

/**
 * Detecta automaticamente o tipo de planilha.
 * @param {Object} workbook — Workbook SheetJS
 * @returns {string|null} — 'taf', 'tpepr', 'tr', 'teorica', ou null
 */
window.SESCINC.Parsers.detectType = function (workbook) {
  if (!workbook) return null;

  if (window.SESCINC.Parsers.TAF && window.SESCINC.Parsers.TAF.detect(workbook)) {
    console.log('[SESCINC Parsers] Tipo detectado: TAF');
    return 'taf';
  }
  if (window.SESCINC.Parsers.TPEPR && window.SESCINC.Parsers.TPEPR.detect(workbook)) {
    console.log('[SESCINC Parsers] Tipo detectado: TP-EPR');
    return 'tpepr';
  }
  if (window.SESCINC.Parsers.TR && window.SESCINC.Parsers.TR.detect(workbook)) {
    console.log('[SESCINC Parsers] Tipo detectado: TR');
    return 'tr';
  }
  if (window.SESCINC.Parsers.Teorica && window.SESCINC.Parsers.Teorica.detect(workbook)) {
    console.log('[SESCINC Parsers] Tipo detectado: Avaliação Teórica');
    return 'teorica';
  }

  console.warn('[SESCINC Parsers] Tipo de planilha não reconhecido');
  return null;
};
