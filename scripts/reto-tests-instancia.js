/* =========================================================================
   R.E.T.O. - Preguntas del banco listas para usar (lo que comparten "Escribir"
   y "Tarjetas")

   QUÉ ES
   El banco guarda las preguntas como se escribieron: las fijas con sus
   opciones, las dinámicas con su fórmula y sus variables. Para usarlas en
   pantalla hace falta convertir cada una en una "pregunta armada": con los
   números ya puestos (si es dinámica) y con cada opción marcada como correcta o
   no. Eso es lo único que hace este archivo, más armar el mazo de una ronda.

   POR QUÉ ESTÁ APARTE
   Son funciones puras (reciben datos y devuelven datos, sin tocar la página),
   así que se cargan igual en el navegador y en Node, y test_escribir.js las
   prueba sin abrir nada. "Asociar" tiene su propia copia de instanciar() en
   reto-asociar-logica.js porque se escribió antes; hacen lo mismo.

   DE DÓNDE SALEN LAS RESPUESTAS
   - Fijas:     [OK] es la correcta; [R] son los distractores.
   - Dinámicas: la correcta es el resultado de la fórmula; los distractores son
                los errores típicos calculados, cada uno con su clase de error
                ('calculo' o 'concepto'). La pregunta trae además `explicacion`
                (la fórmula, la fórmula con los números y el resultado), que
                arma el evaluador.
   [TEXTO] se ignora, como en Asociar: la pregunta entra con su enunciado.
   ========================================================================= */
(function (raiz) {
  'use strict';

  function norma(t) {
    return String(t === undefined || t === null ? '' : t).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function barajar(lista, rng) {
    rng = rng || Math.random;
    var s = lista.slice();
    for (var i = s.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = s[i]; s[i] = s[j]; s[j] = t;
    }
    return s;
  }

  function respuestaOk(q) {
    for (var i = 0; i < q.opciones.length; i++) {
      if (q.opciones[i].correcta) return q.opciones[i];
    }
    return null;
  }

  /* Una pregunta del banco → una armada. `evaluador` es RetoTestsEval (solo
     hace falta con dinámicas). */
  function instanciar(p, evaluador, rng) {
    rng = rng || Math.random;
    if (p.tipo === 'estatica') {
      return {
        id: p.id, tipo: 'estatica', tema: p.tema || {}, enunciado: p.enunciado,
        contexto: p.contexto || '', explicacion: null, decimales: null,
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
      decimales: p.decimales !== undefined ? Number(p.decimales) : 2,
      opciones: (ej.opciones || []).map(function (o) {
        return {
          texto: o.texto, correcta: !!o.correcta,
          clase: o.clase || null
        };
      })
    };
  }

  /* El mazo de una ronda: hasta `n` preguntas armadas, en el orden recibido (el
     servidor las ordena por prioridad de repaso). `sirve(q)` decide cuáles
     entran (por ejemplo, "Escribir" solo toma las de respuesta corta). */
  function armarMazo(candidatas, n, ctx) {
    ctx = ctx || {};
    var mazo = [];
    for (var i = 0; i < candidatas.length && mazo.length < n; i++) {
      var q = instanciar(candidatas[i], ctx.evaluador, ctx.rng);
      if (!respuestaOk(q)) continue;
      if (ctx.sirve && !ctx.sirve(q)) continue;
      mazo.push(q);
    }
    return mazo;
  }

  /* LA AUTOEVALUACIÓN DE LAS TARJETAS. En una tarjeta la persona dice qué tan
     bien la sabía. Las tres respuestas se traducen a lo mismo que entiende el
     registro de repaso (las mismas clases que "Resolver"):

       'sabia'  la sabía    → acierto, con seguridad    → 'dominada' (sube de caja)
       'costo'  me costó    → acierto, con dudas        → 'fragil'   (no sube)
       'no'     no la sabía → fallo                     → 'repasar'  (vuelve pronto)

     "Me costó" existe a propósito: acertar con dudas no demuestra que se sabe
     (es la regla de rondas.py), y poder decirlo es más honesto que obligar a
     elegir entre sabida y no sabida. */
  var AUTOEVALUACION = {
    sabia: { acierto: true, seguridad: 'seguro', clase: 'dominada' },
    costo: { acierto: true, seguridad: 'dudando', clase: 'fragil' },
    no: { acierto: false, seguridad: null, clase: 'repasar' }
  };

  function autoevaluacion(clave) {
    return AUTOEVALUACION[clave] || null;
  }

  var API = {
    norma: norma,
    barajar: barajar,
    respuestaOk: respuestaOk,
    instanciar: instanciar,
    armarMazo: armarMazo,
    autoevaluacion: autoevaluacion
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.RetoTestsInstancia = API;
})(typeof window !== 'undefined' ? window : this);
