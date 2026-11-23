/* R.E.T.O. - Reglas de la batalla, power ups, niveles y tarjeta de jugador
   (puerto de logica/rpg.py). Todo son reglas puras sobre un objeto `estado`
   que se puede guardar como JSON; con la misma semilla la batalla se repite igual.
   Los datos de los power ups (datos/powerups.json) se cargan con cargarDatos()
   en el navegador y solos en Node. */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var B = nodo ? require('./_base.js') : raiz.RetoLogica._base;
  var D = B.dependencias(raiz, []);
  var m = fabrica(B, D, nodo);
  if (nodo) module.exports = m; else B.registrar(raiz, 'rpg', m);
})(typeof self !== 'undefined' ? self : this, function (B, D, nodo) {
  'use strict';
  var PyRandom = D.azar.PyRandom, ValueError = B.ValueError, has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  /* ---------- datos ---------- */
  var _datos = { pu: null, tx: null };
  function cargarDatos(powerups, textos) {
    _datos.pu = powerups && powerups.powerups ? powerups.powerups : powerups;
    if (textos) _datos.tx = textos;
  }
  function powerUps() {
    if (!_datos.pu) {
      if (nodo) { /* eslint-disable-next-line */ _datos.pu = require('../../datos/powerups.json').powerups; }
      else throw new Error('Faltan los datos de los power ups (datos/powerups.json).');
    }
    return _datos.pu;
  }
  function textosPowerUps() {
    if (!_datos.tx) {
      if (nodo) _datos.tx = require('../../datos/powerups_textos.json');
      else throw new Error('Faltan los textos de los power ups (datos/powerups_textos.json).');
    }
    return _datos.tx;
  }

  /* ---------- clases ---------- */
  var CLASES = ['guerrero', 'caballero', 'mago', 'clerigo', 'asesino', 'arquero'];
  var GRUPOS = { guerrero: 'melee', caballero: 'melee', mago: 'magia', clerigo: 'magia', asesino: 'sigilo', arquero: 'sigilo' };
  var GANA_A = { melee: 'magia', magia: 'sigilo', sigilo: 'melee' };
  var VENTAJA_POR_DEFECTO = 3, VENTAJA_MIN = 0, VENTAJA_MAX = 10;

  function puntosDeClase(atacante, defensor, ventaja) {
    ventaja = ventaja === undefined ? VENTAJA_POR_DEFECTO : ventaja;
    var a = GRUPOS[atacante], d = GRUPOS[defensor];
    if (a === undefined || d === undefined) throw new Error('clase desconocida');
    if (GANA_A[a] === d) return ventaja;
    if (GANA_A[d] === a) return -ventaja;
    return 0;
  }

  /* ---------- configuración ---------- */
  var RAREZAS = ['comun', 'especial', 'raro', 'muy_raro'];
  var USOS_POR_RAREZA = { comun: 3, especial: 2, raro: 1, muy_raro: 1 };
  var EQUIPO_MAX = { comun: 3, especial: 2, raro_o_muy_raro: 1 };
  var CONFIG_POR_DEFECTO = { modo: 'pvp', pv_max: 100, dano_base: 10, ventaja: VENTAJA_POR_DEFECTO, contraataque: 1.0, con_tiempo: false,
    segundos_pregunta: 30, mazo_min: 24, mazo_max: 30, oferta: 4, max_power_ups: null, max_por_pregunta: 1, rarezas: RAREZAS.slice(),
    prohibidos: [], max_turnos: 60 };

  function entre(v, a, b, defecto) {
    var n;
    try { n = B.aFloat(v === undefined ? null : v); } catch (e) { if (e instanceof B.ConvError) return defecto; throw e; }
    return B.pyMax(a, B.pyMin(b, n));
  }
  function entreInt(v, a, b, d) { return B.pyInt(entre(v, a, b, d)); }
  function lista(x) { return Array.isArray(x); }

  function normalizarConfig(cfg) {
    var c = Object.assign({}, CONFIG_POR_DEFECTO);
    c.rarezas = RAREZAS.slice(); c.prohibidos = [];
    cfg = B.pyBool(cfg) ? cfg : {};
    c.modo = cfg.modo === 'pve' ? 'pve' : 'pvp';
    c.pv_max = entreInt(cfg.pv_max, 50, 200, 100);
    c.dano_base = entreInt(cfg.dano_base, 1, 30, 10);
    c.ventaja = entreInt(cfg.ventaja, VENTAJA_MIN, VENTAJA_MAX, VENTAJA_POR_DEFECTO);
    c.contraataque = B.pyRound(entre(cfg.contraataque, 0.25, 1.5, 1.0), 2);
    c.con_tiempo = B.pyBool(cfg.con_tiempo === undefined ? false : cfg.con_tiempo);
    c.segundos_pregunta = entreInt(cfg.segundos_pregunta, 10, 120, 30);
    c.oferta = entreInt(cfg.oferta, 2, 6, 4);
    c.mazo_min = entreInt(cfg.mazo_min, 1, 60, 24);
    c.mazo_max = entreInt(cfg.mazo_max, c.mazo_min, 60, 30);
    var mp = cfg.max_power_ups;
    c.max_power_ups = (mp === undefined || mp === null) ? null : entreInt(mp, 0, 20, 3);
    c.max_por_pregunta = entreInt(cfg.max_por_pregunta, 0, 5, 1);
    var r = cfg.rarezas;
    c.rarezas = lista(r) ? RAREZAS.filter(function (x) { return r.indexOf(x) >= 0; }) : RAREZAS.slice();
    var p = cfg.prohibidos;
    c.prohibidos = lista(p) ? p.map(B.pyStr) : [];
    c.max_turnos = entreInt(cfg.max_turnos, 4, 400, 60);
    return c;
  }

  /* ---------- power ups ---------- */
  var PESOS_RAREZA = { comun: 60, especial: 25, raro: 10, muy_raro: 5 };
  var CADA_N_ACIERTOS = 10, CADA_N_PREMIOS_RARO = 50, TOPE_PREMIOS_DIA = 10, INVENTARIO_MAX = 99;

  function sinergiaDe(id, clase) { return powerUps()[id].sinergia.clases.indexOf(clase) >= 0; }
  function efectoDe(id, clase, modo) {
    modo = modo === undefined ? 'pvp' : modo;
    var pu = powerUps()[id], base = Object.assign({}, pu.efecto), sin = Object.assign({}, pu.sinergia.efecto);
    if (modo === 'pve' && has(pu, 'efecto_pve')) {
      base = Object.assign({}, pu.efecto_pve);
      sin = Object.assign({}, has(pu, 'sinergia_pve') ? pu.sinergia_pve : pu.sinergia.efecto);
    }
    if (sinergiaDe(id, clase)) Object.assign(base, sin);
    return base;
  }
  function elegibles(conTiempo, rarezas, prohibidos) {
    conTiempo = conTiempo === undefined ? true : conTiempo;
    prohibidos = prohibidos || [];
    var out = [], pu = powerUps();
    Object.keys(pu).forEach(function (k) {
      var v = pu[k];
      if (prohibidos.indexOf(k) >= 0) return;
      if (!conTiempo && v.requiere_tiempo) return;
      if (rarezas !== undefined && rarezas !== null && rarezas.indexOf(v.rareza) < 0) return;
      out.push(k);
    });
    return out;
  }
  function sortearPowerUp(rng, conTiempo, rareza) {
    var pool = elegibles(conTiempo === undefined ? true : conTiempo), pu = powerUps(), porRareza = {};
    RAREZAS.forEach(function (r) { porRareza[r] = pool.filter(function (k) { return pu[k].rareza === r; }); });
    if (rareza !== undefined && rareza !== null) return rng.choice(porRareza[rareza]);
    var rarezas = RAREZAS.filter(function (r) { return porRareza[r].length; });
    var r = rng.choices(rarezas, rarezas.map(function (x) { return PESOS_RAREZA[x]; }))[0];
    return rng.choice(porRareza[r]);
  }
  function sortearPremios(antes, despues, rng, conTiempo, entregadosAntes, entregadosHoy) {
    conTiempo = conTiempo === undefined ? true : conTiempo;
    var cupo = Math.max(0, TOPE_PREMIOS_DIA - Math.max(0, B.pyInt(entregadosHoy || 0)));
    var premios = [], bloqueados = 0, entregados = Math.max(0, B.pyInt(entregadosAntes || 0));
    var vueltas = Math.max(0, Math.floor(despues / CADA_N_ACIERTOS) - Math.floor(antes / CADA_N_ACIERTOS));
    for (var i = 0; i < vueltas; i++) {
      var cuantos = rng.choice([1, 2]);
      for (var j = 0; j < cuantos; j++) {
        if (premios.length >= cupo) { bloqueados++; continue; }
        entregados++;
        if (entregados % CADA_N_PREMIOS_RARO === 0) {
          var rareza = rng.random() < 1 / 3 ? 'muy_raro' : 'raro';
          premios.push(sortearPowerUp(rng, conTiempo, rareza));
        } else premios.push(sortearPowerUp(rng, conTiempo));
      }
    }
    return { premios: premios, bloqueados: bloqueados, cupo: cupo - premios.length };
  }
  function premiosPorAciertos(antes, despues, rng, conTiempo, entregadosAntes, entregadosHoy) {
    if (despues <= antes) return [];
    return sortearPremios(antes, despues, rng, conTiempo, entregadosAntes, entregadosHoy).premios;
  }
  function inventarioAgregar(inventario, id, capacidad) {
    capacidad = capacidad === undefined ? INVENTARIO_MAX : capacidad;
    if (!has(powerUps(), id)) throw new ValueError('Ese power up no existe.');
    var inv = inventario.slice();
    if (inv.length >= capacidad) return [inv, false];
    inv.push(id);
    return [inv, true];
  }

  function validarEquipo(ids, cfg) {
    var c = normalizarConfig(cfg), pu = powerUps();
    var vistos = {}; ids.forEach(function (i) { vistos[i] = true; });
    if (Object.keys(vistos).length !== ids.length) throw new ValueError('No se puede llevar el mismo power up dos veces.');
    var cuenta = { comun: 0, especial: 0, raro_o_muy_raro: 0 };
    ids.forEach(function (i) {
      if (typeof i !== 'string' || !has(pu, i)) throw new ValueError("El power up '" + B.pyStr(i) + "' no existe.");
      var p = pu[i];
      if (c.prohibidos.indexOf(i) >= 0) throw new ValueError("'" + i + "' está prohibido en esta batalla.");
      if (c.rarezas.indexOf(p.rareza) < 0) throw new ValueError("'" + i + "' no es de una rareza permitida.");
      if (p.requiere_tiempo && !c.con_tiempo) throw new ValueError("'" + i + "' necesita tiempo y esta batalla no lo tiene.");
      cuenta[(p.rareza === 'raro' || p.rareza === 'muy_raro') ? 'raro_o_muy_raro' : p.rareza] += 1;
    });
    Object.keys(EQUIPO_MAX).forEach(function (k) {
      if (cuenta[k] > EQUIPO_MAX[k]) throw new ValueError('Demasiados power ups de tipo ' + k + ' (máximo ' + EQUIPO_MAX[k] + ').');
    });
    return ids.slice();
  }

  function validarMazo(preguntas, cfg) {
    var c = normalizarConfig(cfg);
    if (!lista(preguntas)) throw new ValueError('El mazo tiene que ser una lista de preguntas.');
    if (!(c.mazo_min <= preguntas.length && preguntas.length <= c.mazo_max))
      throw new ValueError('El mazo debe tener entre ' + c.mazo_min + ' y ' + c.mazo_max + ' preguntas (tiene ' + preguntas.length + ').');
    var ids = {}, limpio = [];
    preguntas.forEach(function (p) {
      if (!B.esObjeto(p)) throw new ValueError('Una pregunta no tiene el formato correcto.');
      var pid = B.pyStrip(B.pyStr(has(p, 'id') ? p.id : '')), enun = B.pyStrip(B.pyStr(has(p, 'enunciado') ? p.enunciado : '')), ops = p.opciones;
      if (!pid || !enun || !lista(ops) || ops.length < 2) throw new ValueError('Cada pregunta necesita id, enunciado y al menos 2 opciones.');
      if (has(ids, pid)) throw new ValueError('Hay dos preguntas con el mismo id (' + pid + ').');
      ids[pid] = true;
      var opciones = ops.map(function (o) {
        if (!B.esObjeto(o)) throw new ValueError('Una opción no tiene el formato correcto.');
        return { id: B.pyStr(o.id), texto: B.pyStr(has(o, 'texto') ? o.texto : '') };
      });
      var idsOp = {}; opciones.forEach(function (o) { idsOp[o.id] = true; });
      if (Object.keys(idsOp).length !== opciones.length) throw new ValueError('La pregunta ' + pid + ' repite una opción.');
      var correcta = B.pyStr(p.correcta);
      if (!has(idsOp, correcta)) throw new ValueError('La pregunta ' + pid + ' no tiene respuesta correcta.');
      limpio.push({ id: pid, enunciado: enun, opciones: opciones, correcta: correcta, tema: B.pyStr(has(p, 'tema') ? p.tema : '') });
    });
    return limpio;
  }

  /* ---------- la batalla ---------- */
  function ofrecer(jug, rng, n) {
    var ids = jug.mazo.orden.slice(), libres = ids.filter(function (i) { return jug.mazo.usadas.indexOf(i) < 0; });
    if (!libres.length) { jug.mazo.usadas = []; libres = ids; }
    return rng.sample(libres, Math.min(n, libres.length));
  }
  function rngDe(estado) { estado._n += 1; return new PyRandom(B.pyStr(estado.semilla) + '-' + estado._n); }
  function otro(j) { return j === 'j1' ? 'j2' : 'j1'; }
  function enteroDe(v, nombre) {
    try { return B.aInt(v); } catch (e) { if (e instanceof B.ConvError) throw new ValueError('El dato ' + nombre + ' no es un número entero.'); throw e; }
  }

  function jugador(spec, cfg) {
    var clase = spec.clase;
    if (CLASES.indexOf(clase) < 0) throw new ValueError('Clase desconocida: ' + B.pyStr(clase) + '.');
    var mazo = cfg.modo === 'pve' ? validarMazo(spec.preguntas, Object.assign({}, cfg, { mazo_min: 1, mazo_max: 500 })) : validarMazo(spec.preguntas, cfg);
    var equipo = validarEquipo(has(spec, 'equipo') ? spec.equipo : [], cfg);
    var pvMax = enteroDe(has(spec, 'pv_max') ? spec.pv_max : cfg.pv_max, 'pv_max');
    var preg = {}; mazo.forEach(function (p) { preg[p.id] = p; });
    var eq = {}; equipo.forEach(function (i) { eq[i] = USOS_POR_RAREZA[powerUps()[i].rareza]; });
    return { nombre: B.pySlice(B.pyStr(has(spec, 'nombre') ? spec.nombre : 'Jugador'), 24), clase: clase,
      nivel: Math.max(0, Math.min(999, enteroDe(B.pyBool(spec.nivel) ? spec.nivel : 0, 'nivel'))),
      pv: pvMax, pv_max: pvMax, mazo: { preguntas: preg, orden: mazo.map(function (p) { return p.id; }), usadas: [] },
      oferta: [], equipo: eq, efectos: [], usados: [], usos_pregunta: 0, aciertos: 0, fallos: 0, ultimo_dano: 0 };
  }

  function nuevaBatalla(config, spec1, spec2, semilla) {
    var cfg = normalizarConfig(config);
    if (semilla === undefined || semilla === null) semilla = PyRandom.sistemaRandrange(Math.pow(2, 30));
    var estado = { v: 1, semilla: semilla, _n: 0, config: cfg, turno: 1, fase: 'elegir', atacante: cfg.modo === 'pvp' ? 'j1' : 'j2',
      pregunta: null, ganador: null, motivo: null, log: [], jugadores: { j1: jugador(spec1, cfg), j2: jugador(spec2, cfg) } };
    if (cfg.modo === 'pvp') estado.atacante = new PyRandom(semilla).choice(['j1', 'j2']);
    empezarTurno(estado);
    return estado;
  }

  function log(estado, tipo, datos) {
    var d = Object.assign({}, datos); d.tipo = tipo; d.turno = estado.turno; estado.log.push(d);
  }

  function empezarTurno(estado) {
    var cfg = estado.config, atq;
    for (var n = 0; n < 4; n++) {
      atq = estado.jugadores[estado.atacante];
      var perdido = atq.efectos.filter(function (e) { return e.tipo === 'perder_ataque'; });
      if (perdido.length) {
        perdido[0].turnos -= 1;
        atq.efectos = atq.efectos.filter(function (e) { return (has(e, 'turnos') ? e.turnos : 1) > 0 || e.tipo !== 'perder_ataque'; });
        log(estado, 'ataque_perdido', { jugador: estado.atacante });
        if (cfg.modo === 'pvp') estado.atacante = otro(estado.atacante);
        estado.turno += 1;
        continue;
      }
      break;
    }
    atq = estado.jugadores[estado.atacante];
    atq.usos_pregunta = 0;
    estado.jugadores[otro(estado.atacante)].usos_pregunta = 0;
    atq.oferta = ofrecer(atq, rngDe(estado), cfg.oferta);
    estado.fase = 'elegir';
    estado.pregunta = null;
    if (cfg.modo === 'pve') elegirPregunta(estado, estado.atacante, rngDe(estado).choice(atq.oferta), true);
  }

  function fase(estado, f) {
    if ((estado.ganador !== undefined && estado.ganador !== null) || estado.fase === 'fin') throw new ValueError('La batalla ya terminó.');
    if (estado.fase !== f) throw new ValueError('Ahora no se puede hacer eso.');
  }

  function elegirPregunta(estado, jid, preguntaId) {
    fase(estado, 'elegir');
    if (jid !== estado.atacante) throw new ValueError('No es tu turno de atacar.');
    var atq = estado.jugadores[jid];
    if (atq.oferta.indexOf(preguntaId) < 0) throw new ValueError('Esa pregunta no está entre las que te tocaron.');
    atq.mazo.usadas.push(preguntaId);
    var p = atq.mazo.preguntas[preguntaId];
    estado.pregunta = { id: p.id, de: jid, ocultas: [], tema_visible: false, tiempo_extra: 0, reintento: [] };
    atq.oferta = [];
    estado.fase = 'responder';
    log(estado, 'pregunta', { de: jid, pregunta: preguntaId });
    var dfn = estado.jugadores[otro(jid)];
    dfn.efectos.slice().forEach(function (e) {
      if (e.tipo === 'tiempo_menos') { estado.pregunta.tiempo_extra -= e.seg; dfn.efectos.splice(dfn.efectos.indexOf(e), 1); }
    });
    return estado;
  }

  var SOLO_DEFENSA = ['descartar', 'mostrar_tema', 'cambiar_pregunta', 'segunda_oportunidad'];
  function momento(efecto) { return SOLO_DEFENSA.some(function (k) { return has(efecto, k); }) ? 'defensa' : 'cualquiera'; }

  function usarPowerUp(estado, jid, puId) {
    if (estado.ganador !== undefined && estado.ganador !== null) throw new ValueError('La batalla ya terminó.');
    var cfg = estado.config, jug = estado.jugadores[jid];
    var rolAtacante = estado.fase === 'elegir' && jid === estado.atacante;
    var rolDefensor = estado.fase === 'responder' && jid !== estado.atacante;
    if (!(rolAtacante || rolDefensor)) throw new ValueError('Ahora no es tu momento de usar un power up.');
    if (!has(jug.equipo, puId)) throw new ValueError('No llevas ese power up.');
    if (jug.equipo[puId] <= 0) throw new ValueError('Ya no te quedan usos de ese power up.');
    if (cfg.max_power_ups !== null && jug.usados.length >= cfg.max_power_ups) throw new ValueError('Ya usaste todos los power ups que se permiten en esta batalla.');
    if (jug.usos_pregunta >= cfg.max_por_pregunta) throw new ValueError('Ya usaste el máximo de power ups en esta pregunta.');
    var efecto = efectoDe(puId, jug.clase, cfg.modo);
    if (momento(efecto) === 'defensa' && !rolDefensor) throw new ValueError('Ese power up solo sirve cuando te toca responder.');
    aplicar(estado, jid, efecto);
    jug.equipo[puId] -= 1;
    jug.usos_pregunta += 1;
    jug.usados.push(puId);
    log(estado, 'power_up', { jugador: jid, power_up: puId });
    revisarFin(estado);
    return estado;
  }

  function efectoNuevo(jug, tipo, datos) { var d = Object.assign({}, datos); d.tipo = tipo; jug.efectos.push(d); }
  function quitar(arr, e) { var i = arr.indexOf(e); if (i >= 0) arr.splice(i, 1); }

  function aplicar(estado, jid, efecto) {
    var cfg = estado.config, yo = estado.jugadores[jid], rival = estado.jugadores[otro(jid)], p = estado.pregunta;
    Object.keys(efecto).forEach(function (k) {
      var v = efecto[k];
      if (k === 'cura') yo.pv = Math.min(yo.pv_max, yo.pv + v);
      else if (k === 'dano_directo') rival.pv = Math.max(0, rival.pv - v);
      else if (k === 'tiempo') {
        if (cfg.con_tiempo && p) p.tiempo_extra += v;
        else if (cfg.con_tiempo) efectoNuevo(yo, 'tiempo_mas', { seg: v });
      } else if (k === 'tiempo_rival') efectoNuevo(rival, 'tiempo_menos', { seg: v });
      else if (k === 'mult_dano') efectoNuevo(yo, 'mult_dano', { valor: v.valor, golpes: v.golpes, rapido: false });
      else if (k === 'mult_dano_rapido') efectoNuevo(yo, 'mult_dano', { valor: v.valor, golpes: v.golpes, rapido: true });
      else if (k === 'escudo') efectoNuevo(yo, 'escudo', { pv: v.pv, golpes: v.golpes });
      else if (k === 'reduccion') efectoNuevo(yo, 'reduccion', { pct: v.pct, golpes: v.golpes });
      else if (k === 'descartar' && p) {
        var q = estado.jugadores[p.de].mazo.preguntas[p.id], correcta = q.correcta;
        var malas = q.opciones.filter(function (o) { return o.id !== correcta && p.ocultas.indexOf(o.id) < 0; }).map(function (o) { return o.id; });
        rngDe(estado).sample(malas, Math.min(B.pyInt(v), Math.max(0, malas.length - 1))).forEach(function (o) { p.ocultas.push(o); });
      } else if (k === 'mostrar_tema' && p) p.tema_visible = true;
      else if (k === 'cambiar_pregunta' && p) anularTurno(estado);
      else if (k === 'segunda_oportunidad') efectoNuevo(yo, 'segunda', { usos: B.pyInt(v) });
      else if (k === 'purificar') yo.pv = Math.min(yo.pv_max, yo.pv + Math.min(v, yo.ultimo_dano));
      else if (k === 'sangrado') efectoNuevo(rival, 'sangrado', { pv: v.pv, turnos: v.turnos });
      else if (k === 'inmune_tiempo') efectoNuevo(yo, 'inmune_tiempo', { turnos: B.pyInt(v) });
      else if (k === 'anular_desventaja') efectoNuevo(yo, 'anular_desventaja', { turnos: B.pyInt(v) });
      else if (k === 'limpiar_negativos') yo.efectos = yo.efectos.filter(function (e) { return ['sangrado', 'tiempo_menos', 'perder_ataque'].indexOf(e.tipo) < 0; });
      else if (k === 'perder_ataque_rival') efectoNuevo(rival, 'perder_ataque', { turnos: B.pyInt(v) });
    });
  }

  function anularTurno(estado) {
    log(estado, 'turno_anulado', { por: 'cambiar_pregunta' });
    estado.turno += 1;
    empezarTurno(estado);
  }

  function dano(estado, golpea, recibe, factor, rapido) {
    var cfg = estado.config, dealer = estado.jugadores[golpea], victim = estado.jugadores[recibe];
    var pts = puntosDeClase(dealer.clase, victim.clase, cfg.ventaja);
    if (pts < 0 && dealer.efectos.some(function (e) { return e.tipo === 'anular_desventaja'; })) pts = 0;
    if (pts > 0 && victim.efectos.some(function (e) { return e.tipo === 'anular_desventaja'; })) pts = 0;
    var d = cfg.dano_base * factor + pts;
    d = Math.max(1.0, d);
    dealer.efectos.slice().forEach(function (e) {
      if (e.tipo === 'mult_dano' && (!e.rapido || rapido)) {
        d *= e.valor; e.golpes -= 1;
        if (e.golpes <= 0) quitar(dealer.efectos, e);
      }
    });
    victim.efectos.slice().forEach(function (e) {
      if (e.tipo === 'reduccion') {
        d *= 1 - e.pct / 100; e.golpes -= 1;
        if (e.golpes <= 0) quitar(victim.efectos, e);
      }
    });
    d = Math.max(1, B.pyInt(d + 0.5));
    victim.efectos.slice().forEach(function (e) {
      if (e.tipo === 'escudo' && d > 0) {
        var absorbe = Math.min(d, e.pv);
        d -= absorbe; e.golpes -= 1; e.pv -= absorbe;
        if (e.golpes <= 0 || e.pv <= 0) quitar(victim.efectos, e);
      }
    });
    return d;
  }

  function responder(estado, jid, opcionId, milisegundos) {
    fase(estado, 'responder');
    if (jid === estado.atacante) throw new ValueError('Te toca esperar: tu rival está contestando.');
    var cfg = estado.config, atqId = estado.atacante, dfnId = jid, atq = estado.jugadores[atqId], dfn = estado.jugadores[dfnId], p = estado.pregunta;
    var preg = atq.mazo.preguntas[p.id], sinOpcion = opcionId === undefined || opcionId === null;
    if (!sinOpcion && !preg.opciones.some(function (o) { return o.id === opcionId; })) throw new ValueError('Esa opción no existe.');
    var acierto = !sinOpcion && B.pyStr(opcionId) === preg.correcta;
    if (!acierto && !sinOpcion) {
      for (var i = 0; i < dfn.efectos.length; i++) {
        var e = dfn.efectos[i];
        if (e.tipo === 'segunda' && e.usos > 0) {
          e.usos -= 1;
          dfn.efectos = dfn.efectos.filter(function (x) { return (has(x, 'usos') ? x.usos : 1) > 0 || x.tipo !== 'segunda'; });
          if (p.ocultas.indexOf(opcionId) < 0) p.ocultas.push(opcionId);
          log(estado, 'segunda_oportunidad', { jugador: dfnId });
          estado.ultimo = { reintento: true };
          return estado;
        }
      }
    }
    var rapido = false;
    if (cfg.con_tiempo && milisegundos !== undefined && milisegundos !== null) {
      var limite = (cfg.segundos_pregunta + p.tiempo_extra) * 1000;
      rapido = milisegundos <= limite / 2;
    }
    var golpea, recibe, factor;
    if (acierto) { dfn.aciertos += 1; golpea = dfnId; recibe = atqId; factor = cfg.contraataque; }
    else { dfn.fallos += 1; golpea = atqId; recibe = dfnId; factor = 1.0; }
    var d = dano(estado, golpea, recibe, factor, rapido), victima = estado.jugadores[recibe];
    victima.pv = Math.max(0, victima.pv - d);
    victima.ultimo_dano = d;
    estado.ultimo = { acierto: acierto, golpea: golpea, recibe: recibe, dano: d, correcta: preg.correcta };
    log(estado, 'respuesta', { jugador: dfnId, acierto: acierto, dano: d, recibe: recibe });
    if (!revisarFin(estado)) cierreDeTurno(estado);
    return estado;
  }

  function agotarTiempo(estado) {
    fase(estado, 'responder');
    responder(estado, otro(estado.atacante), null);
    if (estado.ultimo !== undefined && estado.ultimo !== null) estado.ultimo.tiempo_agotado = true;
    return estado;
  }

  function cierreDeTurno(estado) {
    ['j1', 'j2'].forEach(function (jid) {
      var jug = estado.jugadores[jid];
      jug.efectos.slice().forEach(function (e) {
        if (e.tipo === 'sangrado') {
          jug.pv = Math.max(0, jug.pv - e.pv); e.turnos -= 1;
          if (e.turnos <= 0) quitar(jug.efectos, e);
        } else if (e.tipo === 'inmune_tiempo' || e.tipo === 'anular_desventaja') {
          e.turnos -= 1;
          if (e.turnos <= 0) quitar(jug.efectos, e);
        }
      });
    });
    if (revisarFin(estado)) return;
    estado.turno += 1;
    if (estado.config.modo === 'pvp') estado.atacante = otro(estado.atacante);
    if (estado.turno > estado.config.max_turnos) { terminarPorTurnos(estado); return; }
    empezarTurno(estado);
    revisarFin(estado);
  }

  function revisarFin(estado) {
    if ((estado.ganador !== undefined && estado.ganador !== null) || estado.fase === 'fin') return true;
    var ids = ['j1', 'j2'];
    for (var i = 0; i < 2; i++) {
      if (estado.jugadores[ids[i]].pv <= 0) {
        estado.ganador = otro(ids[i]); estado.motivo = 'pv'; estado.fase = 'fin';
        log(estado, 'fin', { ganador: estado.ganador, motivo: 'pv' });
        return true;
      }
    }
    return false;
  }
  function terminarPorTurnos(estado) {
    var a = estado.jugadores.j1.pv, b = estado.jugadores.j2.pv;
    estado.ganador = a > b ? 'j1' : (b > a ? 'j2' : 'empate'); estado.motivo = 'turnos'; estado.fase = 'fin';
    log(estado, 'fin', { ganador: estado.ganador, motivo: 'turnos' });
  }

  var PCT_PV_POR_SEGUNDO = 0.3;
  function segundosConPerdida(transcurridos, tiempoExtra) {
    tiempoExtra = tiempoExtra || 0;
    return Math.max(0, B.pyInt(Math.max(0.0, B.aFloat(transcurridos)) - tiempoExtra - 3));
  }
  function tiempoPasado(estado, segundos) {
    if (!estado.config.con_tiempo || estado.fase !== 'responder') return estado;
    var dfn = estado.jugadores[otro(estado.atacante)];
    if (dfn.efectos.some(function (e) { return e.tipo === 'inmune_tiempo'; })) return estado;
    var perdida = Math.max(0, segundos) * dfn.pv_max * PCT_PV_POR_SEGUNDO / 100;
    dfn.pv = Math.max(0.0, B.pyRound(dfn.pv - perdida, 2));
    revisarFin(estado);
    return estado;
  }

  function resumenFinal(estado) {
    var js = {};
    Object.keys(estado.jugadores).forEach(function (j) {
      var s = estado.jugadores[j];
      js[j] = { aciertos: s.aciertos, fallos: s.fallos, pv: s.pv, usados: s.usados.slice() };
    });
    return { ganador: estado.ganador, motivo: estado.motivo, turnos: estado.turno, jugadores: js };
  }

  function copia(o) { return Object.assign({}, o); }
  function estadoPublico(estado, jid, ocultarClaseRival) {
    var mio = estado.jugadores[jid], rival = estado.jugadores[otro(jid)], p = estado.pregunta, pregunta = null;
    if (B.pyBool(p)) {
      var q = estado.jugadores[p.de].mazo.preguntas[p.id];
      pregunta = { id: q.id, enunciado: q.enunciado, de: p.de, opciones: q.opciones.filter(function (o) { return p.ocultas.indexOf(o.id) < 0; }),
        tema: (p.tema_visible && jid !== p.de) ? q.tema : null, tiempo_extra: p.tiempo_extra };
    }
    var oferta = mio.oferta.map(function (i) { return { id: i, enunciado: mio.mazo.preguntas[i].enunciado, tema: mio.mazo.preguntas[i].tema }; });
    return { yo: jid, config: estado.config, turno: estado.turno, fase: estado.fase, atacante: estado.atacante, ganador: estado.ganador,
      motivo: estado.motivo, pregunta: pregunta, oferta: oferta, ultimo: has(estado, 'ultimo') ? estado.ultimo : null,
      yo_estado: { nombre: mio.nombre, clase: mio.clase, nivel: mio.nivel, pv: mio.pv, pv_max: mio.pv_max, equipo: copia(mio.equipo),
        efectos: mio.efectos.map(copia), preguntas_en_mazo: mio.mazo.orden.length },
      rival: { nombre: rival.nombre, clase: ocultarClaseRival ? null : rival.clase, nivel: rival.nivel, pv: rival.pv, pv_max: rival.pv_max,
        efectos: rival.efectos.map(copia), preguntas_en_mazo: rival.mazo.orden.length } };
  }

  /* ---------- puntos y niveles ---------- */
  var TOPE_DIARIO = 120, PUNTOS_POR_MINUTO = 1, PUNTOS_POR_RONDA = 5, PUNTOS_POR_PREGUNTA = 0.5, MINUTOS_MINIMOS = 1, PREGUNTAS_MINIMAS = 3;
  var TIPOS_QUE_CUENTAN = ['lectura', 'vision', 'test', 'rpg'];

  function puntosSesion(tipo, minutos, rondas, preguntas) {
    minutos = minutos || 0; rondas = rondas || 0; preguntas = preguntas || 0;
    if (tipo === 'lectura' || tipo === 'vision') return minutos >= MINUTOS_MINIMOS ? Number(minutos) * PUNTOS_POR_MINUTO : 0.0;
    if (tipo === 'test' || tipo === 'rpg') {
      if (minutos >= MINUTOS_MINIMOS || preguntas >= PREGUNTAS_MINIMAS) return rondas * PUNTOS_POR_RONDA + preguntas * PUNTOS_POR_PREGUNTA;
      return 0.0;
    }
    return 0.0;
  }
  function aplicarTopeDiario(puntosHoy, nuevos, tope) {
    tope = tope === undefined ? TOPE_DIARIO : tope;
    return Math.max(0.0, Math.min(Number(nuevos), tope - Math.max(0.0, Number(puntosHoy))));
  }
  function puntosParaNivel(n) { return 20 * Math.pow(n, 1.5); }
  function nivelDePuntos(puntos) {
    var p = Math.max(0.0, B.aFloat(puntos)), n = B.pyInt(Math.pow(p / 20, 2 / 3));
    while (puntosParaNivel(n + 1) <= p) n += 1;
    while (n > 0 && puntosParaNivel(n) > p) n -= 1;
    return n;
  }
  function progresoDeNivel(puntos) {
    var n = nivelDePuntos(puntos), base = puntosParaNivel(n), tope = puntosParaNivel(n + 1);
    return { nivel: n, puntos: B.pyRound(B.aFloat(puntos), 1), desde: Math.ceil(base), siguiente: Math.ceil(tope), fraccion: B.pyRound((puntos - base) / (tope - base), 3) };
  }
  function puntosDeSesiones(sesiones, tope) {
    tope = tope === undefined ? TOPE_DIARIO : tope;
    var porDia = {};
    (B.pyBool(sesiones) ? sesiones : []).forEach(function (s) {
      if (!B.esObjeto(s)) return;
      var tipo = s.tipo;
      if (TIPOS_QUE_CUENTAN.indexOf(tipo) < 0) return;
      var pts;
      try { pts = puntosSesion(tipo, B.aFloat(B.pyBool(s.minutos) ? s.minutos : 0), B.aInt(B.pyBool(s.rondas) ? s.rondas : 0), B.aInt(B.pyBool(s.preguntas) ? s.preguntas : 0)); }
      catch (e) { if (e instanceof B.ConvError) return; throw e; }
      var dia = B.pySlice(B.pyBool(s.fecha) ? B.pyStr(s.fecha) : '', 10);
      porDia[dia] = (porDia[dia] || 0.0) + Math.max(0.0, pts);
    });
    return Object.keys(porDia).reduce(function (a, k) { return a + Math.min(porDia[k], tope); }, 0);
  }

  /* ---------- tarjeta de jugador ---------- */
  var VERSION_TARJETA = 2, SAL_TARJETA = 'reto-tarjeta-v2', SAL_TARJETA_V1 = 'reto-tarjeta-v1';

  function validarPerfil(p) {
    if (!B.esObjeto(p)) throw new ValueError('La tarjeta no tiene el formato correcto.');
    var puntos, aciertos;
    try {
      puntos = Math.max(0.0, Math.min(1000000.0, B.aFloat(B.pyBool(p.puntos) ? p.puntos : 0)));
      aciertos = Math.max(0, Math.min(10000000, B.aInt(B.pyBool(p.aciertos) ? p.aciertos : 0)));
    } catch (e) { if (e instanceof B.ConvError) throw new ValueError('La tarjeta tiene números que no se entienden.'); throw e; }
    if (puntos !== puntos) puntos = 1000000.0;
    var inv = B.pyBool(p.inventario) ? p.inventario : [];
    if (!lista(inv) || inv.length > INVENTARIO_MAX) throw new ValueError('El inventario de la tarjeta no es válido.');
    inv.forEach(function (i) { if (typeof i !== 'string' || !has(powerUps(), i)) throw new ValueError('La tarjeta trae un power up que no existe.'); });
    var equipo = [], restante = inv.slice();
    (B.pyBool(p.equipo) ? p.equipo : []).forEach(function (i) {
      if (restante.indexOf(i) >= 0 && equipo.indexOf(i) < 0) { equipo.push(i); quitar(restante, i); }
    });
    validarEquipo(equipo, { con_tiempo: true });
    var config = B.pyBool(p.config) ? p.config : {};
    if (!B.esObjeto(config)) config = {};
    var tpm = B.pyBool(p.tiempo_por_modulo) ? p.tiempo_por_modulo : {};
    if (!B.esObjeto(tpm)) tpm = {};
    return { nombre: B.pySlice(B.pyStr(B.pyBool(p.nombre) ? p.nombre : 'Jugador'), 24), puntos: B.pyRound(puntos, 1), nivel: nivelDePuntos(puntos),
      inventario: inv.slice(), equipo: equipo, aciertos: aciertos, config: config, tiempo_por_modulo: tpm };
  }

  function huella(perfil, fecha, version) {
    version = version === undefined ? VERSION_TARJETA : version;
    var sal = version === 2 ? SAL_TARJETA : SAL_TARJETA_V1;
    var canon = B.jsonCanonico({ v: version, fecha: fecha, p: perfil }, { '.p.puntos': true });
    return B.sha256hex(sal + canon).slice(0, 20);
  }
  function crearTarjeta(perfil, fecha) {
    var limpio = validarPerfil(perfil);
    fecha = B.pySlice(B.pyStr(fecha), 10);
    return { tipo: 'tarjeta-reto', v: 2, fecha: fecha, perfil: limpio, huella: huella(limpio, fecha, 2) };
  }
  function validarTarjeta(t) {
    if (!B.esObjeto(t) || t.tipo !== 'tarjeta-reto') throw new ValueError('Eso no es una tarjeta de jugador de R.E.T.O.');
    var version = t.v;
    if (version !== 1 && version !== 2) throw new ValueError('Versión de tarjeta no soportada.');
    var perfil = validarPerfil(t.perfil);
    if (t.huella !== huella(perfil, B.pySlice(B.pyStr(has(t, 'fecha') ? t.fecha : ''), 10), version)) throw new ValueError('La tarjeta fue modificada o está dañada. Pide otra.');
    return perfil;
  }

  return { CLASES: CLASES, GRUPOS: GRUPOS, RAREZAS: RAREZAS, USOS_POR_RAREZA: USOS_POR_RAREZA, CONFIG_POR_DEFECTO: CONFIG_POR_DEFECTO,
    PESOS_RAREZA: PESOS_RAREZA, TOPE_PREMIOS_DIA: TOPE_PREMIOS_DIA, INVENTARIO_MAX: INVENTARIO_MAX, TOPE_DIARIO: TOPE_DIARIO,
    cargarDatos: cargarDatos, power_ups: powerUps, textos_power_ups: textosPowerUps, puntos_de_clase: puntosDeClase,
    normalizar_config: normalizarConfig, sinergia_de: sinergiaDe, efecto_de: efectoDe, elegibles: elegibles,
    sortear_power_up: sortearPowerUp, sortear_premios: sortearPremios, premios_por_aciertos: premiosPorAciertos,
    inventario_agregar: inventarioAgregar, validar_equipo: validarEquipo, validar_mazo: validarMazo,
    nueva_batalla: nuevaBatalla, elegir_pregunta: elegirPregunta, usar_power_up: usarPowerUp, responder: responder,
    agotar_tiempo: agotarTiempo, segundos_con_perdida: segundosConPerdida, tiempo_pasado: tiempoPasado, resumen_final: resumenFinal,
    estado_publico: estadoPublico, _revisar_fin: revisarFin, _huella: huella, validar_perfil_v: validarPerfil, puntos_sesion: puntosSesion, aplicar_tope_diario: aplicarTopeDiario, puntos_para_nivel: puntosParaNivel,
    nivel_de_puntos: nivelDePuntos, progreso_de_nivel: progresoDeNivel, puntos_de_sesiones: puntosDeSesiones,
    validar_perfil: validarPerfil, crear_tarjeta: crearTarjeta, validar_tarjeta: validarTarjeta };
});
