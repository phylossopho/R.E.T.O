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
      return v && typeof v === 'object' ? v : {};
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

  function esGitHubPages() {
    var h = window.location.hostname;
    return h.includes('github.io') || h.includes('github.dev');
  }

  /* Un 404 o un 405 quieren decir lo mismo aquí: el servidor que está corriendo
     es más viejo que esta pantalla y no conoce la ruta. */
  function pedir(ruta, cuerpo) {
    return fetch(API + ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    }).then(function (r) {
      if (r.ok) return r.json();
      if (r.status === 404 || r.status === 405) {
        if (esGitHubPages()) {
          throw new Error('Función no disponible en GitHub Pages (requiere servidor local).');
        }
        throw new Error('El servidor que está corriendo es más viejo que esta pantalla. ' +
          'Ciérralo y abre servidor.cmd otra vez.');
      }
      return r.json().catch(function () { return {}; }).then(function (d) {
        throw new Error(d.error || ('El servidor no pudo con esto (error ' + r.status + ').'));
      });
    }).catch(function (e) {
      if (e instanceof TypeError) {
        if (esGitHubPages()) {
          throw new Error('Función no disponible en GitHub Pages (requiere servidor local).');
        }
        throw new Error('No se pudo hablar con el servidor. ¿Está abierto?');
      }
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
    if (esGitHubPages()) {
      return Promise.all(tests.map(function (t) { return estados(t.id); })).then(function (todos) {
        var res = {};
        tests.forEach(function (t, i) {
          var mapa = todos[i] || {};
          var jugables = t.preguntas.filter(jugable);
          var total = jugables.length;
          var dominadas = 0, nuevas = 0, por_repasar = 0;
          jugables.forEach(function (p) {
            var e = mapa[p.id] || 0;
            if (e >= 3) dominadas++;
            else if (e === 0) nuevas++;
            else por_repasar++;
          });
          res[t.id] = { total: total, nuevas: nuevas, por_repasar: por_repasar, dominadas: dominadas, temas_debiles: [] };
        });
        return res;
      });
    }
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
      // En GitHub Pages no hay servidor Python: armar ronda client-side
      if (typeof window !== 'undefined' && !window.location.hostname.includes('127.0.0.1') && !window.location.hostname.includes('localhost')) {
        return rondaLocal(qs, mapa, cantidad, modo);
      }
      return pedir('/ronda', {
        preguntas: qs.map(paraServidor),
        estados: mapa,
        cantidad: cantidad,
        modo: modo
      });
    });
  }

  function rondaLocal(qs, mapa, cantidad, modo) {
    // Lógica simple client-side: mezclar y devolver
    var disponibles = qs.slice();
    if (modo === 'repasar') {
      disponibles.sort(function (a, b) {
        var ea = mapa[a.id] || 0;
        var eb = mapa[b.id] || 0;
        return ea - eb; // las que menos saben primero
      });
    } else {
      for (var i = disponibles.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = disponibles[i]; disponibles[i] = disponibles[j]; disponibles[j] = tmp;
      }
    }
    var seleccionadas = disponibles.slice(0, cantidad);
    var semilla = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return Promise.resolve({
      preguntas: seleccionadas.map(function (p, i) { return { id: p.id, orden: i }; }),
      resumen: {},
      semilla: semilla
    });
  }

  /* Registra una respuesta: pide el estado nuevo al servidor y lo guarda. */
  function registrarRespuesta(testId, qid, previo, acierto, seguridad) {
    if (esGitHubPages()) {
      return registrarRespuestaLocal(qid, previo, acierto, seguridad);
    }
    return pedir('/registrar', { estado: previo || null, acierto: acierto, seguridad: seguridad || null })
      .then(function (d) { return guardarEstado(testId, qid, d.estado).then(function () { return d.estado; }); });
  }

  function registrarRespuestaLocal(qid, previo, acierto, seguridad) {
    // Lógica simplificada de repaso (tipo Leitner): 
    // estado 0=nueva, 1-2=aprendiendo, 3=dominada
    var estado = previo || 0;
    if (acierto) {
      estado = Math.min(3, estado + 1);
    } else {
      estado = Math.max(0, estado - 1);
    }
    return Promise.resolve(estado);
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
