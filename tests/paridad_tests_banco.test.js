// Paridad Python -> JS: dinamicas y rondas.
const assert = require('assert');
const path = require('path');
const F = require('./fixtures/tests_banco.json');
const L = (m) => require(path.join('..', 'scripts', 'logica', m + '.js'));
const dinamicas = L('dinamicas'), rondas = L('rondas'), { ValueError } = L('_base');
let n = 0;
function intentar(f) { try { return { ok: f() }; } catch (e) { if (e instanceof ValueError) return { error: e.message }; throw e; } }
function igual(a, b, m) { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, m); n++; }
function normErr(r) { return r.error ? { error: r.error.startsWith('Error evaluando') ? 'ERROR' : r.error } : r; }

F.dinamicas.forEach(c => igual(normErr(intentar(() => dinamicas.generar_instancia(c.p, c.s))), c.r, 'dinamica ' + JSON.stringify(c.p).slice(0, 80) + ' s=' + c.s));
F.rondas.forEach((c, i) => igual(intentar(() => rondas.armar_ronda(c.a[0], c.a[1], c.a[2], c.a[3], c.a[4], c.a[5])), c.r, 'ronda ' + i));
F.resumen.forEach(c => igual(intentar(() => rondas.resumen_test(...c.a)), c.r, 'resumen'));
F.registrar.forEach((c, i) => igual(intentar(() => rondas.registrar(...c.a)), c.r, 'registrar ' + i));
F.prioridad.forEach(c => { assert(Math.abs(rondas.prioridad(c.e, 1_900_000_000_000) - c.r) < 1e-12, 'prioridad'); n++; });
console.log('paridad_tests_banco OK (' + n + ' comprobaciones)');
