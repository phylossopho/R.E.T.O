/* R.E.T.O. - Memorama (puerto de logica/memorama.py)
   El tablero con los símbolos de las cartas tapadas no sale de aquí:
   estado_para_la_pagina() solo muestra lo que está volteado o emparejado. */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var B = nodo ? require('./_base.js') : raiz.RetoLogica._base;
  var D = B.dependencias(raiz, []);
  var m = fabrica(B, D);
  if (nodo) module.exports = m; else B.registrar(raiz, 'memorama', m);
})(typeof self !== 'undefined' ? self : this, function (B, D) {
  'use strict';
  var PyRandom = D.azar.PyRandom, ValueError = B.ValueError;

  var CATALOGOS = {
    formas: { nombre: 'Formas', ayuda: 'Se ven igual en cualquier aparato. No dependen de nada.', muestra: 'circulo', tipo: 'forma',
      simbolos: ['circulo', 'cuadrado', 'rectangulo', 'ovalo', 'rombo', 'triangulo', 'hexagono', 'estrella', 'cruz', 'gota', 'flecha', 'luna'] },
    numeros: { nombre: 'Números', ayuda: 'Cada número tiene una forma distinta. Bueno para la vista.', muestra: '6', tipo: 'texto',
      simbolos: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '6', '9'] },
    letras: { nombre: 'Letras', ayuda: 'Como los números, pero con el abecedario.', muestra: 'A', tipo: 'texto',
      simbolos: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] },
    emojis: { nombre: 'Emojis', ayuda: 'Los más bonitos. Necesitan un aparato con dibujitos.', muestra: '🐶', tipo: 'emoji',
      simbolos: ['🐶', '🐱', '🦊', '🐻', '🐼', '🐸', '🦁', '🐷', '🐰', '🐨', '🦄', '🐙', '🦋', '🐢', '🦉', '⚽',
        '🚗', '🚀', '🌳', '🌞', '🌧️', '🍎', '🍌', '🍓'] }
  };
  var TAMANOS = { '3x4': { columnas: 3, filas: 4 }, '4x4': { columnas: 4, filas: 4 }, '4x5': { columnas: 4, filas: 5 } };
  var RESULTADOS = ['ignorado', 'volteada', 'sin-pareja', 'pareja', 'completo'];

  function catalogos() {
    return {
      tamanos: Object.keys(TAMANOS).map(function (tid) { var t = TAMANOS[tid];
        return { id: tid, nombre: t.columnas + '×' + t.filas, columnas: t.columnas, filas: t.filas, parejas: Math.floor(t.columnas * t.filas / 2) }; }),
      catalogos: Object.keys(CATALOGOS).map(function (cid) { var c = CATALOGOS[cid];
        return { id: cid, nombre: c.nombre, ayuda: c.ayuda, tipo: c.tipo, muestra: c.muestra }; })
    };
  }
  function barajar(simbolos, semilla) {
    var r = new PyRandom(semilla === undefined ? null : semilla), v = simbolos.slice();
    for (var i = v.length - 1; i > 0; i--) { var j = r.randrange(i + 1), t = v[i]; v[i] = v[j]; v[j] = t; }
    return v;
  }
  function nuevaPartida(tamano, catalogo, semilla) {
    if (!TAMANOS.hasOwnProperty(tamano)) throw new ValueError('tamaño desconocido: ' + B.repr(tamano));
    if (!CATALOGOS.hasOwnProperty(catalogo)) throw new ValueError('catálogo desconocido: ' + B.repr(catalogo));
    var t = TAMANOS[tamano], parejas = Math.floor(t.columnas * t.filas / 2), simbolos = CATALOGOS[catalogo].simbolos;
    if (parejas > simbolos.length) throw new ValueError('el catálogo ' + B.repr(catalogo) + ' no tiene ' + parejas + ' símbolos');
    var deck = simbolos.slice(0, parejas).concat(simbolos.slice(0, parejas));
    deck = barajar(deck, semilla);
    return { tamano: tamano, catalogo: catalogo, columnas: t.columnas, filas: t.filas,
      cartas: deck.map(function (s, i) { return { id: i, simbolo: s, volteada: false, emparejada: false }; }),
      volteadas: [], intentos: 0, parejas: 0, totalParejas: parejas, bloqueado: false, completo: false };
  }
  function visible(p) {
    return { tamano: p.tamano, catalogo: p.catalogo, columnas: p.columnas, filas: p.filas,
      cartas: p.cartas.map(function (c) { var ver = c.volteada || c.emparejada;
        return { id: c.id, simbolo: ver ? c.simbolo : null, volteada: c.volteada, emparejada: c.emparejada }; }),
      volteadas: p.volteadas.slice(), intentos: p.intentos, parejas: p.parejas, totalParejas: p.totalParejas,
      bloqueado: p.bloqueado, completo: p.completo };
  }
  function voltear(p, cartaId) {
    if (p.bloqueado || p.completo) return [p, 'ignorado'];
    var carta = null;
    for (var i = 0; i < p.cartas.length; i++) if (p.cartas[i].id === cartaId) { carta = p.cartas[i]; break; }
    if (carta === null || carta.volteada || carta.emparejada) return [p, 'ignorado'];
    if (p.volteadas.length >= 2) return [p, 'ignorado'];
    carta.volteada = true;
    p.volteadas.push(cartaId);
    if (p.volteadas.length < 2) return [p, 'volteada'];
    p.intentos += 1;
    var a = p.cartas[p.volteadas[0]], b = p.cartas[p.volteadas[1]];
    if (a.simbolo === b.simbolo) {
      a.emparejada = true; b.emparejada = true; p.volteadas = []; p.parejas += 1;
      if (p.parejas === p.totalParejas) { p.completo = true; return [p, 'completo']; }
      return [p, 'pareja'];
    }
    p.bloqueado = true;
    return [p, 'sin-pareja'];
  }
  function ocultar(p) {
    p.volteadas.forEach(function (cid) { p.cartas[cid].volteada = false; });
    p.volteadas = []; p.bloqueado = false;
    return p;
  }
  return { CATALOGOS: CATALOGOS, TAMANOS: TAMANOS, RESULTADOS: RESULTADOS, catalogos: catalogos, barajar: barajar,
           nueva_partida: nuevaPartida, voltear: voltear, ocultar: ocultar, estado_para_la_pagina: visible };
});
