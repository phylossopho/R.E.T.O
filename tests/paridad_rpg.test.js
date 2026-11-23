// Paridad Python -> JS: batallas completas paso a paso, premios, niveles, tarjetas.
const assert = require('assert');
const path = require('path');
const F = require('./fixtures/rpg.json');
const L = (m) => require(path.join('..', 'scripts', 'logica', m + '.js'));
const rpg = L('rpg'), { ValueError } = L('_base'), { PyRandom } = require('../scripts/reto-azar.js');
let n = 0;
function intentar(f) { try { return { ok: f() }; } catch (e) { if (e instanceof ValueError) return { error: e.message }; throw e; } }
function igual(a, b, m) { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, m); n++; }
const rng = (s) => new PyRandom(s);

F.batallas.forEach((b, bi) => {
  const r = intentar(() => rpg.nueva_batalla(b.cfg, b.s1, b.s2, b.sem));
  if (b.inicio.error) { igual(r, b.inicio, 'inicio error #' + bi); return; }
  igual(r.ok, b.inicio.ok, 'estado inicial #' + bi);
  const est = r.ok;
  b.pasos.forEach((p, pi) => {
    const a = p.a, tag = 'batalla ' + bi + ' paso ' + pi + ' ' + JSON.stringify(a);
    if (a[0] === 'resumen') { igual(rpg.resumen_final(est), p.resumen, tag); return; }
    const res = intentar(() => {
      if (a[0] === 'usar_power_up') return rpg.usar_power_up(est, a[1], a[2]);
      if (a[0] === 'elegir_pregunta') return rpg.elegir_pregunta(est, a[1], a[2]);
      if (a[0] === 'responder') return rpg.responder(est, a[1], a[2], a[3]);
      if (a[0] === 'agotar_tiempo') return rpg.agotar_tiempo(est);
      if (a[0] === 'tiempo_pasado') return rpg.tiempo_pasado(est, a[1]);
    });
    if (p.error) igual({ error: res.error }, { error: p.error }, tag); else assert(res.ok, tag + ' debía funcionar: ' + res.error);
    igual(est, p.estado, tag + ' estado');
    igual(rpg.estado_publico(est, 'j1'), p.pub1, tag + ' pub1');
    igual(rpg.estado_publico(est, 'j2', true), p.pub2, tag + ' pub2');
  });
});
F.premios.forEach(c => {
  if (c.a[0] === 'unico') { const s = c.a[1]; igual(rpg.sortear_power_up(rng(s), !!(s % 2), null), c.r); igual(rpg.sortear_power_up(rng(s), true, 'muy_raro'), c.raro); return; }
  const [a, d, s, ct, ea, eh] = c.a; igual(rpg.sortear_premios(a, d, rng(s), ct, ea, eh), c.r, 'premios ' + c.a);
});
F.niveles.forEach(c => {
  if ('nivel' in c) { igual(rpg.nivel_de_puntos(c.p), c.nivel, 'nivel ' + c.p); if (c.prog) igual(rpg.progreso_de_nivel(c.p), c.prog, 'prog ' + c.p); }
  else if (c.s) igual(rpg.puntos_sesion(...c.s), c.r, 'sesion ' + c.s);
  else if (c.t) igual(rpg.aplicar_tope_diario(...c.t), c.r);
  else if ('ses' in c) igual(rpg.puntos_de_sesiones(c.ses), c.r, 'sesiones');
  else if (c.seg) igual(rpg.segundos_con_perdida(...c.seg), c.r);
});
F.tarjetas.forEach((c, i) => {
  if ('perfil' in c) igual(intentar(() => rpg.crear_tarjeta(c.perfil, '2026-10-24T10:20:00')), c.t, 'crear tarjeta #' + i);
  else igual(intentar(() => rpg.validar_tarjeta(c.validar)), c.r, 'validar tarjeta #' + i);
});
F.config.forEach(c => igual(rpg.normalizar_config(c.cfg), c.r, 'config ' + JSON.stringify(c.cfg)));
F.mazo.forEach((c, i) => igual(intentar(() => rpg.validar_mazo(...c.a)), c.r, 'mazo #' + i));
F.equipo.forEach((c, i) => igual(intentar(() => rpg.validar_equipo(...c.a)), c.r, 'equipo #' + i));
F.efectos.forEach(c => igual(rpg.efecto_de(...c.a), c.r, 'efecto ' + c.a));
const v = F.varios;
igual([rpg.elegibles(true), rpg.elegibles(false), rpg.elegibles(true, ['raro'], [Object.keys(rpg.power_ups())[0]])], v[0].elegibles);
igual([intentar(() => rpg.inventario_agregar(['a'], Object.keys(rpg.power_ups())[0])), intentar(() => rpg.inventario_agregar(Array(99).fill('a'), Object.keys(rpg.power_ups())[0])), intentar(() => rpg.inventario_agregar([], 'zz'))], v[1].inv);
v[2].clase.forEach(([a, b, ven, r]) => igual(rpg.puntos_de_clase(a, b, ven), r));
console.log('paridad_rpg OK (' + n + ' comprobaciones)');
