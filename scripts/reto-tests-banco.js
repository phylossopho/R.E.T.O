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

  /* -------------------------------------------------- LÓGICA SRS (port de logica/rondas.py) */

  var DIA_MS = 86400000;
  var CAJAS = 5;
  var INTERVALO_DIAS = {0: 0, 1: 1, 2: 3, 3: 7, 4: 14, 5: 30};
  var MODOS = ["prioridad", "azar", "orden"];
  var SEGURIDADES = ["seguro", "dudando", "adivinando"];
  var MIN_OPCIONES = 2;
  var MAX_OPCIONES = 6;
  var MAX_PREGUNTAS = 2000;
  var MAX_TEXTO = 120;
  var CUOTA_REPASO = 0.7;
  var PESO_NUEVA = 1.5;
  var PESO_FALLO = 4.0;
  var PESO_FALLO_SEGURO = 5.0;
  var PESO_VENCIDA_BASE = 2.0;
  var PESO_NO_VENCIDA = 0.3;
  var TOPE_RETRASO = 3.0;
  var TEMAS_DEBILES_MAX = 5;

  function ahora_ms() {
    return Math.floor(Date.now());
  }

  function _entero(valor, nombre, minimo) {
    minimo = minimo || 0;
    if (typeof valor === 'boolean' || !Number.isInteger(valor)) {
      throw new Error(nombre + " tiene que ser un número entero");
    }
    if (valor < minimo) {
      throw new Error(nombre + " no puede ser menor que " + minimo);
    }
    return valor;
  }

  function estado_inicial() {
    return {"caja": 0, "vistas": 0, "aciertos": 0, "fallos": 0, "ultimo": null,
            "vence": 0, "ultimoResultado": null, "ultimaSeguridad": null};
  }

  function _estado(valor) {
    if (valor === null || valor === undefined) {
      return estado_inicial();
    }
    if (typeof valor !== 'object') {
      throw new Error("el estado de una pregunta tiene que ser un objeto");
    }
    var e = estado_inicial();
    ["vistas", "aciertos", "fallos", "vence"].forEach(function (clave) {
      if (valor[clave] !== null && valor[clave] !== undefined) {
        e[clave] = _entero(valor[clave], clave);
      }
    });
    if (valor.caja !== null && valor.caja !== undefined) {
      e.caja = _entero(valor.caja, "caja");
      if (e.caja > CAJAS) throw new Error("la caja va de 0 a " + CAJAS);
    }
    if (valor.ultimo !== null && valor.ultimo !== undefined) {
      e.ultimo = _entero(valor.ultimo, "ultimo");
    }
    if (valor.ultimoResultado !== null && valor.ultimoResultado !== undefined &&
        valor.ultimoResultado !== "acierto" && valor.ultimoResultado !== "fallo") {
      throw new Error("ultimoResultado tiene que ser acierto o fallo");
    }
    e.ultimoResultado = valor.ultimoResultado;
    if (valor.ultimaSeguridad !== null && valor.ultimaSeguridad !== undefined &&
        SEGURIDADES.indexOf(valor.ultimaSeguridad) === -1) {
      throw new Error("seguridad desconocida");
    }
    e.ultimaSeguridad = valor.ultimaSeguridad;
    return e;
  }

  function registrar(estado, acierto, seguridad, ahora) {
    if (typeof acierto !== 'boolean') throw new Error("acierto tiene que ser verdadero o falso");
    if (seguridad !== null && seguridad !== undefined && SEGURIDADES.indexOf(seguridad) === -1) {
      throw new Error("seguridad desconocida: " + seguridad);
    }
    var e = _estado(estado);
    ahora = ahora || ahora_ms();
    e.vistas += 1;
    e.ultimo = ahora;
    e.ultimaSeguridad = seguridad;
    if (!acierto) {
      e.fallos += 1;
      e.ultimoResultado = "fallo";
      e.caja = 0;
      e.vence = ahora;
      return e;
    }
    e.aciertos += 1;
    e.ultimoResultado = "acierto";
    if (seguridad === "dudando" || seguridad === "adivinando") {
      e.vence = ahora + Math.max(INTERVALO_DIAS[e.caja], 1) * DIA_MS;
    } else {
      e.caja = Math.min(CAJAS, e.caja + 1);
      e.vence = ahora + INTERVALO_DIAS[e.caja] * DIA_MS;
    }
    return e;
  }

  function esta_vencida(estado, ahora) {
    return estado.vistas > 0 && estado.vence <= ahora;
  }

  function prioridad(estado, ahora) {
    var e = _estado(estado);
    if (e.vistas === 0) return PESO_NUEVA;
    var base = 0.0;
    if (e.ultimoResultado === "fallo") {
      base = (e.ultimaSeguridad === "seguro") ? PESO_FALLO_SEGURO : PESO_FALLO;
    }
    if (e.vence <= ahora) {
      var intervalo = Math.max(INTERVALO_DIAS[e.caja], 1) * DIA_MS;
      var retraso = Math.min((ahora - e.vence) / (intervalo * 1.0), TOPE_RETRASO);
      return Math.max(base, PESO_VENCIDA_BASE + retraso);
    }
    return Math.max(base, PESO_NO_VENCIDA / (1 + e.caja));
  }

  function ruta_de_tema(tema) {
    if (!tema || typeof tema !== 'object') return [];
    var salida = [];
    ["n2", "n3", "n4"].forEach(function (nivel) {
      var valor = tema[nivel];
      if (typeof valor === 'string' && valor.trim()) salida.push(valor.trim());
    });
    return salida;
  }

  function _revisar_preguntas(preguntas, exigir_opciones) {
    exigir_opciones = exigir_opciones !== false;
    if (!Array.isArray(preguntas) || !preguntas.length) throw new Error("faltan las preguntas");
    if (preguntas.length > MAX_PREGUNTAS) throw new Error("hay demasiadas preguntas (el máximo es " + MAX_PREGUNTAS + ")");
    var vistos = {};
    var limpias = [];
    preguntas.forEach(function (p) {
      if (!p || typeof p !== 'object') throw new Error("una pregunta no es válida");
      var pid = p.id;
      if (typeof pid !== 'string' || !pid || pid.length > MAX_TEXTO) {
        throw new Error("cada pregunta necesita un id de texto");
      }
      if (vistos[pid]) throw new Error("hay dos preguntas con el mismo id: " + pid);
      vistos[pid] = true;
      var n = p.opciones;
      if (exigir_opciones && (typeof n === 'boolean' || !Number.isInteger(n) || n < 2 || n > 6)) {
        throw new Error("la pregunta " + pid + " necesita entre 2 y 6 opciones");
      }
      limpias.push({"id": pid, "opciones": n, "tema": p.tema || {}});
    });
    return limpias;
  }

  function _revisar_estados(estados, preguntas) {
    if (!estados) return {};
    if (typeof estados !== 'object') throw new Error("los estados tienen que ser un objeto");
    var ids = {};
    preguntas.forEach(function (p) { ids[p.id] = true; });
    var salida = {};
    Object.keys(estados).forEach(function (k) {
      if (ids[k]) salida[k] = _estado(estados[k]);
    });
    return salida;
  }

  function _muestra(items, estados, n, ahora, rng) {
    if (n <= 0 || !items.length) return [];
    var claves = items.map(function (p) {
      var peso = prioridad(estados[p.id] || {}, ahora);
      return [Math.pow(rng.random(), 1.0 / peso), p];
    });
    claves.sort(function (a, b) { return b[0] - a[0]; });
    return claves.slice(0, n).map(function (par) { return par[1]; });
  }

  function _quitar(items, usadas) {
    var ids = {};
    usadas.forEach(function (p) { ids[p.id] = true; });
    return items.filter(function (p) { return !ids[p.id]; });
  }

  function _elegir(preguntas, estados, cantidad, modo, ahora, rng) {
    if (modo === "orden") return preguntas.slice(0, cantidad);
    if (modo === "azar") {
      var arr = preguntas.slice();
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rng.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr.slice(0, cantidad);
    }
    var ahora_val = ahora || ahora_ms();
    var debidas = [], nuevas = [], otras = [];
    preguntas.forEach(function (p) {
      var e = estados[p.id] || estado_inicial();
      if (esta_vencida(e, ahora_val)) debidas.push(p);
      else if (e.vistas === 0) nuevas.push(p);
      else otras.push(p);
    });
    var cuota = Math.min(debidas.length, Math.ceil(cantidad * CUOTA_REPASO * 100) / 100);
    var elegidas = _muestra(debidas, {}, cuota, ahora, rng);
    var grupos = [nuevas, _quitar(debidas, elegidas), otras];
    grupos.forEach(function (grupo) {
      var falta = cantidad - elegidas.length;
      if (falta <= 0) return;
      elegidas = elegidas.concat(_muestra(grupo, {}, falta, undefined, rng));
    });
    // Mezclar para que repaso y nuevas vayan mezcladas
    for (var i = elegidas.length - 1; i > 0; i--) {
      var j = Math.floor(rng.random() * (i + 1));
      var tmp = elegidas[i]; elegidas[i] = elegidas[j]; elegidas[j] = tmp;
    }
    return elegidas;
  }

  function armar_ronda(preguntas, estados, cantidad, modo, ahora, semilla) {
    if (MODOS.indexOf(modo) === -1) throw new Error("modo desconocido: " + modo);
    if (typeof cantidad !== 'number' || cantidad < 1) throw new Error("la cantidad tiene que ser un número entero de 1 en adelante");
    if (semilla !== null && semilla !== undefined && !Number.isInteger(semilla)) {
      throw new Error("la semilla tiene que ser un número entero");
    }
    var pregs = _revisar_preguntas(preguntas);
    var est = _revisar_estados(estados, pregs);
    ahora = ahora || ahora_ms();
    if (semilla === null || semilla === undefined) {
      semilla = Math.floor(Math.random() * 0x80000000);
    }
    var rng = new Math.random;
    // Usar semilla para rng determinístico
    var seed = semilla;
    rng = function() {
      seed = (seed * 1664525 + 1013904223) % 0x100000000;
      return seed / 0x100000000;
    };

    cantidad = Math.min(cantidad, pregs.length);
    var elegidas = _elegir(pregs, {}, cantidad, modo, ahora, rng);
    var salida = [];
    elegidas.forEach(function (p) {
      var orden = [];
      for (var i = 0; i < p.opciones; i++) orden.push(i);
      for (var i = orden.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var tmp = orden[i]; orden[i] = orden[j]; orden[j] = tmp;
      }
      salida.push({"id": p.id, "orden": orden});
    });
    return {"semilla": semilla, "ahora": ahora, "preguntas": salida};
  }

  function resumen_test(preguntas, estados, ahora) {
    var pregs = _revisar_preguntas(preguntas, false);
    var est = _revisar_estados(estados, pregs);
    ahora = ahora || ahora_ms();
    var nuevas = 0, repasar = 0, dominadas = 0;
    var temas = {};
    pregs.forEach(function (p) {
      var e = _estado(estados[p.id] || estado_inicial());
      if (e.vistas === 0) {
        nuevas += 1;
        return;
      }
      var vencida = e.vistas > 0 && e.vence <= (ahora || ahora_ms());
      if (vencida) {
        repasar += 1;
        var ruta = ruta_de_tema(p.tema);
        if (ruta.length) {
          var key = JSON.stringify(ruta);
          temas[key] = (temas[key] || 0) + 1;
        }
      } else if (e.caja >= 4) {
        dominadas += 1;
      }
    });
    var ordenados = Object.keys(temas).sort(function (a, b) {
      return (temas[b] - temas[a]) || (a > b ? 1 : -1);
    });
    var temas_debiles = ordenados.slice(0, 5).map(function (r) {
      return {"ruta": JSON.parse(r), "n": temas[r]};
    });
    return {
      "total": Object.keys(estados).length,
      "nuevas": nuevas,
      "por_repasar": repasar,
      "dominadas": dominadas,
      "temas_debiles": temas_debiles
    };
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

  /* -------------------------------------------------- funciones expuestas */

  function esGitHubPages() {
    var h = window.location.hostname;
    return h.includes('github.io') || h.includes('github.dev');
  }

  function ahora_ms() {
    return Math.floor(Date.now());
  }

  function estado_inicial() {
    return {"caja": 0, "vistas": 0, "aciertos": 0, "fallos": 0, "ultimo": null,
            "vence": 0, "ultimoResultado": null, "ultimaSeguridad": null};
  }

  function _entero(valor, nombre, minimo) {
    minimo = minimo || 0;
    if (typeof valor === 'boolean' || !Number.isInteger(valor)) {
      throw new Error(nombre + " tiene que ser un número entero");
    }
    if (valor < minimo) throw new Error(nombre + " no puede ser menor que " + minimo);
    return valor;
  }

  function _estado(valor) {
    if (valor === null || valor === undefined) return estado_inicial();
    if (typeof valor !== 'object') throw new Error("el estado de una pregunta tiene que ser un objeto");
    var e = estado_inicial();
    ["vistas", "aciertos", "fallos", "vence"].forEach(function (clave) {
      if (valor[clave] !== null && valor[clave] !== undefined) e[clave] = _entero(valor[clave], clave);
    });
    if (valor.caja !== null && valor.caja !== undefined) {
      e.caja = _entero(valor.caja, "caja");
      if (e.caja > 5) throw new Error("la caja va de 0 a 5");
    }
    if (valor.ultimo !== null && valor.ultimo !== undefined) e.ultimo = _entero(valor.ultimo, "ultimo");
    if (valor.ultimoResultado !== null && valor.ultimoResultado !== undefined &&
        valor.ultimoResultado !== "acierto" && valor.ultimoResultado !== "fallo") {
      throw new Error("ultimoResultado tiene que ser acierto o fallo");
    }
    e.ultimoResultado = valor.ultimoResultado;
    if (valor.ultimaSeguridad !== null && valor.ultimaSeguridad !== undefined &&
        ["seguro", "dudando", "adivinando"].indexOf(valor.ultimaSeguridad) === -1) {
      throw new Error("seguridad desconocida");
    }
    e.ultimaSeguridad = valor.ultimaSeguridad;
    return e;
  }

  function registrar(estado, acierto, seguridad, ahora) {
    if (typeof acierto !== 'boolean') throw new Error("acierto tiene que ser verdadero o falso");
    if (seguridad !== null && seguridad !== undefined && ["seguro", "dudando", "adivinando"].indexOf(seguridad) === -1) {
      throw new Error("seguridad desconocida: " + seguridad);
    }
    var e = _estado(estado);
    ahora = ahora || ahora_ms();
    e.vistas += 1; e.ultimo = ahora; e.ultimaSeguridad = seguridad;
    if (!acierto) { e.fallos += 1; e.ultimoResultado = "fallo"; e.caja = 0; e.vence = ahora; return e; }
    e.aciertos += 1; e.ultimoResultado = "acierto";
    if (seguridad === "dudando" || seguridad === "adivinando") {
      e.vence = ahora + Math.max(INTERVALO_DIAS[e.caja], 1) * DIA_MS;
    } else {
      e.caja = Math.min(5, e.caja + 1);
      e.vence = ahora + INTERVALO_DIAS[e.caja] * DIA_MS;
    }
    return e;
  }

  function esta_vencida(estado, ahora) {
    return estado.vistas > 0 && estado.vence <= (ahora || ahora_ms());
  }

  function prioridad(estado, ahora) {
    var e = _estado(estado);
    if (e.vistas === 0) return PESO_NUEVA;
    var base = 0.0;
    if (e.ultimoResultado === "fallo") base = (e.ultimaSeguridad === "seguro") ? PESO_FALLO_SEGURO : PESO_FALLO;
    if (e.vence <= (ahora || ahora_ms())) {
      var intervalo = Math.max(INTERVALO_DIAS[e.caja], 1) * DIA_MS;
      var retraso = Math.min(((ahora || ahora_ms()) - e.vence) / (intervalo * 1.0), TOPE_RETRASO);
      return Math.max(base, PESO_VENCIDA_BASE + retraso);
    }
    return Math.max(base, PESO_NO_VENCIDA / (1 + e.caja));
  }

  function ruta_de_tema(tema) {
    if (!tema || typeof tema !== 'object') return [];
    var salida = [];
    ["n2", "n3", "n4"].forEach(function (nivel) {
      var valor = tema[nivel];
      if (typeof valor === 'string' && valor.trim()) salida.push(valor.trim());
    });
    return salida;
  }

  function _revisar_preguntas(preguntas, exigir_opciones) {
    exigir_opciones = exigir_opciones !== false;
    if (!Array.isArray(preguntas) || !preguntas.length) throw new Error("faltan las preguntas");
    if (preguntas.length > MAX_PREGUNTAS) throw new Error("hay demasiadas preguntas (el máximo es " + MAX_PREGUNTAS + ")");
    var vistos = {};
    var limpias = [];
    preguntas.forEach(function (p) {
      if (!p || typeof p !== 'object') throw new Error("una pregunta no es válida");
      var pid = p.id;
      if (typeof pid !== 'string' || !pid || pid.length > 120) throw new Error("cada pregunta necesita un id de texto");
      if (vistos[pid]) throw new Error("hay dos preguntas con el mismo id: " + pid);
      vistos[pid] = true;
      var n = p.opciones;
      if (exigir_opciones !== false && (typeof n === 'boolean' || !Number.isInteger(n) || n < 2 || n > 6)) {
        throw new Error("la pregunta " + pid + " necesita entre 2 y 6 opciones");
      }
      limpias.push({"id": pid, "opciones": n, "tema": p.tema || {}});
    });
    return limpias;
  }

  function _revisar_estados(estados, preguntas) {
    if (!estados) return {};
    if (typeof estados !== 'object') throw new Error("los estados tienen que ser un objeto");
    var ids = {}; preguntas.forEach(function (p) { ids[p.id] = true; });
    var salida = {};
    Object.keys(estados).forEach(function (k) { if (ids[k]) salida[k] = _estado(estados[k]); });
    return salida;
  }

  function _muestra(items, estados, n, ahora, rng) {
    if (n <= 0 || !items.length) return [];
    var claves = items.map(function (p) {
      var peso = prioridad(estados[p.id] || {}, ahora);
      return [Math.pow(rng(), 1.0 / peso), p];
    });
    claves.sort(function (a, b) { return b[0] - a[0]; });
    return claves.slice(0, n).map(function (par) { return par[1]; });
  }

  function _quitar(items, usadas) {
    var ids = {}; usadas.forEach(function (p) { ids[p.id] = true; });
    return items.filter(function (p) { return !ids[p.id]; });
  }

  function _elegir(preguntas, estados, cantidad, modo, ahora, rng) {
    if (modo === "orden") return preguntas.slice(0, cantidad);
    if (modo === "azar") {
      var arr = preguntas.slice();
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr.slice(0, cantidad);
    }
    var ahora_val = ahora || ahora_ms();
    var debidas = [], nuevas = [], otras = [];
    preguntas.forEach(function (p) {
      var e = (estados[p.id] || estado_inicial());
      if (esta_vencida(e, ahora_val)) debidas.push(p);
      else if (e.vistas === 0) nuevas.push(p);
      else otras.push(p);
    });
    var cuota = Math.min(debidas.length, Math.ceil(cantidad * CUOTA_REPASO * 100) / 100);
    var elegidas = _muestra(debidas, {}, cuota, ahora, rng);
    var grupos = [nuevas, _quitar(debidas, elegidas), otras];
    grupos.forEach(function (grupo) {
      var falta = cantidad - elegidas.length;
      if (falta <= 0) return;
      elegidas = elegidas.concat(_muestra(grupo, {}, falta, undefined, rng));
    });
    for (var i = elegidas.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = elegidas[i]; elegidas[i] = elegidas[j]; elegidas[j] = tmp;
    }
    return elegidas;
  }

  function armar_ronda(preguntas, estados, cantidad, modo, ahora, semilla) {
    if (["prioridad", "azar", "orden"].indexOf(modo) === -1) throw new Error("modo desconocido: " + modo);
    if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error("la cantidad tiene que ser un número entero de 1 en adelante");
    if (semilla !== null && semilla !== undefined && !Number.isInteger(semilla)) throw new Error("la semilla tiene que ser un número entero");
    var pregs = _revisar_preguntas(preguntas);
    var est = _revisar_estados(estados, pregs);
    ahora = ahora || ahora_ms();
    if (semilla === null || semilla === undefined) semilla = Math.floor(Math.random() * 0x80000000);
    var rng = function() {
      var seed = semilla;
      return function() {
        seed = (seed * 1664525 + 1013904223) % 0x100000000;
        return seed / 0x100000000;
      };
    }();
    cantidad = Math.min(cantidad, pregs.length);
    var elegidas = _elegir(pregs, est, cantidad, modo, ahora, rng);
    var salida = [];
    elegidas.forEach(function (p) {
      var orden = [];
      for (var i = 0; i < p.opciones; i++) orden.push(i);
      for (var i = orden.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var tmp = orden[i]; orden[i] = orden[j]; orden[j] = tmp;
      }
      salida.push({"id": p.id, "orden": orden});
    });
    return {"semilla": semilla, "ahora": ahora, "preguntas": salida};
  }

  function resumen_test(preguntas, estados, ahora) {
    var pregs = _revisar_preguntas(preguntas, false);
    var est = _revisar_estados(estados, pregs);
    ahora = ahora || ahora_ms();
    var nuevas = 0, repasar = 0, dominadas = 0;
    var temas = {};
    pregs.forEach(function (p) {
      var e = _estado(estados[p.id] || estado_inicial());
      if (e.vistas === 0) { nuevas += 1; return; }
      if (esta_vencida(e, ahora)) {
        repasar += 1;
        var ruta = ruta_de_tema(p.tema);
        if (ruta.length) {
          var key = JSON.stringify(ruta);
          temas[key] = (temas[key] || 0) + 1;
        }
      } else if (e.caja >= 4) dominadas += 1;
    });
    var ordenados = Object.keys(temas).sort(function (a, b) { return (temas[b] - temas[a]) || (a > b ? 1 : -1); });
    var temas_debiles = ordenados.slice(0, 5).map(function (r) { return {"ruta": JSON.parse(r), "n": temas[r]}; });
    return {"total": Object.keys(estados).length, "nuevas": nuevas, "por_repasar": repasar, "dominadas": dominadas, "temas_debiles": temas_debiles};
  }

  /* -------------------------------------------------- estado e intentos */

  function estados(testId) {
    return Datos().obtener(claveEstado(testId)).then(function (v) { return v && typeof v === 'object' ? v : {}; });
  }

  function guardarEstado(testId, qid, estado) {
    return encolar(function () { return estados(testId).then(function (mapa) { mapa[qid] = estado; return Datos().poner(claveEstado(testId), mapa); }); });
  }

  function intentos(testId) { return Datos().obtener(claveIntentos(testId)).then(function (v) { return Array.isArray(v) ? v : []; }); }

  function registrarIntento(testId, intento) { return encolar(function () { return intentos(testId).then(function (lista) { lista.push(intento); if (lista.length > 2000) lista = lista.slice(-2000); return Datos().poner(claveIntentos(testId), lista); }); }); }

  /* -------------------------------------------------- servidor */

  function esGitHubPages() {
    var h = window.location.hostname;
    return h.includes('github.io') || h.includes('github.dev');
  }

  function pedir(ruta, cuerpo) {
    return fetch(API + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      .then(function (r) {
        if (r.ok) return r.json();
        if (r.status === 404 || r.status === 405) {
          if (esGitHubPages()) throw new Error('Función no disponible en GitHub Pages (requiere servidor local).');
          throw new Error('El servidor que está corriendo es más viejo que esta pantalla. Ciérralo y abre servidor.cmd otra vez.');
        }
        return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || ('El servidor no pudo con esto (error ' + r.status + ').')); });
      }).catch(function (e) {
        if (e instanceof TypeError) {
          if (esGitHubPages()) throw new Error('Función no disponible en GitHub Pages (requiere servidor local).');
          throw new Error('No se pudo hablar con el servidor. ¿Está abierto?');
        }
        throw e;
      });
  }

  function jugable(p) { return p.tipo === 'estatica' || p.tipo === 'dinamica'; }

  function paraServidor(p) {
    var n = p.tipo === 'estatica' ? p.opciones.length : (p.opcionesAMostrar || 4);
    return { id: p.id, opciones: n, tema: p.tema || {} };
  }

  /* Cómo va la persona en cada test */
  function resumenes(tests) {
    if (esGitHubPages()) {
      return Promise.all(tests.map(function (t) { return estados(t.id); })).then(function (todos) {
        var res = {};
        tests.forEach(function (t, i) {
          var mapa = todos[i] || {};
          var jugables = t.preguntas.filter(function (p) { return p.tipo === 'estatica' || p.tipo === 'dinamica'; });
          var total = jugables.length, dominadas = 0, nuevas = 0, por_repasar = 0;
          jugables.forEach(function (p) {
            var e = mapa[p.id] || estado_inicial();
            if (e.vistas === 0) nuevas++;
            else if (e.caja >= 4 && e.vence > ahora_ms()) dominadas++;
            else por_repasar++;
          });
          res[t.id] = { total: jugables.length, nuevas: nuevas, por_repasar: por_repasar, dominadas: dominadas, temas_debiles: [] };
        });
        return res;
      });
    }
    return Promise.all(tests.map(function (t) { return estados(t.id); })).then(function (todos) {
      var carga = tests.map(function (t, i) {
        var qs = t.preguntas.filter(function (p) { return p.tipo === 'estatica' || p.tipo === 'dinamica'; });
        return { id: t.id, preguntas: qs.map(function (p) { return { id: p.id, tema: p.tema || {} }; }), estados: todos[i] };
      }).filter(function (c) { return c.preguntas.length > 0; });
      if (!carga.length) return {};
      return pedir('/resumen', { tests: carga });
    });
  }

  /* Arma una ronda */
  function ronda(test, ids, cantidad, modo) {
    var qs = test.preguntas.filter(function (p) { return (p.tipo === 'estatica' || p.tipo === 'dinamica') && (!ids || ids.indexOf(p.id) >= 0); });
    return estados(test.id).then(function (mapa) {
      if (esGitHubPages()) return rondaLocal(qs, mapa, cantidad, modo);
      return pedir('/ronda', { preguntas: qs.map(paraServidor), estados: mapa, cantidad: cantidad, modo: modo });
    });
  }

  function rondaLocal(qs, mapa, cantidad, modo) {
    var pregs = qs.map(function (p) { return { id: p.id, opciones: p.opciones, tema: p.tema || {} }; });
    var est = {};
    Object.keys(mapa).forEach(function (k) { mapa[k] = _estado(mapa[k]); });
    var r = armar_ronda(pregs.map(function(p) { return {id: p.id, opciones: p.opciones, tema: p.tema || {}}; }), {}, cantidad, modo, undefined, Date.now());
    return Promise.resolve({ preguntas: r.preguntas.map(function(p, i) { return { id: p.id, orden: i }; }), resumen: {}, semilla: r.semilla });
  }

  function registrarRespuesta(testId, qid, previo, acierto, seguridad) {
    if (esGitHubPages()) return registrarRespuestaLocal(qid, previo, acierto, seguridad);
    return pedir('/registrar', { estado: previo || null, acierto: acierto, seguridad: seguridad || null })
      .then(function (d) { return guardarEstado(testId, qid, d.estado).then(function () { return d.estado; }); });
  }

  function registrarRespuestaLocal(qid, previo, acierto, seguridad) {
    var estado = _estado(previo || estado_inicial());
    if (acierto) {
      if (["dudando", "adivinando"].indexOf(seguridad) !== -1) estado.vence = ahora_ms() + Math.max(INTERVALO_DIAS[estado.caja], 1) * DIA_MS;
      else { estado.caja = Math.min(5, estado.caja + 1); estado.vence = ahora_ms() + INTERVALO_DIAS[estado.caja] * DIA_MS; }
      estado.caja = Math.min(5, estado.caja + (["seguro"].indexOf(seguridad) !== -1 ? 1 : 0));
      estado.aciertos += 1; estado.ultimoResultado = "acierto";
    } else {
      estado.caja = 0; estado.vence = ahora_ms(); estado.fallos += 1; estado.ultimoResultado = "fallo";
    }
    estado.vistas += 1; estado.ultimo = ahora_ms(); estado.ultimaSeguridad = seguridad;
    return Promise.resolve(estado);
  }

  function esGitHubPages() {
    var h = window.location.hostname;
    return h.includes('github.io') || h.includes('github.dev');
  }

  function ahora_ms() { return Math.floor(Date.now()); }

  function estado_inicial() { return {"caja": 0, "vistas": 0, "aciertos": 0, "fallos": 0, "ultimo": null, "vence": 0, "ultimoResultado": null, "ultimaSeguridad": null}; }

  function _entero(valor, nombre, minimo) { minimo = minimo || 0; if (typeof valor === 'boolean' || !Number.isInteger(valor)) throw new Error(nombre + " tiene que ser un número entero"); if (valor < minimo) throw new Error(nombre + " no puede ser menor que " + minimo); return valor; }

  var Datos = function () { return window.RetoDatos; };
  var fila = Promise.resolve();
  function encolar(fn) { var p = fila.then(fn, fn); fila = p.catch(function () {}); return p; }
  function indice() { return Datos().obtener('tests-indice').then(function (v) { return Array.isArray(v) ? v : []; }); }
  function cargar() { return indice().then(function (ids) { return Promise.all(ids.map(function (id) { return Datos().obtener('tests-t-' + id); })).then(function (lista) { return lista.filter(function (t) { return t && typeof t === 'object' && t.id; }); }); }
  function guardar(test) { return encolar(function () { return indice().then(function (ids) { var escribir = Datos().poner('tests-t-' + test.id, test); if (ids.indexOf(test.id) < 0) { ids.push(test.id); return escribir.then(function () { return Datos().poner('tests-indice', ids); }); } return escribir; }); }); }
  function guardarVarios(tests) { return tests.reduce(function (p, t) { return p.then(function () { return guardar(t); }); }, Promise.resolve()); }
  function borrar(id) { return encolar(function () { return indice().then(function (ids) { var nuevos = ids.filter(function (x) { return x !== id; }); return Datos().poner('tests-indice', nuevos); }).then(function () { return Promise.all([Datos().poner('tests-t-' + id, null), Datos().poner('tests-estado-' + id, null), Datos().poner('tests-intentos-' + id, null), Datos().poner('tests-hecho-' + id, null)]); }); }); }
  function ejemplos() { return indice().then(function (ids) { var nuevos = (window.RetoTestsMuestra && window.RetoTestsMuestra.copiar ? window.RetoTestsMuestra.copiar() : []).filter(function (t) { return ids.indexOf(t.id) < 0; }); return guardarVarios(nuevos).then(function () { return nuevos.length; }); }); }
  function estados(testId) { return Datos().obtener('tests-estado-' + testId).then(function (v) { return v && typeof v === 'object' ? v : {}; }); }
  function guardarEstado(testId, qid, estado) { return encolar(function () { return estados(testId).then(function (mapa) { mapa[qid] = estado; return Datos().poner('tests-estado-' + testId, mapa); }); }); }
  function intentos(testId) { return Datos().obtener('tests-intentos-' + testId).then(function (v) { return Array.isArray(v) ? v : []; }); }
  function registrarIntento(testId, intento) { return encolar(function () { return intentos(testId).then(function (lista) { lista.push(intento); if (lista.length > 2000) lista = lista.slice(-2000); return Datos().poner('tests-intentos-' + testId, lista); }); }); }
  function registrarRespuesta(testId, qid, previo, acierto, seguridad) { if (esGitHubPages()) return registrarRespuestaLocal(qid, previo, acierto, seguridad); return pedir('/registrar', { estado: previo || null, acierto: acierto, seguridad: seguridad || null }).then(function (d) { return guardarEstado(testId, qid, d.estado).then(function () { return d.estado; }); }); }
  function registrarRespuestaLocal(qid, previo, acierto, seguridad) { var estado = _estado(previo || estado_inicial()); if (acierto) { if (["dudando", "adivinando"].indexOf(seguridad) !== -1) estado.vence = ahora_ms() + Math.max(INTERVALO_DIAS[estado.caja], 1) * DIA_MS; else { estado.caja = Math.min(5, estado.caja + 1); estado.vence = ahora_ms() + INTERVALO_DIAS[estado.caja] * DIA_MS; } estado.aciertos += 1; estado.ultimoResultado = "acierto"; } else { estado.caja = 0; estado.vence = ahora_ms(); estado.fallos += 1; estado.ultimoResultado = "fallo"; } estado.vistas += 1; estado.ultimo = ahora_ms(); estado.ultimaSeguridad = seguridad; return Promise.resolve(estado); }
  function pedir(ruta, cuerpo) { return fetch('/api/tests' + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(function (r) { if (r.ok) return r.json(); if (r.status === 404 || r.status === 405) { if (esGitHubPages()) throw new Error('Función no disponible en GitHub Pages (requiere servidor local).'); throw new Error('El servidor que está corriendo es más viejo que esta pantalla. Ciérralo y abre servidor.cmd otra vez.'); } return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || ('El servidor no pudo con esto (error ' + r.status + ').')); }); }).catch(function (e) { if (e instanceof TypeError) { if (esGitHubPages()) throw new Error('Función no disponible en GitHub Pages (requiere servidor local).'); throw new Error('No se pudo hablar con el servidor. ¿Está abierto?'); } throw e; }); }

  function jugable(p) { return p.tipo === 'estatica' || p.tipo === 'dinamica'; }
  function paraServidor(p) { var n = p.tipo === 'estatica' ? p.opciones.length : (p.opcionesAMostrar || 4); return { id: p.id, opciones: n, tema: p.tema || {} }; }

  function resumenes(tests) { if (esGitHubPages()) { return Promise.all(tests.map(function (t) { return estados(t.id); })).then(function (todos) { var res = {}; tests.forEach(function (t, i) { var mapa = todos[i] || {}; var jugables = t.preguntas.filter(function (p) { return p.tipo === 'estatica' || p.tipo === 'dinamica'; }); var total = jugables.length, dominadas = 0, nuevas = 0, por_repasar = 0; jugables.forEach(function (p) { var e = mapa[p.id] || estado_inicial(); if (e.vistas === 0) nuevas++; else if (e.caja >= 4 && e.vence > ahora_ms()) dominadas++; else por_repasar++; }); res[t.id] = { total: total, nuevas: nuevas, por_repasar: por_repasar, dominadas: dominadas, temas_debiles: [] }; }); return res; }); } return Promise.all(tests.map(function (t) { return estados(t.id); })).then(function (todos) { var carga = tests.map(function (t, i) { var qs = t.preguntas.filter(function (p) { return p.tipo === 'estatica' || p.tipo === 'dinamica'; }); return { id: t.id, preguntas: qs.map(function (p) { return { id: p.id, tema: p.tema || {} }; }), estados: todos[i] }; }).filter(function (c) { return c.preguntas.length > 0; }); if (!carga.length) return {}; return pedir('/resumen', { tests: carga }); }); }

  function ronda(test, ids, cantidad, modo) { var qs = test.preguntas.filter(function (p) { return (p.tipo === 'estatica' || p.tipo === 'dinamica') && (!ids || ids.indexOf(p.id) >= 0); }); return estados(test.id).then(function (mapa) { if (esGitHubPages()) return rondaLocal(qs, mapa, cantidad, modo); return pedir('/ronda', { preguntas: qs.map(paraServidor), estados: mapa, cantidad: cantidad, modo: modo }); }); }
  function rondaLocal(qs, mapa, cantidad, modo) { var pregs = qs.map(function (p) { return { id: p.id, opciones: p.opciones, tema: p.tema || {} }; }); var r = armar_ronda(pregs.map(function(p) { return {id: p.id, opciones: p.opciones, tema: p.tema || {}}; }), {}, cantidad, modo, undefined, Date.now()); return Promise.resolve({ preguntas: r.preguntas.map(function(p, i) { return { id: p.id, orden: i }; }), resumen: {}, semilla: r.semilla }); }

  function esGitHubPages() { var h = window.location.hostname; return h.includes('github.io') || h.includes('github.dev'); }
  function pedir(ruta, cuerpo) { return fetch('/api/tests' + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(function (r) { if (r.ok) return r.json(); if (r.status === 404 || r.status === 405) { if (esGitHubPages()) throw new Error('Función no disponible en GitHub Pages (requiere servidor local).'); throw new Error('El servidor que está corriendo es más viejo que esta pantalla. Ciérralo y abre servidor.cmd otra vez.'); } return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || ('El servidor no pudo con esto (error ' + r.status + ').')); }); }).catch(function (e) { if (e instanceof TypeError) { if (esGitHubPages()) throw new Error('Función no disponible en GitHub Pages (requiere servidor local).'); throw new Error('No se pudo hablar con el servidor. ¿Está abierto?'); } throw e; }); }

  window.RetoTestsBanco = { cargar: cargar, guardar: guardar, guardarVarios: guardarVarios, borrar: borrar, ejemplos: ejemplos, estados: estados, intentos: intentos, registrarIntento: registrarIntento, registrarRespuesta: registrarRespuesta, resumenes: resumenes, ronda: ronda, jugable: jugable, cantidadJugable: function (test) { return test.preguntas.filter(function (p) { return p.tipo === 'estatica' || p.tipo === 'dinamica'; }).length; } };
})();