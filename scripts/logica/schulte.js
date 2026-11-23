/* R.E.T.O. - Tabla de Schulte (puerto de logica/schulte.py)
   Arma el tablero. Con la misma semilla sale SIEMPRE el mismo tablero. */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var B = nodo ? require('./_base.js') : raiz.RetoLogica._base;
  var D = B.dependencias(raiz, []);
  var m = fabrica(B, D);
  if (nodo) module.exports = m; else B.registrar(raiz, 'schulte', m);
})(typeof self !== 'undefined' ? self : this, function (B, D) {
  'use strict';
  var PyRandom = D.azar.PyRandom, ValueError = B.ValueError;

  var TAMANOS = {
    '3x3': { columnas: 3, filas: 3, nombre: 'Fácil', ayuda: 'Nueve casillas. Para empezar.' },
    '4x4': { columnas: 4, filas: 4, nombre: 'Medio', ayuda: 'Dieciséis casillas. Requiere más campo visual.' },
    '5x5': { columnas: 5, filas: 5, nombre: 'Difícil', ayuda: 'Veinticinco casillas. La de los pilotos.' }
  };
  var CONTENIDOS = {
    numeros: { nombre: 'Números', ayuda: 'Del 1 en adelante, como la tabla clásica.', muestra: '7' },
    letras: { nombre: 'Letras', ayuda: 'El abecedario en orden. Igual de difícil, se lee una letra y no un número.', muestra: 'M' },
    emojis: { nombre: 'Dibujos', ayuda: 'Dibujos de todos los días. La pantalla te dice cuál buscar.', muestra: '🍎' },
    colores: { nombre: 'Colores con forma', ayuda: 'Formas de colores. Cada una se distingue por su forma y por su color, así que sirve también si te cuesta distinguir colores.', muestra: '▲-c1' }
  };
  var CON_OBJETIVO = ['emojis', 'colores'];
  var DIBUJOS = [
    ['🍎', 'manzana'], ['🍌', 'plátano'], ['🍇', 'uvas'], ['🍓', 'fresa'],
    ['🍒', 'cerezas'], ['🍋', 'limón'], ['🍉', 'sandía'], ['🥕', 'zanahoria'],
    ['🌽', 'maíz'], ['🍄', 'hongo'], ['🌻', 'girasol'], ['🌳', 'árbol'],
    ['🐶', 'perro'], ['🐱', 'gato'], ['🐟', 'pez'], ['🐢', 'tortuga'],
    ['🦋', 'mariposa'], ['🐝', 'abeja'], ['🚗', 'coche'], ['🚲', 'bicicleta'],
    ['⚽', 'balón'], ['🔔', 'campana'], ['🔑', 'llave'], ['🎈', 'globo'],
    ['🏠', 'casa']
  ];
  var FORMAS_COLOR = [['▲', 'triángulo'], ['●', 'círculo'], ['■', 'cuadrado'],
    ['◆', 'rombo'], ['★', 'estrella'], ['✚', 'cruz'], ['▼', 'triángulo invertido']];
  var COLORES_TEMA = [['c1', 'azul'], ['c2', 'verde'], ['c3', 'rosa'], ['c4', 'naranja']];
  var ABECEDARIO = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  var INTENTOS = 800;

  function dict(pares) { var o = {}; pares.forEach(function (p) { o[p[0]] = p[1]; }); return o; }

  function catalogos() {
    return {
      tamanos: Object.keys(TAMANOS).map(function (tid) {
        var t = TAMANOS[tid];
        return { id: tid, columnas: t.columnas, filas: t.filas, nombre: t.nombre, ayuda: t.ayuda, total: t.columnas * t.filas };
      }),
      contenidos: Object.keys(CONTENIDOS).map(function (cid) {
        var c = CONTENIDOS[cid];
        return { id: cid, nombre: c.nombre, ayuda: c.ayuda, muestra: c.muestra };
      })
    };
  }

  function simbolos(contenido, total) {
    var i, r = [];
    if (contenido === 'numeros') { for (i = 1; i <= total; i++) r.push(String(i)); return r; }
    if (contenido === 'letras') return Array.from(ABECEDARIO).slice(0, total);
    if (contenido === 'emojis') return DIBUJOS.slice(0, total).map(function (e) { return e[0]; });
    if (contenido === 'colores') {
      for (i = 0; i < 28; i++) r.push(FORMAS_COLOR[i % 7][0] + '-' + COLORES_TEMA[i % 4][0]);
      return r.slice(0, total);
    }
    throw new ValueError('contenido desconocido: ' + B.repr(contenido));
  }

  function barajar(lista, rng) {
    for (var i = lista.length - 1; i > 0; i--) {
      var j = rng.randrange(i + 1), t = lista[i];
      lista[i] = lista[j]; lista[j] = t;
    }
    return lista;
  }

  function posicion(columnas, filas, indice) { return [Math.floor(indice / columnas), indice % columnas]; }
  function esEsquina(fila, columna, filas, columnas) {
    return (fila === 0 || fila === filas - 1) && (columna === 0 || columnas - 1 === columna);
  }
  function vecinos(indice, columnas, filas) {
    var p = posicion(columnas, filas, indice), fila = p[0], columna = p[1], v = [];
    if (fila > 0) v.push(indice - columnas);
    if (fila < filas - 1) v.push(indice + columnas);
    if (columna > 0) v.push(indice - 1);
    if (columna < columnas - 1) v.push(indice + 1);
    return v;
  }

  function tableroLimpio(celdas, columnas, filas, ordenNatural) {
    var donde = {};
    ordenNatural.forEach(function (v, i) { donde[v] = i; });
    for (var indice = 0; indice < celdas.length; indice++) {
      var vs = vecinos(indice, columnas, filas);
      for (var k = 0; k < vs.length; k++) {
        if (Math.abs(donde[celdas[indice]] - donde[celdas[vs[k]]]) === 1) return false;
      }
    }
    var p = posicion(columnas, filas, celdas.indexOf(ordenNatural[0]));
    return !esEsquina(p[0], p[1], filas, columnas);
  }

  function detalle(valor, contenido) {
    if (contenido === 'emojis') return { texto: valor, nombre: dict(DIBUJOS)[valor] };
    var partes = valor.split('-'), forma = partes[0], color = partes[1];
    return { texto: forma, color: color, nombre: dict(FORMAS_COLOR)[forma] + ' ' + dict(COLORES_TEMA)[color] };
  }

  function celda(indice, valor, contenido) {
    var c = { id: indice, valor: valor };
    if (CON_OBJETIVO.indexOf(contenido) >= 0) Object.assign(c, detalle(valor, contenido));
    return c;
  }

  function nuevaTabla(tamano, contenido, semilla) {
    tamano = tamano === undefined ? '5x5' : tamano;
    contenido = contenido === undefined ? 'numeros' : contenido;
    if (!TAMANOS.hasOwnProperty(tamano)) throw new ValueError('tamaño desconocido: ' + B.repr(tamano));
    if (!CONTENIDOS.hasOwnProperty(contenido)) throw new ValueError('contenido desconocido: ' + B.repr(contenido));
    var t = TAMANOS[tamano], columnas = t.columnas, filas = t.filas, total = columnas * filas;
    var base = simbolos(contenido, total);
    var rng = new PyRandom(semilla === undefined ? null : semilla);
    var conObj = CON_OBJETIVO.indexOf(contenido) >= 0;
    if (conObj) barajar(base, rng);
    var mejor = null;
    for (var n = 0; n < INTENTOS; n++) {
      var celdas = barajar(base.slice(), rng);
      mejor = celdas;
      if (tableroLimpio(celdas, columnas, filas, base)) break;
    }
    return {
      tamano: tamano, contenido: contenido, columnas: columnas, filas: filas, total: total,
      celdas: mejor.map(function (v, i) { return celda(i, v, contenido); }),
      mostrar_objetivo: conObj,
      orden: base.slice(),
      orden_detalle: conObj ? base.map(function (v) { return detalle(v, contenido); }) : [],
      semilla: semilla === undefined ? null : semilla
    };
  }

  return { TAMANOS: TAMANOS, CONTENIDOS: CONTENIDOS, catalogos: catalogos, nueva_tabla: nuevaTabla };
});
