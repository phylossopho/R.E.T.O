/* =========================================================================
   R.E.T.O. - Mahjong (solitario de fichas en pisos)

   -------------------------------------------------------------------------
   QUÉ ES
   Un montón de fichas apiladas en pisos. Se quitan de dos en dos: dos fichas
   iguales y libres. Una ficha está libre si no tiene nada encima y por lo
   menos uno de sus lados está despejado. Se gana al quitarlas todas. Fácil son
   3 pisos; medio y difícil, 4.

   -------------------------------------------------------------------------
   LA IDEA DE FONDO: NADA OBLIGA, NADA SORPRENDE, NADA CASTIGA
   Es la misma de Schulte y Secuencia, y aquí significa:

   - NO HAY RELOJ. Nadie te apura. La partida espera lo que haga falta.
   - NO SE PUEDE PERDER. Si ya no quedan parejas, el juego lo dice con una
     frase tranquila y ofrece deshacer (sin límite) o revolver las fichas, y lo
     que queda se vuelve a repartir de modo que SE PUEDA ganar.
   - AL EQUIVOCARTE NO SUENA NADA NI SE PINTA DE ROJO. Tocar una ficha tapada
     o dos que no son iguales solo se dice con palabras.
   - EL COLOR NUNCA ES LA ÚNICA PISTA. Cada cara es un dibujo, un número o una
     letra distintos; el color solo acompaña (y se repite entre caras, el
     dibujo no). Las fichas tapadas llevan rayas, no solo un color apagado.
   - TODO SE PUEDE CAMBIAR, y se ve al momento en un cuadrito de ejemplo. Hay
     "perfiles" de un clic como punto de partida, no como diagnóstico.

   -------------------------------------------------------------------------
   QUÉ VIVE EN EL SERVIDOR Y QUÉ AQUÍ
   Python (logica/mahjong.py) arma el tablero de modo que siempre se pueda
   ganar, y vuelve a repartir las caras al revolver. Lo demás vive aquí. La
   regla de "ficha libre" está en reto-mahjong-reglas.js, escrita dos veces
   (una en Python) y comprobada con test_mahjong.py.

   -------------------------------------------------------------------------
   LOS AJUSTES
   Se guardan con RetoDatos, con el prefijo "mahjong-". Los que nunca se tocan
   NO se guardan: se usa su valor de fábrica. Lo de la PANTALLA (colores,
   fuente, tamaño, luz) se escribe en <html>, y el tablero y el cuadrito del
   modal lo heredan. El valor por defecto va en el CSS, donde se usa.
   ========================================================================= */
(function () {
  'use strict';

  var API = '/api/mahjong';
  var PREFIJO = 'mahjong-';

  /* Estado offline */
  var modoOffline = false;

  function actualizarModoOffline() {
    var offline = false;   // las reglas corren en la propia página: funciona también sin internet
    if (offline !== modoOffline) {
      modoOffline = offline;
      document.documentElement.setAttribute('data-modo-offline', modoOffline ? '1' : '0');
    }
    return modoOffline;
  }

  window.addEventListener('online', function () { actualizarModoOffline(); });
  window.addEventListener('offline', function () { actualizarModoOffline(); });

  /* ---------------------------------------------------------------------
     LOS AJUSTES Y SUS VALORES DE FÁBRICA

     Salen en "fácil", con dibujos, colores seguros para daltonismo y las
     fichas tapadas marcadas con rayas: usable desde el primer clic. Lo que
     ayuda a buscar (resaltar las iguales, el piso escrito) viene apagado
     porque a otras personas les estorba; está a un clic.
     --------------------------------------------------------------------- */
  var FABRICA = {
    nivel: 'facil',
    caras: 'dibujos',
    marcar: 'on',
    iguales: 'off',
    piso: 'off',
    avance: 'on',
    paleta: 'daltonismo',
    letra: '2',
    fuente: 'nunito',
    espaciado: 'normal',
    tamano: 'ajustar',
    borde: 'off',
    luz: 'completo',
    movimiento: 'on',
    sonido: 'on',
    sonidoElegir: 'nota',
    timbre: 'sine',
    sonidoPareja: 'ding',
    sonidoFin: 'charm',
    volumen: '50',
    vibracion: 'off',
    voz: 'off'
  };

  var COLOR_FABRICA = { pantalla: '', simbolos: '' };

  /* El tamaño del dibujo o la letra dentro de la ficha, como fracción de ella
     (rel), y el de los textos del juego (texto). */
  var LETRAS = [
    { id: '1', nombre: 'Pequeña', rel: '0.28', texto: '1' },
    { id: '2', nombre: 'Mediana', rel: '0.36', texto: '1.15' },
    { id: '3', nombre: 'Grande', rel: '0.46', texto: '1.4' }
  ];

  var TAMANOS = [
    { id: 'ajustar', nombre: 'Ajustar a la pantalla',
      ayuda: 'Todo el tablero cabe en la pantalla. Las fichas nunca bajan de un tamaño que se pueda tocar.' },
    { id: 'mediano', nombre: 'Mediano',
      ayuda: 'Fichas de tamaño fijo. Si no caben, el tablero se desplaza.' },
    { id: 'grande', nombre: 'Grande',
      ayuda: 'Fichas grandes. El tablero se desplaza con el dedo o las flechas.' },
    { id: 'enorme', nombre: 'Enorme',
      ayuda: 'Fichas muy grandes, para ver muy de cerca. El tablero se desplaza.' }
  ];

  var ESPACIADOS = [
    { id: 'normal', nombre: 'Normal' },
    { id: 'amplio', nombre: 'Amplio' }
  ];

  var LUCES = [
    { id: 'completo', nombre: 'Brillo y aro',
      ayuda: 'La ficha elegida se ilumina y lleva un aro doble. La más fácil de ver.' },
    { id: 'aro', nombre: 'Solo aro',
      ayuda: 'La ficha elegida lleva el aro, pero no cambia de brillo.' },
    { id: 'suave', nombre: 'Aro fino',
      ayuda: 'Solo un aro más fino. La más tranquila.' }
  ];

  var SONIDOS = [
    { id: 'ding', nombre: 'Ding' },
    { id: 'charm', nombre: 'Charm' },
    { id: 'soft', nombre: 'Suave' }
  ];

  var TIMBRES = [
    { id: 'sine', nombre: 'Suave' },
    { id: 'triangle', nombre: 'Cálido' }
  ];

  /* LOS PERFILES. Cada uno deja puestos varios ajustes de golpe y solo toca lo
     que dice. No son un diagnóstico ni prometen nada. */
  var PERFILES = [
    { id: 'calma', nombre: 'Tranquilo',
      ayuda: 'Colores suaves, sin movimiento, sonido bajito y el nivel fácil.',
      ajustes: { nivel: 'facil', paleta: 'suave', luz: 'suave', movimiento: 'off',
                 sonido: 'on', sonidoElegir: 'nota', timbre: 'sine',
                 volumen: '25', vibracion: 'off', voz: 'off', marcar: 'on' } },
    { id: 'colores', nombre: 'Colores difíciles',
      ayuda: 'Colores que se distinguen, dibujos y bordes gruesos.',
      ajustes: { paleta: 'daltonismo', caras: 'dibujos', borde: 'on',
                 luz: 'completo', marcar: 'on' } },
    { id: 'atencion', nombre: 'Atención',
      ayuda: 'Nivel fácil, resalta las fichas iguales y deja el avance a la vista.',
      ajustes: { nivel: 'facil', iguales: 'on', marcar: 'on', avance: 'on',
                 tamano: 'ajustar' } },
    { id: 'vista', nombre: 'Ver mejor',
      ayuda: 'Fichas y dibujos grandes, mucho contraste y bordes gruesos.',
      ajustes: { tamano: 'grande', letra: '3', borde: 'on',
                 paleta: 'alto-contraste', fuente: 'atkinson', luz: 'completo' } },
    { id: 'lectura', nombre: 'Letras y números',
      ayuda: 'Números, letra abierta y más espacio entre las letras.',
      ajustes: { caras: 'numeros', fuente: 'lexend', espaciado: 'amplio',
                 letra: '3' } },
    { id: 'sinsonido', nombre: 'Sin sonido',
      ayuda: 'Todo se ve y nada suena. Vibra si tu aparato puede.',
      ajustes: { sonido: 'off', voz: 'off', vibracion: 'on', luz: 'completo' } },
    { id: 'escuchar', nombre: 'Escuchar',
      ayuda: 'Cada ficha elegida se dice en voz alta y tiene su nota.',
      ajustes: { voz: 'on', sonido: 'on', sonidoElegir: 'nota', volumen: '75' } }
  ];

  /* LOS DIBUJOS. Van en un cuadro de 24 x 24 y se pintan con el color del
     símbolo. Los primeros nueve son los mismos de Secuencia; las siluetas son
     distintas entre sí, que es lo que importa cuando los colores se parecen. */
  var DIBUJOS_SVG = {
    circulo: '<circle cx="12" cy="12" r="8.5"/>',
    cuadrado: '<rect x="4.5" y="4.5" width="15" height="15" rx="1"/>',
    triangulo: '<polygon points="12,3.5 21.5,20 2.5,20"/>',
    rombo: '<polygon points="12,2.5 21.5,12 12,21.5 2.5,12"/>',
    estrella: '<polygon points="12,2.5 14.9,8.9 21.8,9.6 16.6,14.2 18.1,21 12,17.5 5.9,21 7.4,14.2 2.2,9.6 9.1,8.9"/>',
    hexagono: '<polygon points="12,2.8 20.2,7.4 20.2,16.6 12,21.2 3.8,16.6 3.8,7.4"/>',
    cruz: '<polygon points="9,3 15,3 15,9 21,9 21,15 15,15 15,21 9,21 9,15 3,15 3,9 9,9"/>',
    pentagono: '<polygon points="12,2.8 21.4,9.6 17.8,20.6 6.2,20.6 2.6,9.6"/>',
    gota: '<path d="M12 2.8C12 2.8 5 10.6 5 15a7 7 0 0 0 14 0C19 10.6 12 2.8 12 2.8z"/>',
    corazon: '<path d="M12 20.5C5 15 3 11.5 3 8.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 9 1.5c0 3-2 6.5-9 12z"/>',
    luna: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    sol: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" fill="none" stroke-width="2"/>',
    rayo: '<polygon points="13.5,2.5 5,13.5 11,13.5 9.5,21.5 19,10 12.5,10"/>',
    anillo: '<circle cx="12" cy="12" r="7.5" fill="none" stroke-width="4"/>',
    flecha: '<polygon points="12,2.5 20.5,12 15,12 15,21.5 9,21.5 9,12 3.5,12"/>',
    casa: '<polygon points="12,3 22,11.5 19,11.5 19,21 5,21 5,11.5 2,11.5"/>',
    hoja: '<path d="M20 4C8 4 4 10 4 14a6 6 0 0 0 6 6c6 0 10-7 10-16z"/>'
  };

  /* Los tiempos: lo que dura la salida de las fichas (solo si hay movimiento). */
  var DURACION_SALIDA = 220;
  var CUANTAS_SE_GUARDAN = 8;

  var TEXTO_OSCURO = '#1a1a1a';
  var TEXTO_CLARO = '#ffffff';

  /* ---------------------------------------------------------------------
     EL ESTADO
     De una sola pieza y aquí, no repartido por el DOM.
     --------------------------------------------------------------------- */
  var cat = null;              // lo que ofrece el servidor
  var ajustes = {};
  var colores = {};
  var padColores = [];

  var todas = [];              // todas las fichas de la partida, con su cara
  var fuera = {};              // id -> true, las ya quitadas
  var pilas = [];              // [[a, b], ...] lo quitado, para deshacer
  var nivelJugado = 'facil';   // el nivel de ESTA partida
  var elegida = null;          // id de la ficha elegida
  var pistaIds = [];
  var foco = null;             // la ficha que recibe el teclado
  var pistas = 0, deshechos = 0, revueltas = 0;
  var estado = 'cargando';     // cargando | jugando | atascado | fin

  var temporizadores = [];
  var audioCtx = null;
  var cfg = null;
  var refs = {};
  var ignorarCierre = 0;

  var tableroEl, avanceCajaEl, restanEl, barraEl, accionEl, mensajeEl,
      lectorEl;

  /* ------------------------------------------------------------- utilidades */

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function limpiar(nodo) {
    while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  }

  function porId(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return lista[0];
  }

  function ficha(id) {
    for (var i = 0; i < todas.length; i++) if (todas[i].id === id) return todas[i];
    return null;
  }

  function restantes() {
    return todas.filter(function (f) { return !fuera[f.id]; });
  }

  function luminancia(hex) {
    var h = hex.replace('#', '');
    var c = [0, 2, 4].map(function (i) {
      var v = parseInt(h.substr(i, 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contraste(a, b) {
    var la = luminancia(a), lb = luminancia(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /* El texto claro u oscuro que mejor se lee sobre un color: la misma regla
     que color_de_texto() de logica/secuencia.py. Hace falta aquí para los
     colores que la persona escoge en "La mía" y para el fondo del juego. */
  function textoSobre(fondo) {
    return contraste(fondo, TEXTO_OSCURO) >= contraste(fondo, TEXTO_CLARO)
      ? TEXTO_OSCURO : TEXTO_CLARO;
  }

  function nivelActual() {
    return porId(cat.niveles, nivelJugado);
  }

  /* ------------------------------------------------------------- avisos */

  /* `mensaje()` se VE y ocupa su sitio. `avisar()` solo se ANUNCIA, para quien
     no ve. `decir()` hace las dos. */
  function avisar(texto) {
    if (lectorEl) lectorEl.textContent = texto;
  }

  function mensaje(texto) {
    if (mensajeEl) mensajeEl.textContent = texto || '';
  }

  function decir(texto) {
    mensaje(texto);
    avisar(texto);
  }

  /* ------------------------------------------------------- los ajustes */

  function cargarAjustes() {
    var tareas = Object.keys(FABRICA).map(function (clave) {
      return window.RetoDatos.obtener(PREFIJO + clave).then(function (v) {
        ajustes[clave] = (v === null || v === undefined) ? FABRICA[clave] : String(v);
      });
    });
    Object.keys(COLOR_FABRICA).forEach(function (clave) {
      tareas.push(window.RetoDatos.obtener(PREFIJO + 'color-' + clave).then(function (v) {
        colores[clave] = (v === null || v === undefined) ? COLOR_FABRICA[clave] : String(v);
      }));
    });
    tareas.push(window.RetoDatos.obtener(PREFIJO + 'colores-mios').then(function (v) {
      padColores = Array.isArray(v) ? v.filter(function (x) {
        return typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);
      }) : [];
    }));
    return Promise.all(tareas);
  }

  function guardarAjuste(clave, valor) {
    ajustes[clave] = valor;
    return window.RetoDatos.poner(PREFIJO + clave, valor);
  }

  function guardarColor(clave, valor) {
    colores[clave] = valor;
    aplicarColores();
    return window.RetoDatos.poner(PREFIJO + 'color-' + clave, valor);
  }

  function guardarPadColores() {
    return window.RetoDatos.poner(PREFIJO + 'colores-mios', padColores);
  }

  function aplicarColores() {
    var r = document.documentElement;
    if (colores.pantalla) {
      r.style.setProperty('--mj-pantalla', colores.pantalla);
      /* El texto se pone solo claro u oscuro para que se lea sobre el fondo. */
      r.style.setProperty('--mj-pantalla-texto', textoSobre(colores.pantalla));
    } else {
      r.style.removeProperty('--mj-pantalla');
      r.style.removeProperty('--mj-pantalla-texto');
    }
  }

  function aplicarForma() {
    var r = document.documentElement;
    var letra = porId(LETRAS, ajustes.letra);
    r.style.setProperty('--mj-simbolo-rel', letra.rel);
    r.style.setProperty('--mj-texto-escala', letra.texto);
    r.setAttribute('data-mj-tam', ajustes.tamano);
    r.setAttribute('data-mj-espaciado', ajustes.espaciado);
    r.setAttribute('data-mj-borde', ajustes.borde);
    r.setAttribute('data-mj-luz', ajustes.luz);
    r.setAttribute('data-mj-mov', ajustes.movimiento);
    r.setAttribute('data-mj-marcar', ajustes.marcar);
    r.setAttribute('data-mj-piso', ajustes.piso);

    r.style.setProperty('--mj-fuente', '"Nunito", system-ui, sans-serif');
    if (window.RetoFuentes) {
      window.RetoFuentes.aplicar(ajustes.fuente).then(function (f) {
        r.style.setProperty('--mj-fuente', f.css);
      }).catch(function () {});
    }
  }

  /* ------------------------------------------------------------ el sonido */

  /* El interruptor GENERAL del sitio manda siempre. */
  function sitioPermiteSonido() {
    if (!window.RetoSonido || !window.RetoSonido.preferencias) return false;
    return window.RetoSonido.preferencias().activado;
  }

  function volumen() {
    return (parseInt(ajustes.volumen, 10) || 50) / 100;
  }

  function contexto() {
    if (audioCtx) return audioCtx;
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { audioCtx = new C(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }

  /* UNA NOTA, con la entrada y la salida suaves: un tono que arranca y se
     corta de golpe suena como un chasquido, y para quien tiene sensibilidad a
     los sonidos eso es lo peor. Cada cara tiene su nota (nueve, de vuelta y
     vuelta), pero la nota NO es la única pista: es un apoyo. */
  function nota(t, ms) {
    var ctx = contexto();
    if (!ctx) return;
    var hz = cat.notas[t % cat.notas.length];
    if (!hz) return;
    try {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      var osc = ctx.createOscillator();
      var gan = ctx.createGain();
      osc.type = ajustes.timbre === 'triangle' ? 'triangle' : 'sine';
      osc.frequency.value = hz;
      var t0 = ctx.currentTime;
      var dur = Math.max(0.18, ms / 1000 - 0.04);
      var tope = Math.max(0.0002, volumen() * 0.4);
      gan.gain.setValueAtTime(0.0001, t0);
      gan.gain.exponentialRampToValueAtTime(tope, t0 + 0.02);
      gan.gain.setValueAtTime(tope, t0 + Math.max(0.02, dur - 0.06));
      gan.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gan);
      gan.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* un sonido que falla no puede romper el juego */ }
  }

  function sonidoDelSitio(clave) {
    if (!clave || clave === 'ninguno' || !window.RetoSonido) return;
    window.RetoSonido.reproducir(clave, volumen());
  }

  function sonarElegir(t) {
    if (ajustes.sonido !== 'on' || !sitioPermiteSonido()) return;
    if (ajustes.sonidoElegir === 'nota') nota(t, 320);
    else sonidoDelSitio(ajustes.sonidoElegir);
  }

  function sonarAviso(que) {
    if (ajustes.sonido !== 'on' || !sitioPermiteSonido()) return;
    sonidoDelSitio(que === 'fin' ? ajustes.sonidoFin : ajustes.sonidoPareja);
  }

  function nombreCara(t) {
    var valores = porId(cat.caras, ajustes.caras).valores;
    return valores[t] ? valores[t].nombre : 'ficha';
  }

  function hablar(texto) {
    if (ajustes.voz !== 'on' || !window.speechSynthesis ||
        !window.SpeechSynthesisUtterance) return;
    try {
      window.speechSynthesis.cancel();
      var dicho = new window.SpeechSynthesisUtterance(texto);
      dicho.lang = 'es';
      dicho.volume = Math.max(0.25, volumen());
      var vozElegida = localStorage.getItem('voz_preferida');
      if (vozElegida && window.speechSynthesis.getVoices) {
        var voices = window.speechSynthesis.getVoices() || [];
        var v = voices.find(function (voice) { return voice.name === vozElegida || voice.voiceURI === vozElegida; });
        if (v) dicho.voice = v;
      }
      window.speechSynthesis.speak(dicho);
    } catch (e) {}
  }

  function vibrar() {
    if (ajustes.vibracion !== 'on' || !navigator.vibrate) return;
    try { navigator.vibrate(40); } catch (e) {}
  }

  /* ------------------------------------------------------------- el tablero */

  /* El color de una cara. Hay nueve colores y las caras pueden ser hasta 17:
     se reparten de vuelta y vuelta, y por eso el color NUNCA basta para
     distinguir dos fichas. */
  function aspecto(t) {
    var pal = porId(cat.paletas, ajustes.paleta);
    var i = t % 9;
    if (pal.personalizable) {
      var h = padColores[i] || cat.base_personalizada[i];
      return { fondo: h, texto: textoSobre(h) };
    }
    return pal.colores[i];
  }

  function dibujarCara(t) {
    var valor = porId(cat.caras, ajustes.caras).valores[t];
    var cara = el('span', 'mj-cara');
    cara.setAttribute('aria-hidden', 'true');
    if (ajustes.caras === 'dibujos') {
      cara.innerHTML = '<svg viewBox="0 0 24 24" focusable="false" fill="currentColor" ' +
        'stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">' +
        DIBUJOS_SVG[valor.id] + '</svg>';
    } else if (ajustes.caras === 'emojis') {
      /* El emoji es un carácter, pero NO se pinta como texto: lleva sus propios
         colores y no obedece al "color de los dibujos". Va sobre un fondo claro
         (ver el CSS) para que se lea igual sobre cualquier paleta. */
      cara.classList.add('mj-cara--emoji');
      cara.textContent = valor.id;
    } else {
      cara.classList.add('mj-cara--texto');
      cara.textContent = valor.id;
    }
    return cara;
  }

  /* Crea una ficha. Sirve para el tablero de verdad (un <button>) y para el
     cuadrito del modal (un <div>): así lo que se ve ahí es lo que se ve
     jugando, y no son dos dibujos que se puedan separar. */
  function crearFicha(f, interactivo) {
    var b = el(interactivo ? 'button' : 'div', 'mj-ficha');
    if (interactivo) b.type = 'button';
    b.setAttribute('data-id', String(f.id));
    b.style.setProperty('--x', f.x);
    b.style.setProperty('--y', f.y);
    b.style.setProperty('--z', f.z);
    b.style.setProperty('--i', f.z * 1000 + f.y * 30 + f.x);

    var c = aspecto(f.t);
    if (c && c.fondo) b.style.setProperty('--mj-c', c.fondo);
    var color = colores.simbolos || (c && c.texto);
    if (color) b.style.setProperty('--mj-t', color);

    b.appendChild(dibujarCara(f.t));
    var piso = el('span', 'mj-piso', String(f.z + 1));
    piso.setAttribute('aria-hidden', 'true');
    b.appendChild(piso);
    return b;
  }

  function medidas(caja, ancho, alto, pisos) {
    caja.style.setProperty('--mj-ancho', ancho);
    caja.style.setProperty('--mj-alto', alto);
    caja.style.setProperty('--mj-pisos', pisos - 1);
  }

  function armarTablero() {
    limpiar(tableroEl);
    var n = nivelActual();
    medidas(tableroEl, n.ancho, n.alto, n.pisos);
    tableroEl.setAttribute('data-nivel', nivelJugado);
    restantes().forEach(function (f) {
      tableroEl.appendChild(crearFicha(f, true));
    });
    pintarCuadrito();
  }

  function elDeFicha(id) {
    return tableroEl.querySelector('[data-id="' + id + '"]');
  }

  /* Recorre las fichas y pone el estado de cada una. Es lo ÚNICO que se llama
     después de cada jugada: no se vuelve a armar el tablero. */
  function actualizar() {
    var rest = restantes();
    var R = window.RetoMahjongReglas;
    var ids = R.libres(rest);
    var libre = {};
    ids.forEach(function (id) { libre[id] = true; });
    var jug = R.jugadas(rest);

    if (foco === null || !libre[foco] || fuera[foco]) foco = ids.length ? ids[0] : null;

    var tipoElegida = elegida !== null && ficha(elegida) ? ficha(elegida).t : null;
    var nodos = tableroEl.querySelectorAll('.mj-ficha');
    for (var i = 0; i < nodos.length; i++) {
      var nodo = nodos[i];
      var id = Number(nodo.getAttribute('data-id'));
      if (fuera[id]) continue;
      var f = ficha(id);
      var esLibre = !!libre[id];
      var esElegida = id === elegida;
      nodo.setAttribute('data-libre', esLibre ? '1' : '0');
      if (esElegida) nodo.setAttribute('data-sel', '1'); else nodo.removeAttribute('data-sel');
      if (pistaIds.indexOf(id) >= 0) nodo.setAttribute('data-pista', '1');
      else nodo.removeAttribute('data-pista');
      var igual = ajustes.iguales === 'on' && tipoElegida !== null && esLibre &&
                  !esElegida && f.t === tipoElegida;
      if (igual) nodo.setAttribute('data-igual', '1'); else nodo.removeAttribute('data-igual');
      nodo.setAttribute('tabindex', id === foco ? '0' : '-1');
      nodo.setAttribute('aria-disabled', esLibre ? 'false' : 'true');
      nodo.setAttribute('aria-pressed', esElegida ? 'true' : 'false');
      nodo.setAttribute('aria-label', nombreCara(f.t) + ', piso ' + (f.z + 1) +
        (esLibre ? ', libre' : ', tapada') + (esElegida ? ', elegida' : ''));
    }

    pintarAvance(rest.length);

    if (estado === 'jugando' || estado === 'atascado') {
      var atascado = rest.length > 0 && jug.length === 0;
      estado = atascado ? 'atascado' : 'jugando';
      accionEl.hidden = !atascado;
      if (atascado) {
        decir('Ya no quedan parejas posibles. Puedes deshacer, o revolver las ' +
              'fichas que quedan.');
      }
    }
    return { rest: rest, jugadas: jug };
  }

  function pintarAvance(quedan) {
    var total = nivelActual().fichas;
    avanceCajaEl.hidden = ajustes.avance !== 'on';
    restanEl.textContent = quedan === 1 ? 'Queda 1 ficha' : 'Quedan ' + quedan + ' fichas';
    barraEl.style.width = Math.round(((total - quedan) / total) * 100) + '%';
  }

  function ponerFoco() {
    if (foco === null) return;
    var nodo = elDeFicha(foco);
    if (nodo) nodo.focus();
  }

  /* ----------------------------------------------------------- las jugadas */

  function limpiarTemporizadores() {
    temporizadores.forEach(function (id) { window.clearTimeout(id); });
    temporizadores = [];
  }

  /* Si hay animación o no: lo que decide el ajuste del juego, y además el
     interruptor de animaciones del sitio y el "menos movimiento" del sistema. */
  function conMovimiento() {
    if (ajustes.movimiento !== 'on') return false;
    var anim = document.documentElement.getAttribute('data-anim');
    if (anim === 'off') return false;
    var menos = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !(menos && anim !== 'on');
  }

  function sacarDelTablero(id) {
    var nodo = elDeFicha(id);
    if (!nodo) return;
    nodo.removeAttribute('tabindex');
    if (conMovimiento()) {
      nodo.setAttribute('data-saliendo', '1');
      temporizadores.push(window.setTimeout(function () {
        if (nodo.parentNode) nodo.parentNode.removeChild(nodo);
      }, DURACION_SALIDA));
    } else if (nodo.parentNode) {
      nodo.parentNode.removeChild(nodo);
    }
  }

  function seleccionar(id) {
    if (estado !== 'jugando' && estado !== 'atascado') return;
    var f = ficha(id);
    if (!f || fuera[id]) return;
    var libres = window.RetoMahjongReglas.libres(restantes());
    pistaIds = [];
    foco = id;

    if (libres.indexOf(id) < 0) {
      /* Una ficha tapada no se puede elegir. Se dice con palabras, sin sonido
         ni rojo, y la elección que hubiera se queda como estaba. */
      decir('Esa ficha está tapada. Elige una que esté libre.');
      actualizar();
      return;
    }
    if (elegida === null) {
      elegida = id;
      sonarElegir(f.t);
      hablar(nombreCara(f.t));
      vibrar();
      mensaje('');
      avisar('Elegiste ' + nombreCara(f.t) + '. Busca otra igual.');
    } else if (elegida === id) {
      elegida = null;
      avisar('Ficha soltada.');
    } else {
      var otra = ficha(elegida);
      if (otra.t === f.t) {
        quitarPareja(elegida, id);
        return;
      }
      elegida = id;
      sonarElegir(f.t);
      hablar(nombreCara(f.t));
      decir('Esas dos no son iguales. Elegiste ' + nombreCara(f.t) + '.');
    }
    actualizar();
  }

  function quitarPareja(a, b) {
    fuera[a] = true;
    fuera[b] = true;
    pilas.push([a, b]);
    elegida = null;
    pistaIds = [];
    sonarAviso('pareja');
    vibrar();
    sacarDelTablero(a);
    sacarDelTablero(b);
    var hay = document.activeElement === document.body ||
              tableroEl.contains(document.activeElement);
    var r = actualizar();
    if (r.rest.length === 0) {
      terminar();
      return;
    }
    if (estado === 'jugando') {
      mensaje('');
      avisar('Pareja quitada. ' + (r.rest.length === 1 ? 'Queda 1 ficha.' :
        'Quedan ' + r.rest.length + ' fichas.'));
    }
    if (hay) ponerFoco();
  }

  function deshacer() {
    if (estado !== 'jugando' && estado !== 'atascado') return;
    if (!pilas.length) {
      decir('No hay nada que deshacer.');
      return;
    }
    var par = pilas.pop();
    delete fuera[par[0]];
    delete fuera[par[1]];
    deshechos++;
    elegida = null;
    pistaIds = [];
    estado = 'jugando';
    accionEl.hidden = true;
    armarTablero();
    foco = par[0];
    actualizar();
    decir('Se devolvieron dos fichas.');
    ponerFoco();
  }

  /* LA PISTA. De las parejas que se pueden quitar, se propone la que deja más
     parejas disponibles después: así la pista no suele llevar a un callejón.
     No es una garantía (la garantía es la partida ganable de siempre y poder
     deshacer), solo una sugerencia sensata. */
  function mejorJugada(jugadas, rest) {
    var R = window.RetoMahjongReglas;
    var mejor = null, mejorN = -1;
    jugadas.forEach(function (j) {
      var queda = rest.filter(function (f) { return f.id !== j[0] && f.id !== j[1]; });
      var n = queda.length ? R.jugadas(queda).length : 1e9;
      if (n > mejorN) { mejorN = n; mejor = j; }
    });
    return mejor;
  }

  function pedirPista() {
    if (estado !== 'jugando' && estado !== 'atascado') return;
    var rest = restantes();
    var jug = window.RetoMahjongReglas.jugadas(rest);
    if (!jug.length) {
      decir('Ya no quedan parejas posibles. Puedes deshacer, o revolver las fichas.');
      return;
    }
    var j = mejorJugada(jug, rest);
    pistaIds = [j[0], j[1]];
    elegida = null;
    pistas++;
    foco = j[0];
    actualizar();
    decir('Pista: estas dos fichas son iguales (' + nombreCara(ficha(j[0]).t) +
          ') y están libres.');
    ponerFoco();
  }

  /* --------------------------------------------------------- el servidor */

  /* Un 404 o un 405 quieren decir lo mismo aquí: el servidor que está
     corriendo es más viejo que el juego y no conoce la ruta. */
  function pedir(ruta, cuerpo) {
    var opciones = cuerpo === undefined ? {} : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    };
    return fetch(API + ruta, opciones).then(function (r) {
      if (r.ok) return r.json();
      if (r.status === 404 || r.status === 405) {
        throw new Error('El servidor que está corriendo es más viejo que el juego. ' +
          'Ciérralo y abre servidor.cmd otra vez para que aparezca.');
      }
      throw new Error('El servidor no pudo preparar el juego (error ' + r.status + ').');
    }).catch(function (e) {
      if (e instanceof TypeError) {
        throw new Error('No se pudo hablar con el servidor. ¿Está abierto?');
      }
      throw e;
    });
  }

  function falloDeRed(e) {
    estado = 'cargando';
    accionEl.hidden = false;
    accionEl.textContent = 'Reintentar';
    accionEl.setAttribute('data-que', 'reintentar');
    decir(e.message);
  }

  function nuevaPartida() {
    limpiarTemporizadores();
    estado = 'cargando';
    accionEl.hidden = true;

    actualizarModoOffline();

    // MODO OFFLINE: usar RetoMahjong local
    if (modoOffline && window.RetoMahjong) {
      try {
        var r = window.RetoMahjong.nueva_partida(ajustes.nivel);
        todas = r.fichas;
        nivelJugado = r.nivel;
        fuera = {};
        pilas = [];
        elegida = null;
        pistaIds = [];
        foco = null;
        pistas = 0;
        deshechos = 0;
        revueltas = 0;
        estado = 'jugando';
        accionEl.textContent = 'Revolver las fichas';
        accionEl.setAttribute('data-que', 'revolver');
        armarTablero();
        actualizar();
        var n = nivelActual();
        decir('Partida nueva (offline): ' + n.nombre + ', ' + n.pisos + ' pisos y ' +
              n.fichas + ' fichas. Progreso guardado localmente.');
        return Promise.resolve();
      } catch (e) {
        console.warn('[Mahjong] Error offline nuevaPartida:', e);
        // Caer a online
      }
    }

    // MODO ONLINE
    return pedir('/nueva', { nivel: ajustes.nivel }).then(function (d) {
      todas = d.fichas;
      nivelJugado = d.nivel;
      fuera = {};
      pilas = [];
      elegida = null;
      pistaIds = [];
      foco = null;
      pistas = 0;
      deshechos = 0;
      revueltas = 0;
      estado = 'jugando';
      accionEl.textContent = 'Revolver las fichas';
      accionEl.setAttribute('data-que', 'revolver');
      armarTablero();
      actualizar();
      var n = nivelActual();
      decir('Partida nueva: ' + n.nombre + ', ' + n.pisos + ' pisos y ' +
            n.fichas + ' fichas. Quita las fichas de dos en dos.');
    }).catch(falloDeRed);
  }

  /* Vuelve a repartir las caras de lo que queda. Lo anterior ya no se puede
     deshacer: las parejas quitadas eran de otro reparto. */
  function revolver() {
    if (estado !== 'jugando' && estado !== 'atascado') return Promise.resolve();
    var rest = restantes();
    if (rest.length < 2) return Promise.resolve();

    actualizarModoOffline();

    // MODO OFFLINE: usar RetoMahjong local
    if (modoOffline && window.RetoMahjong) {
      try {
        var nuevas = window.RetoMahjong.revolver(rest);
        var nuevasMap = {};
        nuevas.forEach(function (n) { nuevasMap[n.id] = n.t; });
        todas.forEach(function (f) { if (!fuera[f.id]) f.t = nuevasMap[f.id]; });
        pilas = [];
        elegida = null;
        pistaIds = [];
        revueltas++;
        estado = 'jugando';
        accionEl.hidden = true;
        armarTablero();
        actualizar();
        decir('Las fichas se repartieron de nuevo (offline). Ahora sí hay parejas.');
        ponerFoco();
        return Promise.resolve();
      } catch (e) {
        console.warn('[Mahjong] Error offline revolver:', e);
        // Caer a online
      }
    }

    // MODO ONLINE
    return pedir('/revolver', { fichas: rest }).then(function (d) {
      var nuevas = {};
      d.fichas.forEach(function (n) { nuevas[n.id] = n.t; });
      todas.forEach(function (f) { if (!fuera[f.id]) f.t = nuevas[f.id]; });
      pilas = [];
      elegida = null;
      pistaIds = [];
      revueltas++;
      estado = 'jugando';
      accionEl.hidden = true;
      armarTablero();
      actualizar();
      decir('Las fichas se repartieron de nuevo. Ahora sí hay parejas.');
      ponerFoco();
    }).catch(function (e) { decir(e.message); });
  }

  /* --------------------------------------------------------- el final */

  function claveGanadas() { return PREFIJO + 'ganadas-' + nivelJugado; }
  function claveHistorial() { return PREFIJO + 'historial-' + nivelJugado; }

  /* Guarda que se ganó y cuántas ayudas se usaron, para contar partidas y ver
     la tendencia. No es una marca que superar: las ayudas son parte del juego. */
  function guardarResultado() {
    var ayudas = pistas + deshechos + revueltas;
    return Promise.all([
      window.RetoDatos.obtener(claveGanadas()),
      window.RetoDatos.obtener(claveHistorial())
    ]).then(function (r) {
      var ganadas = ((r[0] === null || r[0] === undefined) ? 0 : Number(r[0])) + 1;
      var lista = Array.isArray(r[1]) ? r[1] : [];
      lista.push(ayudas);
      if (lista.length > CUANTAS_SE_GUARDAN) lista = lista.slice(-CUANTAS_SE_GUARDAN);
      return Promise.all([
        window.RetoDatos.poner(claveGanadas(), ganadas),
        window.RetoDatos.poner(claveHistorial(), lista)
      ]).then(function () { return { ganadas: ganadas, lista: lista }; });
    });
  }

  function leerTendencia(lista, esta) {
    if (lista.length < 2) return '';
    var previas = lista.slice(0, -1);
    var ventana = previas.length >= 3 ? previas.slice(-3) : previas;
    var media = ventana.reduce(function (a, b) { return a + b; }, 0) / ventana.length;
    if (esta < media - 0.5) return 'Usaste menos ayudas que en tus últimas partidas.';
    if (esta > media + 0.5) return 'Esta vez usaste más ayudas que en las últimas. Para eso están.';
    return 'Usaste las mismas ayudas que en tus últimas partidas.';
  }

  function terminar() {
    estado = 'fin';
    accionEl.hidden = false;
    accionEl.textContent = 'Jugar otra vez';
    accionEl.setAttribute('data-que', 'otra');
    pintarAvance(0);
    var ayudas = pistas + deshechos + revueltas;

    sonarAviso('fin');
    guardarResultado().then(function (info) {
      var n = nivelActual();
      var lineas = ['Quitaste todas las fichas.'];
      lineas.push('Es tu partida número ' + info.ganadas + ' en el nivel ' +
                  n.nombre + '.');
      var tendencia = leerTendencia(info.lista, ayudas);
      if (tendencia) lineas.push(tendencia);
      lineas.push('Ayudas usadas: ' + ayudas + '.');
      var texto = lineas.join('\n');
      mensaje(lineas[0]);
      avisar('Ganaste. ' + texto);

      /* Si justo se abrieron los ajustes, no se apila otro aviso encima: el
         resultado ya está dicho y el botón dice "Jugar otra vez". */
      if (cfg && cfg.open) return;

      window.RetoDialogo.lista({
        titulo: '¡Lo lograste!',
        texto: texto,
        items: [
          { texto: 'Jugar otra vez', valor: 'otra' },
          { texto: 'Cambiar ajustes', valor: 'config' },
          { texto: 'Volver a los mini juegos', valor: 'volver' }
        ]
      }).then(function (elegido) {
        if (elegido === 'otra') nuevaPartida();
        else if (elegido === 'config') abrirConfig();
        else if (elegido === 'volver') window.location.href = '../mini-juegos.html';
      });
    });
  }

  /* --------------------------------------------------------- el teclado */

  /* Las flechas se mueven entre las fichas LIBRES (las tapadas no se pueden
     elegir). Se va a la más cercana en esa dirección, midiendo más la
     distancia en la dirección que se pidió que la de lado. Enter y espacio
     eligen (eso ya lo hace un <button> solo). P es la pista, U deshacer, y
     Escape suelta la ficha elegida. */
  function vecinaEnDireccion(id, tecla) {
    var rest = restantes();
    var libres = window.RetoMahjongReglas.libres(rest);
    var a = ficha(id);
    var mejor = null, mejorPuntos = 1e9;
    libres.forEach(function (otroId) {
      if (otroId === id) return;
      var b = ficha(otroId);
      var dx = b.x - a.x, dy = b.y - a.y, p;
      if (tecla === 'ArrowRight' && dx > 0) p = dx + 3 * Math.abs(dy);
      else if (tecla === 'ArrowLeft' && dx < 0) p = -dx + 3 * Math.abs(dy);
      else if (tecla === 'ArrowDown' && dy > 0) p = dy + 3 * Math.abs(dx);
      else if (tecla === 'ArrowUp' && dy < 0) p = -dy + 3 * Math.abs(dx);
      else return;
      p += (b.z !== a.z ? 0.1 : 0);
      if (p < mejorPuntos) { mejorPuntos = p; mejor = otroId; }
    });
    return mejor;
  }

  function enTeclado(e) {
    if (!cat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    var obj = e.target;
    if (obj && /^(INPUT|SELECT|TEXTAREA)$/.test(obj.tagName)) return;

    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); pedirPista(); return; }
    if (e.key === 'u' || e.key === 'U') { e.preventDefault(); deshacer(); return; }
    if (e.key === 'Escape' && elegida !== null) {
      elegida = null;
      actualizar();
      return;
    }
    var cual = obj && obj.closest && obj.closest('.mj-ficha');
    if (!cual) return;
    if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
    var destino = vecinaEnDireccion(Number(cual.getAttribute('data-id')), e.key);
    if (destino === null) return;
    e.preventDefault();
    foco = destino;
    actualizar();
    ponerFoco();
  }

  /* ============================================================ el modal
     De arriba hacia abajo: el cuadrito (lo que se está mirando), los
     perfiles, el juego, los colores, la letra, el tamaño, la luz, el sonido y
     las ayudas. TODO SE APLICA AL MOMENTO. Cambiar el nivel pide una partida
     nueva; lo demás son atributos y variables en <html> que heredan el
     tablero y el cuadrito. */

  function grupo(legenda, ayuda) {
    var fs = document.createElement('fieldset');
    fs.appendChild(el('legend', null, legenda));
    if (ayuda) fs.appendChild(el('p', 'ayuda', ayuda));
    cfg.appendChild(fs);
    return fs;
  }

  /* El cuadrito del modal, con la misma función que el tablero. Enseña una
     ficha libre, una tapada (con rayas), la elegida y una pista, para que se
     vea cada estado de verdad y no haya que imaginarlo. */
  function pintarCuadrito() {
    if (!cfg) return;
    var caja = cfg.querySelector('.mj-cuadrito-caja');
    if (!caja) return;
    limpiar(caja);
    var raiz = el('div', 'mj mj-muestra');
    raiz.setAttribute('aria-hidden', 'true');
    var tab = el('div', 'mj-tablero mj-tablero--muestra');
    medidas(tab, 8, 2, 2);
    var ejemplo = [
      { id: 0, x: 0, y: 0, z: 0, t: 0, estado: 'igual' },
      { id: 1, x: 2, y: 0, z: 0, t: 1, estado: 'tapada' },
      { id: 2, x: 4, y: 0, z: 0, t: 2, estado: 'pista' },
      { id: 3, x: 6, y: 0, z: 0, t: 0, estado: 'elegida' },
      { id: 4, x: 2, y: 0, z: 1, t: 3, estado: 'libre' }
    ];
    ejemplo.forEach(function (f) {
      var nodo = crearFicha(f, false);
      nodo.setAttribute('data-libre', f.estado === 'tapada' ? '0' : '1');
      if (f.estado === 'elegida') nodo.setAttribute('data-sel', '1');
      if (f.estado === 'pista') nodo.setAttribute('data-pista', '1');
      if (f.estado === 'igual' && ajustes.iguales === 'on') nodo.setAttribute('data-igual', '1');
      tab.appendChild(nodo);
    });
    raiz.appendChild(tab);
    caja.appendChild(raiz);
  }

  function opcionRadio(nombre, valor, texto, elegidoValor, alCambiar) {
    var op = el('label', 'opcion');
    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = nombre;
    radio.value = valor;
    if (valor === elegidoValor) radio.checked = true;
    radio.addEventListener('change', function () {
      if (this.checked) alCambiar(valor);
    });
    op.appendChild(radio);
    op.appendChild(el('span', null, texto));
    return op;
  }

  function campoRadios(padre, clave, titulo, lista, alCambiar) {
    padre.appendChild(el('p', 'editor-label', titulo));
    var ops = el('div', 'opciones');
    ops.setAttribute('role', 'radiogroup');
    ops.setAttribute('aria-label', titulo);
    var hayAyuda = lista.some(function (o) { return o.ayuda; });
    var ayuda = hayAyuda ? el('p', 'ayuda') : null;
    function textoAyuda() {
      if (ayuda) ayuda.textContent = porId(lista, ajustes[clave]).ayuda || '';
    }
    lista.forEach(function (o) {
      ops.appendChild(opcionRadio(PREFIJO + clave, o.id, o.nombre, ajustes[clave], function (v) {
        guardarAjuste(clave, v).then(function () {
          textoAyuda();
          if (alCambiar) alCambiar(v);
        });
      }));
    });
    padre.appendChild(ops);
    if (ayuda) { textoAyuda(); padre.appendChild(ayuda); }
  }

  function campoSelect(padre, clave, titulo, lista, alCambiar) {
    var caja = el('div', 'ajustes-sonido');
    var id = PREFIJO + 'sel-' + clave;
    var etiqueta = el('label', 'editor-label', titulo);
    etiqueta.setAttribute('for', id);
    caja.appendChild(etiqueta);
    var sel = document.createElement('select');
    sel.className = 'editor-campo';
    sel.id = id;
    lista.forEach(function (o) {
      var op = el('option', '', o.nombre);
      op.value = o.id;
      if (o.id === ajustes[clave]) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () {
      guardarAjuste(clave, this.value).then(function () {
        if (alCambiar) alCambiar(sel.value);
      });
    });
    caja.appendChild(sel);
    padre.appendChild(caja);
    return sel;
  }

  function interruptor(padre, clave, texto, explicacion, alCambiar) {
    var label = el('label', 'interruptor');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = ajustes[clave] === 'on';
    var caja = el('span', 'interruptor-caja');
    caja.setAttribute('aria-hidden', 'true');
    var rotulo = el('span', 'interruptor-texto', texto);
    rotulo.appendChild(el('span', 'ayuda', explicacion));
    input.addEventListener('change', function () {
      var v = this.checked ? 'on' : 'off';
      guardarAjuste(clave, v).then(function () { if (alCambiar) alCambiar(v); });
    });
    label.appendChild(input);
    label.appendChild(caja);
    label.appendChild(rotulo);
    padre.appendChild(label);
    return input;
  }

  /* Un campo de color: la rueda y, al lado, el hexadecimal. El texto sirve
     para pegar un color de otra parte y, si `permiteVacio`, para dejarlo vacío
     y volver al del tema. */
  function filaColor(id, titulo, valor, permiteVacio, alCambiar) {
    var campo = el('div', 'ajustes-campo');
    var etiqueta = el('label', '', titulo);
    etiqueta.setAttribute('for', id);
    campo.appendChild(etiqueta);
    var fila = el('div', 'ajustes-color-fila');

    var rueda = el('input', 'ajustes-color-rueda');
    rueda.type = 'color';
    rueda.id = id;
    rueda.value = valor || '#ffffff';

    var hex = el('input', 'editor-campo ajustes-color-hex');
    hex.type = 'text';
    hex.maxLength = 7;
    hex.spellcheck = false;
    hex.value = valor || '';
    if (permiteVacio) hex.placeholder = 'del tema';
    hex.setAttribute('aria-label', titulo + ' en código hexadecimal');

    function cambia(v) {
      var nuevo = (v === '' || v === null) ? '' : String(v).trim().toLowerCase();
      if (nuevo === '' && !permiteVacio) return;
      /* Un "#ff" mal escrito se guardaría y el color se rompería en silencio. */
      if (nuevo && !/^#[0-9a-f]{6}$/.test(nuevo)) return;
      rueda.value = nuevo || '#ffffff';
      hex.value = nuevo;
      alCambiar(nuevo);
    }
    rueda.addEventListener('input', function () { cambia(this.value); });
    hex.addEventListener('change', function () { cambia(this.value); });

    fila.appendChild(rueda);
    fila.appendChild(hex);
    campo.appendChild(fila);
    return campo;
  }

  function pintarMuestras(caja) {
    limpiar(caja);
    for (var i = 0; i < 9; i++) {
      var c = aspecto(i);
      var m = el('span', 'mj-muestra-color');
      if (c && c.fondo) m.style.background = c.fondo;
      caja.appendChild(m);
    }
  }

  function pintarPersonal() {
    var caja = refs.personal;
    if (!caja) return;
    limpiar(caja);
    var pal = porId(cat.paletas, ajustes.paleta);
    caja.hidden = !pal.personalizable;
    if (!pal.personalizable) return;
    for (var i = 0; i < 9; i++) {
      (function (i) {
        var actual = padColores[i] || cat.base_personalizada[i];
        caja.appendChild(filaColor(PREFIJO + 'color-cara-' + i, 'Color ' + (i + 1),
          actual, false, function (nuevo) {
            if (!padColores.length) padColores = cat.base_personalizada.slice();
            padColores[i] = nuevo;
            guardarPadColores().then(function () {
              refrescarFichas();
              pintarMuestras(refs.muestras);
            });
          }));
      })(i);
    }
  }

  /* Cuando cambia cómo se VE una ficha (cara, color, símbolos) pero no la
     partida: se arma de nuevo el tablero y se repinta el estado. */
  function refrescarFichas() {
    if (!todas.length) return;
    armarTablero();
    actualizar();
  }

  function armarConfig() {
    if (cfg) return;
    var esteCfg = document.createElement('dialog');
    cfg = esteCfg;
    cfg.className = 'dialogo mj-config';
    cfg.setAttribute('aria-labelledby', 'mj-cfg-titulo');
    refs = {};

    var titulo = el('h2', 'dialogo-titulo', 'Ajustes de Mahjong');
    titulo.id = 'mj-cfg-titulo';
    cfg.appendChild(titulo);

    /* EL CUADRITO, PRIMERO, y pegado arriba mientras se baja por los ajustes. */
    var cuadrito = el('div', 'mj-cuadrito');
    cuadrito.appendChild(el('div', 'mj-cuadrito-caja'));
    cuadrito.appendChild(el('p', 'ayuda',
      'Así se ven: una libre, una tapada (con rayas), una pista (punteada) ' +
      'y la elegida (con aro).'));
    cfg.appendChild(cuadrito);

    /* --- los perfiles */
    var gPerfiles = grupo('Perfiles',
      'Un clic deja puestos varios ajustes. Son un punto de partida: después ' +
      'cambias lo que quieras.');
    var rejilla = el('div', 'mj-perfiles');
    PERFILES.forEach(function (p) {
      var b = el('button', 'boton mj-perfil');
      b.type = 'button';
      b.appendChild(el('strong', null, p.nombre));
      b.appendChild(el('span', 'ayuda', p.ayuda));
      b.addEventListener('click', function () { aplicarPerfil(p); });
      rejilla.appendChild(b);
    });
    gPerfiles.appendChild(rejilla);

    /* --- el juego */
    var gJuego = grupo('El juego',
      'Sin reloj, y no se puede perder: siempre puedes deshacer o revolver.');
    var niveles = cat.niveles.map(function (n) {
      return { id: n.id, nombre: n.nombre + ' · ' + n.pisos + ' pisos',
               ayuda: n.ayuda };
    });
    campoRadios(gJuego, 'nivel', 'Nivel', niveles, function () { return nuevaPartida(); });
    campoRadios(gJuego, 'caras', 'Lo que lleva cada ficha', cat.caras, refrescarFichas);
    interruptor(gJuego, 'marcar', 'Marcar con rayas las fichas tapadas',
      'Así se ve cuáles se pueden elegir sin tener que probar. Apagado, todas se ven iguales.',
      aplicarForma);
    interruptor(gJuego, 'iguales', 'Resaltar las fichas iguales',
      'Al elegir una, las libres que son iguales llevan un borde de puntos. Ayuda a buscar.',
      actualizar);
    interruptor(gJuego, 'piso', 'Escribir el piso en cada ficha',
      'Un número chico en una esquina: 1 es el piso de abajo.', aplicarForma);
    interruptor(gJuego, 'avance', 'Ver cuántas fichas quedan',
      'El número y una barra. Si te pone nervioso, apágalo.', function () {
        avanceCajaEl.hidden = ajustes.avance !== 'on';
      });
    var bRevolver = el('button', 'boton', 'Revolver las fichas que quedan');
    bRevolver.type = 'button';
    bRevolver.addEventListener('click', function () {
      if (cfg.open) { ignorarCierre++; cfg.close(); }
      revolver();
    });
    gJuego.appendChild(bRevolver);

    /* --- los colores */
    var gColores = grupo('Colores',
      'El color nunca es la única pista: cada cara lleva un dibujo, un número ' +
      'o una letra distintos. Hay nueve colores y los dibujos son hasta 17, ' +
      'así que algunos colores se repiten.');
    campoSelect(gColores, 'paleta', 'Colores', cat.paletas, function () {
      refrescarFichas();
      pintarMuestras(refs.muestras);
      pintarPersonal();
    });
    refs.muestras = el('div', 'mj-muestras');
    refs.muestras.setAttribute('aria-hidden', 'true');
    gColores.appendChild(refs.muestras);
    refs.personal = el('div', 'mj-personal');
    gColores.appendChild(refs.personal);
    pintarMuestras(refs.muestras);
    pintarPersonal();
    gColores.appendChild(filaColor(PREFIJO + 'color-simbolos', 'Color de los dibujos',
      colores.simbolos, true, function (v) { guardarColor('simbolos', v).then(refrescarFichas); }));
    gColores.appendChild(filaColor(PREFIJO + 'color-pantalla', 'Fondo del juego',
      colores.pantalla, true, function (v) { guardarColor('pantalla', v); }));
    gColores.appendChild(el('p', 'ayuda',
      'Un color vacío es el del tema. Los dibujos se ponen solos claros u ' +
      'oscuros según la ficha; aquí puedes forzar uno.'));

    /* --- la letra */
    var gLetra = grupo('La letra y los dibujos',
      'El tamaño del dibujo dentro de la ficha, los textos y la fuente.');
    campoRadios(gLetra, 'letra', 'Tamaño', LETRAS, aplicarForma);
    campoRadios(gLetra, 'espaciado', 'Espacio entre letras y líneas', ESPACIADOS,
      aplicarForma);

    var filaFuente = el('div', 'ajustes-fuente-fila');
    var sel = document.createElement('select');
    sel.className = 'editor-campo';
    sel.id = PREFIJO + 'fuente';
    var labelFuente = el('label', 'oculto-a-la-vista', 'Fuente del juego');
    labelFuente.setAttribute('for', sel.id);
    filaFuente.appendChild(labelFuente);
    filaFuente.appendChild(sel);
    var instalar = el('button', 'boton', 'Instalar una fuente');
    instalar.type = 'button';
    filaFuente.appendChild(instalar);
    gLetra.appendChild(filaFuente);
    var archivo = document.createElement('input');
    archivo.type = 'file';
    archivo.accept = '.woff2,.woff,.ttf,.otf';
    archivo.hidden = true;
    archivo.setAttribute('aria-label', 'Elegir un archivo de fuente');
    gLetra.appendChild(archivo);
    sel.addEventListener('change', function () {
      guardarAjuste('fuente', this.value).then(aplicarForma);
    });

    /* --- el tamaño */
    var gTam = grupo('Tamaño de las fichas',
      'Qué tan grandes se ven. Con tamaño fijo, el tablero se desplaza.');
    campoRadios(gTam, 'tamano', 'Tamaño', TAMANOS, aplicarForma);
    interruptor(gTam, 'borde', 'Bordes gruesos',
      'Un contorno grueso en cada ficha. Ayuda a verlas mejor.', aplicarForma);

    /* --- la luz y el movimiento */
    var gLuz = grupo('Luz y movimiento',
      'Cómo se marca la ficha elegida. Nada parpadea.');
    campoRadios(gLuz, 'luz', 'Cómo se marca', LUCES, aplicarForma);
    interruptor(gLuz, 'movimiento', 'Movimiento suave',
      'La ficha elegida sube un poco y las que se quitan se desvanecen. ' +
      'Apagado, todo se queda quieto. Si en Configuración tienes las ' +
      'animaciones apagadas, aquí tampoco hay movimiento.', aplicarForma);

    /* --- el sonido */
    var gSonido = grupo('El sonido',
      'Si en Configuración → Sonido está apagado, aquí no se oye nada. Al ' +
      'equivocarte nunca suena nada.');
    interruptor(gSonido, 'sonido', 'Activar el sonido',
      'Con esto apagado el juego no suena. El interruptor general del sitio también manda.');
    campoSelect(gSonido, 'sonidoElegir', 'Al elegir una ficha',
      [{ id: 'nota', nombre: 'Una nota distinta por cara' }]
        .concat(SONIDOS, [{ id: 'ninguno', nombre: 'Ninguno' }]),
      function () { sonarElegir(0); });
    campoSelect(gSonido, 'timbre', 'Tipo de nota', TIMBRES, function () {
      if (ajustes.sonidoElegir === 'nota') sonarElegir(0);
    });
    campoSelect(gSonido, 'sonidoPareja', 'Al quitar una pareja',
      SONIDOS.concat([{ id: 'ninguno', nombre: 'Ninguno' }]),
      function () { sonarAviso('pareja'); });
    campoSelect(gSonido, 'sonidoFin', 'Al terminar la partida',
      SONIDOS.concat([{ id: 'ninguno', nombre: 'Ninguno' }]),
      function () { sonarAviso('fin'); });

    gSonido.appendChild(el('p', 'editor-label', 'Volumen'));
    var filaVol = el('div', 'rango-lectura');
    var rango = document.createElement('input');
    rango.type = 'range';
    rango.className = 'rango';
    rango.min = '25';
    rango.max = '100';
    rango.step = '25';
    rango.value = ajustes.volumen;
    rango.setAttribute('aria-label', 'Volumen');
    var salida = el('output', 'rango-valor', ajustes.volumen + ' %');
    rango.addEventListener('input', function () {
      salida.textContent = this.value + ' %';
      ajustes.volumen = this.value;
      /* Un volumen no se ve, se oye: suena mientras se mueve. */
      sonarElegir(0);
    });
    rango.addEventListener('change', function () { guardarAjuste('volumen', this.value); });
    filaVol.appendChild(rango);
    filaVol.appendChild(salida);
    gSonido.appendChild(filaVol);

    /* --- otras ayudas */
    var gAyudas = grupo('Otras ayudas', 'Para jugar sin mirar la pantalla, o sin oír.');
    interruptor(gAyudas, 'voz', 'Decir cada ficha en voz alta',
      'Dice el dibujo, el número o la letra de la ficha que eliges.');
    interruptor(gAyudas, 'vibracion', 'Vibrar',
      'Una vibración corta al elegir y al quitar. Solo en aparatos que vibran.');

    /* --- los botones del final */
    var acciones = el('div', 'dialogo-acciones');
    var fabrica = el('button', 'boton', 'Valores de fábrica');
    fabrica.type = 'button';
    fabrica.addEventListener('click', volverALaFabrica);
    var listo = el('button', 'boton boton--principal', 'Listo');
    listo.type = 'button';
    listo.addEventListener('click', function () { cfg.close(); });
    acciones.appendChild(fabrica);
    acciones.appendChild(listo);
    cfg.appendChild(acciones);

    cfg.addEventListener('close', function () {
      if (ignorarCierre > 0) { ignorarCierre--; return; }
      if (cfg === esteCfg && estado !== 'cargando') ponerFoco();
    });
    document.body.appendChild(cfg);

    /* La lista de fuentes se pide DESPUÉS de colgar el diálogo, porque cada
       fuente se pinta con su propia letra y el <select> ya tiene que estar. */
    pintarListaFuentes(sel);
    instalar.addEventListener('click', function () { archivo.click(); });
    archivo.addEventListener('change', function () {
      var input = this;
      if (!input.files || !input.files[0] || !window.RetoFuentes) return;
      window.RetoFuentes.instalar(input.files[0]).then(function (nueva) {
        input.value = '';
        return pintarListaFuentes(sel).then(function () {
          return guardarAjuste('fuente', nueva.id).then(function () {
            sel.value = nueva.id;
            aplicarForma();
            decir('Fuente instalada: ' + nueva.nombre);
          });
        });
      }).catch(function (e) {
        input.value = '';
        decir(e.message);
      });
    });
  }

  function pintarListaFuentes(select) {
    if (!window.RetoFuentes) return Promise.resolve();
    return window.RetoFuentes.lista().then(function (lista) {
      limpiar(select);
      lista.forEach(function (f) {
        var op = el('option', '', f.nombre);
        op.value = f.id;
        if (f.id === ajustes.fuente) op.selected = true;
        select.appendChild(op);
      });
    });
  }

  /* Cierra el modal y lo arma de nuevo, para que todos los controles muestren
     lo que hay ahora. Sirve después de un perfil o de volver a la fábrica. */
  function rearmarConfig() {
    if (cfg) {
      if (cfg.open) { ignorarCierre++; cfg.close(); }
      if (cfg.parentNode) cfg.parentNode.removeChild(cfg);
      cfg = null;
    }
    abrirConfig();
  }

  function aplicarPerfil(p) {
    var cambiaNivel = p.ajustes.nivel !== undefined && p.ajustes.nivel !== nivelJugado;
    var tareas = Object.keys(p.ajustes).map(function (clave) {
      return guardarAjuste(clave, p.ajustes[clave]);
    });
    Promise.all(tareas).then(function () {
      aplicarForma();
      avanceCajaEl.hidden = ajustes.avance !== 'on';
      return cambiaNivel ? nuevaPartida() : (refrescarFichas(), null);
    }).then(function () {
      rearmarConfig();
      decir('Perfil puesto: ' + p.nombre + '. Puedes cambiar cada cosa.');
    });
  }

  function volverALaFabrica() {
    if (cfg && cfg.open) { ignorarCierre++; cfg.close(); }
    window.RetoDialogo.preguntar({
      titulo: 'Volver a los valores de fábrica',
      texto: 'Todos los ajustes de Mahjong vuelven a como venían. ' +
             'Tus partidas ganadas no se borran.',
      ok: 'Sí, volver',
      cancelar: 'No'
    }).then(function (si) {
      if (!si) { abrirConfig(); return; }
      var tareas = Object.keys(FABRICA).map(function (clave) {
        ajustes[clave] = FABRICA[clave];
        return window.RetoDatos.poner(PREFIJO + clave, null);
      });
      Object.keys(COLOR_FABRICA).forEach(function (clave) {
        colores[clave] = COLOR_FABRICA[clave];
        tareas.push(window.RetoDatos.poner(PREFIJO + 'color-' + clave, null));
      });
      padColores = [];
      tareas.push(window.RetoDatos.poner(PREFIJO + 'colores-mios', null));
      return Promise.all(tareas).then(function () {
        aplicarColores();
        aplicarForma();
        avanceCajaEl.hidden = ajustes.avance !== 'on';
        if (cfg && cfg.parentNode) cfg.parentNode.removeChild(cfg);
        cfg = null;
        return nuevaPartida();
      }).then(function () {
        abrirConfig();
        decir('Ajustes de fábrica puestos.');
      });
    });
  }

  function abrirConfig() {
    if (!cat) return;
    if (!cfg) armarConfig();
    pintarCuadrito();
    if (!cfg.open) cfg.showModal();
    var primero = cfg.querySelector('input, button');
    if (primero) primero.focus();
  }

  /* ------------------------------------------------------------- arranque */

  function iniciar() {
    tableroEl = document.getElementById('tablero');
    avanceCajaEl = document.getElementById('avance-caja');
    restanEl = document.getElementById('restan');
    barraEl = document.getElementById('barra');
    accionEl = document.getElementById('accion');
    mensajeEl = document.getElementById('mensaje');
    lectorEl = document.getElementById('lector');
    if (!tableroEl || !window.RetoDatos || !window.RetoDialogo ||
        !window.RetoMahjongReglas) return;

    tableroEl.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.mj-ficha');
      if (b && !b.getAttribute('data-saliendo')) seleccionar(Number(b.getAttribute('data-id')));
    });
    document.addEventListener('keydown', enTeclado);

    accionEl.addEventListener('click', function () {
      var que = accionEl.getAttribute('data-que');
      if (que === 'otra') nuevaPartida();
      else if (que === 'reintentar') { if (cat) nuevaPartida(); else arrancar(); }
      else revolver();
    });

    function enlazar(selector, fn) {
      var b = document.querySelector(selector);
      if (b) b.addEventListener('click', fn);
    }
    enlazar('[data-configurar]', abrirConfig);
    enlazar('[data-pista]', pedirPista);
    enlazar('[data-deshacer]', deshacer);
    enlazar('[data-reiniciar]', nuevaPartida);
    enlazar('[data-ayuda]', function () {
      window.RetoDialogo.informar({
        titulo: 'Cómo se juega',
        texto: 'Quita las fichas de dos en dos: elige dos fichas iguales que ' +
          'estén libres. Una ficha está libre si no tiene nada encima y, por ' +
          'lo menos, un lado despejado. Las tapadas llevan rayas. Ganas al ' +
          'quitarlas todas.\n\n' +
          'No hay reloj y no se puede perder. Si te equivocas no suena nada. ' +
          'El foco de la bombilla te enseña una pareja; la flecha deshace, ' +
          'sin límite. Si ya no quedan parejas, puedes revolver las fichas ' +
          'que quedan y la partida sigue siendo ganable.\n\n' +
          'Con el teclado: las flechas mueven entre las fichas libres, Enter ' +
          'o espacio eligen, P pide una pista y U deshace. En los ajustes ' +
          'cambias el nivel, los dibujos, los colores, la letra, el tamaño, el ' +
          'sonido, la voz y el movimiento.'
      });
    });

    arrancar();
  }

  /* Pide lo que el juego ofrece y los ajustes guardados, y deja lista la
     primera partida. Es aparte de iniciar() para poder reintentarlo si el
     servidor no estaba abierto, sin volver a conectar los botones. */
  function arrancar() {
    actualizarModoOffline();

    // MODO OFFLINE: usar catálogos locales
    if (modoOffline && window.RetoMahjong) {
      try {
        cat = window.RetoMahjong.catalogos();
        catalogoLocal = cat;
        return cargarAjustes().then(function () {
          aplicarColores();
          aplicarForma();
          avanceCajaEl.hidden = ajustes.avance !== 'on';
          if (window.RetoSonido && window.RetoSonido.precargar) window.RetoSonido.precargar();
          return nuevaPartida();
        });
      } catch (e) {
        console.warn('[Mahjong] Error offline catalogos:', e);
        // Caer a online
      }
    }

    // MODO ONLINE
    pedir('/catalogos').then(function (c) {
      cat = c;
      return cargarAjustes();
    }).then(function () {
      aplicarColores();
      aplicarForma();
      avanceCajaEl.hidden = ajustes.avance !== 'on';
      if (window.RetoSonido && window.RetoSonido.precargar) window.RetoSonido.precargar();
      return nuevaPartida();
    }).catch(falloDeRed);
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
