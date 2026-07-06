/**
 * SESCINC SBGL — Módulo de Normalização de Nomes
 * Normaliza nomes e funções para cruzamento entre planilhas.
 */

window.SESCINC = window.SESCINC || {};

window.SESCINC.Names = {

  /**
   * Normaliza um nome: uppercase, remove acentos, colapsa espaços.
   * @param {string} name — Nome a normalizar
   * @returns {string} — Nome normalizado
   */
  normalize: function (name) {
    if (!name || typeof name !== 'string') return '';

    var result = name.trim().toUpperCase();

    // Remove pontos finais e extras
    result = result.replace(/\.+$/g, '');
    result = result.replace(/\s+/g, ' ').trim();

    // NFD decompose e remove diacríticos (acentos)
    if (typeof result.normalize === 'function') {
      result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    // Colapsa espaços múltiplos
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  },

  /**
   * Normaliza nomes de função com base nas variações reais encontradas.
   * @param {string} funcao — Função original
   * @returns {string} — Função normalizada
   */
  normalizeFuncao: function (funcao) {
    if (!funcao || typeof funcao !== 'string') return '';

    var f = funcao.trim().toUpperCase();
    // Remove pontos
    f = f.replace(/\./g, '');
    // Remove espaços extras
    f = f.replace(/\s+/g, ' ').trim();
    // Remove hífens cercados por espaços
    f = f.replace(/\s*-\s*/g, '-');

    // ─── OC ───
    if (f === 'OC') return 'OC';

    // ─── BA-MC ───
    if (/^BA-?MC$/.test(f) || f === 'BA MC' || f === 'BAMC') return 'BA-MC';

    // ─── BA-LR ───
    if (/^BA-?LR$/.test(f) || f === 'BA LR' || f === 'BALR') return 'BA-LR';

    // ─── BA-RE ───
    if (/^BA-?RE$/.test(f) || f === 'BA RE' || f === 'BARE') return 'BA-RE';

    // ─── BA-CE ───
    if (/^BA-?CE$/.test(f) || f === 'BA CE' || f === 'BACE') return 'BA-CE';

    // ─── BA-MA ───
    if (/^BA-?MA$/.test(f) || f === 'BA MA' || f === 'BAMA') return 'BA-MA';

    // ─── BA2 (antes de BA simples) ───
    // Variações: BA2, BA-2, BA-02, BA 2, BA II
    if (/^BA-?0?2$/.test(f) || f === 'BA 2' || f === 'BA II') return 'BA2';

    // ─── BA (simples) ───
    if (f === 'BA') return 'BA';

    // Retorna o valor limpo caso não se encaixe em nenhum padrão
    return f;
  },

  /**
   * Calcula a distância de Levenshtein entre duas strings.
   * @param {string} a
   * @param {string} b
   * @returns {number} — Distância de edição
   */
  levenshtein: function (a, b) {
    if (!a || !b) return Math.max((a || '').length, (b || '').length);

    var la = a.length;
    var lb = b.length;

    // Matriz de distância
    var matrix = [];

    for (var i = 0; i <= la; i++) {
      matrix[i] = [i];
    }
    for (var j = 0; j <= lb; j++) {
      matrix[0][j] = j;
    }

    for (var i = 1; i <= la; i++) {
      for (var j = 1; j <= lb; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,       // deleção
          matrix[i][j - 1] + 1,       // inserção
          matrix[i - 1][j - 1] + cost  // substituição
        );
      }
    }

    return matrix[la][lb];
  },

  /**
   * Busca correspondência fuzzy para um nome entre candidatos.
   * @param {string} name — Nome a buscar
   * @param {string[]} candidates — Lista de candidatos
   * @param {number} [threshold=0.75] — Limiar mínimo de similaridade
   * @returns {{ match: string, similarity: number }|null}
   */
  fuzzyMatch: function (name, candidates, threshold) {
    if (typeof threshold === 'undefined') threshold = 0.75;
    if (!name || !candidates || candidates.length === 0) return null;

    var normalizedName = this.normalize(name);
    var bestMatch = null;
    var bestSimilarity = 0;

    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      var normalizedCandidate = this.normalize(candidate);
      var maxLen = Math.max(normalizedName.length, normalizedCandidate.length);

      if (maxLen === 0) continue;

      var distance = this.levenshtein(normalizedName, normalizedCandidate);
      var similarity = 1 - (distance / maxLen);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = candidate;
      }
    }

    if (bestSimilarity >= threshold) {
      return { match: bestMatch, similarity: bestSimilarity };
    }

    return null;
  },

  /**
   * Constrói mapa de colaboradores a partir dos registros TAF e TP-EPR.
   * @param {Object[]} tafRecords — Registros do TAF
   * @param {Object[]} tpeprRecords — Registros do TP-EPR
   * @returns {Object} — Mapa: nome normalizado → { nome, equipe, funcao }
   */
  buildColaboradorMap: function (tafRecords, tpeprRecords) {
    var map = {};

    // Processa TAF primeiro (fonte primária de equipe)
    if (tafRecords && Array.isArray(tafRecords)) {
      for (var i = 0; i < tafRecords.length; i++) {
        var rec = tafRecords[i];
        if (!rec.nome) continue;
        var key = this.normalize(rec.nome);
        if (!map[key]) {
          map[key] = {
            nome: rec.nome,
            equipe: rec.equipe || '',
            funcao: rec.funcao || ''
          };
        }
      }
    }

    // Processa TP-EPR (complementa dados ausentes)
    if (tpeprRecords && Array.isArray(tpeprRecords)) {
      for (var i = 0; i < tpeprRecords.length; i++) {
        var rec = tpeprRecords[i];
        if (!rec.nome) continue;
        var key = this.normalize(rec.nome);
        if (!map[key]) {
          map[key] = {
            nome: rec.nome,
            equipe: rec.equipe || '',
            funcao: rec.funcao || ''
          };
        } else {
          // Preenche campos vazios
          if (!map[key].equipe && rec.equipe) map[key].equipe = rec.equipe;
          if (!map[key].funcao && rec.funcao) map[key].funcao = rec.funcao;
        }
      }
    }

    console.log('[SESCINC Names] Mapa de colaboradores construído: ' + Object.keys(map).length + ' registro(s)');
    return map;
  },

  /**
   * Enriquece registros com equipe usando o mapa de colaboradores.
   * @param {Object[]} records — Registros a enriquecer
   * @param {Object} colaboradorMap — Mapa de colaboradores
   * @returns {Object[]} — Registros enriquecidos
   */
  enrichWithEquipe: function (records, colaboradorMap) {
    if (!records || !Array.isArray(records)) return records || [];
    if (!colaboradorMap) return records;

    var self = this;
    var candidateKeys = Object.keys(colaboradorMap);

    for (var i = 0; i < records.length; i++) {
      var rec = records[i];

      // Pula se já tem equipe definida
      if (rec.equipe && rec.equipe !== '' && rec.equipe !== 'Não identificada') continue;

      if (!rec.nome) {
        rec.equipe = rec.equipe || 'Não identificada';
        continue;
      }

      var normalizedName = self.normalize(rec.nome);

      // Tentativa 1: correspondência exata
      if (colaboradorMap[normalizedName]) {
        rec.equipe = colaboradorMap[normalizedName].equipe || 'Não identificada';
        continue;
      }

      // Tentativa 2: correspondência fuzzy
      var fuzzyResult = self.fuzzyMatch(normalizedName, candidateKeys, 0.75);
      if (fuzzyResult && colaboradorMap[fuzzyResult.match]) {
        rec.equipe = colaboradorMap[fuzzyResult.match].equipe || 'Não identificada';
        console.log('[SESCINC Names] Correspondência fuzzy: "' + rec.nome + '" → "' +
          colaboradorMap[fuzzyResult.match].nome + '" (similaridade: ' +
          fuzzyResult.similarity.toFixed(2) + ')');
      } else {
        rec.equipe = 'Não identificada';
      }
    }

    return records;
  },

  /**
   * Extrai e normaliza o nome do mês a partir do nome do arquivo, da aba ou do conteúdo da planilha.
   * @param {string} fileName — Nome do arquivo
   * @param {string} sheetName — Nome da aba
   * @param {Object} [workbook] — Workbook opcional do SheetJS
   * @returns {string} — Nome do mês normalizado (ex: 'Janeiro', 'Julho')
   */
  extractMonth: function (fileName, sheetName, workbook) {
    var MONTHS_MAP = {
      'JANEIRO': 'Janeiro', 'FEVEREIRO': 'Fevereiro', 'MARÇO': 'Março', 'MARCO': 'Março',
      'ABRIL': 'Abril', 'MAIO': 'Maio', 'JUNHO': 'Junho', 'JULHO': 'Julho',
      'AGOSTO': 'Agosto', 'SETEMBRO': 'Setembro', 'OUTUBRO': 'Outubro',
      'NOVEMBRO': 'Novembro', 'DEZEMBRO': 'Dezembro'
    };

    var searchTargets = [];

    // 1. Procurar no nome do arquivo
    if (fileName) {
      searchTargets.push(fileName.toUpperCase());
    }

    // 2. Procurar no nome da aba
    if (sheetName) {
      searchTargets.push(sheetName.toUpperCase());
    }

    // 3. Procurar no conteúdo das primeiras células da planilha
    if (workbook && sheetName) {
      try {
        var sheet = workbook.Sheets[sheetName];
        if (sheet) {
          // Lê as primeiras 15 linhas e 4 colunas para procurar referências de meses
          for (var r = 1; r <= 15; r++) {
            for (var colCode = 65; colCode <= 68; colCode++) { // A to D
              var cellRef = String.fromCharCode(colCode) + r;
              var cell = sheet[cellRef];
              var val = cell ? String(cell.v || cell.w || '').toUpperCase().trim() : '';
              if (val) searchTargets.push(val);
            }
          }
        }
      } catch (e) {
        console.warn('[SESCINC Names] Erro ao escanear células para detectar mês:', e);
      }
    }

    // Varre todos os textos coletados para encontrar o primeiro mês correspondente
    var monthKeys = Object.keys(MONTHS_MAP);
    for (var t = 0; t < searchTargets.length; t++) {
      var text = searchTargets[t];
      for (var m = 0; m < monthKeys.length; m++) {
        var key = monthKeys[m];
        if (text.indexOf(key) >= 0) {
          return MONTHS_MAP[key];
        }
      }
    }

    // 4. Default: mês atual
    var date = new Date();
    var defaultMonths = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return defaultMonths[date.getMonth()];
  }
};
