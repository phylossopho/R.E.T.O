/* ==========================================================================
   R.E.T.O. - Sprites de la batalla

   Los sprites viven en imagenes/sprites/<personaje>/<vista>/<estado>.webp
     personaje  mago, maga, caballero, caballera, arquero, arquera, guerrero, guerrera,
                asesino, asesina, clerigo, sacerdotiza
     vista      frente   el ADVERSARIO (ya vienen reflejados: miran al jugador, a la izquierda)
                espalda  el JUGADOR en tercera persona (miran al adversario, a la derecha)
     estado     espera · ataque · herido
   Para animar un estado con varios cuadros: espera_1.webp, espera_2.webp... (se recorren en orden).
   Para agregar un sprite basta con dejar la imagen en su carpeta: el servidor lista las carpetas
   (/api/rpg/sprites) y aqui se elige. Para convertir hojas nuevas: python _procesar_sprites.py.

   QUE PASA SI FALTA ALGO (se puede ir dibujando de a poco)
     1. falta el estado           -> se usa `espera` de esa vista
     2. falta la vista o todo     -> se usa la imagen de siempre (imagenes/<personaje>.webp), que se
                                     refleja si es del adversario, como antes

   ANIMACION (solo CSS, en el contenedor del sprite, clases spr-*)
     espera  respira (sube y baja unos pixeles)
     ataque  embiste hacia el rival y vuelve
     herido  se sacude
   Se apagan con el interruptor de animaciones del sitio y con prefers-reduced-motion; entonces solo
   cambia la pose (no hay movimiento, y la pose ya cuenta lo que pasa). Nada parpadea.

   API: window.RetoSprites
     cargar()                      -> Promise<mapa>
     preparar(raiz, opciones)      pone las poses de espera y deja los sprites listos
                                   opciones = { rival: 'mago', jugador: 'maga' }
                                   en raiz: <img data-sprite="rival"> y <img data-sprite="jugador">
     estado(raiz, quien, estado, ms)  pone una pose un momento (ms) y vuelve a espera
     resultado(raiz, acierto)      acierto: el jugador ataca y el rival queda herido; fallo: al reves
     intro(raiz)                   el rival ataca (llega una pregunta)
   ========================================================================== */
(function () {
  'use strict';

  var cache = null;
  var FPS = 4;                        // cuadros por segundo de una animacion de varios cuadros
  var VISTA_DE = { rival: 'frente', jugador: 'espalda' };

  function cargar() {
    if (cache) return cache;
    cache = fetch('/datos/sprites.json').then(function (r) { return r.ok ? r.json() : { sprites: {} }; })
      .then(function (d) { return d.sprites || {}; })
      .catch(function () { return {}; });
    return cache;
  }

  function sinMovimiento() {
    if (document.documentElement.getAttribute('data-batalla-anim') === 'off') return true;   // interruptor de la batalla (modal de la aventura)
    var anim = document.documentElement.getAttribute('data-anim');
    if (anim === 'off') return true;
    if (anim === 'on') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* Las imagenes (cuadros) de ese personaje, vista y estado, con el respaldo de `espera`. */
  function cuadros(mapa, personaje, vista, estado) {
    var v = mapa[personaje] && mapa[personaje][vista];
    if (!v) return null;
    return v[estado] || v.espera || null;
  }

  function ponerCuadros(img, urls, legacy) {
    if (img._sprTimer) { clearInterval(img._sprTimer); img._sprTimer = null; }
    var nuevo = !!(urls && urls.length);
    var lista = nuevo ? urls : [legacy.url];
    img.classList.toggle('sprite-legacy-volteado', !nuevo && !!legacy.volteado);   // solo las imagenes de siempre se reflejan
    img.setAttribute('data-sprite-origen', nuevo ? 'nuevo' : 'legacy');
    var i = 0;
    function mostrar() { var u = lista[i % lista.length]; if (img.getAttribute('src') !== u) img.setAttribute('src', u); }
    mostrar();
    if (lista.length > 1 && !sinMovimiento()) {
      img._sprTimer = setInterval(function () { i++; mostrar(); }, 1000 / FPS);
    }
  }

  function elementos(raiz, quien) { return raiz ? raiz.querySelectorAll('[data-sprite="' + quien + '"]') : []; }

  function aplicar(raiz, quien, estado) {
    var imgs = elementos(raiz, quien);
    cargar().then(function (mapa) {
      for (var k = 0; k < imgs.length; k++) {
        var img = imgs[k];
        var personaje = img.getAttribute('data-personaje');
        var legacy = { url: img.getAttribute('data-legacy'), volteado: quien === 'rival' };
        ponerCuadros(img, cuadros(mapa, personaje, VISTA_DE[quien], estado), legacy);
        var caja = img.closest('[data-sprite-caja]') || img.parentNode;
        ['espera', 'ataque', 'herido'].forEach(function (e) { caja.classList.toggle('spr-' + e, e === estado); });
        caja.classList.add('spr-caja');
        caja.setAttribute('data-sprite-estado', estado);
      }
    });
  }

  function preparar(raiz, opciones) {
    opciones = opciones || {};
    ['rival', 'jugador'].forEach(function (quien) {
      var imgs = elementos(raiz, quien);
      for (var k = 0; k < imgs.length; k++) {
        if (opciones[quien]) imgs[k].setAttribute('data-personaje', opciones[quien]);
      }
      aplicar(raiz, quien, 'espera');
    });
  }

  function estado(raiz, quien, nombre, ms) {
    aplicar(raiz, quien, nombre);
    if (ms) {
      var imgs = elementos(raiz, quien);
      if (imgs.length && imgs[0]._sprVuelta) clearTimeout(imgs[0]._sprVuelta);
      var t = setTimeout(function () { if (raiz.isConnected) aplicar(raiz, quien, 'espera'); }, ms);
      for (var k = 0; k < imgs.length; k++) imgs[k]._sprVuelta = t;
    }
  }

  function resultado(raiz, acierto) {
    if (acierto) { estado(raiz, 'jugador', 'ataque', 900); estado(raiz, 'rival', 'herido', 900); }
    else { estado(raiz, 'rival', 'ataque', 900); estado(raiz, 'jugador', 'herido', 900); }
  }

  function intro(raiz) { estado(raiz, 'rival', 'ataque', 800); }

  window.RetoSprites = { cargar: cargar, preparar: preparar, estado: estado, resultado: resultado, intro: intro };
}());
