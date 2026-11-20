/* =========================================================================
   R.E.T.O. - Duelo P2P (reto-duelo-p2p.js)
   -------------------------------------------------------------------------
   Lógica del duelo RPG ejecutada 100% en el navegador (P2P via WebRTC).
   Un peer es "host" (autoridad), el otro es "cliente".
   Usa RetoRpg (lógica JS) y RetoWebRTC (transporte P2P).
   ========================================================================= */
(function (window) {
  'use strict';

  var RetoRpg = window.RetoRpg;
  var RetoWebRTC = window.RetoWebRTC;

  if (!RetoRpg || !RetoWebRTC) {
    console.warn('[RetoDueloP2P] Faltan RetoRpg o RetoWebRTC');
  }

  /* ===========================================================================
     ESTADO DEL DUELO
     =========================================================================== */
  var estado = {
    fase: 'inicio',           // 'inicio' | 'configurando' | 'esperando' | 'jugando' | 'fin'
    soyHost: false,           // ¿Soy la autoridad del juego?
    miPeerId: null,
    rivalPeerId: null,
    codigoSala: null,
    miToken: null,
    rivalToken: null,

    // Estado del juego (autoridad en host)
    juego: null,              // Estado completo de RetoRpg.nuevaBatalla()
    vista: null,              // Vista para este jugador (estadoPublico)

    // Configuración
    config: {
      pv_max: 100,
      dano_base: 10,
      ventaja: 3,
      contraataque: 1.0,
      con_tiempo: false,
      segundos_pregunta: 30,
      oferta: 4,
      max_power_ups: 3,
      max_por_pregunta: 1
    },

    // Datos locales
    miClase: 'guerrero',
    miEquipo: [],
    miMazo: [],
    rivalNombre: '',

    // Callbacks UI
    callbacks: {}
  };

  /* ===========================================================================
     UTILIDADES
     =========================================================================== */
  function log() { console.log('[DueloP2P]', ...arguments); }
  function emitir(evento, data) { (estado.callbacks[evento] || []).forEach(function(cb) { try { cb(data); } catch(e) {} }); }
  function on(evento, cb) { estado.callbacks[evento] = estado.callbacks[evento] || []; estado.callbacks[evento].push(cb); }
  function off(evento, cb) { if (!estado.callbacks[evento]) return; estado.callbacks[evento] = estado.callbacks[evento].filter(function(c){return c!==cb;}); }

  function generarToken() {
    var arr = new Uint8Array(16); crypto.getRandomValues(arr);
    return Array.from(arr, function(b){return b.toString(16).padStart(2,0);}).join('');
  }

  function limpiarNombre(n) { return String(n||'').slice(0,24).replace(/[<>]/g,''); }

  /* ===========================================================================
     INICIALIZACIÓN WEBRTC
     =========================================================================== */
  function initWebRTC() {
    return new Promise(function(resolve, reject) {
      if (!RetoWebRTC) return reject(new Error('RetoWebRTC no cargado'));

      // Escuchar eventos de WebRTC
      RetoWebRTC.on('conectado', function(data) {
        log('Conectado con', data.peerId);
        if (estado.soyHost) {
          // Host envía estado inicial del juego al cliente
          enviarEstadoJuego(data.peerId);
        }
        emitir('peer-conectado', { peerId: data.peerId });
      });

      RetoWebRTC.on('desconectado', function(data) {
        log('Desconectado:', data.peerId, data.razon);
        emitir('peer-desconectado', data);
        if (estado.fase === 'jugando') {
          manejarDesconexion(data.peerId);
        }
      });

      RetoWebRTC.on('mensaje', function(data) {
        manejarMensaje(data.peerId, data.mensaje);
      });

      RetoWebRTC.on('error', function(data) {
        log('Error WebRTC:', data);
        emitir('error', data);
      });

      resolve();
    });
  }

  /* ===========================================================================
     CREAR SALA (HOST)
     =========================================================================== */
  function crearSala(config) {
    estado.soyHost = true;
    estado.config = Object.assign({}, estado.config, config);
    estado.fase = 'configurando';

    return RetoWebRTC.crearSala().then(function(codigo) {
      estado.codigoSala = codigo;
      estado.miToken = generarToken();
      log('Sala creada:', codigo, 'soy HOST');
      emitir('sala-creada', { codigo: codigo, host: true });
      estado.fase = 'esperando';
      return codigo;
    });
  }

  /* ===========================================================================
     UNIRSE A SALA (CLIENTE)
     =========================================================================== */
  function unirseSala(codigo) {
    estado.soyHost = false;
    estado.fase = 'configurando';

    return RetoWebRTC.unirseSala(codigo).then(function(codigo) {
      estado.codigoSala = codigo;
      estado.miToken = generarToken();
      log('Unido a sala:', codigo, 'soy CLIENTE');
      emitir('sala-unida', { codigo: codigo, host: false });

      // Conectar con el host (peerId del host se deduce o se recibe via señalización)
      // En este modelo simplificado, el host tiene ID conocido o se descubre
      estado.fase = 'esperando';
      return codigo;
    });
  }

  /* ===========================================================================
     CONFIGURACIÓN DE JUGADOR (ambos)
     =========================================================================== */
  function configurarJugador(datos) {
    estado.miClase = datos.clase || 'guerrero';
    estado.miEquipo = datos.equipo || [];
    estado.miMazo = datos.mazo || [];
    estado.miNombre = limpiarNombre(datos.nombre || 'Jugador');

    // Validar mazo
    if (estado.miMazo.length < 24 || estado.miMazo.length > 30) {
      throw new Error('El mazo debe tener 24-30 preguntas');
    }

    // Validar equipo
    if (!estado.soyHost) {
      // Cliente envía su config al host
      enviarAlHost({ tipo: 'configurar', datos: {
        nombre: estado.miNombre,
        clase: estado.miClase,
        equipo: estado.miEquipo,
        mazo: estado.miMazo.map(function(p){ return { id: p.id, enunciado: p.enunciado, opciones: p.opciones, correcta: p.correcta, tema: p.tema }; })
      }});
    }

    emitir('configurado', {});
  }

  /* ===========================================================================
     INICIAR PARTIDA (SOLO HOST)
     =========================================================================== */
  function iniciarPartida() {
    if (!estado.soyHost) throw new Error('Solo el host puede iniciar');
    if (estado.fase !== 'esperando') throw new Error('No se puede iniciar ahora');

    // Crear batalla con RetoRpg
    var spec1 = {
      nombre: estado.miNombre,
      clase: estado.miClase,
      preguntas: estado.miMazo,
      equipo: estado.miEquipo,
      pv_max: estado.config.pv_max
    };

    var spec2 = {
      nombre: estado.rivalNombre || 'Rival',
      clase: estado.rivalClase || 'mago',
      preguntas: estado.rivalMazo || [],
      equipo: estado.rivalEquipo || [],
      pv_max: estado.config.pv_max
    };

    try {
      estado.juego = RetoRpg.nuevaBatalla(estado.config, spec1, spec2);
      estado.juego.miToken = estado.miToken;
      estado.juego.rivalToken = estado.rivalToken;
      estado.fase = 'jugando';

      // Obtener vista para host (j1) y cliente (j2)
      estado.vista = RetoRpg.estadoPublico(estado.juego, 'j1', false);
      estado.rivalVista = RetoRpg.estadoPublico(estado.juego, 'j2', false);

      // Enviar estado inicial al cliente
      enviarAlCliente({
        tipo: 'iniciar',
        vista: estado.rivalVista,
        config: estado.config,
        hostNombre: estado.miNombre,
        hostClase: estado.miClase
      });

      emitir('partida-iniciada', { vista: estado.vista });
      return estado.vista;
    } catch (e) {
      log('Error iniciando partida:', e);
      throw e;
    }
  }

  /* ===========================================================================
     MANEJO DE MENSAJES P2P
     =========================================================================== */
  function enviarAlHost(msg) {
    if (estado.soyHost) return; // Host no se envía a sí mismo
    RetoWebRTC.enviar(estado.rivalPeerId, Object.assign({ from: 'cliente' }, msg));
  }

  function enviarAlCliente(msg) {
    if (!estado.soyHost) return;
    RetoWebRTC.enviar(estado.rivalPeerId, Object.assign({ from: 'host' }, msg));
  }

  function enviarATodos(msg) {
    RetoWebRTC.enviarATodos(msg);
  }

  function manejarMensaje(peerId, msg) {
    log('Mensaje de', peerId, msg.tipo, msg);

    if (estado.soyHost) {
      // Host recibe del cliente
      switch (msg.tipo) {
        case 'configurar':
          estado.rivalNombre = msg.datos.nombre;
          estado.rivalClase = msg.datos.clase;
          estado.rivalEquipo = msg.datos.equipo;
          estado.rivalMazo = msg.datos.mazo;
          estado.rivalToken = msg.token || generarToken();
          emitir('rival-configurado', {});
          break;

        case 'responder':
          if (estado.fase === 'jugando' && estado.juego) {
            var resultado = procesarRespuestaHost(msg.opcionId, msg.milisegundos);
            // Enviar resultado al cliente
            enviarAlCliente({ tipo: 'resultado', resultado: resultado });
          }
          break;

        case 'power_up':
          if (estado.fase === 'jugando' && estado.juego) {
            var resultadoPU = procesarPowerUpHost(msg.id);
            enviarAlCliente({ tipo: 'power_up_resultado', resultado: resultadoPU });
          }
          break;

        case 'rendirse':
          terminarPartida('cliente_rindio');
          break;
      }
    } else {
      // Cliente recibe del host
      switch (msg.tipo) {
        case 'iniciar':
          estado.vista = msg.vista;
          estado.config = msg.config;
          estado.rivalNombre = msg.hostNombre;
          estado.rivalClase = msg.hostClase;
          estado.fase = 'jugando';
          emitir('partida-iniciada', { vista: estado.vista });
          break;

        case 'estado':
          estado.vista = msg.vista;
          emitir('estado-actualizado', { vista: estado.vista });
          break;

        case 'resultado':
          // Host envía resultado de la respuesta del cliente
          estado.vista = msg.vista || estado.vista;
          emitir('respuesta-resultado', msg.resultado);
          break;

        case 'power_up_resultado':
          estado.vista = msg.vista || estado.vista;
          emitir('power_up-resultado', msg.resultado);
          break;

        case 'turno':
          estado.vista = msg.vista;
          emitir('turno-cambiado', { vista: estado.vista });
          break;

        case 'fin':
          estado.fase = 'fin';
          estado.vista = msg.vista;
          emitir('partida-terminada', { vista: estado.vista, ganador: msg.ganador });
          break;

        case 'error':
          emitir('error', { mensaje: msg.mensaje });
          break;
      }
    }
  }

  /* ===========================================================================
     LÓGICA DE JUEGO (HOST - AUTORIDAD)
     =========================================================================== */
  function procesarRespuestaHost(opcionId, milisegundos) {
    if (!estado.juego) return { error: 'No hay juego' };

    try {
      // Usar RetoRpg para procesar
      var resultado = RetoRpg.responder(estado.juego, 'j2', opcionId, milisegundos);

      // Obtener vistas actualizadas
      var vistaHost = RetoRpg.estadoPublico(estado.juego, 'j1', false);
      var vistaCliente = RetoRpg.estadoPublico(estado.juego, 'j2', false);

      estado.vista = vistaHost;

      // Enviar estado actualizado al cliente
      enviarAlCliente({
        tipo: 'estado',
        vista: vistaCliente,
        ultimo: resultado
      });

      // Verificar fin
      if (estado.juego.ganador) {
        terminarPartida(estado.juego.ganador === 'j1' ? 'host' : 'cliente');
      } else if (estado.juego.fase === 'elegir') {
        // Siguiente turno: host ataca
        enviarAlCliente({ tipo: 'turno', vista: vistaCliente });
      }

      return { ok: true, vistaHost: vistaHost, vistaCliente: vistaCliente, resultado: resultado };
    } catch (e) {
      log('Error procesando respuesta:', e);
      return { error: e.message };
    }
  }

  function procesarPowerUpHost(puId) {
    if (!estado.juego) return { error: 'No hay juego' };

    try {
      RetoRpg.usarPowerUp(estado.juego, 'j2', puId);
      var vistaHost = RetoRpg.estadoPublico(estado.juego, 'j1', false);
      var vistaCliente = RetoRpg.estadoPublico(estado.juego, 'j2', false);
      estado.vista = vistaHost;

      enviarAlCliente({ tipo: 'estado', vista: vistaCliente });
      return { ok: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  /* ===========================================================================
     ACCIONES DEL CLIENTE (envían al host)
     =========================================================================== */
  function responder(opcionId, milisegundos) {
    if (estado.soyHost) return procesarRespuestaHost(opcionId, milisegundos);

    enviarAlHost({
      tipo: 'responder',
      opcionId: opcionId,
      milisegundos: milisegundos
    });
  }

  function usarPowerUp(puId) {
    if (estado.soyHost) return procesarPowerUpHost(puId);

    enviarAlHost({ tipo: 'power_up', id: puId });
  }

  function rendirse() {
    if (estado.soyHost) {
      terminarPartida('host_rindio');
    } else {
      enviarAlHost({ tipo: 'rendirse' });
    }
  }

  function terminarPartida(ganador) {
    estado.fase = 'fin';
    var vistaFinal = estado.juego ? RetoRpg.estadoPublico(estado.juego, estado.soyHost ? 'j1' : 'j2', false) : null;

    if (estado.soyHost) {
      enviarAlCliente({ tipo: 'fin', vista: vistaFinal, ganador: ganador });
    }

    emitir('partida-terminada', { ganador: ganador, vista: vistaFinal });
    log('Partida terminada, ganador:', ganador);
  }

  function manejarDesconexion(peerId) {
    if (estado.fase === 'jugando') {
      // Pausar partida, intentar reconectar
      emitir('desconexion', { peerId: peerId });
      // TODO: lógica de reconexión y pausa
    }
  }

  function enviarEstadoJuego(peerId) {
    if (!estado.soyHost || !estado.juego) return;

    var vistaCliente = RetoRpg.estadoPublico(estado.juego, 'j2', false);
    RetoWebRTC.enviar(peerId, {
      from: 'host',
      tipo: 'estado',
      vista: vistaCliente
    });
  }

  /* ===========================================================================
     EXPORT
     =========================================================================== */
  window.RetoDueloP2P = {
    init: initWebRTC,
    crearSala: crearSala,
    unirseSala: unirseSala,
    configurarJugador: configurarJugador,
    iniciarPartida: iniciarPartida,
    responder: responder,
    usarPowerUp: usarPowerUp,
    rendirse: rendirse,
    get estado() { return estado; },
    on: on,
    off: off
  };

})(window);