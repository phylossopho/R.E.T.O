/* =========================================================================
   R.E.T.O. - Escucha de depuracion
   -------------------------------------------------------------------------
   Se inyecta en todas las paginas. Escucha de forma pasiva todo lo que
   ocurre: navegacion, clics, teclado, escritura, scroll, foco, errores de
   JavaScript, recursos que fallan al cargar (CSS/JS/imagenes), peticiones
   fetch/XHR y todo lo que se escriba en la consola.

   No muestra interfaz. Se extrae con Ctrl+Alt+4 del teclado numerico.
   Con ?debug=1 en la URL muestra un contador de eventos.

   API manual (desde la consola del navegador):
     RetoDebug.buscar('lo que sospecho')   declara la falla que persigo
     RetoDebug.nota('texto')               anota algo a mano
     RetoDebug.evento('nombre', datos)     registra un evento propio
     RetoDebug.ver()                       imprime el informe en consola
     RetoDebug.copiar()                    copia el informe
     RetoDebug.mostrar()                   abre el informe en pantalla
     RetoDebug.limpiar()                   vacia el historial
   ========================================================================= */
(function () {
  'use strict';

  var CLAVE = 'reto_debug_historial';
  var MAX = 800;
  var LIMITE = 400;

  /* ---------------------------------------------------------------- utils */

  function guardar(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch (e) {}
  }

  function leer(clave) {
    try { return localStorage.getItem(clave); } catch (e) { return null; }
  }

  function comoTexto(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (v instanceof Error) return v.message;
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  function recortar(s, n) {
    s = comoTexto(s);
    return s.length > n ? s.slice(0, n) + '...' : s;
  }

  function hora() {
    return new Date().toISOString().slice(11, 23);
  }

  /* --------------------------------------------------------- selectores */

  // Ruta CSS legible: dice exactamente que se oprimio o donde se escribio.
  function rutaCss(el) {
    if (!el || el.nodeType !== 1) return '?';
    var partes = [];
    var actual = el;
    while (actual && actual.nodeType === 1 && partes.length < 5) {
      var parte = actual.tagName.toLowerCase();
      if (actual.id) {
        partes.unshift(parte + '#' + actual.id);
        break;
      }
      var clases = (actual.getAttribute('class') || '').trim();
      if (clases) parte += '.' + clases.split(/\s+/)[0];
      var padre = actual.parentElement;
      if (padre) {
        var gemelos = [];
        for (var i = 0; i < padre.children.length; i++) {
          if (padre.children[i].tagName === actual.tagName) gemelos.push(padre.children[i]);
        }
        if (gemelos.length > 1) {
          parte += ':nth-of-type(' + (gemelos.indexOf(actual) + 1) + ')';
        }
      }
      partes.unshift(parte);
      actual = padre;
    }
    return partes.join(' > ');
  }

  function interactivo(e) {
    if (!e.target || !e.target.closest) return null;
    return e.target.closest('a,button,input,select,textarea,label,[data-tema]');
  }

  /* -------------------------------------------------------------- estado */

  var sesion = leer('reto_debug_sesion');
  if (!sesion) {
    sesion = 'ses_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    guardar('reto_debug_sesion', sesion);
  }

  var entradas = [];
  var fallos = [];
  var busqueda = null;

  function cargar() {
    var crudo = leer(CLAVE);
    if (!crudo) return;
    try {
      var d = JSON.parse(crudo);
      if (d && Array.isArray(d.entradas)) entradas = d.entradas.slice(-MAX);
      if (d && Array.isArray(d.fallos)) fallos = d.fallos.slice(-100);
    } catch (e) {}
  }

  function persistir() {
    guardar(CLAVE, JSON.stringify({
      sesion: sesion,
      entradas: entradas.slice(-MAX),
      fallos: fallos.slice(-100)
    }));
  }

  function registrar(tipo, datos) {
    entradas.push({
      h: hora(),
      t: tipo,
      p: location.pathname,
      d: datos === undefined ? null : datos
    });
    if (entradas.length > MAX) entradas.shift();
    persistir();
  }

  function anotarFalla(que, detalle) {
    for (var i = 0; i < fallos.length; i++) {
      if (fallos[i].que === que) return;
    }
    fallos.push({ que: que, detalle: detalle || '', h: hora() });
    persistir();
  }

  /* ------------------------------------------- diagnostico automatico --- */

  // Responde de una vez a las dos preguntas que mas se repiten:
  // "el CSS esta aplicando?" y "esta rota esta pagina?"
  function diagnosticar() {
    var hojas = [];
    var aplicadas = 0;
    var etiquetas = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < etiquetas.length; i++) {
      var aplicada = false;
      try { aplicada = etiquetas[i].sheet !== null; } catch (e) { aplicada = false; }
      if (aplicada) aplicadas++;
      var href = etiquetas[i].getAttribute('href');
      hojas.push(recortar(href, 80) + (aplicada ? '' : '  [NO APLICADA]'));
      if (!aplicada) anotarFalla('La hoja de estilos no se aplico', href);
    }

    var estilos = window.getComputedStyle(document.body);
    var main = document.querySelector('main');
    var nav = document.querySelector('nav');
    var pie = document.querySelector('footer');
    var mainVacio = !!main && main.innerHTML.trim() === '';

    var diag = {
      hojasCss: hojas.length,
      hojasAplicadas: aplicadas,
      fondo: estilos.backgroundColor,
      colorTexto: estilos.color,
      tamanoBase: estilos.fontSize,
      fuente: estilos.fontFamily.split(',')[0].replace(/"/g, ''),
      mainVacio: mainVacio,
      navPresente: !!nav,
      piePresente: !!pie,
      pieAlFondo: pie ? pie.getBoundingClientRect().bottom >= window.innerHeight - 2 : null,
        tema: document.documentElement.getAttribute('data-theme'),
        ventana: window.innerWidth + 'x' + window.innerHeight,
        scroll: Math.round(window.scrollY) + '/' + Math.round(document.documentElement.scrollHeight)
      };

      /* --- EL MEMORAMA, MEDIDO ---------------------------------------------
         Este tablero tiene un tamano que depende de la pantalla, y con la cuenta
         hecha a ojo ya se fallo dos veces: una por un termino de dos pixeles, y
         otra por un tope de ancho que estaba antes de tiempo y no dejaba llegar al
         suyo. Las dos se veian igual ("se ve pequeno").

         Asi que aqui se mide DE VERDAD, en el navegador: cuanto mide el tablero
         de verdad, de cuanto es su tope, y QUE es lo que lo esta frenando. Con
         eso se sabe en una mirada si la culpa es del alto, del ancho o de un
         tope, sin adivinar. */
      var memo = document.getElementById('tablero');
      if (memo && memo.classList.contains('memo-tablero')) {
        var cartasMemo = memo.querySelectorAll('.memo-carta');
        var cajaMemo = memo.getBoundingClientRect();
        var cssMemo = window.getComputedStyle(memo);
        var cartaMemo = cartasMemo[0];
        var cajaCarta = cartaMemo ? cartaMemo.getBoundingClientRect() : null;
        var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 18;
        var prop = parseFloat(cssMemo.getPropertyValue('--memo-proporcion'));
        if (isNaN(prop)) prop = 1;
        var perdida = parseFloat(cssMemo.getPropertyValue('--memo-perdida'));
        if (isNaN(perdida)) perdida = 0;
        // La MISMA cuenta que esta en el CSS, para poder compararlas.
        var anchoTeorico = (window.innerHeight - 10 * rem) * prop - (0.4 * rem) * perdida;
        diag.memorama = {
          tamanoElegido: memo.getAttribute('data-tamano'),
          cartas: cartasMemo.length,
          // lo que el navegador DIBUJO, que es lo unico que importa de verdad
          tablero: Math.round(cajaMemo.width) + 'x' + Math.round(cajaMemo.height),
          carta: cajaCarta ? Math.round(cajaCarta.width) + 'x' + Math.round(cajaCarta.height) : null,
          // lo que el CSS CALCULO, que es lo que uno cree que va a pasar
          topeCalculado: Math.round(anchoTeorico),
          maxWidthEnCss: cssMemo.maxWidth,
          proporcion: prop,
          huecos: {
            aLosLados: window.innerWidth - Math.round(cajaMemo.width),
            arribaAbajo: window.innerHeight - Math.round(cajaMemo.height)
          },
          // QUE ESTA FRENANDO EL CRECIMIENTO
          limite: (anchoTeorico < window.innerWidth - 40)
            ? 'el ALTO de la pantalla'
            : 'el ANCHO de la pantalla'
        };
        /* SI NO HAY CARTAS, MEDIR EL TABLERO NO SIRVE DE NADA. Pasa cada vez que
           se esta armando una partida nueva: el tablero se dibuja cuando contesta
           el servidor, y en el medio queda vacio y mide cualquier cosa. Medir ahi
           daria numeros que no significan nada, asi que se dice con palabras. */
        if (!cartasMemo.length) {
          diag.memorama.aviso = 'el tablero esta VACIO ahora mismo (se esta armando una partida): ' +
            'mide despues de que aparezcan las cartas';
        } else if (cajaCarta && cajaCarta.width < 44) {
          anotarFalla('Las cartas del memorama quedan en ' + Math.round(cajaCarta.width) +
            ' px, por debajo de los 44 del dedo', location.pathname);
        }
      }

    if (mainVacio) anotarFalla('La pagina tiene <main> vacio', location.pathname);
    if (hojas.length > 0 && aplicadas === 0) {
      anotarFalla('Ninguna hoja de estilos se aplico', location.pathname);
    }

    /* --- Estado de las animaciones -------------------------------------
       Faltaba poder ver si las animaciones estan encendidas de verdad. Con
       estos datos se sabe en un vistazo si el problema es que estan apagadas,
       que el sistema las pidio apagadas, o que la regla no llega. */
    var diagAnim = { atributoDataAnim: '(sin atributo)' };
    try {
      diagAnim.atributoDataAnim = document.documentElement.getAttribute('data-anim');
      diagAnim.movimientoReducidoEnElSistema =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      diagAnim.preferenciaGuardada = localStorage.getItem('animaciones');

      /* Las tarjetas se animan solo la primera vez de cada sesion. Con estos
         tres datos se ve si por eso no se animan, o si hay otro motivo:
         atributoDataAnimTarjetas = "off"  -> esta sesion ya las vio
         tarjetasForzadas = true            -> entro con ?anim=1, hay que probar
         animacionEnTarjetas = "reto-entrada ..." -> la regla LLEGO al elemento
         Este ultimo es el que de verdad importa: los tres de arriba son
         decisiones, y ese es el hecho. */
      diagAnim.atributoDataAnimTarjetas =
        document.documentElement.getAttribute('data-anim-tarjetas') || '(ninguno: la animacion corre)';
      diagAnim.tarjetasVistasEnLaSesion = sessionStorage.getItem('reto_anim_tarjetas') || 'no';
      diagAnim.tarjetasForzadas = /[?&]anim=1/.test(location.search);

      var li = document.querySelector('.rejilla > li');
      if (li) {
        var cl = window.getComputedStyle(li);
        diagAnim.animacionEnTarjetas = cl.animationName + ' / ' + cl.animationDuration;
        diagAnim.retardoEnTarjetas = cl.animationDelay;
      } else {
        diagAnim.animacionEnTarjetas = 'no hay .rejilla > li en esta pagina';
      }

      /* Si el navegador soporta transiciones entre paginas. Con esto se sabe
         de una vez si la transicion no se ve porque el navegador no la tiene o
         porque esta mal escrita.

         NO se puede comprobar con CSS.supports: ese metodo pregunta por
         declaraciones y valores ("color: red"), no por descriptores de reglas
         @, y "navigation: auto" es un descriptor de @view-transition. La
         pregunta daba false siempre, en cualquier navegador, y eso hacia
         pensar que faltaba la transicion cuando lo que faltaba era la
         pregunta. La señal real es el evento "pagereveal", que es lo que el
         navegador dispara en la pagina NUEVA cuando la transicion entre
         documentos ocurrio. */
      diagAnim.soportaViewTransition = window.CSS && CSS.supports
        ? CSS.supports('view-transition-name', 'x') : 'no se puede comprobar';
      diagAnim.transicionDePaginaDisponible = ('onpagereveal' in window);
      diagAnim.transicionSeDisparaAlEntrar =
        ('onpagereveal' in window)
          ? 'si: el navegador avisa con el evento pagereveal si la hubo'
          : 'no: este navegador no hace transiciones entre paginas';

      // getAnimations devuelve las que estan corriendo AHORA mismo: si esta en 0
      // con las animaciones encendidas, es que las reglas no estan llegando
      diagAnim.animacionesCorriendo = document.getAnimations ? document.getAnimations().length : 'no soportado';
      // transicion declarada en una tarjeta, leida del estilo calculado
      var t = document.querySelector('a.tarjeta-nav');
      if (t) {
        var ct = window.getComputedStyle(t);
        diagAnim.transicionEnTarjeta = ct.transitionProperty + ' ' + ct.transitionDuration;
      }
    } catch (e) {
      diagAnim.error = String(e).slice(0, 60);
    }
    registrar('animaciones', diagAnim);

    registrar('diagnostico', diag);
    registrar('estilos', medirEstilos());
    registrar('botones', medirBotones());
    return diag;
  }

  /* --- Que sabe el navegador de nuestras hojas de estilos ---------------
     hoja.sheet no ser null solo dice que el archivo se leyo. Hace falta
     saber si el navegador PUDO interpretar las reglas: si hay un error de
     sintaxis temprano, el lector se detiene y todo lo que viene despues se
     pierde, aunque la hoja parezca cargada. Por eso se cuenta el numero de
     reglas y se busca si la regla .fab llego a existir. */
  function medirEstilos() {
    var salida = [];
    for (var i = 0; i < document.styleSheets.length; i++) {
      var h = document.styleSheets[i];
      var entrada = { href: recortar(h.href || '(inline)', 90), reglas: null, boton: null };
      try {
        var reglas = h.cssRules;
        entrada.reglas = reglas.length;
        var encontradas = [];
        var esFuente = false;
        for (var j = 0; j < reglas.length; j++) {
          var r = reglas[j];
          // Una hoja de fuentes solo tiene reglas @font-face. Antes se leia como
          // "esta hoja no tiene NINGUNA regla de boton" y se reportaba como
          // FALLA, cuando es que nunito.css no puede tener reglas de boton: es
          // la tipografia. El aviso se comia la atencion y tapaba los fallos
          // que si importan.
          if (r.type === 5 /* CSSRule.FONT_FACE_RULE */) esFuente = true;
          var sel = r.selectorText;
          if (!sel) continue;
          if (sel.indexOf('boton') !== -1) {
            // se guarda el texto EXACTO que el navegador leyo, no el del archivo
            encontradas.push(sel + ' { position: ' + (r.style.position || '-') +
              ' }');
          }
        }
        entrada.boton = encontradas;
        entrada.esHojaDeFuente = esFuente;
        if (encontradas.length === 0 && !esFuente) {
          anotarFalla('La hoja no tiene NINGUNA regla de boton',
            (h.href || '(inline)').split('?')[0].split('/').pop());
        }
      } catch (e) {
        entrada.error = String(e).slice(0, 80);
      }
      salida.push(entrada);
    }
    return { total: document.styleSheets.length, hojas: salida };
  }

  /* --- Como ve el navegador los botones flotantes -----------------------
     Si position sale "static" en vez de "fixed", el navegador no aplico la
     regla y el boton cae en el flujo normal: aparece al pie de la pagina y se
     estira al ancho completo. Ese es el sintoma exacto que se reporto, asi que
     conviene medirlo y no deducirlo. */
  function medirBotones() {
    var salida = [];
    var elementos = document.querySelectorAll('.boton-config, .boton-volver, .fab, .fab-config, .fab-volver');
    for (var i = 0; i < elementos.length; i++) {
      var el = elementos[i];
      var c = window.getComputedStyle(el);
      var r = el.getBoundingClientRect();
      var svg = el.querySelector('svg');
      // que elemento hay ENCIMA en el centro del boton: si es otro, hay solape
      var encima = 'nadie';
      try {
        var punto = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (punto) {
          encima = punto.tagName.toLowerCase() +
            (punto.className ? '.' + String(punto.className).trim().split(/\s+/).join('.') : '');
          if (punto === el) encima = 'el mismo';
        }
      } catch (x) { encima = 'no se pudo comprobar'; }
      salida.push({
        // la clase TAL COMO LA VE EL NAVEGADOR: si el HTML esta cacheado
        // saldra el nombre viejo y sabremos que hay que recargar de verdad
        claseEnElNavegador: el.getAttribute('class') || '(sin clase)',
        ruta: rutaCss(el),
        position: c.position,
        display: c.display,
        ancho: Math.round(r.width),
        alto: Math.round(r.height),
        x: Math.round(r.left),
        y: Math.round(r.top),
        fondo: c.backgroundColor,
        sombra: c.boxShadow === 'none' ? 'ninguna' : recortar(c.boxShadow, 50),
        svgConTamano: !!svg && (!!svg.getAttribute('width') || !!svg.getAttribute('height')),
        elementoEncima: encima
      });
      if (c.position !== 'fixed') {
        anotarFalla('Un boton flotante no se posiciono (position: ' + c.position + ')',
          (el.getAttribute('class') || '').trim() + ' -> ' + Math.round(r.width) + 'px de ancho');
      }
    }
    return { cuantos: elementos.length, botones: salida };
  }

  /* ------------------------------------------------------- consola real -- */

  function capturarConsola() {
    var metodos = ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'group', 'groupEnd'];
    for (var i = 0; i < metodos.length; i++) {
      (function (nombre) {
        var original = console[nombre];
        if (typeof original !== 'function') return;
        console[nombre] = function () {
          var partes = [];
          for (var a = 0; a < arguments.length; a++) {
            partes.push(recortar(arguments[a], LIMITE));
          }
          registrar('consola.' + nombre, partes.join(' '));
          if (nombre === 'error' || nombre === 'warn') {
            anotarFalla('Consola: ' + nombre, recortar(partes.join(' '), 160));
          }
          return original.apply(console, arguments);
        };
      })(metodos[i]);
    }
  }

  /* --------------------------------------------------------- listeners -- */

  function escucharNavegacion() {
    window.addEventListener('load', function () {
      registrar('pagina:lista', {
        titulo: document.title,
        origen: document.referrer ? 'navegacion' : 'directo'
      });
      setTimeout(diagnosticar, 60);
    });

    window.addEventListener('hashchange', function () {
      registrar('navegacion:hash', { hash: location.hash });
    });

    window.addEventListener('popstate', function () {
      registrar('navegacion:atras', { url: location.pathname });
    });

    document.addEventListener('visibilitychange', function () {
      registrar('pestana', { visible: !document.hidden });
    });
  }

  function escucharInteraccion() {
    document.addEventListener('click', function (e) {
      var el = interactivo(e);
      registrar('clic', {
        en: rutaCss(el || e.target),
        texto: el ? recortar(el.textContent, 60) : '',
        href: el && el.tagName === 'A' ? el.getAttribute('href') : null,
        x: e.clientX,
        y: e.clientY
      });
    }, true);

    document.addEventListener('dblclick', function (e) {
      registrar('doble-clic', { en: rutaCss(e.target) });
    }, true);

    document.addEventListener('keydown', function (e) {
      registrar('tecla', {
        tecla: e.key,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        en: rutaCss(e.target)
      });
    }, true);

    // Se captura lo que se escribe; las contrasenas nunca se registran.
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (!el || !('value' in el)) return;
      registrar('escritura', {
        campo: rutaCss(el),
        tipo: el.type || el.tagName.toLowerCase(),
        valor: el.type === 'password' ? '(oculto)' : recortar(el.value, 80)
      });
    }, true);

    document.addEventListener('change', function (e) {
      var el = e.target;
      if (!el || !('value' in el)) return;
      registrar('cambio', {
        campo: rutaCss(el),
        valor: el.type === 'password' ? '(oculto)' : recortar(el.value, 80)
      });
    }, true);

    document.addEventListener('focusin', function (e) {
      registrar('foco', { en: rutaCss(e.target) });
    }, true);

    var ultimo = 0;
    window.addEventListener('scroll', function () {
      var y = Math.round(window.scrollY);
      if (Math.abs(y - ultimo) < 200) return;
      ultimo = y;
      registrar('scroll', { y: y, alto: document.documentElement.scrollHeight });
    }, true);

    window.addEventListener('resize', function () {
      registrar('tamano', { ventana: window.innerWidth + 'x' + window.innerHeight });
    });
  }

  function escucharErrores() {
    window.addEventListener('error', function (e) {
      // Un elemento que no carga dispara 'error' con target != window.
      if (e.target && e.target !== window && e.target.tagName) {
        var url = e.target.href || e.target.src || '(desconocido)';
        registrar('recurso:falla', { tipo: e.target.tagName, url: url });
        anotarFalla('No se cargo un recurso', e.target.tagName + ' ' + url);
        return;
      }
      var archivo = e.filename ? e.filename.split('/').pop() : '';
      registrar('error', {
        mensaje: e.message,
        archivo: archivo,
        linea: e.lineno,
        columna: e.colno
      });
      anotarFalla('Error de JavaScript', (e.message || '') + ' @' + archivo + ':' + e.lineno);
    }, true);

    window.addEventListener('unhandledrejection', function (e) {
      var razon = e.reason;
      var msg = razon && razon.message ? razon.message : recortar(razon, 200);
      registrar('promesa:rechazada', { razon: msg || '(desconocido)' });
      anotarFalla('Promesa rechazada', msg);
    }, true);
  }

  function escucharRed() {
    if (window.fetch) {
      var originalFetch = window.fetch;
      window.fetch = function (entrada) {
        var url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '';
        return originalFetch.apply(this, arguments).then(function (respuesta) {
          registrar(respuesta.ok ? 'fetch:ok' : 'fetch:error', {
            url: url,
            estado: respuesta.status
          });
          if (!respuesta.ok) anotarFalla('Peticion fallida', url + ' -> ' + respuesta.status);
          return respuesta;
        }).catch(function (err) {
          registrar('fetch:excepcion', { url: url, error: recortar(err, 200) });
          anotarFalla('Peticion sin respuesta', url);
          throw err;
        });
      };
    }

    if (window.XMLHttpRequest) {
      var abrirOriginal = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (metodo, url) {
        this.addEventListener('load', function () {
          if (this.status >= 400) {
            registrar('xhr:error', { metodo: metodo, url: url, estado: this.status });
            anotarFalla('Peticion fallida', metodo + ' ' + url + ' -> ' + this.status);
          }
        });
        return abrirOriginal.apply(this, arguments);
      };
    }
  }

  /* ------------------------------------------------------------ informe - */

  function formatea(e) {
    var d = e.d === null || e.d === undefined ? '' : '  ' + recortar(e.d, 300);
    return e.h + '  ' + e.t + d + '   @' + e.p;
  }

  // Informe de texto compacto: mucho mas comodo de pegar que un JSON enorme.
  function informe() {
    var L = [];
    var i;

    L.push('=== R.E.T.O. informe de depuracion ===');
    L.push('sesion   : ' + sesion);
    L.push('generado : ' + new Date().toISOString());
    L.push('eventos  : ' + entradas.length);
    L.push('');

    L.push('--- FALLA QUE SE BUSCA ---');
    L.push(busqueda || '(no declarada)');
    L.push('');

    L.push('--- FALLOS DETECTADOS (' + fallos.length + ') ---');
    if (fallos.length === 0) {
      L.push('(ninguno)');
    } else {
      for (i = 0; i < fallos.length; i++) {
        L.push(' * ' + fallos[i].que + '  [' + fallos[i].h + ']');
        if (fallos[i].detalle) L.push('     ' + fallos[i].detalle);
      }
    }
    L.push('');

    L.push('--- DIAGNOSTICO DE LA PAGINA ACTUAL ---');
    for (i = entradas.length - 1; i >= 0; i--) {
      if (entradas[i].t === 'diagnostico') {
        L.push(' ' + JSON.stringify(entradas[i].d));
        break;
      }
    }
    L.push('');

    L.push('--- LO QUE EL NAVEGADOR APLICO DE VERDAD ---');
    var ultEstilos = null, ultBotones = null;
    for (i = entradas.length - 1; i >= 0; i--) {
      if (!ultEstilos && entradas[i].t === 'estilos') ultEstilos = entradas[i].d;
      if (!ultBotones && entradas[i].t === 'botones') ultBotones = entradas[i].d;
      if (ultEstilos && ultBotones) break;
    }
    if (ultEstilos) {
      L.push('  hojas de estilos cargadas: ' + ultEstilos.total);
      for (i = 0; i < ultEstilos.hojas.length; i++) {
        var h = ultEstilos.hojas[i];
        L.push('    ' + h.href);
        L.push('      reglas leidas: ' + (h.reglas === null ? 'NO SE PUEDE LEER ' + (h.error || '') : h.reglas) +
               (h.esHojaDeFuente ? '   (hoja de tipografia: sin reglas de boton es normal)' : ''));
        if (h.error) L.push('      error: ' + h.error);
        // las reglas de boton TAL COMO LAS LEYO EL NAVEGADOR
        L.push('      reglas de boton encontradas: ' +
          (h.boton ? h.boton.length : 'no se pudo comprobar'));
        if (h.boton) {
          for (i = 0; i < h.boton.length; i++) L.push('        ' + h.boton[i]);
        }
      }
    } else {
      L.push('  (sin medicion de estilos)');
    }
    if (ultBotones && ultBotones.cuantos) {
      L.push('  botones flotantes en la pagina: ' + ultBotones.cuantos);
      for (i = 0; i < ultBotones.botones.length; i++) {
        var b = ultBotones.botones[i];
        L.push('    clase que ve el navegador: ' + b.claseEnElNavegador);
        L.push('      ruta: ' + b.ruta);
        L.push('      position: ' + b.position + '   display: ' + b.display);
        L.push('      mide: ' + b.ancho + ' x ' + b.alto + '   esquina en x=' + b.x + ' y=' + b.y);
        L.push('      fondo: ' + b.fondo);
        L.push('      sombra: ' + b.sombra);
        L.push('      el svg trae width/height: ' + (b.svgConTamano ? 'SI' : 'NO'));
        L.push('      elemento ENCIMA en su centro: ' + b.elementoEncima);
      }
    } else {
      L.push('  botones flotantes: ' + (ultBotones ? ultBotones.cuantos : 'sin medicion'));
    }
    L.push('');

    L.push('--- ESTADO DE LAS ANIMACIONES ---');
    var ultAnim = null;
    for (i = entradas.length - 1; i >= 0; i--) {
      if (entradas[i].t === 'animaciones') { ultAnim = entradas[i].d; break; }
    }
    if (ultAnim) {
      L.push('  atributo data-anim   : ' + ultAnim.atributoDataAnim +
             '   (off = animaciones apagadas)');
      L.push('  el sistema pide menos: ' + ultAnim.movimientoReducidoEnElSistema);
      L.push('  preferencia guardada : ' + ultAnim.preferenciaGuardada);
      L.push('  animaciones corriendo: ' + ultAnim.animacionesCorriendo);
      if (ultAnim.transicionEnTarjeta) {
        L.push('  transicion en tarjeta: ' + ultAnim.transicionEnTarjeta);
      }
      L.push('');
      L.push('  -- TARJETAS --');
      L.push('  data-anim-tarjetas   : ' + ultAnim.atributoDataAnimTarjetas);
      L.push('  ya vistas en sesion  : ' + ultAnim.tarjetasVistasEnLaSesion +
             '   (off = por eso no entran; usa ?anim=1 para forzarlas)');
      L.push('  forzadas con ?anim=1 : ' + ultAnim.tarjetasForzadas);
      L.push('  animacion que LLEGO  : ' + ultAnim.animacionEnTarjetas);
      L.push('  retardo que LLEGO    : ' + ultAnim.retardoEnTarjetas);
      L.push('');
      L.push('  -- TRANSICION DE PAGINA --');
      L.push('  el navegador la tiene: ' + ultAnim.soportaViewTransition +
             '   (false = el navegador no la soporta, no es un error del sitio)');
      L.push('  disponible en este navegador: ' + ultAnim.transicionDePaginaDisponible +
             '   (false = no habra transicion entre paginas aqui)');
      L.push('  ' + ultAnim.transicionSeDisparaAlEntrar);
    } else {
      L.push('  (sin medicion)');
    }
    L.push('');

    L.push('--- COINCIDENCIAS CON LA BUSQUEDA ---');    if (busqueda) {
      var aguja = busqueda.toLowerCase();
      var halladas = [];
      for (i = 0; i < entradas.length; i++) {
        if (JSON.stringify(entradas[i]).toLowerCase().indexOf(aguja) !== -1) halladas.push(entradas[i]);
      }
      if (halladas.length === 0) {
        L.push('(ninguna)');
      } else {
        var desde = Math.max(0, halladas.length - 40);
        for (i = halladas.length - 1; i >= desde; i--) L.push(' ' + formatea(halladas[i]));
      }
    } else {
      L.push('(sin busqueda declarada)');
    }
    L.push('');

    L.push('--- HISTORIAL COMPLETO (' + entradas.length + ') ---');
    for (i = 0; i < entradas.length; i++) L.push(formatea(entradas[i]));

    return L.join('\n');
  }

  /* ------------------------------------------------------ portapapeles -- */

  function aviso(mensaje) {
    try {
      var caja = document.createElement('div');
      caja.textContent = mensaje;
      caja.setAttribute('role', 'status');
      caja.style.cssText = 'position:fixed;left:50%;bottom:1.5rem;transform:translateX(-50%);' +
        'z-index:2147483647;background:#1b1b1b;color:#fff;padding:.7rem 1.1rem;border-radius:8px;' +
        'font:600 15px/1.3 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4);max-width:90vw';
      document.body.appendChild(caja);
      setTimeout(function () { if (caja.parentNode) caja.parentNode.removeChild(caja); }, 3200);
    } catch (e) {}
  }

  function copiar() {
    var contenido = informe();
    var n = entradas.length;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(contenido).then(
        function () { aviso('R.E.T.O. - ' + n + ' eventos copiados'); },
        function () { copiadoAlternativo(contenido, n); }
      );
    } else {
      copiadoAlternativo(contenido, n);
    }
  }

  function copiadoAlternativo(contenido, n) {
    try {
      var area = document.createElement('textarea');
      area.value = contenido;
      area.setAttribute('readonly', 'readonly');
      area.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(area);
      if (ok) aviso('R.E.T.O. - ' + n + ' eventos copiados');
      else mostrar(contenido, n);
    } catch (e) {
      mostrar(contenido, n);
    }
  }

  // Ultimo recurso: muestra el informe en pantalla para copiarlo a mano.
  function mostrar(contenido, n) {
    try {
      var marco = document.createElement('div');
      marco.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.88);' +
        'padding:1rem;display:flex;flex-direction:column;gap:.6rem';
      var barra = document.createElement('div');
      barra.style.cssText = 'color:#fff;font:600 15px system-ui,sans-serif;display:flex;' +
        'justify-content:space-between;align-items:center;gap:1rem';
      var titulo = document.createElement('span');
      titulo.textContent = 'R.E.T.O. - ' + n + ' eventos (selecciona todo y Ctrl+C)';
      var cerrar = document.createElement('button');
      cerrar.textContent = 'Cerrar';
      cerrar.style.cssText = 'font:600 15px system-ui;padding:.4rem .9rem;border:0;' +
        'border-radius:6px;cursor:pointer';
      cerrar.addEventListener('click', function () { if (marco.parentNode) marco.parentNode.removeChild(marco); });
      barra.appendChild(titulo);
      barra.appendChild(cerrar);
      var area = document.createElement('textarea');
      area.readOnly = true;
      area.value = contenido;
      area.style.cssText = 'flex:1;width:100%;font:12px/1.45 Consolas,monospace;padding:.7rem;' +
        'border:0;border-radius:8px;resize:none;background:#111;color:#ddd';
      marco.appendChild(barra);
      marco.appendChild(area);
      document.body.appendChild(marco);
      area.focus();
      area.select();
    } catch (e) {}
  }

  /* ------------------------------------------------------------- atajos - */

  // Atajo unico: Ctrl+Alt+4 del teclado numerico.
  //  -- Se compara con e.code y no con e.key porque Bloq Num cambia e.key
  //     (con Bloq Num apagado, Numpad4 entrega la flecha izquierda).
  //  -- AltGr no lo dispara por error: los caracteres de AltGr viven en la
  //     fila principal de numeros, no en el teclado numerico.
  //  -- Solo importa mientras esta pagina tiene el foco, asi que los atajos de
  //     otras aplicaciones (IntelliJ, Excel, etc.) no interfieren.
  //  -- Se exige !e.shiftKey para no chocar con Ctrl+Alt+Mayus+4.
  function atajos() {
    document.addEventListener('keydown', function (e) {
      if (!e.ctrlKey || !e.altKey || e.shiftKey || e.metaKey) return;
      if (e.code !== 'Numpad4') return;
      e.preventDefault();
      e.stopPropagation();
      registrar('atajo', { usado: 'Ctrl+Alt+Numpad4' });
      copiar();
    }, true);
  }

  /* ---------------------------------------------------------- arranque -- */

  cargar();
  capturarConsola();
  registrar('pagina:entra', { url: location.pathname, titulo: document.title });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(diagnosticar, 30); });
  } else {
    setTimeout(diagnosticar, 30);
  }
  escucharNavegacion();
  escucharInteraccion();
  escucharErrores();
  escucharRed();
  atajos();

  window.RetoDebug = {
    cargado: true,
    atajos: 'Ctrl+Alt+4 del teclado numerico',
    buscar: function (descripcion) {
      busqueda = descripcion;
      registrar('busqueda', { descripcion: descripcion });
      persistir();
      return 'Buscando: ' + descripcion;
    },
    nota: function (n) { registrar('nota', { texto: recortar(n, 300) }); },
    evento: function (nombre, datos) { registrar('evento:' + nombre, datos === undefined ? null : datos); },
    ver: function () { console.log(informe()); },
    copiar: copiar,
    mostrar: function () { mostrar(informe(), entradas.length); },
    limpiar: function () { entradas = []; fallos = []; busqueda = null; persistir(); },
    diagnostico: function () { return diagnosticar(); },
    entradas: function () { return entradas.slice(); },
    problemas: function () { return fallos.slice(); }
  };

  // Marca silenciosa: permite comprobar desde DevTools que el script cargo,
  // sin necesidad de ver nada en pantalla.
  try {
    document.documentElement.setAttribute('data-reto-debug', '1');

    // Con ?debug=1 en la URL se muestra un contador util para probar.
    if (/[?&]debug=1/.test(location.search)) {
      var insignia = document.createElement('div');
      insignia.style.cssText = 'position:fixed;right:.5rem;bottom:.5rem;z-index:2147483647;' +
        'background:#111;color:#7CFC00;font:700 12px/1.4 Consolas,monospace;padding:.4rem .6rem;' +
        'border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.5);pointer-events:none';
      document.body.appendChild(insignia);
      setInterval(function () {
        insignia.textContent = 'RETO debug: ' + entradas.length + ' ev | ' + fallos.length + ' fallos';
      }, 1000);
    }
  } catch (e) {}
})();
