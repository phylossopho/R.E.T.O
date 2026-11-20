/* =========================================================================
   R.E.T.O. - Adaptador Firebase para reto-ding.js
   -------------------------------------------------------------------------
   Intercepta las llamadas a /api/ding y las redirige a Firebase
   cuando se usa modo Ding! online.
   ========================================================================= */
(function (window) {
  'use strict';

  var firebase = window.RetoFirebase;
  var firebaseSync = window.RetoFirebaseSync;

  if (!firebase || !firebaseSync) {
    console.warn('[RetoDingFirebase] Faltan RetoFirebase o RetoFirebaseSync');
  }

  var API = '/api/ding'; // Fallback a API local
  var _usandoFirebase = false;
  var _miCodigo = null;
  var _miToken = null;

  /* ===========================================================================
     DETECTAR MODO
     =========================================================================== */
  function detectarModo() {
    // Verificar si Firebase está disponible y configurado
    if (!window.RetoFirebase || !window.RetoFirebase.esConfigValida()) {
      _usandoFirebase = false;
      console.log('[RetoDingFirebase] Modo P2P local (Firebase no configurado)');
      return Promise.resolve();
    }

    return firebase.inicializar().then(function () {
      _usandoFirebase = true;
      console.log('[RetoDingFirebase] Modo Firebase activado');
    }).catch(function () {
      _usandoFirebase = false;
      console.log('[RetoDingFirebase] Modo P2P local (fallback)');
    });
  }

  /* ===========================================================================
     WRAPPER LLAMAR
     =========================================================================== */
  function llamar(metodo, ruta, cuerpo) {
    if (!_usandoFirebase) {
      return _llamarAPILocal(metodo, ruta, cuerpo);
    }

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
    if (ruta === '/accion' && metodo === 'POST') {
      return _accionFirebase(cuerpo);
    }
    if (ruta === '/estado' && metodo === 'GET') {
      return _estadoFirebase();
    }

    return _llamarAPILocal(metodo, ruta, cuerpo);
  }

  /* ===========================================================================
     IMPLEMENTACIONES FIREBASE (Ding)
     =========================================================================== */
  function _crearSalaFirebase(cuerpo) {
    var nombre = cuerpo.nombre || 'Presentador';
    var config = cuerpo.config || {};

    return firebaseSync.crearSala('ding', nombre, config)
      .then(function (res) {
        sessionStorage.setItem('ding_sesion', JSON.stringify({ codigo: res.codigo, token: res.token }));
        return { codigo: res.codigo, token: res.token, rol: res.rol };
      });
  }

  function _unirseSalaFirebase(cuerpo) {
    var codigo = (cuerpo.codigo || '').toUpperCase();
    var nombre = cuerpo.nombre || 'Jugador';

    return firebaseSync.unirseSala(codigo, nombre)
      .then(function (res) {
        sessionStorage.setItem('ding_sesion', JSON.stringify({ codigo: res.codigo, token: res.token }));
        return { codigo: res.codigo, token: res.token, rol: res.rol };
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

  function _accionFirebase(cuerpo) {
    var token = cuerpo.token;
    var accion = cuerpo.tipo;

    if (accion === 'responder') {
      return firebaseSync.accionJugador(_miCodigo, token, { tipo: 'responder', opcionId: cuerpo.opcion });
    } else if (accion === 'empezar') {
      return firebaseSync.empezar(token);
    } else if (accion === 'siguiente') {
      return firebaseSync.accionPresentador(_miCodigo, token, { tipo: 'siguiente' });
    } else if (accion === 'terminar') {
      return firebaseSync.accionPresentador(_miCodigo, token, { tipo: 'terminar' });
    }
    return Promise.reject(new Error('Acción no soportada: ' + accion));
  }

  function _estadoFirebase() {
    if (!_miCodigo || !_miToken) return Promise.reject(new Error('Sin sesión'));

    var sala = window.RetoSalas && window.RetoSalas.obtenerSala(_miCodigo);
    if (sala) {
      return Promise.resolve(sala.obtenerVista(_miToken));
    }
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
    detectarModo();

    var guardada = sessionStorage.getItem('ding_sesion');
    if (guardada) {
      try {
        var s = JSON.parse(guardada);
        _miCodigo = s.codigo;
        _miToken = s.token;
      } catch (e) {}
    }
  }

  window.addEventListener('reto:sala-actualizada', function (e) {
    if (e.detail.codigo === _miCodigo) {
      window.dispatchEvent(new CustomEvent('ding:vista-actualizada', { detail: e.detail.vista }));
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.RetoDingAPI = {
    llamar: llamar,
    detectarModo: detectarModo,
    isFirebase: function () { return _usandoFirebase; },
    getCodigo: function () { return _miCodigo; },
    getToken: function () { return _miToken; },
    setCodigo: function (c) { _miCodigo = c; },
    setToken: function (t) { _miToken = t; }
  };

})(window);