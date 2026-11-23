/* R.E.T.O. - Ding! Arena, quiz bowl de 2 a 4 jugadores (puerto de logica/ding.py)
   Quien presenta sube el test y sus reglas; los jugadores contestan desde su
   dispositivo y el primero en acertar se lleva el punto. Todo el estado vive
   en el dispositivo del presentador (ver scripts/reto-api.js). */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var B = nodo ? require('./_base.js') : raiz.RetoLogica._base;
  var D = B.dependencias(raiz, ['red', 'dinamicas', 'sala']);
  var m = fabrica(B, D);
  if (nodo) module.exports = m; else B.registrar(raiz, 'ding', m);
})(typeof self !== 'undefined' ? self : this, function (B, D) {
  'use strict';
  var PyRandom = D.azar.PyRandom, ValueError = B.ValueError, red = D.red, dinamicas = D.dinamicas, sala = D.sala;
  var ErrorSala = sala.ErrorSala, recortar = sala.recortar, has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var LETRAS_CODIGO = sala.LETRAS_CODIGO, LARGO_CODIGO = sala.LARGO_CODIGO, MAX_ENUNCIADO = sala.MAX_ENUNCIADO, MAX_OPCION = sala.MAX_OPCION,
    MAX_TEMA = sala.MAX_TEMA, PRESENCIA_S = sala.PRESENCIA_S;

  var MAX_SALAS = 10, SALA_VIVA_S = 3 * 60 * 60, MIN_JUGADORES = 2, MAX_JUGADORES = 4, MAX_FUENTE = 60, MAX_SECUENCIA = 60;
  var MAX_FORMULA = 150, MAX_VARIABLES = 8, MAX_DISTRACTORES = 6, LIMITE_VARIABLE = 100000;
  var EFECTOS = ['maquina', 'caen', 'giran', 'aparecen', 'ninguno'];
  var VELOCIDADES = { lenta: 15, normal: 30, rapida: 60 };
  var MARGEN_ANIMACION_MS = 400;
  var CONFIG_EDITABLE = ['num_preguntas', 'mezclar', 'repeticiones_dinamicas', 'efecto', 'velocidad', 'auto_avance', 'espera_s', 'restar_puntos',
    'puntos_acierto', 'puntos_fallo', 'limite_activo', 'limite_s'];

  function entero(v, defecto, minimo, maximo) {
    var n;
    try { n = B.aInt(v === undefined ? null : v); } catch (e) { if (e instanceof B.ConvError) n = defecto; else throw e; }
    return Math.max(minimo, Math.min(maximo, n));
  }
  function ev(cfg, k, def) { return cfg[k] === undefined ? def : cfg[k]; }

  function normalizarConfig(cfg) {
    cfg = B.esObjeto(cfg) ? cfg : {};
    var efecto = ev(cfg, 'efecto', 'maquina'), velocidad = ev(cfg, 'velocidad', 'normal');
    return {
      num_preguntas: entero(ev(cfg, 'num_preguntas', 0), 0, 0, MAX_SECUENCIA),
      mezclar: B.pyBool(ev(cfg, 'mezclar', true)),
      repeticiones_dinamicas: entero(ev(cfg, 'repeticiones_dinamicas', 5), 5, 1, 10),
      efecto: (typeof efecto === 'string' && EFECTOS.indexOf(efecto) >= 0) ? efecto : 'maquina',
      velocidad: (typeof velocidad === 'string' && has(VELOCIDADES, velocidad)) ? velocidad : 'normal',
      auto_avance: B.pyBool(ev(cfg, 'auto_avance', true)),
      espera_s: entero(ev(cfg, 'espera_s', 4), 4, 1, 30),
      restar_puntos: B.pyBool(ev(cfg, 'restar_puntos', true)),
      puntos_acierto: entero(ev(cfg, 'puntos_acierto', 10), 10, 1, 100),
      puntos_fallo: entero(ev(cfg, 'puntos_fallo', 5), 5, 1, 100),
      limite_activo: B.pyBool(ev(cfg, 'limite_activo', false)),
      limite_s: entero(ev(cfg, 'limite_s', 30), 30, 5, 120)
    };
  }

  function duracionAnimacionMs(texto, config) {
    if (config.efecto === 'ninguno' || !texto) return 0;
    return B.pyInt(B.pyLen(texto) * 1000 / VELOCIDADES[config.velocidad]) + MARGEN_ANIMACION_MS;
  }

  function numero(v, defecto) {
    defecto = defecto === undefined ? 0.0 : defecto;
    var n;
    try { n = B.aFloat(v === undefined ? null : v); } catch (e) { if (e instanceof B.ConvError) return defecto; throw e; }
    if (n !== n || Math.abs(n) > LIMITE_VARIABLE) throw new ErrorSala('Un número de una pregunta dinámica es demasiado grande.');
    return n;
  }
  function cuenta(texto, sub) { return texto.split(sub).length - 1; }

  function acotarDinamica(d) {
    if (!B.esObjeto(d)) throw new ErrorSala('Una pregunta dinámica no tiene el formato correcto.');
    var formula = recortar(d.formula, MAX_FORMULA + 1);
    if (!formula || B.pyLen(formula) > MAX_FORMULA) throw new ErrorSala('La fórmula de una pregunta dinámica está vacía o es muy larga.');
    if (cuenta(formula, '**') > 1) throw new ErrorSala('Una fórmula solo puede tener una potencia.');
    var variables = B.pyBool(d.variables) ? d.variables : [];
    if (!Array.isArray(variables) || variables.length > MAX_VARIABLES) throw new ErrorSala('Una pregunta dinámica tiene demasiadas variables.');
    var vs = variables.map(function (v) {
      if (!B.esObjeto(v)) throw new ErrorSala('Una variable no tiene el formato correcto.');
      return { nombre: recortar(has(v, 'nombre') ? v.nombre : v.name, 30), min: numero(v.min), max: numero(v.max),
        paso: numero(v.paso === undefined ? 1 : v.paso, 1.0) || 1.0,
        decimales: Math.max(0, Math.min(6, B.pyInt(numero(v.decimales === undefined ? 0 : v.decimales)))) };
    });
    var ds = [];
    (B.pyBool(d.distractores) ? d.distractores : []).slice(0, MAX_DISTRACTORES).forEach(function (x) {
      if (B.esObjeto(x)) {
        var f = recortar(x.formula, MAX_FORMULA + 1);
        if (B.pyLen(f) > MAX_FORMULA || cuenta(f, '**') > 1) throw new ErrorSala('Un distractor tiene una fórmula no permitida.');
        ds.push({ formula: f, clase: recortar(x.clase, 20) || 'concepto' });
      }
    });
    var out = { enunciado: recortar(d.enunciado, MAX_ENUNCIADO), variables: vs, formula: formula,
      decimales: Math.max(0, Math.min(6, B.pyInt(numero(d.decimales === undefined ? 2 : d.decimales, 2)))), distractores: ds,
      opcionesAMostrar: Math.max(2, Math.min(6, B.pyInt(numero(d.opcionesAMostrar === undefined ? 4 : d.opcionesAMostrar, 4)))) };
    try { dinamicas.generar_instancia(out, 1); }
    catch (e) { if (e instanceof ValueError || e instanceof TypeError) throw new ErrorSala('Una pregunta dinámica no se puede calcular: ' + e.message); throw e; }
    return out;
  }

  function acotarTest(preguntas) {
    if (!Array.isArray(preguntas) || !preguntas.length) throw new ErrorSala('El test tiene que tener al menos una pregunta.');
    var limpio = [];
    preguntas.slice(0, MAX_FUENTE).forEach(function (p) {
      if (!B.esObjeto(p)) throw new ErrorSala('Una pregunta no tiene el formato correcto.');
      var base = { id: recortar(p.id, 80) || ('q' + limpio.length), tema: recortar(p.tema, MAX_TEMA) };
      if (p.dinamica !== undefined && p.dinamica !== null) {
        base.dinamica = acotarDinamica(p.dinamica);
        base.enunciado = base.dinamica.enunciado;
      } else {
        var ops = p.opciones;
        if (!Array.isArray(ops) || ops.length < 2) throw new ErrorSala('Una pregunta fija necesita al menos dos opciones.');
        base.enunciado = recortar(p.enunciado, MAX_ENUNCIADO);
        base.opciones = [];
        ops.slice(0, 6).forEach(function (o, i) {
          if (B.esObjeto(o)) base.opciones.push({ id: recortar(o.id, 40) || ('o' + i), texto: recortar(o.texto, MAX_OPCION) });
        });
        base.correcta = recortar(p.correcta, 40);
        if (!base.opciones.some(function (o) { return o.id === base.correcta; })) throw new ErrorSala('Una pregunta fija no tiene marcada su respuesta correcta.');
      }
      if (!base.enunciado) throw new ErrorSala('Una pregunta no tiene enunciado.');
      limpio.push(base);
    });
    return limpio;
  }

  function armarSecuencia(fuente, config, rng) {
    var seq = [];
    fuente.forEach(function (p) {
      var veces = has(p, 'dinamica') ? config.repeticiones_dinamicas : 1;
      for (var i = 0; i < veces; i++) seq.push(p);
    });
    seq = seq.slice(0, MAX_SECUENCIA);
    if (config.mezclar) rng.shuffle(seq);
    return seq;
  }

  function materializar(p, rng) {
    if (!has(p, 'dinamica')) return { enunciado: p.enunciado, tema: p.tema, opciones: p.opciones.map(function (o) { return Object.assign({}, o); }), correcta: p.correcta, explicacion: null };
    var inst = dinamicas.generar_instancia(p.dinamica, rng.randrange(Math.pow(2, 30))), opciones = [], correcta = null;
    inst.opciones.forEach(function (o, i) {
      opciones.push({ id: 'o' + i, texto: o.texto });
      if (o.correcta) correcta = 'o' + i;
    });
    return { enunciado: inst.enunciado, tema: p.tema, opciones: opciones, correcta: correcta, explicacion: inst.explicacion === undefined ? null : inst.explicacion };
  }

  function Dings(opciones) {
    opciones = opciones || {};
    this._reloj = opciones.reloj || function () { return Date.now() / 1000; };
    this._rng = opciones.rng || new PyRandom();
    this._azar = opciones.azar || B.azarSeguro;
    this._salas = {};
  }
  var P = Dings.prototype;
  P._ahora = function () { return this._reloj(); };
  P._sala = function (codigo) {
    var clave = B.pyStrip(B.pyStr(B.pyBool(codigo) ? codigo : '')).toUpperCase();
    if (!has(this._salas, clave)) throw new ErrorSala('No existe esa sala. Revisa el código.', 404);
    return this._salas[clave];
  };
  P._yo = function (s, token) {
    if (B.pyBool(token) && s.presentador.token === B.pyStr(token)) return 'pres';
    var ids = Object.keys(s.jugadores);
    for (var i = 0; i < ids.length; i++) if (B.pyBool(token) && s.jugadores[ids[i]].token === B.pyStr(token)) return ids[i];
    throw new ErrorSala('No eres parte de esta sala.', 403);
  };
  P._tocar = function (s) { s.version += 1; s.actividad = this._ahora(); };
  P._limpiar_viejas = function () {
    var ahora = this._ahora(), self = this;
    Object.keys(this._salas).forEach(function (c) { if (ahora - self._salas[c].actividad > SALA_VIVA_S) delete self._salas[c]; });
  };
  P._codigo_nuevo = function () {
    for (var n = 0; n < 200; n++) {
      var c = ''; for (var i = 0; i < LARGO_CODIGO; i++) c += this._azar.choice(LETRAS_CODIGO);
      if (!has(this._salas, c)) return c;
    }
    throw new ErrorSala('No pude crear un código libre. Intenta otra vez.');
  };
  P._jugador = function (nombre) {
    return { nombre: red.limpiar_nombre(nombre), token: this._azar.token_urlsafe(16), puntos: 0, aciertos: 0, fallos: 0, visto: this._ahora() };
  };
  P.crear = function (nombre) {
    this._limpiar_viejas();
    if (Object.keys(this._salas).length >= MAX_SALAS) throw new ErrorSala('Hay demasiadas salas abiertas. Prueba en un rato.');
    var codigo = this._codigo_nuevo();
    var pres = { nombre: red.limpiar_nombre(B.pyBool(nombre) ? nombre : 'Presentador'), token: this._azar.token_urlsafe(16), visto: this._ahora() };
    this._salas[codigo] = { codigo: codigo, version: 1, actividad: this._ahora(), fase: 'espera', config: normalizarConfig({}), presentador: pres,
      jugadores: {}, fuente: null, titulo: '', secuencia: [], indice: -1, actual: null, t_inicio: null, t_opciones: null, t_limite: null,
      t_resuelta: null, fallaron: [], resultado: null, inicio: null, final: null };
    return { codigo: codigo, token: pres.token, yo: 'pres' };
  };
  P.unirse = function (codigo, nombre) {
    var s = this._sala(codigo);
    if (s.fase !== 'espera') throw new ErrorSala('La partida ya empezó.');
    var n = Object.keys(s.jugadores).length;
    if (n >= MAX_JUGADORES) throw new ErrorSala('La sala ya tiene ' + MAX_JUGADORES + ' jugadores.');
    var jid = 'p' + (n + 1), j = this._jugador(nombre);
    s.jugadores[jid] = j;
    this._tocar(s);
    return { codigo: s.codigo, token: j.token, yo: jid };
  };
  P._solo_presentador = function (s, token) { if (this._yo(s, token) !== 'pres') throw new ErrorSala('Eso solo lo hace quien presenta.', 403); };
  P.configurar = function (codigo, token, cambios) {
    var s = this._sala(codigo);
    this._solo_presentador(s, token);
    if (s.fase !== 'espera') throw new ErrorSala('La configuración se hace antes de empezar la partida.');
    var mezcla = Object.assign({}, s.config);
    if (B.esObjeto(cambios)) Object.keys(cambios).forEach(function (k) { if (CONFIG_EDITABLE.indexOf(k) >= 0) mezcla[k] = cambios[k]; });
    s.config = normalizarConfig(mezcla);
    this._tocar(s);
    return this._vista(s, 'pres');
  };
  P.cargar_test = function (codigo, token, titulo, preguntas) {
    var s = this._sala(codigo);
    this._solo_presentador(s, token);
    if (s.fase !== 'espera') throw new ErrorSala('Ya no se puede cambiar el test: la partida empezó.');
    s.fuente = acotarTest(preguntas);
    s.titulo = recortar(titulo, 80);
    this._tocar(s);
    return this._vista(s, 'pres');
  };
  P._activos = function (s) {
    var ahora = this._ahora();
    return Object.keys(s.jugadores).filter(function (jid) { return ahora - s.jugadores[jid].visto <= PRESENCIA_S; });
  };
  P._abrir = function (s, indice) {
    var ahora = this._ahora();
    s.indice = indice;
    s.actual = materializar(s.secuencia[indice], this._rng);
    s.t_inicio = ahora;
    s.t_opciones = ahora + duracionAnimacionMs(s.actual.enunciado, s.config) / 1000.0;
    s.t_limite = s.config.limite_activo ? s.t_opciones + s.config.limite_s : null;
    s.fallaron = []; s.resultado = null; s.t_resuelta = null; s.fase = 'abierta';
  };
  P._terminar = function (s, ganador, motivo) {
    s.fase = 'resuelta'; s.resultado = { ganador: ganador, motivo: motivo }; s.t_resuelta = this._ahora();
    this._tocar(s);
  };
  P._siguiente = function (s) {
    if (s.indice + 1 >= s.secuencia.length) this._cerrar_partida(s); else this._abrir(s, s.indice + 1);
    this._tocar(s);
  };
  P._resolver_tiempos = function (s) {
    var ahora = this._ahora();
    if (s.fase === 'abierta' && s.t_limite !== null && ahora >= s.t_limite) this._terminar(s, null, 'tiempo');
    if (s.fase === 'resuelta' && s.config.auto_avance && ahora >= s.t_resuelta + s.config.espera_s) this._siguiente(s);
  };
  P.accion = function (codigo, token, datos) {
    var s = this._sala(codigo), yo = this._yo(s, token);
    this._resolver_tiempos(s);
    datos = B.esObjeto(datos) ? datos : {};
    var tipo = B.pyStr(datos.tipo === undefined ? '' : datos.tipo);
    if (yo === 'pres') this._accion_presentador(s, tipo); else this._accion_jugador(s, yo, tipo, datos);
    return this._vista(s, yo);
  };
  P._accion_presentador = function (s, tipo) {
    if (tipo === 'empezar') {
      if (s.fase !== 'espera') throw new ErrorSala('La partida ya empezó.');
      if (Object.keys(s.jugadores).length < MIN_JUGADORES) throw new ErrorSala('Hacen falta al menos ' + MIN_JUGADORES + ' jugadores.');
      if (!s.fuente) throw new ErrorSala('Primero sube un test.');
      var seq = armarSecuencia(s.fuente, s.config, this._rng);
      if (s.config.num_preguntas) seq = seq.slice(0, s.config.num_preguntas);
      s.secuencia = seq;
      s.inicio = this._ahora();
      this._abrir(s, 0);
      this._tocar(s);
    } else if (tipo === 'siguiente') {
      if (s.fase !== 'resuelta' || s.config.auto_avance) throw new ErrorSala('Ahora no se puede pasar a la siguiente.');
      this._siguiente(s);
    } else if (tipo === 'terminar') {
      if (s.fase === 'espera') throw new ErrorSala('La partida todavía no empieza.');
      this._cerrar_partida(s);
      this._tocar(s);
    } else throw new ErrorSala('Eso no se puede hacer.');
  };
  P._accion_jugador = function (s, jid, tipo, datos) {
    if (tipo !== 'responder') throw new ErrorSala('Eso no se puede hacer.');
    var j = s.jugadores[jid];
    if (s.fase !== 'abierta') throw new ErrorSala('Esa pregunta ya se cerró.');
    if (this._ahora() < s.t_opciones) throw new ErrorSala('Todavía no se puede contestar.');
    if (s.fallaron.indexOf(jid) >= 0) throw new ErrorSala('Ya no puedes contestar esta pregunta.');
    var op = B.pyStr(datos.opcion === undefined ? '' : datos.opcion);
    if (!s.actual.opciones.some(function (o) { return o.id === op; })) throw new ErrorSala('Esa opción no existe.');
    var cfg = s.config;
    if (op === s.actual.correcta) {
      j.puntos += cfg.puntos_acierto; j.aciertos += 1;
      this._terminar(s, jid, 'acierto');
    } else {
      j.fallos += 1;
      if (cfg.restar_puntos) j.puntos = Math.max(0, j.puntos - cfg.puntos_fallo);
      s.fallaron.push(jid);
      if (!this._activos(s).some(function (a) { return s.fallaron.indexOf(a) < 0; })) this._terminar(s, null, 'todos_fallaron');
      else this._tocar(s);
    }
  };
  P._cerrar_partida = function (s) {
    s.fase = 'fin';
    var ids = Object.keys(s.jugadores), mejor = ids.length ? Math.max.apply(null, ids.map(function (k) { return s.jugadores[k].puntos; })) : 0;
    var ahora = this._ahora();
    s.final = { preguntas: s.indice >= 0 ? s.indice + 1 : 0, ganadores: ids.filter(function (k) { return s.jugadores[k].puntos === mejor; }),
      minutos: B.pyRound((ahora - (B.pyBool(s.inicio) ? s.inicio : ahora)) / 60, 2) };
  };
  P._opciones_abiertas = function (s) { return s.fase === 'abierta' && this._ahora() >= s.t_opciones; };
  P.firma = function (s) {
    var ahora = this._ahora();
    var bits = Object.keys(s.jugadores).map(function (k) { return ahora - s.jugadores[k].visto <= PRESENCIA_S ? '1' : '0'; }).join('');
    return s.version + '.' + bits + '.' + (this._opciones_abiertas(s) ? 1 : 0);
  };
  P._vista = function (s, yo) {
    var ahora = this._ahora(), fase = s.fase, cfg = s.config, nombres = {}, ids = Object.keys(s.jugadores);
    ids.forEach(function (k) { nombres[k] = s.jugadores[k].nombre; });
    var vista = { cambio: true, firma: this.firma(s), codigo: s.codigo, yo: yo, rol: yo === 'pres' ? 'presentador' : 'jugador', fase: fase,
      titulo: s.titulo, tiene_test: B.pyBool(s.fuente), preguntas_en_test: s.fuente ? s.fuente.length : 0, total: s.secuencia.length,
      numero: s.indice >= 0 ? s.indice + 1 : 0, minimo: MIN_JUGADORES, maximo: MAX_JUGADORES,
      jugadores: ids.map(function (k) { return { id: k, nombre: s.jugadores[k].nombre, conectado: ahora - s.jugadores[k].visto <= PRESENCIA_S }; }) };
    if (yo === 'pres') vista.config = Object.assign({}, cfg); else vista.mis_puntos = s.jugadores[yo].puntos;
    var a = s.actual;
    if (fase === 'abierta' && a) {
      if (yo === 'pres') {
        Object.assign(vista, { enunciado: a.enunciado, tema: a.tema, efecto: cfg.efecto, cps: VELOCIDADES[cfg.velocidad],
          animacion_ms: duracionAnimacionMs(a.enunciado, cfg), transcurrido_ms: B.pyInt((ahora - s.t_inicio) * 1000) });
      } else {
        var abiertas = this._opciones_abiertas(s);
        vista.mirar_pantalla = !abiertas;
        vista.bloqueado = s.fallaron.indexOf(yo) >= 0;
        if (abiertas) vista.opciones = a.opciones.map(function (o) { return Object.assign({}, o); });
      }
    } else if (fase === 'resuelta' && a) {
      var r = s.resultado;
      if (yo === 'pres') {
        vista.enunciado = a.enunciado;
        vista.revelada = { opciones: a.opciones.map(function (o) { return Object.assign({}, o); }), correcta: a.correcta, explicacion: a.explicacion,
          motivo: r.motivo, ultima: s.indice + 1 >= s.secuencia.length, auto: cfg.auto_avance, espera_s: cfg.espera_s };
      } else vista.ding = r.ganador === yo;
    } else if (fase === 'fin') {
      var f = s.final;
      vista.final = { preguntas: f.preguntas, minutos: f.minutos, ganadores: f.ganadores.map(function (g) { return nombres[g]; }) };
      if (yo !== 'pres') { var j = s.jugadores[yo]; vista.mis = { puntos: j.puntos, aciertos: j.aciertos, fallos: j.fallos }; }
    }
    return vista;
  };
  P.estado = function (codigo, token, firma) {
    var s = this._sala(codigo), yo = this._yo(s, token);
    (yo === 'pres' ? s.presentador : s.jugadores[yo]).visto = this._ahora();
    this._resolver_tiempos(s);
    var f = this.firma(s);
    if (firma !== undefined && firma !== null && firma === f) return { cambio: false, firma: f };
    return this._vista(s, yo);
  };
  P.cerrar = function (codigo, token) {
    var s = this._sala(codigo);
    this._solo_presentador(s, token);
    delete this._salas[s.codigo];
    return { cerrada: true };
  };
  P.cuantas = function () { return Object.keys(this._salas).length; };

  return { Dings: Dings, normalizar_config: normalizarConfig, duracion_animacion_ms: duracionAnimacionMs, acotar_test: acotarTest,
    armar_secuencia: armarSecuencia, materializar: materializar, EFECTOS: EFECTOS, VELOCIDADES: VELOCIDADES };
});
