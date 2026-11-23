/* R.E.T.O. - Lectura Veloz (puerto de logica/lectura_veloz.py)
   Los planes de cada motor de lectura: galáctico, palabra por palabra, grupos,
   frases, prueba de velocidad, pacer/columnas y skimming. Todo son funciones
   puras: reciben los párrafos y devuelven el plan; la pantalla solo lo dibuja. */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var B = nodo ? require('./_base.js') : raiz.RetoLogica._base;
  var m = fabrica(B);
  if (nodo) module.exports = m; else B.registrar(raiz, 'lectura_veloz', m);
})(typeof self !== 'undefined' ? self : this, function (B) {
  'use strict';
  var ValueError = B.ValueError;

  var WPM_MIN = 50, WPM_MAX = 999, WPM_PASO = 10, WPM_POR_DEFECTO = 300, CUENTA_SEG = 3;
  var PAUSA_MS = { oracion: 600, coma: 350, guion: 300, nada: 200 };
  var PAUSA_BASE_MS = PAUSA_MS.nada;
  var ESCALA_INICIO = { min: 60, max: 160, paso: 5, defecto: 100 };
  var ESCALA_FIN = { min: 10, max: 80, paso: 5, defecto: 30 };
  var MAX_PALABRAS = 300000, MAX_PARRAFOS = 20000;

  function wpmInfo() { return { min: WPM_MIN, max: WPM_MAX, paso: WPM_PASO }; }
  function nfc(s) { return s.normalize('NFC'); }

  function partirPalabras(texto) { return typeof texto === 'string' ? B.pySplit(texto) : []; }
  function limpiarParrafo(texto) { return typeof texto === 'string' ? B.pySplit(texto).join(' ') : ''; }

  function acotarWpm(valor) {
    var n;
    try { n = B.pyRound(B.aFloat(valor)); if (!isFinite(n)) return WPM_POR_DEFECTO; } catch (e) { if (e instanceof B.ConvError) return WPM_POR_DEFECTO; throw e; }
    n = B.pyRound(n / WPM_PASO) * WPM_PASO;
    return Math.max(WPM_MIN, Math.min(WPM_MAX, n));
  }
  function acotarEscala(rango, valor) {
    var n;
    try { n = B.aFloat(valor); } catch (e) { if (e instanceof B.ConvError) return rango.defecto; throw e; }
    if (n !== n || n === Infinity || n === -Infinity) return rango.defecto;
    n = B.pyRound(n / rango.paso) * rango.paso;
    return Math.max(rango.min, Math.min(rango.max, n));
  }

  function leerParrafos(parrafos) {
    if (!Array.isArray(parrafos)) throw new ValueError('Falta la lista de parrafos.');
    var salida = [], total = 0;
    for (var i = 0; i < parrafos.length; i++) {
      var texto = limpiarParrafo(parrafos[i]);
      if (!texto) continue;
      var palabras = partirPalabras(texto);
      total += palabras.length;
      if (total > MAX_PALABRAS) throw new ValueError('Este texto es demasiado largo para este modo. Prueba con un capitulo o una parte.');
      salida.push({ texto: texto, palabras: palabras });
      if (salida.length > MAX_PARRAFOS) throw new ValueError('Este texto tiene demasiados parrafos para este modo. Prueba con un capitulo o una parte.');
    }
    if (!salida.length) throw new ValueError('Este texto no tiene palabras que leer.');
    return salida;
  }

  function planGalactico(parrafos) {
    var salida = leerParrafos(parrafos).map(function (p) { return { texto: p.texto, palabras: p.palabras.length }; });
    return { motor: 'galactico', parrafos: salida, total_palabras: salida.reduce(function (a, p) { return a + p.palabras; }, 0),
      cuenta_seg: CUENTA_SEG, wpm: wpmInfo(), escala: { inicio: Object.assign({}, ESCALA_INICIO), fin: Object.assign({}, ESCALA_FIN) } };
  }

  /* ----- pausas y punto de fijación ----- */
  var CIERRES = '"\'\u201d\u2019\u00bb\u203a)]}*_';
  var FINALES_ORACION = '.!?\u2026', FINALES_COMA = ',;:', GUIONES = '-\u2013\u2014', VINETAS = '-\u2013\u2014\u2022\u00b7*\u25aa\u25e6';
  var LISTA_NUMERADA = /^\d{1,3}[.)]$/;
  var ABREVIATURAS = ['sr', 'sra', 'srta', 'dr', 'dra', 'lic', 'ing', 'prof', 'av', 'n\u00fam', 'p\u00e1g', 'p\u00e1gs', 'vs', 'art', 'ej', 'tel'];

  function rstripSet(s, set) { var f = s.length; while (f > 0 && set.indexOf(s.charAt(f - 1)) >= 0) f--; return s.slice(0, f); }

  function esAbreviatura(fin) {
    var nucleo = fin.slice(0, -1), i = 0;
    while (i < nucleo.length && !B.esAlnumEn(nucleo, i)) i++;
    nucleo = nucleo.slice(i);
    if (nucleo.length === 1 && B.esAlfa(nucleo)) return true;
    return ABREVIATURAS.indexOf(nucleo.toLowerCase()) >= 0;
  }

  function tipoDePausa(palabra) {
    if (typeof palabra !== 'string' || !palabra) return 'nada';
    var todas = true;
    for (var k = 0; k < palabra.length; k++) if (VINETAS.indexOf(palabra.charAt(k)) < 0) { todas = false; break; }
    if (todas || LISTA_NUMERADA.test(palabra)) return 'guion';
    var fin = rstripSet(palabra, CIERRES);
    if (!fin) return 'nada';
    var ultimo = fin.charAt(fin.length - 1);
    if (FINALES_ORACION.indexOf(ultimo) >= 0) {
      if (ultimo === '.' && esAbreviatura(fin)) return 'nada';
      return 'oracion';
    }
    if (FINALES_COMA.indexOf(ultimo) >= 0) return 'coma';
    if (GUIONES.indexOf(ultimo) >= 0) return 'guion';
    return 'nada';
  }
  function pausaMs(palabra) { return PAUSA_MS[tipoDePausa(palabra)]; }

  function puntoDeFijacion(palabra) {
    if (typeof palabra !== 'string' || !palabra) return 0;
    var inicio = null, fin = 0, i;
    for (i = 0; i < palabra.length; i++) if (B.esAlnumEn(palabra, i)) { if (inicio === null) inicio = i; fin = i + 1; }
    if (inicio === null) return 0;
    var largo = fin - inicio, desp;
    if (largo <= 1) desp = 0; else if (largo <= 5) desp = 1; else if (largo <= 9) desp = 2; else if (largo <= 13) desp = 3; else desp = 4;
    var objetivo = inicio + desp;
    for (var lejos = 0; lejos < palabra.length; lejos++) {
      var cand = [objetivo - lejos, objetivo + lejos];
      for (var c = 0; c < 2; c++) { i = cand[c]; if (i >= 0 && i < palabra.length && B.esAlnumEn(palabra, i)) return i; }
    }
    return objetivo;
  }

  function planPalabra(parrafos) {
    var palabras = [], foco = [], pausa = [];
    leerParrafos(parrafos).forEach(function (par) {
      var lista = par.palabras, ultima = lista.length - 1;
      lista.forEach(function (crudo, i) {
        var palabra = nfc(crudo), ms = pausaMs(palabra);
        if (i === ultima) ms = Math.max(ms, PAUSA_MS.oracion);
        palabras.push(palabra); foco.push(puntoDeFijacion(palabra)); pausa.push(ms);
      });
    });
    return { motor: 'palabra', palabras: palabras, foco: foco, pausa: pausa, pausa_base_ms: PAUSA_BASE_MS,
      total_palabras: palabras.length, cuenta_seg: CUENTA_SEG, wpm: wpmInfo() };
  }

  /* ----- grupos ----- */
  function esFinFuerte(palabra) {
    if (typeof palabra !== 'string' || !palabra) return false;
    var fin = rstripSet(palabra, CIERRES);
    return !!fin && FINALES_ORACION.indexOf(fin.charAt(fin.length - 1)) >= 0;
  }
  function agruparPalabras(palabras, n) {
    if (!palabras.length) return [];
    var grupos = [], actual = [];
    palabras.forEach(function (p) {
      actual.push(p);
      if (actual.length === n) { grupos.push(actual); actual = []; }
      else if (esFinFuerte(p) && actual.length) { grupos.push(actual); actual = []; }
    });
    if (actual.length) { if (grupos.length) Array.prototype.push.apply(grupos[grupos.length - 1], actual); else grupos.push(actual); }
    if (grupos.length >= 2 && grupos[grupos.length - 1].length < n && n <= grupos[grupos.length - 2].length) {
      Array.prototype.push.apply(grupos[grupos.length - 2], grupos[grupos.length - 1]);
      grupos.pop();
    }
    return grupos;
  }
  function orpIndiceGrupo(g) { var n = g.length; if (n <= 2) return 0; if (n === 4) return 1; return Math.floor(n / 2); }

  function planGrupo(parrafos, tamanoGrupo) {
    if (tamanoGrupo !== 3 && tamanoGrupo !== 4) tamanoGrupo = 3;
    var todas = [];
    leerParrafos(parrafos).forEach(function (par) { Array.prototype.push.apply(todas, par.palabras); });
    var gp = agruparPalabras(todas, tamanoGrupo), grupos = [], total = 0;
    gp.forEach(function (g) {
      total += g.length;
      grupos.push({ palabras: g.map(nfc), orp_idx: orpIndiceGrupo(g), pausa: pausaMs(nfc(g[g.length - 1])) });
    });
    if (grupos.length) grupos[grupos.length - 1].pausa = Math.max(grupos[grupos.length - 1].pausa, PAUSA_MS.oracion);
    return { motor: 'grupo', grupos: grupos, total_palabras: total, total_grupos: grupos.length, cuenta_seg: CUENTA_SEG,
      wpm: wpmInfo(), pausa_base_ms: PAUSA_BASE_MS, tamano_grupo: tamanoGrupo };
  }

  /* ----- frases ----- */
  var MAX_PALABRAS_FRASE = 25, MIN_PALABRAS_FRASE = 4;
  function partirOracionLarga(palabras) {
    if (palabras.length <= MAX_PALABRAS_FRASE) return [palabras.slice()];
    var piezas = [], resto = palabras.slice();
    while (resto.length > MAX_PALABRAS_FRASE) {
      var cuantas = Math.ceil(resto.length / MAX_PALABRAS_FRASE), ideal = B.pyRound(resto.length / cuantas);
      var tope = Math.min(MAX_PALABRAS_FRASE, resto.length - MIN_PALABRAS_FRASE), mejor = null;
      for (var largo = MIN_PALABRAS_FRASE; largo <= tope; largo++) {
        if (tipoDePausa(resto[largo - 1]) === 'coma') {
          if (mejor === null || Math.abs(largo - ideal) < Math.abs(mejor - ideal)) mejor = largo;
        }
      }
      if (mejor === null) mejor = ideal;
      piezas.push(resto.slice(0, mejor));
      resto = resto.slice(mejor);
    }
    piezas.push(resto);
    return piezas;
  }
  function frasesDeParrafo(palabras) {
    var frases = [], actual = [];
    palabras.forEach(function (p) {
      actual.push(p);
      if (tipoDePausa(p) === 'oracion') { Array.prototype.push.apply(frases, partirOracionLarga(actual)); actual = []; }
    });
    if (actual.length) Array.prototype.push.apply(frases, partirOracionLarga(actual));
    return frases;
  }
  function suma(a, d, h) { var s = 0; for (var i = d; i < h && i < a.length; i++) s += a[i]; return s; }

  function planFrases(parrafos) {
    var frases = [], totalPalabras = 0;
    leerParrafos(parrafos).forEach(function (par) {
      var lista = par.palabras.map(nfc), pesos = lista.map(pausaMs);
      pesos[pesos.length - 1] = Math.max(pesos[pesos.length - 1], PAUSA_MS.oracion);
      var inicio = 0;
      frasesDeParrafo(lista).forEach(function (frase) {
        var fin = inicio + frase.length;
        frases.push({ texto: frase.join(' '), palabras: frase.length, pausa: suma(pesos, inicio, fin) });
        totalPalabras += frase.length; inicio = fin;
      });
    });
    return { motor: 'frases', frases: frases, total_palabras: totalPalabras, total_frases: frases.length,
      pausa_base_ms: PAUSA_BASE_MS, cuenta_seg: CUENTA_SEG, wpm: wpmInfo() };
  }

  /* ----- prueba de velocidad ----- */
  var MIN_PALABRAS_PRUEBA = 100, MAX_PALABRAS_PRUEBA = 600, PPM_BRUTAS_MAX = 1500;
  var PREGUNTAS_PRUEBA = { min: 3, max: 5, defecto: 4 };

  function planPrueba(parrafos) {
    var textos = [], total = 0, recortado = false;
    var leidos = leerParrafos(parrafos);
    for (var i = 0; i < leidos.length; i++) {
      var par = leidos[i], palabras = par.palabras;
      if (total + palabras.length > MAX_PALABRAS_PRUEBA) {
        recortado = true;
        if (!textos.length) { palabras = palabras.slice(0, MAX_PALABRAS_PRUEBA); textos.push(palabras.join(' ')); total = palabras.length; }
        break;
      }
      textos.push(par.texto); total += palabras.length;
    }
    if (total < MIN_PALABRAS_PRUEBA) throw new ValueError('Este texto es muy corto para medir la velocidad (necesita al menos ' + MIN_PALABRAS_PRUEBA + ' palabras). Elige uno más largo.');
    return { motor: 'prueba', parrafos: textos, total_palabras: total, recortado: recortado,
      preguntas: Object.assign({}, PREGUNTAS_PRUEBA), ppm_brutas_max: PPM_BRUTAS_MAX };
  }

  function calcularVelocidad(palabras, segundos, aciertos, preguntas) {
    var nP, nS, nA, nQ;
    try { nP = B.aInt(palabras); nS = B.aFloat(segundos); nA = B.aInt(aciertos); nQ = B.aInt(preguntas); }
    catch (e) { if (e instanceof B.ConvError) throw new ValueError('Faltan datos para calcular la velocidad.'); throw e; }
    if (nP <= 0 || nS < 0 || nQ < 0 || nA < 0 || nS !== nS) throw new ValueError('Los datos de la prueba no tienen sentido.');
    nA = Math.min(nA, nQ);
    var minutos = Math.max(nS, 1.0) / 60, brutas = nP / minutos, comprension = null, efectivas = null;
    if (nQ) { comprension = B.pyRound(nA / nQ, 2); efectivas = B.pyRound(brutas * (nA / nQ)); }
    var saltada = brutas > PPM_BRUTAS_MAX;
    return { ppm_brutas: B.pyRound(brutas), comprension: comprension, ppm_efectivas: efectivas, saltada: saltada,
      entra_al_historial: (!saltada) && nQ > 0 };
  }

  /* ----- pacer / columnas ----- */
  var MAX_PALABRAS_PACER = 12000, TRAMOS_PACER = [1, 2, 3], TRAMO_PACER_POR_DEFECTO = 3, PPM_SUGERIDA_PACER = 250, PAUSA_PARRAFO_MS = 750;

  function planPacer(parrafos, palabrasPorTramo) {
    var n = TRAMOS_PACER.indexOf(palabrasPorTramo) >= 0 ? palabrasPorTramo : TRAMO_PACER_POR_DEFECTO;
    var palabras = [], pausa = [], inicios = [], tramos = [], recortado = false;
    var leidos = leerParrafos(parrafos);
    for (var q = 0; q < leidos.length; q++) {
      var lista = leidos[q].palabras.map(nfc);
      if (palabras.length + lista.length > MAX_PALABRAS_PACER) {
        recortado = true;
        if (palabras.length) break;
        lista = lista.slice(0, MAX_PALABRAS_PACER);
      }
      var pesos = lista.map(pausaMs);
      pesos[pesos.length - 1] = Math.max(pesos[pesos.length - 1], PAUSA_PARRAFO_MS);
      var base = palabras.length;
      inicios.push(base);
      Array.prototype.push.apply(palabras, lista);
      Array.prototype.push.apply(pausa, pesos);
      var desde = base, grupos = agruparPalabras(lista, n);
      for (var g = 0; g < grupos.length; g++) {
        var grupo = grupos[g], hasta = desde + grupo.length - 1, s = suma(pausa, desde, hasta + 1);
        tramos.push({ desde: desde, hasta: hasta, pausa: s, peso: B.pyRound(s / (grupo.length * PAUSA_BASE_MS), 2) });
        desde = hasta + 1;
      }
    }
    return { motor: 'pacer', palabras: palabras, pausa: pausa, parrafo_inicio: inicios, tramos: tramos, palabras_por_tramo: n,
      total_palabras: palabras.length, recortado: recortado, ppm_sugerida: PPM_SUGERIDA_PACER, pausa_base_ms: PAUSA_BASE_MS,
      cuenta_seg: CUENTA_SEG, wpm: wpmInfo() };
  }

  /* ----- skimming ----- */
  var MAX_PALABRAS_SKIM = 8000, LETRAS_CLAVE_MIN = 7, REPETICIONES_CLAVE_MIN = 2, MAX_CLAVES = 40, MAX_PALABRAS_PRIMERA_FRASE = 28;
  var SEGUNDOS_PASADA = { min: 5, max: 120, defecto: 20 };
  var NO_CLAVE = ['también', 'después', 'entonces', 'mientras', 'además', 'durante', 'aunque', 'nosotros', 'ustedes', 'algunos',
    'muchos', 'siempre', 'porque', 'cuando', 'tambien', 'despues', 'ademas', 'través', 'hacia', 'sobre', 'dentro', 'ninguno',
    'alguna', 'algunas', 'bastante', 'cualquier', 'estaba', 'estaban', 'pueden', 'podemos', 'tienen', 'tiene', 'hemos', 'había', 'habían'];

  function nucleo(palabra) {
    var s = '';
    for (var i = 0; i < palabra.length; i++) if (B.esAlnumEn(palabra, i)) s += palabra.charAt(i);
    return nfc(s).toLowerCase();
  }
  function longitudPuntos(s) { return Array.from(s).length; }
  function primeraFrase(palabras) {
    var salida = [];
    for (var i = 0; i < palabras.length; i++) {
      salida.push(palabras[i]);
      if (tipoDePausa(palabras[i]) === 'oracion') break;
      if (salida.length >= MAX_PALABRAS_PRIMERA_FRASE) { salida[salida.length - 1] = rstripSet(salida[salida.length - 1], ',;:') + '…'; break; }
    }
    return salida.join(' ');
  }
  function leerEstructura(parrafos) {
    if (!Array.isArray(parrafos)) throw new ValueError('Falta la lista de parrafos.');
    var salida = [], total = 0;
    for (var i = 0; i < parrafos.length; i++) {
      var crudo = parrafos[i], titulo = false, nivel = 0;
      if (B.esObjeto(crudo)) {
        titulo = !!crudo.titulo;
        try { nivel = titulo ? Math.min(4, Math.max(1, B.aInt(crudo.nivel || 1))) : 0; }
        catch (e) { if (e instanceof B.ConvError) nivel = titulo ? 1 : 0; else throw e; }
        crudo = crudo.texto;
      }
      var texto = limpiarParrafo(crudo);
      if (!texto) continue;
      var palabras = partirPalabras(texto);
      total += palabras.length;
      if (total > MAX_PALABRAS_SKIM) break;
      salida.push({ texto: texto, palabras: palabras, titulo: titulo, nivel: nivel });
    }
    if (!salida.length) throw new ValueError('No hay nada que leer en este texto.');
    return salida;
  }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  function planSkimming(parrafos) {
    var estructura = leerEstructura(parrafos), titulos;
    var cuerpo = estructura.filter(function (p) { return !p.titulo; });
    if (!cuerpo.length) { cuerpo = estructura; titulos = []; } else titulos = estructura.filter(function (p) { return p.titulo; });
    var cuenta = {};
    cuerpo.forEach(function (par) {
      par.palabras.forEach(function (p) {
        var n = nucleo(p);
        if (longitudPuntos(n) >= LETRAS_CLAVE_MIN && B.esAlfa(n) && NO_CLAVE.indexOf(n) < 0) cuenta[n] = (cuenta[n] || 0) + 1;
      });
    });
    var repetidas = Object.keys(cuenta).filter(function (k) { return cuenta[k] >= REPETICIONES_CLAVE_MIN; })
      .sort(function (a, b) { return (cuenta[b] - cuenta[a]) || cmp(a, b); });
    var sinRepeticion = false, claves;
    if (repetidas.length) claves = repetidas.slice(0, MAX_CLAVES);
    else {
      sinRepeticion = true;
      claves = Object.keys(cuenta).sort(function (a, b) { return (longitudPuntos(b) - longitudPuntos(a)) || cmp(a, b); }).slice(0, 8);
    }
    var clavesSet = {};
    claves.forEach(function (c) { clavesSet[c] = true; });
    var pasadas = [];
    function segundos(n) { return Math.max(15, Math.min(30, Math.ceil(n / 4))); }
    if (titulos.length) {
      pasadas.push({ clave: 'titulos', titulo: 'Títulos', segundos: segundos(titulos.reduce(function (a, t) { return a + t.palabras.length; }, 0)),
        items: titulos.map(function (t) { return { texto: t.texto, nivel: t.nivel }; }) });
    }
    var frases = cuerpo.map(function (p) { return primeraFrase(p.palabras); });
    pasadas.push({ clave: 'primeras', titulo: 'Primeras frases', segundos: segundos(frases.reduce(function (a, f) { return a + B.pySplit(f).length; }, 0)),
      items: frases.map(function (f) { return { texto: f }; }) });
    var items3 = cuerpo.map(function (par) {
      var partes = [], buffer = [];
      par.palabras.forEach(function (p) {
        if (clavesSet[nucleo(p)]) {
          if (buffer.length) { partes.push([buffer.join(' ') + ' ', false]); buffer = []; }
          partes.push([p, true]); partes.push([' ', false]);
        } else buffer.push(p);
      });
      if (buffer.length) partes.push([buffer.join(' '), false]);
      return { partes: partes };
    });
    pasadas.push({ clave: 'claves', titulo: 'Palabras clave',
      segundos: segundos(Math.floor(cuerpo.reduce(function (a, p) { return a + p.palabras.length; }, 0) / 3)), items: items3 });
    pasadas.push({ clave: 'pacer', titulo: 'Lectura con el pacer', segundos: 0, items: [] });
    var total = pasadas.length;
    pasadas.forEach(function (p, i) { p.pasada = i + 1; p.aviso = 'Pasada ' + (i + 1) + ' de ' + total + ': ' + p.titulo.toLowerCase(); });
    return { motor: 'skimming', pasadas: pasadas, total_pasadas: total, claves: claves, claves_sin_repeticion: sinRepeticion,
      primeras_frases: frases, total_palabras: estructura.reduce(function (a, p) { return a + p.palabras.length; }, 0),
      segundos_pasada: Object.assign({}, SEGUNDOS_PASADA) };
  }

  return { WPM_MIN: WPM_MIN, WPM_MAX: WPM_MAX, WPM_PASO: WPM_PASO, WPM_POR_DEFECTO: WPM_POR_DEFECTO, CUENTA_SEG: CUENTA_SEG,
    PAUSA_MS: PAUSA_MS, PAUSA_BASE_MS: PAUSA_BASE_MS, ESCALA_INICIO: ESCALA_INICIO, ESCALA_FIN: ESCALA_FIN,
    MAX_PALABRAS: MAX_PALABRAS, TRAMOS_PACER: TRAMOS_PACER,
    partir_palabras: partirPalabras, limpiar_parrafo: limpiarParrafo, acotar_wpm: acotarWpm, acotar_escala: acotarEscala,
    tipo_de_pausa: tipoDePausa, pausa_ms: pausaMs, punto_de_fijacion: puntoDeFijacion,
    plan_galactico: planGalactico, plan_palabra: planPalabra, plan_grupo: planGrupo, plan_frases: planFrases,
    plan_prueba: planPrueba, calcular_velocidad: calcularVelocidad, plan_pacer: planPacer, plan_skimming: planSkimming };
});
