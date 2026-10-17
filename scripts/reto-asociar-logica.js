/* =========================================================================
   R.E.T.O. - Asociar (la parte que no depende de la pantalla)

   QUÉ ES
   "Asociar" toma las preguntas que YA están en el banco de tests y las muestra
   de otra manera: en vez de contestar una por una, se UNEN con líneas, cada
   una con su pareja. No hay un formato nuevo ni un tipo de pregunta nuevo:
   todo sale de lo que el banco ya tiene.

     [P]   el enunciado     → una ficha de "pregunta"
     [OK]  la correcta      → su pareja
     [R]   los distractores → fichas de más, sin pareja (si se pide)
     [N2]..[N4] el tema     → la pareja, en la variante "por tema"

   Las preguntas con números que cambian (dinámicas) también entran: cada vez
   se arma una instancia nueva con el evaluador de siempre (RetoTestsEval), y el
   enunciado ya lleva los números puestos y la respuesta es el resultado de la
   fórmula. Sus distractores calculados ("error de una décima") hacen de [R].

   POR QUÉ ESTÁ APARTE
   Armar una ronda y calificarla son decisiones sin pantalla: qué preguntas
   entran, que ninguna pareja sea ambigua, qué cuenta como acierto. Aquí se
   escriben como funciones puras (reciben datos, devuelven datos y no tocan la
   página), así se cargan igual en el navegador y en Node, y
   test_asociar.js las prueba sin abrir nada.

   LO QUE SE CUIDA, Y POR QUÉ
   - NINGUNA PAREJA AMBIGUA. Si dos preguntas de la ronda tuvieran la misma
     respuesta (dos "Verdadero", o dos divisiones con el mismo resultado), unir
     cualquiera de las dos con esa respuesta sería correcto y a la vez no se
     podría calificar. Por eso la segunda se descarta, o, si es dinámica, se
     vuelve a armar con otros números hasta que sea distinta.
   - LOS DISTRACTORES NUNCA SE PARECEN A UNA RESPUESTA REAL: se descarta el que
     tenga el mismo texto que alguna de las correctas de la ronda.
   - "POR TEMA" SOLO CUANDO HAY TEMAS. Hacen falta al menos dos temas distintos
     entre las preguntas de la ronda; si el test no los trae (no usa [N2] a
     [N4]), la ronda se arma como la clásica, sin avisar. No es un error: es un
     test que no tiene esa información.
   - [TEXTO] SE IGNORA (por ahora): la pregunta entra tal cual, con su
     enunciado.
   ========================================================================= */
(function (raiz) {
  'use strict';

  var MIN_PAREJAS = 2;
  var MAX_PAREJAS = 8;
  var MAX_TEMAS = 6;           // más temas que esto no caben en una columna
  var INTENTOS_DINAMICA = 25;  // cuántas veces se rearma una dinámica repetida

  function norma(texto) {
    return String(texto === undefined || texto === null ? '' : texto)
      .trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function limitar(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = min;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  /* Baraja una copia (Fisher-Yates) con el generador que se pase: así los
     tests pueden fijar el azar. */
  function barajar(lista, rng) {
    var s = lista.slice();
    for (var i = s.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = s[i]; s[i] = s[j]; s[j] = t;
    }
    return s;
  }

  /* LA RUTA DE UN TEMA: los niveles 2 a 4 que existan, separados por comas. El
     nivel 1 es el título del test y no se repite. Un nivel que falta no se
     concatena. Es la misma regla que RetoTestsLista.rutaDeTema. */
  function rutaTema(tema) {
    var salida = [];
    ['n2', 'n3', 'n4'].forEach(function (k) {
      var v = tema && typeof tema[k] === 'string' ? tema[k].trim() : '';
      if (v) salida.push(v);
    });
    return salida.join(', ');
  }

  /* ----------------------------------------------------------- instanciar */

  /* Convierte una pregunta del banco en una "armada": con los números puestos
     si es dinámica, y con las opciones marcadas (correcta o no). */
  function instanciar(p, evaluador, rng) {
    if (p.tipo === 'estatica') {
      return {
        id: p.id, tipo: 'estatica', tema: p.tema || {}, enunciado: p.enunciado,
        contexto: p.contexto || '', explicacion: null,
        opciones: (p.opciones || []).map(function (o) {
          return {
            texto: o.texto,
            correcta: o.correcta === true || (o.id !== undefined && o.id === p.correcta) || o.texto === p.correcta,
            clase: null
          };
        })
      };
    }
    var ej;
    if (evaluador) {
      ej = evaluador.generar({
        enunciado: p.enunciado,
        variables: p.variables || [],
        formula: p.formula,
        decimales: p.decimales !== undefined ? p.decimales : 2,
        distractores: p.distractores || [],
        opcionesAMostrar: p.opcionesAMostrar || 4
      });
    } else {
      ej = { enunciado: p.enunciado, opciones: [], explicacion: null };
    }
    return {
      id: p.id, tipo: 'dinamica', tema: p.tema || {}, enunciado: ej.enunciado,
      contexto: p.contexto || '', explicacion: ej.explicacion || null,
      opciones: (ej.opciones || []).map(function (o) {
        return {
          texto: o.texto, correcta: !!o.correcta,
          clase: o.clase || null
        };
      })
    };
  }

  function respuestaOk(q) {
    for (var i = 0; i < q.opciones.length; i++) {
      if (q.opciones[i].correcta) return q.opciones[i];
    }
    return null;
  }

  /* ---------------------------------------------------------- armar ronda */

  /* `candidatas`: preguntas del banco, YA en el orden en que conviene
     tomarlas (el servidor las ordena por prioridad de repaso).
     `cfg`: { parejas, variante: 'clasica'|'tema', sentido: 'pq'|'rp',
              distractores: bool, extras: n }
     `ctx`: { evaluador, rng }

     Devuelve null si no alcanzan dos preguntas utilizables; si no:
       { variante, sentido,
         preguntas:  [{ key, qid, idx, q, tema, correctaKey }],
         respuestas: [{ key, texto, tipo: 'ok'|'extra'|'tema', de, clase, paso }] }
     Las respuestas ya vienen revueltas. */
  function armarRonda(candidatas, cfg, ctx) {
    ctx = ctx || {};
    var rng = ctx.rng || Math.random;
    var n = limitar(cfg.parejas, MIN_PAREJAS, MAX_PAREJAS);
    var variante = cfg.variante === 'tema' ? 'tema' : 'clasica';

    var elegidas = [];
    var usados = {};
    var temas = {};
    var nTemas = 0;

    function tomar(p) {
      var veces = p.tipo === 'dinamica' ? INTENTOS_DINAMICA : 1;
      for (var k = 0; k < veces; k++) {
        var q = instanciar(p, ctx.evaluador, rng);
        var ok = respuestaOk(q);
        if (!ok) continue;
        if (!usados[norma(ok.texto)]) return q;
      }
      return null;
    }

    for (var i = 0; i < candidatas.length && elegidas.length < n; i++) {
      var p = candidatas[i];
      var ruta = rutaTema(p.tema);
      if (variante === 'tema') {
        if (!ruta) continue;
        if (!temas[ruta] && nTemas >= MAX_TEMAS) continue;
      }
      var q = tomar(p);
      if (!q) continue;
      usados[norma(respuestaOk(q).texto)] = true;
      if (variante === 'tema' && !temas[ruta]) { temas[ruta] = true; nTemas++; }
      elegidas.push({ p: p, q: q, ruta: ruta });
    }

    if (variante === 'tema' && nTemas < 2) {
      /* Con un solo tema no hay nada que clasificar: se cambia una pregunta
         por otra de un tema distinto si la hay, y si no, se arma la clásica. */
      var otra = null;
      for (var c = 0; c < candidatas.length && !otra; c++) {
        var rc = rutaTema(candidatas[c].tema);
        var yaEsta = elegidas.some(function (e) { return e.p.id === candidatas[c].id; });
        if (rc && !temas[rc] && !yaEsta) {
          var qc = tomar(candidatas[c]);
          if (qc) otra = { p: candidatas[c], q: qc, ruta: rc };
        }
      }
      if (otra && elegidas.length >= 2) {
        elegidas[elegidas.length - 1] = otra;
        temas = {}; nTemas = 0;
        elegidas.forEach(function (e) { if (!temas[e.ruta]) { temas[e.ruta] = true; nTemas++; } });
      }
      if (nTemas < 2) {
        var copia = {};
        Object.keys(cfg).forEach(function (k) { copia[k] = cfg[k]; });
        copia.variante = 'clasica';
        return armarRonda(candidatas, copia, ctx);
      }
    }

    if (elegidas.length < MIN_PAREJAS) return null;

    var preguntas = elegidas.map(function (e, idx) {
      return { key: 'p' + idx, qid: e.q.id, idx: idx, q: e.q, tema: e.ruta, correctaKey: null };
    });

    var respuestas = [];
    if (variante === 'tema') {
      var vistos = [];
      preguntas.forEach(function (pg) { if (vistos.indexOf(pg.tema) < 0) vistos.push(pg.tema); });
      vistos.forEach(function (t, j) {
        respuestas.push({ key: 't' + j, texto: t, tipo: 'tema', de: null, clase: null });
      });
      preguntas.forEach(function (pg) {
        pg.correctaKey = respuestas.filter(function (r) { return r.texto === pg.tema; })[0].key;
      });
    } else {
      preguntas.forEach(function (pg, i) {
        var ok = respuestaOk(pg.q);
        respuestas.push({ key: 'r' + i, texto: ok.texto, tipo: 'ok', de: pg.qid, clase: null });
        pg.correctaKey = 'r' + i;
      });
      if (cfg.distractores) {
        var pool = [];
        var vistosTxt = {};
        preguntas.forEach(function (pg) {
          pg.q.opciones.forEach(function (o) {
            var t = norma(o.texto);
            if (o.correcta || usados[t] || vistosTxt[t]) return;
            vistosTxt[t] = true;
            pool.push({ texto: o.texto, de: pg.qid, clase: o.clase });
          });
        });
        var cuantos = limitar(cfg.extras, 1, 4);
        barajar(pool, rng).slice(0, cuantos).forEach(function (d, k) {
          respuestas.push({ key: 'x' + k, texto: d.texto, tipo: 'extra', de: d.de, clase: d.clase });
        });
      }
    }

    /* Revueltas, y sin que queden en el mismo orden que las preguntas (con tres
       o más, una ronda "ya resuelta" no tiene gracia). */
    var orden = barajar(respuestas, rng);
    if (variante === 'clasica' && preguntas.length >= 3) {
      for (var v = 0; v < 6; v++) {
        var igual = orden.every(function (r, i) { return i >= preguntas.length || r.key === 'r' + i; });
        if (!igual) break;
        orden = barajar(respuestas, rng);
      }
    }

    return {
      variante: variante,
      sentido: variante === 'clasica' && cfg.sentido === 'rp' ? 'rp' : 'pq',
      preguntas: preguntas,
      respuestas: orden
    };
  }

  /* ------------------------------------------------------------- uniones */

  /* Las uniones son un objeto { claveDePregunta: claveDeRespuesta }. Cada
     pregunta tiene a lo más UNA línea. Si `unoAUno`, cada respuesta recibe a lo
     más una también (unir una respuesta que ya tenía línea la CAMBIA de
     pregunta). En "por tema" varias preguntas pueden ir al mismo tema.
     Devuelve un objeto nuevo: no modifica el que recibe. */
  function enlazar(enlaces, pKey, rKey, unoAUno) {
    var nuevo = {};
    Object.keys(enlaces).forEach(function (k) {
      if (unoAUno && enlaces[k] === rKey) return;
      nuevo[k] = enlaces[k];
    });
    nuevo[pKey] = rKey;
    return nuevo;
  }

  /* Quita la línea de una pregunta, o todas las de una respuesta. */
  function quitar(enlaces, key) {
    var nuevo = {};
    Object.keys(enlaces).forEach(function (k) {
      if (k === key || enlaces[k] === key) return;
      nuevo[k] = enlaces[k];
    });
    return nuevo;
  }

  function completa(ronda, enlaces) {
    return ronda.preguntas.every(function (p) { return !!enlaces[p.key]; });
  }

  /* ------------------------------------------------------------ calificar */

  function respuestaPorKey(ronda, key) {
    for (var i = 0; i < ronda.respuestas.length; i++) {
      if (ronda.respuestas[i].key === key) return ronda.respuestas[i];
    }
    return null;
  }

  /* QUÉ TIPO DE ERROR FUE, para el registro de repaso (las mismas clases de
     "Resolver"): si la respuesta unida es un distractor de ESTA pregunta, es la
     clase que traía ('calculo' o 'concepto'); si no, 'repasar'. Un acierto es
     'dominada'. */
  function clasificar(ronda, pKey, rKey) {
    var pg = null;
    for (var i = 0; i < ronda.preguntas.length; i++) {
      if (ronda.preguntas[i].key === pKey) pg = ronda.preguntas[i];
    }
    if (!pg || !rKey) return 'repasar';
    if (rKey === pg.correctaKey) return 'dominada';
    var r = respuestaPorKey(ronda, rKey);
    if (r) {
      for (var j = 0; j < pg.q.opciones.length; j++) {
        var o = pg.q.opciones[j];
        if (!o.correcta && norma(o.texto) === norma(r.texto) && o.clase) return o.clase;
      }
      if (r.tipo === 'extra' && r.clase) return r.clase;
    }
    return 'repasar';
  }

  /* Una fila por pregunta: { key, qid, acierto, respuestaKey, eleccion, clase }.
     Una pregunta sin línea cuenta como fallada, con elección vacía. */
  function calificar(ronda, enlaces) {
    return ronda.preguntas.map(function (pg) {
      var rKey = enlaces[pg.key] || null;
      var r = rKey ? respuestaPorKey(ronda, rKey) : null;
      var acierto = !!rKey && rKey === pg.correctaKey;
      return {
        key: pg.key, qid: pg.qid, acierto: acierto, respuestaKey: rKey,
        eleccion: r ? r.texto : '',
        clase: acierto ? 'dominada' : clasificar(ronda, pg.key, rKey)
      };
    });
  }

  var API = {
    MIN_PAREJAS: MIN_PAREJAS,
    MAX_PAREJAS: MAX_PAREJAS,
    rutaTema: rutaTema,
    instanciar: instanciar,
    armarRonda: armarRonda,
    enlazar: enlazar,
    quitar: quitar,
    completa: completa,
    clasificar: clasificar,
    calificar: calificar,
    respuestaPorKey: respuestaPorKey
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.RetoAsociarLogica = API;
})(typeof window !== 'undefined' ? window : this);
