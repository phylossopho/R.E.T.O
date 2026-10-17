/* =========================================================================
   R.E.T.O. - Secuencia (memoria secuencial)

   -------------------------------------------------------------------------
   QUÉ ES
   Los botones se encienden uno tras otro y la persona los repite en el mismo
   orden. Si lo logra, la secuencia crece un paso. Entrena la memoria de
   trabajo: tener una lista corta en la cabeza el tiempo justo para usarla.

   -------------------------------------------------------------------------
   LA IDEA DE FONDO: NADA OBLIGA, NADA SORPRENDE, NADA CASTIGA
   Este juego se hizo para que lo pueda usar casi cualquiera, y eso son
   decisiones, no adornos:

   - NO HAY RELOJ. La persona decide cuándo empieza y cuándo sigue. El tiempo
     entre pasos lo pone el juego (y nunca hay más de un destello por segundo);
     el tiempo para responder es todo el que se quiera.
   - AL FALLAR NO SUENA NADA NI SE PINTA DE ROJO. Se dice con una frase tranquila,
     se vuelve a enseñar la secuencia y se intenta otra vez. Es la misma
     decisión de Schulte: una señal de error asusta más de lo que enseña.
   - EL COLOR NUNCA ES LA ÚNICA PISTA. Cada botón lleva además una forma, una
     etiqueta (número o letra) y una nota distinta. Con cualquier tipo de
     daltonismo, sin ver, o sin oír, siempre queda otra pista.
   - TODO SE PUEDE CAMBIAR, y se ve al momento en un cuadrito de ejemplo.
     Además hay "perfiles": un clic que deja puestos varios ajustes juntos.
     Son un punto de partida, no un diagnóstico: después se ajusta cada cosa.

   -------------------------------------------------------------------------
   QUÉ VIVE EN EL SERVIDOR Y QUÉ AQUÍ
   Python (logica/secuencia.py) decide lo que no cambia con la pantalla: qué
   opciones hay, los colores y las notas ya medidos, y la secuencia. Se pide
   UNA vez al empezar. Lo demás (encender, sonar, comparar cada toque) vive
   aquí, porque un viaje al servidor por cada toque retrasaría el juego.

   Hay UNA cosa que este archivo repite de Python: elegir texto claro u oscuro
   sobre un color. Hace falta para los colores que la persona escoge en la
   paleta "La mía", que se ven al instante. Es la misma regla (la que da más
   contraste) y las pruebas comprueban que dan lo mismo en todas las paletas.

   -------------------------------------------------------------------------
   LOS AJUSTES
   Se guardan con RetoDatos, con el prefijo "secuencia-". Los que nunca se
   tocan NO se guardan: se usa su valor de fábrica. Así, si mañana cambia uno,
   quien nunca lo tocó recibe el nuevo.

   Lo que es de la PANTALLA (colores, fuente, tamaño, luz) se escribe en <html>,
   y tanto el tablero como el cuadrito del modal lo heredan: por eso el cuadrito
   se mueve al instante sin que nada se copie a mano. El valor por defecto va
   en el CSS, en el sitio donde se usa, con var(--ajuste, var(--del-tema)).
   ========================================================================= */
(function () {
  'use strict';

  var API = '/api/secuencia';
  var PREFIJO = 'secuencia-';

  /* ---------------------------------------------------------------------
     LOS AJUSTES Y SUS VALORES DE FÁBRICA

     La paleta viene en "daltonismo" y la forma encendida: el juego es usable
     por todos desde el primer clic, sin tener que buscar un ajuste. Los
     cuatro botones y la meta de 8 pasos hacen una primera partida que se
     puede terminar. La siguiente ronda espera a que la persona la pida
     ("yo"): nada empieza solo.

     El RÉCORD empieza apagado, por la misma razón que en Schulte: lo que sirve
     es ver la propia tendencia, no superar una marca.

     SIN BOTONES SUELTOS DE MÁS: cada ajuste de esta tabla tiene su control en
     el modal, y cada control cambia algo que se ve u oye. Si uno deja de
     hacerlo, se quita entero (estado, clave guardada y regla del CSS).
     --------------------------------------------------------------------- */
  var FABRICA = {
    botones: '4',
    meta: '8',
    inicio: '2',
    error: 'repetir',
    siguiente: 'yo',
    avance: 'on',
    velocidad: 'lenta',
    etiqueta: 'numeros',
    forma: 'on',
    paleta: 'daltonismo',
    letra: '2',
    fuente: 'nunito',
    espaciado: 'normal',
    tamano: 'mediano',
    separacion: 'normal',
    borde: 'off',
    luz: 'completo',
    movimiento: 'on',
    sonido: 'on',
    sonidoBotones: 'notas',
    timbre: 'sine',
    sonidoRonda: 'ding',
    sonidoMeta: 'charm',
    volumen: '50',
    vibracion: 'off',
    voz: 'off',
    record: 'off'
  };

  /* Los colores que se eligen a mano. Vacío = el del tema. */
  var COLOR_FABRICA = { pantalla: '', simbolos: '' };

  /* LA LETRA: el tamaño del símbolo como fracción del lado del botón (rel) y el
     tamaño de los textos del juego (texto). Va como fracción y no en rem
     porque el botón cambia de tamaño con la pantalla, y un 2 rem fijo sería
     enorme en un botón chico y diminuto en uno grande. */
  var LETRAS = [
    { id: '1', nombre: 'Pequeña', rel: '0.28', texto: '1' },
    { id: '2', nombre: 'Mediana', rel: '0.36', texto: '1.15' },
    { id: '3', nombre: 'Grande', rel: '0.46', texto: '1.4' }
  ];

  var TAMANOS = [
    { id: 'pequeno', nombre: 'Pequeño' },
    { id: 'mediano', nombre: 'Mediano' },
    { id: 'grande', nombre: 'Grande' }
  ];

  var SEPARACIONES = [
    { id: 'normal', nombre: 'Normal' },
    { id: 'amplia', nombre: 'Amplia' }
  ];

  var ESPACIADOS = [
    { id: 'normal', nombre: 'Normal' },
    { id: 'amplio', nombre: 'Amplio' }
  ];

  var LUCES = [
    { id: 'completo', nombre: 'Brillo y aro',
      ayuda: 'El botón se ilumina, crece un poco y lleva un aro. La más fácil de ver.' },
    { id: 'aro', nombre: 'Solo aro',
      ayuda: 'El botón crece un poco y lleva un aro, pero no cambia de brillo. Para quien le molesta la luz.' },
    { id: 'suave', nombre: 'Aro suave',
      ayuda: 'Solo un aro alrededor. Sin brillo y sin crecer. La más tranquila.' }
  ];

  var ERRORES = [
    { id: 'repetir', nombre: 'Verla otra vez',
      ayuda: 'Se enseña la misma secuencia y vuelves a intentarlo, las veces que quieras.' },
    { id: 'terminar', nombre: 'Terminar la partida',
      ayuda: 'La partida acaba y se ve hasta dónde llegaste. Como el juego de siempre.' }
  ];

  var SIGUIENTES = [
    { id: 'yo', nombre: 'Cuando yo lo pida',
      ayuda: 'Después de cada ronda esperas y tocas "Seguir". Nada empieza solo.' },
    { id: 'sola', nombre: 'Sola, con una pausa',
      ayuda: 'La siguiente ronda empieza sola después de una pausa corta.' }
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

  /* LOS PERFILES. Cada uno deja puestos varios ajustes de golpe. No son un
     diagnóstico ni prometen nada: son combinaciones que suelen servir, y
     después se cambia lo que haga falta. Los textos son sencillos a
     propósito. Un perfil solo toca lo que dice; lo demás se queda como está. */
  var PERFILES = [
    { id: 'calma', nombre: 'Tranquilo',
      ayuda: 'Colores suaves, sin movimiento, sonido bajito y sin prisa.',
      ajustes: { paleta: 'suave', luz: 'suave', movimiento: 'off', sonido: 'on',
                 sonidoBotones: 'notas', timbre: 'sine', volumen: '25',
                 velocidad: 'lenta', siguiente: 'yo', error: 'repetir',
                 tamano: 'mediano', vibracion: 'off', voz: 'off', record: 'off' } },
    { id: 'colores', nombre: 'Colores difíciles',
      ayuda: 'Colores que se distinguen, siempre con forma y número, y bordes gruesos.',
      ajustes: { paleta: 'daltonismo', forma: 'on', etiqueta: 'numeros',
                 borde: 'on', luz: 'completo' } },
    { id: 'atencion', nombre: 'Atención',
      ayuda: 'Partidas cortas, el avance a la vista y cada ronda cuando tú la pidas.',
      ajustes: { meta: '5', inicio: '2', avance: 'on', siguiente: 'yo',
                 error: 'repetir', velocidad: 'lenta', tamano: 'mediano',
                 record: 'off' } },
    { id: 'vista', nombre: 'Ver mejor',
      ayuda: 'Botones y letra grandes, mucho contraste y más espacio entre botones.',
      ajustes: { tamano: 'grande', letra: '3', borde: 'on', separacion: 'amplia',
                 paleta: 'alto-contraste', fuente: 'atkinson', luz: 'completo',
                 velocidad: 'lenta' } },
    { id: 'lectura', nombre: 'Letras y números',
      ayuda: 'Números, letra abierta y más espacio entre las letras.',
      ajustes: { etiqueta: 'numeros', fuente: 'lexend', espaciado: 'amplio',
                 letra: '3' } },
    { id: 'sinsonido', nombre: 'Sin sonido',
      ayuda: 'Todo se ve y nada suena. Vibra si tu aparato puede.',
      ajustes: { sonido: 'off', voz: 'off', vibracion: 'on', luz: 'completo' } },
    { id: 'escuchar', nombre: 'Escuchar',
      ayuda: 'Cada paso se dice en voz alta y cada botón suena distinto.',
      ajustes: { voz: 'on', sonido: 'on', sonidoBotones: 'notas', volumen: '75',
                 velocidad: 'muy-lenta', etiqueta: 'numeros' } }
  ];

  /* LAS FORMAS. El dibujo va en un cuadro de 24 x 24 y se pinta con el color
     del texto del botón. Se escriben aquí porque son datos del dibujo, no del
     juego: el servidor solo sabe los nombres. */
  var FORMAS_SVG = {
    circulo: '<circle cx="12" cy="12" r="8.5"/>',
    cuadrado: '<rect x="4.5" y="4.5" width="15" height="15" rx="1"/>',
    triangulo: '<polygon points="12,3.5 21.5,20 2.5,20"/>',
    rombo: '<polygon points="12,2.5 21.5,12 12,21.5 2.5,12"/>',
    estrella: '<polygon points="12,2.5 14.9,8.9 21.8,9.6 16.6,14.2 18.1,21 12,17.5 5.9,21 7.4,14.2 2.2,9.6 9.1,8.9"/>',
    hexagono: '<polygon points="12,2.8 20.2,7.4 20.2,16.6 12,21.2 3.8,16.6 3.8,7.4"/>',
    cruz: '<polygon points="9,3 15,3 15,9 21,9 21,15 15,15 15,21 9,21 9,15 3,15 3,9 9,9"/>',
    pentagono: '<polygon points="12,2.8 21.4,9.6 17.8,20.6 6.2,20.6 2.6,9.6"/>',
    gota: '<path d="M12 2.8C12 2.8 5 10.6 5 15a7 7 0 0 0 14 0C19 10.6 12 2.8 12 2.8z"/>'
  };

  /* Los tiempos que no son una velocidad: la espera antes del primer paso (para
     que la persona se prepare y no pierda el primero) y la pausa de las
     rondas que siguen solas. */
  var ESPERA_INICIAL = 900;
  var PAUSA_SOLA = 1800;
  var DURACION_TOQUE = 260;
  var CUANTAS_SE_GUARDAN = 8;

  var TEXTO_OSCURO = '#1a1a1a';
  var TEXTO_CLARO = '#ffffff';

  /* ---------------------------------------------------------------------
     EL ESTADO
     De una sola pieza y aquí, no repartido por el DOM.
     --------------------------------------------------------------------- */
  var cat = null;              // lo que ofrece el servidor
  var ajustes = {};
  var colores = {};            // pantalla y símbolos
  var padColores = [];         // los de "La mía", hasta nueve

  var secuencia = [];          // la secuencia completa de esta partida
  var partidaBotones = '4';    // con cuántos botones se jugó esta partida
  var ronda = 0;               // cuántos pasos tiene la ronda actual
  var pos = 0;                 // cuántos pasos lleva bien en esta ronda
  var errores = 0;
  var alcanzado = 0;           // la secuencia más larga que repitió completa
  var guardada = false;        // si el resultado de esta partida ya se guardó
  var estado = 'cargando';     // cargando | espera | mostrando | turno | pausa | fin

  var ficha = 0;               // sube cada vez que se cancela: lo viejo se ignora
  var temporizadores = [];
  var audioCtx = null;
  var reanudar = false;        // se pausó para abrir los ajustes
  var ignorarCierre = 0;

  var tableroEl, avanceCajaEl, rondaEl, cuentasEl, barraEl, accionEl,
      mensajeEl, lectorEl;
  var cfg = null;
  var refs = {};

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

  function cantidadActual() {
    return porId(cat.botones, ajustes.botones).total;
  }

  function pasosDeMeta() {
    return porId(cat.metas, ajustes.meta).pasos;   // null = sin meta
  }

  function velocidadActual() {
    return porId(cat.velocidades, ajustes.velocidad);
  }

  /* El texto claro u oscuro que mejor se lee sobre un color. Es la misma regla
     que color_de_texto() de logica/secuencia.py: gana el que da más contraste.
     Las pruebas comprueban que las dos dan lo mismo en todas las paletas. */
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

  function textoSobre(fondo) {
    return contraste(fondo, TEXTO_OSCURO) >= contraste(fondo, TEXTO_CLARO)
      ? TEXTO_OSCURO : TEXTO_CLARO;
  }

  /* Con etiqueta "ninguna" la forma NO se puede quitar: sin forma ni etiqueta,
     los botones solo se distinguirían por el color, y justo eso es lo que no
     se hace en este juego. */
  function formaActiva() {
    return ajustes.forma === 'on' || ajustes.etiqueta === 'ninguna';
  }

  /* ------------------------------------------------------------- avisos */

  /* Dos caminos que a veces se parecen y no son lo mismo. `mensaje()` se VE y
     ocupa su sitio. `avisar()` solo se ANUNCIA, para quien no ve. */
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

  /* Los colores de la PANTALLA van a <html>; el de los símbolos va en cada
     botón (se arma con ellos). Un vacío quita la variable y manda el tema. */
  function aplicarColores() {
    var r = document.documentElement;
    if (colores.pantalla) {
      r.style.setProperty('--sec-pantalla', colores.pantalla);
      /* El texto se pone solo claro u oscuro, para que se lea sobre el fondo
         que se haya elegido. */
      r.style.setProperty('--sec-pantalla-texto', textoSobre(colores.pantalla));
    } else {
      r.style.removeProperty('--sec-pantalla');
      r.style.removeProperty('--sec-pantalla-texto');
    }
  }

  /* LA FORMA Y EL MOVIMIENTO, también en <html> para que el cuadrito del modal
     los herede. Los atributos los lee el CSS; no hay nada que hacer aquí
     más que escribirlos. */
  function aplicarForma() {
    var r = document.documentElement;
    var letra = porId(LETRAS, ajustes.letra);
    r.style.setProperty('--sec-simbolo-rel', letra.rel);
    r.style.setProperty('--sec-texto-escala', letra.texto);
    r.setAttribute('data-sec-tam', ajustes.tamano);
    r.setAttribute('data-sec-sep', ajustes.separacion);
    r.setAttribute('data-sec-espaciado', ajustes.espaciado);
    r.setAttribute('data-sec-borde', ajustes.borde);
    r.setAttribute('data-sec-luz', ajustes.luz);
    r.setAttribute('data-sec-mov', ajustes.movimiento);

    /* La fuente pasa por RetoFuentes: es quien sabe cargar tanto las del sitio
       como las que la persona instaló. Si no está, se queda la del sitio. */
    var respaldo = '"Nunito", system-ui, sans-serif';
    r.style.setProperty('--sec-fuente', respaldo);
    if (window.RetoFuentes) {
      window.RetoFuentes.aplicar(ajustes.fuente).then(function (f) {
        r.style.setProperty('--sec-fuente', f.css);
      }).catch(function () {});
    }
  }

  /* ------------------------------------------------------------ el sonido */

  /* El interruptor GENERAL del sitio manda siempre: con el sonido apagado en
     Configuración, este juego se calla igual. Ningún ajuste de aquí puede
     saltarse eso. */
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

  /* UNA NOTA, con la entrada y la salida suaves. Un tono que arranca y se corta
     de golpe suena como un chasquido, y para quien tiene sensibilidad a los
     sonidos eso es lo peor. Se sube en 20 ms y se baja en los últimos 60. */
  function nota(i, ms) {
    var ctx = contexto();
    if (!ctx) return;
    var hz = cat.notas[ajustes.botones][i];
    if (!hz) return;
    try {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      var osc = ctx.createOscillator();
      var gan = ctx.createGain();
      osc.type = ajustes.timbre === 'triangle' ? 'triangle' : 'sine';
      osc.frequency.value = hz;
      var t0 = ctx.currentTime;
      var dur = Math.max(0.18, ms / 1000 - 0.04);
      /* 0.4 es el techo: un tono puro a ganancia 1 es mucho más fuerte que los
         archivos de sonido del sitio con el mismo "volumen". */
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

  /* Lo que suena al encender o tocar un botón. */
  function sonarBoton(i, ms) {
    if (ajustes.sonido !== 'on' || !sitioPermiteSonido()) return;
    if (ajustes.sonidoBotones === 'notas') nota(i, ms);
    else sonidoDelSitio(ajustes.sonidoBotones);
  }

  /* Lo que suena al terminar una ronda ('ronda') o al llegar a la meta. */
  function sonarAviso(que) {
    if (ajustes.sonido !== 'on' || !sitioPermiteSonido()) return;
    sonidoDelSitio(que === 'meta' ? ajustes.sonidoMeta : ajustes.sonidoRonda);
  }

  /* LO QUE DICE LA VOZ: la etiqueta del botón; si no hay, el nombre de su
     forma; y si tampoco, "botón N". Siempre es algo que la persona también
     puede ver o leer en el botón. */
  function nombreHablado(i) {
    var et = porId(cat.etiquetas, ajustes.etiqueta).valores;
    if (et.length) return et[i];
    if (formaActiva()) return cat.formas[i].nombre;
    return 'botón ' + (i + 1);
  }

  function hablar(i) {
    if (ajustes.voz !== 'on' || !window.speechSynthesis ||
        !window.SpeechSynthesisUtterance) return;
    try {
      window.speechSynthesis.cancel();
      var dicho = new window.SpeechSynthesisUtterance(nombreHablado(i));
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

  function coloresActuales() {
    var total = cantidadActual();
    var pal = porId(cat.paletas, ajustes.paleta);
    if (pal.personalizable) {
      var lista = [];
      for (var i = 0; i < total; i++) {
        var h = padColores[i] || cat.base_personalizada[i];
        lista.push({ fondo: h, texto: textoSobre(h) });
      }
      return lista;
    }
    return pal.colores[ajustes.botones];
  }

  /* Arma los botones dentro de `caja`. Sirve para el tablero de verdad
     (interactivo) y para el cuadrito del modal (no lo es): así lo que se ve
     en el cuadrito es lo que se ve jugando, y no son dos dibujos que se puedan
     separar. */
  function armarBotones(caja, interactivo) {
    limpiar(caja);
    var total = cantidadActual();
    var conEtiqueta = ajustes.etiqueta !== 'ninguna';
    var conForma = formaActiva();
    var etiquetas = porId(cat.etiquetas, ajustes.etiqueta).valores;
    var pintados = coloresActuales();

    caja.setAttribute('data-botones', ajustes.botones);
    caja.setAttribute('data-etiqueta', conEtiqueta ? '1' : '0');
    caja.setAttribute('data-forma', conForma ? '1' : '0');

    for (var i = 0; i < total; i++) {
      var b = el(interactivo ? 'button' : 'div', 'sec-boton');
      if (interactivo) b.type = 'button';
      b.setAttribute('data-i', String(i));

      var c = pintados[i];
      if (c && c.fondo) b.style.setProperty('--sec-c', c.fondo);
      var textoColor = colores.simbolos || (c && c.texto);
      if (textoColor) b.style.setProperty('--sec-t', textoColor);

      var nombre = 'Botón ' + (i + 1);
      if (conEtiqueta) nombre += ', ' + etiquetas[i];
      if (conForma) nombre += ', ' + cat.formas[i].nombre;
      if (interactivo) b.setAttribute('aria-label', nombre);

      if (conForma) {
        var f = el('span', 'sec-forma');
        f.setAttribute('aria-hidden', 'true');
        f.innerHTML = '<svg viewBox="0 0 24 24" focusable="false" fill="currentColor">' +
                      FORMAS_SVG[cat.formas[i].id] + '</svg>';
        b.appendChild(f);
      }
      if (conEtiqueta) {
        var t = el('span', 'sec-etiqueta', etiquetas[i]);
        t.setAttribute('aria-hidden', 'true');
        b.appendChild(t);
      }
      caja.appendChild(b);
    }
  }

  function repintar() {
    armarBotones(tableroEl, true);
    pintarCuadrito();
  }

  function boton(i) {
    return tableroEl.querySelector('[data-i="' + i + '"]');
  }

  function luz(i, encendido) {
    var b = boton(i);
    if (!b) return;
    if (encendido) b.setAttribute('data-luz', '1');
    else b.removeAttribute('data-luz');
  }

  function apagarTodo() {
    var prendidos = tableroEl.querySelectorAll('[data-luz]');
    for (var i = 0; i < prendidos.length; i++) prendidos[i].removeAttribute('data-luz');
  }

  /* ------------------------------------------------------------ el avance */

  function pintarAvance(actual, total, queHace) {
    var meta = pasosDeMeta();
    avanceCajaEl.hidden = ajustes.avance !== 'on';
    if (!ronda) {
      rondaEl.textContent = meta ? 'Meta: ' + meta + ' pasos' : 'Sin meta';
      cuentasEl.textContent = '';
      barraEl.style.width = '0%';
      return;
    }
    rondaEl.textContent = 'Secuencia de ' + ronda + (meta ? ' · meta ' + meta : '');
    if (total) {
      cuentasEl.textContent = queHace + ': ' + actual + ' de ' + total;
      barraEl.style.width = Math.round((actual / total) * 100) + '%';
    } else {
      cuentasEl.textContent = '';
      barraEl.style.width = '0%';
    }
  }

  /* El botón de la partida dice siempre en qué momento se está. Cuando no se
     puede apretar lleva aria-disabled y no "disabled": así no pierde el foco
     justo al apretar "Empezar". */
  function ponerAccion(texto, activa, que) {
    accionEl.textContent = texto;
    accionEl.setAttribute('aria-disabled', activa ? 'false' : 'true');
    accionEl.setAttribute('data-que', que || '');
  }

  /* ------------------------------------------------------------- el tiempo */

  function programar(fn, ms) {
    temporizadores.push(window.setTimeout(fn, ms));
  }

  function cancelar() {
    ficha++;
    temporizadores.forEach(function (id) { window.clearTimeout(id); });
    temporizadores = [];
    if (tableroEl) apagarTodo();
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  /* -------------------------------------------------------- la partida */

  /* Pide algo al servidor. Un 404 o un 405 quieren decir lo mismo aquí: el
     servidor que está corriendo es más viejo que el juego y no conoce la
     ruta. No es un problema del juego, y decirlo así ahorra buscar. */
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
    ponerAccion('Reintentar', true, 'otra');
    decir(e.message);
  }

  function nuevaPartida() {
    cancelar();
    reanudar = false;
    var antes = (!guardada && alcanzado > 0) ? guardarResultado() : Promise.resolve();
    return antes.then(function () {
      estado = 'cargando';
      ponerAccion('Un momento…', false);
      var meta = pasosDeMeta();
      return pedir('/nueva', {
        botones: ajustes.botones,
        largo: meta !== null ? meta : cat.largo_sin_meta
      });
    }).then(function (d) {
      secuencia = d.secuencia;
      partidaBotones = d.botones;
      ronda = 0;
      pos = 0;
      errores = 0;
      alcanzado = 0;
      guardada = false;
      estado = 'espera';
      armarBotones(tableroEl, true);
      pintarAvance();
      ponerAccion('Empezar', true, 'empezar');
      decir('Cuando estés listo, toca Empezar.');
    }).catch(falloDeRed);
  }

  /* El primer toque de la persona en la partida crea el audio. Los navegadores
     no dejan sonar nada hasta que alguien toca algo, y este es ese toque. */
  function empezar() {
    contexto();
    ronda = Math.min(porId(cat.inicios, ajustes.inicio).pasos, secuencia.length);
    mostrar();
  }

  function mostrar() {
    cancelar();
    var mio = ficha;
    var vel = velocidadActual();
    estado = 'mostrando';
    pos = 0;
    ponerAccion('Mirando…', false);
    pintarAvance(0, ronda, 'Mirando');
    decir('Mira con atención. La secuencia tiene ' + ronda +
          (ronda === 1 ? ' paso.' : ' pasos.'));

    var k = 0;
    function paso() {
      if (mio !== ficha) return;
      if (k >= ronda) { turno(); return; }
      var i = secuencia[k];
      k++;
      pintarAvance(k, ronda, 'Mirando');
      luz(i, true);
      sonarBoton(i, vel.encendido);
      hablar(i);
      vibrar();
      programar(function () {
        if (mio !== ficha) return;
        luz(i, false);
        programar(paso, vel.pausa);
      }, vel.encendido);
    }
    programar(paso, ESPERA_INICIAL);
  }

  function turno() {
    estado = 'turno';
    pos = 0;
    ponerAccion('Tu turno', false);
    pintarAvance(0, ronda, 'Tu turno');
    decir('Tu turno. Toca los botones en el mismo orden.');
  }

  /* Un toque en un botón. Con la luz del botón, el sonido, la voz y la
     vibración que la persona tenga puestos: una confirmación no debe depender
     de un solo sentido. */
  function tocar(i) {
    if (estado !== 'turno') return;
    var mio = ficha;
    luz(i, true);
    programar(function () { if (mio === ficha) luz(i, false); }, DURACION_TOQUE);
    sonarBoton(i, DURACION_TOQUE + 60);
    hablar(i);
    vibrar();

    if (i === secuencia[pos]) {
      pos++;
      pintarAvance(pos, ronda, 'Tu turno');
      if (pos >= ronda) rondaCompleta();
    } else {
      fallo();
    }
  }

  function rondaCompleta() {
    alcanzado = ronda;
    var meta = pasosDeMeta();
    var llego = (meta !== null && ronda >= meta) || ronda >= secuencia.length;
    estado = llego ? 'fin' : 'pausa';
    if (llego) {
      /* Un respiro para que se oiga la última nota antes del aviso. */
      programar(function () { sonarAviso('meta'); terminar(true); }, 700);
      return;
    }
    programar(function () { sonarAviso('ronda'); }, 350);
    ronda++;
    decir('Bien. La siguiente tiene ' + ronda + ' pasos.');
    if (ajustes.siguiente === 'sola') {
      ponerAccion('Un momento…', false);
      programar(mostrar, PAUSA_SOLA);
    } else {
      ponerAccion('Seguir', true, 'seguir');
    }
  }

  /* AQUÍ NO SUENA NADA NI SE PINTA DE ROJO. Se cuenta, se dice con una frase
     tranquila y se sigue. Es una decisión, y de las importantes: el error se
     cuenta porque sirve para ver la tendencia, pero no se enseña como una
     alarma. */
  function fallo() {
    errores++;
    pos = 0;
    if (ajustes.error === 'terminar') {
      estado = 'fin';
      programar(function () { terminar(false); }, 500);
      return;
    }
    estado = 'pausa';
    decir('Esa no era. Vamos a ver la secuencia otra vez.');
    if (ajustes.siguiente === 'sola') {
      ponerAccion('Un momento…', false);
      programar(mostrar, PAUSA_SOLA);
    } else {
      ponerAccion('Ver otra vez', true, 'seguir');
    }
  }

  function repetirSecuencia() {
    if (estado === 'turno' || estado === 'pausa') mostrar();
    else if (estado === 'espera') decir('Primero toca Empezar.');
  }

  /* --------------------------------------------------------- el final */

  function claveMejor() { return PREFIJO + 'mejor-' + partidaBotones; }
  function claveHistorial() { return PREFIJO + 'historial-' + partidaBotones; }

  /* Guarda cuánto se llegó, para la tendencia y el récord. Se llama al
     terminar y también al empezar otra partida a medias: así lo que se
     avanzó no se pierde por darle a "empezar de nuevo". */
  function guardarResultado() {
    guardada = true;
    var llegado = alcanzado;
    return Promise.all([
      window.RetoDatos.obtener(claveMejor()),
      window.RetoDatos.obtener(claveHistorial())
    ]).then(function (r) {
      var mejorAntes = (r[0] === null || r[0] === undefined) ? 0 : Number(r[0]);
      var lista = Array.isArray(r[1]) ? r[1] : [];
      lista.push(llegado);
      if (lista.length > CUANTAS_SE_GUARDAN) lista = lista.slice(-CUANTAS_SE_GUARDAN);
      var nuevo = llegado > mejorAntes;
      return Promise.all([
        window.RetoDatos.poner(claveHistorial(), lista),
        nuevo ? window.RetoDatos.poner(claveMejor(), llegado) : Promise.resolve()
      ]).then(function () {
        return { lista: lista, mejor: nuevo ? llegado : mejorAntes, nuevo: nuevo };
      });
    });
  }

  /* LA TENDENCIA. Una partida es un punto y lo que cuenta son varias: se
     compara esta con el promedio de las anteriores, en palabras llanas. Nunca
     "mal": solo más lejos o menos lejos. */
  function leerTendencia(lista, este) {
    if (lista.length < 2) return '';
    var previas = lista.slice(0, -1);
    var ventana = previas.length >= 3 ? previas.slice(-3) : previas;
    var media = ventana.reduce(function (a, b) { return a + b; }, 0) / ventana.length;
    if (este > media + 0.5) return 'Llegaste más lejos que en tus últimas partidas.';
    if (este < media - 0.5) return 'Esta vez llegaste menos lejos que en las últimas.';
    return 'Igual que tus últimas partidas.';
  }

  function terminar(llegoALaMeta) {
    estado = 'fin';
    ponerAccion('Jugar otra vez', true, 'otra');
    pintarAvance(0, 0);

    var hecho = alcanzado > 0 ? guardarResultado() : Promise.resolve(null);
    hecho.then(function (info) {
      var lineas = [];
      if (alcanzado > 0) {
        lineas.push(llegoALaMeta
          ? 'Repetiste la secuencia completa: ' + alcanzado + ' pasos.'
          : 'Llegaste a una secuencia de ' + alcanzado +
            (alcanzado === 1 ? ' paso.' : ' pasos.'));
      } else {
        lineas.push('Esta vez no se completó ninguna secuencia.');
      }
      if (info) {
        var tendencia = leerTendencia(info.lista, alcanzado);
        if (tendencia) lineas.push(tendencia);
        /* EL RÉCORD SOLO SI SE PIDIÓ: con el ajuste apagado no sale ni en el
           texto ni en el anuncio. */
        if (ajustes.record === 'on') {
          lineas.push(info.nuevo ? 'Es tu secuencia más larga.'
                                 : 'Tu más larga: ' + info.mejor + '.');
        }
      }
      lineas.push('Errores: ' + errores + '.');
      var texto = lineas.join('\n');
      mensaje(lineas.slice(0, 1).join(' '));
      avisar((llegoALaMeta ? 'Llegaste a la meta. ' : 'Terminó la partida. ') + texto);

      /* Si justo en ese momento se abrieron los ajustes, no se apila otro
         aviso encima: el resultado ya está dicho y el botón de la partida
         dice "Jugar otra vez". */
      if (cfg && cfg.open) return;

      window.RetoDialogo.lista({
        titulo: llegoALaMeta ? '¡Llegaste a la meta!' : 'Terminó la partida',
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

  /* 1 a 9 tocan el botón de ese número; si los botones llevan letras, la
     letra también. Las flechas se mueven entre botones, y Enter o espacio los
     tocan (eso ya lo hace un <button> solo). */
  function enTeclado(e) {
    if (!cat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    var obj = e.target;
    if (obj && /^(INPUT|SELECT|TEXTAREA)$/.test(obj.tagName)) return;

    var total = cantidadActual();
    var i = -1;
    if (/^[1-9]$/.test(e.key)) {
      i = Number(e.key) - 1;
    } else if (e.key.length === 1 && ajustes.etiqueta === 'letras') {
      i = porId(cat.etiquetas, 'letras').valores.indexOf(e.key.toUpperCase());
    }
    if (i >= 0 && i < total) { tocar(i); return; }

    var cual = obj && obj.closest && obj.closest('.sec-boton');
    if (!cual) return;
    var actual = Number(cual.getAttribute('data-i'));
    var cols = porId(cat.botones, ajustes.botones).columnas;
    var destino = null;
    if (e.key === 'ArrowRight') destino = actual + 1;
    else if (e.key === 'ArrowLeft') destino = actual - 1;
    else if (e.key === 'ArrowDown') destino = actual + cols;
    else if (e.key === 'ArrowUp') destino = actual - cols;
    if (destino === null || destino < 0 || destino >= total) return;
    var lado = (e.key === 'ArrowRight' || e.key === 'ArrowLeft');
    if (lado && Math.floor(destino / cols) !== Math.floor(actual / cols)) return;
    e.preventDefault();
    var sig = boton(destino);
    if (sig) sig.focus();
  }

  /* ============================================================ el modal
     El orden de las secciones es de arriba hacia abajo: primero el cuadrito
     (lo que se está mirando), después los perfiles, después lo que cambia el
     juego, después lo que cambia cómo se ve, y al final el sonido.

     TODO SE APLICA AL MOMENTO. Lo que cambia la secuencia (cuántos botones,
     cuál meta) pide una partida nueva. El resto se aplica sin pedir nada,
     porque son atributos y variables en <html> que heredan el tablero y el
     cuadrito. */

  function grupo(legenda, ayuda) {
    var fs = document.createElement('fieldset');
    fs.appendChild(el('legend', null, legenda));
    if (ayuda) fs.appendChild(el('p', 'ayuda', ayuda));
    cfg.appendChild(fs);
    return fs;
  }

  /* Pinta el cuadrito del modal con la misma función del tablero. El segundo
     botón va encendido a propósito, para que se vea la luz de verdad y no
     haya que imaginársela. */
  function pintarCuadrito() {
    if (!cfg) return;
    var caja = cfg.querySelector('.sec-cuadrito-caja');
    if (!caja) return;
    limpiar(caja);
    var sec = el('div', 'sec');
    sec.setAttribute('aria-hidden', 'true');
    var tab = el('div', 'sec-tablero');
    armarBotones(tab, false);
    if (tab.children[1]) tab.children[1].setAttribute('data-luz', '1');
    sec.appendChild(tab);
    caja.appendChild(sec);
  }

  function opcionRadio(nombre, valor, texto, elegido, alCambiar) {
    var op = el('label', 'opcion');
    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = nombre;
    radio.value = valor;
    if (valor === elegido) radio.checked = true;
    radio.addEventListener('change', function () {
      if (this.checked) alCambiar(valor);
    });
    op.appendChild(radio);
    op.appendChild(el('span', null, texto));
    return op;
  }

  /* Un grupo de opciones con su título, y debajo la explicación de la que
     está elegida (si las opciones traen ayuda). */
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

  /* Un campo de color: la rueda y, al lado, el hexadecimal. El campo de texto
     sirve para pegar un color de otra parte y, si `permiteVacio`, para
     dejarlo vacío y volver al del tema (con solo la rueda no hay forma, porque
     la rueda siempre tiene un color). */
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
      /* Se ignora lo que no sea un hexadecimal de seis: un "#ff" mal escrito
         se guardaría y el color se rompería en silencio. */
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
    coloresActuales().forEach(function (c) {
      var m = el('span', 'sec-muestra');
      if (c.fondo) m.style.background = c.fondo;
      caja.appendChild(m);
    });
  }

  /* Los colores de "La mía": uno por botón, solo los que hay en juego. */
  function pintarPersonal() {
    var caja = refs.personal;
    if (!caja) return;
    limpiar(caja);
    var pal = porId(cat.paletas, ajustes.paleta);
    caja.hidden = !pal.personalizable;
    if (!pal.personalizable) return;
    for (var i = 0; i < cantidadActual(); i++) {
      (function (i) {
        var actual = padColores[i] || cat.base_personalizada[i];
        caja.appendChild(filaColor(PREFIJO + 'color-boton-' + i, 'Botón ' + (i + 1),
          actual, false, function (nuevo) {
            if (!padColores.length) padColores = cat.base_personalizada.slice();
            padColores[i] = nuevo;
            guardarPadColores().then(function () { repintar(); pintarMuestras(refs.muestras); });
          }));
      })(i);
    }
  }

  function alCambiarEstructura() {
    repintar();
    pintarMuestras(refs.muestras);
    pintarPersonal();
    return nuevaPartida();
  }

  function armarConfig() {
    if (cfg) return;
    var esteCfg = document.createElement('dialog');
    cfg = esteCfg;
    cfg.className = 'dialogo sec-config';
    cfg.setAttribute('aria-labelledby', 'sec-cfg-titulo');
    refs = {};

    var titulo = el('h2', 'dialogo-titulo', 'Ajustes de Secuencia');
    titulo.id = 'sec-cfg-titulo';
    cfg.appendChild(titulo);

    /* EL CUADRITO, PRIMERO, y pegado arriba mientras se baja por los ajustes:
       es lo que se está mirando, y si hubiera que subir para verlo, se perdería
       el ir-y-ver que es para lo que sirve. */
    var cuadrito = el('div', 'sec-cuadrito');
    cuadrito.appendChild(el('div', 'sec-cuadrito-caja'));
    cuadrito.appendChild(el('p', 'ayuda', 'Así se ve. El segundo botón está encendido.'));
    cfg.appendChild(cuadrito);

    /* --- los perfiles */
    var gPerfiles = grupo('Perfiles',
      'Un clic deja puestos varios ajustes. Son un punto de partida: después ' +
      'cambias lo que quieras.');
    var rejillaPerfiles = el('div', 'sec-perfiles');
    PERFILES.forEach(function (p) {
      var b = el('button', 'boton sec-perfil');
      b.type = 'button';
      b.appendChild(el('strong', null, p.nombre));
      b.appendChild(el('span', 'ayuda', p.ayuda));
      b.addEventListener('click', function () { aplicarPerfil(p); });
      rejillaPerfiles.appendChild(b);
    });
    gPerfiles.appendChild(rejillaPerfiles);

    /* --- el juego */
    var gJuego = grupo('El juego',
      'Sin reloj: tú decides cuándo empezar y cuándo seguir.');
    campoRadios(gJuego, 'botones', 'Cuántos botones', cat.botones, alCambiarEstructura);
    campoRadios(gJuego, 'meta', 'Hasta dónde llega la partida', cat.metas, function () {
      pintarAvance();
      return nuevaPartida();
    });
    campoRadios(gJuego, 'inicio', 'Con cuántos pasos empieza', cat.inicios);
    campoRadios(gJuego, 'error', 'Si te equivocas', ERRORES);
    campoRadios(gJuego, 'siguiente', 'La siguiente ronda empieza', SIGUIENTES);
    interruptor(gJuego, 'avance', 'Ver el avance',
      'Cuántos pasos llevas y una barra. Si te pone nervioso, apágalo.', function () {
        avanceCajaEl.hidden = ajustes.avance !== 'on';
      });
    interruptor(gJuego, 'record', 'Mostrar también tu secuencia más larga',
      'Apagado sale solo hasta dónde llegaste y cómo vas, que es lo que sirve.');

    /* --- la velocidad */
    var gVel = grupo('La velocidad',
      'Cuánto tiempo se ve cada paso. No hay una más rápida, a propósito: ' +
      'este juego es de memoria, no de reflejos.');
    campoRadios(gVel, 'velocidad', 'Velocidad', cat.velocidades);

    /* --- cómo se ve cada botón */
    var gBotones = grupo('Cada botón',
      'El color nunca es la única pista: cada botón puede llevar también una ' +
      'forma y una etiqueta.');
    campoRadios(gBotones, 'etiqueta', 'Lo que dice cada botón', cat.etiquetas, function () {
      if (refs.forma) {
        refs.forma.disabled = ajustes.etiqueta === 'ninguna';
        refs.forma.checked = formaActiva();
      }
      repintar();
    });
    refs.forma = interruptor(gBotones, 'forma', 'Dibujar una forma en cada botón',
      'Círculo, cuadrado, triángulo… Ayuda mucho si los colores se parecen. ' +
      'Con "Ninguna" arriba, la forma se queda: sin ella solo quedaría el color.',
      repintar);
    refs.forma.disabled = ajustes.etiqueta === 'ninguna';
    refs.forma.checked = formaActiva();

    campoSelect(gBotones, 'paleta', 'Colores', cat.paletas, function () {
      repintar();
      pintarMuestras(refs.muestras);
      pintarPersonal();
    });
    refs.muestras = el('div', 'sec-muestras');
    refs.muestras.setAttribute('aria-hidden', 'true');
    gBotones.appendChild(refs.muestras);
    refs.personal = el('div', 'sec-personal');
    gBotones.appendChild(refs.personal);
    pintarMuestras(refs.muestras);
    pintarPersonal();

    gBotones.appendChild(filaColor(PREFIJO + 'color-simbolos', 'Color de los símbolos',
      colores.simbolos, true, function (v) { guardarColor('simbolos', v).then(repintar); }));
    gBotones.appendChild(filaColor(PREFIJO + 'color-pantalla', 'Fondo del juego',
      colores.pantalla, true, function (v) { guardarColor('pantalla', v); }));
    gBotones.appendChild(el('p', 'ayuda',
      'Un color vacío es el del tema. Los símbolos se ponen solos claros u ' +
      'oscuros según el botón; aquí puedes forzar uno.'));

    /* --- la letra */
    var gLetra = grupo('La letra',
      'El tamaño de los símbolos y de los textos, y la fuente.');
    campoRadios(gLetra, 'letra', 'Tamaño', LETRAS, function () { aplicarForma(); });
    campoRadios(gLetra, 'espaciado', 'Espacio entre letras y líneas', ESPACIADOS,
      function () { aplicarForma(); });

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

    /* --- el tamaño y el espacio */
    var gTam = grupo('Tamaño y espacio', 'Qué tan grandes son los botones y qué tan separados.');
    campoRadios(gTam, 'tamano', 'Tamaño del tablero', TAMANOS, function () { aplicarForma(); });
    campoRadios(gTam, 'separacion', 'Espacio entre botones', SEPARACIONES,
      function () { aplicarForma(); });
    interruptor(gTam, 'borde', 'Bordes gruesos',
      'Un contorno grueso en cada botón. Ayuda a verlos mejor.', aplicarForma);

    /* --- la luz y el movimiento */
    var gLuz = grupo('Luz y movimiento',
      'Cómo se marca el botón que se enciende. Nada destella más de una vez por segundo.');
    campoRadios(gLuz, 'luz', 'Cómo se enciende', LUCES, function () { aplicarForma(); });
    interruptor(gLuz, 'movimiento', 'Movimiento suave',
      'El botón crece un poco al encenderse. Apagado, se queda quieto. Si en ' +
      'Configuración tienes las animaciones apagadas, aquí tampoco hay movimiento.',
      aplicarForma);

    /* --- el sonido */
    var gSonido = grupo('El sonido',
      'Si en Configuración → Sonido está apagado, aquí no se oye nada. Al fallar ' +
      'nunca suena nada.');
    interruptor(gSonido, 'sonido', 'Activar el sonido',
      'Con esto apagado el juego no suena. El interruptor general del sitio también manda.');
    campoSelect(gSonido, 'sonidoBotones', 'Sonido de los botones',
      [{ id: 'notas', nombre: 'Una nota distinta por botón' }]
        .concat(SONIDOS, [{ id: 'ninguno', nombre: 'Ninguno' }]),
      function () { sonarBoton(0, 500); });
    campoSelect(gSonido, 'timbre', 'Tipo de nota', TIMBRES, function () {
      if (ajustes.sonidoBotones === 'notas') sonarBoton(0, 500);
    });
    campoSelect(gSonido, 'sonidoRonda', 'Al completar una ronda',
      SONIDOS.concat([{ id: 'ninguno', nombre: 'Ninguno' }]),
      function () { sonarAviso('ronda'); });
    campoSelect(gSonido, 'sonidoMeta', 'Al llegar a la meta',
      SONIDOS.concat([{ id: 'ninguno', nombre: 'Ninguno' }]),
      function () { sonarAviso('meta'); });

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
      sonarBoton(0, 500);
    });
    rango.addEventListener('change', function () { guardarAjuste('volumen', this.value); });
    filaVol.appendChild(rango);
    filaVol.appendChild(salida);
    gSonido.appendChild(filaVol);

    /* --- ayudas para jugar sin ver o sin oír */
    var gAyudas = grupo('Otras ayudas',
      'Para jugar sin mirar la pantalla, o sin oír.');
    interruptor(gAyudas, 'voz', 'Decir cada paso en voz alta',
      'Dice el número, la letra o la forma de cada botón al encenderse y al tocarlo.');
    interruptor(gAyudas, 'vibracion', 'Vibrar',
      'Una vibración corta con cada paso. Solo en aparatos que vibran.');

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
      if (cfg === esteCfg) cerrarConfig();
    });
    document.body.appendChild(cfg);

    /* La lista de fuentes se pide DESPUÉS de colgar el diálogo, porque cada
       fuente se pinta con su propia letra y para eso el <select> ya tiene que
       estar en la página. */
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
    return window.RetoFuentes.lista().then(function (todas) {
      limpiar(select);
      todas.forEach(function (f) {
        var op = el('option', '', f.nombre);
        op.value = f.id;
        if (f.id === ajustes.fuente) op.selected = true;
        select.appendChild(op);
      });
    });
  }

  /* Cierra el modal y lo vuelve a armar desde cero, para que todos los
     controles muestren lo que hay ahora. Sirve después de un perfil o de
     volver a la fábrica. */
  function rearmarConfig() {
    if (cfg) {
      if (cfg.open) { ignorarCierre++; cfg.close(); }
      if (cfg.parentNode) cfg.parentNode.removeChild(cfg);
      cfg = null;
    }
    abrirConfig();
  }

  function aplicarPerfil(p) {
    var cambioEstructura = false;
    var tareas = Object.keys(p.ajustes).map(function (clave) {
      if (clave === 'botones' || clave === 'meta') {
        if (ajustes[clave] !== p.ajustes[clave]) cambioEstructura = true;
      }
      return guardarAjuste(clave, p.ajustes[clave]);
    });
    Promise.all(tareas).then(function () {
      aplicarForma();
      repintar();
      pintarAvance();
      return cambioEstructura ? nuevaPartida() : null;
    }).then(function () {
      rearmarConfig();
      decir('Perfil puesto: ' + p.nombre + '. Puedes cambiar cada cosa.');
    });
  }

  function volverALaFabrica() {
    /* El diálogo de preguntar no se apila sobre este: se cierra el modal, se
       pregunta, y se vuelve a abrir (con lo que toque). */
    if (cfg && cfg.open) { ignorarCierre++; cfg.close(); }
    window.RetoDialogo.preguntar({
      titulo: 'Volver a los valores de fábrica',
      texto: 'Todos los ajustes de Secuencia vuelven a como venían. ' +
             'Tus resultados guardados no se borran.',
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
        /* El modal viejo se tira y se arma uno nuevo, para que todos los
           controles muestren los valores de fábrica. */
        if (cfg && cfg.parentNode) cfg.parentNode.removeChild(cfg);
        cfg = null;
        return nuevaPartida();
      }).then(function () {
        abrirConfig();
        decir('Ajustes de fábrica puestos.');
      });
    });
  }

  /* LOS AJUSTES MIENTRAS SE JUEGA. Abrirlos detiene lo que se está enseñando
     (no se puede ver la secuencia con un modal encima), y al cerrarlos la
     ronda se vuelve a enseñar desde el principio. Así nadie pierde la
     secuencia por tocar un ajuste. */
  function abrirConfig() {
    if (!cat) return;
    if (!reanudar && (estado === 'mostrando' || estado === 'pausa')) {
      cancelar();
      estado = 'pausa';
      ponerAccion('Ver otra vez', true, 'seguir');
      reanudar = true;
    }
    if (!cfg) armarConfig();
    pintarCuadrito();
    if (!cfg.open) cfg.showModal();
    var primero = cfg.querySelector('input, button');
    if (primero) primero.focus();
  }

  function cerrarConfig() {
    if (reanudar) {
      reanudar = false;
      if (estado === 'pausa') mostrar();
    }
  }

  /* ------------------------------------------------------------- arranque */

  function iniciar() {
    tableroEl = document.getElementById('tablero');
    avanceCajaEl = document.getElementById('avance-caja');
    rondaEl = document.getElementById('ronda');
    cuentasEl = document.getElementById('cuentas');
    barraEl = document.getElementById('barra');
    accionEl = document.getElementById('accion');
    mensajeEl = document.getElementById('mensaje');
    lectorEl = document.getElementById('lector');
    if (!tableroEl || !window.RetoDatos || !window.RetoDialogo) return;

    tableroEl.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.sec-boton');
      if (b) tocar(Number(b.getAttribute('data-i')));
    });
    document.addEventListener('keydown', enTeclado);

    accionEl.addEventListener('click', function () {
      if (accionEl.getAttribute('aria-disabled') === 'true') return;
      var que = accionEl.getAttribute('data-que');
      if (que === 'empezar') empezar();
      else if (que === 'seguir') mostrar();
      else if (que === 'otra') { if (cat) nuevaPartida(); else arrancar(); }
    });

    var btnConfig = document.querySelector('[data-configurar]');
    if (btnConfig) btnConfig.addEventListener('click', abrirConfig);
    var btnRepetir = document.querySelector('[data-repetir]');
    if (btnRepetir) btnRepetir.addEventListener('click', repetirSecuencia);
    var btnReinicio = document.querySelector('[data-reiniciar]');
    if (btnReinicio) btnReinicio.addEventListener('click', nuevaPartida);
    var btnAyuda = document.querySelector('[data-ayuda]');
    if (btnAyuda) {
      btnAyuda.addEventListener('click', function () {
        window.RetoDialogo.informar({
          titulo: 'Cómo se juega',
          texto: 'Mira cómo se encienden los botones, uno tras otro. Después ' +
            'tócalos en el mismo orden. Si lo logras, la secuencia crece un paso.\n\n' +
            'No hay reloj. Tú decides cuándo empezar y cuándo seguir. Si te ' +
            'equivocas no pasa nada: no suena ningún aviso, se vuelve a ver la ' +
            'secuencia y lo intentas otra vez. El botón del ojo la enseña de ' +
            'nuevo cuando quieras.\n\n' +
            'Con el teclado, las teclas del 1 al 9 tocan los botones (o la letra, ' +
            'si llevan letras). En los ajustes cambias los colores, las formas, ' +
            'la letra, el tamaño, el sonido, la voz y el movimiento.'
        });
      });
    }

    arrancar();
  }

  /* Pide lo que el juego ofrece y los ajustes guardados, y deja lista la
     primera partida. Es aparte de iniciar() para poder reintentarlo si el
     servidor no estaba abierto, sin volver a conectar los botones. */
  function arrancar() {
    ponerAccion('Un momento…', false);
    pedir('/catalogos').then(function (c) {
      cat = c;
      return cargarAjustes();
    }).then(function () {
      aplicarColores();
      aplicarForma();
      /* Los sonidos se descargan al entrar y no al primer toque: si se
         descargaran al tocar, el primer aviso llegaría tarde. */
      if (window.RetoSonido && window.RetoSonido.precargar) window.RetoSonido.precargar();
      return nuevaPartida();
    }).catch(falloDeRed);
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
