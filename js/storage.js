/**
 * SESCINC SBGL — Módulo de Armazenamento Local
 * Gerencia persistência de dados via localStorage com chaves prefixadas.
 */

window.SESCINC = window.SESCINC || {};

const STORAGE_KEYS = {
  taf: 'sescinc_taf',
  tpepr: 'sescinc_tpepr',
  tr: 'sescinc_tr',
  teorica: 'sescinc_teorica',
  colaboradores: 'sescinc_colaboradores'
};

window.SESCINC.STORAGE_KEYS = STORAGE_KEYS;

window.SESCINC.Storage = {

  /**
   * Salva dados no localStorage em formato JSON.
   * @param {string} key — Chave de armazenamento
   * @param {*} data — Dados a serem salvos
   */
  save: function (key, data) {
    try {
      var json = JSON.stringify(data);
      localStorage.setItem(key, json);
      console.log('[SESCINC Storage] Dados salvos em "' + key + '" (' + json.length + ' bytes)');
    } catch (e) {
      console.error('[SESCINC Storage] Erro ao salvar "' + key + '":', e);
    }
  },

  /**
   * Carrega dados do localStorage.
   * @param {string} key — Chave de armazenamento
   * @returns {*|null} — Dados parseados ou null se ausente
   */
  load: function (key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) {
        console.log('[SESCINC Storage] Chave "' + key + '" não encontrada');
        return null;
      }
      var data = JSON.parse(raw);
      console.log('[SESCINC Storage] Dados carregados de "' + key + '"');
      return data;
    } catch (e) {
      console.error('[SESCINC Storage] Erro ao carregar "' + key + '":', e);
      return null;
    }
  },

  /**
   * Remove uma chave do localStorage.
   * @param {string} key — Chave a ser removida
   */
  remove: function (key) {
    localStorage.removeItem(key);
    console.log('[SESCINC Storage] Chave "' + key + '" removida');
  },

  /**
   * Remove todas as chaves SESCINC do localStorage.
   */
  clearAll: function () {
    var keys = this.getKeys();
    keys.forEach(function (key) {
      localStorage.removeItem(key);
    });
    console.log('[SESCINC Storage] ' + keys.length + ' chave(s) SESCINC removida(s)');
  },

  /**
   * Retorna todas as chaves do localStorage que pertencem ao SESCINC.
   * @returns {string[]}
   */
  getKeys: function () {
    var result = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf('sescinc_') === 0) {
        result.push(key);
      }
    }
    return result;
  },

  /**
   * Exporta todos os dados SESCINC como um único objeto.
   * @returns {Object} — Objeto com todas as chaves e seus dados
   */
  exportAll: function () {
    var result = {};
    var keys = this.getKeys();
    var self = this;
    keys.forEach(function (key) {
      result[key] = self.load(key);
    });
    console.log('[SESCINC Storage] Exportados ' + keys.length + ' registro(s)');
    return result;
  }
};
