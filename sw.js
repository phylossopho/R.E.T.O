const CACHE_NAME = 'reto-shell-v2';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/styles/fuentes/nunito.css',
  '/styles/fuentes/nunito-300.woff2',
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

  // Network-first for navigation (HTML pages)
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
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
          return guardada || caches.match('/offline.html');
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for CSS, JS, and other assets
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
        // Fallback if offline
        return guardada;
      });

      return guardada || fetchPromise;
    })
  );
});
