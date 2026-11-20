/* =========================================================================
   R.E.T.O. - Configuración Firebase (gratis, fácil de mantener)
   -------------------------------------------------------------------------
   Usa Firebase Realtime Database (plan Spark: 1GB, 100 conexiones simultáneas).
   Solo necesitas crear un proyecto en console.firebase.google.com y copiar
   la configuración aquí.
   ========================================================================= */
(function (window) {
  'use strict';

  // ===========================================================================
  // CONFIGURACIÓN - Edita estos valores con los de tu proyecto Firebase
  // ===========================================================================
  var FIREBASE_CONFIG = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com",
    projectId: "TU_PROYECTO",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID"
  };

  // Nombres de rutas en la base de datos
  var RUTAS = {
    salas: 'salas',           // /salas/{codigo}/
    presencia: 'presencia',   // /presencia/{codigo}/{uid}/
    colas: 'colas',           // /colas/duelo/, /colas/ding/
    stats: 'stats'            // /stats/{uid}/
  };

  // ===========================================================================
  // INICIALIZACIÓN
  // ===========================================================================
  var firebaseApp = null;
  var database = null;
  var auth = null;
  var inicializado = false;

  function inicializar() {
    if (inicializado) return Promise.resolve();

    if (!window.firebase) {
      return Promise.reject(new Error('Firebase SDK no cargado. Añade el script en index.html'));
    }

    try {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      database = firebaseApp.database();
      auth = firebaseApp.auth();

      // Auth anónimo automático
      return auth.signInAnonymously().then(function () {
        inicializado = true;
        console.log('[RetoFirebase] Inicializado correctamente');
      });
    } catch (e) {
      return Promise.reject(new Error('Error inicializando Firebase: ' + e.message));
    }
  }

  function getDatabase() {
    if (!inicializado) throw new Error('Firebase no inicializado. Llama a inicializar() primero.');
    return database;
  }

  function getAuth() {
    if (!inicializado) throw new Error('Firebase no inicializado.');
    return auth;
  }

  function getUid() {
    var user = auth.currentUser;
    return user ? user.uid : null;
  }

  // ===========================================================================
  // UTILIDADES DE BASE DE DATOS
  // ===========================================================================
  function ref(path) {
    return getDatabase().ref(path);
  }

  function setData(path, data) {
    return ref(path).set(data);
  }

  function pushData(path, data) {
    return ref(path).push(data);
  }

  function updateData(path, data) {
    return ref(path).update(data);
  }

  function removeData(path) {
    return ref(path).remove();
  }

  function getData(path) {
    return ref(path).once('value').then(function (snapshot) {
      return snapshot.val();
    });
  }

  function onValue(path, callback) {
    var r = ref(path);
    r.on('value', function (snapshot) {
      callback(snapshot.val());
    });
    return function () { r.off('value'); };
  }

  function onChildAdded(path, callback) {
    var r = ref(path);
    r.on('child_added', function (snapshot) {
      callback(snapshot.key, snapshot.val());
    });
    return function () { r.off('child_added'); };
  }

  function onChildRemoved(path, callback) {
    var r = ref(path);
    r.on('child_removed', function (snapshot) {
      callback(snapshot.key, snapshot.val());
    });
    return function () { r.off('child_removed'); };
  }

  function onChildChanged(path, callback) {
    var r = ref(path);
    r.on('child_changed', function (snapshot) {
      callback(snapshot.key, snapshot.val());
    });
    return function () { r.off('child_changed'); };
  }

  function off(path) {
    ref(path).off();
  }

  // Transacción atómica (para contadores, colas, etc.)
  function transaction(path, updater) {
    return ref(path).transaction(updater);
  }

  // ===========================================================================
  // PRESENCIA (detectar desconexión automáticamente)
  // ===========================================================================
  function setupPresencia(codigo, datosExtra) {
    var uid = getUid();
    if (!uid) return Promise.reject(new Error('No hay usuario autenticado'));

    var presenciaRef = ref(RUTAS.presencia + '/' + codigo + '/' + uid);
    var connectedRef = ref('.info/connected');

    return connectedRef.on('value', function (snap) {
      if (snap.val() === true) {
        // Online: escribir presencia con timestamp
        presenciaRef.onDisconnect().remove();
        presenciaRef.set(Object.assign({
          uid: uid,
          conectado: true,
          timestamp: firebase.database.ServerValue.TIMESTAMP
        }, datosExtra || {}));
      }
    });
  }

  function removePresencia(codigo) {
    var uid = getUid();
    if (!uid) return Promise.resolve();
    return ref(RUTAS.presencia + '/' + codigo + '/' + uid).remove();
  }

  // ===========================================================================
  // EXPORT
  // ===========================================================================
  window.RetoFirebase = {
    config: FIREBASE_CONFIG,
    RUTAS: RUTAS,
    inicializar: inicializar,
    getDatabase: getDatabase,
    getAuth: getAuth,
    getUid: getUid,
    ref: ref,
    setData: setData,
    pushData: pushData,
    updateData: updateData,
    removeData: removeData,
    getData: getData,
    onValue: onValue,
    onChildAdded: onChildAdded,
    onChildRemoved: onChildRemoved,
    onChildChanged: onChildChanged,
    off: off,
    transaction: transaction,
    setupPresencia: setupPresencia,
    removePresencia: removePresencia,

    // Helpers para rutas comunes
    salaRef: function (codigo) { return ref(RUTAS.salas + '/' + codigo.toUpperCase()); },
    colaRef: function (tipo) { return ref(RUTAS.colas + '/' + tipo); },
    statsRef: function (uid) { return ref(RUTAS.stats + '/' + uid); }
  };

})(window);