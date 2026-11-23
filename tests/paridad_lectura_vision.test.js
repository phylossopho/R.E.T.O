// Paridad Python -> JS: lectura veloz y visión.
const assert = require('assert');
const path = require('path');
const F = require('./fixtures/lectura_vision.json');
const L = (m) => require(path.join('..', 'scripts', 'logica', m + '.js'));
const lv = L('lectura_veloz'), vision = L('vision'), { ValueError } = L('_base');
let n = 0;
function intentar(f) { try { return { ok: f() }; } catch (e) { if (e instanceof ValueError) return { error: e.message }; throw e; } }
// Compara con tolerancia en los números decimales (seno/coseno/hipotenusa pueden diferir en el último bit).
function cerca(a, b, ruta) {
  if (typeof a === 'number' && typeof b === 'number') { assert(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)) + 2e-4 * (ruta.indexOf('puntos') >= 0 || ruta.indexOf('pasos') >= 0 || ruta.indexOf('acumulado') >= 0 || ruta.indexOf('longitud') >= 0 || ruta.indexOf('vuelta') >= 0 ? 0.5 : 0), ruta + ': ' + a + ' vs ' + b); return; }
  assert.strictEqual(Array.isArray(a), Array.isArray(b), ruta);
  if (a && typeof a === 'object') {
    assert.deepStrictEqual(Object.keys(a).sort(), Object.keys(b).sort(), ruta);
    Object.keys(b).forEach(k => cerca(a[k], b[k], ruta + '.' + k));
  } else assert.strictEqual(a, b, ruta);
}
function igual(a, b, m) { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, m); n++; }

const PLANES = { galactico: (p) => lv.plan_galactico(p), palabra: (p) => lv.plan_palabra(p), grupo3: (p) => lv.plan_grupo(p, 3), grupo4: (p) => lv.plan_grupo(p, 4),
  frases: (p) => lv.plan_frases(p), prueba: (p) => lv.plan_prueba(p), pacer1: (p) => lv.plan_pacer(p, 1), pacer2: (p) => lv.plan_pacer(p, 2),
  pacer3: (p) => lv.plan_pacer(p), skimming: (p) => lv.plan_skimming(p) };
F.planes.forEach((c, i) => igual(intentar(() => PLANES[c.m](c.p)), c.r, 'plan ' + c.m + ' #' + i));
F.skim.forEach(c => igual(intentar(() => lv.plan_skimming(c.p)), c.r, 'skim'));
F.utiles.forEach(c => { igual(lv.tipo_de_pausa(c.w), c.tipo, 'pausa ' + c.w); igual(lv.pausa_ms(c.w), c.ms); igual(lv.punto_de_fijacion(c.w), c.foco, 'foco ' + c.w); });
F.velocidad.forEach(c => igual(intentar(() => lv.calcular_velocidad(...c.a)), c.r, 'velocidad ' + JSON.stringify(c.a)));
F.acotar.forEach(c => { igual(lv.acotar_wpm(c.v), c.wpm, 'wpm ' + c.v); igual(lv.acotar_escala(lv.ESCALA_INICIO, c.v), c.ini, 'ini ' + c.v); igual(lv.acotar_escala(lv.ESCALA_FIN, c.v), c.fin, 'fin ' + c.v); });
F.vision.forEach((c, i) => {
  const r = intentar(() => c.aj ? vision.ajustar_para(c.e, c.d) : vision.plan_para(c.e, c.d));
  const esp = c.r;
  if (c.e === 'seguimiento') { cerca(JSON.parse(JSON.stringify(r)), esp, 'seguimiento#' + i); n++; }
  else igual(r, esp, 'vision ' + c.e + ' ' + JSON.stringify(c.d));
});
console.log('paridad_lectura_vision OK (' + n + ' comprobaciones)');
