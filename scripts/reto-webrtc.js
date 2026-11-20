/* =========================================================================
   R.E.T.O. - Cliente WebRTC P2P (reto-webrtc.js)
   -------------------------------------------------------------------------
   Conexión directa entre navegadores (P2P) vía WebRTC DataChannels.
   Usa servidor de señalización (Cloudflare Worker) solo para handshake inicial.
   Funciona en misma red (LAN) o a través de internet (STUN/TURN).
   ========================================================================= */
(function (window) {
  'use strict';

  /* ===========================================================================
     CONFIGURACIÓN
     =========================================================================== */
  var CONFIG = {
    // Servidor de señalización (Cloudflare Worker)
    signalingUrl: 'https://reto-signaling.reto-phylossopho.workers.dev', // CAMBIAR al deployar

    // STUN servers (gratis, públicos)
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
      // Para TURN (requerido en algunas redes): añade { urls: 'turn:...', username: '', credential: '' }
    ],

    // Timeouts
    offerTimeout: 15000,      // ms para esperar respuesta a oferta
    iceTimeout: 10000,        // ms para recopilar ICE
    reconnectInterval: 3000,  // ms entre reintentos
    maxReconnects: 5,

    // DataChannel
    channelLabel: 'reto-p2p',
    channelOptions: { ordered: true, maxRetransmits: 0 } // confiable, ordenado
  };

  /* ===========================================================================
     ESTADO
     =========================================================================== */
  var miId = null;                    // Mi ID único (UUID corto)
  var miCodigo = null;                // Código de sala (4 letras)
  var miRol = null;                   // 'creador' | 'unido'
  var peerConnections = {};           // { peerId: RTCPeerConnection }
  var dataChannels = {};              // { peerId: RTCDataChannel }
  var callbacks = {};                 // { evento: [callback] }
  var pollingTimers = {};             // { peerId: timerId }
  var reconnectCounts = {};           // { peerId: count }
  var salaEstado = 'desconectado';    // 'desconectado' | 'conectando' | 'conectado' | 'error'

  /* ===========================================================================
     UTILIDADES
     =========================================================================== */
  function generarId() {
    return 'p' + Math.random().toString(36).substr(2, 9);
  }

  function log() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[RetoWebRTC]');
    console.log.apply(console, args);
  }

  function emitir(evento, data) {
    (callbacks[evento] || []).forEach(function (cb) {
      try { cb(data); } catch (e) { log('Error en callback', evento, e); }
    });
  }

  function on(evento, callback) {
    callbacks[evento] = callbacks[evento] || [];
    callbacks[evento].push(callback);
    return function () { off(evento, callback); };
  }

  function off(evento, callback) {
    if (!callbacks[evento]) return;
    callbacks[evento] = callbacks[evento].filter(function (cb) { return cb !== callback; });
  }

  /* ===========================================================================
     SEÑALIZACIÓN HTTP (Cloudflare Worker)
     =========================================================================== */
  function _fetchJson(url, body) {
    return fetch(CONFIG.signalingUrl + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function enviarOferta(codigo, de, para, oferta) {
    return _fetchJson('/api/senal/oferta', { codigo, de, para, oferta });
  }

  function enviarRespuesta(codigo, de, para, respuesta) {
    return _fetchJson('/api/senal/respuesta', { codigo, de, para, respuesta });
  }

  function enviarIce(codigo, de, para, candidate) {
    return _fetchJson('/api/senal/ice', { codigo, de, para, candidate });
  }

  function pollSenal(codigo, de, para, tipo) {
    return _fetchJson('/api/senal/poll', { codigo, de, para, tipo });
  }

  /* ===========================================================================
     CREAR CONEXIÓN PEER
     =========================================================================== */
  function crearPeerConnection(peerId, esIniciador) {
    if (peerConnections[peerId]) {
      peerConnections[peerId].close();
    }

    var pc = new RTCPeerConnection({ iceServers: CONFIG.iceServers });
    peerConnections[peerId] = pc;

    // ICE Candidate local -> enviar al otro
    pc.onicecandidate = function (e) {
      if (e.candidate) {
        log('ICE candidate local para', peerId, e.candidate.candidate);
        enviarIce(miCodigo, miId, peerId, e.candidate.toJSON());
      }
    };

    // Estado de conexión
    pc.onconnectionstatechange = function () {
      var state = pc.connectionState;
      log('Connection state con', peerId, ':', state);
      emitir('connectionstate', { peerId: peerId, state: state });

      if (state === 'connected') {
        reconnectCounts[peerId] = 0;
        emitir('conectado', { peerId: peerId });
      } else if (state === 'disconnected' || state === 'failed') {
        // Intentar reconectar
        if (!reconnectCounts[peerId]) reconnectCounts[peerId] = 0;
        if (reconnectCounts[peerId] < CONFIG.maxReconnects) {
          reconnectCounts[peerId]++;
          setTimeout(function () {
            if (peerConnections[peerId] && peerConnections[peerId].connectionState !== 'connected') {
              log('Reintentando conexión con', peerId, 'intento', reconnectCounts[peerId]);
              if (esIniciador) crearOferta(peerId);
            }
          }, CONFIG.reconnectInterval);
        } else {
          emitir('desconectado', { peerId: peerId, razon: 'max reintentos' });
        }
      }
    };

    // DataChannel
    if (esIniciador) {
      // El iniciador CREA el canal
      var dc = pc.createDataChannel(CONFIG.channelLabel, CONFIG.channelOptions);
      configurarDataChannel(peerId, dc);
    } else {
      // El receptor ESPERA el canal
      pc.ondatachannel = function (e) {
        configurarDataChannel(peerId, e.channel);
      };
    }

    return pc;
  }

  function configurarDataChannel(peerId, channel) {
    dataChannels[peerId] = channel;

    channel.onopen = function () {
      log('DataChannel abierto con', peerId);
      emitir('datachannel-open', { peerId: peerId });
    };

    channel.onclose = function () {
      log('DataChannel cerrado con', peerId);
      emitir('datachannel-close', { peerId: peerId });
    };

    channel.onerror = function (e) {
      log('DataChannel error con', peerId, e);
    };

    channel.onmessage = function (e) {
      try {
        var msg = JSON.parse(e.data);
        emitir('mensaje', { peerId: peerId, mensaje: msg });
      } catch (e) {
        log('Mensaje no JSON de', peerId, e.data);
        emitir('mensaje', { peerId: peerId, mensaje: { raw: e.data } });
      }
    };
  }

  /* ===========================================================================
     HANDSHAKE: CREAR OFERTA (iniciador)
     =========================================================================== */
  function crearOferta(peerId) {
    var pc = peerConnections[peerId];
    if (!pc) return Promise.reject(new Error('No hay peer connection'));

    return pc.createOffer().then(function (oferta) {
      return pc.setLocalDescription(oferta);
    }).then(function () {
      // Esperar a que se recopilen ICE candidates (trickle ICE)
      return esperarIceGathering(pc);
    }).then(function () {
      var oferta = pc.localDescription;
      log('Enviando oferta a', peerId);
      return enviarOferta(miCodigo, miId, peerId, oferta.toJSON());
    }).catch(function (e) {
      log('Error creando oferta:', e);
      emitir('error', { peerId: peerId, error: e.message });
    });
  }

  function esperarIceGathering(pc, timeout) {
    timeout = timeout || CONFIG.iceTimeout;
    return new Promise(function (resolve) {
      if (pc.iceGatheringState === 'complete') return resolve();
      var timer = setTimeout(resolve, timeout);
      pc.onicegatheringstatechange = function () {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve();
        }
      };
    });
  }

  /* ===========================================================================
     MANEJAR OFERTA RECIBIDA (receptor)
     =========================================================================== */
  function manejarOferta(peerId, ofertaJson) {
    var pc = crearPeerConnection(peerId, false);
    var oferta = new RTCSessionDescription(ofertaJson);

    return pc.setRemoteDescription(oferta).then(function () {
      return pc.createAnswer();
    }).then(function (respuesta) {
      return pc.setLocalDescription(respuesta);
    }).then(function () {
      return esperarIceGathering(pc);
    }).then(function () {
      var respuesta = pc.localDescription;
      log('Enviando respuesta a', peerId);
      return enviarRespuesta(miCodigo, miId, peerId, respuesta.toJSON());
    }).catch(function (e) {
      log('Error manejando oferta:', e);
      emitir('error', { peerId: peerId, error: e.message });
    });
  }

  /* ===========================================================================
     MANEJAR RESPUESTA RECIBIDA (iniciador)
     =========================================================================== */
  function manejarRespuesta(peerId, respuestaJson) {
    var pc = peerConnections[peerId];
    if (!pc) return;
    var respuesta = new RTCSessionDescription(respuestaJson);
    pc.setRemoteDescription(respuesta).catch(function (e) {
      log('Error seteando respuesta:', e);
    });
  }

  /* ===========================================================================
     MANEJAR ICE CANDIDATE RECIBIDO
     =========================================================================== */
  function manejarIce(peerId, candidateJson) {
    var pc = peerConnections[peerId];
    if (!pc) return;
    var candidate = new RTCIceCandidate(candidateJson);
    pc.addIceCandidate(candidate).catch(function (e) {
      log('Error agregando ICE:', e);
    });
  }

  /* ===========================================================================
     POLLING DE SEÑALES (long polling simple)
     =========================================================================== */
  function iniciarPolling(peerId) {
    if (pollingTimers[peerId]) return;

    function poll() {
      if (!peerConnections[peerId]) return; // Conexión cerrada

      // Poll oferta (si soy receptor)
      pollSenal(miCodigo, peerId, miId, 'oferta').then(function (r) {
        if (r.data && !peerConnections[peerId].signalingState === 'stable') {
          manejarOferta(peerId, r.data);
        }
      }).catch(function () {});

      // Poll respuesta (si soy iniciador)
      pollSenal(miCodigo, peerId, miId, 'respuesta').then(function (r) {
        if (r.data && peerConnections[peerId]) {
          manejarRespuesta(peerId, r.data);
        }
      }).catch(function () {});

      // Poll ICE
      pollSenal(miCodigo, peerId, miId, 'ice').then(function (r) {
        if (r.data && peerConnections[peerId]) {
          if (Array.isArray(r.data)) {
            r.data.forEach(function (c) { manejarIce(peerId, c); });
          } else {
            manejarIce(peerId, r.data);
          }
        }
      }).catch(function () {});

      pollingTimers[peerId] = setTimeout(poll, 1000);
    }

    poll();
  }

  function detenerPolling(peerId) {
    if (pollingTimers[peerId]) {
      clearTimeout(pollingTimers[peerId]);
      delete pollingTimers[peerId];
    }
  }

  /* ===========================================================================
     API PÚBLICA
     =========================================================================== */
  function crearSala(codigo) {
    miId = generarId();
    miCodigo = codigo.toUpperCase();
    miRol = 'creador';
    salaEstado = 'conectando';

    return fetch(CONFIG.signalingUrl + '/api/sala/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        miCodigo = res.codigo;
        log('Sala creada:', miCodigo);
        emitir('sala-creada', { codigo: miCodigo });
        return miCodigo;
      });
  }

  function unirseSala(codigo) {
    miId = generarId();
    miCodigo = codigo.toUpperCase().trim();
    miRol = 'unido';
    salaEstado = 'conectando';

    return fetch(CONFIG.signalingUrl + '/api/sala/unirse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: miCodigo })
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.error) throw new Error(res.error);
        log('Unido a sala:', miCodigo);
        emitir('sala-unida', { codigo: miCodigo });
        return miCodigo;
      });
  }

  function conectarCon(peerId) {
    if (peerId === miId) return Promise.reject(new Error('No te puedes conectar a ti mismo'));
    if (peerConnections[peerId]) return Promise.resolve();

    var esIniciador = (miId < peerId); // Determinístico: ID menor inicia
    var pc = crearPeerConnection(peerId, esIniciador);

    if (esIniciador) {
      return crearOferta(peerId).then(function () {
        iniciarPolling(peerId);
      });
    } else {
      iniciarPolling(peerId);
      return Promise.resolve();
    }
  }

  function enviar(peerId, mensaje) {
    var dc = dataChannels[peerId];
    if (!dc || dc.readyState !== 'open') {
      return Promise.reject(new Error('DataChannel no listo para ' + peerId));
    }
    dc.send(JSON.stringify(mensaje));
    return Promise.resolve();
  }

  function enviarATodos(mensaje) {
    return Promise.all(Object.keys(dataChannels).map(function (pid) {
      return enviar(pid, mensaje);
    }));
  }

  function desconectar(peerId) {
    if (peerId) {
      detenerPolling(peerId);
      var pc = peerConnections[peerId];
      if (pc) { pc.close(); delete peerConnections[peerId]; }
      delete dataChannels[peerId];
      delete reconnectCounts[peerId];
    } else {
      // Desconectar todos
      Object.keys(peerConnections).forEach(desconectar);
    }
    miCodigo = null;
    miRol = null;
    salaEstado = 'desconectado';
  }

  function obtenerEstado() {
    return {
      miId: miId,
      codigo: miCodigo,
      rol: miRol,
      estado: salaEstado,
      peers: Object.keys(peerConnections).map(function (pid) {
        var pc = peerConnections[pid];
        return {
          id: pid,
          conexion: pc.connectionState,
          dataChannel: dataChannels[pid] ? dataChannels[pid].readyState : 'none'
        };
      })
    };
  }

  /* ===========================================================================
     EXPORT
     =========================================================================== */
  window.RetoWebRTC = {
    CONFIG: CONFIG,
    crearSala: crearSala,
    unirseSala: unirseSala,
    conectarCon: conectarCon,
    enviar: enviar,
    enviarATodos: enviarATodos,
    desconectar: desconectar,
    obtenerEstado: obtenerEstado,
    on: on,
    off: off,
    get miId() { return miId; },
    get miCodigo() { return miCodigo; },
    get miRol() { return miRol; }
  };

  // Auto-detectar signalingUrl desde meta tag si existe
  function leerSignalingUrl() {
    var meta = document.querySelector('meta[name="reto-signaling-url"]');
    if (meta) CONFIG.signalingUrl = meta.content;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', leerSignalingUrl);
  } else {
    leerSignalingUrl();
  }

})(window);