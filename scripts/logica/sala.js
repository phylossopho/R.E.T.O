/* R.E.T.O. - Salas de duelo entre dos jugadores (puerto de logica/sala.py)
   Antes vivían en el servidor; ahora las guarda el dispositivo que "hospeda" el
   duelo (el de quien crea la sala) y los demás le hablan por la conexión directa.
   Reglas, mensajes y tiempos son los de siempre. */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var B = nodo ? require('./_base.js') : raiz.RetoLogica._base;
  var D = B.dependencias(raiz, ['red', 'rpg']);
  var m = fabrica(B, D);
  if (nodo) module.exports = m; else B.registrar(raiz, 'sala', m);
})(typeof self !== 'undefined' ? self : this, function (B, D) {
  'use strict';
  var ValueError = B.ValueError, red = D.red, rpg = D.rpg, has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var LETRAS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', LARGO_CODIGO = 4, MAX_SALAS = 20, SALA_VIVA_S = 2 * 60 * 60;
  var PRESENCIA_S = 8, ABANDONO_S = 90, MAX_ENUNCIADO = 500, MAX_OPCION = 200, MAX_TEMA = 80;
  var CONFIG_EDITABLE = ['dano_base', 'ventaja', 'contraataque', 'con_tiempo', 'segundos_pregunta'];

  function ErrorSala(mensaje, http) { this.name = 'ErrorSala'; this.message = mensaje; this.http = http || 400; this.stack = (new Error(mensaje)).stack; }
  ErrorSala.prototype = Object.create(ValueError.prototype);
  ErrorSala.prototype.constructor = ErrorSala;

  function recortar(texto, largo) { return B.pySlice(B.pyStrip(B.pyStr(texto === undefined || texto === null ? '' : texto)), largo); }
  function tomar(o, k) { return B.esObjeto(o) ? o[k] : undefined; }

  function acotarMazo(preguntas) {
    if (!Array.isArray(preguntas)) throw new ErrorSala('El mazo tiene que ser una lista de preguntas.');
    return preguntas.map(function (p) {
      if (!B.esObjeto(p)) throw new ErrorSala('Una pregunta no tiene el formato correcto.');
      if (!Array.isArray(p.opciones)) throw new ErrorSala('Una pregunta no tiene opciones.');
      return { id: recortar(p.id, 80), enunciado: recortar(p.enunciado, MAX_ENUNCIADO), tema: recortar(p.tema, MAX_TEMA),
        opciones: p.opciones.slice(0, 6).map(function (o) { return { id: recortar(tomar(o, 'id'), 40), texto: recortar(tomar(o, 'texto'), MAX_OPCION) }; }),
        correcta: recortar(p.correcta, 40) };
    });
  }

  function Salas(opciones) {
    opciones = opciones || {};
    this._reloj = opciones.reloj || function () { return Date.now() / 1000; };
    this._azar = opciones.azar || B.azarSeguro;
    this._salas = {};
  }
  var P = Salas.prototype;
  P._ahora = function () { return this._reloj(); };
  P._limpiar_viejas = function () {
    var ahora = this._ahora(), self = this;
    Object.keys(this._salas).forEach(function (c) { if (ahora - self._salas[c].actividad > SALA_VIVA_S) delete self._salas[c]; });
  };
  P._sala = function (codigo) {
    var clave = B.pyStrip(B.pyStr(B.pyBool(codigo) ? codigo : '')).toUpperCase();
    if (!has(this._salas, clave)) throw new ErrorSala('No existe esa sala. Revisa el código.', 404);
    return this._salas[clave];
  };
  P._yo = function (sala, token) {
    var ids = ['j1', 'j2'];
    for (var i = 0; i < 2; i++) { var j = sala.jugadores[ids[i]]; if (j && B.pyBool(token) && j.token === B.pyStr(token)) return ids[i]; }
    throw new ErrorSala('No eres parte de esta sala.', 403);
  };
  P._tocar = function (sala) { sala.version += 1; sala.actividad = this._ahora(); };
  P._codigo_nuevo = function () {
    for (var n = 0; n < 200; n++) {
      var c = ''; for (var i = 0; i < LARGO_CODIGO; i++) c += this._azar.choice(LETRAS_CODIGO);
      if (!has(this._salas, c)) return c;
    }
    throw new ErrorSala('No pude crear un código libre. Intenta otra vez.');
  };
  P._nuevo_jugador = function (nombre) {
    return { nombre: red.limpiar_nombre(nombre), token: this._azar.token_urlsafe(16), clase: null, mazo: null, equipo: [], listo: false,
      visto: this._ahora(), perfil: null, origen: 'local' };
  };
  P.crear = function (nombre) {
    this._limpiar_viejas();
    if (Object.keys(this._salas).length >= MAX_SALAS) throw new ErrorSala('Hay demasiadas salas abiertas. Prueba en un rato.');
    var codigo = this._codigo_nuevo(), j1 = this._nuevo_jugador(nombre);
    this._salas[codigo] = { codigo: codigo, version: 1, actividad: this._ahora(), fase: 'espera',
      config: rpg.normalizar_config({ modo: 'pvp', dano_base: 10 }), jugadores: { j1: j1, j2: null }, batalla: null, resultado: null,
      limite: null, inicio: null, ticks: 0, aviso: null };
    return { codigo: codigo, token: j1.token, yo: 'j1' };
  };
  P.unirse = function (codigo, nombre) {
    var s = this._sala(codigo);
    if (s.jugadores.j2 !== null) throw new ErrorSala('La sala ya está llena.');
    if (s.fase !== 'espera') throw new ErrorSala('Esa partida ya empezó.');
    var j2 = this._nuevo_jugador(nombre);
    s.jugadores.j2 = j2;
    this._tocar(s);
    return { codigo: s.codigo, token: j2.token, yo: 'j2' };
  };
  P._depurar_equipos = function (s) {
    ['j1', 'j2'].forEach(function (k) {
      var j = s.jugadores[k];
      if (!j || !j.equipo.length) return;
      var validos = [];
      j.equipo.forEach(function (pu) {
        try { rpg.validar_equipo(validos.concat([pu]), s.config); validos.push(pu); }
        catch (e) { if (!(e instanceof ValueError)) throw e; }
      });
      if (JSON.stringify(validos) !== JSON.stringify(j.equipo)) {
        j.equipo = validos;
        s.aviso = 'Algunos power ups se quitaron del equipo porque ya no valen con estas reglas.';
      }
    });
  };
  P._solo_en_espera = function (s) { if (s.fase !== 'espera') throw new ErrorSala('Eso solo se puede hacer antes de empezar.'); };
  P._reiniciar_listos = function (s) { ['j1', 'j2'].forEach(function (k) { if (s.jugadores[k]) s.jugadores[k].listo = false; }); };
  P.configurar = function (codigo, token, cambios) {
    var s = this._sala(codigo);
    if (this._yo(s, token) !== 'j1') throw new ErrorSala('Solo quien creó la sala cambia la configuración.', 403);
    this._solo_en_espera(s);
    var nuevo = Object.assign({}, s.config);
    CONFIG_EDITABLE.forEach(function (k) { if (B.esObjeto(cambios) && has(cambios, k)) nuevo[k] = cambios[k]; });
    s.config = rpg.normalizar_config(Object.assign({}, nuevo, { modo: 'pvp' }));
    this._depurar_equipos(s);
    this._reiniciar_listos(s);
    this._tocar(s);
    return this.estado(codigo, token);
  };
  P.preparar = function (codigo, token, clase, mazo, equipo, perfil, origen) {
    origen = origen === undefined ? 'local' : origen;
    var s = this._sala(codigo), jid = this._yo(s, token);
    this._solo_en_espera(s);
    if (rpg.CLASES.indexOf(clase) < 0) throw new ErrorSala('Elige una clase.');
    var limpio, eq, perfilOk;
    try {
      limpio = rpg.validar_mazo(acotarMazo(mazo), s.config);
      eq = rpg.validar_equipo(B.pyBool(equipo) ? equipo.slice() : [], s.config);
      perfilOk = (perfil !== undefined && perfil !== null) ? rpg.validar_perfil(perfil) : null;
    } catch (e) { if (e instanceof ErrorSala) throw e; if (e instanceof ValueError) throw new ErrorSala(e.message); throw e; }
    if (perfilOk !== null) {
      var disponible = perfilOk.inventario.slice();
      eq.forEach(function (pu) {
        var i = disponible.indexOf(pu);
        if (i < 0) throw new ErrorSala('Llevas un power up que no está en tu inventario.');
        disponible.splice(i, 1);
      });
    }
    var j = s.jugadores[jid];
    j.clase = clase; j.mazo = limpio; j.equipo = eq; j.perfil = perfilOk; j.origen = origen === 'tarjeta' ? 'tarjeta' : 'local';
    this._reiniciar_listos(s);
    this._tocar(s);
    return this.estado(codigo, token);
  };
  P.listo = function (codigo, token, valor) {
    valor = valor === undefined ? true : valor;
    var s = this._sala(codigo), jid = this._yo(s, token);
    this._solo_en_espera(s);
    var j = s.jugadores[jid];
    if (B.pyBool(valor) && (j.clase === null || j.mazo === null)) throw new ErrorSala('Antes elige tu clase y arma tu mazo.');
    j.listo = B.pyBool(valor);
    this._tocar(s);
    var a = s.jugadores.j1, b = s.jugadores.j2;
    if (a && b && a.listo && b.listo) this._empezar(s);
    return this.estado(codigo, token);
  };
  P._nivel = function (j) { return j.perfil ? j.perfil.nivel : 0; };
  P._empezar = function (s) {
    var a = s.jugadores.j1, b = s.jugadores.j2, pv = s.config.pv_max, self = this;
    function spec(j) { return { nombre: j.nombre, clase: j.clase, preguntas: j.mazo, nivel: self._nivel(j), equipo: j.equipo, pv_max: pv }; }
    try { s.batalla = rpg.nueva_batalla(s.config, spec(a), spec(b)); }
    catch (e) {
      if (!(e instanceof ValueError)) throw e;
      this._reiniciar_listos(s);
      s.aviso = 'No se pudo empezar: ' + e.message;
      return;
    }
    s.fase = 'duelo'; s.resultado = null; s.aviso = null;
    this._poner_limite(s);
  };
  P._poner_limite = function (s, nueva) {
    nueva = nueva === undefined ? true : nueva;
    var b = s.batalla;
    if (nueva) { s.ticks = 0; s.inicio = this._ahora(); }
    if (s.config.con_tiempo && b && b.fase === 'responder') s.limite = s.inicio + Math.max(5, s.config.segundos_pregunta + b.pregunta.tiempo_extra);
    else s.limite = null;
  };
  P._aplicar_tiempo = function (s) {
    var b = s.batalla;
    if (s.limite === null || !b || b.fase !== 'responder') return;
    var ticks = rpg.segundos_con_perdida(this._ahora() - s.inicio, b.pregunta.tiempo_extra);
    if (ticks > s.ticks) { rpg.tiempo_pasado(b, ticks - s.ticks); s.ticks = ticks; this._tocar(s); this._cerrar_si_termino(s); }
    if (b.ganador === null && b.fase === 'responder' && s.limite !== null && this._ahora() >= s.limite) {
      rpg.agotar_tiempo(b); this._poner_limite(s); this._tocar(s); this._cerrar_si_termino(s);
    }
  };
  P._cerrar_si_termino = function (s) {
    var b = s.batalla;
    if (b && b.ganador !== null && s.fase !== 'fin') { s.fase = 'fin'; s.resultado = rpg.resumen_final(b); }
  };
  P._revisar_abandono = function (s) {
    if (s.fase !== 'duelo') return;
    var ahora = this._ahora(), ids = ['j1', 'j2'];
    for (var i = 0; i < 2; i++) {
      var jid = ids[i], j = s.jugadores[jid];
      if (j && ahora - j.visto > ABANDONO_S) {
        var b = s.batalla;
        b.ganador = jid === 'j1' ? 'j2' : 'j1'; b.motivo = 'abandono'; b.fase = 'fin';
        s.aviso = j.nombre + ' se desconectó.';
        this._cerrar_si_termino(s); this._tocar(s);
        return;
      }
    }
  };
  P.accion = function (codigo, token, datos) {
    var s = this._sala(codigo), jid = this._yo(s, token);
    datos = B.esObjeto(datos) ? datos : {};
    var tipo = datos.tipo;
    if (tipo === 'revancha') return this._revancha(s, codigo, token);
    if (s.fase !== 'duelo') throw new ErrorSala('No hay un duelo en marcha.');
    this._aplicar_tiempo(s);
    if (s.fase !== 'duelo') return this.estado(codigo, token);
    var b = s.batalla;
    try {
      if (tipo === 'elegir') { rpg.elegir_pregunta(b, jid, B.pyStr(datos.pregunta === undefined ? '' : datos.pregunta)); this._poner_limite(s); }
      else if (tipo === 'responder') {
        var opcion = datos.opcion, ms = null;
        if (s.config.con_tiempo && s.limite !== null) ms = Math.max(0, (this._ahora() - s.inicio) * 1000);
        rpg.responder(b, jid, (opcion === undefined || opcion === null) ? null : B.pyStr(opcion), ms);
        this._poner_limite(s);
      } else if (tipo === 'power_up') { rpg.usar_power_up(b, jid, B.pyStr(datos.id === undefined ? '' : datos.id)); this._poner_limite(s, false); }
      else if (tipo === 'abandonar') { b.ganador = jid === 'j1' ? 'j2' : 'j1'; b.motivo = 'abandono'; b.fase = 'fin'; }
      else throw new ErrorSala('Esa jugada no existe.');
    } catch (e) {
      if (e instanceof ErrorSala) throw e;
      if (e instanceof ValueError) throw new ErrorSala(e.message);
      throw e;
    }
    this._cerrar_si_termino(s);
    this._tocar(s);
    return this.estado(codigo, token);
  };
  P._revancha = function (s, codigo, token) {
    if (s.fase !== 'fin') throw new ErrorSala('La revancha es después de terminar.');
    s.fase = 'espera'; s.batalla = null; s.resultado = null; s.limite = null; s.aviso = null;
    this._reiniciar_listos(s);
    this._tocar(s);
    return this.estado(codigo, token);
  };
  P.firma = function (s) {
    var self = this, bits = ['j1', 'j2'].filter(function (k) { return s.jugadores[k] !== null; })
      .map(function (k) { var j = s.jugadores[k]; return (j && self._ahora() - j.visto <= PRESENCIA_S) ? '1' : '0'; }).join('');
    return s.version + '.' + bits;
  };
  P.estado = function (codigo, token, firma) {
    var s = this._sala(codigo), jid = this._yo(s, token);
    s.jugadores[jid].visto = this._ahora();
    this._aplicar_tiempo(s);
    this._revisar_abandono(s);
    var f = this.firma(s);
    if (firma !== undefined && firma !== null && firma === f) return { cambio: false, firma: f };
    var ahora = this._ahora(), jugadores = [], self = this;
    ['j1', 'j2'].forEach(function (k) {
      var j = s.jugadores[k];
      if (j === null) return;
      jugadores.push({ id: k, nombre: j.nombre, clase: k === jid ? j.clase : null, tiene_clase: j.clase !== null, listo: j.listo,
        mazo: j.mazo ? j.mazo.length : 0, conectado: ahora - j.visto <= PRESENCIA_S, equipo: j.equipo.length, nivel: self._nivel(j),
        origen: j.origen, perfil: j.perfil !== null });
    });
    var enCombate = s.fase === 'duelo';
    return { cambio: true, firma: f, codigo: s.codigo, yo: jid, fase: s.fase, config: s.config, jugadores: jugadores, aviso: s.aviso,
      batalla: s.batalla ? rpg.estado_publico(s.batalla, jid, !enCombate) : null, resultado: s.resultado,
      restante: s.limite === null ? null : Math.max(0, B.pyRound(s.limite - ahora, 1)) };
  };
  P.cerrar = function (codigo, token) {
    var s = this._sala(codigo);
    if (this._yo(s, token) !== 'j1') throw new ErrorSala('Solo quien creó la sala puede cerrarla.', 403);
    delete this._salas[s.codigo];
    return { cerrada: true };
  };
  P.cuantas = function () { return Object.keys(this._salas).length; };

  return { ErrorSala: ErrorSala, Salas: Salas, acotar_mazo: acotarMazo, recortar: recortar, LETRAS_CODIGO: LETRAS_CODIGO, LARGO_CODIGO: LARGO_CODIGO,
    MAX_ENUNCIADO: MAX_ENUNCIADO, MAX_OPCION: MAX_OPCION, MAX_TEMA: MAX_TEMA, PRESENCIA_S: PRESENCIA_S };
});
