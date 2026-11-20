/* =========================================================================
   R.E.T.O. - Cache offline para respuestas de API
   -------------------------------------------------------------------------
   Guarda respuestas de /api/* en IndexedDB para uso offline.
   Estrategia: stale-while-revalidate (sirve cache, actualiza en background).
   ========================================================================= */
(function (window) {
  'use strict';

  var DB_NAME = 'reto-offline-cache';
  var DB_VERSION = 1;
  var STORE_NAME = 'api-responses';
  var MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
  var MAX_ENTRIES = 500;

  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    if (!window.indexedDB) return Promise.resolve(null);

    dbPromise = new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          var store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
      request.onsuccess = function (e) { resolve(e.target.result); };
      request.onerror = function () { resolve(null); };
      setTimeout(function () { if (dbPromise) resolve(null); }, 3000);
    });
    return dbPromise;
  }

  function now() { return Date.now(); }

  function isExpired(entry) {
    return entry && (now() - entry.timestamp) > MAX_AGE_MS;
  }

  function cleanOldEntries(db) {
    return new Promise(function (resolve) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      var index = store.index('timestamp');
      var countRequest = store.count();
      countRequest.onsuccess = function () {
        var total = countRequest.result;
        if (total <= MAX_ENTRIES) { resolve(); return; }
        var toDelete = total - MAX_ENTRIES;
        var cursorRequest = index.openCursor();
        var deleted = 0;
        cursorRequest.onsuccess = function (e) {
          var cursor = e.target.result;
          if (cursor && deleted < toDelete) {
            cursor.delete();
            deleted++;
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorRequest.onerror = function () { resolve(); };
      };
    });
  }

  var OfflineCache = {
    // Guardar respuesta de API
    put: function (url, response, type) {
      return openDB().then(function (db) {
        if (!db) return Promise.resolve();
        var entry = {
          url: url,
          response: response,
          type: type || 'unknown',
          timestamp: now()
        };
        return new Promise(function (resolve) {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(entry);
          tx.oncomplete = function () { resolve(); cleanOldEntries(db); };
          tx.onerror = function () { resolve(); };
        });
      });
    },

    // Obtener respuesta cacheada
    get: function (url) {
      return openDB().then(function (db) {
        if (!db) return Promise.resolve(null);
        return new Promise(function (resolve) {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var request = tx.objectStore(STORE_NAME).get(url);
          request.onsuccess = function () {
            var entry = request.result;
            if (entry && !isExpired(entry)) {
              resolve({ response: entry.response, timestamp: entry.timestamp, type: entry.type });
            } else {
              resolve(null);
            }
          };
          request.onerror = function () { resolve(null); };
        });
      });
    },

    // Obtener todas las entradas de un tipo
    getByType: function (type) {
      return openDB().then(function (db) {
        if (!db) return Promise.resolve([]);
        return new Promise(function (resolve) {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var index = tx.objectStore(STORE_NAME).index('type');
          var request = index.getAll(type);
          request.onsuccess = function () {
            var entries = (request.result || []).filter(function (e) { return !isExpired(e); });
            resolve(entries.map(function (e) { return { url: e.url, response: e.response, timestamp: e.timestamp }; }));
          };
          request.onerror = function () { resolve([]); };
        });
      });
    },

    // Limpiar cache (manual o por espacio)
    clear: function (olderThanMs) {
      var cutoff = olderThanMs ? now() - olderThanMs : 0;
      return openDB().then(function (db) {
        if (!db) return Promise.resolve();
        return new Promise(function (resolve) {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          var store = tx.objectStore(STORE_NAME);
          var cursorRequest = store.openCursor();
          cursorRequest.onsuccess = function (e) {
            var cursor = e.target.result;
            if (cursor) {
              if (cutoff === 0 || cursor.value.timestamp < cutoff) {
                cursor.delete();
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          cursorRequest.onerror = function () { resolve(); };
        });
      });
    },

    // Obtener stats del cache
    getStats: function () {
      return openDB().then(function (db) {
        if (!db) return Promise.resolve({ count: 0, types: {}, oldest: null, newest: null });
        return new Promise(function (resolve) {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var store = tx.objectStore(STORE_NAME);
          var countRequest = store.count();
          var cursorRequest = store.openCursor();
          var types = {};
          var oldest = null, newest = null;
          var processed = 0;
          cursorRequest.onsuccess = function (e) {
            var cursor = e.target.result;
            if (cursor) {
              var t = cursor.value.type || 'unknown';
              types[t] = (types[t] || 0) + 1;
              var ts = cursor.value.timestamp;
              if (!oldest || ts < oldest) oldest = ts;
              if (!newest || ts > newest) newest = ts;
              cursor.continue();
            }
          };
          cursorRequest.onerror = function () {
            countRequest.onsuccess = function () {
              resolve({ count: countRequest.result, types: types, oldest: oldest, newest: newest });
            };
          };
        });
      });
    },

    // Interceptar fetch para cache automático (stale-while-revalidate)
    installFetchInterceptor: function () {
      if (window._retoFetchIntercepted) return;
      window._retoFetchIntercepted = true;

      var originalFetch = window.fetch.bind(window);
      window.fetch = function (url, options) {
        var urlStr = typeof url === 'string' ? url : url.url;
        var isApiCall = urlStr.indexOf('/api/') === 0;

        if (!isApiCall || (options && options.method && options.method !== 'GET')) {
          return originalFetch(url, options);
        }

        // Network-first con fallback a cache
        return originalFetch(url, options).then(function (response) {
          if (response.ok) {
            var clone = response.clone();
            clone.json().then(function (data) {
              OfflineCache.put(urlStr, data, 'api').catch(function () {});
            }).catch(function () {});
          }
          return response;
        }).catch(function () {
          // Fallback a cache
          return OfflineCache.get(urlStr).then(function (cached) {
            if (cached) {
              return new Response(JSON.stringify(cached.response), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'X-Reto-Offline': 'true' }
              });
            }
            throw new Error('Offline: no cache for ' + urlStr);
          });
        };
      };
    },

    // Verificar si estamos offline
    isOffline: function () {
      return !navigator.onLine;
    },

    // Escuchar cambios de conectividad
    onConnectivityChange: function (callback) {
      window.addEventListener('online', function () { callback(true); });
      window.addEventListener('offline', function () { callback(false); });
    }
  };

  window.RetoOfflineCache = OfflineCache;

  // Auto-instalar interceptor al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      OfflineCache.installFetchInterceptor();
    });
  } else {
    OfflineCache.installFetchInterceptor();
  }

})(window);