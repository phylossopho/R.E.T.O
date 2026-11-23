/* R.E.T.O. - Aventura contra la computadora (puerto de logica/pve.py)
   Antes el servidor guardaba cada batalla en memoria; ahora la guarda este
   objeto, en el propio navegador. Las reglas de la batalla están en rpg.js. */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var B = nodo ? require('./_base.js') : raiz.RetoLogica._base;
  var D = B.dependencias(raiz, ['red', 'rpg']);
  var m = fabrica(B, D);
  if (nodo) module.exports = m; else B.registrar(raiz, 'pve', m);
})(typeof self !== 'undefined' ? self : this, function (B, D) {
  'use strict';
  var PyRandom = D.azar.PyRandom, ValueError = B.ValueError, red = D.red, rpg = D.rpg;
  var MAX_BATALLAS = 200, BATALLA_VIVA_S = 2 * 60 * 60, MAX_PREGUNTAS = 60;
  var DIFICULTADES = { facil: 80, normal: 100, dificil: 120 };
  var MAX_ENUNCIADO = 500, MAX_OPCION = 200;

  function ErrorPve(mensaje, http) { this.name = 'ErrorPve'; this.message = mensaje; this.http = http || 400; this.stack = (new Error(mensaje)).stack; }
  ErrorPve.prototype = Object.create(ValueError.prototype);
  ErrorPve.prototype.constructor = ErrorPve;

  function recortar(texto, largo) { return B.pySlice(B.pyStrip(B.pyStr(texto === undefined || texto === null ? '' : texto)), largo); }
  function tomar(o, k) { return B.esObjeto(o) ? o[k] : undefined; }

  function acotarPreguntas(preguntas) {
    if (!Array.isArray(preguntas) || !preguntas.length) throw new ErrorPve('El test no tiene preguntas jugables.');
    if (preguntas.length > MAX_PREGUNTAS) throw new ErrorPve('Demasiadas preguntas (máximo ' + MAX_PREGUNTAS + ').');
    return preguntas.map(function (p) {
      if (!B.esObjeto(p) || !Array.isArray(p.opciones)) throw new ErrorPve('Una pregunta no tiene el formato correcto.');
      return { id: recortar(p.id, 80), enunciado: recortar(p.enunciado, MAX_ENUNCIADO), tema: recortar(p.tema, 80),
        opciones: p.opciones.slice(0, 6).map(function (o) { return { id: recortar(tomar(o, 'id'), 40), texto: recortar(tomar(o, 'texto'), MAX_OPCION) }; }),
        correcta: recortar(p.correcta, 40) };
    });
  }

  function intOCero(v) { return Math.max(0, B.aInt(B.pyBool(v) ? v : 0)); }

  function Aventuras(opciones) {
    opciones = opciones || {};
    this._reloj = opciones.reloj || function () { return Date.now() / 1000; };
    this._azar = opciones.azar || B.azarSeguro;
    this._b = {};
  }
  var P = Aventuras.prototype;

  P._limpiar = function () {
    var ahora = this._reloj(), self = this;
    Object.keys(this._b).forEach(function (t) { if (ahora - self._b[t].actividad > BATALLA_VIVA_S) delete self._b[t]; });
  };
  P._batalla = function (token) {
    var clave = B.pyStr(B.pyBool(token) ? token : ''), b = Object.prototype.hasOwnProperty.call(this._b, clave) ? this._b[clave] : null;
    if (!b) throw new ErrorPve('Esa batalla ya no existe. Empieza otra.', 404);
    return b;
  };
  P.iniciar = function (datos) {
    if (!B.esObjeto(datos)) throw new ErrorPve('Los datos de la batalla no tienen el formato correcto.');
    this._limpiar();
    if (Object.keys(this._b).length >= MAX_BATALLAS) throw new ErrorPve('Hay muchas batallas en curso. Prueba en un momento.');
    var preguntas = acotarPreguntas(datos.preguntas);
    var enemigo = B.esObjeto(datos.enemigo) ? datos.enemigo : {};
    var dificultad = (typeof datos.dificultad === 'string' && Object.prototype.hasOwnProperty.call(DIFICULTADES, datos.dificultad)) ? datos.dificultad : 'normal';
    var cfg = { modo: 'pve', dano_base: datos.dano_base === undefined ? 10 : datos.dano_base, ventaja: datos.ventaja === undefined ? 3 : datos.ventaja,
      con_tiempo: B.pyBool(datos.con_tiempo === undefined ? false : datos.con_tiempo),
      segundos_pregunta: datos.segundos === undefined ? 30 : datos.segundos, max_por_pregunta: 1, max_turnos: 400 };
    var aciertosAntes, entregadosAntes, entregadosHoy;
    try { aciertosAntes = intOCero(datos.aciertos_antes); entregadosAntes = intOCero(datos.entregados_antes); entregadosHoy = intOCero(datos.entregados_hoy); }
    catch (e) { if (e instanceof B.ConvError) aciertosAntes = entregadosAntes = entregadosHoy = 0; else throw e; }
    var estado;
    try {
      estado = rpg.nueva_batalla(cfg,
        { nombre: red.limpiar_nombre(datos.nombre), clase: datos.clase, preguntas: preguntas, equipo: B.pyBool(datos.equipo) ? datos.equipo.slice() : [] },
        { nombre: red.limpiar_nombre(B.pyBool(enemigo.nombre) ? enemigo.nombre : 'Enemigo'), clase: B.pyBool(enemigo.clase) ? enemigo.clase : 'guerrero',
          preguntas: preguntas, equipo: [], pv_max: DIFICULTADES[dificultad] });
    } catch (e) { if (e instanceof ValueError) throw new ErrorPve(e.message); throw e; }
    var token = this._azar.token_urlsafe(18), t = this._reloj();
    this._b[token] = { estado: estado, creada: t, actividad: this._reloj(), aciertos_antes: aciertosAntes, entregados_antes: entregadosAntes,
      entregados_hoy: entregadosHoy, limite: null, inicio: null, ticks: 0, premios: null, sesion: null };
    this._poner_limite(this._b[token]);
    var vista = this.estado(token); vista.token = token;
    return vista;
  };
  P._poner_limite = function (b, nueva) {
    nueva = nueva === undefined ? true : nueva;
    var e = b.estado;
    if (nueva) { b.ticks = 0; b.inicio = this._reloj(); }
    if (e.config.con_tiempo && e.fase === 'responder') b.limite = b.inicio + Math.max(5, e.config.segundos_pregunta + e.pregunta.tiempo_extra);
    else b.limite = null;
  };
  P._aplicar_tiempo = function (b) {
    var e = b.estado;
    if (b.limite === null || e.fase !== 'responder') return;
    var ticks = rpg.segundos_con_perdida(this._reloj() - b.inicio, e.pregunta.tiempo_extra);
    if (ticks > b.ticks) { rpg.tiempo_pasado(e, ticks - b.ticks); b.ticks = ticks; }
    if (e.ganador === null && e.fase === 'responder' && b.limite !== null && this._reloj() >= b.limite) {
      rpg.agotar_tiempo(e);
      this._poner_limite(b);
    }
  };
  P.accion = function (token, datos) {
    var b = this._batalla(token), e = b.estado;
    if (e.ganador !== null) throw new ErrorPve('La batalla ya terminó.');
    this._aplicar_tiempo(b);
    datos = B.esObjeto(datos) ? datos : {};
    var tipo = datos.tipo, turno = datos.turno;
    if (turno !== undefined && turno !== null && (tipo === 'responder' || tipo === 'power_up') && e.fase === 'responder' && turno !== e.turno)
      throw new ErrorPve('Se acabó el tiempo de esa pregunta. Ya viene otra.');
    try {
      if (e.ganador !== null) { /* nada */ }
      else if (tipo === 'responder') {
        var opcion = datos.opcion, ms = null;
        if (e.config.con_tiempo && b.limite !== null) ms = Math.max(0, (this._reloj() - b.inicio) * 1000);
        rpg.responder(e, 'j1', (opcion === undefined || opcion === null) ? null : B.pyStr(opcion), ms);
        this._poner_limite(b);
      } else if (tipo === 'power_up') {
        rpg.usar_power_up(e, 'j1', B.pyStr(datos.id === undefined ? '' : datos.id));
        this._poner_limite(b, false);
      } else if (tipo === 'abandonar') { e.ganador = 'j2'; e.motivo = 'abandono'; e.fase = 'fin'; }
      else throw new ErrorPve('Esa jugada no existe.');
    } catch (err) {
      if (err instanceof ErrorPve) throw err;
      if (err instanceof ValueError) throw new ErrorPve(err.message);
      throw err;
    }
    b.actividad = this._reloj();
    return this.estado(token);
  };
  P._cerrar = function (b) {
    if (b.premios !== null) return;
    var e = b.estado, j1 = e.jugadores.j1, aciertos = j1.aciertos, rng = new PyRandom(B.pyStr(e.semilla) + '-premios');
    if (rpg.TOPE_PREMIOS_DIA - b.entregados_hoy <= 0) { b.aciertos_contados = 0; b.premios = []; b.bloqueados = 0; }
    else {
      b.aciertos_contados = aciertos;
      var r = rpg.sortear_premios(b.aciertos_antes, b.aciertos_antes + aciertos, rng, e.config.con_tiempo, b.entregados_antes, b.entregados_hoy);
      b.premios = r.premios; b.bloqueados = r.bloqueados;
    }
    var minutos = Math.max(0.0, (this._reloj() - b.creada) / 60);
    b.sesion = { tipo: 'rpg', minutos: B.pyRound(minutos, 2), rondas: e.motivo !== 'abandono' ? 1 : 0, preguntas: aciertos + j1.fallos };
  };
  P.estado = function (token) {
    var b = this._batalla(token);
    this._aplicar_tiempo(b);
    var e = b.estado;
    rpg._revisar_fin(e);
    var vista = { batalla: rpg.estado_publico(e, 'j1'), restante: b.limite === null ? null : Math.max(0, B.pyRound(b.limite - this._reloj(), 1)),
      premios: null, resumen: null, sesion: null };
    if (e.ganador !== null) {
      this._cerrar(b);
      vista.resumen = rpg.resumen_final(e);
      vista.premios = b.premios.slice();
      vista.premios_bloqueados = b.bloqueados;
      vista.aciertos_contados = b.aciertos_contados;
      vista.tope_premios_dia = rpg.TOPE_PREMIOS_DIA - b.entregados_hoy - b.premios.length <= 0;
      vista.sesion = Object.assign({}, b.sesion);
      vista.gano = e.ganador === 'j1';
    }
    return vista;
  };
  P.cuantas = function () { return Object.keys(this._b).length; };

  return { ErrorPve: ErrorPve, Aventuras: Aventuras, acotar_preguntas: acotarPreguntas, DIFICULTADES: DIFICULTADES };
});
