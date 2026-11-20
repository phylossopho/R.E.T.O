/* =========================================================================
   R.E.T.O. - Lógica de Visión (JavaScript)
   -------------------------------------------------------------------------
   Puerto directo de logica/vision.py a JS.
   7 ejercicios: seguimiento, sacadas, fila, periferico, piramide, destello,
   enfoque, parpadeo, descanso.
   ========================================================================= */
(function (window) {
  'use strict';

  /* ===========================================================================
     CONSTANTES (idénticas a Python)
     =========================================================================== */
  var NIVEL_MIN = 1;
  var NIVEL_MAX = 5;
  var NIVEL_POR_DEFECTO = 2;
  var MARGEN = 0.1;
  var MINUTOS_MINIMOS = 1;
  var DURACIONES_MIN = [1, 2, 3, 5];
  var DURACION_POR_DEFECTO_MIN = 2;
  var NOMBRES_NIVEL = { 1: 'Muy lenta', 2: 'Lenta', 3: 'Normal', 4: 'R\u00e1pida', 5: 'Muy r\u00e1pida' };

  // 1. SEGUIMIENTO
  var TRAYECTORIAS = ['horizontal', 'vertical', 'diagonal', 'circulo', 'infinito'];
  var VELOCIDAD_SEGUIMIENTO = { 1: 12, 2: 20, 3: 30, 4: 42, 5: 55 };
  var PUNTOS_CURVA = 240;
  var PAUSA_PASO_S = 1.5;
  var PASOS_SEGUIMIENTO = 10;

  // 2. SACADAS
  var VARIANTES_SACADAS = ['horizontal', 'vertical', 'aleatoria'];
  var PERMANENCIA_S = { 1: 1.6, 2: 1.2, 3: 1.0, 4: 0.85, 5: 0.7 };
  var INTERVALO_MIN_S = 0.7;
  var SIMBOLOS_RETO = ['\u25b2', '\u25cf', '\u25a0'];
  var AMPLITUDES = [0.1, 0.2, 0.3, 0.4];

  // 3. FILA (usa pacer de lectura)
  var MS_POR_SIMBOLO = { 1: 1100, 2: 800, 3: 600, 4: 450, 5: 350 };
  var PESO_MAX_FILA = 2.0;
  var LETRAS_FILA = 'ABCDEFGHIJKLMN\u00d1OPQRSTUVWXYZ';
  var NUMEROS_FILA = '123456789';
  var TIPOS_FILA = ['letras', 'numeros', 'mixto'];

  // 4. PERIFERICO
  var FORMAS = ['\u25b2', '\u25cf', '\u25a0', '\u25c6', '\u2605'];
  var NOMBRES_FORMA = { '\u25b2': 'tri\u00e1ngulo', '\u25cf': 'c\u00edrculo', '\u25a0': 'cuadrado', '\u25c6': 'rombo', '\u2605': 'estrella' };
  var DIGITOS = '123456789';
  var ANILLOS = { cerca: [0.35, 0.5], media: [0.55, 0.75], lejos: [0.8, 0.95] };
  var ANILLOS_POR_NIVEL = { 1: ['cerca'], 2: ['cerca', 'media'], 3: ['media'], 4: ['media', 'lejos'], 5: ['lejos'] };
  var TIEMPO_PERIFERICO_MS = { 1: 1200, 2: 900, 3: 700, 4: 550, 5: 400 };
  var TIEMPO_PERIFERICO_MIN_MS = 400;
  var ACIERTOS_PARA_SUBIR = 3;

  // 5. PIRAMIDE
  var LETRAS_PIRAMIDE = 'ABCDEFGHJKLMNPRSTUVXZ';
  var MAX_FILAS_PIRAMIDE = 9;
  var SEGUNDOS_PIRAMIDE = { 1: 14, 2: 10, 3: 8, 4: 6, 5: 5 };

  // 6. DESTELLO
  var EXPOSICION_INICIAL_MS = 1000;
  var EXPOSICION_PASO_MS = 100;
  var EXPOSICION_MIN_SEGURA_MS = 300;
  var EXPOSICION_MIN_DEFECTO_MS = 500;
  var EXPOSICION_MIN_SENSIBLE_MS = 800;
  var EXPOSICION_MAX_MS = 1500;
  var MATERIALES = ['palabras', 'numeros', 'figuras'];
  var PALABRAS = ['casa', 'luz', 'mesa', 'rio', 'sol', 'pan', 'flor', 'mar', 'tren', 'libro',
    'nube', 'gato', 'perro', 'silla', 'lapiz', 'plaza', 'monte', 'barco', 'campo',
    'playa', 'viento', 'fuego', 'tierra', 'piedra', 'hoja', 'arbol', 'puerta',
    'ventana', 'camino', 'puente', 'isla', 'calle', 'reloj', 'carta', 'mundo'];

  // 7. ENFOQUE / PARPADEO / DESCANSO
  var DESCANSO_SEG = 20;
  var DESCANSO_DISTANCIA_M = 6;
  var INTERVALOS_DESCANSO_MIN = [10, 15, 20, 30, 45, 60];
  var INTERVALO_DESCANSO_DEFECTO_MIN = 20;
  var SEG_CERCA = { 1: 12, 2: 10, 3: 8, 4: 6, 5: 5 };
  var RITMOS_PARPADEO = { 1: 6.0, 2: 5.0, 3: 4.0 };
  var CIERRA_S = 0.8;
  var ABRE_S = 0.8;

  /* ===========================================================================
     UTILIDADES
     =========================================================================== */
  function acotarNivel(valor, defecto) {
    if (defecto === undefined) defecto = NIVEL_POR_DEFECTO;
    try { var n = parseInt(valor, 10); } catch (e) { return defecto; }
    return Math.max(NIVEL_MIN, Math.min(NIVEL_MAX, n));
  }

  function acotarEntero(valor, minimo, maximo, defecto) {
    try { var n = parseInt(valor, 10); } catch (e) { return defecto; }
    return Math.max(minimo, Math.min(maximo, n));
  }

  function acotarDuracion(valor) {
    try { var n = parseInt(valor, 10); } catch (e) { return DURACION_POR_DEFECTO_MIN; }
    return DURACIONES_MIN.indexOf(n) >= 0 ? n : DURACION_POR_DEFECTO_MIN;
  }

  function _trayectoria(nombre) {
    var a = MARGEN, b = 1 - MARGEN;
    if (nombre === 'horizontal') return [[a, 0.5], [b, 0.5], [a, 0.5]];
    if (nombre === 'vertical') return [[0.5, a], [0.5, b], [0.5, a]];
    if (nombre === 'diagonal') return [[a, a], [b, b], [a, a]];
    var puntos = [];
    for (var i = 0; i <= PUNTOS_CURVA; i++) {
      var t = 2 * Math.PI * i / PUNTOS_CURVA;
      if (nombre === 'circulo') {
        puntos.push([0.5 + 0.4 * Math.cos(t), 0.5 + 0.4 * Math.sin(t)]);
      } else {
        var d = 1 + Math.pow(Math.sin(t), 2);
        puntos.push([0.5 + 0.4 * Math.cos(t) / d, 0.5 + 0.4 * Math.sin(t) * Math.cos(t) / d]);
      }
    }
    return puntos;
  }

  function _elegir(material, cantidad, rng) {
    if (material === 'palabras') return rng.sample ? rng.sample(PALABRAS, cantidad) : _sample(PALABRAS, cantidad, rng);
    if (material === 'numeros') {
      var nums = [];
      for (var i = 0; i < cantidad; i++) nums.push(String(rng.randomInt ? rng.randomInt(10, 99) : 10 + Math.floor(rng.random() * 90)));
      return nums;
    }
    var res = [];
    for (var i = 0; i < cantidad; i++) res.push(FORMAS[Math.floor(rng.random() * FORMAS.length)]);
    return res;
  }

  function _sample(arr, n, rng) {
    var copy = arr.slice();
    var res = [];
    for (var i = 0; i < n && copy.length; i++) {
      var idx = Math.floor(rng.random() * copy.length);
      res.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return res;
  }

  /* ===========================================================================
     PLANES DE EJERCICIOS
     =========================================================================== */

  // 1. SEGUIMIENTO SUAVE
  function planSeguimiento(trayectoria, nivel) {
    if (TRAYECTORIAS.indexOf(trayectoria) < 0) trayectoria = 'horizontal';
    nivel = acotarNivel(nivel);
    var puntos = _trayectoria(trayectoria);
    var acumulado = [0.0];
    for (var i = 0; i < puntos.length - 1; i++) {
      var dx = puntos[i + 1][0] - puntos[i][0];
      var dy = puntos[i + 1][1] - puntos[i][1];
      acumulado.push(acumulado[acumulado.length - 1] + Math.hypot(dx, dy));
    }
    var longitud = acumulado[acumulado.length - 1];
    var velocidad = VELOCIDAD_SEGUIMIENTO[nivel];
    var pasos = [];
    for (var i = 0; i < PASOS_SEGUIMIENTO; i++) {
      var objetivo = longitud * i / PASOS_SEGUIMIENTO;
      var k = 1;
      while (k < acumulado.length - 1 && acumulado[k] < objetivo) k++;
      var tramo = acumulado[k] - acumulado[k - 1] || 1.0;
      var f = (objetivo - acumulado[k - 1]) / tramo;
      var x = puntos[k - 1][0] + f * (puntos[k][0] - puntos[k - 1][0]);
      var y = puntos[k - 1][1] + f * (puntos[k][1] - puntos[k - 1][1]);
      pasos.push([Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000]);
    }
    return {
      ejercicio: 'seguimiento',
      trayectoria: trayectoria,
      nivel: nivel,
      puntos: puntos.map(function (p) { return [Math.round(p[0] * 10000) / 10000, Math.round(p[1] * 10000) / 10000]; }),
      acumulado: acumulado.map(function (v) { return Math.round(v * 100000) / 100000; }),
      longitud: Math.round(longitud * 100000) / 100000,
      velocidad: velocidad,
      vuelta_s: Math.round((longitud / (velocidad / 100)) * 100) / 100,
      pasos: pasos,
      pausa_paso_s: PAUSA_PASO_S
    };
  }

  // 2. SACADAS
  function planSacadas(variante, nivel, cantidad, reto, semilla) {
    if (VARIANTES_SACADAS.indexOf(variante) < 0) variante = 'horizontal';
    nivel = acotarNivel(nivel);
    cantidad = acotarEntero(cantidad, 6, 60, 24);
    var rng = semilla !== undefined ? new SeededRandom(semilla) : Math;
    var puntos = [];
    if (variante === 'aleatoria') {
      var x = 0.5, y = 0.5;
      for (var i = 0; i < cantidad; i++) {
        var minimo = AMPLITUDES[i % AMPLITUDES.length];
        for (var intento = 0; intento < 60; intento++) {
          var nx = MARGEN + rng.random() * (1 - 2 * MARGEN);
          var ny = MARGEN + rng.random() * (1 - 2 * MARGEN);
          if (Math.hypot(nx - x, ny - y) >= minimo) break;
        }
        x = nx; y = ny;
        puntos.push([x, y]);
      }
    } else {
      var lado = 1;
      for (var i = 0; i < cantidad; i++) {
        var d = AMPLITUDES[Math.floor(i / 2) % AMPLITUDES.length];
        if (variante === 'horizontal') puntos.push([0.5 + lado * d, 0.5]);
        else puntos.push([0.5, 0.5 + lado * d]);
        lado = -lado;
      }
    }
    var salida = puntos.map(function (p) {
      var sym = SIMBOLOS_RETO[Math.floor(rng.random() * SIMBOLOS_RETO.length)];
      return { x: Math.round(p[0] * 10000) / 10000, y: Math.round(p[1] * 10000) / 10000, simbolo: sym };
    });
    var permanencia = Math.max(PERMANENCIA_S[nivel], INTERVALO_MIN_S);
    return {
      ejercicio: 'sacadas',
      variante: variante,
      nivel: nivel,
      puntos: salida,
      permanencia_s: permanencia,
      intervalo_min_s: INTERVALO_MIN_S,
      fundido_ms: 100,
      reto: !!reto,
      simbolos: SIMBOLOS_RETO.slice()
    };
  }

  // 3. FILA (usa pacer de lectura)
  function planFila(tipo, porFila, filas, nivel, semilla) {
    if (TIPOS_FILA.indexOf(tipo) < 0) tipo = 'letras';
    nivel = acotarNivel(nivel);
    porFila = acotarEntero(porFila, 2, 14, 8);
    filas = acotarEntero(filas, 1, 8, 4);
    var rng = semilla !== undefined ? new SeededRandom(semilla) : Math;
    var fuente = tipo === 'letras' ? LETRAS_FILA : (tipo === 'numeros' ? NUMEROS_FILA : LETRAS_FILA + NUMEROS_FILA);
    var renglones = [];
    for (var f = 0; f < filas; f++) {
      var fila = [];
      for (var i = 0; i < porFila; i++) {
        var c;
        do { c = fuente[Math.floor(rng.random() * fuente.length)]; } while (fila.length && c === fila[fila.length - 1]);
        fila.push(c);
      }
      renglones.push(fila);
    }
    // Usar plan_pacer de lectura_veloz si está disponible
    var tramos = [];
    if (window.RetoLecturaVeloz && window.RetoLecturaVeloz.planPacer) {
      var pacer = window.RetoLecturaVeloz.planPacer(renglones.map(function (r) { return r.join(' '); }), 1);
      tramos = pacer.tramos.map(function (t) {
        return { desde: t.desde, hasta: t.hasta, peso: Math.min(PESO_MAX_FILA, t.peso) };
      });
    }
    return {
      ejercicio: 'fila',
      tipo: tipo,
      nivel: nivel,
      filas: renglones,
      tramos: tramos,
      ms_por_simbolo: MS_POR_SIMBOLO[nivel]
    };
  }

  // 4. PERIFERICO
  function planPeriferico(nivel, cantidad, semilla, sinTiempo) {
    nivel = acotarNivel(nivel);
    cantidad = acotarEntero(cantidad, 1, 40, 12);
    var rng = semilla !== undefined ? new SeededRandom(semilla) : Math;
    var nOpciones = nivel < 3 ? 3 : 4;
    var rondas = [];
    for (var i = 0; i < cantidad; i++) {
      var anillo = ANILLOS_POR_NIVEL[nivel][Math.floor(rng.random() * ANILLOS_POR_NIVEL[nivel].length)];
      var radioRange = ANILLOS[anillo];
      var usaNumero = nivel >= 3 && rng.random() < 0.5;
      var base = usaNumero ? DIGITOS : FORMAS;
      var valor = base[Math.floor(rng.random() * base.length)];
      var opciones = [valor];
      while (opciones.length < nOpciones) {
        var c = base[Math.floor(rng.random() * base.length)];
        if (opciones.indexOf(c) < 0) opciones.push(c);
      }
      for (var j = opciones.length - 1; j > 0; j--) {
        var k = Math.floor(rng.random() * (j + 1));
        var tmp = opciones[j]; opciones[j] = opciones[k]; opciones[k] = tmp;
      }
      var radio = radioRange[0] + rng.random() * (radioRange[1] - radioRange[0]);
      var angulo = rng.random() * 2 * Math.PI;
      rondas.push({
        tipo: usaNumero ? 'numero' : 'forma',
        valor: valor,
        nombre: usaNumero ? valor : NOMBRES_FORMA[valor],
        opciones: opciones,
        correcta: opciones.indexOf(valor),
        anillo: anillo,
        radio: Math.round(radio * 1000) / 1000,
        angulo: Math.round(angulo * 1000) / 1000
      });
    }
    var tiempoMs = sinTiempo ? 0 : Math.max(TIEMPO_PERIFERICO_MS[nivel], TIEMPO_PERIFERICO_MIN_MS);
    return {
      ejercicio: 'periferico',
      nivel: nivel,
      rondas: rondas,
      tiempo_ms: tiempoMs
    };
  }

  function ajustarPeriferico(nivel, racha, acerto) {
    nivel = acotarNivel(nivel);
    racha = Math.max(0, acotarEntero(racha, 0, 99, 0));
    if (acerto) {
      racha++;
      if (racha >= ACIERTOS_PARA_SUBIR && nivel < NIVEL_MAX) return { nivel: nivel + 1, racha: 0 };
      return { nivel: nivel, racha: racha };
    }
    return { nivel: Math.max(NIVEL_MIN, nivel - 1), racha: 0 };
  }

  // 5. PIRAMIDE
  function planPiramide(maxAncho, maxFilas, semilla, nivel) {
    maxAncho = acotarEntero(maxAncho, 5, 31, 15);
    maxFilas = acotarEntero(maxFilas, 3, MAX_FILAS_PIRAMIDE, MAX_FILAS_PIRAMIDE);
    var rng = semilla !== undefined ? new SeededRandom(semilla) : Math;
    var filas = [];
    var largo = 1;
    while (largo <= maxAncho && filas.length < maxFilas) {
      var fila = [];
      for (var i = 0; i < largo; i++) {
        var c;
        do { c = LETRAS_PIRAMIDE[Math.floor(rng.random() * LETRAS_PIRAMIDE.length)]; } while (fila.length && c === fila[fila.length - 1]);
        fila.push(c);
      }
      filas.push(fila.join(''));
      largo += 2;
    }
    return {
      ejercicio: 'piramide',
      filas: filas,
      centro: filas.map(function (f) { return Math.floor(f.length / 2); }),
      segundos: SEGUNDOS_PIRAMIDE[acotarNivel(nivel)]
    };
  }

  // 6. DESTELLO
  function exposicionMinima(baseMs, sensible, reducido) {
    if (baseMs === undefined) baseMs = EXPOSICION_MIN_DEFECTO_MS;
    baseMs = acotarEntero(baseMs, EXPOSICION_MIN_SEGURA_MS, EXPOSICION_MAX_MS, EXPOSICION_MIN_DEFECTO_MS);
    if (sensible || reducido) baseMs = Math.max(baseMs, EXPOSICION_MIN_SENSIBLE_MS);
    return baseMs;
  }

  function ajustarDestello(exposicionMs, acerto, minimoMs, sensible, reducido) {
    var piso = exposicionMinima(minimoMs, sensible, reducido);
    var actual = acotarEntero(exposicionMs, EXPOSICION_MIN_SEGURA_MS, EXPOSICION_MAX_MS, EXPOSICION_INICIAL_MS);
    actual = Math.max(actual, piso);
    if (acerto) actual = Math.max(piso, actual - EXPOSICION_PASO_MS);
    else actual = Math.min(EXPOSICION_MAX_MS, actual + EXPOSICION_PASO_MS);
    return { exposicion_ms: actual, minimo_ms: piso };
  }

  function rondaDestello(material, cantidad, exposicionMs, semilla, minimoMs, sensible, reducido) {
    if (MATERIALES.indexOf(material) < 0) material = 'palabras';
    cantidad = acotarEntero(cantidad, 3, 6, 4);
    var rng = semilla !== undefined ? new SeededRandom(semilla) : Math;
    var items = _elegir(material, cantidad, rng);
    var opciones = [items.slice()];
    var intentos = 0;
    while (opciones.length < 4 && intentos < 200) {
      intentos++;
      var cambio = items.slice();
      var nCambios = Math.min(cantidad, rng.random() < 0.5 ? 1 : 2);
      var posiciones = _sample(Array.from({length: cantidad}, function(_, i) { return i; }), nCambios, rng);
      for (var p = 0; p < posiciones.length; p++) {
        var pos = posiciones[p];
        var nuevo = _elegir(material, 1, rng)[0];
        if (cambio.indexOf(nuevo) < 0) cambio[pos] = nuevo;
      }
      var igual = false;
      for (var o = 0; o < opciones.length; o++) {
        if (opciones[o].join(',') === cambio.join(',')) { igual = true; break; }
      }
      if (!igual) opciones.push(cambio);
    }
    for (var i = opciones.length - 1; i > 0; i--) {
      var j = Math.floor(rng.random() * (i + 1));
      var tmp = opciones[i]; opciones[i] = opciones[j]; opciones[j] = tmp;
    }
    var piso = exposicionMinima(minimoMs, sensible, reducido);
    return {
      ejercicio: 'destello',
      material: material,
      items: items,
      opciones: opciones,
      correcta: opciones.indexOf(items),
      exposicion_ms: Math.max(piso, acotarEntero(exposicionMs, EXPOSICION_MIN_SEGURA_MS, EXPOSICION_MAX_MS, EXPOSICION_INICIAL_MS)),
      minimo_ms: piso,
      fundido_ms: 100
    };
  }

  // 7. ENFOQUE
  function planEnfoque(duracionMin, nivel) {
    duracionMin = acotarDuracion(duracionMin);
    nivel = acotarNivel(nivel);
    var cerca = SEG_CERCA[nivel];
    var fases = [];
    var total = 0;
    var limite = duracionMin * 60;
    while (total + DESCANSO_SEG + cerca <= limite || !fases.length) {
      fases.push({
        fase: 'lejos', seg: DESCANSO_SEG,
        mensaje: 'Mira un objeto lejano, a unos ' + DESCANSO_DISTANCIA_M + ' metros (por la ventana, por ejemplo).'
      });
      fases.push({
        fase: 'cerca', seg: cerca,
        mensaje: 'Ahora mira esta pantalla, al punto del centro.'
      });
      total += DESCANSO_SEG + cerca;
    }
    return { ejercicio: 'enfoque', nivel: nivel, fases: fases, total_s: total };
  }

  // 8. PARPADEO
  function planParpadeo(ritmo, duracionMin) {
    ritmo = acotarEntero(ritmo, 1, 3, 2);
    duracionMin = acotarDuracion(duracionMin);
    var ciclo = RITMOS_PARPADEO[ritmo];
    return {
      ejercicio: 'parpadeo',
      ritmo: ritmo,
      ciclo_s: ciclo,
      cierra_s: CIERRA_S,
      abre_s: ABRE_S,
      espera_s: Math.round((ciclo - CIERRA_S - ABRE_S) * 100) / 100,
      repeticiones: Math.floor(duracionMin * 60 / ciclo),
      texto_reducido: 'Parpadea 3 veces, despacio. Descansa un momento. Repite.'
    };
  }

  // 9. DESCANSO (20-20-20)
  function planDescanso(intervaloMin) {
    try { var n = parseInt(intervaloMin, 10); } catch (e) { n = INTERVALO_DESCANSO_DEFECTO_MIN; }
    if (INTERVALOS_DESCANSO_MIN.indexOf(n) < 0) n = INTERVALO_DESCANSO_DEFECTO_MIN;
    return {
      ejercicio: 'descanso',
      intervalo_min: n,
      intervalos: INTERVALOS_DESCANSO_MIN.slice(),
      descanso_seg: DESCANSO_SEG,
      distancia_m: DESCANSO_DISTANCIA_M,
      mensaje: 'Mira un objeto a unos ' + DESCANSO_DISTANCIA_M + ' metros durante ' + DESCANSO_SEG + ' segundos.'
    };
  }

  /* ===========================================================================
     DESPACHO CENTRAL
     =========================================================================== */
  function planPara(ejercicio, datos) {
    var d = datos || {};
    switch (ejercicio) {
      case 'seguimiento': return planSeguimiento(d.trayectoria || 'horizontal', d.nivel);
      case 'sacadas': return planSacadas(d.variante || 'horizontal', d.nivel, d.cantidad || 24, d.reto || false, d.semilla);
      case 'fila': return planFila(d.tipo || 'letras', d.por_fila || 8, d.filas || 4, d.nivel, d.semilla);
      case 'periferico': return planPeriferico(d.nivel, d.cantidad || 12, d.semilla, !!d.sin_tiempo);
      case 'piramide': return planPiramide(d.max_ancho || 15, d.max_filas || MAX_FILAS_PIRAMIDE, d.semilla, d.nivel);
      case 'destello': return rondaDestello(d.material || 'palabras', d.cantidad || 4, d.exposicion_ms || EXPOSICION_INICIAL_MS, d.semilla, d.minimo_ms || EXPOSICION_MIN_DEFECTO_MS, !!d.sensible, !!d.reducido);
      case 'enfoque': return planEnfoque(d.duracion_min || DURACION_POR_DEFECTO_MIN, d.nivel);
      case 'parpadeo': return planParpadeo(d.ritmo || 2, d.duracion_min || DURACION_POR_DEFECTO_MIN);
      case 'descanso': return planDescanso(d.intervalo_min || INTERVALO_DESCANSO_DEFECTO_MIN);
      default: throw new Error('Ese ejercicio no existe.');
    }
  }

  function ajustarPara(ejercicio, datos) {
    var d = datos || {};
    if (ejercicio === 'periferico') return ajustarPeriferico(d.nivel, d.racha || 0, !!d.acerto);
    if (ejercicio === 'destello') return ajustarDestello(d.exposicion_ms || EXPOSICION_INICIAL_MS, !!d.acerto, d.minimo_ms || EXPOSICION_MIN_DEFECTO_MS, !!d.sensible, !!d.reducido);
    throw new Error('Ese ejercicio no sube ni baja de nivel.');
  }

  /* ===========================================================================
     SEededRandom (para semillas reproducibles)
     =========================================================================== */
  function SeededRandom(seed) {
    this.seed = seed;
    this.random = function () {
      this.seed = (this.seed * 9301 + 49297) % 233280;
      return this.seed / 233280;
    };
    this.randomInt = function (min, max) {
      return min + Math.floor(this.random() * (max - min + 1));
    };
    this.sample = function (arr, n) {
      var copy = arr.slice();
      var res = [];
      for (var i = 0; i < n && copy.length; i++) {
        var idx = Math.floor(this.random() * copy.length);
        res.push(copy[idx]);
        copy.splice(idx, 1);
      }
      return res;
    };
  }

  function _sample(arr, n, rng) {
    var copy = arr.slice();
    var res = [];
    for (var i = 0; i < n && copy.length; i++) {
      var idx = Math.floor(rng.random() * copy.length);
      res.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return res;
  }

  /* ===========================================================================
     EXPORT
     =========================================================================== */
  window.RetoVision = {
    // Constantes
    NIVEL_MIN: NIVEL_MIN, NIVEL_MAX: NIVEL_MAX, NIVEL_POR_DEFECTO: NIVEL_POR_DEFECTO,
    MARGEN: MARGEN, DURACIONES_MIN: DURACIONES_MIN, DURACION_POR_DEFECTO_MIN: DURACION_POR_DEFECTO_MIN,
    NOMBRES_NIVEL: NOMBRES_NIVEL,

    // Planes
    planPara: planPara,
    ajustarPara: ajustarPara,
    planSeguimiento: planSeguimiento,
    planSacadas: planSacadas,
    planFila: planFila,
    planPeriferico: planPeriferico,
    ajustarPeriferico: ajustarPeriferico,
    planPiramide: planPiramide,
    rondaDestello: rondaDestello,
    ajustarDestello: ajustarDestello,
    planEnfoque: planEnfoque,
    planParpadeo: planParpadeo,
    planDescanso: planDescanso,

    // Utilidades
    acotarNivel: acotarNivel,
    acotarEntero: acotarEntero,
    acotarDuracion: acotarDuracion,
    exposicionMinima: exposicionMinima,
    SeededRandom: SeededRandom
  };

})(window);