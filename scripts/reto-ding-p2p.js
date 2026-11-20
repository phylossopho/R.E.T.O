/* =========================================================================
   R.E.T.O. - Ding! P2P (reto-ding-p2p.js)
   -------------------------------------------------------------------------
   Quiz bowl P2P: Presentador (host) + 2-4 Jugadores (clientes).
   Host controla el flujo: muestra pregunta, abre opciones, revela, siguiente.
   ========================================================================= */
(function (window) {
  'use strict';

  var RetoSalas = window.RetoSalas;  // Lógica local de Ding! (reto-salas.js)
  var RetoWebRTC = window.RetoWebRTC;

  if (!RetoSalas || !RetoWebRTC) {
    console.warn('[DingP2P] Faltan RetoSalas o RetoWebRTC');
  }

  /* ===========================================================================
     ESTADO
     =========================================================================== */
  var estado = {
    fase: 'inicio',           // 'inicio' | 'configurando' | 'esperando' | 'jugando' | 'fin'
    soyPresentador: false,
    miPeerId: null,
    codigoSala: null,
    jugadores: {},            // { peerId: { nombre, token, puntos, ... } }
    peersConectados: {},      // { peerId: true }

    // Sala local (RetoSalas.SalaDing)
    sala: null,

    // Config
    config: {
      num_preguntas: 0,
      mezclar: true,
      repeticiones_dinamicas: 5,
      efecto: 'maquina',
      velocidad: 'normal',
      auto_avance: true,
      espera_s: 4,
      restar_puntos: true,
      puntos_acierto: 10,
      puntos_fallo: 5,
      limite_activo: false,
      limite_s: 30
    },

    // Datos del test
    testTitulo: '',
    testPreguntas: [],

    // Callbacks
    callbacks: {}
  };

  var EFECTOS = ['maquina', 'caen', 'giran', 'aparecen', 'ninguno'];
  var VELOCIDADES = { lenta: 15, normal: 30, rapida: 60 };
  var MARGEN_ANIMACION_MS = 400;

  function log() { console.log('[DingP2P]', ...arguments); }
  function emitir(e, d) { (estado.callbacks[e] || []).forEach(function(cb){ try{cb(d);}catch(e){} }); }
  function on(e, cb) { estado.callbacks[e] = estado.callbacks[e] || []; estado.callbacks[e].push(cb); }
  function off(e, cb) { if(!estado.callbacks[e]) return; estado.callbacks[e] = estado.callbacks[e].filter(function(c){return c!==cb;}); }
  function genToken() { var a=new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a,function(b){return b.toString(16).padStart(2,0);}).join(''); }
  function limpiarNombre(n) { return String(n||'').slice(0,24).replace(/[<>]/g,''); }
  function normalizarConfig(cfg) {
    cfg = cfg || {}; var ef = cfg.efecto || 'maquina', vel = cfg.velocidad || 'normal';
    return {
      num_preguntas: Math.max(0, Math.min(60, parseInt(cfg.num_preguntas)||0)),
      mezclar: !!cfg.mezclar,
      repeticiones_dinamicas: Math.max(1, Math.min(10, parseInt(cfg.repeticiones_dinamicas)||5)),
      efecto: EFECTOS.indexOf(ef)>=0 ? ef : 'maquina',
      velocidad: VELOCIDADES[vel] ? vel : 'normal',
      auto_avance: !!cfg.auto_avance,
      espera_s: Math.max(1, Math.min(30, parseInt(cfg.espera_s)||4)),
      restar_puntos: !!cfg.restar_puntos,
      puntos_acierto: Math.max(1, Math.min(100, parseInt(cfg.puntos_acierto)||10)),
      puntos_fallo: Math.max(1, Math.min(100, parseInt(cfg.puntos_fallo)||5)),
      limite_activo: !!cfg.limite_activo,
      limite_s: Math.max(5, Math.min(120, parseInt(cfg.limite_s)||30))
    };
  }
  function durAnim(txt, cfg) { if(cfg.efecto==='ninguno'||!txt) return 0; return Math.floor(txt.length*1000/VELOCIDADES[cfg.velocidad])+MARGEN_ANIMACION_MS; }
  function armarSecuencia(fuente, cfg) {
    var seq = [];
    fuente.forEach(function(p){ var v = p.dinamica ? cfg.repeticiones_dinamicas : 1; for(var i=0;i<v;i++) seq.push(p); });
    if(cfg.mezclar) for(var i=seq.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=seq[i]; seq[i]=seq[j]; seq[j]=t; }
    return seq.slice(0, 60);
  }
  function materializar(p) {
    if(!p.dinamica) return { enunciado:p.enunciado, tema:p.tema, opciones:p.opciones.map(function(o){return {id:o.id, texto:o.texto};}), correcta:p.correcta, explicacion:null };
    return { enunciado:p.dinamica.enunciado, tema:p.tema, opciones:[{id:'o0',texto:'A'},{id:'o1',texto:'B'},{id:'o2',texto:'C'},{id:'o3',texto:'D'}], correcta:'o0', explicacion:null };
  }

  /* ===========================================================================
     INICIALIZACIÓN
     =========================================================================== */
  function init() {
    return new Promise(function(resolve) {
      if (!RetoWebRTC || !RetoSalas) return resolve(); // Módulos opcionales

      RetoWebRTC.on('conectado', function(d) {
        log('Conectado:', d.peerId);
        estado.peersConectados[d.peerId] = true;
        if (estado.soyPresentador) {
          enviarVistaJugador(d.peerId);
        }
        emitir('jugador-conectado', { peerId: d.peerId });
      });

      RetoWebRTC.on('desconectado', function(d) {
        delete estado.peersConectados[d.peerId];
        emitir('jugador-desconectado', d);
      });

      RetoWebRTC.on('mensaje', function(d) {
        manejarMensaje(d.peerId, d.mensaje);
      });

      RetoWebRTC.on('error', function(d) { emitir('error', d); });

      resolve();
    });
  }

  /* ===========================================================================
     CREAR SALA (PRESENTADOR)
     =========================================================================== */
  function crearSala(nombre, config) {
    estado.soyPresentador = true;
    estado.config = normalizarConfig(config);
    estado.fase = 'configurando';

    return RetoWebRTC.crearSala().then(function(codigo) {
      estado.codigoSala = codigo;
      estado.sala = new RetoSalas.SalaDing(codigo, limpiarNombre(nombre), genToken());
      estado.sala.config = estado.config;
      log('Sala Ding! creada:', codigo);
      emitir('sala-creada', { codigo: codigo, presentador: true });
      estado.fase = 'esperando';
      return codigo;
    });
  }

  /* ===========================================================================
     UNIRSE (JUGADOR)
     =========================================================================== */
  function unirseSala(codigo, nombre) {
    estado.soyPresentador = false;
    estado.fase = 'configurando';

    return RetoWebRTC.unirseSala(codigo).then(function(codigo) {
      estado.codigoSala = codigo;
      log('Unido a Ding!:', codigo);
      emitir('sala-unida', { codigo: codigo, presentador: false });
      estado.fase = 'esperando';
      return codigo;
    });
  }

  /* ===========================================================================
     CARGAR TEST (PRESENTADOR)
     =========================================================================== */
  function cargarTest(titulo, preguntas) {
    if (!estado.soyPresentador) throw new Error('Solo el presentador carga el test');
    if (estado.fase !== 'esperando') throw new Error('Solo en espera');

    estado.sala.cargarFuente(estado.sala.presentador.token, titulo, preguntas);
    estado.testTitulo = titulo;
    estado.testPreguntas = preguntas;
    emitir('test-cargado', { titulo: titulo, total: preguntas.length });
  }

  /* ===========================================================================
     CONFIGURAR PARTIDA (PRESENTADOR)
     =========================================================================== */
  function configurar(cambios) {
    if (!estado.soyPresentador) throw new Error('Solo el presentador configura');
    estado.sala.configurar(estado.sala.presentador.token, cambios);
    estado.config = estado.sala.config;
    // Broadcast a jugadores
    broadcast({ tipo: 'config', config: estado.config });
    emitir('configurado', estado.config);
  }

  /* ===========================================================================
     EMPEZAR PARTIDA (PRESENTADOR)
     =========================================================================== */
  function empezar() {
    if (!estado.soyPresentador) throw new Error('Solo el presentador empieza');
    if (estado.fase !== 'esperando') throw new Error('Ya empezó');
    if (!estado.sala.fuente) throw new Error('Sube un test primero');
    if (Object.keys(estado.sala.jugadores).length < 2) throw new Error('Faltan jugadores (mín 2)');

    // Armar secuencia en host
    var seq = armarSecuencia(estado.sala.fuente, estado.sala.config);
    if (estado.sala.config.num_preguntas) seq = seq.slice(0, estado.sala.config.num_preguntas);
    estado.sala.secuencia = seq;
    estado.sala.inicio = Date.now();
    estado.sala._abrir(0);

    estado.fase = 'jugando';

    // Broadcast inicio
    broadcast({
      tipo: 'iniciar',
      secuencia: seq,
      config: estado.sala.config,
      titulo: estado.sala.titulo,
      total: seq.length
    });

    // Enviar primera pregunta a presentador
    var actual = estado.sala.actual;
    broadcast({
      tipo: 'pregunta',
      numero: 1,
      total: seq.length,
      enunciado: actual.enunciado,
      tema: actual.tema,
      efecto: estado.sala.config.efecto,
      cps: VELOCIDADES[estado.sala.config.velocidad],
      animacion_ms: durAnim(actual.enunciado, estado.sala.config)
    });

    emitir('partida-iniciada', { total: seq.length });
  }

  /* ===========================================================================
     ACCIONES PRESENTADOR
     =========================================================================== */
  function siguiente() {
    if (!estado.soyPresentador) throw new Error('Solo presentador');
    if (estado.sala.fase !== 'resuelta' || estado.sala.config.auto_avance) throw new Error('No ahora');
    estado.sala.siguiente(estado.sala.presentador.token);
    broadcast({ tipo: 'siguiente' });
    _abrirSiguiente();
  }

  function _abrirSiguiente() {
    var actual = estado.sala.actual;
    var num = estado.sala.indice + 1;
    broadcast({
      tipo: 'pregunta',
      numero: num,
      total: estado.sala.secuencia.length,
      enunciado: actual.enunciado,
      tema: actual.tema,
      efecto: estado.sala.config.efecto,
      cps: VELOCIDADES[estado.sala.config.velocidad],
      animacion_ms: durAnim(actual.enunciado, estado.sala.config)
    });
  }

  function terminar() {
    if (!estado.soyPresentador) throw new Error('Solo presentador');
    estado.sala.terminar(estado.sala.presentador.token);
    estado.fase = 'fin';
    broadcast({ tipo: 'fin', final: estado.sala.final });
    emitir('partida-terminada', estado.sala.final);
  }

  /* ===========================================================================
     JUGADOR RESPONDE
     =========================================================================== */
  function responder(opcionId) {
    if (estado.soyPresentador) return; // Presentador no responde

    broadcast({ tipo: 'responder', opcionId: opcionId, peerId: estado.miPeerId });
  }

  /* ===========================================================================
     MANEJO MENSAJES (Broadcast simple)
     =========================================================================== */
  function broadcast(msg) {
    Object.keys(RetoWebRTC.dataChannels || {}).forEach(function(peerId) {
      RetoWebRTC.enviar(peerId, msg);
    });
  }

  function manejarMensaje(peerId, msg) {
    log('Msg de', peerId, msg.tipo);

    if (estado.soyPresentador) {
      // Presentador recibe de jugadores
      switch (msg.tipo) {
        case 'responder':
          if (estado.sala.fase !== 'abierta') return;
          if (Date.now() < estado.sala.t_opciones) return; // Antes de animación

          var j = estado.sala.jugadores[msg.peerId] || estado.sala.jugadores[peerId];
          if (!j) return;
          if (j.visto && Date.now() - j.visto > 10000) return; // Inactivo

          if (msg.opcionId === estado.sala.actual.correcta) {
            // PRIMERO en acertar gana
            if (!estado.sala.resultado) {
              j.puntos += estado.sala.config.puntos_acierto;
              j.aciertos++;
              estado.sala._terminar(peerId, 'acierto');
              broadcast({
                tipo: 'resultado',
                ganador: peerId,
                motivo: 'acierto',
                correcta: estado.sala.actual.correcta,
                opciones: estado.sala.actual.opciones.map(function(o){return {id:o.id, texto:o.texto};}),
                explicacion: estado.sala.actual.explicacion
              });
            }
          } else {
            j.fallos++;
            if (estado.sala.config.restar_puntos) j.puntos = Math.max(0, j.puntos - estado.sala.config.puntos_fallo);
            estado.sala.fallaron = estado.sala.fallaron || [];
            estado.sala.fallaron.push(peerId);

            var activos = Object.keys(estado.sala.jugadores).filter(function(pid) { return !estado.sala.fallaron.includes(pid); });
            if (!activos.length) {
              estado.sala._terminar(null, 'todos_fallaron');
              broadcast({
                tipo: 'resultado',
                ganador: null,
                motivo: 'todos_fallaron',
                correcta: estado.sala.actual.correcta,
                opciones: estado.sala.actual.opciones.map(function(o){return {id:o.id, texto:o.texto};}),
                explicacion: estado.sala.actual.explicacion
              });
            }
          }
          break;
      }
    } else {
      // Jugador recibe del presentador
      switch (msg.tipo) {
        case 'config':
          estado.config = msg.config;
          emitir('config', estado.config);
          break;

        case 'iniciar':
          estado.sala = new RetoSalas.SalaDing(msg.codigo || 'P2P', msg.titulo || 'Partida', genToken());
          estado.sala.config = msg.config;
          estado.sala.secuencia = msg.secuencia;
          estado.sala.fase = 'jugando';
          estado.fase = 'jugando';
          emitir('iniciar', msg);
          break;

        case 'pregunta':
          estado.sala.fase = 'abierta';
          estado.sala.actual = { enunciado: msg.enunciado, tema: msg.tema, opciones: msg.opciones || [], correcta: msg.correcta };
          estado.sala.t_inicio = Date.now();
          estado.sala.t_opciones = estado.sala.t_inicio + msg.animacion_ms;
          estado.sala.config = estado.config;
          emitir('pregunta', {
            numero: msg.numero,
            total: msg.total,
            enunciado: msg.enunciado,
            tema: msg.tema,
            efecto: msg.efecto,
            cps: msg.cps,
            animacion_ms: msg.animacion_ms
          });
          break;

        case 'siguiente':
          // Presentador pasó manualmente
          break;

        case 'resultado':
          estado.sala.fase = 'resuelta';
          estado.sala.resultado = { ganador: msg.ganador, motivo: msg.motivo };
          emitir('resultado', msg);
          break;

        case 'fin':
          estado.fase = 'fin';
          estado.sala.final = msg.final;
          emitir('fin', msg.final);
          break;

        case 'error':
          emitir('error', msg);
          break;
      }
    }
  }

  /* ===========================================================================
     HELPERS
     =========================================================================== */
  function enviarVistaJugador(peerId) {
    if (!estado.soyPresentador || !estado.sala) return;
    var actual = estado.sala.actual;
    if (!actual) return;
    RetoWebRTC.enviar(peerId, {
      from: 'presentador',
      tipo: 'pregunta',
      numero: estado.sala.indice + 1,
      total: estado.sala.secuencia.length,
      enunciado: actual.enunciado,
      tema: actual.tema,
      efecto: estado.sala.config.efecto,
      cps: VELOCIDADES[estado.sala.config.velocidad],
      animacion_ms: durAnim(actual.enunciado, estado.sala.config)
    });
  }

  /* ===========================================================================
     EXPORT
     =========================================================================== */
  window.RetoDingP2P = {
    init: init,
    crearSala: crearSala,
    unirseSala: unirseSala,
    cargarTest: cargarTest,
    configurar: configurar,
    empezar: empezar,
    siguiente: siguiente,
    terminar: terminar,
    responder: responder,
    get estado() { return estado; },
    on: on,
    off: off,
    broadcast: broadcast
  };

})(window);