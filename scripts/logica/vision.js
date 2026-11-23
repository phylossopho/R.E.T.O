/* R.E.T.O. - Ejercicios para la visión (puerto de logica/vision.py)
   Los planes de cada ejercicio (trayectorias, rondas, secuencias) y cómo sube
   o baja la dificultad sin castigo. La pantalla solo dibuja lo que aquí se decide. */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var B = nodo ? require('./_base.js') : raiz.RetoLogica._base;
  var D = B.dependencias(raiz, ['lectura_veloz']);
  var m = fabrica(B, D);
  if (nodo) module.exports = m; else B.registrar(raiz, 'vision', m);
})(typeof self !== 'undefined' ? self : this, function (B, D) {
  'use strict';
  var PyRandom = D.azar.PyRandom, ValueError = B.ValueError, lectura = D.lectura_veloz;
  var round = B.pyRound;

  var NIVEL_MIN = 1, NIVEL_MAX = 5, NIVEL_POR_DEFECTO = 2, MARGEN = 0.1;
  var DURACIONES_MIN = [1, 2, 3, 5], DURACION_POR_DEFECTO_MIN = 2;
  var NOMBRES_NIVEL = { 1: 'Muy lenta', 2: 'Lenta', 3: 'Normal', 4: 'Rápida', 5: 'Muy rápida' };

  function convInt(valor, defecto) {
    try { return B.aInt(valor); } catch (e) { if (e instanceof B.ConvError) return defecto; throw e; }
  }
  function acotarNivel(valor, defecto) {
    defecto = defecto === undefined ? NIVEL_POR_DEFECTO : defecto;
    var n = convInt(valor, null);
    return n === null ? defecto : Math.max(NIVEL_MIN, Math.min(NIVEL_MAX, n));
  }
  function acotarEntero(valor, minimo, maximo, defecto) {
    var n = convInt(valor, null);
    return n === null ? defecto : Math.max(minimo, Math.min(maximo, n));
  }
  function acotarDuracion(valor) {
    var n = convInt(valor, null);
    return n !== null && DURACIONES_MIN.indexOf(n) >= 0 ? n : DURACION_POR_DEFECTO_MIN;
  }
  function semillaDe(s) { return s === undefined ? null : s; }
  function elige(rng, texto) { return Array.isArray(texto) ? rng.choice(texto) : rng.choice(Array.from(texto)); }

  /* 1. SEGUIMIENTO */
  var TRAYECTORIAS = ['horizontal', 'vertical', 'diagonal', 'circulo', 'infinito'];
  var VELOCIDAD_SEGUIMIENTO = { 1: 12, 2: 20, 3: 30, 4: 42, 5: 55 };
  var PUNTOS_CURVA = 240, PAUSA_PASO_S = 1.5, PASOS_SEGUIMIENTO = 10;

  function trayectoria(nombre) {
    var a = MARGEN, b = 1 - MARGEN;
    if (nombre === 'horizontal') return [[a, 0.5], [b, 0.5], [a, 0.5]];
    if (nombre === 'vertical') return [[0.5, a], [0.5, b], [0.5, a]];
    if (nombre === 'diagonal') return [[a, a], [b, b], [a, a]];
    var puntos = [];
    for (var i = 0; i <= PUNTOS_CURVA; i++) {
      var t = 2 * Math.PI * i / PUNTOS_CURVA;
      if (nombre === 'circulo') puntos.push([0.5 + 0.4 * Math.cos(t), 0.5 + 0.4 * Math.sin(t)]);
      else {
        var d = 1 + Math.pow(Math.sin(t), 2);
        puntos.push([0.5 + 0.4 * Math.cos(t) / d, 0.5 + 0.4 * Math.sin(t) * Math.cos(t) / d]);
      }
    }
    return puntos;
  }

  function planSeguimiento(tray, nivel) {
    tray = tray === undefined ? 'horizontal' : tray;
    if (TRAYECTORIAS.indexOf(tray) < 0) tray = 'horizontal';
    nivel = acotarNivel(nivel);
    var puntos = trayectoria(tray), acumulado = [0.0], i;
    for (i = 0; i < puntos.length - 1; i++)
      acumulado.push(acumulado[acumulado.length - 1] + Math.hypot(puntos[i + 1][0] - puntos[i][0], puntos[i + 1][1] - puntos[i][1]));
    var longitud = acumulado[acumulado.length - 1], velocidad = VELOCIDAD_SEGUIMIENTO[nivel], pasos = [];
    for (i = 0; i < PASOS_SEGUIMIENTO; i++) {
      var objetivo = longitud * i / PASOS_SEGUIMIENTO, k = 1;
      while (k < acumulado.length - 1 && acumulado[k] < objetivo) k++;
      var tramo = (acumulado[k] - acumulado[k - 1]) || 1.0, f = (objetivo - acumulado[k - 1]) / tramo;
      var x = puntos[k - 1][0] + f * (puntos[k][0] - puntos[k - 1][0]);
      var y = puntos[k - 1][1] + f * (puntos[k][1] - puntos[k - 1][1]);
      pasos.push([round(x, 4), round(y, 4)]);
    }
    return { ejercicio: 'seguimiento', trayectoria: tray, nivel: nivel,
      puntos: puntos.map(function (p) { return [round(p[0], 4), round(p[1], 4)]; }),
      acumulado: acumulado.map(function (v) { return round(v, 5); }), longitud: round(longitud, 5), velocidad: velocidad,
      vuelta_s: round(longitud / (velocidad / 100), 2), pasos: pasos, pausa_paso_s: PAUSA_PASO_S };
  }

  /* 2. SACADAS */
  var VARIANTES_SACADAS = ['horizontal', 'vertical', 'aleatoria'];
  var PERMANENCIA_S = { 1: 1.6, 2: 1.2, 3: 1.0, 4: 0.85, 5: 0.7 };
  var INTERVALO_MIN_S = 0.7, SIMBOLOS_RETO = ['▲', '●', '■'], AMPLITUDES = [0.1, 0.2, 0.3, 0.4];

  function planSacadas(variante, nivel, cantidad, reto, semilla) {
    variante = variante === undefined ? 'horizontal' : variante;
    if (VARIANTES_SACADAS.indexOf(variante) < 0) variante = 'horizontal';
    nivel = acotarNivel(nivel);
    cantidad = acotarEntero(cantidad === undefined ? 24 : cantidad, 6, 60, 24);
    var rng = new PyRandom(semillaDe(semilla)), puntos = [], i;
    if (variante === 'aleatoria') {
      var x = 0.5, y = 0.5;
      for (i = 0; i < cantidad; i++) {
        var minimo = AMPLITUDES[i % AMPLITUDES.length], nx, ny;
        for (var q = 0; q < 60; q++) {
          nx = rng.uniform(MARGEN, 1 - MARGEN); ny = rng.uniform(MARGEN, 1 - MARGEN);
          if (Math.hypot(nx - x, ny - y) >= minimo) break;
        }
        x = nx; y = ny; puntos.push([x, y]);
      }
    } else {
      var lado = 1;
      for (i = 0; i < cantidad; i++) {
        var d = AMPLITUDES[Math.floor(i / 2) % AMPLITUDES.length];
        puntos.push(variante === 'horizontal' ? [0.5 + lado * d, 0.5] : [0.5, 0.5 + lado * d]);
        lado = -lado;
      }
    }
    var salida = puntos.map(function (p) { return { x: round(p[0], 4), y: round(p[1], 4), simbolo: rng.choice(SIMBOLOS_RETO) }; });
    return { ejercicio: 'sacadas', variante: variante, nivel: nivel, puntos: salida,
      permanencia_s: Math.max(PERMANENCIA_S[nivel], INTERVALO_MIN_S), intervalo_min_s: INTERVALO_MIN_S, fundido_ms: 100,
      reto: !!reto, simbolos: SIMBOLOS_RETO.slice() };
  }

  /* 3. FILA */
  var MS_POR_SIMBOLO = { 1: 1100, 2: 800, 3: 600, 4: 450, 5: 350 };
  var PESO_MAX_FILA = 2.0, LETRAS_FILA = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ', NUMEROS_FILA = '123456789';
  var TIPOS_FILA = ['letras', 'numeros', 'mixto'];

  function planFila(tipo, porFila, filas, nivel, semilla) {
    tipo = tipo === undefined ? 'letras' : tipo;
    if (TIPOS_FILA.indexOf(tipo) < 0) tipo = 'letras';
    nivel = acotarNivel(nivel);
    porFila = acotarEntero(porFila === undefined ? 8 : porFila, 2, 14, 8);
    filas = acotarEntero(filas === undefined ? 4 : filas, 1, 8, 4);
    var rng = new PyRandom(semillaDe(semilla));
    var fuente = tipo === 'letras' ? LETRAS_FILA : tipo === 'numeros' ? NUMEROS_FILA : LETRAS_FILA + NUMEROS_FILA;
    var renglones = [];
    for (var r = 0; r < filas; r++) {
      var fila = [];
      for (var k = 0; k < porFila; k++) {
        var c = elige(rng, fuente);
        while (fila.length && c === fila[fila.length - 1]) c = elige(rng, fuente);
        fila.push(c);
      }
      renglones.push(fila);
    }
    var pacer = lectura.plan_pacer(renglones.map(function (f) { return f.join(' '); }), 1);
    var tramos = pacer.tramos.map(function (t) { return { desde: t.desde, hasta: t.hasta, peso: Math.min(PESO_MAX_FILA, t.peso) }; });
    return { ejercicio: 'fila', tipo: tipo, nivel: nivel, filas: renglones, tramos: tramos, ms_por_simbolo: MS_POR_SIMBOLO[nivel] };
  }

  /* 4. PERIFÉRICO */
  var FORMAS = ['▲', '●', '■', '◆', '★'];
  var NOMBRES_FORMA = { '▲': 'triángulo', '●': 'círculo', '■': 'cuadrado', '◆': 'rombo', '★': 'estrella' };
  var DIGITOS = '123456789';
  var ANILLOS = { cerca: [0.35, 0.5], media: [0.55, 0.75], lejos: [0.8, 0.95] };
  var ANILLOS_POR_NIVEL = { 1: ['cerca'], 2: ['cerca', 'media'], 3: ['media'], 4: ['media', 'lejos'], 5: ['lejos'] };
  var TIEMPO_PERIFERICO_MS = { 1: 1200, 2: 900, 3: 700, 4: 550, 5: 400 };
  var TIEMPO_PERIFERICO_MIN_MS = 400, ACIERTOS_PARA_SUBIR = 3;

  function planPeriferico(nivel, cantidad, semilla, sinTiempo) {
    nivel = acotarNivel(nivel);
    cantidad = acotarEntero(cantidad === undefined ? 12 : cantidad, 1, 40, 12);
    var rng = new PyRandom(semillaDe(semilla)), nOpciones = nivel < 3 ? 3 : 4, rondas = [];
    for (var i = 0; i < cantidad; i++) {
      var anillo = rng.choice(ANILLOS_POR_NIVEL[nivel]), ab = ANILLOS[anillo];
      var usaNumero = nivel >= 3 && rng.random() < 0.5;
      var base = usaNumero ? Array.from(DIGITOS) : FORMAS;
      var valor = rng.choice(base), opciones = [valor];
      while (opciones.length < nOpciones) { var c = rng.choice(base); if (opciones.indexOf(c) < 0) opciones.push(c); }
      rng.shuffle(opciones);
      rondas.push({ tipo: usaNumero ? 'numero' : 'forma', valor: valor, nombre: usaNumero ? valor : NOMBRES_FORMA[valor],
        opciones: opciones, correcta: opciones.indexOf(valor), anillo: anillo,
        radio: round(rng.uniform(ab[0], ab[1]), 3), angulo: round(rng.uniform(0, 2 * Math.PI), 3) });
    }
    return { ejercicio: 'periferico', nivel: nivel, rondas: rondas,
      tiempo_ms: sinTiempo ? 0 : Math.max(TIEMPO_PERIFERICO_MS[nivel], TIEMPO_PERIFERICO_MIN_MS) };
  }

  function ajustarPeriferico(nivel, racha, acerto) {
    nivel = acotarNivel(nivel);
    racha = Math.max(0, acotarEntero(racha, 0, 99, 0));
    if (acerto) {
      racha += 1;
      if (racha >= ACIERTOS_PARA_SUBIR && nivel < NIVEL_MAX) return { nivel: nivel + 1, racha: 0 };
      return { nivel: nivel, racha: racha };
    }
    return { nivel: Math.max(NIVEL_MIN, nivel - 1), racha: 0 };
  }

  /* 5. PIRÁMIDE */
  var LETRAS_PIRAMIDE = 'ABCDEFGHJKLMNPRSTUVXZ', MAX_FILAS_PIRAMIDE = 9;
  var SEGUNDOS_PIRAMIDE = { 1: 14, 2: 10, 3: 8, 4: 6, 5: 5 };

  function planPiramide(maxAncho, maxFilas, semilla, nivel) {
    maxAncho = acotarEntero(maxAncho === undefined ? 15 : maxAncho, 5, 31, 15);
    maxFilas = acotarEntero(maxFilas === undefined ? MAX_FILAS_PIRAMIDE : maxFilas, 3, MAX_FILAS_PIRAMIDE, MAX_FILAS_PIRAMIDE);
    var rng = new PyRandom(semillaDe(semilla)), filas = [], largo = 1;
    while (largo <= maxAncho && filas.length < maxFilas) {
      var fila = [];
      for (var k = 0; k < largo; k++) {
        var c = elige(rng, LETRAS_PIRAMIDE);
        while (fila.length && c === fila[fila.length - 1]) c = elige(rng, LETRAS_PIRAMIDE);
        fila.push(c);
      }
      filas.push(fila.join(''));
      largo += 2;
    }
    return { ejercicio: 'piramide', filas: filas, centro: filas.map(function (f) { return Math.floor(f.length / 2); }),
      segundos: SEGUNDOS_PIRAMIDE[acotarNivel(nivel)] };
  }

  /* 6. DESTELLO */
  var EXPOSICION_INICIAL_MS = 1000, EXPOSICION_PASO_MS = 100, EXPOSICION_MIN_SEGURA_MS = 300;
  var EXPOSICION_MIN_DEFECTO_MS = 500, EXPOSICION_MIN_SENSIBLE_MS = 800, EXPOSICION_MAX_MS = 1500;
  var MATERIALES = ['palabras', 'numeros', 'figuras'];
  var PALABRAS = ['casa', 'luz', 'mesa', 'rio', 'sol', 'pan', 'flor', 'mar', 'tren', 'libro', 'nube', 'gato', 'perro', 'silla',
    'lapiz', 'plaza', 'monte', 'barco', 'campo', 'playa', 'viento', 'fuego', 'tierra', 'piedra', 'hoja', 'arbol', 'puerta',
    'ventana', 'camino', 'puente', 'isla', 'calle', 'reloj', 'carta', 'mundo'];

  function exposicionMinima(baseMs, sensible, reducido) {
    var base = acotarEntero(baseMs === undefined ? EXPOSICION_MIN_DEFECTO_MS : baseMs, EXPOSICION_MIN_SEGURA_MS, EXPOSICION_MAX_MS, EXPOSICION_MIN_DEFECTO_MS);
    if (sensible || reducido) base = Math.max(base, EXPOSICION_MIN_SENSIBLE_MS);
    return base;
  }
  function ajustarDestello(exposicionMs, acerto, minimoMs, sensible, reducido) {
    var piso = exposicionMinima(minimoMs, sensible, reducido);
    var actual = acotarEntero(exposicionMs, EXPOSICION_MIN_SEGURA_MS, EXPOSICION_MAX_MS, EXPOSICION_INICIAL_MS);
    actual = Math.max(actual, piso);
    if (acerto) actual = Math.max(piso, actual - EXPOSICION_PASO_MS);
    else actual = Math.min(EXPOSICION_MAX_MS, actual + EXPOSICION_PASO_MS);
    return { exposicion_ms: actual, minimo_ms: piso };
  }
  function elegirItems(material, cantidad, rng) {
    if (material === 'palabras') return rng.sample(PALABRAS, cantidad);
    if (material === 'numeros') {
      var r = []; for (var n = 10; n < 100; n++) r.push(n);
      return rng.sample(r, cantidad).map(String);
    }
    var s = []; for (var i = 0; i < cantidad; i++) s.push(rng.choice(FORMAS));
    return s;
  }
  function igualLista(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }

  function rondaDestello(material, cantidad, exposicionMs, semilla, minimoMs, sensible, reducido) {
    material = material === undefined ? 'palabras' : material;
    if (MATERIALES.indexOf(material) < 0) material = 'palabras';
    cantidad = acotarEntero(cantidad === undefined ? 4 : cantidad, 3, 6, 4);
    var rng = new PyRandom(semillaDe(semilla)), items = elegirItems(material, cantidad, rng);
    var opciones = [items], intentos = 0;
    while (opciones.length < 4 && intentos < 200) {
      intentos++;
      var cambio = items.slice(), idx = []; for (var q = 0; q < cantidad; q++) idx.push(q);
      var pos = rng.sample(idx, Math.min(cantidad, rng.choice([1, 2])));
      pos.forEach(function (p) {
        var nuevo = elegirItems(material, 1, rng)[0];
        if (cambio.indexOf(nuevo) < 0) cambio[p] = nuevo;
      });
      if (!opciones.some(function (o) { return igualLista(o, cambio); })) opciones.push(cambio);
    }
    rng.shuffle(opciones);
    var piso = exposicionMinima(minimoMs, sensible, reducido);
    var correcta = -1; opciones.forEach(function (o, i) { if (correcta < 0 && igualLista(o, items)) correcta = i; });
    return { ejercicio: 'destello', material: material, items: items, opciones: opciones, correcta: correcta,
      exposicion_ms: Math.max(piso, acotarEntero(exposicionMs === undefined ? EXPOSICION_INICIAL_MS : exposicionMs,
        EXPOSICION_MIN_SEGURA_MS, EXPOSICION_MAX_MS, EXPOSICION_INICIAL_MS)), minimo_ms: piso, fundido_ms: 100 };
  }

  /* 7. ENFOQUE · 8. PARPADEO · 9. DESCANSO */
  var DESCANSO_SEG = 20, DESCANSO_DISTANCIA_M = 6;
  var INTERVALOS_DESCANSO_MIN = [10, 15, 20, 30, 45, 60], INTERVALO_DESCANSO_DEFECTO_MIN = 20;
  var SEG_CERCA = { 1: 12, 2: 10, 3: 8, 4: 6, 5: 5 };

  function planEnfoque(duracionMin, nivel) {
    duracionMin = acotarDuracion(duracionMin === undefined ? DURACION_POR_DEFECTO_MIN : duracionMin);
    nivel = acotarNivel(nivel);
    var cerca = SEG_CERCA[nivel], fases = [], total = 0, limite = duracionMin * 60;
    while (total + DESCANSO_SEG + cerca <= limite || !fases.length) {
      fases.push({ fase: 'lejos', seg: DESCANSO_SEG, mensaje: 'Mira un objeto lejano, a unos ' + DESCANSO_DISTANCIA_M + ' metros (por la ventana, por ejemplo).' });
      fases.push({ fase: 'cerca', seg: cerca, mensaje: 'Ahora mira esta pantalla, al punto del centro.' });
      total += DESCANSO_SEG + cerca;
    }
    return { ejercicio: 'enfoque', nivel: nivel, fases: fases, total_s: total };
  }

  var RITMOS_PARPADEO = { 1: 6.0, 2: 5.0, 3: 4.0 }, CIERRA_S = 0.8, ABRE_S = 0.8;
  function planParpadeo(ritmo, duracionMin) {
    ritmo = acotarEntero(ritmo === undefined ? 2 : ritmo, 1, 3, 2);
    duracionMin = acotarDuracion(duracionMin === undefined ? DURACION_POR_DEFECTO_MIN : duracionMin);
    var ciclo = RITMOS_PARPADEO[ritmo];
    return { ejercicio: 'parpadeo', ritmo: ritmo, ciclo_s: ciclo, cierra_s: CIERRA_S, abre_s: ABRE_S,
      espera_s: round(ciclo - CIERRA_S - ABRE_S, 2), repeticiones: Math.floor(duracionMin * 60 / ciclo),
      texto_reducido: 'Parpadea 3 veces, despacio. Descansa un momento. Repite.' };
  }

  function planDescanso(intervaloMin) {
    var n = convInt(intervaloMin === undefined ? INTERVALO_DESCANSO_DEFECTO_MIN : intervaloMin, INTERVALO_DESCANSO_DEFECTO_MIN);
    if (INTERVALOS_DESCANSO_MIN.indexOf(n) < 0) n = INTERVALO_DESCANSO_DEFECTO_MIN;
    return { ejercicio: 'descanso', intervalo_min: n, intervalos: INTERVALOS_DESCANSO_MIN.slice(), descanso_seg: DESCANSO_SEG,
      distancia_m: DESCANSO_DISTANCIA_M, mensaje: 'Mira un objeto a unos ' + DESCANSO_DISTANCIA_M + ' metros durante ' + DESCANSO_SEG + ' segundos.' };
  }

  /* Rutas */
  function nz(d, k, def) { return d[k] === undefined ? def : d[k]; }
  function planPara(ejercicio, datos) {
    var d = datos || {};
    switch (ejercicio) {
      case 'seguimiento': return planSeguimiento(nz(d, 'trayectoria', 'horizontal'), d.nivel);
      case 'sacadas': return planSacadas(nz(d, 'variante', 'horizontal'), d.nivel, nz(d, 'cantidad', 24), nz(d, 'reto', false), d.semilla);
      case 'fila': return planFila(nz(d, 'tipo', 'letras'), nz(d, 'por_fila', 8), nz(d, 'filas', 4), d.nivel, d.semilla);
      case 'periferico': return planPeriferico(d.nivel, nz(d, 'cantidad', 12), d.semilla, !!d.sin_tiempo);
      case 'piramide': return planPiramide(nz(d, 'max_ancho', 15), nz(d, 'max_filas', MAX_FILAS_PIRAMIDE), d.semilla, d.nivel);
      case 'destello': return rondaDestello(nz(d, 'material', 'palabras'), nz(d, 'cantidad', 4), nz(d, 'exposicion_ms', EXPOSICION_INICIAL_MS),
        d.semilla, nz(d, 'minimo_ms', EXPOSICION_MIN_DEFECTO_MS), !!d.sensible, !!d.reducido);
      case 'enfoque': return planEnfoque(nz(d, 'duracion_min', DURACION_POR_DEFECTO_MIN), d.nivel);
      case 'parpadeo': return planParpadeo(nz(d, 'ritmo', 2), nz(d, 'duracion_min', DURACION_POR_DEFECTO_MIN));
      case 'descanso': return planDescanso(nz(d, 'intervalo_min', INTERVALO_DESCANSO_DEFECTO_MIN));
    }
    throw new ValueError('Ese ejercicio no existe.');
  }
  function ajustarPara(ejercicio, datos) {
    var d = datos || {};
    if (ejercicio === 'periferico') return ajustarPeriferico(d.nivel, nz(d, 'racha', 0), !!d.acerto);
    if (ejercicio === 'destello') return ajustarDestello(nz(d, 'exposicion_ms', EXPOSICION_INICIAL_MS), !!d.acerto,
      nz(d, 'minimo_ms', EXPOSICION_MIN_DEFECTO_MS), !!d.sensible, !!d.reducido);
    throw new ValueError('Ese ejercicio no sube ni baja de nivel.');
  }

  return { NIVEL_MIN: NIVEL_MIN, NIVEL_MAX: NIVEL_MAX, NIVEL_POR_DEFECTO: NIVEL_POR_DEFECTO, MARGEN: MARGEN,
    DURACIONES_MIN: DURACIONES_MIN, NOMBRES_NIVEL: NOMBRES_NIVEL,
    acotar_nivel: acotarNivel, acotar_entero: acotarEntero, acotar_duracion: acotarDuracion,
    plan_seguimiento: planSeguimiento, plan_sacadas: planSacadas, plan_fila: planFila, plan_periferico: planPeriferico,
    ajustar_periferico: ajustarPeriferico, plan_piramide: planPiramide, exposicion_minima: exposicionMinima,
    ajustar_destello: ajustarDestello, ronda_destello: rondaDestello, plan_enfoque: planEnfoque, plan_parpadeo: planParpadeo,
    plan_descanso: planDescanso, plan_para: planPara, ajustar_para: ajustarPara };
});
