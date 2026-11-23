/* R.E.T.O. - Secuencia de memoria (puerto de logica/secuencia.py) */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var B = nodo ? require('./_base.js') : raiz.RetoLogica._base;
  var D = B.dependencias(raiz, []);
  var m = fabrica(B, D);
  if (nodo) module.exports = m; else B.registrar(raiz, 'secuencia', m);
})(typeof self !== 'undefined' ? self : this, function (B, D) {
  'use strict';
  var PyRandom = D.azar.PyRandom, ValueError = B.ValueError;

  var BOTONES = {
    '4': { columnas: 2, filas: 2, nombre: 'Cuatro', ayuda: 'Cuatro botones. Para empezar.' },
    '6': { columnas: 3, filas: 2, nombre: 'Seis', ayuda: 'Seis botones. Hay más que recordar.' },
    '9': { columnas: 3, filas: 3, nombre: 'Nueve', ayuda: 'Nueve botones. El reto más grande.' }
  };
  var METAS = {
    '5': { pasos: 5, nombre: '5 pasos', ayuda: 'Una partida corta.' },
    '8': { pasos: 8, nombre: '8 pasos', ayuda: 'Una partida mediana.' },
    '12': { pasos: 12, nombre: '12 pasos', ayuda: 'Una partida larga.' },
    'sin': { pasos: null, nombre: 'Sin meta', ayuda: 'Se juega hasta que tú quieras parar.' }
  };
  var INICIOS = {
    '1': { pasos: 1, nombre: '1 paso', ayuda: 'Empieza muy despacio.' },
    '2': { pasos: 2, nombre: '2 pasos', ayuda: 'Un comienzo tranquilo.' },
    '3': { pasos: 3, nombre: '3 pasos', ayuda: 'Se salta lo más fácil.' }
  };
  var VELOCIDADES = {
    'muy-lenta': { encendido: 1100, pausa: 500, nombre: 'Muy lenta', ayuda: 'Cada paso se ve más de un segundo.' },
    'lenta': { encendido: 800, pausa: 400, nombre: 'Lenta', ayuda: 'Cada paso se ve casi un segundo.' },
    'normal': { encendido: 600, pausa: 300, nombre: 'Normal', ayuda: 'El ritmo del juego de siempre.' }
  };
  var ETIQUETAS = {
    numeros: { nombre: 'Números', ayuda: 'Del 1 al 9.', valores: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
    letras: { nombre: 'Letras', ayuda: 'Letras que no se confunden entre sí.', valores: ['A', 'E', 'H', 'K', 'L', 'R', 'T', 'Y', 'Z'] },
    ninguna: { nombre: 'Ninguna', ayuda: 'Solo la forma y el color.', valores: [] }
  };
  var FORMAS = [
    { id: 'circulo', nombre: 'círculo' }, { id: 'cuadrado', nombre: 'cuadrado' },
    { id: 'triangulo', nombre: 'triángulo' }, { id: 'rombo', nombre: 'rombo' },
    { id: 'estrella', nombre: 'estrella' }, { id: 'hexagono', nombre: 'hexágono' },
    { id: 'cruz', nombre: 'cruz' }, { id: 'pentagono', nombre: 'pentágono' }, { id: 'gota', nombre: 'gota' }
  ];
  var NOTAS = {
    '4': [261.63, 329.63, 392.00, 523.25],
    '6': [261.63, 293.66, 329.63, 392.00, 440.00, 523.25],
    '9': [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99]
  };
  var LARGO_SIN_META = 50, LARGO_MAX = 60, MAX_IGUALES_SEGUIDOS = 2;
  var DALTONISMO = {
    '4': ['#0072B2', '#F0E442', '#56B4E9', '#D55E00'],
    '6': ['#0072B2', '#E69F00', '#CC79A7', '#F0E442', '#56B4E9', '#D55E00'],
    '9': ['#0072B2', '#E69F00', '#CC79A7', '#F0E442', '#56B4E9', '#D55E00', '#009E73', '#999999', '#222222']
  };
  var PASTEL = ['#A9CCE3', '#D2B4DE', '#A9DFBF', '#F9E79F', '#F5B7B1', '#A3E4D7', '#F8C9A0', '#D5D8DC', '#C5CAE9'];
  var ALTO_CONTRASTE = ['#000000', '#FFFFFF', '#FFE600', '#0033A0', '#FF7A00', '#00704A', '#8A00C2', '#B30000', '#00BFFF'];
  var GRISES = ['#F5F5F5', '#D4D4D4', '#B3B3B3', '#8F8F8F', '#6B6B6B', '#4D4D4D', '#363636', '#222222', '#0D0D0D'];
  var TEXTO_OSCURO = '#1A1A1A', TEXTO_CLARO = '#FFFFFF';

  function canal(c) { c = c / 255.0; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function luminancia(color) {
    var h = color.replace(/^#+/, '');
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  }
  function contraste(a, b) {
    var la = luminancia(a), lb = luminancia(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function colorDeTexto(fondo) {
    return contraste(fondo, TEXTO_OSCURO) >= contraste(fondo, TEXTO_CLARO) ? TEXTO_OSCURO : TEXTO_CLARO;
  }
  function repartidos(lista, cuantos) {
    if (cuantos === 1) return [lista[0]];
    var paso = (lista.length - 1) / (cuantos - 1), r = [];
    for (var i = 0; i < cuantos; i++) r.push(lista[B.pyRound(i * paso)]);
    return r;
  }
  function conTexto(colores) { return colores.map(function (c) { return { fondo: c, texto: colorDeTexto(c) }; }); }
  function porCantidad(armar) {
    var o = {};
    Object.keys(BOTONES).forEach(function (c) { o[c] = armar(parseInt(c, 10)); });
    return o;
  }
  var dalto = {};
  Object.keys(BOTONES).forEach(function (c) { dalto[c] = conTexto(DALTONISMO[c]); });
  var PALETAS = {
    daltonismo: { nombre: 'Seguros para daltonismo', ayuda: 'Colores que se distinguen con las formas más comunes de daltonismo. Siempre llevan también una forma.', colores: dalto },
    suave: { nombre: 'Suaves', ayuda: 'Colores apagados, que cansan menos la vista.', colores: porCantidad(function (n) { return conTexto(PASTEL.slice(0, n)); }) },
    'alto-contraste': { nombre: 'Alto contraste', ayuda: 'Colores muy distintos entre sí, claros contra oscuros.', colores: porCantidad(function (n) { return conTexto(ALTO_CONTRASTE.slice(0, n)); }) },
    grises: { nombre: 'Grises', ayuda: 'Sin color: de claro a oscuro. Se distingue por la forma.', colores: porCantidad(function (n) { return conTexto(repartidos(GRISES, n)); }) },
    unico: { nombre: 'Un solo color', ayuda: 'Todos iguales, del color del tema. Se distingue por la forma, la etiqueta y el sonido.',
      colores: porCantidad(function (n) { var a = []; for (var i = 0; i < n; i++) a.push({ fondo: null, texto: null }); return a; }) },
    personalizada: { nombre: 'La mía', ayuda: 'Tú eliges el color de cada botón.', colores: null }
  };

  function catalogos() {
    return {
      botones: Object.keys(BOTONES).map(function (id) { var b = BOTONES[id];
        return { id: id, columnas: b.columnas, filas: b.filas, nombre: b.nombre, ayuda: b.ayuda, total: b.columnas * b.filas }; }),
      metas: Object.keys(METAS).map(function (id) { var x = METAS[id];
        return { id: id, pasos: x.pasos, nombre: x.nombre, ayuda: x.ayuda }; }),
      inicios: Object.keys(INICIOS).map(function (id) { var x = INICIOS[id];
        return { id: id, pasos: x.pasos, nombre: x.nombre, ayuda: x.ayuda }; }),
      velocidades: Object.keys(VELOCIDADES).map(function (id) { var v = VELOCIDADES[id];
        return { id: id, encendido: v.encendido, pausa: v.pausa, nombre: v.nombre, ayuda: v.ayuda }; }),
      etiquetas: Object.keys(ETIQUETAS).map(function (id) { var e = ETIQUETAS[id];
        return { id: id, nombre: e.nombre, ayuda: e.ayuda, valores: e.valores }; }),
      formas: FORMAS,
      paletas: Object.keys(PALETAS).map(function (id) { var p = PALETAS[id];
        return { id: id, nombre: p.nombre, ayuda: p.ayuda, personalizable: p.colores === null, colores: p.colores }; }),
      base_personalizada: DALTONISMO['9'],
      notas: NOTAS,
      largo_sin_meta: LARGO_SIN_META
    };
  }

  function nuevaSecuencia(botones, largo, semilla) {
    if (!BOTONES.hasOwnProperty(botones)) throw new ValueError('cantidad de botones desconocida: ' + B.repr(botones));
    if (!B.esEntero(largo)) throw new ValueError('el largo tiene que ser un número entero');
    if (largo < 1 || largo > LARGO_MAX) throw new ValueError('el largo va de 1 a ' + LARGO_MAX);
    if (semilla !== undefined && semilla !== null && !B.esEntero(semilla)) throw new ValueError('la semilla tiene que ser un número entero');
    if (semilla === undefined || semilla === null) semilla = PyRandom.sistemaRandrange(Math.pow(2, 31));
    var rng = new PyRandom(semilla);
    var total = BOTONES[botones].columnas * BOTONES[botones].filas, secuencia = [];
    for (var n = 0; n < largo; n++) {
      var opciones = [];
      for (var i = 0; i < total; i++) opciones.push(i);
      if (secuencia.length >= MAX_IGUALES_SEGUIDOS) {
        var ult = secuencia.slice(-MAX_IGUALES_SEGUIDOS);
        if (ult.every(function (x) { return x === ult[0]; })) opciones.splice(opciones.indexOf(ult[0]), 1);
      }
      secuencia.push(rng.choice(opciones));
    }
    return { botones: botones, largo: largo, semilla: semilla, secuencia: secuencia };
  }

  return { BOTONES: BOTONES, PALETAS: PALETAS, NOTAS: NOTAS, luminancia: luminancia, contraste: contraste, color_de_texto: colorDeTexto,
           catalogos: catalogos, nueva_secuencia: nuevaSecuencia };
});
