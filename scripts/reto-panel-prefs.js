/* =========================================================================
   R.E.T.O. - Las preferencias del panel, antes de pintar
   -------------------------------------------------------------------------
  Este archivo se carga desde el <head> de las paginas de R.E.T.O. Lee las
  preferencias compartidas del panel antes de pintar y conecta manifest y
  service worker para que toda la plataforma pueda instalarse como PWA.

   POR QUE ESTA EN EL HEAD Y NO AL FINAL DEL BODY
   Porque el panel esta fijo en una esquina de la pantalla. Si su posicion se
   aplicara despues de pintar, se veria un instante en la posicion vieja y luego
   saltaria a la nueva, y eso se lee como un fallo de la pagina, no como un
   ajuste que se acaba de mover.

   LO QUE HACE
   Lee cuatro cosas del almacenamiento del navegador y las escribe como atributos
   del <html>. El CSS las lee de ahi (posicion, tamano y transparencia), y
   reto-panel.js lee la espera.

   Por que atributos y no estilos en linea: los atributos los puede cambiar
   cualquier hoja de estilos, y se pueden escribir reglas con ellos; un valor
   suelto en el atributo "style" no se puede cambiar desde ninguna otra regla.
   La transparencia si va como variable de CSS, porque es un valor, no un modo.

  SI NO HAY NADA GUARDADO
   Se usan los valores de ahora, que son los que ya se veian antes de que
   existiera esta pagina: abajo, mediano, 9% y 2100 ms. Es decir, quien no ha
   tocado nada no ve ningun cambio. */
(function () {
  'use strict';

  var h = document.documentElement;

  function iniciarPwa() {
    var script = document.currentScript;
    if (!script || !script.src) return;

    var raiz = new URL('../', script.src);
    function enlace(rel, ruta) {
      var elemento = document.createElement('link');
      elemento.rel = rel;
      elemento.href = new URL(ruta, raiz).href;
      document.head.appendChild(elemento);
    }
    function meta(nombre, contenido) {
      var elemento = document.querySelector('meta[name="' + nombre + '"]');
      if (!elemento) {
        elemento = document.createElement('meta');
        elemento.name = nombre;
        document.head.appendChild(elemento);
      }
      elemento.content = contenido;
    }

    enlace('manifest', 'manifest.webmanifest');
    enlace('apple-touch-icon', 'pwa/icon-192.png');
    meta('theme-color', '#16445a');
    meta('apple-mobile-web-app-capable', 'yes');
    meta('mobile-web-app-capable', 'yes');
    meta('apple-mobile-web-app-title', 'R.E.T.O.');

    function esContextoSeguro() {
      // localhost y 127.0.0.1 son seguros para desarrollo aunque usen HTTP o cert autofirmado
      var host = location.hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
      return window.isSecureContext === true;
    }

    if ('serviceWorker' in navigator && esContextoSeguro()) {
      window.addEventListener('load', function () {
        // Usar SW raíz con scope correcto (no relativo a la página)
        var basePath = location.pathname.split('/R.E.T.O/')[0] + '/R.E.T.O/';
        var baseUrl = location.origin + basePath;
        var swUrl = new URL('sw.js', baseUrl).href;
        var scope = basePath;
        navigator.serviceWorker.register(swUrl, { scope: scope }).then(function (registration) {
          registration.addEventListener('updatefound', function () {
            var installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', function () {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New update available, force reload
                    window.location.reload();
                  }
                }
              });
            }
          });
        }).catch(function (error) {
          if (window.console && console.warn) {
            console.warn('[R.E.T.O.] No se pudo registrar el modo PWA.', error);
          }
        });
      });

      var refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        // Solo recargar si YA había un controller (actualización), no en la primera carga
        if (navigator.serviceWorker.controller && !refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }

  iniciarPwa();

  var POR_DEFECTO = {
    pos: 'abajo',
    tam: 'mediano',
    op: 0.50,
    espera: 1200
  };

  var VALORES = {
    pos: ['abajo', 'arriba', 'izquierda', 'derecha'],
    tam: ['pequeno', 'mediano', 'grande'],
    animNivel: ['estandar', 'expresivo'],
    animHover: ['estandar', 'flotacion-3d', 'pulso-ludico'],
    animAccion: ['estandar', 'rebote'],
    animPanel: ['estandar', 'elastico', 'giro'],
    fondoEstilo: ['liso', 'puntos', 'diagonales'],
    fuenteUi: ['nunito', 'atkinson', 'lexend', 'opendyslexic', 'roboto-mono']
  };

  function leer(clave, defecto) {
    try { return localStorage.getItem(clave); } catch (e) { return null; }
  }

  /* Un valor guardado que no este en la lista NO se aplica. No es desconfianza:
     es que un valor raro (una copia de una version vieja, o alguien que edito el
     almacenamiento a mano) pondria el panel en un sitio que no existe y el
     atributo no coincidiria con ninguna regla, asi que el panel se quedaria sin
     posicion. Con esta comprobacion, un valor desconocido es simplemente el
     de por defecto. */
  function unoDe(clave, lista, defecto) {
    var v = leer(clave);
    return lista.indexOf(v) >= 0 ? v : defecto;
  }

  var pos = unoDe('panel_pos', VALORES.pos, POR_DEFECTO.pos);
  var tam = unoDe('panel_tam', VALORES.tam, POR_DEFECTO.tam);
  var animNivel = unoDe('anim_nivel', VALORES.animNivel, 'estandar');
  var animHover = unoDe('anim_hover', VALORES.animHover, 'estandar');
  var animAccion = unoDe('anim_accion', VALORES.animAccion, 'estandar');
  var animPanel = unoDe('anim_panel', VALORES.animPanel, 'estandar');
  var fondoEstilo = unoDe('fondo_estilo', VALORES.fondoEstilo, 'liso');
  var fuenteUi = unoDe('fuente_ui', VALORES.fuenteUi, 'nunito');

  var op = parseFloat(leer('panel_op'));
  if (isNaN(op)) op = POR_DEFECTO.op;
  // Se limita entre 0.10 y 1.00.
  op = Math.min(1.0, Math.max(0.10, op));

  var espera = parseInt(leer('panel_espera'), 10);
  if (isNaN(espera)) espera = POR_DEFECTO.espera;
  espera = Math.min(5000, Math.max(500, espera));

  h.setAttribute('data-panel-pos', pos);
  h.setAttribute('data-panel-tam', tam);
  h.setAttribute('data-panel-espera', String(espera));
  h.setAttribute('data-anim-nivel', animNivel);
  h.setAttribute('data-anim-hover', animHover);
  h.setAttribute('data-anim-accion', animAccion);
  h.setAttribute('data-anim-panel', animPanel);
  h.setAttribute('data-fondo', fondoEstilo);
  h.setAttribute('data-fuente-ui', fuenteUi);
  h.style.setProperty('--panel-op', String(op));
})();
