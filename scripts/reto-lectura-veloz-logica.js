/* =========================================================================
   R.E.T.O. - Lógica de Lectura Veloz (JavaScript)
   -------------------------------------------------------------------------
   Puerto directo de logica/lectura_veloz.py a JS.
   Mismas reglas, mismo API, mismos 5 motores: galactico, palabra, grupo, frases, pacer, prueba, skimming.
   ========================================================================= */
(function (window) {
  'use strict';

  /* ===========================================================================
     CONSTANTES (idénticas a Python)
     =========================================================================== */
  var WPM_MIN = 50;
  var WPM_MAX = 999;
  var WPM_PASO = 10;
  var WPM_POR_DEFECTO = 300;

  var CUENTA_SEG = 3;

  var PAUSA_MS = { oracion: 600, coma: 350, guion: 300, nada: 200 };
  var PAUSA_BASE_MS = PAUSA_MS.nada;

  var ESCALA_INICIO = { min: 60, max: 160, paso: 5, defecto: 100 };
  var ESCALA_FIN = { min: 10, max: 80, paso: 5, defecto: 30 };

  var MAX_PALABRAS = 300000;
  var MAX_PARRAFOS = 20000;

  // Para grupo (chunk)
  // Para frases
  var MAX_PALABRAS_FRASE = 25;
  var MIN_PALABRAS_FRASE = 4;

  // Para prueba
  var MIN_PALABRAS_PRUEBA = 100;
  var MAX_PALABRAS_PRUEBA = 600;
  var PPM_BRUTAS_MAX = 1500;
  var PREGUNTAS_PRUEBA = { min: 3, max: 5, defecto: 4 };

  // Para pacer
  var MAX_PALABRAS_PACER = 12000;
  var TRAMOS_PACER = [1, 2, 3];
  var TRAMO_PACER_POR_DEFECTO = 3;
  var PPM_SUGERIDA_PACER = 250;
  var PAUSA_PARRAFO_MS = 750;

  // Para skimming
  var MAX_PALABRAS_SKIM = 8000;
  var LETRAS_CLAVE_MIN = 7;
  var REPETICIONES_CLAVE_MIN = 2;
  var MAX_CLAVES = 40;
  var MAX_PALABRAS_PRIMERA_FRASE = 28;
  var SEGUNDOS_PASADA = { min: 5, max: 120, defecto: 20 };

  var _NO_CLAVE = new Set([
    'tambien', 'despues', 'entonces', 'mientras', 'ademas', 'durante', 'aunque',
    'nosotros', 'ustedes', 'algunos', 'muchos', 'siempre', 'porque', 'cuando',
    'través', 'hacia', 'sobre', 'dentro', 'ninguno', 'alguna', 'algunas',
    'bastante', 'cualquier', 'estaba', 'estaban', 'pueden', 'podemos', 'tienen',
    'tiene', 'hemos', 'habia', 'habian'
  ]);

  var _CIERRES = '"\u201d\u2019\u00bb\u203a)]}*_';
  var _FINALES_DE_ORACION = '.!?\u2026';
  var _FINALES_DE_COMA = ',;:';
  var _GUIONES = '-\u2013\u2014';
  var _VINETAS = '-\u2013\u2014\u2022\u00b7*\u25aa\u25e6';
  var _LISTA_NUMERADA = /^\d{1,3}[.)]$/;

  var ABREVIATURAS = new Set([
    'sr', 'sra', 'srta', 'dr', 'dra', 'lic', 'ing', 'prof', 'av',
    'num', 'pag', 'pags', 'vs', 'art', 'ej', 'tel'
  ]);

  /* ===========================================================================
     UTILIDADES
     =========================================================================== */
  function normalizarNFC(texto) {
    return texto.normalize ? texto.normalize('NFC') : texto;
  }

  function partirPalabras(texto) {
    if (typeof texto !== 'string') return [];
    return texto.trim().split(/\s+/).filter(Boolean);
  }

  function limpiarParrafo(texto) {
    if (typeof texto !== 'string') return '';
    return texto.trim().split(/\s+/).join(' ');
  }

  function acotarWpm(valor) {
    try {
      var n = Math.round(Number(valor));
    } catch (e) {
      return WPM_POR_DEFECTO;
    }
    n = Math.round(n / WPM_PASO) * WPM_PASO;
    return Math.max(WPM_MIN, Math.min(WPM_MAX, n));
  }

  function acotarEscala(rango, valor) {
    try {
      var n = Number(valor);
    } catch (e) {
      return rango.defecto;
    }
    if (!isFinite(n)) return rango.defecto;
    var paso = rango.paso;
    n = Math.round(n / paso) * paso;
    return Math.max(rango.min, Math.min(rango.max, n));
  }

  function _leerParrafos(parrafos) {
    if (parrafos === null || parrafos === undefined ||
        typeof parrafos === 'string' || ArrayBuffer.isView(parrafos)) {
      throw new Error('Falta la lista de parrafos.');
    }
    var salida = [];
    var total = 0;
    for (var i = 0; i < parrafos.length; i++) {
      var crudo = parrafos[i];
      var texto = limpiarParrafo(crudo);
      if (!texto) continue;
      var palabras = partirPalabras(texto);
      total += palabras.length;
      if (total > MAX_PALABRAS) {
        throw new Error('Este texto es demasiado largo para este modo. Prueba con un capitulo o una parte.');
      }
      salida.push({ texto: texto, palabras: palabras });
      if (salida.length > MAX_PARRAFOS) {
        throw new Error('Este texto tiene demasiados parrafos para este modo. Prueba con un capitulo o una parte.');
      }
    }
    if (!salida.length) throw new Error('Este texto no tiene palabras que leer.');
    return salida;
  }

  function _esAbreviatura(fin) {
    var nucleo = fin.slice(0, -1);
    var i = 0;
    while (i < nucleo.length && !nucleo[i].match(/[a-z0-9]/i)) i++;
    nucleo = nucleo.slice(i);
    if (nucleo.length === 1 && /[a-z]/i.test(nucleo)) return true;
    return ABREVIATURAS.has(nucleo.toLowerCase());
  }

  function tipoDePausa(palabra) {
    if (typeof palabra !== 'string' || !palabra) return 'nada';
    if (_VINETAS.split('').every(function(c) { return palabra.indexOf(c) >= 0; }) || _LISTA_NUMERADA.test(palabra)) {
      return 'guion';
    }
    var fin = palabra.replace(new RegExp('[' + _CIERRES.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ']+$'), '');
    if (!fin) return 'nada';
    var ultimo = fin.slice(-1);
    if (_FINALES_DE_ORACION.indexOf(ultimo) >= 0) {
      if (ultimo === '.' && _esAbreviatura(fin)) return 'nada';
      return 'oracion';
    }
    if (_FINALES_DE_COMA.indexOf(ultimo) >= 0) return 'coma';
    if (_GUIONES.indexOf(ultimo) >= 0) return 'guion';
    return 'nada';
  }

  function pausaMs(palabra) {
    return PAUSA_MS[tipoDePausa(palabra)];
  }

  function puntoDeFijacion(palabra) {
    if (typeof palabra !== 'string' || !palabra) return 0;
    var inicio = null, fin = 0;
    for (var i = 0; i < palabra.length; i++) {
      if (/[a-z0-9]/i.test(palabra[i])) {
        if (inicio === null) inicio = i;
        fin = i + 1;
      }
    }
    if (inicio === null) return 0;
    var largo = fin - inicio;
    var desplazamiento;
    if (largo <= 1) desplazamiento = 0;
    else if (largo <= 5) desplazamiento = 1;
    else if (largo <= 9) desplazamiento = 2;
    else if (largo <= 13) desplazamiento = 3;
    else desplazamiento = 4;
    var objetivo = inicio + desplazamiento;
    for (var lejos = 0; lejos < palabra.length; lejos++) {
      for (var s = 0; s < 2; s++) {
        var idx = s === 0 ? objetivo - lejos : objetivo + lejos;
        if (idx >= 0 && idx < palabra.length && /[a-z0-9]/i.test(palabra[idx])) return idx;
      }
    }
    return objetivo;
  }

  function _esFinFuerte(palabra) {
    if (typeof palabra !== 'string' || !palabra) return false;
    var fin = palabra.replace(new RegExp('[' + _CIERRES.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ']+$'), '');
    if (!fin) return false;
    return _FINALES_DE_ORACION.indexOf(fin.slice(-1)) >= 0;
  }

  function _agruparPalabras(palabras, n) {
    if (!palabras.length) return [];
    var grupos = [];
    var actual = [];
    for (var i = 0; i < palabras.length; i++) {
      actual.push(palabras[i]);
      if (actual.length === n) {
        grupos.push(actual);
        actual = [];
      } else if (_esFinFuerte(palabras[i]) && actual.length) {
        grupos.push(actual);
        actual = [];
      }
    }
    if (actual.length) {
      if (grupos.length) grupos[grupos.length - 1] = grupos[grupos.length - 1].concat(actual);
      else grupos.push(actual);
    }
    if (grupos.length >= 2 && grupos[grupos.length - 1].length < n && grupos[grupos.length - 2].length >= n) {
      grupos[grupos.length - 2] = grupos[grupos.length - 2].concat(grupos.pop());
    }
    return grupos;
  }

  function _orpIndiceGrupo(grupo) {
    var n = grupo.length;
    if (n <= 2) return 0;
    if (n === 4) return 1;
    return Math.floor(n / 2);
  }

  function _partirOracionLarga(palabras) {
    if (palabras.length <= MAX_PALABRAS_FRASE) return [palabras.slice()];
    var piezas = [];
    var resto = palabras.slice();
    while (resto.length > MAX_PALABRAS_FRASE) {
      var cuantas = Math.ceil(resto.length / MAX_PALABRAS_FRASE);
      var ideal = Math.round(resto.length / cuantas);
      var tope = Math.min(MAX_PALABRAS_FRASE, resto.length - MIN_PALABRAS_FRASE);
      var mejor = null;
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

  function _frasesDeParrafo(palabras) {
    var frases = [];
    var actual = [];
    for (var i = 0; i < palabras.length; i++) {
      actual.push(palabras[i]);
      if (tipoDePausa(palabras[i]) === 'oracion') {
        _partirOracionLarga(actual).forEach(function (p) { frases.push(p); });
        actual = [];
      }
    }
    if (actual.length) _partirOracionLarga(actual).forEach(function (p) { frases.push(p); });
    return frases;
  }

  function _nucleo(palabra) {
    return normalizarNFC(palabra.replace(/[^a-z0-9]/gi, '').toLowerCase());
  }

  function _primeraFrase(palabras) {
    var salida = [];
    for (var i = 0; i < palabras.length; i++) {
      salida.push(palabras[i]);
      if (tipoDePausa(palabras[i]) === 'oracion') break;
      if (salida.length >= MAX_PALABRAS_PRIMERA_FRASE) {
        salida[salida.length - 1] = salida[salida.length - 1].replace(/[,;:]+$/, '') + '\u2026';
        break;
      }
    }
    return salida.join(' ');
  }

  function _leerEstructura(parrafos) {
    if (parrafos === null || parrafos === undefined || typeof parrafos === 'string') {
      throw new Error('Falta la lista de parrafos.');
    }
    var salida = [];
    var total = 0;
    for (var i = 0; i < parrafos.length; i++) {
      var crudo = parrafos[i];
      var titulo = false, nivel = 0;
      var texto = crudo;
      if (crudo && typeof crudo === 'object') {
        titulo = Boolean(crudo.titulo);
        try {
          nivel = titulo ? Math.max(1, Math.min(4, parseInt(crudo.nivel || 1, 10))) : 0;
        } catch (e) { nivel = titulo ? 1 : 0; }
        texto = crudo.texto;
      }
      texto = limpiarParrafo(texto);
      if (!texto) continue;
      var palabras = partirPalabras(texto);
      total += palabras.length;
      if (total > MAX_PALABRAS_SKIM) break;
      salida.push({ texto: texto, palabras: palabras, titulo: titulo, nivel: nivel });
    }
    if (!salida.length) throw new Error('No hay nada que leer en este texto.');
    return salida;
  }

  /* ===========================================================================
     PLANES PRINCIPALES
     =========================================================================== */

  // GALACTICO
  function planGalactico(parrafos) {
    var leidos = _leerParrafos(parrafos);
    var salida = leidos.map(function (p) {
      return { texto: p.texto, palabras: p.palabras.length };
    });
    var total = salida.reduce(function (a, p) { return a + p.palabras; }, 0);
    return {
      motor: 'galactico',
      parrafos: salida,
      total_palabras: total,
      cuenta_seg: CUENTA_SEG,
      wpm: { min: WPM_MIN, max: WPM_MAX, paso: WPM_PASO },
      escala: { inicio: Object.assign({}, ESCALA_INICIO), fin: Object.assign({}, ESCALA_FIN) }
    };
  }

  // PALABRA POR PALABRA (RSVP)
  function planPalabra(parrafos) {
    var palabras = [], foco = [], pausa = [];
    var leidos = _leerParrafos(parrafos);
    for (var p = 0; p < leidos.length; p++) {
      var lista = leidos[p].palabras;
      var ultima = lista.length - 1;
      for (var i = 0; i < lista.length; i++) {
        var pal = normalizarNFC(lista[i]);
        var ms = pausaMs(pal);
        if (i === ultima) ms = Math.max(ms, PAUSA_MS.oracion);
        palabras.push(pal);
        foco.push(puntoDeFijacion(pal));
        pausa.push(ms);
      }
    }
    return {
      motor: 'palabra',
      palabras: palabras,
      foco: foco,
      pausa: pausa,
      pausa_base_ms: PAUSA_BASE_MS,
      total_palabras: palabras.length,
      cuenta_seg: CUENTA_SEG,
      wpm: { min: WPM_MIN, max: WPM_MAX, paso: WPM_PASO }
    };
  }

  // GRUPO (CHUNK) - 3 o 4 palabras
  function planGrupo(parrafos, tamanoGrupo) {
    if (tamanoGrupo !== 3 && tamanoGrupo !== 4) tamanoGrupo = 3;
    var leidos = _leerParrafos(parrafos);
    var todas = [];
    for (var p = 0; p < leidos.length; p++) {
      todas = todas.concat(leidos[p].palabras);
    }
    var gruposPalabras = _agruparPalabras(todas, tamanoGrupo);
    var grupos = [];
    var totalPalabras = 0;
    for (var g = 0; g < gruposPalabras.length; g++) {
      var grupo = gruposPalabras[g];
      totalPalabras += grupo.length;
      var ultima = normalizarNFC(grupo[grupo.length - 1]);
      var ms = pausaMs(ultima);
      grupos.push({
        palabras: grupo.map(normalizarNFC),
        orp_idx: _orpIndiceGrupo(grupo),
        pausa: ms
      });
    }
    if (grupos.length) grupos[grupos.length - 1].pausa = Math.max(grupos[grupos.length - 1].pausa, PAUSA_MS.oracion);
    return {
      motor: 'grupo',
      grupos: grupos,
      total_palabras: totalPalabras,
      total_grupos: grupos.length,
      cuenta_seg: CUENTA_SEG,
      wpm: { min: WPM_MIN, max: WPM_MAX, paso: WPM_PASO },
      pausa_base_ms: PAUSA_BASE_MS,
      tamano_grupo: tamanoGrupo
    };
  }

  // FRASES COMPLETAS
  function planFrases(parrafos) {
    var frases = [];
    var totalPalabras = 0;
    var leidos = _leerParrafos(parrafos);
    for (var p = 0; p < leidos.length; p++) {
      var lista = leidos[p].palabras.map(normalizarNFC);
      var pesos = lista.map(pausaMs);
      pesos[pesos.length - 1] = Math.max(pesos[pesos.length - 1], PAUSA_MS.oracion);
      var inicio = 0;
      var frasesParrafo = _frasesDeParrafo(lista);
      for (var f = 0; f < frasesParrafo.length; f++) {
        var frase = frasesParrafo[f];
        var fin = inicio + frase.length;
        frases.push({
          texto: frase.join(' '),
          palabras: frase.length,
          pausa: pesos.slice(inicio, fin).reduce(function (a, b) { return a + b; }, 0)
        });
        totalPalabras += frase.length;
        inicio = fin;
      }
    }
    return {
      motor: 'frases',
      frases: frases,
      total_palabras: totalPalabras,
      total_frases: frases.length,
      pausa_base_ms: PAUSA_BASE_MS,
      cuenta_seg: CUENTA_SEG,
      wpm: { min: WPM_MIN, max: WPM_MAX, paso: WPM_PASO }
    };
  }

  // PRUEBA DE VELOCIDAD
  function planPrueba(parrafos) {
    var textos = [], total = 0, recortado = false;
    var leidos = _leerParrafos(parrafos);
    for (var p = 0; p < leidos.length; p++) {
      var palabras = leidos[p].palabras;
      if (total + palabras.length > MAX_PALABRAS_PRUEBA) {
        recortado = true;
        if (!textos.length) {
          palabras = palabras.slice(0, MAX_PALABRAS_PRUEBA);
          textos.push(palabras.join(' '));
          total = palabras.length;
        }
        break;
      }
      textos.push(leidos[p].texto);
      total += palabras.length;
    }
    if (total < MIN_PALABRAS_PRUEBA) {
      throw new Error('Este texto es muy corto para medir la velocidad (necesita al menos ' + MIN_PALABRAS_PRUEBA + ' palabras). Elige uno mas largo.');
    }
    return {
      motor: 'prueba',
      parrafos: textos,
      total_palabras: total,
      recortado: recortado,
      preguntas: Object.assign({}, PREGUNTAS_PRUEBA),
      ppm_brutas_max: PPM_BRUTAS_MAX
    };
  }

  function calcularVelocidad(palabras, segundos, aciertos, preguntas) {
    var nPalabras = parseInt(palabras, 10);
    var nSegundos = parseFloat(segundos);
    var nAciertos = parseInt(aciertos, 10);
    var nPreguntas = parseInt(preguntas, 10);
    if (isNaN(nPalabras) || isNaN(nSegundos) || isNaN(nAciertos) || isNaN(nPreguntas) ||
        nPalabras <= 0 || nSegundos < 0 || nPreguntas < 0 || nAciertos < 0) {
      throw new Error('Faltan datos para calcular la velocidad.');
    }
    nAciertos = Math.min(nAciertos, nPreguntas);
    var minutos = Math.max(nSegundos, 1.0) / 60;
    var brutas = nPalabras / minutos;
    var comprension = null, efectivas = null;
    if (nPreguntas > 0) {
      comprension = Math.round(nAciertos / nPreguntas * 100) / 100;
      efectivas = Math.round(brutas * (nAciertos / nPreguntas));
    }
    var saltada = brutas > PPM_BRUTAS_MAX;
    return {
      ppm_brutas: Math.round(brutas),
      comprension: comprension,
      ppm_efectivas: efectivas,
      saltada: saltada,
      entra_al_historial: (!saltada) && nPreguntas > 0
    };
  }

  // PACER (y lectura en columnas = mismo motor)
  function planPacer(parrafos, palabrasPorTramo) {
    var n = (TRAMOS_PACER.indexOf(palabrasPorTramo) >= 0) ? palabrasPorTramo : TRAMO_PACER_POR_DEFECTO;
    var palabras = [], pausa = [], inicios = [], tramos = [];
    var recortado = false;
    var leidos = _leerParrafos(parrafos);
    for (var p = 0; p < leidos.length; p++) {
      var lista = leidos[p].palabras.map(normalizarNFC);
      if (palabras.length + lista.length > MAX_PALABRAS_PACER) {
        recortado = true;
        if (palabras.length) break;
        lista = lista.slice(0, MAX_PALABRAS_PACER);
      }
      var pesos = lista.map(pausaMs);
      pesos[pesos.length - 1] = Math.max(pesos[pesos.length - 1], PAUSA_PARRAFO_MS);
      var base = palabras.length;
      inicios.push(base);
      palabras = palabras.concat(lista);
      pausa = pausa.concat(pesos);
      var desde = base;
      var grupos = _agruparPalabras(lista, n);
      for (var g = 0; g < grupos.length; g++) {
        var grupo = grupos[g];
        var hasta = desde + grupo.length - 1;
        var suma = pausa.slice(desde, hasta + 1).reduce(function (a, b) { return a + b; }, 0);
        tramos.push({
          desde: desde,
          hasta: hasta,
          pausa: suma,
          peso: Math.round((suma / (grupo.length * PAUSA_BASE_MS)) * 100) / 100
        });
        desde = hasta + 1;
      }
    }
    return {
      motor: 'pacer',
      palabras: palabras,
      pausa: pausa,
      parrafo_inicio: inicios,
      tramos: tramos,
      palabras_por_tramo: n,
      total_palabras: palabras.length,
      recortado: recortado,
      ppm_sugerida: PPM_SUGERIDA_PACER,
      pausa_base_ms: PAUSA_BASE_MS,
      cuenta_seg: CUENTA_SEG,
      wpm: { min: WPM_MIN, max: WPM_MAX, paso: WPM_PASO }
    };
  }

  // SKIMMING
  function planSkimming(parrafos) {
    var estructura = _leerEstructura(parrafos);
    var cuerpo = estructura.filter(function (p) { return !p.titulo; });
    if (!cuerpo.length) { cuerpo = estructura; var titulos = []; }
    else var titulos = estructura.filter(function (p) { return p.titulo; });

    var cuenta = {};
    for (var p = 0; p < cuerpo.length; p++) {
      for (var w = 0; w < cuerpo[p].palabras.length; w++) {
        var n = _nucleo(cuerpo[p].palabras[w]);
        if (n.length >= LETRAS_CLAVE_MIN && /^[a-z]+$/i.test(n) && !_NO_CLAVE.has(n)) {
          cuenta[n] = (cuenta[n] || 0) + 1;
        }
      }
    }
    var repetidas = Object.keys(cuenta).filter(function (k) { return cuenta[k] >= REPETICIONES_CLAVE_MIN; })
      .sort(function (a, b) { return (cuenta[b] - cuenta[a]) || (a.localeCompare(b)); });
    var sinRepeticion = false;
    var claves = repetidas.length ? repetidas.slice(0, MAX_CLAVES) : (sinRepeticion = true, Object.keys(cuenta).sort(function (a, b) { return (b.length - a.length) || a.localeCompare(b); }).slice(0, 8));
    var clavesSet = new Set(claves);

    var pasadas = [];
    function _segundos(palabras) {
      var estimado = Math.ceil(palabras / 4);
      return Math.max(15, Math.min(30, estimado));
    }

    if (titulos.length) {
      pasadas.push({
        clave: 'titulos', titulo: 'T\u00edtulos',
        segundos: _segundos(titulos.reduce(function (a, t) { return a + t.palabras.length; }, 0)),
        items: titulos.map(function (t) { return { texto: t.texto, nivel: t.nivel }; })
      });
    }
    var primeras = cuerpo.map(function (p) { return _primeraFrase(p.palabras); });
    pasadas.push({
      clave: 'primeras', titulo: 'Primeras frases',
      segundos: _segundos(primeras.reduce(function (a, f) { return a + f.split(' ').length; }, 0)),
      items: primeras.map(function (f) { return { texto: f }; })
    });

    var items3 = [];
    for (var p = 0; p < cuerpo.length; p++) {
      var partes = [], buffer = [];
      for (var w = 0; w < cuerpo[p].palabras.length; w++) {
        var pal = cuerpo[p].palabras[w];
        if (clavesSet.has(_nucleo(pal))) {
          if (buffer.length) { partes.push([buffer.join(' ') + ' ', false]); buffer = []; }
          partes.push([pal, true]);
          partes.push([' ', false]);
        } else buffer.push(pal);
      }
      if (buffer.length) partes.push([buffer.join(' '), false]);
      items3.push({ partes: partes });
    }
    pasadas.push({
      clave: 'claves', titulo: 'Palabras clave',
      segundos: _segundos(cuerpo.reduce(function (a, p) { return a + p.palabras.length; }, 0) / 3),
      items: items3
    });
    pasadas.push({ clave: 'pacer', titulo: 'Lectura con el pacer', segundos: 0, items: [] });

    for (var i = 0; i < pasadas.length; i++) {
      pasadas[i].pasada = i + 1;
      pasadas[i].aviso = 'Pasada ' + (i + 1) + ' de ' + pasadas.length + ': ' + pasadas[i].titulo.toLowerCase();
    }

    return {
      motor: 'skimming',
      pasadas: pasadas,
      total_pasadas: pasadas.length,
      claves: claves,
      claves_sin_repeticion: sinRepeticion,
      primeras_frases: primeras,
      total_palabras: estructura.reduce(function (a, p) { return a + p.palabras.length; }, 0),
      segundos_pasada: Object.assign({}, SEGUNDOS_PASADA)
    };
  }

  /* ===========================================================================
     EXPORT
     =========================================================================== */
  window.RetoLecturaVeloz = {
    // Constantes
    WPM_MIN: WPM_MIN, WPM_MAX: WPM_MAX, WPM_PASO: WPM_PASO, WPM_POR_DEFECTO: WPM_POR_DEFECTO,
    CUENTA_SEG: CUENTA_SEG,
    PAUSA_MS: PAUSA_MS, PAUSA_BASE_MS: PAUSA_BASE_MS,
    ESCALA_INICIO: ESCALA_INICIO, ESCALA_FIN: ESCALA_FIN,
    MAX_PALABRAS: MAX_PALABRAS, MAX_PARRAFOS: MAX_PARRAFOS,

    // Planes
    planGalactico: planGalactico,
    planPalabra: planPalabra,
    planGrupo: planGrupo,
    planFrases: planFrases,
    planPrueba: planPrueba,
    calcularVelocidad: calcularVelocidad,
    planPacer: planPacer,
    planSkimming: planSkimming,

    // Utilidades
    partirPalabras: partirPalabras,
    limpiarParrafo: limpiarParrafo,
    acotarWpm: acotarWpm,
    acotarEscala: acotarEscala,
    tipoDePausa: tipoDePausa,
    pausaMs: pausaMs,
    puntoDeFijacion: puntoDeFijacion,
    normalizarNFC: normalizarNFC
  };

})(window);