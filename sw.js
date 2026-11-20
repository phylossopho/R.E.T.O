/* =========================================================================
   R.E.T.O. - Service Worker para GitHub Pages + local
   -------------------------------------------------------------------------
   Funciona tanto en:
     - Local: http://localhost:8000/  (scope = /)
     - GitHub Pages: https://usuario.github.io/R.E.T.O_gemini/  (scope = /R.E.T.O_gemini/)
   ========================================================================= */

// Detectar base path automáticamente desde el scope del SW
var BASE_PATH = (self.registration && self.registration.scope) ? new URL(self.registration.scope).pathname : '/';
if (BASE_PATH !== '/' && !BASE_PATH.endsWith('/')) BASE_PATH += '/';

function joinPath(base, path) {
  if (!path) return base;
  if (path.startsWith('/')) path = path.slice(1);
  var baseClean = base.endsWith('/') ? base.slice(0, -1) : base;
  return baseClean + '/' + path;
}

function isApi(url) {
  return url.pathname.startsWith(joinPath(BASE_PATH, 'api/'));
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

var CACHE_NAME = 'reto-shell-v5';
var SHELL_FILES = [
  joinPath(BASE_PATH, '/'),
  joinPath(BASE_PATH, 'index.html'),
  joinPath(BASE_PATH, 'offline.html'),
  joinPath(BASE_PATH, 'manifest.webmanifest'),
  joinPath(BASE_PATH, 'styles/fuentes/nunito.css'),
  joinPath(BASE_PATH, 'styles/fuentes/nunito-300.woff2'),
  joinPath(BASE_PATH, 'pwa/icon-192.png'),
  joinPath(BASE_PATH, 'pwa/icon-512.png'),
  // Datos necesarios para lógica offline
  joinPath(BASE_PATH, 'datos/powerups.json'),
  joinPath(BASE_PATH, 'datos/powerups_textos.json')
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(SHELL_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key.indexOf('reto-shell-') === 0 && key !== CACHE_NAME;
      }).map(function (key) { return caches.delete(key); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url = new URL(request.url);

  // Solo GET, mismo origen, no API
  if (request.method !== 'GET' || !isSameOrigin(url) || isApi(url) ||
      url.pathname.endsWith('/direccion-del-sitio.txt')) return;

  // Network-first para navegación (HTML pages)
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === BASE_PATH || url.pathname === BASE_PATH.slice(0, -1)) {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response.ok) {
          var copia = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copia);
          });
        }
        return response;
      }).catch(function () {
        return caches.match(request).then(function (guardada) {
          return guardada || caches.match(joinPath(BASE_PATH, 'offline.html'));
        });
      })
    );
    return;
  }

  // Stale-while-revalidate para CSS, JS, imágenes, fuentes, datos
  event.respondWith(
    caches.match(request).then(function (guardada) {
      var fetchPromise = fetch(request).then(function (networkResponse) {
        if (networkResponse.ok && networkResponse.type === 'basic') {
          var copia = networkResponse.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copia);
          });
        }
        return networkResponse;
      }).catch(function () {
        // Fallback si offline
        return guardada;
      });

      return guardada || fetchPromise;
    })
  );
});