/* =============================================================================
   R.E.T.O. — STROOP
   -----------------------------------------------------------------------------
   El juego de Stroop: dos cosas compiten en la misma pantalla y hay que
   quedarse con UNA. En el clásico, la palabra "ROJO" escrita con tinta azul:
   el trabajo es tocar "azul" (lo que se ve) aunque la lectura se adelante
   diciendo "rojo". Entrena la atención selectiva y el control de impulsos.

  Este módulo implementa el Stroop integrado en Mini-juegos: página propia,
  ajustes que se guardan, controles compartidos y temas del sitio.

   LO QUE SE PUEDE ELEGIR, Y POR QUÉ ESTÁ AQUÍ
   El clásico depende de distinguir colores, y no todas las personas pueden. Por
   eso el conflicto se puede jugar con CUATRO tipos de estímulo, y cada uno es
   la misma idea con otro material:

     colores   la palabra de un color escrita con la tinta de otro.
     números   una cifra repetida: "3 3" (¿cuántas hay? ¿cuál es?).
     figuras   una figura con el nombre de otra escrito debajo.
     emojis    un emoji con el nombre de otro escrito debajo.

   Y en el modo de colores, cada color lleva además un SÍMBOLO (una forma) que
   acompaña a la tinta y a su botón. Así el color nunca es la única pista:
   quien no distingue rojo de verde puede jugar igual, siguiendo la forma. Hay
   también una paleta pensada para daltonismo.

   Se guardan con RetoDatos, con el prefijo "stroop-". Todo es del lado del
   navegador: no hay servidor de por medio, como en el prototipo.
   ========================================================================== */
(function () {
  'use strict';

  var PREFIJO = 'stroop-';

  /* ---------------------------------------------------------------------
     LOS AJUSTES Y SUS VALORES DE FÁBRICA

     Empieza en COLORES y en el nivel fácil (5 opciones, sin reloj, regla "lo
     que ves"), igual que el prototipo: lo primero que se ve tiene que ser
     lo que se puede terminar.

     Los NIVELES no son un ajuste aparte: son tres combinaciones de tres
     ajustes (opciones, tiempo y regla). Elegir un nivel los escribe, y cada uno
     se puede tocar por su cuenta en el modal. La pantalla marca el nivel cuyo
     valor coincide, y si no coincide ninguno, no marca ninguno.

     EL VOLUMEN va en cuatro pasos y manda sobre el general del sitio, con una
     excepción: el interruptor general sigue apagando todo (igual que Schulte).
     --------------------------------------------------------------------- */
  var FABRICA = {
    contenido: 'colores',
    emojis: 'animales',
    opciones: '5',
    tiempo: '0',
    regla: 'ver',
    paleta: 'clasica',
    simbolos: 'on',
    nombres: 'on',
    letra: '2',
    fuente: 'nunito',
    sonido: 'on',
    sonidoAcierto: 'ding',
    sonidoFallo: 'soft',
    volumen: '50'
  };

  /* Los colores de la pantalla: SOLO el fondo del estímulo y el texto, como en
     Schulte. Vacío = el del tema (o el fondo oscuro de los colores, ver CSS). */
  var COLOR_FABRICA = { fondo: '', texto: '' };

  var VARIABLE = {
    fondo: '--stroop-fondo',
    texto: '--stroop-texto'
  };

  /* Los tres niveles del prototipo, con sus mismos valores. */
  var NIVELES = {
    facil:   { opciones: '5', tiempo: '0',    regla: 'ver' },
    medio:   { opciones: '5', tiempo: '2500', regla: 'ver' },
    dificil: { opciones: '7', tiempo: '3000', regla: 'mixta' }
  };

  /* El tiempo por ronda, en milisegundos. "0" es sin reloj. */
  var TIEMPOS = [
    ['0', 'Sin reloj'],
    ['5000', '5 segundos'],
    ['3500', '3,5 segundos'],
    ['3000', '3 segundos'],
    ['2500', '2,5 segundos'],
    ['2000', '2 segundos']
  ];

  /* El tamaño del estímulo, en rem. Tres pasos, como en Schulte. */
  var LETRAS = [
    { id: '1', nombre: 'Pequeña', valor: '1.8' },
    { id: '2', nombre: 'Mediana', valor: '2.6' },
    { id: '3', nombre: 'Grande', valor: '3.6' }
  ];

  /* Los mismos tres sonidos del sitio. */
  var SONIDOS = [
    { id: 'ding', nombre: 'Ding' },
    { id: 'charm', nombre: 'Charm' },
    { id: 'soft', nombre: 'Suave' }
  ];

  /* Cuánto se queda el aviso de "bien" o "era tal" antes de pasar a la
     siguiente ronda. Es el del prototipo. */
  var PAUSA_ACIERTO = 650;
  var PAUSA_FALLO = 900;

  /* La regla de la ronda cuando es "mezclar": una de cada tres veces se pide lo
     que DICE. Es el 0,3 del prototipo. */
  var PROBABILIDAD_PALABRA = 0.3;

  /* ---------------------------------------------------------------------
     EL MATERIAL
     --------------------------------------------------------------------- */

  /* Las figuras, dibujadas una sola vez y usadas en tres sitios: como figura del
     modo "figuras", como símbolo de cada color, y en los botones. Son
     rellenas y con la tinta del texto (currentColor), así toman el color de
     donde se pongan. */
  var FORMAS = [
    { id: 'circulo',   nombre: 'Círculo',   dibujo: '<circle cx="12" cy="12" r="9"/>' },
    { id: 'cuadrado',  nombre: 'Cuadrado',  dibujo: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/>' },
    { id: 'triangulo', nombre: 'Triángulo', dibujo: '<polygon points="12,3 22,20 2,20"/>' },
    { id: 'rombo',     nombre: 'Rombo',     dibujo: '<polygon points="12,2 22,12 12,22 2,12"/>' },
    { id: 'estrella',  nombre: 'Estrella',  dibujo: '<polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6"/>' },
    { id: 'cruz',      nombre: 'Cruz',      dibujo: '<polygon points="9,2 15,2 15,9 22,9 22,15 15,15 15,22 9,22 9,15 2,15 2,9 9,9"/>' },
    { id: 'hexagono',  nombre: 'Hexágono',  dibujo: '<polygon points="12,2 20.7,7 20.7,17 12,22 3.3,17 3.3,7"/>' }
  ];

  /* Dos paletas de siete colores, sobre un fondo oscuro (el estímulo de colores
     siempre va sobre oscuro: el amarillo sobre blanco no se lee).

     CLÁSICA: las del prototipo, un poco más claras para el fondo oscuro.
     PARA DALTONISMO: parte de la paleta Okabe-Ito, que está pensada para
     distinguirse con las formas más comunes de daltonismo, con el azul y el
     rosa subidos de brillo para que se vean sobre oscuro. Aun así cada color
     lleva su símbolo: la paleta ayuda, el símbolo asegura. */
  var PALETAS = {
    clasica: {
      nombre: 'Clásica',
      colores: [
        { nombre: 'Rojo',     hex: '#ef5b3a' },
        { nombre: 'Azul',     hex: '#4f9de0' },
        { nombre: 'Verde',    hex: '#2fb36d' },
        { nombre: 'Amarillo', hex: '#f2c94c' },
        { nombre: 'Morado',   hex: '#9b7be0' },
        { nombre: 'Naranja',  hex: '#f2994a' },
        { nombre: 'Rosa',     hex: '#e0779e' }
      ]
    },
    daltonismo: {
      nombre: 'Para daltonismo',
      colores: [
        { nombre: 'Naranja',  hex: '#e69f00' },
        { nombre: 'Celeste',  hex: '#56b4e9' },
        { nombre: 'Verde',    hex: '#2bc49a' },
        { nombre: 'Amarillo', hex: '#f0e442' },
        { nombre: 'Azul',     hex: '#4f7cff' },
        { nombre: 'Rojo',     hex: '#e8603c' },
        { nombre: 'Rosa',     hex: '#e58bc0' }
      ]
    }
  };

  var NUMEROS = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete'];

  /* Tres juegos de emojis de siete, para que cada quien juegue con lo que
     reconoce al instante. */
  var EMOJIS = {
    animales: {
      nombre: 'Animales',
      lista: [
        ['🐶', 'Perro'], ['🐱', 'Gato'], ['🐰', 'Conejo'], ['🐸', 'Rana'],
        ['🐼', 'Panda'], ['🐵', 'Mono'], ['🐷', 'Cerdo']
      ]
    },
    frutas: {
      nombre: 'Frutas',
      lista: [
        ['🍎', 'Manzana'], ['🍌', 'Plátano'], ['🍇', 'Uvas'], ['🍓', 'Fresa'],
        ['🍊', 'Naranja'], ['🍉', 'Sandía'], ['🍍', 'Piña']
      ]
    },
    transportes: {
      nombre: 'Transportes',
      lista: [
        ['🚗', 'Coche'], ['🚲', 'Bici'], ['✈️', 'Avión'], ['🚌', 'Autobús'],
        ['⛵', 'Velero'], ['🚀', 'Cohete'], ['🚂', 'Tren']
      ]
    }
  };

  var CONTENIDOS = [
    ['colores', 'Colores'],
    ['numeros', 'Números'],
    ['figuras', 'Figuras'],
    ['emojis', 'Emojis']
  ];

  /* Lo que se pide en cada tipo, con las palabras de cada tipo. "ver" es lo que
     se VE; "palabra" es lo que DICE (o, en los números, la cifra). */
  var TEXTOS = {
    colores: {
      ver:     { instruccion: 'Toca el <strong>color de la tinta</strong>, no lo que dice la palabra.',
                 etiqueta: '👁️ Toca el COLOR de la tinta' },
      palabra: { instruccion: 'Toca el color que <strong>dice la palabra</strong>, no el de la tinta.',
                 etiqueta: '🔤 Toca lo que DICE la palabra' }
    },
    numeros: {
      ver:     { instruccion: 'Toca <strong>cuántos números hay</strong>, no cuál número es.',
                 etiqueta: '👁️ Toca CUÁNTOS números hay' },
      palabra: { instruccion: 'Toca <strong>qué número es</strong>, no cuántos hay.',
                 etiqueta: '🔤 Toca QUÉ número es' }
    },
    figuras: {
      ver:     { instruccion: 'Toca la <strong>figura que ves</strong>, no la que dice la palabra.',
                 etiqueta: '👁️ Toca la FIGURA que ves' },
      palabra: { instruccion: 'Toca la figura que <strong>dice la palabra</strong>, no la que ves.',
                 etiqueta: '🔤 Toca lo que DICE la palabra' }
    },
    emojis: {
      ver:     { instruccion: 'Toca el <strong>emoji que ves</strong>, no el que dice la palabra.',
                 etiqueta: '👁️ Toca el EMOJI que ves' },
      palabra: { instruccion: 'Toca el emoji que <strong>dice la palabra</strong>, no el que ves.',
                 etiqueta: '🔤 Toca lo que DICE la palabra' }
    }
  };

  var TEXTO_MIXTA = 'La regla puede cambiar en cada ronda: <strong>fíjate en la etiqueta</strong> de arriba antes de tocar.';

  /* ---------------------------------------------------------------------
     EL ESTADO
     De una sola pieza y aquí, no repartido por el DOM.
     --------------------------------------------------------------------- */
  var ajustes = {};
  var colores = {};

  var aciertos = 0;
  var intentos = 0;
  var racha = 0;
  var mejor = 0;

  var ronda = null;          // { v, d, regla, esperado } o null
  var resuelta = true;       // ¿ya se contestó (o se acabó el tiempo) esta ronda?
  var ultimaPareja = '';     // para no repetir el mismo estímulo dos veces seguidas
  var inicioRonda = 0;
  var idReloj = null;        // requestAnimationFrame del reloj
  var idSiguiente = null;    // setTimeout de la pausa entre rondas
  var generacion = 0;        // sube al reiniciar: invalida respuestas viejas de RetoDatos

  var estimuloEl, escenarioEl, reglaEl, feedbackEl, opcionesEl, instruccionEl,
      tiempoEl, rellenoEl, lectorEl, nivelesEl;
  var statAciertos, statRacha, statMejor;
  var cfg = null;
  var cfgAbierto = false;

  /* ---------------------------------------------------------- utilidades */

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function vaciar(nodo) {
    while (nodo && nodo.firstChild) nodo.removeChild(nodo.firstChild);
  }

  function azar(n) {
    return Math.floor(Math.random() * n);
  }

  function capital(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
  }

  /* Un texto legible (negro o blanco) sobre un color de fondo. Se decide con la
     luminancia relativa, que es la que usan las pautas de contraste: así el
     "Amarillo" lleva letras negras y el "Azul" blancas sin escribirlo a mano. */
  function textoSobre(hex) {
    var n = parseInt(hex.slice(1), 16);
    function canal(c) {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    var l = 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
    return l > 0.4 ? '#14151d' : '#ffffff';
  }

  function elForma(id) {
    var f = FORMAS.filter(function (x) { return x.id === id; })[0] || FORMAS[0];
    var caja = el('span', 'stroop-forma');
    caja.setAttribute('aria-hidden', 'true');
    caja.innerHTML = '<svg viewBox="0 0 24 24" focusable="false" fill="currentColor">' + f.dibujo + '</svg>';
    return caja;
  }

  /* ----------------------------------------------------------- avisos */

  function avisar(texto) {
    if (lectorEl) lectorEl.textContent = texto;
  }

  function feedback(texto, tipo) {
    if (!feedbackEl) return;
    feedbackEl.textContent = texto || '';
    feedbackEl.setAttribute('data-tipo', tipo || '');
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

  /* Los colores, el tamaño y la fuente van al <html>, no a la pantalla: así los
     heredan tanto el juego como el cuadrito del modal, y la vista previa se
     mueve al instante sin copiar nada. Un vacío quita la variable y el
     "var(--x, el-del-tema)" del CSS vuelve a mandar. */
  function aplicarColores() {
    var r = document.documentElement;
    Object.keys(VARIABLE).forEach(function (clave) {
      if (colores[clave]) r.style.setProperty(VARIABLE[clave], colores[clave]);
      else r.style.removeProperty(VARIABLE[clave]);
    });
  }

  function aplicarForma() {
    var r = document.documentElement;
    var letra = LETRAS.filter(function (l) { return l.id === ajustes.letra; })[0] || LETRAS[1];
    r.style.setProperty('--stroop-letra', letra.valor);
    r.style.setProperty('--stroop-fuente', '"' + ajustes.fuente + '", var(--font)');
  }

  function tocarSonido(que) {
    if (ajustes.sonido !== 'on' || !window.RetoSonido) return;
    var clave = que === 'fallo' ? ajustes.sonidoFallo : ajustes.sonidoAcierto;
    var volumen = (parseInt(ajustes.volumen, 10) || 50) / 100;
    window.RetoSonido.reproducir(clave, volumen);
  }

  /* ----------------------------------------------------------- el material */

  function cuantas() {
    var n = parseInt(ajustes.opciones, 10);
    return (n >= 3 && n <= 7) ? n : 5;
  }

  /* Los siete elementos del tipo elegido, siempre en el mismo orden. El juego usa
     los primeros N (los de "opciones"). Cada uno lleva lo que hace falta para
     dibujarse como estímulo y como botón. */
  function elementos() {
    var c = ajustes.contenido;
    if (c === 'numeros') {
      return NUMEROS.map(function (nombre, i) {
        return { indice: i, nombre: nombre, valor: i + 1 };
      });
    }
    if (c === 'figuras') {
      return FORMAS.map(function (f, i) {
        return { indice: i, nombre: f.nombre, forma: f.id };
      });
    }
    if (c === 'emojis') {
      var juego = EMOJIS[ajustes.emojis] || EMOJIS.animales;
      return juego.lista.map(function (par, i) {
        return { indice: i, nombre: par[1], emoji: par[0] };
      });
    }
    var paleta = PALETAS[ajustes.paleta] || PALETAS.clasica;
    return paleta.colores.map(function (col, i) {
      return { indice: i, nombre: col.nombre, hex: col.hex, forma: FORMAS[i].id };
    });
  }

  /* Dibuja el estímulo: `v` es lo que se VE y `d` lo que DICE. Devuelve la
     descripción para quien no lo ve (el lector de pantalla). */
  function dibujarEstimulo(destino, v, d) {
    vaciar(destino);
    var c = ajustes.contenido;

    if (c === 'colores') {
      var palabra = el('span', 'stroop-palabra', d.nombre.toUpperCase());
      palabra.style.color = v.hex;
      destino.appendChild(palabra);
      if (ajustes.simbolos === 'on') {
        var marca = elForma(v.forma);
        marca.classList.add('stroop-marca');
        marca.style.color = v.hex;
        destino.appendChild(marca);
      }
      return 'La palabra ' + d.nombre + ' escrita en color ' + v.nombre.toLowerCase();
    }

    if (c === 'numeros') {
      for (var i = 0; i < v.valor; i++) destino.appendChild(el('span', 'stroop-cifra', String(d.valor)));
      return 'El número ' + d.valor + ' repetido ' + v.valor + (v.valor === 1 ? ' vez' : ' veces');
    }

    var columna = el('div', 'stroop-columna');
    if (c === 'figuras') {
      var fig = elForma(v.forma);
      fig.classList.add('stroop-figura');
      columna.appendChild(fig);
    } else {
      columna.appendChild(el('span', 'stroop-emoji', v.emoji));
    }
    columna.appendChild(el('span', 'stroop-rotulo', d.nombre.toUpperCase()));
    destino.appendChild(columna);
    return (c === 'figuras' ? 'Una figura: ' : 'Un emoji: ') + v.nombre.toLowerCase()
      + ', con la palabra ' + d.nombre;
  }

  /* Un botón de respuesta. */
  function crearOpcion(item, posicion) {
    var b = el('button', 'stroop-opcion');
    b.type = 'button';
    b.setAttribute('data-indice', String(item.indice));
    b.setAttribute('data-atajo', String(posicion + 1));
    var c = ajustes.contenido;
    var nombre = item.nombre;

    if (c === 'colores') {
      b.style.background = item.hex;
      b.style.color = textoSobre(item.hex);
      b.style.borderColor = textoSobre(item.hex);
      if (ajustes.simbolos === 'on') b.appendChild(elForma(item.forma));
      if (ajustes.nombres === 'on') b.appendChild(el('span', 'stroop-opcion-nombre', nombre));
    } else if (c === 'numeros') {
      b.appendChild(el('span', 'stroop-opcion-cifra', String(item.valor)));
      if (ajustes.nombres === 'on') b.appendChild(el('span', 'stroop-opcion-nombre', nombre));
      nombre = 'Número ' + item.valor;
    } else if (c === 'figuras') {
      b.appendChild(elForma(item.forma));
      if (ajustes.nombres === 'on') b.appendChild(el('span', 'stroop-opcion-nombre', nombre));
    } else {
      b.appendChild(el('span', 'stroop-opcion-emoji', item.emoji));
      if (ajustes.nombres === 'on') b.appendChild(el('span', 'stroop-opcion-nombre', nombre));
    }
    b.setAttribute('aria-label', nombre + ' (tecla ' + (posicion + 1) + ')');
    return b;
  }

  function construirOpciones() {
    if (!opcionesEl) return;
    vaciar(opcionesEl);
    var n = cuantas();
    opcionesEl.setAttribute('data-cantidad', String(n));
    elementos().slice(0, n).forEach(function (item, i) {
      var b = crearOpcion(item, i);
      if (n % 2 !== 0 && i === n - 1) b.classList.add('impar-solo');
      opcionesEl.appendChild(b);
    });
  }

  /* ---------------------------------------------------------- las pantallas */

  function pintarStats() {
    if (statAciertos) statAciertos.textContent = aciertos + ' / ' + intentos;
    if (statRacha) statRacha.textContent = String(racha);
    if (statMejor) statMejor.textContent = String(mejor);
  }

  /* Un nivel está "puesto" cuando sus tres valores coinciden con los ajustes. */
  function nivelActual() {
    var hallado = '';
    Object.keys(NIVELES).forEach(function (k) {
      var n = NIVELES[k];
      if (ajustes.opciones === n.opciones && ajustes.tiempo === n.tiempo && ajustes.regla === n.regla) hallado = k;
    });
    return hallado;
  }

  function pintarNiveles() {
    if (!nivelesEl) return;
    var actual = nivelActual();
    Array.prototype.forEach.call(nivelesEl.querySelectorAll('[data-nivel]'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-nivel') === actual ? 'true' : 'false');
    });
  }

  function pintarInstruccion() {
    if (!instruccionEl) return;
    var t = TEXTOS[ajustes.contenido] || TEXTOS.colores;
    if (ajustes.regla === 'mixta') instruccionEl.innerHTML = TEXTO_MIXTA;
    else instruccionEl.innerHTML = (ajustes.regla === 'palabra' ? t.palabra : t.ver).instruccion;
  }

  /* ----------------------------------------------------- la mejor racha */

  /* La mejor racha es de CADA combinación: lo que se logra con tres opciones
     sin reloj no es comparable con lo que se logra con siete y reloj. */
  function claveMejor() {
    return PREFIJO + 'mejor-' + [
      ajustes.contenido,
      ajustes.contenido === 'emojis' ? ajustes.emojis : '-',
      ajustes.opciones, ajustes.tiempo, ajustes.regla
    ].join('-');
  }

  function cargarMejor(gen) {
    return window.RetoDatos.obtener(claveMejor()).then(function (v) {
      if (gen !== generacion) return;
      mejor = Number(v) || 0;
      pintarStats();
    });
  }

  /* ------------------------------------------------------------- el reloj */

  function detenerReloj() {
    if (idReloj !== null) { cancelAnimationFrame(idReloj); idReloj = null; }
  }

  function detenerPausa() {
    if (idSiguiente !== null) { clearTimeout(idSiguiente); idSiguiente = null; }
  }

  /* El reloj lo mueve JavaScript y no una animación de CSS. Es una decisión
     de fondo: cuando alguien apaga las animaciones (o su sistema pide menos
     movimiento) el sitio quita TODAS las animaciones, y una barra hecha con
     CSS saltaría vacía de golpe. El tiempo que queda es información, no
     adorno, y tiene que verse siempre. */
  function arrancarReloj() {
    detenerReloj();
    var limite = parseInt(ajustes.tiempo, 10) || 0;
    if (!tiempoEl) return;
    if (!limite) { tiempoEl.hidden = true; return; }
    tiempoEl.hidden = false;
    rellenoEl.style.setProperty('--stroop-resto', '1');
    inicioRonda = performance.now();
    function paso(ahora) {
      var resto = 1 - (ahora - inicioRonda) / limite;
      if (resto <= 0) {
        idReloj = null;
        rellenoEl.style.setProperty('--stroop-resto', '0');
        tiempoAgotado();
        return;
      }
      rellenoEl.style.setProperty('--stroop-resto', String(resto));
      idReloj = requestAnimationFrame(paso);
    }
    idReloj = requestAnimationFrame(paso);
  }

  /* ---------------------------------------------------------------- rondas */

  function nombreEsperado() {
    var item = elementos()[ronda.esperado];
    if (ajustes.contenido === 'numeros') return item.valor + ' (' + item.nombre.toLowerCase() + ')';
    return item.nombre;
  }

  function nuevaRonda() {
    detenerReloj();
    detenerPausa();
    if (cfgAbierto || !estimuloEl) return;

    var todos = elementos().slice(0, cuantas());
    var v, d, clave;
    /* Nunca el mismo estímulo dos veces seguidas: se notaría como un fallo del
       juego y no pone nada a prueba. */
    var intentosDeSorteo = 0;
    do {
      v = todos[azar(todos.length)];
      d = todos[azar(todos.length)];
      clave = ajustes.contenido + ':' + v.indice + ':' + d.indice;
      intentosDeSorteo++;
    } while (clave === ultimaPareja && intentosDeSorteo < 20);
    ultimaPareja = clave;

    var regla = ajustes.regla === 'mixta'
      ? (Math.random() < PROBABILIDAD_PALABRA ? 'palabra' : 'ver')
      : ajustes.regla;
    ronda = { v: v, d: d, regla: regla, esperado: regla === 'ver' ? v.indice : d.indice };
    resuelta = false;

    escenarioEl.setAttribute('data-contenido', ajustes.contenido);
    estimuloEl.setAttribute('aria-label', dibujarEstimulo(estimuloEl, v, d));
    /* Se reinicia la animación de entrada quitando y poniendo la clase. */
    estimuloEl.classList.remove('stroop-entra');
    void estimuloEl.offsetWidth;
    estimuloEl.classList.add('stroop-entra');

    var textos = TEXTOS[ajustes.contenido] || TEXTOS.colores;
    if (ajustes.regla === 'mixta') {
      reglaEl.hidden = false;
      reglaEl.textContent = (regla === 'ver' ? textos.ver : textos.palabra).etiqueta;
    } else {
      reglaEl.hidden = true;
    }

    feedback('', '');
    Array.prototype.forEach.call(opcionesEl.children, function (b) {
      b.removeAttribute('data-estado');
      b.removeAttribute('aria-disabled');
    });
    avisar(estimuloEl.getAttribute('aria-label') + '. '
      + (regla === 'ver' ? textos.ver : textos.palabra).etiqueta.replace(/^\S+\s/, ''));
    arrancarReloj();
  }

  function marcarCorrecta() {
    var b = opcionesEl.querySelector('[data-indice="' + ronda.esperado + '"]');
    if (b) b.setAttribute('data-estado', 'bien');
    return b;
  }

  function bloquear() {
    Array.prototype.forEach.call(opcionesEl.children, function (b) {
      b.setAttribute('aria-disabled', 'true');
    });
  }

  function responder(indice) {
    if (resuelta || !ronda) return;
    resuelta = true;
    detenerReloj();
    bloquear();
    intentos++;
    var acierto = indice === ronda.esperado;
    if (acierto) {
      aciertos++;
      racha++;
      if (racha > mejor) {
        mejor = racha;
        window.RetoDatos.poner(claveMejor(), mejor);
      }
      marcarCorrecta();
      feedback('✅ ¡Bien!', 'bien');
      avisar('Correcto');
      tocarSonido('acierto');
    } else {
      racha = 0;
      marcarCorrecta();
      var mala = opcionesEl.querySelector('[data-indice="' + indice + '"]');
      if (mala) mala.setAttribute('data-estado', 'mal');
      feedback('Era ' + nombreEsperado(), 'mal');
      avisar('Incorrecto. Era ' + nombreEsperado());
      tocarSonido('fallo');
    }
    pintarStats();
    idSiguiente = setTimeout(nuevaRonda, acierto ? PAUSA_ACIERTO : PAUSA_FALLO);
  }

  function tiempoAgotado() {
    if (resuelta || !ronda) return;
    resuelta = true;
    bloquear();
    intentos++;
    racha = 0;
    marcarCorrecta();
    feedback('⏱️ Se acabó el tiempo. Era ' + nombreEsperado(), 'mal');
    avisar('Se acabó el tiempo. Era ' + nombreEsperado());
    tocarSonido('fallo');
    pintarStats();
    idSiguiente = setTimeout(nuevaRonda, PAUSA_FALLO);
  }

  /* Empezar de cero: estadísticas a cero, botones nuevos y una ronda nueva. Se
     llama al cambiar de nivel, al reiniciar y cuando cambia un ajuste que
     cambia el juego (el tipo, las opciones, el tiempo, la regla). */
  function reiniciarJuego() {
    generacion++;
    var gen = generacion;
    detenerReloj();
    detenerPausa();
    aciertos = 0; intentos = 0; racha = 0; mejor = 0;
    ronda = null;
    resuelta = true;
    ultimaPareja = '';
    construirOpciones();
    pintarInstruccion();
    pintarNiveles();
    pintarStats();
    feedback('', '');
    return cargarMejor(gen).then(function () {
      if (gen === generacion) nuevaRonda();
    });
  }

  function elegirNivel(clave) {
    var n = NIVELES[clave];
    if (!n) return;
    Promise.all([
      guardarAjuste('opciones', n.opciones),
      guardarAjuste('tiempo', n.tiempo),
      guardarAjuste('regla', n.regla)
    ]).then(reiniciarJuego);
  }

  function enTeclado(e) {
    if (cfgAbierto || e.ctrlKey || e.metaKey || e.altKey) return;
    var n = parseInt(e.key, 10);
    if (!(n >= 1 && n <= cuantas())) return;
    var b = opcionesEl.querySelector('[data-atajo="' + n + '"]');
    if (b) {
      e.preventDefault();
      responder(Number(b.getAttribute('data-indice')));
    }
  }

  /* --------------------------------------------------------------- el modal */

  /* Un grupo del modal: el <fieldset> y el <legend> del sitio. */
  function grupo(legenda, ayuda) {
    var fs = document.createElement('fieldset');
    fs.appendChild(el('legend', null, legenda));
    if (ayuda) fs.appendChild(el('p', 'ayuda', ayuda));
    cfg.appendChild(fs);
    return fs;
  }

  function opcionRadio(nombre, valor, texto, elegido, alCambiar) {
    var op = el('label', 'opcion');
    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = nombre;
    radio.value = valor;
    if (valor === elegido) radio.checked = true;
    radio.addEventListener('change', function () {
      if (!this.checked) return;
      alCambiar(valor);
    });
    op.appendChild(radio);
    op.appendChild(el('span', null, texto));
    return op;
  }

  function grupoRadios(nombre, lista, elegido, alCambiar) {
    var caja = el('div', 'opciones');
    caja.setAttribute('role', 'radiogroup');
    lista.forEach(function (par) {
      caja.appendChild(opcionRadio(nombre, par[0], par[1], elegido, alCambiar));
    });
    return caja;
  }

  function interruptor(clave, texto, explicacion, alCambiar) {
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
      guardarAjuste(clave, v).then(function () {
        if (alCambiar) alCambiar(v);
      });
    });
    label.appendChild(input);
    label.appendChild(caja);
    label.appendChild(rotulo);
    return label;
  }

  /* Un campo de color, igual que en Schulte y en los modos de lectura: la
     rueda, y un campo de hexadecimal que se puede dejar vacío para volver al
     color del tema. */
  function filaColor(clave, titulo) {
    var campo = el('div', 'ajustes-campo');
    var id = 'ajustes-color-' + clave;
    var etiqueta = el('label', '', titulo);
    etiqueta.setAttribute('for', id);
    campo.appendChild(etiqueta);

    var fila = el('div', 'ajustes-color-fila');
    var rueda = el('input', 'ajustes-color-rueda');
    rueda.type = 'color';
    rueda.id = id;
    rueda.value = colores[clave] || '#ffffff';

    var hex = el('input', 'editor-campo ajustes-color-hex');
    hex.type = 'text';
    hex.maxLength = 7;
    hex.spellcheck = false;
    hex.value = colores[clave];
    hex.placeholder = 'del tema';
    hex.setAttribute('aria-label', titulo + ' en código hexadecimal');

    function cambia(v) {
      var valor = (v === '' || v === null) ? '' : String(v).trim().toLowerCase();
      /* Solo un hexadecimal de seis: un "#ff" mal escrito no se guarda. */
      if (valor && !/^#[0-9a-f]{6}$/.test(valor)) return;
      rueda.value = valor || '#ffffff';
      hex.value = valor;
      guardarColor(clave, valor);
    }
    rueda.addEventListener('input', function () { cambia(this.value); });
    hex.addEventListener('change', function () { cambia(this.value); });

    fila.appendChild(rueda);
    fila.appendChild(hex);
    campo.appendChild(fila);
    return campo;
  }

  function menuSonido(clave, cuando) {
    var caja = el('div', 'ajustes-sonido');
    var id = 'stroop-' + clave;
    var etiqueta = el('label', 'editor-label', cuando);
    etiqueta.setAttribute('for', id);
    caja.appendChild(etiqueta);

    var select = document.createElement('select');
    select.className = 'editor-campo';
    select.id = id;
    SONIDOS.forEach(function (s) {
      var op = el('option', '', s.nombre);
      op.value = s.id;
      if (s.id === ajustes[clave]) op.selected = true;
      select.appendChild(op);
    });
    select.addEventListener('change', function () {
      guardarAjuste(clave, this.value).then(function () {
        tocarSonido(clave === 'sonidoFallo' ? 'fallo' : 'acierto');
      });
    });
    caja.appendChild(select);
    return caja;
  }

  function pintarListaFuentes(select) {
    if (!window.RetoFuentes) return Promise.resolve();
    return window.RetoFuentes.lista().then(function (todas) {
      vaciar(select);
      todas.forEach(function (f) {
        var op = el('option', '', f.nombre);
        op.value = f.id;
        op.style.fontFamily = '"' + f.id + '", sans-serif';
        if (f.id === ajustes.fuente) op.selected = true;
        select.appendChild(op);
      });
    });
  }

  /* EL CUADRITO DEL MODAL, PRIMERO DE TODO.
     Es lo que se mira mientras se cambia algo: un estímulo de muestra y tres
     botones, hechos con las MISMAS funciones y las mismas clases que el juego.
     Por eso lo que se ve aquí es lo que se ve jugando, sin ser una copia.
     Con colores y tamaño en el <html>, los hereda al instante. */
  function pintarCuadrito() {
    if (!cfg) return;
    var caja = cfg.querySelector('.stroop-cuadrito');
    if (!caja) return;
    vaciar(caja);

    var todos = elementos();
    var raiz = el('div', 'stroop stroop-previa');
    var esc = el('div', 'stroop-escenario');
    esc.setAttribute('data-contenido', ajustes.contenido);
    esc.setAttribute('aria-hidden', 'true');
    var est = el('div', 'stroop-estimulo');
    dibujarEstimulo(est, todos[1], todos[2] || todos[0]);
    esc.appendChild(est);
    raiz.appendChild(esc);

    var ops = el('div', 'stroop-opciones');
    ops.setAttribute('aria-hidden', 'true');
    todos.slice(0, 3).forEach(function (item, i) {
      ops.appendChild(crearOpcion(item, i));
    });
    raiz.appendChild(ops);
    caja.appendChild(raiz);
  }

  /* Lo que solo tiene sentido con ciertos tipos se esconde con los demás, en
     vez de quedarse en el modal sin hacer nada. */
  function actualizarVisibilidad() {
    if (!cfg) return;
    Array.prototype.forEach.call(cfg.querySelectorAll('[data-solo]'), function (g) {
      g.hidden = g.getAttribute('data-solo').split(' ').indexOf(ajustes.contenido) === -1;
    });
  }

  /* Un cambio que cambia el juego: se actualiza el cuadrito y se empieza de
     cero (las estadísticas de una combinación no valen para otra). La ronda
     nueva no arranca hasta cerrar el modal. */
  function cambioDeJuego() {
    pintarCuadrito();
    actualizarVisibilidad();
    reiniciarJuego();
  }

  /* Un cambio solo de apariencia: se vuelven a dibujar los botones y el
     cuadrito, y el juego sigue donde estaba. */
  function cambioDeApariencia() {
    pintarCuadrito();
    construirOpciones();
  }

  function armarConfig() {
    cfg = document.createElement('dialog');
    cfg.className = 'dialogo stroop-config';
    cfg.setAttribute('aria-labelledby', 'stroop-cfg-titulo');

    var titulo = el('h2', 'dialogo-titulo', 'Ajustes de Stroop');
    titulo.id = 'stroop-cfg-titulo';
    cfg.appendChild(titulo);

    cfg.appendChild(el('div', 'stroop-cuadrito'));

    /* --- qué se juega */
    var gTipo = grupo('Con qué se juega',
      'El mismo juego con otro material: colores, números, figuras o emojis. '
      + 'Escoge el que te resulte más fácil de distinguir.');
    gTipo.appendChild(grupoRadios('stroop-contenido', CONTENIDOS, ajustes.contenido, function (v) {
      guardarAjuste('contenido', v).then(cambioDeJuego);
    }));

    var gEmojis = grupo('Los emojis',
      'Siete de cada tipo: escoge los que reconozcas al instante.');
    gEmojis.setAttribute('data-solo', 'emojis');
    gEmojis.appendChild(grupoRadios('stroop-emojis',
      Object.keys(EMOJIS).map(function (k) { return [k, EMOJIS[k].nombre]; }),
      ajustes.emojis, function (v) {
        guardarAjuste('emojis', v).then(cambioDeJuego);
      }));

    /* --- la dificultad */
    var gDif = grupo('La dificultad',
      'Los niveles de la pantalla son combinaciones de estos tres ajustes: aquí '
      + 'puedes armar la tuya.');
    gDif.appendChild(el('p', 'editor-label', 'Cuántas opciones'));
    gDif.appendChild(grupoRadios('stroop-opciones',
      [['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7', '7']],
      ajustes.opciones, function (v) {
        guardarAjuste('opciones', v).then(cambioDeJuego);
      }));

    gDif.appendChild(el('p', 'editor-label', 'Qué hay que tocar'));
    gDif.appendChild(grupoRadios('stroop-regla', [
      ['ver', 'Lo que ves'],
      ['palabra', 'Lo que dice'],
      ['mixta', 'Mezclar las dos']
    ], ajustes.regla, function (v) {
      guardarAjuste('regla', v).then(cambioDeJuego);
    }));

    var cajaTiempo = el('div', 'ajustes-sonido');
    var etTiempo = el('label', 'editor-label', 'Tiempo por ronda');
    etTiempo.setAttribute('for', 'stroop-tiempo');
    cajaTiempo.appendChild(etTiempo);
    var selTiempo = document.createElement('select');
    selTiempo.className = 'editor-campo';
    selTiempo.id = 'stroop-tiempo';
    TIEMPOS.forEach(function (par) {
      var op = el('option', '', par[1]);
      op.value = par[0];
      if (par[0] === ajustes.tiempo) op.selected = true;
      selTiempo.appendChild(op);
    });
    selTiempo.addEventListener('change', function () {
      guardarAjuste('tiempo', this.value).then(cambioDeJuego);
    });
    cajaTiempo.appendChild(selTiempo);
    gDif.appendChild(cajaTiempo);

    /* --- las ayudas */
    var gAyudas = grupo('Ayudas',
      'Para que el color nunca sea la única pista.');
    var inter1 = interruptor('simbolos', 'Símbolo junto a cada color',
      'Cada color lleva una forma (círculo, cuadrado, triángulo…). Sale junto a '
      + 'la palabra y en su botón, para seguir la forma si el color no se distingue.',
      cambioDeApariencia);
    inter1.setAttribute('data-solo', 'colores');
    gAyudas.appendChild(inter1);
    gAyudas.appendChild(interruptor('nombres', 'Nombre en los botones',
      'Escribe debajo de cada botón cómo se llama. Apagado, solo se ve el dibujo.',
      cambioDeApariencia));

    var gPaleta = grupo('Los colores del juego',
      'La paleta para daltonismo usa colores que se distinguen mejor entre sí con '
      + 'las formas más comunes de daltonismo.');
    gPaleta.setAttribute('data-solo', 'colores');
    gPaleta.appendChild(grupoRadios('stroop-paleta',
      Object.keys(PALETAS).map(function (k) { return [k, PALETAS[k].nombre]; }),
      ajustes.paleta, function (v) {
        guardarAjuste('paleta', v).then(cambioDeJuego);
      }));

    /* --- la letra */
    var gLetra = grupo('La letra',
      'El tamaño del estímulo (la palabra, las cifras, la figura o el emoji) y la fuente.');
    gLetra.appendChild(grupoRadios('stroop-letra',
      LETRAS.map(function (l) { return [l.id, l.nombre]; }),
      ajustes.letra, function (v) {
        guardarAjuste('letra', v).then(function () {
          aplicarForma();
          pintarCuadrito();
        });
      }));

    var filaFuente = el('div', 'ajustes-fuente-fila');
    var select = document.createElement('select');
    select.className = 'editor-campo';
    select.id = 'stroop-fuente';
    var labelFuente = el('label', 'oculto-a-la-vista', 'Fuente del juego');
    labelFuente.setAttribute('for', 'stroop-fuente');
    filaFuente.appendChild(labelFuente);
    filaFuente.appendChild(select);
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

    select.addEventListener('change', function () {
      guardarAjuste('fuente', this.value).then(function () {
        aplicarForma();
        pintarCuadrito();
      });
    });

    /* --- el sonido */
    var gSonido = grupo('El sonido',
      'Un aviso corto al acertar y otro al fallar. Si en Configuración → Sonido '
      + 'está apagado, aquí no se oye nada.');
    gSonido.appendChild(interruptor('sonido', 'Activar el sonido',
      'Con esto apagado, el juego no suena. El interruptor general del sitio '
      + 'también manda y apaga todo.'));
    gSonido.appendChild(menuSonido('sonidoAcierto', 'Al acertar'));
    gSonido.appendChild(menuSonido('sonidoFallo', 'Al fallar'));

    gSonido.appendChild(el('p', 'editor-label', 'Volumen'));
    var filaVolumen = el('div', 'rango-lectura');
    var rangoVol = document.createElement('input');
    rangoVol.type = 'range';
    rangoVol.className = 'rango';
    rangoVol.min = '25';
    rangoVol.max = '100';
    rangoVol.step = '25';
    rangoVol.value = ajustes.volumen;
    rangoVol.setAttribute('aria-label', 'Volumen del juego');
    var salidaVol = el('output', 'rango-valor', ajustes.volumen + ' %');
    rangoVol.addEventListener('input', function () {
      salidaVol.textContent = this.value + ' %';
      ajustes.volumen = this.value;
      tocarSonido('acierto');   // un volumen no se ve, se oye
    });
    rangoVol.addEventListener('change', function () {
      guardarAjuste('volumen', this.value);
    });
    filaVolumen.appendChild(rangoVol);
    filaVolumen.appendChild(salidaVol);
    gSonido.appendChild(filaVolumen);

    /* --- los colores de la pantalla */
    var gColores = grupo('Colores de la pantalla',
      'Un color vacío es el del tema. Cambian el fondo del estímulo y su texto.');
    gColores.appendChild(filaColor('fondo', 'Fondo del estímulo'));
    gColores.appendChild(filaColor('texto', 'Color del texto'));

    var acciones = el('div', 'dialogo-acciones');
    var listo = el('button', 'boton boton--principal', 'Listo');
    listo.type = 'button';
    listo.addEventListener('click', function () { cfg.close(); });
    acciones.appendChild(listo);
    cfg.appendChild(acciones);

    cfg.addEventListener('close', function () {
      cfgAbierto = false;
      if (cfg && cfg.parentNode) cfg.parentNode.removeChild(cfg);
      cfg = null;
      nuevaRonda();
    });
    document.body.appendChild(cfg);

    pintarListaFuentes(select);
    instalar.addEventListener('click', function () { archivo.click(); });
    archivo.addEventListener('change', function () {
      if (!this.files || !this.files[0] || !window.RetoFuentes) return;
      window.RetoFuentes.instalar(this.files[0]).then(function (nueva) {
        this.value = '';
        return pintarListaFuentes(select).then(function () {
          guardarAjuste('fuente', nueva.id).then(function () {
            aplicarForma();
            pintarCuadrito();
            avisar('Fuente instalada: ' + nueva.nombre);
          });
        });
      }.bind(this)).catch(function (e) {
        this.value = '';
        avisar(e.message);
      }.bind(this));
    });

    actualizarVisibilidad();
  }

  /* El modal se arma de nuevo cada vez que se abre. Así sus controles reflejan
     SIEMPRE los ajustes de ese momento, aunque hayan cambiado desde fuera (por
     ejemplo, con los botones de nivel de la pantalla). */
  function abrirConfig() {
    if (cfg) return;   // ya está abierto
    detenerReloj();
    detenerPausa();
    cfgAbierto = true;
    armarConfig();
    pintarCuadrito();
    cfg.showModal();
    var primero = cfg.querySelector('input, button');
    if (primero) primero.focus();
  }

  /* ------------------------------------------------------------- arranque */

  function iniciar() {
    estimuloEl = document.getElementById('estimulo');
    escenarioEl = document.getElementById('escenario');
    reglaEl = document.getElementById('regla');
    feedbackEl = document.getElementById('feedback');
    opcionesEl = document.getElementById('opciones');
    instruccionEl = document.getElementById('instruccion');
    tiempoEl = document.getElementById('tiempo');
    rellenoEl = document.getElementById('tiempoRelleno');
    lectorEl = document.getElementById('lector');
    nivelesEl = document.getElementById('niveles');
    statAciertos = document.getElementById('stat-aciertos');
    statRacha = document.getElementById('stat-racha');
    statMejor = document.getElementById('stat-mejor');
    if (!estimuloEl || !window.RetoDatos || !window.RetoDialogo) return;

    opcionesEl.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.stroop-opcion');
      if (!b) return;
      responder(Number(b.getAttribute('data-indice')));
    });
    nivelesEl.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-nivel]');
      if (b) elegirNivel(b.getAttribute('data-nivel'));
    });
    document.addEventListener('keydown', enTeclado);

    var btnConfig = document.querySelector('[data-configurar]');
    if (btnConfig) btnConfig.addEventListener('click', abrirConfig);

    var btnReinicio = document.querySelector('[data-reiniciar]');
    if (btnReinicio) btnReinicio.addEventListener('click', reiniciarJuego);

    var btnAyuda = document.querySelector('[data-ayuda]');
    if (btnAyuda) {
      btnAyuda.addEventListener('click', function () {
        window.RetoDialogo.informar({
          titulo: 'Cómo se juega',
          texto: 'Dos cosas compiten en la pantalla y hay que quedarse con una. '
            + 'En los colores: la palabra dice un color pero está escrita con '
            + 'otro, y hay que tocar el color de la tinta.\n\n'
            + 'Con números, figuras o emojis es la misma idea: toca lo que ves, '
            + 'o lo que dice, según la regla. Con la regla "Mezclar", una '
            + 'etiqueta arriba avisa qué toca en cada ronda.\n\n'
            + 'Equivocarse es parte del ejercicio: el cerebro se está frenando. '
            + 'Con las teclas 1, 2, 3… también se contesta.\n\n'
            + 'En Ajustes (la rueda) puedes cambiar el material, las opciones, '
            + 'el tiempo, los símbolos de los colores y la paleta para daltonismo.'
        });
      });
    }

    cargarAjustes().then(function () {
      aplicarColores();
      aplicarForma();
      if (window.RetoSonido && window.RetoSonido.precargar) window.RetoSonido.precargar();
      return reiniciarJuego();
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
