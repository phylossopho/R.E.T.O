/* =========================================================================
   R.E.T.O. - Lógica del Mahjong (JavaScript)
   -------------------------------------------------------------------------
   Puerto directo de logica/mahjong.py a JS.
   Mismas reglas, mismo API, mismo algoritmo "al revés" para garantizar ganable.
   ========================================================================= */
(function (window) {
  'use strict';

  /* ===========================================================================
     CONSTANTES Y MEDIDAS
     =========================================================================== */
  var ANCHO_FICHA = 2;
  var ALTO_FICHA = 2;
  var INTENTOS = 300;
  var MAX_FICHAS = 144;

  /* ===========================================================================
     NIVELES
     =========================================================================== */
  var NIVELES = {
    facil: {
      nombre: 'Fácil',
      ayuda: '3 pisos, 36 fichas y 6 caras distintas. Para empezar.',
      tipos: 6,
      pares_por_tipo: 3,
      capas: [[0, 0, 0, 6, 4], [1, 2, 2, 4, 2], [2, 4, 2, 2, 2]]
    },
    medio: {
      nombre: 'Medio',
      ayuda: '4 pisos, 54 fichas y 9 caras distintas.',
      tipos: 9,
      pares_por_tipo: 3,
      capas: [[0, 0, 0, 8, 4], [1, 2, 2, 6, 2], [2, 4, 2, 4, 2], [3, 6, 3, 2, 1]]
    },
    dificil: {
      nombre: 'Difícil',
      ayuda: '4 pisos, 68 fichas y 17 caras distintas. Los pisos de arriba ' +
             'van a caballo, y cuesta más dejar libres las fichas.',
      tipos: 17,
      pares_por_tipo: 2,
      capas: [[0, 0, 0, 8, 5], [1, 3, 1, 5, 4], [2, 5, 3, 3, 2], [3, 7, 3, 1, 2]]
    }
  };

  /* ===========================================================================
     CARAS / DIBUJOS
     =========================================================================== */
  var DIBUJOS = [
    ['circulo', 'círculo'], ['cuadrado', 'cuadrado'], ['triangulo', 'triángulo'],
    ['rombo', 'rombo'], ['estrella', 'estrella'], ['hexagono', 'hexágono'],
    ['cruz', 'cruz'], ['pentagono', 'pentágono'], ['gota', 'gota'],
    ['corazon', 'corazón'], ['luna', 'luna'], ['sol', 'sol'], ['rayo', 'rayo'],
    ['anillo', 'anillo'], ['flecha', 'flecha'], ['casa', 'casa'], ['hoja', 'hoja']
  ];

  var LETRAS = ['A', 'B', 'C', 'E', 'F', 'H', 'J', 'K', 'L', 'M', 'P', 'R', 'T', 'V', 'X', 'Y', 'Z'];
  var NUMEROS = Array.from({length: 17}, function(_, i) { return String(i + 1); });

  var EMOJIS = [
    ['\ud83d\udc36', 'perro'], ['\ud83d\udc31', 'gato'], ['\ud83d\udc38', 'rana'], ['\ud83d\udc3c', 'panda'],
    ['\ud83c\udf4e', 'manzana'], ['\ud83c\udf4c', 'plátano'], ['\ud83c\udf47', 'uvas'], ['\ud83c\udf53', 'fresa'],
    ['\ud83d\ude97', 'coche'], ['\u2708\ufe0f', 'avión'], ['\u26bd\ufe0f', 'balón'], ['\ud83c\udf88', 'globo'],
    ['\ud83c\udf19', 'luna'], ['\ud83c\udf38', 'flor'], ['\ud83c\udfe0', 'casa'], ['\ud83c\udfb5', 'nota musical'],
    ['\ud83d\udd14', 'campana']
  ];

  var CARAS = {
    dibujos: { nombre: 'Dibujos', ayuda: 'Círculo, estrella, corazón… Lo más fácil de distinguir.',
      valores: DIBUJOS.map(function(p, i) { return { id: i, nombre: p[1] }; }) },
    numeros: { nombre: 'Números', ayuda: 'Del 1 al 17.',
      valores: NUMEROS.map(function(n) { return { id: n, nombre: n }; }) },
    letras: { nombre: 'Letras', ayuda: 'Letras que no se confunden entre sí.',
      valores: LETRAS.map(function(c) { return { id: c, nombre: 'letra ' + c }; }) },
    emojis: { nombre: 'Emojis', ayuda: 'Perro, manzana, coche, luna… Dibujos a color, fáciles de reconocer.',
      valores: EMOJIS.map(function(p) { return { id: p[0], nombre: p[1] }; }) }
  };

  var TIPOS_MAX = DIBUJOS.length;

  /* ===========================================================================
     UTILIDADES: Aleatorio con semilla
     =========================================================================== */
  function SeededRandom(seed) {
    this.seed = seed;
    this.random = function (max) {
      this.seed = (this.seed * 9301 + 49297) % 233280;
      return Math.floor((this.seed / 233280) * max);
    };
    this.sample = function (arr, n) {
      var copy = arr.slice();
      var result = [];
      for (var i = 0; i < n; i++) {
        var idx = this.random(copy.length);
        result.push(copy[idx]);
        copy.splice(idx, 1);
      }
      return result;
    };
    this.shuffle = function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = this.random(i + 1);
        var tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    };
    this.randrange = function (max) {
      return this.random(max);
    };
  }

  /* ===========================================================================
     POSICIONES DEL TABLERO
     =========================================================================== */
  function posiciones(nivel) {
    var cfg = NIVELES[nivel];
    if (!cfg) throw new Error('nivel desconocido: ' + nivel);
    var salida = [];
    cfg.capas.forEach(function (capa) {
      var piso = capa[0], x0 = capa[1], y0 = capa[2], cols = capa[3], filas = capa[4];
      for (var f = 0; f < filas; f++) {
        for (var c = 0; c < cols; c++) {
          salida.push([x0 + c * ANCHO_FICHA, y0 + f * ALTO_FICHA, piso]);
        }
      }
    });
    salida.sort(function (a, b) {
      return a[2] - b[2] || a[1] - b[1] || a[0] - b[0];
    });
    return salida;
  }

  function _tapa(a, b) {
    return b[2] === a[2] + 1 && Math.abs(b[0] - a[0]) < ANCHO_FICHA &&
           Math.abs(b[1] - a[1]) < ALTO_FICHA;
  }

  function _vecina(a, b, lado) {
    if (b[2] !== a[2] || Math.abs(b[1] - a[1]) >= ALTO_FICHA) return false;
    var dx = b[0] - a[0];
    return lado < 0 ? (dx < 0 && dx >= -ANCHO_FICHA) : (dx > 0 && dx <= ANCHO_FICHA);
  }

  /* ===========================================================================
     FICHAS LIBRES
     =========================================================================== */
  function libres(pos) {
    var salida = [];
    for (var i = 0; i < pos.length; i++) {
      var a = pos[i];
      var tapada = false, izq = false, der = false;
      for (var j = 0; j < pos.length; j++) {
        if (i === j) continue;
        var b = pos[j];
        if (_tapa(a, b)) { tapada = true; break; }
        if (_vecina(a, b, -1)) izq = true;
        else if (_vecina(a, b, 1)) der = true;
      }
      if (!tapada && !(izq && der)) salida.push(i);
    }
    return salida;
  }

  /* ===========================================================================
     ARMAR PARTIDA GANABLE (algoritmo "al revés")
     =========================================================================== */
  function _vaciar(pos, rng) {
    var quedan = [];
    for (var i = 0; i < pos.length; i++) quedan.push(i);
    var parejas = [];
    while (quedan.length) {
      var sub = quedan.map(function (k) { return pos[k]; });
      var libre = libres(sub).map(function (k) { return quedan[k]; });
      if (libre.length < 2) return null;
      var ab = rng.sample(libre, 2);
      var a = ab[0], b = ab[1];
      parejas.push([a, b]);
      var idxA = quedan.indexOf(a), idxB = quedan.indexOf(b);
      if (idxA > idxB) { quedan.splice(idxA, 1); quedan.splice(idxB, 1); }
      else { quedan.splice(idxB, 1); quedan.splice(idxA, 1); }
    }
    return parejas;
  }

  function _validar_semilla(semilla) {
    if (semilla !== null && semilla !== undefined &&
        (typeof semilla !== 'number' || semilla !== Math.floor(semilla) || semilla === true || semilla === false)) {
      throw new Error('la semilla tiene que ser un número entero');
    }
  }

  function _generar(nivel, semilla) {
    if (!NIVELES[nivel]) throw new Error('nivel desconocido: ' + nivel);
    _validar_semilla(semilla);
    if (semilla === null || semilla === undefined) {
      semilla = Math.floor(Math.random() * Math.pow(2, 31));
    }
    var rng = new SeededRandom(semilla);
    var cfg = NIVELES[nivel];
    var pos = posiciones(nivel);

    var parejas = null;
    for (var intento = 0; intento < INTENTOS; intento++) {
      parejas = _vaciar(pos, rng);
      if (parejas !== null) break;
    }
    if (parejas === null) throw new Error('no se pudo armar un tablero de ' + nivel);

    // Caras: cada tipo se usa pares_por_tipo veces
    var caras = [];
    for (var t = 0; t < cfg.tipos; t++) {
      for (var p = 0; p < cfg.pares_por_tipo; p++) caras.push(t);
    }
    rng.shuffle(caras);

    var tipo = {};
    for (var i = 0; i < parejas.length; i++) {
      var t = caras[i];
      tipo[parejas[i][0]] = t;
      tipo[parejas[i][1]] = t;
    }

    var fichas = pos.map(function (p, i) {
      return { id: i, x: p[0], y: p[1], z: p[2], t: tipo[i] };
    });

    var solucion = parejas.map(function (p) { return [p[0], p[1]]; });

    var partida = {
      nivel: nivel,
      semilla: semilla,
      fichas: fichas,
      pisos: Math.max.apply(null, pos.map(function (p) { return p[2]; })) + 1
    };
    return { partida: partida, solucion: solucion };
  }

  function nueva_partida(nivel, semilla) {
    return _generar(nivel, semilla).partida;
  }

  /* ===========================================================================
     REVOLVER (repartir caras de nuevo manteniendo las mismas)
     =========================================================================== */
  function _revisar_fichas(fichas) {
    if (!Array.isArray(fichas) || !fichas.length) throw new Error('faltan las fichas');
    if (fichas.length > MAX_FICHAS) throw new Error('hay demasiadas fichas');
    var vistos = {};
    var cuentas = {};
    fichas.forEach(function (f) {
      if (!f || typeof f !== 'object') throw new Error('una ficha no es válida');
      ['id', 'x', 'y', 'z', 't'].forEach(function (clave) {
        var v = f[clave];
        if (typeof v !== 'number' || v === true || v === false) throw new Error('la ficha necesita ' + clave + ' como número entero');
      });
      if (vistos[f.id]) throw new Error('hay dos fichas con el mismo id');
      vistos[f.id] = true;
      if (f.z < 0 || f.z > 9 || f.t < 0 || f.t >= TIPOS_MAX) throw new Error('una ficha tiene datos fuera de rango');
      cuentas[f.t] = (cuentas[f.t] || 0) + 1;
    });
    for (var k in cuentas) {
      if (cuentas[k] % 2 !== 0) throw new Error('cada cara tiene que estar un número par de veces');
    }
  }

  function _revolver(fichas, semilla) {
    _revisar_fichas(fichas);
    _validar_semilla(semilla);
    if (semilla === null || semilla === undefined) semilla = Math.floor(Math.random() * Math.pow(2, 31));
    var rng = new SeededRandom(semilla);
    var pos = fichas.map(function (f) { return [f.x, f.y, f.z]; });

    var parejas = null;
    for (var i = 0; i < INTENTOS; i++) {
      parejas = _vaciar(pos, rng);
      if (parejas !== null) break;
    }
    if (parejas === null) throw new Error('con esas fichas no se puede armar una partida');

    var caras = [];
    var cuentas = {};
    fichas.forEach(function (f) { cuentas[f.t] = (cuentas[f.t] || 0) + 1; });
    for (var t in cuentas) {
      for (var p = 0; p < cuentas[t] / 2; p++) caras.push(parseInt(t, 10));
    }
    rng.shuffle(caras);

    var tipo = {};
    for (var i = 0; i < parejas.length; i++) {
      var t = caras[i];
      tipo[parejas[i][0]] = t;
      tipo[parejas[i][1]] = t;
    }
    var nuevas = fichas.map(function (f, i) { return { id: f.id, t: tipo[i] }; });
    var solucion = parejas.map(function (p) { return [fichas[p[0]].id, fichas[p[1]].id]; });

    return { nuevas: nuevas, solucion: solucion };
  }

  function revolver(fichas, semilla) {
    return _revolver(fichas, semilla).nuevas;
  }

  /* ===========================================================================
     CATÁLOGOS PARA LA PANTALLA
     =========================================================================== */
  function catalogos() {
    var niveles = Object.keys(NIVELES).map(function (nid) {
      var n = NIVELES[nid];
      var pos = posiciones(nid);
      return {
        id: nid,
        nombre: n.nombre,
        ayuda: n.ayuda,
        pisos: Math.max.apply(null, pos.map(function (p) { return p[2]; })) + 1,
        fichas: pos.length,
        tipos: n.tipos,
        ancho: Math.max.apply(null, pos.map(function (p) { return p[0]; })) + ANCHO_FICHA,
        alto: Math.max.apply(null, pos.map(function (p) { return p[1]; })) + ALTO_FICHA
      };
    });

    var caras = Object.keys(CARAS).map(function (cid) {
      return { id: cid, nombre: CARAS[cid].nombre, ayuda: CARAS[cid].ayuda, valores: CARAS[cid].valores };
    });

    return { niveles: niveles, caras: caras, TIPOS_MAX: TIPOS_MAX };
  }

  /* ===========================================================================
     EXPORT
     =========================================================================== */
  window.RetoMahjong = {
    catalogos: catalogos,
    nueva_partida: nueva_partida,
    revolver: revolver,
    libres: libres,
    jugadas: window.RetoMahjongReglas ? window.RetoMahjongReglas.jugadas : null,
    NIVELES: NIVELES,
    CARAS: CARAS,
    DIBUJOS: DIBUJOS,
    LETRAS: LETRAS,
    NUMEROS: NUMEROS,
    EMOJIS: EMOJIS,
    ANCHO_FICHA: ANCHO_FICHA,
    ALTO_FICHA: ALTO_FICHA
  };

})(window);