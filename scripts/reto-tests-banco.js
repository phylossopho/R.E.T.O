/* =========================================================================
   R.E.T.O. - El banco de tests (lo que se guarda, y cómo)

   DÓNDE VIVE TODO
   En el IndexedDB del navegador, con RetoDatos (el mismo almacén de las demás
   preferencias). Por eso entra SOLO en el respaldo que la persona hace desde
   Configuración → Datos, sin hacer nada especial aquí. El servidor de Python no
   guarda nada: calcula y contesta (ver server.py, "TESTS: RONDAS").

   QUÉ SE GUARDA, y con qué clave
     tests-indice            [ids de los tests]
     tests-t-<id>            un test completo (título, materia, preguntas…)
     tests-estado-<id>       { idPregunta: estado }: en qué caja de repaso está
                             cada pregunta y cuándo vuelve (logica/rondas.py)
     tests-intentos-<id>     [{ ts, qid, acierto, seguridad, clase, eleccion }]:
                             CADA respuesta que se ha dado, de las más viejas a
                             las más nuevas. Es el registro: el estado se
                             puede reconstruir de aquí, y de aquí saldrán los
                             informes.
     tests-hecho-<id>        cuándo se terminó el test por última vez
     tests-cantidad / -modo  lo último que se eligió al preparar una ronda

   UN TEST EN UNA CLAVE, y no todo el banco en una: guardar un cambio reescribe
   solo ese test, y un banco grande no se vuelve lento ni se pierde de golpe si
   una escritura falla.

   LAS ESCRITURAS VAN EN FILA. Cada guardado espera al anterior: dos respuestas
   seguidas leen y escriben la misma lista de intentos, y sin la fila la segunda
   pisaría a la primera.

   Los tests de EJEMPLO (reto-tests-muestra.js) ya no se mezclan solos con los
   de la persona: se agregan con un botón, y solo si no están.
   ========================================================================= */
(function () {
  'use strict';

  var API = '/api/tests';
  var CLAVE_INDICE = 'tests-indice';
  var MAX_INTENTOS = 2000;

  function claveTest(id) { return 'tests-t-' + id; }
  function claveEstado(id) { return 'tests-estado-' + id; }
  function claveIntentos(id) { return 'tests-intentos-' + id; }

  var Datos = function () { return window.RetoDatos; };
  var fila = Promise.resolve();

  /* Encola una escritura: corre cuando termina la anterior, falle o no. */
  function encolar(fn) {
    var p = fila.then(fn, fn);
    fila = p.catch(function () {});
    return p;
  }

  function indice() {
    return Datos().obtener(CLAVE_INDICE).then(function (v) { return Array.isArray(v) ? v : []; });
  }

  function cargar() {
    return indice().then(function (ids) {
      return Promise.all(ids.map(function (id) { return Datos().obtener(claveTest(id)); }));
    }).then(function (lista) {
      return lista.filter(function (t) { return t && typeof t === 'object' && t.id; });
    });
  }

  function guardar(test) {
    return encolar(function () {
      return indice().then(function (ids) {
        var escribir = Datos().poner(claveTest(test.id), test);
        if (ids.indexOf(test.id) < 0) {
          ids.push(test.id);
          return escribir.then(function () { return Datos().poner(CLAVE_INDICE, ids); });
        }
        return escribir;
      });
    });
  }

  function guardarVarios(tests) {
    return tests.reduce(function (p, t) {
      return p.then(function () { return guardar(t); });
    }, Promise.resolve());
  }

  /* Borrar un test se lleva TAMBIÉN su historial: un estado o un intento sin su
     test no sirve para nada y ocuparía lugar en el respaldo para siempre. */
  function borrar(id) {
    return encolar(function () {
      return indice().then(function (ids) {
        var nuevos = ids.filter(function (x) { return x !== id; });
        return Datos().poner(CLAVE_INDICE, nuevos);
      }).then(function () {
        return Promise.all([
          Datos().poner(claveTest(id), null),
          Datos().poner(claveEstado(id), null),
          Datos().poner(claveIntentos(id), null),
          Datos().poner('tests-hecho-' + id, null)
        ]);
      });
    });
  }

  /* Agrega los tests de ejemplo que todavía no estén. Devuelve cuántos agregó. */
  function ejemplos() {
    return indice().then(function (ids) {
      var nuevos = window.RetoTestsMuestra.copiar().filter(function (t) { return ids.indexOf(t.id) < 0; });
      return guardarVarios(nuevos).then(function () { return nuevos.length; });
    });
  }

  /* -------------------------------------------------- estado e intentos */

  function estados(testId) {
    return Datos().obtener(claveEstado(testId)).then(function (v) {
      var mapa = v && typeof v === 'object' ? v : {};
      // Estados guardados por una versión de prueba (un número suelto en vez de un objeto): se descartan.
      Object.keys(mapa).forEach(function (k) { if (!mapa[k] || typeof mapa[k] !== 'object') delete mapa[k]; });
      return mapa;
    });
  }

  function guardarEstado(testId, qid, estado) {
    return encolar(function () {
      return estados(testId).then(function (mapa) {
        mapa[qid] = estado;
        return Datos().poner(claveEstado(testId), mapa);
      });
    });
  }

  function intentos(testId) {
    return Datos().obtener(claveIntentos(testId)).then(function (v) { return Array.isArray(v) ? v : []; });
  }

  function registrarIntento(testId, intento) {
    return encolar(function () {
      return intentos(testId).then(function (lista) {
        lista.push(intento);
        if (lista.length > MAX_INTENTOS) lista = lista.slice(-MAX_INTENTOS);
        return Datos().poner(claveIntentos(testId), lista);
      });
    });
  }

  /* ----------------------------------------------------------- servidor */

  /* Un 404 o un 405 no deberían pasar: las reglas viven en reto-api.js, en la misma página. */
  function pedir(ruta, cuerpo) {
    return fetch(API + ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    }).then(function (r) {
      if (r.ok) return r.json();
      return r.json().catch(function () { return {}; }).then(function (d) {
        throw new Error(d.error || ('No se pudo preparar esto (error ' + r.status + ').'));
      });
    }).catch(function (e) {
      if (e instanceof TypeError) throw new Error('No se pudo preparar esto. Recarga la página.');
      throw e;
    });
  }

  /* Lo que el servidor necesita saber de una pregunta: su id, cuántas opciones
     trae y su tema. Una pregunta con números que cambian solo se puede
     responder si trae ejemplos escritos a mano (la maqueta: ver ESTADO.md); las
     demás todavía no, y NO se mandan. */
  function jugable(p) {
    return p.tipo === 'estatica' || p.tipo === 'dinamica';
  }

  function paraServidor(p) {
    var n = p.tipo === 'estatica' ? p.opciones.length : (p.opcionesAMostrar || 4);
    return { id: p.id, opciones: n, tema: p.tema || {} };
  }

  /* Cómo va la persona en cada test: { idTest: { total, nuevas, por_repasar,
     dominadas, temas_debiles } }. Una sola llamada para todos. */
  function resumenes(tests) {
    return Promise.all(tests.map(function (t) { return estados(t.id); })).then(function (todos) {
      var carga = tests.map(function (t, i) {
        var qs = t.preguntas.filter(jugable);
        return { id: t.id, preguntas: qs.map(function (p) { return { id: p.id, tema: p.tema || {} }; }), estados: todos[i] };
      }).filter(function (c) { return c.preguntas.length > 0; });
      if (!carga.length) return {};
      return pedir('/resumen', { tests: carga });
    });
  }

  /* Arma una ronda: devuelve { preguntas: [{ id, orden }], resumen, semilla }. */
  function ronda(test, ids, cantidad, modo) {
    var qs = test.preguntas.filter(function (p) { return jugable(p) && (!ids || ids.indexOf(p.id) >= 0); });
    return estados(test.id).then(function (mapa) {
      return pedir('/ronda', {
        preguntas: qs.map(paraServidor),
        estados: mapa,
        cantidad: cantidad,
        modo: modo
      });
    });
  }

  /* Registra una respuesta: pide el estado nuevo a las reglas y lo guarda. */
  function registrarRespuesta(testId, qid, previo, acierto, seguridad) {
    return pedir('/registrar', { estado: previo || null, acierto: acierto, seguridad: seguridad || null })
      .then(function (d) { return guardarEstado(testId, qid, d.estado).then(function () { return d.estado; }); });
  }

  window.RetoTestsBanco = {
    cargar: cargar,
    guardar: guardar,
    guardarVarios: guardarVarios,
    borrar: borrar,
    ejemplos: ejemplos,
    estados: estados,
    intentos: intentos,
    registrarIntento: registrarIntento,
    registrarRespuesta: registrarRespuesta,
    resumenes: resumenes,
    ronda: ronda,
    jugable: jugable,
    cantidadJugable: function (test) { return test.preguntas.filter(jugable).length; }
  };
})();
