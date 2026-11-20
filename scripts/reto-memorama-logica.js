/* =========================================================================
   R.E.T.O. - Lógica del Memorama (JavaScript)
   -------------------------------------------------------------------------
   Puerto directo de logica/memorama.py a JS.
   Mismas reglas, mismo API, probables mismos tests.
   ========================================================================= */
(function (window) {
  'use strict';

  /* ===========================================================================
     LOS CONJUNTOS DE SIMBOLOS
     =========================================================================== */
  var CATALOGOS = {
    formas: {
      nombre: 'Formas',
      ayuda: 'Se ven igual en cualquier aparato. No dependen de nada.',
      muestra: 'circulo',
      tipo: 'forma',
      simbolos: [
        'circulo', 'cuadrado', 'rectangulo', 'ovalo', 'rombo', 'triangulo',
        'hexagono', 'estrella', 'cruz', 'gota', 'flecha', 'luna'
      ]
    },
    numeros: {
      nombre: 'N\u00fameros',
      ayuda: 'Cada n\u00famero tiene una forma distinta. Bueno para la vista.',
      muestra: '6',
      tipo: 'texto',
      simbolos: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '6', '9']
    },
    letras: {
      nombre: 'Letras',
      ayuda: 'Como los n\u00fameros, pero con el abecedario.',
      muestra: 'A',
      tipo: 'texto',
      simbolos: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
    },
    emojis: {
      nombre: 'Emojis',
      ayuda: 'Los m\u00e1s bonitos. Necesitan un aparato con dibujitos.',
      muestra: '\ud83d\udc36',
      tipo: 'emoji',
      simbolos: [
        '\ud83d\udc36', '\ud83d\udc31', '\ud83e\udd8a', '\ud83d\udc3b', '\ud83d\udc3c', '\ud83d\udc38', '\ud83e\udd81', '\ud83d\udc37',
        '\ud83d\udc30', '\ud83d\udca8', '\ud83e\udd84', '\ud83d\udc19', '\ud83e\udd8b', '\ud83d\udc22', '\ud83e\udd89', '\u26bd\ufe0f',
        '\ud83d\ude97', '\ud83d\ude80', '\ud83c\udf33', '\ud83c\udf1e', '\ud83c\udf27\ufe0f', '\ud83c\udf4e', '\ud83c\udf4c', '\ud83c\udf53'
      ]
    }
  };

  /* ===========================================================================
     LOS TAMAÑOS
     =========================================================================== */
  var TAMANOS = {
    '3x4': { columnas: 3, filas: 4 },
    '4x4': { columnas: 4, filas: 4 },
    '4x5': { columnas: 4, filas: 5 }
  };

  var MAX_INTENTOS_SIN_CASTIGO = 200;

  var RESULTADOS = [
    'ignorado',    // no se puede voltear (ya esta vuelta, o ya esta encontrada)
    'volteada',    // primera de la pareja: se destapa
    'sin-pareja',  // no son iguales: hay que volverlas a tapar
    'pareja',      // si son iguales: se quedan
    'completo'     // se encontraron todas
  ];

  /* ===========================================================================
     UTILIDADES
     =========================================================================== */
  function barajar(simbolos, semilla) {
    // Fisher-Yates con seed opcional
    var r = semilla !== undefined ? new SeededRandom(semilla) : Math;
    var valores = simbolos.slice();
    for (var i = valores.length - 1; i > 0; i--) {
      var j = r.random ? r.random(i + 1) : Math.floor(Math.random() * (i + 1));
      var tmp = valores[i];
      valores[i] = valores[j];
      valores[j] = tmp;
    }
    return valores;
  }

  function SeededRandom(seed) {
    this.seed = seed;
    this.random = function (max) {
      this.seed = (this.seed * 9301 + 49297) % 233280;
      return Math.floor((this.seed / 233280) * max);
    };
  }

  /* ===========================================================================
     NUEVA PARTIDA
     =========================================================================== */
  function nueva_partida(tamano, catalogo, semilla) {
    if (!TAMANOS[tamano]) throw new Error('tama\u00f1o desconocido: ' + tamano);
    if (!CATALOGOS[catalogo]) throw new Error('cat\u00e1logo desconocido: ' + catalogo);

    var t = TAMANOS[tamano];
    var parejas = (t.columnas * t.filas) / 2;
    var simbolos = CATALOGOS[catalogo].simbolos;
    if (parejas > simbolos.length) throw new Error('el cat\u00e1logo ' + catalogo + ' no tiene ' + parejas + ' s\u00edmbolos');

    // Duplicar PRIMERO, barajar DESPUES (importante!)
    var deck = simbolos.slice(0, parejas).concat(simbolos.slice(0, parejas));
    deck = barajar(deck, semilla);

    var cartas = deck.map(function (s, i) {
      return { id: i, simbolo: s, volteada: false, emparejada: false };
    });

    return {
      tamano: tamano,
      catalogo: catalogo,
      columnas: t.columnas,
      filas: t.filas,
      cartas: cartas,
      volteadas: [],
      intentos: 0,
      parejas: 0,
      totalParejas: parejas,
      bloqueado: false,
      completo: false
    };
  }

  /* ===========================================================================
     ESTADO VISIBLE (sin simbolos de cartas tapadas)
     =========================================================================== */
  function _visible(partida) {
    var cartas = partida.cartas.map(function (c) {
      var ver = c.volteada || c.emparejada;
      return {
        id: c.id,
        simbolo: ver ? c.simbolo : null,
        volteada: c.volteada,
        emparejada: c.emparejada
      };
    });
    return {
      tamano: partida.tamano,
      catalogo: partida.catalogo,
      columnas: partida.columnas,
      filas: partida.filas,
      cartas: cartas,
      volteadas: partida.volteadas.slice(),
      intentos: partida.intentos,
      parejas: partida.parejas,
      totalParejas: partida.totalParejas,
      bloqueado: partida.bloqueado,
      completo: partida.completo
    };
  }

  /* ===========================================================================
     VOLTEAR CARTA
     =========================================================================== */
  function voltear(partida, carta_id) {
    if (partida.bloqueado || partida.completo) return { partida: partida, resultado: 'ignorado' };

    var carta = partida.cartas.find(function (c) { return c.id === carta_id; });
    if (!carta || carta.volteada || carta.emparejada) return { partida: partida, resultado: 'ignorado' };
    if (partida.volteadas.length >= 2) return { partida: partida, resultado: 'ignorado' };

    carta.volteada = true;
    partida.volteadas.push(carta_id);

    if (partida.volteadas.length < 2) {
      return { partida: partida, resultado: 'volteada' };
    }

    partida.intentos++;
    var a = partida.cartas[partida.volteadas[0]];
    var b = partida.cartas[partida.volteadas[1]];

    if (a.simbolo === b.simbolo) {
      a.emparejada = true;
      b.emparejada = true;
      partida.volteadas = [];
      partida.parejas++;
      if (partida.parejas === partida.totalParejas) {
        partida.completo = true;
        return { partida: partida, resultado: 'completo' };
      }
      return { partida: partida, resultado: 'pareja' };
    }

    // Sin pareja: bloquear hasta que se llame ocultar()
    partida.bloqueado = true;
    return { partida: partida, resultado: 'sin-pareja' };
  }

  /* ===========================================================================
     OCULTAR (tapar las que no hicieron pareja)
     =========================================================================== */
  function ocultar(partida) {
    partida.volteadas.forEach(function (cid) {
      var carta = partida.cartas[cid];
      carta.volteada = false;
    });
    partida.volteadas = [];
    partida.bloqueado = false;
    return partida;
  }

  /* ===========================================================================
     CATALOGOS PARA LA PAGINA
     =========================================================================== */
  function catalogos() {
    return {
      tamanos: Object.keys(TAMANOS).map(function (tid) {
        var t = TAMANOS[tid];
        return {
          id: tid,
          nombre: t.columnas + '\xd7' + t.filas,
          columnas: t.columnas,
          filas: t.filas,
          parejas: (t.columnas * t.filas) / 2
        };
      }),
      catalogos: Object.keys(CATALOGOS).map(function (cid) {
        var c = CATALOGOS[cid];
        return { id: cid, nombre: c.nombre, ayuda: c.ayuda, tipo: c.tipo, muestra: c.muestra };
      })
    };
  }

  /* ===========================================================================
     EXPORT
     =========================================================================== */
  window.RetoMemorama = {
    catalogos: catalogos,
    nueva_partida: nueva_partida,
    voltear: voltear,
    ocultar: ocultar,
    estado_para_la_pagina: _visible,
    CATALOGOS: CATALOGOS,
    TAMANOS: TAMANOS,
    RESULTADOS: RESULTADOS,
    barajar: barajar
  };

})(window);