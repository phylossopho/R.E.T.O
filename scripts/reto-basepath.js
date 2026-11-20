/* =========================================================================
   R.E.T.O. - Utilidad de Base Path (GitHub Pages / subdirectorios)
   -------------------------------------------------------------------------
   Detecta automáticamente el prefijo de la URL base (ej: /R.E.T.O/ en GitHub Pages)
   y proporciona funciones para construir URLs correctas.
   ========================================================================= */
(function (window) {
  'use strict';

  // Detectar base path al cargar
  // En GitHub Pages: https://usuario.github.io/REPO/ -> basePath = '/REPO/'
  // En localhost: http://localhost:8000/ -> basePath = '/'
  // En subdirectorio: https://dominio.com/subdir/ -> basePath = '/subdir/'
  function detectarBasePath() {
    var path = window.location.pathname;
    // Si estamos en GitHub Pages (usuario.github.io/repo/), el primer segmento es el repo
    // En desarrollo local, suele ser '/'
    var match = path.match(/^(\/[^\/]+)\//);
    if (match && window.location.hostname.includes('github.io')) {
      return match[1] + '/'; // ej: '/R.E.T.O/'
    }
    // Para otros casos, usar el path hasta el último slash si no es raíz
    if (path !== '/') {
      var parts = path.split('/').filter(Boolean);
      if (parts.length > 0) {
        // Heurística: si el primer segmento parece un nombre de repo (contiene punto, guión, etc)
        // o si estamos en github.io, usar el primer segmento
        if (window.location.hostname.includes('github.io')) {
          return '/' + parts[0] + '/';
        }
      }
    }
    return '/';
  }

  var BASE_PATH = detectarBasePath();

  // Funciones helper para construir URLs correctas
  function url(path) {
    // path puede ser relativo (datos/archivo.json) o absoluto (/api/...)
    if (!path) return BASE_PATH;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
      return path; // URL absoluta externa
    }
    if (path.startsWith('/')) {
      // Ruta absoluta del sitio -> anteponer BASE_PATH
      return BASE_PATH + path.slice(1);
    }
    // Ruta relativa -> anteponer BASE_PATH
    return BASE_PATH + path;
  }

  function fetchUrl(path, options) {
    return fetch(url(path), options);
  }

  // Para compatibilidad con código existente que usa fetch('/api/...')
  function patchFetch() {
    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
      var urlStr = typeof input === 'string' ? input : (input && input.url) || '';
      if (urlStr.startsWith('/') && !urlStr.startsWith('//')) {
        // Solo reescribir rutas absolutas que empiezan con /
        // No tocar URLs externas (http://, https://, //)
        var newUrl = url(urlStr);
        return originalFetch.call(this, newUrl, init);
      }
      return originalFetch.apply(this, arguments);
    };
  }

  // Auto-aplicar patch al cargar (opcional, se puede llamar manualmente)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchFetch);
  } else {
    patchFetch();
  }

  // Exponer utilidades
  window.RetoBasePath = {
    BASE_PATH: BASE_PATH,
    url: url,
    fetch: fetchUrl,
    patchFetch: patchFetch,
    detectarBasePath: detectarBasePath
  };

  // Log para debug
  console.log('[RetoBasePath] BASE_PATH detectado:', BASE_PATH);

})(window);