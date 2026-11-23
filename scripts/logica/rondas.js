/* R.E.T.O. - Rondas de tests y repaso espaciado (puerto de logica/rondas.py)
   Qué preguntas entran en una ronda, en qué orden salen sus respuestas, y
   cómo cambia el estado de una pregunta al contestarla (cajas de Leitner). */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var B = nodo ? require('./_base.js') : raiz.RetoLogica._base;
  var D = B.dependencias(raiz, []);
  var m = fabrica(B, D);
  if (nodo) module.exports = m; else B.registrar(raiz, 'rondas', m);
})(typeof self !== 'undefined' ? self : this, function (B, D) {
  'use strict';
  var PyRandom = D.azar.PyRandom, ValueError = B.ValueError;

  var DIA_MS = 86400000, CAJAS = 5;
  var INTERVALO_DIAS = { 0: 0, 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
  var MODOS = ['prioridad', 'azar', 'orden'];
  var SEGURIDADES = ['seguro', 'dudando', 'adivinando'];
  var MIN_OPCIONES = 2, MAX_OPCIONES = 6, MAX_PREGUNTAS = 2000, MAX_TEXTO = 120;
  var CUOTA_REPASO = 0.7, PESO_NUEVA = 1.5, PESO_FALLO = 4.0, PESO_FALLO_SEGURO = 5.0;
  var PESO_VENCIDA_BASE = 2.0, PESO_NO_VENCIDA = 0.3, TOPE_RETRASO = 3.0, TEMAS_DEBILES_MAX = 5;

  function ahoraMs() { return Date.now(); }
  function estadoInicial() {
    return { caja: 0, vistas: 0, aciertos: 0, fallos: 0, ultimo: null, vence: 0, ultimoResultado: null, ultimaSeguridad: null };
  }
  function entero(valor, nombre, minimo) {
    minimo = minimo === undefined ? 0 : minimo;
    if (!B.esEntero(valor)) throw new ValueError(nombre + ' tiene que ser un número entero');
    if (valor < minimo) throw new ValueError(nombre + ' no puede ser menor que ' + minimo);
    return valor;
  }
  function noNulo(v) { return v !== undefined && v !== null; }

  function estado(valor) {
    if (!noNulo(valor)) return estadoInicial();
    if (!B.esObjeto(valor)) throw new ValueError('el estado de una pregunta tiene que ser un objeto');
    var e = estadoInicial();
    ['vistas', 'aciertos', 'fallos', 'vence'].forEach(function (c) { if (noNulo(valor[c])) e[c] = entero(valor[c], c); });
    if (noNulo(valor.caja)) {
      e.caja = entero(valor.caja, 'caja');
      if (e.caja > CAJAS) throw new ValueError('la caja va de 0 a ' + CAJAS);
    }
    if (noNulo(valor.ultimo)) e.ultimo = entero(valor.ultimo, 'ultimo');
    var ur = noNulo(valor.ultimoResultado) ? valor.ultimoResultado : null;
    if (ur !== null && ur !== 'acierto' && ur !== 'fallo') throw new ValueError('ultimoResultado tiene que ser acierto o fallo');
    e.ultimoResultado = ur;
    var us = noNulo(valor.ultimaSeguridad) ? valor.ultimaSeguridad : null;
    if (us !== null && SEGURIDADES.indexOf(us) < 0) throw new ValueError('seguridad desconocida');
    e.ultimaSeguridad = us;
    return e;
  }

  function registrar(est, acierto, seguridad, ahora) {
    if (typeof acierto !== 'boolean') throw new ValueError('acierto tiene que ser verdadero o falso');
    if (noNulo(seguridad) && SEGURIDADES.indexOf(seguridad) < 0) throw new ValueError('seguridad desconocida: ' + B.repr(seguridad));
    var e = estado(est);
    ahora = noNulo(ahora) ? entero(ahora, 'ahora') : ahoraMs();
    e.vistas += 1; e.ultimo = ahora; e.ultimaSeguridad = noNulo(seguridad) ? seguridad : null;
    if (!acierto) { e.fallos += 1; e.ultimoResultado = 'fallo'; e.caja = 0; e.vence = ahora; return e; }
    e.aciertos += 1; e.ultimoResultado = 'acierto';
    if (seguridad === 'dudando' || seguridad === 'adivinando') {
      e.vence = ahora + Math.max(INTERVALO_DIAS[e.caja], 1) * DIA_MS;
    } else {
      e.caja = Math.min(CAJAS, e.caja + 1);
      e.vence = ahora + INTERVALO_DIAS[e.caja] * DIA_MS;
    }
    return e;
  }
  function estaVencida(e, ahora) { return e.vistas > 0 && e.vence <= ahora; }

  function prioridad(est, ahora) {
    var e = estado(est);
    if (e.vistas === 0) return PESO_NUEVA;
    var base = 0.0;
    if (e.ultimoResultado === 'fallo') base = e.ultimaSeguridad === 'seguro' ? PESO_FALLO_SEGURO : PESO_FALLO;
    if (e.vence <= ahora) {
      var intervalo = Math.max(INTERVALO_DIAS[e.caja], 1) * DIA_MS;
      var retraso = Math.min((ahora - e.vence) / intervalo, TOPE_RETRASO);
      return Math.max(base, PESO_VENCIDA_BASE + retraso);
    }
    return Math.max(base, PESO_NO_VENCIDA / (1 + e.caja));
  }

  function rutaDeTema(tema) {
    if (!B.esObjeto(tema)) return [];
    var salida = [];
    ['n2', 'n3', 'n4'].forEach(function (n) {
      var v = tema[n];
      if (typeof v === 'string' && v.trim()) salida.push(v.trim());
    });
    return salida;
  }

  function revisarPreguntas(preguntas, exigirOpciones) {
    if (exigirOpciones === undefined) exigirOpciones = true;
    if (!Array.isArray(preguntas) || !preguntas.length) throw new ValueError('faltan las preguntas');
    if (preguntas.length > MAX_PREGUNTAS) throw new ValueError('hay demasiadas preguntas (el máximo es ' + MAX_PREGUNTAS + ')');
    var vistos = {}, limpias = [];
    preguntas.forEach(function (p) {
      if (!B.esObjeto(p)) throw new ValueError('una pregunta no es válida');
      var pid = p.id;
      if (typeof pid !== 'string' || !pid || pid.length > MAX_TEXTO) throw new ValueError('cada pregunta necesita un id de texto');
      if (Object.prototype.hasOwnProperty.call(vistos, pid)) throw new ValueError('hay dos preguntas con el mismo id: ' + pid);
      vistos[pid] = true;
      var n = p.opciones;
      if (exigirOpciones && (!B.esEntero(n) || !(MIN_OPCIONES <= n && n <= MAX_OPCIONES)))
        throw new ValueError('la pregunta ' + pid + ' necesita entre ' + MIN_OPCIONES + ' y ' + MAX_OPCIONES + ' opciones');
      limpias.push({ id: pid, opciones: noNulo(n) ? n : null, tema: noNulo(p.tema) ? p.tema : null });
    });
    return limpias;
  }
  function revisarEstados(estados, preguntas) {
    if (!noNulo(estados)) return {};
    if (!B.esObjeto(estados)) throw new ValueError('los estados tienen que ser un objeto');
    var ids = {}, r = {};
    preguntas.forEach(function (p) { ids[p.id] = true; });
    Object.keys(estados).forEach(function (k) { if (ids[k]) r[k] = estado(estados[k]); });
    return r;
  }

  function muestra(items, estados, n, ahora, rng) {
    if (n <= 0 || !items.length) return [];
    var claves = items.map(function (p) {
      var peso = prioridad(estados[p.id], ahora);
      return [Math.pow(rng.random(), 1.0 / peso), p];
    });
    claves.sort(function (a, b) { return b[0] - a[0]; });
    return claves.slice(0, n).map(function (par) { return par[1]; });
  }
  function quitar(items, usadas) {
    var ids = {};
    usadas.forEach(function (p) { ids[p.id] = true; });
    return items.filter(function (p) { return !ids[p.id]; });
  }

  function elegir(preguntas, estados, cantidad, modo, ahora, rng) {
    if (modo === 'orden') return preguntas.slice(0, cantidad);
    if (modo === 'azar') return rng.sample(preguntas, cantidad);
    var debidas = preguntas.filter(function (p) { return estaVencida(estados[p.id] || estadoInicial(), ahora); });
    var nuevas = preguntas.filter(function (p) { return (estados[p.id] || estadoInicial()).vistas === 0; });
    var otras = quitar(quitar(preguntas, debidas), nuevas);
    var cuota = Math.min(debidas.length, Math.ceil(B.pyInt(cantidad * CUOTA_REPASO * 100) / 100));
    var elegidas = muestra(debidas, estados, cuota, ahora, rng);
    var grupos = [nuevas, quitar(debidas, elegidas), otras];
    for (var g = 0; g < grupos.length; g++) {
      var falta = cantidad - elegidas.length;
      if (falta <= 0) break;
      elegidas = elegidas.concat(muestra(grupos[g], estados, falta, ahora, rng));
    }
    rng.shuffle(elegidas);
    return elegidas;
  }

  function armarRonda(preguntas, estados, cantidad, modo, ahora, semilla) {
    modo = noNulo(modo) ? modo : 'prioridad';
    if (MODOS.indexOf(modo) < 0) throw new ValueError('modo desconocido: ' + B.repr(modo));
    if (!B.esEntero(cantidad) || cantidad < 1) throw new ValueError('la cantidad tiene que ser un número entero de 1 en adelante');
    if (noNulo(semilla) && !B.esEntero(semilla)) throw new ValueError('la semilla tiene que ser un número entero');
    var pregs = revisarPreguntas(preguntas), est = revisarEstados(estados, pregs);
    ahora = noNulo(ahora) ? entero(ahora, 'ahora') : ahoraMs();
    if (!noNulo(semilla)) semilla = PyRandom.sistemaRandrange(Math.pow(2, 31));
    var rng = new PyRandom(semilla);
    cantidad = Math.min(cantidad, pregs.length);
    var elegidas = elegir(pregs, est, cantidad, modo, ahora, rng), salida = [];
    elegidas.forEach(function (p) {
      var orden = [];
      for (var i = 0; i < p.opciones; i++) orden.push(i);
      rng.shuffle(orden);
      salida.push({ id: p.id, orden: orden });
    });
    return { semilla: semilla, ahora: ahora, preguntas: salida };
  }

  function comparaRutas(a, b) {
    for (var i = 0; i < Math.min(a.length, b.length); i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; }
    return a.length - b.length;
  }

  function resumenTest(preguntas, estados, ahora) {
    var pregs = revisarPreguntas(preguntas, false), est = revisarEstados(estados, pregs);
    ahora = noNulo(ahora) ? entero(ahora, 'ahora') : ahoraMs();
    var nuevas = 0, repasar = 0, dominadas = 0, temas = {};
    pregs.forEach(function (p) {
      var e = est[p.id] || estadoInicial();
      if (e.vistas === 0) { nuevas++; return; }
      if (estaVencida(e, ahora)) {
        repasar++;
        var ruta = rutaDeTema(p.tema);
        if (ruta.length) { var k = JSON.stringify(ruta); temas[k] = temas[k] || { ruta: ruta, n: 0 }; temas[k].n++; }
      } else if (e.caja >= 4) dominadas++;
    });
    var ordenados = Object.keys(temas).map(function (k) { return temas[k]; })
      .sort(function (a, b) { return (b.n - a.n) || comparaRutas(a.ruta, b.ruta); });
    return { total: pregs.length, nuevas: nuevas, por_repasar: repasar, dominadas: dominadas,
      temas_debiles: ordenados.slice(0, TEMAS_DEBILES_MAX).map(function (t) { return { ruta: t.ruta, n: t.n }; }) };
  }

  return { CAJAS: CAJAS, INTERVALO_DIAS: INTERVALO_DIAS, estado_inicial: estadoInicial, registrar: registrar,
           esta_vencida: estaVencida, prioridad: prioridad, ruta_de_tema: rutaDeTema,
           armar_ronda: armarRonda, resumen_test: resumenTest };
});
