/* =========================================================================
   R.E.T.O. - Adaptador Firebase para reto-duelo.js
   -------------------------------------------------------------------------
   Intercepta las llamadas a /api/sala y las redirige a Firebase
   cuando se usa modo PvP online. Mantiene la misma API que reto-duelo.js espera.
   ========================================================================= */
(function (window) {
  'use strict';

  var firebase = window.RetoFirebase;
  var firebaseSync = window.RetoFirebaseSync;

  if (!firebase || !firebaseSync) {
    console.warn('[RetoDueloFirebase] Faltan RetoFirebase o RetoFirebaseSync');
  }

  var API = '/api/sala'; // Fallback a API local
  var _usandoFirebase = false;
  var _miCodigo = null;
  var _miToken = null;

  /* ===========================================================================
     DETECTAR MODO: si hay Firebase configurado y usuario quiere online -> Firebase
     =========================================================================== */
  function detectarModo() {
    return firebase.inicializar().then(function () {
      _usandoFirebase = true;
      console.log('[RetoDueloFirebase] Modo Firebase activado');
    }).catch(function () {
      _usandoFirebase = false;
      console.log('[RetoDueloFirebase] Modo API local (fallback)');
    });
  }

  /* ===========================================================================
     WRAPPER LLAMAR - usa Firebase si está activo, sino API local
     =========================================================================== */
  function llamar(metodo, ruta, cuerpo) {
    if (!_usandoFirebase) {
      return _llamarAPILocal(metodo, ruta, cuerpo);
    }

    // Ruteo a Firebase según endpoint
    if (ruta === '/crear' && metodo === 'POST') {
      return _crearSalaFirebase(cuerpo);
    }
    if (ruta === '/unirse' && metodo === 'POST') {
      return _unirseSalaFirebase(cuerpo);
    }
    if (ruta === '/configurar' && metodo === 'POST') {
      return _configurarFirebase(cuerpo);
    }
    if (ruta === '/test' && metodo === 'POST') {
      return _cargarTestFirebase(cuerpo);
    }
    if (ruta === '/equipo' && metodo === 'POST') {
      return _guardarEquipoFirebase(cuerpo);
    }
    if (ruta === '/empezar' && metodo === 'POST') {
      return _empezarFirebase(cuerpo);
    }
    if (ruta === '/accion' && metodo === 'POST') {
      return _accionFirebase(cuerpo);
    }
    if (ruta === '/estado' && metodo === 'GET') {
      return _estadoFirebase();
    }
    if (ruta === '/tarjeta' && metodo === 'POST') {
      return _tarjetaFirebase(cuerpo);
    }
    if (ruta === '/tarjeta/validar' && metodo === 'POST') {
      return _validarTarjetaFirebase(cuerpo);
    }
    if (ruta === '/premios' && metodo === 'POST') {
      return _premiosFirebase(cuerpo);
    }

    // Fallback a API local para endpoints no migrados
    return _llamarAPILocal(metodo, ruta, cuerpo);
  }

  /* ===========================================================================
     IMPLEMENTACIONES FIREBASE
     =========================================================================== */
  function _crearSalaFirebase(cuerpo) {
    var nombre = cuerpo.nombre || 'Jugador';
    var config = cuerpo.config || {};
    var tipo = 'duelo';

    return firebaseSync.crearSala(tipo, nombre, config)
      .then(function (res) {
        // Guardar sesión local para reto-duelo.js
        sessionStorage.setItem('duelo_sesion', JSON.stringify({ codigo: res.codigo, token: res.token }));
        return { codigo: res.codigo, token: res.token };
      });
  }

  function _unirseSalaFirebase(cuerpo) {
    var codigo = (cuerpo.codigo || '').toUpperCase();
    var nombre = cuerpo.nombre || 'Jugador';

    return firebaseSync.unirseSala(codigo, nombre)
      .then(function (res) {
        sessionStorage.setItem('duelo_sesion', JSON.stringify({ codigo: res.codigo, token: res.token }));
        return { codigo: res.codigo, token: res.token };
      });
  }

  function _configurarFirebase(cuerpo) {
    return firebaseSync.configurar(cuerpo.token, cuerpo.cambios || {})
      .then(function (config) { return { config: config }; });
  }

  function _cargarTestFirebase(cuerpo) {
    return firebaseSync.cargarTest(cuerpo.token, cuerpo.titulo, cuerpo.preguntas)
      .then(function () { return { ok: true }; });
  }

  function _guardarEquipoFirebase(cuerpo) {
    // El equipo se guarda en el perfil local, no en Firebase directamente
    // Se envía al crear/empezar la partida
    return Promise.resolve({ ok: true });
  }

  function _empezarFirebase(cuerpo) {
    return firebaseSync.empezar(cuerpo.token)
      .then(function () { return { ok: true }; });
  }

  function _accionFirebase(cuerpo) {
    var accion = cuerpo.tipo;
    var token = cuerpo.token;

    if (accion === 'power_up') {
      return firebaseSync.accionJugador(_miCodigo, token, { tipo: 'power_up', id: cuerpo.id });
    } else if (accion === 'responder') {
      return firebaseSync.accionJugador(_miCodigo, token, { tipo: 'responder', opcionId: cuerpo.opcion, milisegundos: cuerpo.milisegundos });
    } else if (accion === 'rendirse') {
      return firebaseSync.accionJugador(_miCodigo, token, { tipo: 'rendirse' });
    }
    return Promise.reject(new Error('Acción no soportada: ' + accion));
  }

  function _estadoFirebase() {
    if (!_miCodigo || !_miToken) return Promise.reject(new Error('Sin sesión'));

    var sala = window.RetoSalas && window.RetoSalas.obtenerSala(_miCodigo);
    if (sala) {
      return Promise.resolve(sala.obtenerVista(_miToken));
    }
    // Si no hay local, escuchar evento de actualización
    return new Promise(function (resolve) {
      var handler = function (e) {
        if (e.detail.codigo === _miCodigo) {
          window.removeEventListener('reto:sala-actualizada', handler);
          resolve(e.detail.vista);
        }
      };
      window.addEventListener('reto:sala-actualizada', handler);
      setTimeout(function () { window.removeEventListener('reto:sala-actualizada', handler); resolve(null); }, 5000);
    });
  }

  function _tarjetaFirebase(cuerpo) {
    // Crear tarjeta v2 - usa lógica local (RetoRpg)
    return window.RetoRpg && window.RetoRpg.crearTarjeta
      ? window.RetoRpg.crearTarjeta(cuerpo.nombre).then(function (t) { return { tarjeta: t }; })
      : Promise.reject(new Error('RetoRpg no disponible'));
  }

  function _validarTarjetaFirebase(cuerpo) {
    return window.RetoRpg && window.RetoRpg.leerTarjeta
      ? window.RetoRpg.leerTarjeta(cuerpo.tarjeta).then(function (p) { return { perfil: p }; })
      : Promise.reject(new Error('RetoRpg no disponible'));
  }

  function _premiosFirebase(cuerpo) {
    // Usar lógica local para calcular premios
    return window.RetoRpg && window.RetoRpg.premiarTest
      ? window.RetoRpg.premiarTest(cuerpo.aciertos_antes, cuerpo.aciertos, cuerpo.entregados_antes, cuerpo.entregados_hoy)
        .then(function (r) { return { premios: r.premios, bloqueados: r.bloqueados, cupo: r.cupo }; })
      : Promise.reject(new Error('RetoRpg no disponible'));
  }

  /* ===========================================================================
     FALLBACK API LOCAL
     =========================================================================== */
  function _llamarAPILocal(metodo, ruta, cuerpo) {
    var opts = { method: metodo, headers: { 'Content-Type': 'application/json' } };
    if (cuerpo) opts.body = JSON.stringify(cuerpo);
    return fetch(API + ruta, opts).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) { var e = new Error((d && d.error) || 'No se pudo.'); e.http = r.status; throw e; }
        return d;
      });
    }, function () { throw new Error('No hay conexión con la computadora anfitriona.'); });
  }

  /* ===========================================================================
     INICIALIZACIÓN
     =========================================================================== */
  function init() {
    // Detectar modo al cargar
    detectarModo();

    // Restaurar sesión si existe
    var guardada = sessionStorage.getItem('duelo_sesion');
    if (guardada) {
      try {
        var s = JSON.parse(guardada);
        _miCodigo = s.codigo;
        _miToken = s.token;
      } catch (e) {}
    }
  }

  // Escuchar actualizaciones de sala
  window.addEventListener('reto:sala-actualizada', function (e) {
    if (e.detail.codigo === _miCodigo) {
      // Disparar evento personalizado para que reto-duelo.js se entere
      window.dispatchEvent(new CustomEvent('duelo:vista-actualizada', { detail: e.detail.vista }));
    }
  });

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ===========================================================================
     EXPORT (mismo API que reto-duelo.js espera)
     =========================================================================== */
  window.RetoDueloAPI = {
    llamar: llamar,
    detectarModo: detectarModo,
    isFirebase: function () { return _usandoFirebase; },
    getCodigo: function () { return _miCodigo; },
    getToken: function () { return _miToken; },
    setCodigo: function (c) { _miCodigo = c; },
    setToken: function (t) { _miToken = t; }
  };

})(window);