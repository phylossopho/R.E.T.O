/* R.E.T.O. - Mahjong solitario (puerto de logica/mahjong.py)
   El tablero se arma "al revés" (quitando parejas libres) para que SIEMPRE
   se pueda ganar. Con la misma semilla sale la misma partida. */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var B = nodo ? require('./_base.js') : raiz.RetoLogica._base;
  var D = B.dependencias(raiz, ['secuencia']);
  var m = fabrica(B, D);
  if (nodo) module.exports = m; else B.registrar(raiz, 'mahjong', m);
})(typeof self !== 'undefined' ? self : this, function (B, D) {
  'use strict';
  var PyRandom = D.azar.PyRandom, ValueError = B.ValueError, secuencia = D.secuencia;

  var ANCHO_FICHA = 2, ALTO_FICHA = 2, INTENTOS = 300, MAX_FICHAS = 144;
  var NIVELES = {
    facil: { nombre: 'Fácil', ayuda: '3 pisos, 36 fichas y 6 caras distintas. Para empezar.', tipos: 6, pares_por_tipo: 3,
      capas: [[0, 0, 0, 6, 4], [1, 2, 2, 4, 2], [2, 4, 2, 2, 2]] },
    medio: { nombre: 'Medio', ayuda: '4 pisos, 54 fichas y 9 caras distintas.', tipos: 9, pares_por_tipo: 3,
      capas: [[0, 0, 0, 8, 4], [1, 2, 2, 6, 2], [2, 4, 2, 4, 2], [3, 6, 3, 2, 1]] },
    dificil: { nombre: 'Difícil', ayuda: '4 pisos, 68 fichas y 17 caras distintas. Los pisos de arriba van a caballo, y cuesta más dejar libres las fichas.',
      tipos: 17, pares_por_tipo: 2, capas: [[0, 0, 0, 8, 5], [1, 3, 1, 5, 4], [2, 5, 3, 3, 2], [3, 7, 3, 1, 2]] }
  };
  var DIBUJOS = [['circulo', 'círculo'], ['cuadrado', 'cuadrado'], ['triangulo', 'triángulo'], ['rombo', 'rombo'],
    ['estrella', 'estrella'], ['hexagono', 'hexágono'], ['cruz', 'cruz'], ['pentagono', 'pentágono'], ['gota', 'gota'],
    ['corazon', 'corazón'], ['luna', 'luna'], ['sol', 'sol'], ['rayo', 'rayo'], ['anillo', 'anillo'], ['flecha', 'flecha'],
    ['casa', 'casa'], ['hoja', 'hoja']];
  var LETRAS = ['A', 'B', 'C', 'E', 'F', 'H', 'J', 'K', 'L', 'M', 'P', 'R', 'T', 'V', 'X', 'Y', 'Z'];
  var NUMEROS = []; for (var q = 1; q <= 17; q++) NUMEROS.push(String(q));
  var EMOJIS = [['🐶', 'perro'], ['🐱', 'gato'], ['🐸', 'rana'], ['🐼', 'panda'], ['🍎', 'manzana'], ['🍌', 'plátano'],
    ['🍇', 'uvas'], ['🍓', 'fresa'], ['🚗', 'coche'], ['✈️', 'avión'], ['⚽', 'balón'], ['🎈', 'globo'], ['🌙', 'luna'],
    ['🌸', 'flor'], ['🏠', 'casa'], ['🎵', 'nota musical'], ['🔔', 'campana']];
  var CARAS = {
    dibujos: { nombre: 'Dibujos', ayuda: 'Círculo, estrella, corazón… Lo más fácil de distinguir.',
      valores: DIBUJOS.map(function (d) { return { id: d[0], nombre: d[1] }; }) },
    numeros: { nombre: 'Números', ayuda: 'Del 1 al 17.', valores: NUMEROS.map(function (n) { return { id: n, nombre: n }; }) },
    letras: { nombre: 'Letras', ayuda: 'Letras que no se confunden entre sí.', valores: LETRAS.map(function (c) { return { id: c, nombre: 'letra ' + c }; }) },
    emojis: { nombre: 'Emojis', ayuda: 'Perro, manzana, coche, luna… Dibujos a color, fáciles de reconocer.',
      valores: EMOJIS.map(function (e) { return { id: e[0], nombre: e[1] }; }) }
  };
  var TIPOS_MAX = DIBUJOS.length;

  function posiciones(nivel) {
    if (!NIVELES.hasOwnProperty(nivel)) throw new ValueError('nivel desconocido: ' + B.repr(nivel));
    var salida = [];
    NIVELES[nivel].capas.forEach(function (cap) {
      var piso = cap[0], x0 = cap[1], y0 = cap[2], columnas = cap[3], filas = cap[4];
      for (var f = 0; f < filas; f++) for (var c = 0; c < columnas; c++)
        salida.push([x0 + c * ANCHO_FICHA, y0 + f * ALTO_FICHA, piso]);
    });
    salida.sort(function (a, b) { return (a[2] - b[2]) || (a[1] - b[1]) || (a[0] - b[0]); });
    return salida;
  }
  function tapa(a, b) { return b[2] === a[2] + 1 && Math.abs(b[0] - a[0]) < ANCHO_FICHA && Math.abs(b[1] - a[1]) < ALTO_FICHA; }
  function vecina(a, b, lado) {
    if (b[2] !== a[2] || Math.abs(b[1] - a[1]) >= ALTO_FICHA) return false;
    var dx = b[0] - a[0];
    if (lado < 0) return -ANCHO_FICHA <= dx && dx < 0;
    return 0 < dx && dx <= ANCHO_FICHA;
  }
  function libres(pos) {
    var salida = [];
    for (var i = 0; i < pos.length; i++) {
      var a = pos[i], tapada = false, izq = false, der = false;
      for (var j = 0; j < pos.length; j++) {
        if (i === j) continue;
        var b = pos[j];
        if (tapa(a, b)) { tapada = true; break; }
        if (vecina(a, b, -1)) izq = true;
        else if (vecina(a, b, 1)) der = true;
      }
      if (!tapada && !(izq && der)) salida.push(i);
    }
    return salida;
  }
  function jugadas(fichas) {
    var pos = fichas.map(function (f) { return [f.x, f.y, f.z]; });
    var libre = libres(pos).map(function (i) { return fichas[i]; }), salida = [];
    for (var i = 0; i < libre.length; i++) for (var j = i + 1; j < libre.length; j++)
      if (libre[i].t === libre[j].t) salida.push([libre[i].id, libre[j].id]);
    return salida;
  }
  function vaciar(pos, rng) {
    var quedan = pos.map(function (_, i) { return i; }), parejas = [];
    while (quedan.length) {
      var sub = quedan.map(function (i) { return pos[i]; });
      var libre = libres(sub).map(function (k) { return quedan[k]; });
      if (libre.length < 2) return null;
      var ab = rng.sample(libre, 2), a = ab[0], b = ab[1];
      parejas.push([a, b]);
      quedan.splice(quedan.indexOf(a), 1);
      quedan.splice(quedan.indexOf(b), 1);
    }
    return parejas;
  }
  function validarSemilla(s) {
    if (s !== undefined && s !== null && !B.esEntero(s)) throw new ValueError('la semilla tiene que ser un número entero');
  }
  function semillaSistema(s) { return (s === undefined || s === null) ? PyRandom.sistemaRandrange(Math.pow(2, 31)) : s; }

  function generar(nivel, semilla) {
    if (!NIVELES.hasOwnProperty(nivel)) throw new ValueError('nivel desconocido: ' + B.repr(nivel));
    validarSemilla(semilla);
    semilla = semillaSistema(semilla);
    var rng = new PyRandom(semilla), cfg = NIVELES[nivel], pos = posiciones(nivel), parejas = null;
    for (var n = 0; n < INTENTOS; n++) { parejas = vaciar(pos, rng); if (parejas !== null) break; }
    if (parejas === null) throw new Error('no se pudo armar un tablero de ' + nivel);
    var caras = [];
    for (var t = 0; t < cfg.tipos; t++) for (var k = 0; k < cfg.pares_por_tipo; k++) caras.push(t);
    rng.shuffle(caras);
    var tipo = {};
    for (var i = 0; i < Math.min(parejas.length, caras.length); i++) { tipo[parejas[i][0]] = caras[i]; tipo[parejas[i][1]] = caras[i]; }
    var fichas = pos.map(function (p, i) { return { id: i, x: p[0], y: p[1], z: p[2], t: tipo[i] }; });
    return [{ nivel: nivel, semilla: semilla, fichas: fichas, pisos: Math.max.apply(null, pos.map(function (p) { return p[2]; })) + 1 },
            parejas.map(function (p) { return [p[0], p[1]]; })];
  }
  function nuevaPartida(nivel, semilla) { return generar(nivel, semilla)[0]; }

  function revisarFichas(fichas) {
    if (!Array.isArray(fichas) || !fichas.length) throw new ValueError('faltan las fichas');
    if (fichas.length > MAX_FICHAS) throw new ValueError('hay demasiadas fichas');
    var vistos = {}, cuentas = {};
    fichas.forEach(function (f) {
      if (!B.esObjeto(f)) throw new ValueError('una ficha no es válida');
      ['id', 'x', 'y', 'z', 't'].forEach(function (c) {
        if (!B.esEntero(f[c])) throw new ValueError('la ficha necesita ' + c + ' como número entero');
      });
      if (vistos[f.id]) throw new ValueError('hay dos fichas con el mismo id');
      vistos[f.id] = true;
      if (f.z < 0 || f.z > 9 || f.t < 0 || f.t >= TIPOS_MAX) throw new ValueError('una ficha tiene datos fuera de rango');
    });
    fichas.forEach(function (f) { cuentas[f.t] = (cuentas[f.t] || 0) + 1; });
    Object.keys(cuentas).forEach(function (k) { if (cuentas[k] % 2) throw new ValueError('cada cara tiene que estar un número par de veces'); });
  }
  function revolverInterno(fichas, semilla) {
    revisarFichas(fichas);
    validarSemilla(semilla);
    semilla = semillaSistema(semilla);
    var rng = new PyRandom(semilla), pos = fichas.map(function (f) { return [f.x, f.y, f.z]; }), parejas = null;
    for (var n = 0; n < INTENTOS; n++) { parejas = vaciar(pos, rng); if (parejas !== null) break; }
    if (parejas === null) throw new ValueError('con esas fichas no se puede armar una partida');
    var caras = [], cuentas = {}, orden = [];
    fichas.forEach(function (f) { if (!(f.t in cuentas)) { cuentas[f.t] = 0; orden.push(f.t); } cuentas[f.t]++; });
    orden.forEach(function (t) { for (var k = 0; k < Math.floor(cuentas[t] / 2); k++) caras.push(t); });
    rng.shuffle(caras);
    var tipo = {};
    for (var i = 0; i < Math.min(parejas.length, caras.length); i++) { tipo[parejas[i][0]] = caras[i]; tipo[parejas[i][1]] = caras[i]; }
    return [fichas.map(function (f, i) { return { id: f.id, t: tipo[i] }; }),
            parejas.map(function (p) { return [fichas[p[0]].id, fichas[p[1]].id]; })];
  }
  function revolver(fichas, semilla) { return revolverInterno(fichas, semilla)[0]; }

  function catalogos() {
    var niveles = Object.keys(NIVELES).map(function (nid) {
      var n = NIVELES[nid], pos = posiciones(nid);
      return { id: nid, nombre: n.nombre, ayuda: n.ayuda,
        pisos: Math.max.apply(null, pos.map(function (p) { return p[2]; })) + 1, fichas: pos.length, tipos: n.tipos,
        ancho: Math.max.apply(null, pos.map(function (p) { return p[0]; })) + ANCHO_FICHA,
        alto: Math.max.apply(null, pos.map(function (p) { return p[1]; })) + ALTO_FICHA };
    });
    var paletas = Object.keys(secuencia.PALETAS).map(function (pid) {
      var p = secuencia.PALETAS[pid];
      return { id: pid, nombre: p.nombre, ayuda: p.ayuda, personalizable: p.colores === null,
        colores: p.colores === null ? null : p.colores['9'] };
    });
    var sc = secuencia.catalogos();
    return {
      niveles: niveles,
      caras: Object.keys(CARAS).map(function (cid) { var c = CARAS[cid]; return { id: cid, nombre: c.nombre, ayuda: c.ayuda, valores: c.valores }; }),
      paletas: paletas, base_personalizada: sc.base_personalizada, notas: sc.notas['9']
    };
  }

  return { NIVELES: NIVELES, CARAS: CARAS, ANCHO_FICHA: ANCHO_FICHA, ALTO_FICHA: ALTO_FICHA, posiciones: posiciones, libres: libres,
           jugadas: jugadas, nueva_partida: nuevaPartida, revolver: revolver, catalogos: catalogos, _generar: generar, _revolver: revolverInterno };
});
