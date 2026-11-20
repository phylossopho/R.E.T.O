/* =========================================================================
   R.E.T.O. - Capa de sincronización Firebase para salas multijugador
   -------------------------------------------------------------------------
   Conecta RetoSalas (lógica local) con Firebase Realtime Database.
   Maneja: crear/unirse, presencia, listeners, reconexión.
   ========================================================================= */
(function (window) {
  'use strict';

  var firebase = window.RetoFirebase;
  var salas = window.RetoSalas;

  if (!firebase || !salas) {
    console.warn('[RetoFirebaseSync] Faltan RetoFirebase o RetoSalas');
  }

  var _listeners = {};
  var _miCodigo = null;
  var _miToken = null;
  var _miRol = null;
  var _uid = null;

  /* ===========================================================================
     CREAR SALA EN FIREBASE
     =========================================================================== */
  function crearSalaEnFirebase(tipo, creadorNombre, config) {
    return firebase.inicializar().then(function () {
      _uid = firebase.getUid();
      var salaLocal = salas.crearSala(tipo, creadorNombre);
      _miCodigo = salaLocal.codigo;
      _miToken = salaLocal.token;
      _miRol = 'pres';

      // Preparar datos para Firebase
      var datos = salaLocal.sala;
      var firebaseData = {
        codigo: _miCodigo,
        tipo: tipo,
        fase: datos.fase,
        version: datos.version,
        actividad: datos.actividad,
        config: datos.config,
        titulo: datos.titulo,
        presentador: {
          nombre: datos.presentador.nombre,
          token: datos.presentador.token,
          visto: datos.presentador.visto
        },
        jugadores: {},
        fuente: datos.fuente,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      };

      // Guardar en /salas/{codigo}
      return firebase.setData(firebase.RUTAS.salas + '/' + _miCodigo, firebaseData)
        .then(function () {
          // Configurar presencia del presentador
          return firebase.setupPresencia(_miCodigo, { rol: 'pres', nombre: datos.presentador.nombre });
        })
        .then(function () {
          // Escuchar cambios remotos
          _escucharSala(_miCodigo);
          return { codigo: _miCodigo, token: _miToken, rol: 'pres' };
        });
    });
  }

  /* ===========================================================================
     UNIRSE A SALA EN FIREBASE
     =========================================================================== */
  function unirseSalaEnFirebase(codigo, nombre) {
    codigo = codigo.toUpperCase();
    return firebase.inicializar().then(function () {
      _uid = firebase.getUid();

      // Verificar que la sala existe
      return firebase.getData(firebase.RUTAS.salas + '/' + codigo)
        .then(function (data) {
          if (!data) throw new Error('Sala no existe.');
          if (data.fase !== 'espera') throw new Error('La partida ya empezó.');
          if (Object.keys(data.jugadores || {}).length >= salas.MAX_JUGADORES)
            throw new Error('Sala llena.');

          // Unirse localmente
          var salaLocal = salas.obtenerSala(codigo);
          if (!salaLocal) {
            // Crear instancia local desde datos de Firebase
            salaLocal = _crearSalaDesdeFirebase(data);
            salas._salas[codigo] = salaLocal; // acceso interno
          }

          var token = generarToken();
          var res = salaLocal.unirse(nombre, token);
          _miCodigo = codigo;
          _miToken = res.token;
          _miRol = res.yo;

          // Actualizar Firebase: añadir jugador
          var jugadorData = salaLocal.jugadores[_miRol];
          var updates = {};
          updates['jugadores/' + _miRol] = {
            nombre: jugadorData.nombre,
            token: jugadorData.token,
            puntos: 0, aciertos: 0, fallos: 0,
            visto: firebase.database.ServerValue.TIMESTAMP
          };
          updates['updatedAt'] = firebase.database.ServerValue.TIMESTAMP;

          return firebase.updateData(firebase.RUTAS.salas + '/' + codigo, updates)
            .then(function () {
              // Configurar presencia
              return firebase.setupPresencia(codigo, { rol: _miRol, nombre: jugadorData.nombre });
            })
            .then(function () {
              _escucharSala(codigo);
              return { codigo: codigo, token: _miToken, rol: _miRol };
            });
        });
    });
  }

  /* ===========================================================================
     ESCUCHAR CAMBIOS EN TIEMPO REAL
     =========================================================================== */
  function _escucharSala(codigo) {
    if (_listeners[codigo]) return; // Ya escuchando

    var salaRef = firebase.ref(firebase.RUTAS.salas + '/' + codigo);
    var offFn = salaRef.on('value', function (snapshot) {
      var data = snapshot.val();
      if (!data) {
        _limpiarListener(codigo);
        return;
      }
      _aplicarCambiosRemotos(codigo, data);
    });
    _listeners[codigo] = offFn;
  }

  function _limpiarListener(codigo) {
    if (_listeners[codigo]) {
      _listeners[codigo]();
      delete _listeners[codigo];
    }
  }

  function _aplicarCambiosRemotos(codigo, data) {
    var salaLocal = salas.obtenerSala(codigo);
    if (!salaLocal) {
      salaLocal = _crearSalaDesdeFirebase(data);
      salas._salas[codigo] = salaLocal;
    }

    // Detectar qué cambió y actualizar localmente
    // Solo actualizar campos que vengan del servidor
    if (data.fase) salaLocal.fase = data.fase;
    if (data.version) salaLocal.version = data.version;
    if (data.config) salaLocal.config = data.config;
    if (data.titulo) salaLocal.titulo = data.titulo;
    if (data.actividad) salaLocal.actividad = data.actividad;

    // Jugadores: mergear (nuevos llegan del servidor)
    if (data.jugadores) {
      Object.keys(data.jugadores).forEach(function (jid) {
        var remoto = data.jugadores[jid];
        if (!salaLocal.jugadores[jid]) {
          salaLocal.jugadores[jid] = {
            nombre: remoto.nombre,
            token: remoto.token,
            puntos: remoto.puntos || 0,
            aciertos: remoto.aciertos || 0,
            fallos: remoto.fallos || 0,
            visto: remoto.visto || Date.now()
          };
        } else {
          // Actualizar campos que solo el servidor maneja (puntos, aciertos, fallos)
          salaLocal.jugadores[jid].puntos = remoto.puntos || 0;
          salaLocal.jugadores[jid].aciertos = remoto.aciertos || 0;
          salaLocal.jugadores[jid].fallos = remoto.fallos || 0;
          if (remoto.visto) salaLocal.jugadores[jid].visto = remoto.visto;
        }
      });
    }

    // Datos específicos del tipo
    if (data.tipo === 'duelo') {
      _aplicarDueloRemoto(salaLocal, data);
    } else if (data.tipo === 'ding') {
      _aplicarDingRemoto(salaLocal, data);
    }

    // Disparar evento para que la UI se actualice
    window.dispatchEvent(new CustomEvent('reto:sala-actualizada', {
      detail: { codigo: codigo, vista: salaLocal.obtenerVista(_miToken || '') }
    }));
  }

  function _aplicarDueloRemoto(sala, data) {
    if (data.turno) sala.turno = data.turno;
    if (data.atacante) sala.atacante = data.atacante;
    if (data.ganador) sala.ganador = data.ganador;
    if (data.motivo) sala.motivo = data.motivo;
    if (data.pv1 !== undefined) sala.pv1 = data.pv1;
    if (data.pv2 !== undefined) sala.pv2 = data.pv2;
    if (data.pv_max1) sala.pv_max1 = data.pv_max1;
    if (data.pv_max2) sala.pv_max2 = data.pv_max2;
    if (data.pregunta) sala.pregunta = data.pregunta;
    if (data.ganador) sala.ganador = data.ganador;
    if (data.motivo) sala.motivo = data.motivo;
    // Usados, efectos, aciertos, fallos se sincronizan vía jugadores
  }

  function _aplicarDingRemoto(sala, data) {
    if (data.indice !== undefined) sala.indice = data.indice;
    if (data.secuencia) sala.secuencia = data.secuencia;
    if (data.actual) sala.actual = data.actual;
    if (data.t_inicio) sala.t_inicio = data.t_inicio;
    if (data.t_opciones) sala.t_opciones = data.t_opciones;
    if (data.t_limite) sala.t_limite = data.t_limite;
    if (data.t_resuelta) sala.t_resuelta = data.t_resuelta;
    if (data.fallaron) sala.fallaron = data.fallaron;
    if (data.resultado) sala.resultado = data.resultado;
    if (data.inicio) sala.inicio = data.inicio;
    if (data.final) sala.final = data.final;
  }

  /* ===========================================================================
     HELPERS
     =========================================================================== */
  function _crearSalaDesdeFirebase(data) {
    var SalaClass = data.tipo === 'duelo' ? window.RetoSalas.SalaDuelo : window.RetoSalas.SalaDing;
    var sala = Object.create(SalaClass.prototype);
    Object.assign(sala, data);
    // Asegurar que jugadores sea objeto con tokens
    if (!sala.jugadores) sala.jugadores = {};
    if (!sala.config) sala.config = {};
    if (!sala.presentador) sala.presentador = {};
    if (!sala.jugadores) sala.jugadores = {};
    return sala;
  }

  function generarToken() {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /* ===========================================================================
     ACCIONES QUE ESCRIBEN EN FIREBASE (llaman a lógica local + sync)
     =========================================================================== */

  // Configurar sala (presentador)
  function configurarSalaFirebase(codigo, token, cambios) {
    var sala = salas.obtenerSala(codigo);
    if (!sala) throw new Error('Sala no encontrada localmente.');

    // Ejecutar lógica local
    sala.configurar(token, cambios);

    // Escribir a Firebase (solo presentador)
    return firebase.updateData(firebase.RUTAS.salas + '/' + codigo, {
      config: sala.config,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  // Cargar test (presentador)
  function cargarTestFirebase(codigo, token, titulo, preguntas) {
    var sala = salas.obtenerSala(codigo);
    if (!sala) throw new Error('Sala no encontrada localmente.');

    sala.cargarFuente(token, titulo, preguntas);

    return firebase.updateData(firebase.RUTAS.salas + '/' + codigo, {
      fuente: sala.fuente,
      titulo: sala.titulo,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  // Empezar partida (presentador)
  function empezarPartidaFirebase(codigo, token) {
    var sala = salas.obtenerSala(codigo);
    if (!sala) throw new Error('Sala no encontrada.');

    sala.empezar(token);

    var updates = {
      fase: sala.fase,
      version: sala.version,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    if (sala.tipo === 'duelo') {
      updates.turno = sala.turno;
      updates.atacante = sala.atacante;
      updates.pregunta = sala.pregunta;
      updates.pv1 = sala.pv1; updates.pv_max1 = sala.pv_max1;
      updates.pv2 = sala.pv2; updates.pv_max2 = sala.pv_max2;
    } else if (sala.tipo === 'ding') {
      updates.indice = sala.indice;
      updates.secuencia = sala.secuencia;
      updates.actual = sala.actual;
      updates.t_inicio = sala.t_inicio;
      updates.t_opciones = sala.t_opciones;
      updates.t_limite = sala.t_limite;
      updates.inicio = sala.inicio;
    }

    updates.fase = sala.fase;
    updates.version = sala.version;
    updates.updatedAt = firebase.database.ServerValue.TIMESTAMP;

    return firebase.updateData(firebase.RUTAS.salas + '/' + _miCodigo, updates);
  }

  // Acción de jugador (responder, power-up, etc.)
  function accionJugadorFirebase(codigo, token, accion) {
    var sala = salas.obtenerSala(codigo);
    if (!sala) throw new Error('Sala no encontrada.');

    // Ejecutar lógica local
    var vista;
    if (sala.tipo === 'duelo') {
      vista = sala.responder(token, accion.opcionId);
    } else if (sala.tipo === 'ding') {
      vista = sala.responder(token, accion.opcionId);
    }

    // Preparar updates para Firebase
    var updates = {
      fase: sala.fase,
      version: sala.version,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    // Sincronizar jugadores (puntos, aciertos, fallos)
    Object.keys(sala.jugadores).forEach(function (jid) {
      var j = sala.jugadores[jid];
      updates['jugadores/' + jid + '/puntos'] = j.puntos;
      updates['jugadores/' + jid + '/aciertos'] = j.aciertos;
      updates['jugadores/' + jid + '/fallos'] = j.fallos;
    });

    // Datos específicos
    if (sala.tipo === 'duelo') {
      updates.turno = sala.turno;
      updates.atacante = sala.atacante;
      updates.pregunta = sala.pregunta;
      updates.ganador = sala.ganador;
      updates.motivo = sala.motivo;
      updates.pv1 = sala.pv1; updates.pv_max1 = sala.pv_max1;
      updates.pv2 = sala.pv2; updates.pv_max2 = sala.pv_max2;
    } else if (sala.tipo === 'ding') {
      updates.fase = sala.fase;
      updates.indice = sala.indice;
      updates.actual = sala.actual;
      updates.t_opciones = sala.t_opciones;
      updates.t_limite = sala.t_limite;
      updates.fallaron = sala.fallaron;
      updates.resultado = sala.resultado;
      updates.t_resuelta = sala.t_resuelta;
      if (sala.final) updates.final = sala.final;
    }

    updates.version = sala.version;
    updates.updatedAt = firebase.database.ServerValue.TIMESTAMP;

    return firebase.updateData(firebase.RUTAS.salas + '/' + _miCodigo, updates)
      .then(function () { return sala.obtenerVista(_miToken); });
  }

  // Presentador: siguiente pregunta (Ding) / terminar
  function accionPresentadorFirebase(codigo, token, accion) {
    var sala = salas.obtenerSala(codigo);
    if (!sala) throw new Error('Sala no encontrada.');

    if (accion.tipo === 'siguiente' && sala.tipo === 'ding') {
      sala.siguiente(token);
    } else if (accion.tipo === 'terminar') {
      sala.terminar(token);
    }

    var updates = {
      fase: sala.fase,
      version: sala.version,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    if (sala.tipo === 'ding') {
      updates.indice = sala.indice;
      updates.actual = sala.actual;
      updates.t_inicio = sala.t_inicio;
      updates.t_opciones = sala.t_opciones;
      updates.t_limite = sala.t_limite;
      updates.fallaron = sala.fallaron;
      updates.resultado = sala.resultado;
      updates.t_resuelta = sala.t_resuelta;
      if (sala.final) updates.final = sala.final;
    }

    updates.fase = sala.fase;
    updates.version = sala.version;
    updates.updatedAt = firebase.database.ServerValue.TIMESTAMP;

    return firebase.updateData(firebase.RUTAS.salas + '/' + _miCodigo, updates);
  }

  // Salir de sala
  function salirSalaFirebase(codigo) {
    if (_miCodigo === codigo) {
      _miCodigo = null; _miToken = null; _miRol = null;
    }
    // Limpiar listeners
    if (_listeners[codigo]) {
      _listeners[codigo]();
      delete _listeners[codigo];
    }
    // Limpiar presencia
    return firebase.removePresencia(codigo);
  }

  /* ===========================================================================
     GETTERS DE ESTADO
     =========================================================================== */
  function getMiCodigo() { return _miCodigo; }
  function getMiToken() { return _miToken; }
  function getMiRol() { return _miRol; }
  function getMiUid() { return _uid; }

  /* ===========================================================================
     EXPORT
     =========================================================================== */
  window.RetoFirebaseSync = {
    crearSala: crearSalaEnFirebase,
    unirseSala: unirseSalaEnFirebase,
    configurar: configurarSalaFirebase,
    cargarTest: cargarTestFirebase,
    empezar: empezarPartidaFirebase,
    accionJugador: accionJugadorFirebase,
    accionPresentador: accionPresentadorFirebase,
    salir: salirSalaFirebase,
    getMiCodigo: getMiCodigo,
    getMiToken: getMiToken,
    getMiRol: getMiRol,
    getMiUid: getMiUid
  };

})(window);