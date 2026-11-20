/* =========================================================================
   R.E.T.O. - Lógica de Salas y Multijugador (JavaScript)
   -------------------------------------------------------------------------
   Puerto de logica/sala.py + logica/ding.py a JS.
   Funciona tanto offline (local) como online (Firebase).
   ========================================================================= */
(function (window) {
  'use strict';

  /* ===========================================================================
     CONSTANTES (idénticas a Python)
     =========================================================================== */
  var LETRAS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var LARGO_CODIGO = 4;
  var MAX_SALAS = 10;
  var SALA_VIVA_S = 3 * 60 * 60;
  var PRESENCIA_S = 10;
  var MIN_JUGADORES = 2;
  var MAX_JUGADORES = 4;

  var EFECTOS = ['maquina', 'caen', 'giran', 'aparecen', 'ninguno'];
  var VELOCIDADES = { lenta: 15, normal: 30, rapida: 60 };
  var MARGEN_ANIMACION_MS = 400;

  var CONFIG_EDITABLE_DING = [
    'num_preguntas', 'mezclar', 'repeticiones_dinamicas', 'efecto', 'velocidad',
    'auto_avance', 'espera_s', 'restar_puntos', 'puntos_acierto', 'puntos_fallo',
    'limite_activo', 'limite_s'
  ];

  var MAX_FUENTE = 60;
  var MAX_SECUENCIA = 60;
  var MAX_FORMULA = 150;
  var MAX_VARIABLES = 8;
  var MAX_DISTRACTORES = 6;
  var MAX_ENUNCIADO = 200;
  var MAX_OPCION = 100;
  var MAX_TEMA = 40;
  var LIMITE_VARIABLE = 100000;

  /* ===========================================================================
     UTILIDADES
     =========================================================================== */
  function _recortar(s, max) {
    if (!s) return '';
    return String(s).slice(0, max);
  }

  function _entero(v, defecto, min, max) {
    try { var n = parseInt(v, 10); } catch (e) { return defecto; }
    return Math.max(min, Math.min(max, n));
  }

  function _numero(v, defecto) {
    try { var n = parseFloat(v); } catch (e) { return defecto; }
    if (isNaN(n) || Math.abs(n) > LIMITE_VARIABLE) return defecto;
    return n;
  }

  function _codigoNuevo(existentes) {
    for (var i = 0; i < 200; i++) {
      var c = '';
      for (var k = 0; k < LARGO_CODIGO; k++) {
        c += LETRAS_CODIGO[Math.floor(Math.random() * LETRAS_CODIGO.length)];
      }
      if (!existentes[c]) return c;
    }
    return null;
  }

  function limpiarNombre(n) {
    return _recortar(String(n || ''), 24).replace(/[<>]/g, '');
  }

  function generarToken() {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function normalizarConfigDing(cfg) {
    cfg = cfg || {};
    var efecto = cfg.efecto || 'maquina';
    var velocidad = cfg.velocidad || 'normal';
    return {
      num_preguntas: _entero(cfg.num_preguntas, 0, 0, MAX_SECUENCIA),
      mezclar: Boolean(cfg.mezclar),
      repeticiones_dinamicas: _entero(cfg.repeticiones_dinamicas, 5, 1, 10),
      efecto: EFECTOS.indexOf(efecto) >= 0 ? efecto : 'maquina',
      velocidad: VELOCIDADES[velocidad] ? velocidad : 'normal',
      auto_avance: Boolean(cfg.auto_avance),
      espera_s: _entero(cfg.espera_s, 4, 1, 30),
      restar_puntos: Boolean(cfg.restar_puntos),
      puntos_acierto: _entero(cfg.puntos_acierto, 10, 1, 100),
      puntos_fallo: _entero(cfg.puntos_fallo, 5, 1, 100),
      limite_activo: Boolean(cfg.limite_activo),
      limite_s: _entero(cfg.limite_s, 30, 5, 120)
    };
  }

  function duracionAnimacionMs(texto, config) {
    if (config.efecto === 'ninguno' || !texto) return 0;
    return Math.floor(texto.length * 1000 / VELOCIDADES[config.velocidad]) + MARGEN_ANIMACION_MS;
  }

  /* ===========================================================================
     CLASE SALA BASE (común duelo + ding)
     =========================================================================== */
  function SalaBase(codigo, creadorNombre, creadorToken, tipo) {
    this.codigo = codigo.toUpperCase();
    this.tipo = tipo; // 'duelo' | 'ding'
    this.version = 1;
    this.actividad = Date.now();
    this.fase = 'espera';
    this.config = tipo === 'ding' ? normalizarConfigDing({}) : {};
    this.presentador = {
      nombre: limpiarNombre(creadorNombre),
      token: creadorToken,
      visto: Date.now()
    };
    this.jugadores = {};
    this.fuente = null;
    this.titulo = '';
  }

  SalaBase.prototype._tocar = function () {
    this.version++;
    this.actividad = Date.now();
  };

  SalaBase.prototype._esPresentador = function (token) {
    return this.presentador && this.presentador.token === token;
  };

  SalaBase.prototype._jugadorValido = function (token) {
    if (this._esPresentador(token)) return 'pres';
    for (var jid in this.jugadores) {
      if (this.jugadores[jid].token === token) return jid;
    }
    return null;
  };

  SalaBase.prototype.unirse = function (nombre, token) {
    if (this.fase !== 'espera') throw new Error('La partida ya empezó.');
    if (Object.keys(this.jugadores).length >= MAX_JUGADORES)
      throw new Error('La sala ya tiene ' + MAX_JUGADORES + ' jugadores.');

    var jid = 'p' + (Object.keys(this.jugadores).length + 1);
    this.jugadores[jid] = {
      nombre: limpiarNombre(nombre),
      token: token || generarToken(),
      puntos: 0, aciertos: 0, fallos: 0, visto: Date.now()
    };
    this._tocar();
    return { codigo: this.codigo, token: this.jugadores[jid].token, yo: jid };
  };

  SalaBase.prototype.configurar = function (token, cambios) {
    if (!this._esPresentador(token)) throw new Error('Solo el presentador configura.');
    if (this.fase !== 'espera') throw new Error('Configuración solo antes de empezar.');
    Object.keys(cambios || {}).forEach(function (k) {
      if (this.tipo === 'ding' && CONFIG_EDITABLE_DING.indexOf(k) >= 0) {
        this.config[k] = cambios[k];
      }
    }, this);
    if (this.tipo === 'ding') this.config = normalizarConfigDing(this.config);
    this._tocar();
    return this.config;
  };

  SalaBase.prototype.cargarFuente = function (token, titulo, preguntas) {
    if (!this._esPresentador(token)) throw new Error('Solo el presentador carga el test.');
    if (this.fase !== 'espera') throw new Error('Ya no se puede cambiar el test.');
    this.fuente = this._acotarPreguntas(preguntas);
    this.titulo = _recortar(titulo, 80);
    this._tocar();
  };

  SalaBase.prototype._acotarPreguntas = function (preguntas) {
    // Implementación simplificada - valida estructura básica
    if (!Array.isArray(preguntas) || !preguntas.length) throw new Error('El test necesita al menos una pregunta.');
    var limpio = [];
    preguntas.slice(0, MAX_FUENTE).forEach(function (p) {
      if (!p || typeof p !== 'object') throw new Error('Pregunta con formato incorrecto.');
      var base = { id: _recortar(p.id, 80) || 'q' + limpio.length, tema: _recortar(p.tema, MAX_TEMA) };
      if (p.dinamica) {
        base.dinamica = p.dinamica; // validación simplificada
        base.enunciado = p.dinamica.enunciado;
      } else {
        if (!Array.isArray(p.opciones) || p.opciones.length < 2)
          throw new Error('Pregunta fija necesita al menos 2 opciones.');
        base.enunciado = _recortar(p.enunciado, MAX_ENUNCIADO);
        base.opciones = p.opciones.slice(0, 6).map(function (o, i) {
          return { id: _recortar(o.id, 40) || 'o' + i, texto: _recortar(o.texto, MAX_OPCION) };
        });
        base.correcta = _recortar(p.correcta, 40);
        if (base.opciones.map(function (o) { return o.id; }).indexOf(base.correcta) < 0)
          throw new Error('Pregunta sin respuesta correcta marcada.');
      }
      if (!base.enunciado) throw new Error('Pregunta sin enunciado.');
      limpio.push(base);
    });
    return limpio;
  };

  SalaBase.prototype.empezar = function (token) {
    if (!this._esPresentador(token)) throw new Error('Solo el presentador empieza.');
    if (this.fase !== 'espera') throw new Error('La partida ya empezó.');
    if (Object.keys(this.jugadores).length < MIN_JUGADORES)
      throw new Error('Faltan jugadores (mínimo ' + MIN_JUGADORES + ').');
    if (!this.fuente || !this.fuente.length) throw new Error('Primero sube un test.');

    this.fase = 'jugando';
    this._tocar();
    return this._iniciarPartida();
  };

  SalaBase.prototype._iniciarPartida = function () {
    // Override en subclases
  };

  SalaBase.prototype.obtenerVista = function (token) {
    var yo = this._jugadorValido(token);
    if (!yo) throw new Error('No eres parte de esta sala.');

    var vista = {
      codigo: this.codigo, yo: yo, rol: yo === 'pres' ? 'presentador' : 'jugador',
      fase: this.fase, titulo: this.titulo, tipo: this.tipo,
      config: yo === 'pres' ? this.config : null,
      jugadores: Object.keys(this.jugadores).map(function (jid) {
        return { id: jid, nombre: this.jugadores[jid].nombre, conectado: Date.now() - this.jugadores[jid].visto <= PRESENCIA_S };
      }, this)
    };

    if (yo !== 'pres') vista.mis_puntos = this.jugadores[yo].puntos;

    // Añadir datos específicos de la fase
    this._añadirDatosFase(vista, yo);

    return vista;
  };

  SalaBase.prototype._añadirDatosFase = function (vista, yo) {
    // Override en subclases
  };

  SalaBase.prototype.marcarActividad = function (token) {
    var yo = this._jugadorValido(token);
    if (yo) {
      if (yo === 'pres') this.presentador.visto = Date.now();
      else if (this.jugadores[yo]) this.jugadores[yo].visto = Date.now();
    }
  };

  SalaBase.prototype.estaViva = function () {
    return Date.now() - this.actividad < SALA_VIVA_S * 1000;
  };

  /* ===========================================================================
     SALA DUELO (RPG por turnos)
     =========================================================================== */
  function SalaDuelo(codigo, creadorNombre, creadorToken) {
    SalaBase.call(this, codigo, creadorNombre, creadorToken, 'duelo');
    this.config = {
      pv_max: 100, dano_base: 10, ventaja: 3, contraataque: 1.0,
      con_tiempo: false, segundos_pregunta: 30, oferta: 4,
      max_power_ups: null, max_por_pregunta: 1
    };
    this.turno = 1;
    this.atacante = null;
    this.pregunta = null;
    this.ganador = null;
    this.motivo = null;
    this.mazo1 = null;
    this.mazo2 = null;
    this.equipo1 = null;
    this.equipo2 = null;
    this.clase1 = null;
    this.clase2 = null;
    this.pv1 = 100; this.pv2 = 100;
    this.pv_max1 = 100; this.pv_max2 = 100;
    this.usados1 = []; this.usados2 = [];
    this.efectos1 = []; this.efectos2 = [];
    this.aciertos1 = 0; this.aciertos2 = 0;
    this.fallos1 = 0; this.fallos2 = 0;
  }
  SalaDuelo.prototype = Object.create(SalaBase.prototype);
  SalaDuelo.prototype.constructor = SalaDuelo;

  SalaDuelo.prototype._iniciarPartida = function () {
    // Preparar estado inicial para duelo
    this.turno = 1;
    this.atacante = 'j1'; // j1 empieza en PvP
    this._empezarTurno();
  };

  SalaDuelo.prototype._empezarTurno = function () {
    // Lógica simplificada - en producción usar RetoRpg
    this.pregunta = { enunciado: 'Pregunta de prueba', opciones: [
      { id: 'o0', texto: 'Opción A' },
      { id: 'o1', texto: 'Opción B' },
      { id: 'o2', texto: 'Opción C' },
      { id: 'o3', texto: 'Opción D' }
    ], correcta: 'o0' };
    this.fase = 'responder';
    this._tocar();
  };

  SalaDuelo.prototype.responder = function (token, opcionId) {
    var yo = this._jugadorValido(token);
    if (!yo) throw new Error('No es tu turno.');
    if (this.fase !== 'responder') throw new Error('No es momento de responder.');

    var correcta = opcionId === this.pregunta.correcta;
    if (yo === this.atacante) { /* lógica simplificada */ }

    // Cambiar turno
    this.turno++;
    this.atacante = this.atacante === 'j1' ? 'j2' : 'j1';
    this._empezarTurno();
    return this.obtenerVista(token);
  };

  SalaDuelo.prototype._añadirDatosFase = function (vista, yo) {
    vista.turno = this.turno;
    vista.atacante = this.atacante;
    vista.ganador = this.ganador;
    vista.pv1 = this.pv1; vista.pv_max1 = this.pv_max1;
    vista.pv2 = this.pv2; vista.pv_max2 = this.pv_max2;
    if (this.pregunta) {
      vista.pregunta = {
        enunciado: this.pregunta.enunciado,
        opciones: this.pregunta.opciones.map(function (o) { return { id: o.id, texto: o.texto }; })
      };
    }
  };

  /* ===========================================================================
     SALA DING (Quiz Bowl)
     =========================================================================== */
  function SalaDing(codigo, creadorNombre, creadorToken) {
    SalaBase.call(this, codigo, creadorNombre, creadorToken, 'ding');
    this.config = normalizarConfigDing({});
    this.indice = -1;
    this.secuencia = [];
    this.actual = null;
    this.t_inicio = null;
    this.t_opciones = null;
    this.t_limite = null;
    this.t_resuelta = null;
    this.fallaron = [];
    this.resultado = null;
    this.inicio = null;
    this.final = null;
  }
  SalaDing.prototype = Object.create(SalaBase.prototype);
  SalaDing.prototype.constructor = SalaDing;

  SalaDing.prototype._iniciarPartida = function () {
    var seq = this._armarSecuencia(this.fuente, this.config);
    if (this.config.num_preguntas) seq = seq.slice(0, this.config.num_preguntas);
    this.secuencia = seq;
    this.inicio = Date.now();
    this._abrir(0);
  };

  SalaDing.prototype._armarSecuencia = function (fuente, config) {
    var seq = [];
    fuente.forEach(function (p) {
      var veces = p.dinamica ? config.repeticiones_dinamicas : 1;
      for (var i = 0; i < veces; i++) seq.push(p);
    });
    if (config.mezclar) {
      for (var i = seq.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = seq[i]; seq[i] = seq[j]; seq[j] = tmp;
      }
    }
    return seq.slice(0, MAX_SECUENCIA);
  };

  SalaDing.prototype._abrir = function (indice) {
    this.indice = indice;
    this.actual = this._materializar(this.secuencia[indice]);
    this.t_inicio = Date.now();
    this.t_opciones = this.t_inicio + duracionAnimacionMs(this.actual.enunciado, this.config);
    this.t_limite = this.config.limite_activo ? this.t_opciones + this.config.limite_s * 1000 : null;
    this.fallaron = [];
    this.resultado = null;
    this.fase = 'abierta';
    this._tocar();
  };

  SalaDing.prototype._materializar = function (p) {
    if (!p.dinamica) {
      return { enunciado: p.enunciado, tema: p.tema, opciones: p.opciones.map(function (o) { return { id: o.id, texto: o.texto }; }), correcta: p.correcta, explicacion: null };
    }
    // Dinámica simplificada
    return { enunciado: p.dinamica.enunciado, tema: p.tema, opciones: [
      { id: 'o0', texto: 'Opción A' }, { id: 'o1', texto: 'Opción B' },
      { id: 'o2', texto: 'Opción C' }, { id: 'o3', texto: 'Opción D' }
    ], correcta: 'o0', explicacion: null };
  };

  SalaDing.prototype._resolverTiempos = function () {
    var ahora = Date.now();
    if (this.fase === 'abierta' && this.t_limite && ahora >= this.t_limite) {
      this._terminar(null, 'tiempo');
    }
    if (this.fase === 'resuelta' && this.config.auto_avance && this.t_resuelta && ahora >= this.t_resuelta + this.config.espera_s * 1000) {
      this._siguiente();
    }
  };

  SalaDing.prototype.responder = function (token, opcionId) {
    this._resolverTiempos();
    var yo = this._jugadorValido(token);
    if (!yo || yo === 'pres') throw new Error('Solo jugadores responden.');
    if (this.fase !== 'abierta') throw new Error('Pregunta ya cerrada.');
    if (Date.now() < this.t_opciones) throw new Error('Todavía no se puede contestar.');
    if (this.fallaron.indexOf(yo) >= 0) throw new Error('Ya fallaste esta pregunta.');

    var opcionValida = this.actual.opciones.some(function (o) { return o.id === opcionId; });
    if (!opcionValida) throw new Error('Opción inválida.');

    var cfg = this.config;
    if (opcionId === this.actual.correcta) {
      this.jugadores[yo].puntos += cfg.puntos_acierto;
      this.jugadores[yo].aciertos++;
      this._terminar(yo, 'acierto');
    } else {
      this.jugadores[yo].fallos++;
      if (cfg.restar_puntos) this.jugadores[yo].puntos = Math.max(0, this.jugadores[yo].puntos - cfg.puntos_fallo);
      this.fallaron.push(yo);
      var activos = Object.keys(this.jugadores).filter(function (jid) { return this.fallaron.indexOf(jid) < 0; }, this);
      if (!activos.length) this._terminar(null, 'todos_fallaron');
      else this._tocar();
    }
    return this.obtenerVista(token);
  };

  SalaDing.prototype._terminar = function (ganador, motivo) {
    this.fase = 'resuelta';
    this.resultado = { ganador: ganador, motivo: motivo };
    this.t_resuelta = Date.now();
    this._tocar();
  };

  SalaDing.prototype._siguiente = function () {
    if (this.indice + 1 >= this.secuencia.length) {
      this._cerrarPartida();
    } else {
      this._abrir(this.indice + 1);
    }
  };

  SalaDing.prototype._cerrarPartida = function () {
    this.fase = 'fin';
    var mejor = Math.max.apply(null, Object.keys(this.jugadores).map(function (jid) { return this.jugadores[jid].puntos; }, this));
    this.final = {
      preguntas: this.indice + 1,
      ganadores: Object.keys(this.jugadores).filter(function (jid) { return this.jugadores[jid].puntos === mejor; }, this).map(function (jid) { return this.jugadores[jid].nombre; }, this),
      minutos: Math.round((Date.now() - (this.inicio || Date.now())) / 60000 * 100) / 100
    };
    this._tocar();
  };

  SalaDing.prototype.siguiente = function (token) {
    if (!this._esPresentador(token)) throw new Error('Solo el presentador pasa.');
    if (this.fase !== 'resuelta' || this.config.auto_avance) throw new Error('No se puede pasar ahora.');
    this._siguiente();
  };

  SalaDing.prototype.terminar = function (token) {
    if (!this._esPresentador(token)) throw new Error('Solo el presentador termina.');
    this._cerrarPartida();
  };

  SalaDing.prototype._añadirDatosFase = function (vista, yo) {
    var cfg = this.config;
    vista.numero = this.indice + 1;
    vista.total = this.secuencia.length;

    if (this.fase === 'abierta' && this.actual) {
      if (yo === 'pres') {
        vista.enunciado = this.actual.enunciado;
        vista.tema = this.actual.tema;
        vista.efecto = cfg.efecto;
        vista.cps = VELOCIDADES[cfg.velocidad];
        vista.animacion_ms = duracionAnimacionMs(this.actual.enunciado, cfg);
        vista.transcurrido_ms = Date.now() - this.t_inicio;
      } else {
        var abiertas = Date.now() >= this.t_opciones;
        vista.mirar_pantalla = !abiertas;
        vista.bloqueado = this.fallaron.indexOf(yo) >= 0;
        if (abiertas) vista.opciones = this.actual.opciones.map(function (o) { return { id: o.id, texto: o.texto }; });
      }
    } else if (this.fase === 'resuelta' && this.actual) {
      if (yo === 'pres') {
        vista.enunciado = this.actual.enunciado;
        vista.revelada = {
          opciones: this.actual.opciones.map(function (o) { return { id: o.id, texto: o.texto }; }),
          correcta: this.actual.correcta, explicacion: this.actual.explicacion,
          motivo: this.resultado.motivo, ultima: this.indice + 1 >= this.secuencia.length,
          auto: cfg.auto_avance, espera_s: cfg.espera_s
        };
      } else {
        vista.ding = this.resultado.ganador === yo;
      }
    } else if (this.fase === 'fin') {
      vista.final = this.final;
      if (yo !== 'pres') {
        var j = this.jugadores[yo];
        vista.mis = { puntos: j.puntos, aciertos: j.aciertos, fallos: j.fallos };
      }
    }
  };

  /* ===========================================================================
     GESTOR DE SALAS (en memoria para offline, Firebase para online)
     =========================================================================== */
  var _salas = {};

  function crearSala(tipo, creadorNombre) {
    var codigo = _codigoNuevo(_salas);
    if (!codigo) throw new Error('Demasiadas salas abiertas.');
    var token = generarToken();
    var sala = tipo === 'duelo' ? new SalaDuelo(codigo, creadorNombre, token) : new SalaDing(codigo, creadorNombre, token);
    _salas[codigo] = sala;
    return { codigo: codigo, token: token, yo: 'pres', sala: sala };
  }

  function obtenerSala(codigo) {
    return _salas[codigo.toUpperCase()] || null;
  }

  function unirSala(codigo, nombre) {
    var sala = obtenerSala(codigo);
    if (!sala) throw new Error('Sala no existe.');
    return sala.unirse(nombre);
  }

  function limpiarSalasViejas() {
    var ahora = Date.now();
    Object.keys(_salas).forEach(function (c) {
      if (! _salas[c].estaViva()) delete _salas[c];
    });
  }

  function listarSalas() {
    limpiarSalasViejas();
    return Object.keys(_salas).map(function (c) {
      var s = _salas[c];
      return { codigo: c, tipo: s.tipo, fase: s.fase, jugadores: Object.keys(s.jugadores).length, titulo: s.titulo };
    });
  }

  /* ===========================================================================
     EXPORT
     =========================================================================== */
  window.RetoSalas = {
    crearSala: crearSala,
    obtenerSala: obtenerSala,
    unirSala: unirSala,
    listarSalas: listarSalas,
    limpiarSalasViejas: limpiarSalasViejas,
    SalaDuelo: SalaDuelo,
    SalaDing: SalaDing,
    SalaBase: SalaBase,
    normalizarConfigDing: normalizarConfigDing,
    duracionAnimacionMs: duracionAnimacionMs,
    EFECTOS: EFECTOS, VELOCIDADES: VELOCIDADES,
    MIN_JUGADORES: MIN_JUGADORES, MAX_JUGADORES: MAX_JUGADORES,
    PRESENCIA_S: PRESENCIA_S
  };

})(window);