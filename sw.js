const CACHE_NAME = 'reto-shell-v1';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/styles/styles.css?v=c85-flexfix',
  '/styles/fuentes/nunito.css',
  '/styles/fuentes/nunito-300.woff2',
  '/scripts/reto-panel-prefs.js?v=c01-0f3ddb54',
  '/scripts/reto-panel.js?v=c04-f73a0fa9',
  '/scripts/reto-debug.js?v=c25-5ac10ea0',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png'
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

  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      url.pathname.indexOf('/api/') === 0 ||
      url.pathname === '/direccion-del-sitio.txt') return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(function (response) {
      if (response.ok) {
        var copia = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copia);
        });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (guardada) {
        return guardada || caches.match('/offline.html');
      });
    }));
    return;
  }

  event.respondWith(caches.match(request).then(function (guardada) {
    if (guardada) return guardada;
    return fetch(request).then(function (response) {
      if (response.ok && response.type === 'basic') {
        var copia = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copia);
        });
      }
      return response;
    });
  }));
});