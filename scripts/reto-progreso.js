/* =========================================================================
   R.E.T.O. - El registro de progreso de la lectura
   -------------------------------------------------------------------------
   Es lo que contestaba el documento de modulos de lectura veloz como "el
   sistema de progreso": window.RetoProgreso.registrarSesion({...}).

   DONDE VIVE
   En RetoDatos (IndexedDB), como el banco de tests: por eso entra SOLO en el
   respaldo de Configuracion -> Datos, sin hacer nada especial aqui. Son dos
   listas, cada una en una clave de "preferencias":

     lectura-sesiones      [{ fecha, tipo, motor, ejercicio, minutos, palabras }]
                           tipo 'lectura' (con motor) o 'vision' (con ejercicio)
                           cada vez que la persona leyo un rato (la lectura SI
                           cuenta para el nivel de practica: regla acordada)
     lectura-mediciones    [{ id, fecha, textoId, palabras, segundos, aciertos,
                              preguntas, ppm_brutas, ppm_efectivas }]
                           las de la prueba de velocidad base

   LA SESION MINIMA ES DE UN MINUTO: entrar y salir no suma. Las listas tienen
   un tope (las mas viejas se descartan) para que no crezcan sin fin.

   LAS ESCRITURAS VAN EN FILA, igual que en el banco de tests: dos registros
   seguidos leen y escriben la misma lista, y sin la fila el segundo pisaria
   al primero.
   ========================================================================= */
(function () {
  'use strict';

  var CLAVE_SESIONES = 'lectura-sesiones';
  var CLAVE_MEDICIONES = 'lectura-mediciones';
  var MAX_SESIONES = 500;
  var MAX_MEDICIONES = 300;
  var MINUTOS_MINIMOS = 1;
  var PREGUNTAS_MINIMAS = 3;

  var fila = Promise.resolve();

  function encolar(fn) {
    var p = fila.then(fn, fn);
    fila = p.catch(function () {});
    return p;
  }

  function datos() { return window.RetoDatos || null; }

  function leerLista(clave) {
    if (!datos()) return Promise.resolve([]);
    return datos().obtener(clave)
      .then(function (v) { return Array.isArray(v) ? v : []; })
      .catch(function () { return []; });
  }

  function agregar(clave, item, max) {
    return encolar(function () {
      if (!datos()) return Promise.resolve(false);
      return leerLista(clave).then(function (lista) {
        lista.push(item);
        if (lista.length > max) lista = lista.slice(lista.length - max);
        return datos().poner(clave, lista);
      }).then(function () { return true; });
    });
  }

  function redondear(n, d) {
    var m = Math.pow(10, d);
    return Math.round(n * m) / m;
  }

  /* { tipo: 'lectura', motor, minutos, palabras }. Con menos de un minuto no se
     guarda nada y la promesa dice por que (registrada: false). */
  function registrarSesion(s) {
    s = s || {};
    var minutos = Number(s.minutos) || 0;
    var preguntas = Math.max(0, Math.round(Number(s.preguntas) || 0));
    // Tests y RPG tambien cuentan por preguntas: 3 contestadas bastan aunque la
    // sesion dure menos de un minuto (misma regla que logica/rpg.py).
    var porPreguntas = (s.tipo === 'rpg' || s.tipo === 'test') && preguntas >= PREGUNTAS_MINIMAS;
    if (!(minutos >= MINUTOS_MINIMOS) && !porPreguntas) {
      return Promise.resolve({ registrada: false, motivo: 'sesion muy corta' });
    }
    return agregar(CLAVE_SESIONES, {
      fecha: new Date().toISOString(),
      tipo: String(s.tipo || 'lectura'),
      motor: String(s.motor || ''),
      ejercicio: String(s.ejercicio || ''),
      minutos: redondear(minutos, 1),
      palabras: Math.max(0, Math.round(Number(s.palabras) || 0)),
      rondas: Math.max(0, Math.round(Number(s.rondas) || 0)),
      preguntas: preguntas
    }, MAX_SESIONES).then(function (ok) {
      if (ok && window.RetoPerfil && window.RetoPerfil.sumarTiempo) {
        var modulo = s.tipo;
        var submodulo = s.motor || s.ejercicio || '';
        if (modulo === 'lectura' || modulo === 'vision' || modulo === 'minijuegos') {
          window.RetoPerfil.sumarTiempo(modulo, submodulo, minutos);
        } else if (modulo === 'rpg') {
          window.RetoPerfil.sumarTiempo('rpg', submodulo || 'pve', minutos);
        } else if (modulo === 'duelo') {
          window.RetoPerfil.sumarTiempo('duelo', '', minutos);
        }
      }
      return { registrada: ok };
    });
  }

  function guardarMedicion(m) {
    var item = {
      id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      fecha: new Date().toISOString(),
      textoId: m.textoId || '',
      palabras: m.palabras,
      segundos: redondear(m.segundos, 1),
      aciertos: m.aciertos,
      preguntas: m.preguntas,
      ppm_brutas: m.ppm_brutas,
      ppm_efectivas: m.ppm_efectivas
    };
    return agregar(CLAVE_MEDICIONES, item, MAX_MEDICIONES).then(function () { return item; });
  }

  window.RetoProgreso = {
    registrarSesion: registrarSesion,
    sesiones: function () { return leerLista(CLAVE_SESIONES); },
    mediciones: {
      guardar: guardarMedicion,
      /* De las mas viejas a las mas nuevas. */
      listar: function () { return leerLista(CLAVE_MEDICIONES); }
    }
  };
})();
