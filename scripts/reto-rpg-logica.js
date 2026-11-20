/* =========================================================================
   R.E.T.O. - Lógica del RPG (JavaScript)
   -------------------------------------------------------------------------
   Puerto directo de logica/rpg.py a JS.
   Batalla, power-ups, mazos, nivel, tarjetas.
   ========================================================================= */
(function (window) {
  'use strict';

  /* ===========================================================================
     DATOS DE POWER-UPS (se cargan desde powerups.json)
     =========================================================================== */
  var _cachePU = null;
  var _cacheTXT = null;

  function loadPowerUps() {
    if (_cachePU) return Promise.resolve(_cachePU);
    return fetch('../../datos/powerups.json').then(function(r) { return r.json(); })
      .then(function(d) { _cachePU = d.powerups; return _cachePU; });
  }

  function loadTextosPU() {
    if (_cacheTXT) return Promise.resolve(_cacheTXT);
    return fetch('../../datos/powerups_textos.json').then(function(r) { return r.json(); })
      .then(function(d) { _cacheTXT = d; return _cacheTXT; });
  }

  function powerUps() { return _cachePU || {}; }
  function textosPowerUps() { return _cacheTXT || {}; }

  /* ===========================================================================
     CONSTANTES (idénticas a Python)
     =========================================================================== */
  var CLASES = ['guerrero', 'caballero', 'mago', 'clerigo', 'asesino', 'arquero'];
  var GRUPOS = { guerrero: 'melee', caballero: 'melee', mago: 'magia',
    clerigo: 'magia', asesino: 'sigilo', arquero: 'sigilo' };
  var GANA_A = { melee: 'magia', magia: 'sigilo', sigilo: 'melee' };

  var VENTAJA_POR_DEFECTO = 3;
  var VENTAJA_MIN = 0, VENTAJA_MAX = 10;

  var RAREZAS = ['comun', 'especial', 'raro', 'muy_raro'];
  var USOS_POR_RAREZA = { comun: 3, especial: 2, raro: 1, muy_raro: 1 };
  var EQUIPO_MAX = { comun: 3, especial: 2, raro_o_muy_raro: 1 };

  var PESOS_RAREZA = { comun: 60, especial: 25, raro: 10, muy_raro: 5 };
  var CADA_N_ACIERTOS = 10;
  var CADA_N_PREMIOS_RARO = 50;
  var TOPE_PREMIOS_DIA = 10;
  var INVENTARIO_MAX = 99;

  var CONFIG_POR_DEFECTO = {
    modo: 'pvp', pv_max: 100, dano_base: 10, ventaja: VENTAJA_POR_DEFECTO,
    contraataque: 1.0, con_tiempo: false, segundos_pregunta: 30,
    mazo_min: 24, mazo_max: 30, oferta: 4,
    max_power_ups: null, max_por_pregunta: 1,
    rarezas: RAREZAS.slice(), prohibidos: [], max_turnos: 60
  };

  var PCT_PV_POR_SEGUNDO = 0.3;

  var _SOLO_DEFENSA = ['descartar', 'mostrar_tema', 'cambiar_pregunta', 'segunda_oportunidad'];

  /* ===========================================================================
     UTILIDADES
     =========================================================================== */
  function _entre(v, a, b, defecto) {
    try { var n = parseFloat(v); } catch (e) { return defecto; }
    return Math.max(a, Math.min(b, n));
  }

  function puntosDeClase(atacante, defensor, ventaja) {
    if (ventaja === undefined) ventaja = VENTAJA_POR_DEFECTO;
    var a = GRUPOS[atacante], d = GRUPOS[defensor];
    if (GANA_A[a] === d) return ventaja;
    if (GANA_A[d] === a) return -ventaja;
    return 0;
  }

  function normalizarConfig(cfg) {
    var c = Object.assign({}, CONFIG_POR_DEFECTO);
    cfg = cfg || {};
    c.modo = cfg.modo === 'pve' ? 'pve' : 'pvp';
    c.pv_max = Math.floor(_entre(cfg.pv_max, 50, 200, 100));
    c.dano_base = Math.floor(_entre(cfg.dano_base, 1, 30, 10));
    c.ventaja = Math.floor(_entre(cfg.ventaja, VENTAJA_MIN, VENTAJA_MAX, VENTAJA_POR_DEFECTO));
    c.contraataque = Math.round(_entre(cfg.contraataque, 0.25, 1.5, 1.0) * 100) / 100;
    c.con_tiempo = Boolean(cfg.con_tiempo);
    c.segundos_pregunta = Math.floor(_entre(cfg.segundos_pregunta, 10, 120, 30));
    c.oferta = Math.floor(_entre(cfg.oferta, 2, 6, 4));
    c.mazo_min = Math.floor(_entre(cfg.mazo_min, 1, 60, 24));
    c.mazo_max = Math.floor(_entre(cfg.mazo_max, c.mazo_min, 60, 30));
    var mp = cfg.max_power_ups;
    c.max_power_ups = mp === null || mp === undefined ? null : Math.floor(_entre(mp, 0, 20, 3));
    c.max_por_pregunta = Math.floor(_entre(cfg.max_por_pregunta, 0, 5, 1));
    var r = cfg.rarezas;
    c.rarezas = Array.isArray(r) ? r.filter(function(x) { return RAREZAS.indexOf(x) >= 0; }) : RAREZAS.slice();
    var p = cfg.prohibidos;
    c.prohibidos = Array.isArray(p) ? p.map(String) : [];
    c.max_turnos = Math.floor(_entre(cfg.max_turnos, 4, 400, 60));
    return c;
  }

  function _cachearPowerUps() {
    if (typeof _cachePU === 'object' && _cachePU) return;
    // Se carga bajo demanda via fetch
  }

  function _getPU(id) {
    var pu = powerUps();
    return pu[id] || null;
  }

  function sinergiaDe(puId, clase) {
    var pu = _getPU(puId);
    return pu && pu.sinergia && pu.sinergia.clases && pu.sinergia.clases.indexOf(clase) >= 0;
  }

  function efectoDe(puId, clase, modo) {
    var pu = _getPU(puId);
    if (!pu) return {};
    var base = Object.assign({}, pu.efecto || {});
    var sin = Object.assign({}, (pu.sinergia && pu.sinergia.efecto) || {});
    if (modo === 'pve' && pu.efecto_pve) {
      base = Object.assign({}, pu.efecto_pve);
      sin = Object.assign({}, (pu.sinergia_pve || pu.sinergia).efecto || {});
    }
    if (sinergiaDe(puId, clase)) {
      Object.keys(sin).forEach(function(k) { base[k] = sin[k]; });
    }
    return base;
  }

  function elegibles(conTiempo, rarezas, prohibidos) {
    var out = [];
    var pu = powerUps();
    prohibidos = prohibidos || [];
    for (var k in pu) {
      if (prohibidos.indexOf(k) >= 0) continue;
      var v = pu[k];
      if (!conTiempo && v.requiere_tiempo) continue;
      if (rarezas && rarezas.indexOf(v.rareza) < 0) continue;
      out.push(k);
    }
    return out;
  }

  function sortearPowerUp(rng, conTiempo, rarezaForzada) {
    var pool = elegibles(conTiempo);
    var porRareza = {};
    RAREZAS.forEach(function(r) { porRareza[r] = pool.filter(function(k) { return powerUps()[k].rareza === r; }); });
    if (rarezaForzada) return porRareza[rarezaForzada][Math.floor(rng.random() * porRareza[rarezaForzada].length)];
    var rarezasDisponibles = RAREZAS.filter(function(r) { return porRareza[r].length; });
    var pesos = rarezasDisponibles.map(function(r) { return PESOS_RAREZA[r]; });
    var r = rng.choices(rarezasDisponibles, pesos)[0];
    var arr = porRareza[r];
    return arr[Math.floor(rng.random() * arr.length)];
  }

  function sortearPremios(antes, despues, rng, conTiempo, entregadosAntes, entregadosHoy) {
    var cupo = Math.max(0, TOPE_PREMIOS_DIA - Math.max(0, parseInt(entregadosHoy) || 0));
    var premios = [], bloqueados = 0;
    var entregados = Math.max(0, parseInt(entregadosAntes) || 0);
    var tandas = Math.max(0, Math.floor(despues / CADA_N_ACIERTOS) - Math.floor(antes / CADA_N_ACIERTOS));
    for (var t = 0; t < tandas; t++) {
      var n = rng.random() < 0.5 ? 1 : 2;
      for (var i = 0; i < n; i++) {
        if (premios.length >= cupo) { bloqueados++; continue; }
        entregados++;
        var rareza = null;
        if (entregados % CADA_N_PREMIOS_RARO === 0) {
          rareza = rng.random() < 1/3 ? 'muy_raro' : 'raro';
        }
        premios.push(sortearPowerUp(rng, true, rareza));
      }
    }
    return { premios: premios, bloqueados: bloqueados, cupo: cupo - premios.length };
  }

  function inventarioAgregar(inventario, puId, capacidad) {
    if (capacidad === undefined) capacidad = INVENTARIO_MAX;
    if (!powerUps()[puId]) throw new Error('Ese power up no existe.');
    var inv = inventario.slice();
    if (inv.length >= capacidad) return { inventario: inv, entro: false };
    inv.push(puId);
    return { inventario: inv, entro: true };
  }

  function validarEquipo(ids, cfg) {
    var c = normalizarConfig(cfg);
    if (new Set(ids).size !== ids.length) throw new Error('No se puede llevar el mismo power up dos veces.');
    var cuenta = { comun: 0, especial: 0, raro_o_muy_raro: 0 };
    ids.forEach(function(i) {
      if (!powerUps()[i]) throw new Error('El power up \'' + i + '\' no existe.');
      var pu = powerUps()[i];
      if (c.prohibidos.indexOf(i) >= 0) throw new Error('\'' + i + '\' esta prohibido en esta batalla.');
      if (c.rarezas.indexOf(pu.rareza) < 0) throw new Error('\'' + i + '\' no es de una rareza permitida.');
      if (pu.requiere_tiempo && !c.con_tiempo) throw new Error('\'' + i + '\' necesita tiempo y esta batalla no lo tiene.');
      var k = (pu.rareza === 'raro' || pu.rareza === 'muy_raro') ? 'raro_o_muy_raro' : pu.rareza;
      cuenta[k]++;
    });
    Object.keys(EQUIPO_MAX).forEach(function(k) {
      if (cuenta[k] > EQUIPO_MAX[k]) throw new Error('Demasiados power ups de tipo ' + k + ' (maximo ' + EQUIPO_MAX[k] + ').');
    });
    return ids.slice();
  }

  function validarMazo(preguntas, cfg) {
    var c = normalizarConfig(cfg);
    if (!Array.isArray(preguntas)) throw new Error('El mazo tiene que ser una lista de preguntas.');
    if (preguntas.length < c.mazo_min || preguntas.length > c.mazo_max)
      throw new Error('El mazo debe tener entre ' + c.mazo_min + ' y ' + c.mazo_max + ' preguntas (tiene ' + preguntas.length + ').');
    var ids = new Set(), limpio = [];
    preguntas.forEach(function(p) {
      if (!p || typeof p !== 'object') throw new Error('Una pregunta no tiene el formato correcto.');
      var pid = String(p.id || '').trim();
      var enun = String(p.enunciado || '').trim();
      var ops = p.opciones;
      if (!pid || !enun || !Array.isArray(ops) || ops.length < 2)
        throw new Error('Cada pregunta necesita id, enunciado y al menos 2 opciones.');
      if (ids.has(pid)) throw new Error('Hay dos preguntas con el mismo id (' + pid + ').');
      ids.add(pid);
      var opciones = ops.map(function(o) { return { id: String(o.id), texto: String(o.texto || '') }; });
      if (new Set(opciones.map(function(o) { return o.id; })).size !== opciones.length)
        throw new Error('La pregunta ' + pid + ' repite una opcion.');
      var correcta = String(p.correcta);
      if (opciones.map(function(o) { return o.id; }).indexOf(correcta) < 0)
        throw new Error('La pregunta ' + pid + ' no tiene respuesta correcta.');
      limpio.push({ id: pid, enunciado: enun, opciones: opciones, correcta: correcta, tema: String(p.tema || '') });
    });
    return limpio;
  }

  /* ===========================================================================
     BATALLA
     =========================================================================== */
  function _rng(seed, n) {
    var s = seed + '-' + n;
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return new SeededRandom(Math.abs(h));
  }

  function _otro(j) { return j === 'j1' ? 'j2' : 'j1'; }

  function _jugador(spec, cfg, esEnemigo) {
    var clase = spec.clase;
    if (CLASES.indexOf(clase) < 0) throw new Error('Clase desconocida: ' + clase);
    var mazo = validarMazo(spec.preguntas, esEnemigo ? Object.assign({}, cfg, { mazo_min: 1, mazo_max: 500 }) : cfg);
    var equipo = validarEquipo(spec.equipo || [], cfg);
    var pvMax = parseInt(spec.pv_max) || cfg.pv_max;
    return {
      nombre: String(spec.nombre || 'Jugador').slice(0, 24),
      clase: clase,
      nivel: Math.max(0, Math.min(999, parseInt(spec.nivel) || 0)),
      pv: pvMax, pv_max: pvMax,
      mazo: { preguntas: {}, orden: [], usadas: [] },
      oferta: [], equipo: {}, efectos: [], usados: [], usos_pregunta: 0,
      aciertos: 0, fallos: 0, ultimo_dano: 0
    };
  }

  function nuevaBatalla(config, spec1, spec2, semilla) {
    var cfg = normalizarConfig(config);
    if (semilla === undefined) semilla = Math.floor(Math.random() * (1 << 30));
    var estado = {
      v: 1, semilla: semilla, _n: 0, config: cfg,
      turno: 1, fase: 'elegir', atacante: cfg.modo === 'pvp' ? 'j1' : 'j2',
      pregunta: null, ganador: null, motivo: null, log: [],
      jugadores: { j1: {}, j2: {} }
    };
    // Inicializar jugadores
    var mazo1 = validarMazo(spec1.preguntas, cfg);
    var mazo2 = validarMazo(spec2.preguntas, Object.assign({}, cfg, { mazo_min: 1, mazo_max: 500 }));
    var equipo1 = validarEquipo(spec1.equipo || [], cfg);
    var equipo2 = validarEquipo(spec2.equipo || [], cfg);
    var pvMax1 = parseInt(spec1.pv_max) || cfg.pv_max;
    var pvMax2 = parseInt(spec2.pv_max) || cfg.pv_max;

    function makeJugador(spec, mazo, equipo, pvMax) {
      return {
        nombre: String(spec.nombre || 'Jugador').slice(0, 24),
        clase: spec.clase,
        nivel: Math.max(0, Math.min(999, parseInt(spec.nivel) || 0)),
        pv: pvMax, pv_max: pvMax,
        mazo: { preguntas: {}, orden: mazo.map(function(p) { return p.id; }), usadas: [] },
        oferta: [], equipo: {}, efectos: [], usados: [], usos_pregunta: 0,
        aciertos: 0, fallos: 0, ultimo_dano: 0
      };
    }

    mazo1.forEach(function(p) { estado.jugadores.j1.mazo.preguntas[p.id] = p; });
    mazo2.forEach(function(p) { estado.jugadores.j2.mazo.preguntas[p.id] = p; });

    estado.jugadores.j1 = makeJugador(spec1, mazo1, equipo1, pvMax1);
    estado.jugadores.j2 = makeJugador(spec2, mazo2, equipo2, pvMax2);

    // Configurar equipo con usos
    estado.jugadores.j1.equipo = {};
    equipo1.forEach(function(i) { estado.jugadores.j1.equipo[i] = USOS_POR_RAREZA[powerUps()[i].rareza]; });
    estado.jugadores.j2.equipo = {};
    equipo2.forEach(function(i) { estado.jugadores.j2.equipo[i] = USOS_POR_RAREZA[powerUps()[i].rareza]; });

    if (semilla === undefined) semilla = Math.floor(Math.random() * (1 << 30));
    estado.v = 1; estado.semilla = semilla; estado._n = 0;
    estado.config = cfg;
    estado.turno = 1; estado.fase = 'elegir';
    estado.atacante = cfg.modo === 'pvp' ? 'j1' : 'j2';
    estado.pregunta = null; estado.ganador = null; estado.motivo = null; estado.log = [];

    if (cfg.modo === 'pvp') {
      var rngSeed = new SeededRandom(semilla);
      estado.atacante = rngSeed.random() < 0.5 ? 'j1' : 'j2';
    }
    _empezarTurno(estado);
    return estado;
  }

  function _rngObj(estado) {
    estado._n++;
    return new SeededRandom(estado.semilla + '-' + estado._n);
  }

  function _otro(j) { return j === 'j1' ? 'j2' : 'j1'; }

  function _log(estado, tipo, datos) {
    var d = Object.assign({ tipo: tipo, turno: estado.turno }, datos || {});
    estado.log.push(d);
  }

  function _fase(estado, fase) {
    if (estado.ganador || estado.fase === 'fin') throw new Error('La batalla ya termino.');
    if (estado.fase !== fase) throw new Error('Ahora no se puede hacer eso.');
  }

  var _SOLO_DEFENSA = ['descartar', 'mostrar_tema', 'cambiar_pregunta', 'segunda_oportunidad'];

  function _momento(efecto) {
    for (var k in efecto) {
      if (_SOLO_DEFENSA.indexOf(k) >= 0) return 'defensa';
    }
    return 'cualquiera';
  }

  function _empezarTurno(estado) {
    var cfg = estado.config;
    for (var intento = 0; intento < 4; intento++) {
      var atq = estado.jugadores[estado.atacante];
      var perdido = atq.efectos.filter(function(e) { return e.tipo === 'perder_ataque'; });
      if (perdido.length) {
        perdido[0].turnos--;
        atq.efectos = atq.efectos.filter(function(e) {
          return !(e.tipo === 'perder_ataque' && (e.turnos || 1) <= 0);
        });
        _log(estado, 'ataque_perdido', { jugador: estado.atacante });
        if (cfg.modo === 'pvp') estado.atacante = _otro(estado.atacante);
        estado.turno++;
        continue;
      }
      break;
    }
    var atq = estado.jugadores[estado.atacante];
    atq.usos_pregunta = 0;
    estado.jugadores[_otro(estado.atacante)].usos_pregunta = 0;
    atq.oferta = _ofrecer(atq, _rngObj(estado), cfg.oferta);
    estado.fase = 'elegir';
    estado.pregunta = null;
    if (cfg.modo === 'pve') {
      var rng = _rngObj(estado);
      elegirPregunta(estado, estado.atacante, atq.oferta[rng.randomInt(0, atq.oferta.length - 1)], true);
    }
  }

  function _ofrecer(jug, rng, n) {
    var ids = jug.mazo.orden.slice();
    var libres = ids.filter(function(i) { return jug.mazo.usadas.indexOf(i) < 0; });
    if (!libres.length) {
      jug.mazo.usadas = [];
      libres = ids;
    }
    var nOf = Math.min(n, libres.length);
    var res = [];
    var copy = libres.slice();
    for (var i = 0; i < nOf; i++) {
      var idx = Math.floor(rng.random() * copy.length);
      res.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return res;
  }

  function elegirPregunta(estado, jid, preguntaId, auto) {
    _fase(estado, 'elegir');
    if (jid !== estado.atacante) throw new Error('No es tu turno de atacar.');
    var atq = estado.jugadores[jid];
    if (atq.oferta.indexOf(preguntaId) < 0) throw new Error('Esa pregunta no esta entre las que te tocaron.');
    atq.mazo.usadas.push(preguntaId);
    var p = atq.mazo.preguntas[preguntaId];
    estado.pregunta = { id: p.id, de: jid, ocultas: [], tema_visible: false, tiempo_extra: 0, reintento: [] };
    atq.oferta = [];
    estado.fase = 'responder';
    _log(estado, 'pregunta', { de: jid, pregunta: preguntaId });
    var dfn = estado.jugadores[_otro(jid)];
    dfn.efectos.filter(function(e) { return e.tipo === 'tiempo_menos'; })
      .forEach(function(e) {
        estado.pregunta.tiempo_extra -= e.seg;
        dfn.efectos = dfn.efectos.filter(function(x) { return x !== e; });
      });
    return estado;
  }

  function _aplicarEfecto(estado, jid, efecto) {
    var cfg = estado.config;
    var yo = estado.jugadores[jid];
    var rival = estado.jugadores[jid === 'j1' ? 'j2' : 'j1'];
    var p = estado.pregunta;
    for (var k in efecto) {
      var v = efecto[k];
      switch (k) {
        case 'cura':
          yo.pv = Math.min(yo.pv_max, yo.pv + v); break;
        case 'dano_directo':
          rival.pv = Math.max(0, rival.pv - v); break;
        case 'tiempo':
          if (cfg.con_tiempo && p) p.tiempo_extra += v;
          else if (cfg.con_tiempo) yo.efectos.push({ tipo: 'tiempo_mas', seg: v });
          break;
        case 'tiempo_rival':
          rival.efectos.push({ tipo: 'tiempo_menos', seg: v }); break;
        case 'mult_dano':
          yo.efectos.push({ tipo: 'mult_dano', valor: v.valor, golpes: v.golpes, rapido: false }); break;
        case 'mult_dano_rapido':
          yo.efectos.push({ tipo: 'mult_dano', valor: v.valor, golpes: v.golpes, rapido: true }); break;
        case 'escudo':
          yo.efectos.push({ tipo: 'escudo', pv: v.pv, golpes: v.golpes }); break;
        case 'reduccion':
          yo.efectos.push({ tipo: 'reduccion', pct: v.pct, golpes: v.golpes }); break;
        case 'descartar':
          if (p) {
            var correcta = estado.jugadores[p.de].mazo.preguntas[p.id].correcta;
            var malas = estado.jugadores[p.de].mazo.preguntas[p.id].opciones
              .filter(function(o) { return o.id !== correcta && p.ocultas.indexOf(o.id) < 0; })
              .map(function(o) { return o.id; });
            var rng = _rngObj(estado);
            var n = Math.min(parseInt(v), Math.max(0, malas.length - 1));
            for (var i = 0; i < n && malas.length; i++) {
              var idx = Math.floor(rng.random() * malas.length);
              p.ocultas.push(malas[idx]);
              malas.splice(idx, 1);
            }
          }
          break;
        case 'mostrar_tema':
          if (p) p.tema_visible = true; break;
        case 'cambiar_pregunta':
          _anularTurno(estado); break;
        case 'segunda_oportunidad':
          yo.efectos.push({ tipo: 'segunda', usos: parseInt(v) }); break;
        case 'purificar':
          yo.pv = Math.min(yo.pv_max, yo.pv + Math.min(v, yo.ultimo_dano)); break;
        case 'sangrado':
          rival.efectos.push({ tipo: 'sangrado', pv: v.pv, turnos: v.turnos }); break;
        case 'inmune_tiempo':
          yo.efectos.push({ tipo: 'inmune_tiempo', turnos: parseInt(v) }); break;
        case 'anular_desventaja':
          yo.efectos.push({ tipo: 'anular_desventaja', turnos: parseInt(v) }); break;
        case 'limpiar_negativos':
          yo.efectos = yo.efectos.filter(function(e) {
            return ['sangrado', 'tiempo_menos', 'perder_ataque'].indexOf(e.tipo) < 0;
          });
          break;
        case 'perder_ataque_rival':
          rival.efectos.push({ tipo: 'perder_ataque', turnos: parseInt(v) }); break;
      }
    }
  }

  function _anularTurno(estado) {
    _log(estado, 'turno_anulado', { por: 'cambiar_pregunta' });
    estado.turno++;
    _empezarTurno(estado);
  }

  function _dano(estado, golpea, recibe, factor, rapido) {
    var cfg = estado.config;
    var dealer = estado.jugadores[golpea];
    var victim = estado.jugadores[recibe];
    var pts = puntosDeClase(dealer.clase, victim.clase, cfg.ventaja);
    if (pts < 0 && dealer.efectos.some(function(e) { return e.tipo === 'anular_desventaja'; })) pts = 0;
    if (pts > 0 && victim.efectos.some(function(e) { return e.tipo === 'anular_desventaja'; })) pts = 0;
    var d = cfg.dano_base * factor + pts;
    d = Math.max(1, d);
    dealer.efectos.filter(function(e) { return e.tipo === 'mult_dano' && (!e.rapido || rapido); })
      .forEach(function(e) {
        d *= e.valor;
        e.golpes--;
        if (e.golpes <= 0) dealer.efectos = dealer.efectos.filter(function(x) { return x !== e; });
      });
    victim.efectos.filter(function(e) { return e.tipo === 'reduccion'; })
      .forEach(function(e) {
        d *= 1 - e.pct / 100;
        e.golpes--;
        if (e.golpes <= 0) victim.efectos = victim.efectos.filter(function(x) { return x !== e; });
      });
    d = Math.max(1, Math.round(d));
    victim.efectos.filter(function(e) { return e.tipo === 'escudo' && d > 0; })
      .forEach(function(e) {
        var absorbe = Math.min(d, e.pv);
        d -= absorbe;
        e.golpes--; e.pv -= absorbe;
        if (e.golpes <= 0 || e.pv <= 0) victim.efectos = victim.efectos.filter(function(x) { return x !== e; });
      });
    return Math.max(1, Math.round(d));
  }

  function responder(estado, jid, opcionId, milisegundos) {
    _fase(estado, 'responder');
    if (jid === estado.atacante) throw new Error('Te toca esperar: tu rival esta contestando.');
    var cfg = estado.config;
    var atqId = estado.atacante, dfnId = jid;
    var atq = estado.jugadores[atqId], dfn = estado.jugadores[dfnId];
    var p = estado.pregunta;
    var preg = atq.mazo.preguntas[p.id];
    if (opcionId !== null && preg.opciones.map(function(o) { return o.id; }).indexOf(opcionId) < 0)
      throw new Error('Esa opcion no existe.');
    var acierto = opcionId !== null && String(opcionId) === preg.correcta;

    if (!acierto && opcionId !== null) {
      var seg = dfn.efectos.filter(function(e) { return e.tipo === 'segunda' && e.usos > 0; })[0];
      if (seg) {
        seg.usos--;
        dfn.efectos = dfn.efectos.filter(function(x) { return !(x.tipo === 'segunda' && (x.usos || 1) <= 0); });
        if (p.ocultas.indexOf(opcionId) < 0) p.ocultas.push(opcionId);
        _log(estado, 'segunda_oportunidad', { jugador: dfnId });
        estado.ultimo = { reintento: true };
        return estado;
      }
    }

    var rapido = false;
    if (cfg.con_tiempo && milisegundos !== undefined) {
      var limite = (cfg.segundos_pregunta + p.tiempo_extra) * 1000;
      rapido = milisegundos <= limite / 2;
    }

    if (acierto) {
      dfn.aciertos++;
      var golpea = dfnId, recibe = atqId, factor = cfg.contraataque;
    } else {
      dfn.fallos++;
      var golpea = atqId, recibe = dfnId, factor = 1.0;
    }
    var dano = _dano(estado, golpea, recibe, factor, rapido);
    var victima = estado.jugadores[recibe];
    victima.pv = Math.max(0, victima.pv - dano);
    victima.ultimo_dano = dano;
    estado.ultimo = { acierto: acierto, golpea: golpea, recibe: recibe, dano: dano, correcta: preg.correcta };
    _log(estado, 'respuesta', { jugador: dfnId, acierto: acierto, dano: dano, recibe: recibe });

    if (!_revisarFin(estado)) _cierreTurno(estado);
    return estado;
  }

  function agotarTiempo(estado) {
    _fase(estado, 'responder');
    responder(estado, _otro(estado.atacante), null);
    if (estado.ultimo) estado.ultimo.tiempo_agotado = true;
    return estado;
  }

  function _cierreTurno(estado) {
    for (var jid in { j1: 1, j2: 1 }) {
      var jug = estado.jugadores[jid];
      jug.efectos.filter(function(e) { return e.tipo === 'sangrado'; }).forEach(function(e) {
        jug.pv = Math.max(0, jug.pv - e.pv);
        e.turnos--;
        if (e.turnos <= 0) jug.efectos = jug.efectos.filter(function(x) { return x !== e; });
      });
      jug.efectos.filter(function(e) { return ['inmune_tiempo', 'anular_desventaja'].indexOf(e.tipo) >= 0; })
        .forEach(function(e) {
          e.turnos--;
          if (e.turnos <= 0) jug.efectos = jug.efectos.filter(function(x) { return x !== e; });
        });
    }
    if (_revisarFin(estado)) return;
    estado.turno++;
    if (estado.config.modo === 'pvp') estado.atacante = _otro(estado.atacante);
    if (estado.turno > estado.config.max_turnos) { _terminarPorTurnos(estado); return; }
    _empezarTurno(estado);
    _revisarFin(estado);
  }

  function _revisarFin(estado) {
    if (estado.ganador || estado.fase === 'fin') return true;
    for (var jid in { j1: 1, j2: 1 }) {
      if (estado.jugadores[jid].pv <= 0) {
        estado.ganador = _otro(jid);
        estado.motivo = 'pv';
        estado.fase = 'fin';
        _log(estado, 'fin', { ganador: estado.ganador, motivo: 'pv' });
        return true;
      }
    }
    return false;
  }

  function _terminarPorTurnos(estado) {
    var a = estado.jugadores.j1.pv, b = estado.jugadores.j2.pv;
    estado.ganador = a > b ? 'j1' : (b > a ? 'j2' : 'empate');
    estado.motivo = 'turnos';
    estado.fase = 'fin';
    _log(estado, 'fin', { ganador: estado.ganador, motivo: 'turnos' });
  }

  var PCT_PV_POR_SEGUNDO = 0.3;

  function segundosConPerdida(transcurridos, tiempoExtra) {
    return Math.max(0, Math.floor(Math.max(0, parseFloat(transcurridos)) - (tiempoExtra || 0) - 3));
  }

  function tiempoPasado(estado, segundos) {
    if (!estado.config.con_tiempo || estado.fase !== 'responder') return estado;
    var dfn = estado.jugadores[_otro(estado.atacante)];
    if (dfn.efectos.some(function(e) { return e.tipo === 'inmune_tiempo'; })) return estado;
    var perdida = Math.max(0, segundos) * dfn.pv_max * PCT_PV_POR_SEGUNDO / 100;
    dfn.pv = Math.max(0, Math.round((dfn.pv - perdida) * 100) / 100);
    _revisarFin(estado);
    return estado;
  }

  function resumenFinal(estado) {
    return {
      ganador: estado.ganador, motivo: estado.motivo, turnos: estado.turno,
      jugadores: {
        j1: { aciertos: estado.jugadores.j1.aciertos, fallos: estado.jugadores.j1.fallos, pv: estado.jugadores.j1.pv, usados: estado.jugadores.j1.usados.slice() },
        j2: { aciertos: estado.jugadores.j2.aciertos, fallos: estado.jugadores.j2.fallos, pv: estado.jugadores.j2.pv, usados: estado.jugadores.j2.usados.slice() }
      }
    };
  }

  function estadoPublico(estado, jid, ocultarClaseRival) {
    var mio = estado.jugadores[jid];
    var otroId = _otro(jid);
    var rival = estado.jugadores[otroId];
    var p = estado.pregunta;
    var pregunta = null;
    if (p) {
      var q = estado.jugadores[p.de].mazo.preguntas[p.id];
      pregunta = {
        id: q.id, enunciado: q.enunciado, de: p.de,
        opciones: q.opciones.filter(function(o) { return p.ocultas.indexOf(o.id) < 0; }),
        tema: p.tema_visible && jid !== p.de ? q.tema : null,
        tiempo_extra: p.tiempo_extra
      };
    }
    var oferta = mio.oferta.map(function(i) {
      var q = mio.mazo.preguntas[i];
      return { id: i, enunciado: q.enunciado, tema: q.tema };
    });
    return {
      yo: jid, config: estado.config, turno: estado.turno, fase: estado.fase,
      atacante: estado.atacante, ganador: estado.ganador, motivo: estado.motivo,
      pregunta: pregunta, oferta: oferta, ultimo: estado.ultimo || null,
      yo_estado: {
        nombre: mio.nombre, clase: mio.clase, nivel: mio.nivel, pv: mio.pv, pv_max: mio.pv_max,
        equipo: Object.assign({}, mio.equipo), efectos: mio.efectos.map(function(e) { return Object.assign({}, e); }),
        preguntas_en_mazo: mio.mazo.orden.length
      },
      rival: {
        nombre: rival.nombre, clase: ocultarClaseRival ? null : rival.clase, nivel: rival.nivel, pv: rival.pv, pv_max: rival.pv_max,
        efectos: rival.efectos.map(function(e) { return Object.assign({}, e); }),
        preguntas_en_mazo: rival.mazo.orden.length
      }
    };
  }

  /* ===========================================================================
     NIVEL DE PRACTICA
     =========================================================================== */
  var TOPE_DIARIO = 120, PUNTOS_POR_MINUTO = 1, PUNTOS_POR_RONDA = 5, PUNTOS_POR_PREGUNTA = 0.5;
  var MINUTOS_MINIMOS = 1, PREGUNTAS_MINIMAS = 3;
  var TIPOS_QUE_CUENTAN = ['lectura', 'vision', 'test', 'rpg'];

  function puntosSesion(tipo, minutos, rondas, preguntas) {
    if (['lectura', 'vision'].indexOf(tipo) >= 0) {
      return minutos >= MINUTOS_MINIMOS ? minutos * PUNTOS_POR_MINUTO : 0;
    }
    if (['test', 'rpg'].indexOf(tipo) >= 0) {
      if (minutos >= MINUTOS_MINIMOS || preguntas >= PREGUNTAS_MINIMAS)
        return rondas * PUNTOS_POR_RONDA + preguntas * PUNTOS_POR_PREGUNTA;
      return 0;
    }
    return 0;
  }

  function aplicarTopeDiario(puntosHoy, nuevos, tope) {
    if (tope === undefined) tope = 120;
    return Math.max(0, Math.min(parseFloat(nuevos), tope - Math.max(0, parseFloat(puntosHoy))));
  }

  function puntosParaNivel(n) { return 20 * Math.pow(n, 1.5); }

  function nivelDePuntos(puntos) {
    var p = Math.max(0, parseFloat(puntos));
    var n = Math.floor(Math.pow(p / 20, 2/3));
    while (puntosParaNivel(n + 1) <= p) n++;
    while (n > 0 && puntosParaNivel(n) > p) n--;
    return n;
  }

  function progresoDeNivel(puntos) {
    var n = nivelDePuntos(puntos);
    var base = puntosParaNivel(n), tope = puntosParaNivel(n + 1);
    return { nivel: n, puntos: Math.round(parseFloat(puntos) * 10) / 10, desde: Math.ceil(base),
      siguiente: Math.ceil(tope), fraccion: Math.round((puntos - base) / (tope - base) * 1000) / 1000 };
  }

  function puntosDeSesiones(sesiones, tope) {
    if (tope === undefined) tope = 120;
    var porDia = {};
    (sesiones || []).forEach(function(s) {
      if (!s || typeof s !== 'object') return;
      var tipo = s.tipo;
      if (['lectura', 'vision', 'test', 'rpg'].indexOf(tipo) < 0) return;
      try {
        var pts = puntosSesion(tipo, parseFloat(s.minutos) || 0, parseInt(s.rondas) || 0, parseInt(s.preguntas) || 0);
      } catch (e) { return; }
      var dia = String(s.fecha || '').slice(0, 10);
      porDia[dia] = (porDia[dia] || 0) + Math.max(0, pts);
    });
    return Object.keys(porDia).reduce(function(a, d) { return a + Math.min(porDia[d], tope); }, 0);
  }

  /* ===========================================================================
     TARJETA DE JUGADOR (importar/exportar)
     =========================================================================== */
  var VERSION_TARJETA = 2;
  var SAL_TARJETA = 'reto-tarjeta-v2';
  var SAL_TARJETA_V1 = 'reto-tarjeta-v1';

  function validarPerfil(p, version) {
    if (!p || typeof p !== 'object') throw new Error('La tarjeta no tiene el formato correcto.');
    try {
      var puntos = Math.max(0, Math.min(1000000, parseFloat(p.puntos) || 0));
      var aciertos = Math.max(0, Math.min(10000000, parseInt(p.aciertos) || 0));
    } catch (e) { throw new Error('La tarjeta tiene numeros que no se entienden.'); }
    var inv = p.inventario || [];
    if (!Array.isArray(inv) || inv.length > INVENTARIO_MAX) throw new Error('El inventario de la tarjeta no es valido.');
    inv.forEach(function(i) { if (!powerUps()[i]) throw new Error('La tarjeta trae un power up que no existe.'); });
    var equipo = [], restante = inv.slice();
    (p.equipo || []).forEach(function(i) {
      if (restante.indexOf(i) >= 0 && equipo.indexOf(i) < 0) { equipo.push(i); restante.splice(restante.indexOf(i), 1); }
    });
    validarEquipo(equipo, { con_tiempo: true });
    var config = p.config || {}; if (typeof config !== 'object') config = {};
    var tpm = p.tiempo_por_modulo || {}; if (typeof tpm !== 'object') tpm = {};
    return { nombre: String(p.nombre || 'Jugador').slice(0, 24), puntos: Math.round(puntos * 10) / 10,
      nivel: nivelDePuntos(puntos), inventario: inv, equipo: equipo, aciertos: aciertos, config: config, tiempo_por_modulo: tpm };
  }

  function _huella(perfil, fecha, version) {
    var sal = version === 2 ? SAL_TARJETA : SAL_TARJETA_V1;
    var canon = JSON.stringify({ v: version, fecha: fecha, p: perfil }, Object.keys(perfil).sort());
    var hash = 0;
    for (var i = 0; i < (sal + canon).length; i++) {
      hash = ((hash << 5) - hash) + (sal + canon).charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).slice(0, 20);
  }

  function crearTarjeta(perfil, fecha) {
    var limpio = validarPerfil(perfil, 2);
    fecha = String(fecha).slice(0, 10);
    return Promise.resolve({ tipo: 'tarjeta-reto', v: 2, fecha: fecha, perfil: limpio, huella: _huella(limpio, fecha, 2) });
  }

  function validarTarjeta(t) {
    if (!t || t.tipo !== 'tarjeta-reto') throw new Error('Eso no es una tarjeta de jugador de R.E.T.O.');
    var version = t.v;
    if (version !== 1 && version !== 2) throw new Error('Version de tarjeta no soportada.');
    var perfil = validarPerfil(t.perfil, version);
    if (t.huella !== _huella(perfil, String(t.fecha || '').slice(0, 10), version))
      throw new Error('La tarjeta fue modificada o esta dañada. Pide otra.');
    return perfil;
  }

  function aTexto(tarjeta) { return JSON.stringify(tarjeta); }
  function leerTarjeta(texto) {
    try {
      var t = JSON.parse(texto);
      return Promise.resolve(validarTarjeta(t));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /* ===========================================================================
     EXPORT
     =========================================================================== */
  window.RetoRpg = {
    // Constantes
    CLASES: CLASES, GRUPOS: GRUPOS, GANA_A: GANA_A,
    VENTAJA_POR_DEFECTO: VENTAJA_POR_DEFECTO, VENTAJA_MIN: VENTAJA_MIN, VENTAJA_MAX: VENTAJA_MAX,
    RAREZAS: RAREZAS, USOS_POR_RAREZA: USOS_POR_RAREZA, EQUIPO_MAX: EQUIPO_MAX,
    PESOS_RAREZA: PESOS_RAREZA, CADA_N_ACIERTOS: CADA_N_ACIERTOS, CADA_N_PREMIOS_RARO: CADA_N_PREMIOS_RARO,
    TOPE_PREMIOS_DIA: TOPE_PREMIOS_DIA, INVENTARIO_MAX: INVENTARIO_MAX,
    CONFIG_POR_DEFECTO: CONFIG_POR_DEFECTO, PCT_PV_POR_SEGUNDO: PCT_PV_POR_SEGUNDO,
    INVENTARIO_MAX: INVENTARIO_MAX,

    // Power-ups
    powerUps: powerUps, textosPowerUps: textosPowerUps,
    sinergiaDe: sinergiaDe, efectoDe: efectoDe,
    elegibles: elegibles, sortearPowerUp: sortearPowerUp,
    sortearPremios: sortearPremios, inventarioAgregar: inventarioAgregar,
    validarEquipo: validarEquipo, validarMazo: validarMazo,

    // Batalla
    nuevaBatalla: nuevaBatalla,
    elegirPregunta: elegirPregunta,
    responder: responder,
    agotarTiempo: agotarTiempo,
    usarPowerUp: function(estado, jid, puId) {
      var cfg = estado.config;
      var jug = estado.jugadores[jid];
      var rolAtacante = estado.fase === 'elegir' && jid === estado.atacante;
      var rolDefensor = estado.fase === 'responder' && jid !== estado.atacante;
      if (!rolAtacante && !rolDefensor) throw new Error('Ahora no es tu momento de usar un power up.');
      if (!jug.equipo[puId]) throw new Error('No llevas ese power up.');
      if (jug.equipo[puId] <= 0) throw new Error('Ya no te quedan usos de ese power up.');
      if (cfg.max_power_ups !== null && jug.usados.length >= cfg.max_power_ups)
        throw new Error('Ya usaste todos los power ups que se permiten en esta batalla.');
      if (jug.usos_pregunta >= cfg.max_por_pregunta)
        throw new Error('Ya usaste el maximo de power ups en esta pregunta.');
      var efecto = efectoDe(puId, jug.clase, cfg.modo);
      if (_momento(efecto) === 'defensa' && !rolDefensor)
        throw new Error('Ese power up solo sirve cuando te toca responder.');
      _aplicarEfecto(estado, jid, efecto);
      jug.equipo[puId]--;
      jug.usos_pregunta++;
      jug.usados.push(puId);
      _log(estado, 'power_up', { jugador: jid, power_up: puId });
      _revisarFin(estado);
      return estado;
    },
    estadoPublico: estadoPublico,
    resumenFinal: resumenFinal,

    // Nivel
    puntosSesion: puntosSesion,
    aplicarTopeDiario: aplicarTopeDiario,
    puntosParaNivel: puntosParaNivel,
    nivelDePuntos: nivelDePuntos,
    progresoDeNivel: progresoDeNivel,
    puntosDeSesiones: puntosDeSesiones,

    // Tarjeta
    crearTarjeta: crearTarjeta,
    validarTarjeta: validarTarjeta,
    aTexto: aTexto,
    leerTarjeta: leerTarjeta,

    // Utilidades
    puntosDeClase: puntosDeClase,
    normalizarConfig: normalizarConfig,
    SeededRandom: SeededRandom
  };

  /* ===========================================================================
     SeededRandom
     =========================================================================== */
  function SeededRandom(seed) {
    this.seed = seed;
    this.random = function() {
      this.seed = (this.seed * 9301 + 49297) % 233280;
      return this.seed / 233280;
    };
    this.randomInt = function(min, max) { return min + Math.floor(this.random() * (max - min + 1)); };
    this.choices = function(arr, weights) {
      var total = weights.reduce(function(a, b) { return a + b; }, 0);
      var r = this.random() * total;
      for (var i = 0; i < arr.length; i++) {
        r -= weights[i];
        if (r <= 0) return [arr[i]];
      }
      return [arr[arr.length - 1]];
    };
  }

})(window);