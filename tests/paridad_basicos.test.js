// Paridad Python -> JS: schulte, secuencia, red. Los fixtures salen de los módulos originales.
const assert = require('assert');
const path = require('path');
const F = require('./fixtures/basicos.json');
const L = (m) => require(path.join('..', 'scripts', 'logica', m + '.js'));
const schulte = L('schulte'), secuencia = L('secuencia'), red = L('red');
const { ValueError } = L('_base');
let n = 0;
function intentar(f) { try { return { ok: f() }; } catch (e) { if (e instanceof ValueError) return { error: e.message }; throw e; } }
function igual(a, b, m) { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, m); n++; }

F.schulte.forEach(c => igual(intentar(() => schulte.nueva_tabla(...c.a)), c.r, 'schulte ' + JSON.stringify(c.a)));
F.secuencia.forEach(c => igual(intentar(() => secuencia.nueva_secuencia(...c.a)), c.r, 'secuencia ' + JSON.stringify(c.a)));
igual(schulte.catalogos(), F.cat.schulte, 'catalogo schulte');
igual(secuencia.catalogos(), F.cat.secuencia, 'catalogo secuencia');
F.cat.contraste.forEach(([a, b, r]) => { assert(Math.abs(secuencia.contraste(a, b) - r) < 1e-12); n++; });
F.cat.texto.forEach(([c, r]) => igual(secuencia.color_de_texto(c), r));
F.red.forEach(c => {
  if (c.k === 'local') igual(red.es_direccion_local(c.a[0]), c.r, 'local ' + c.a[0]);
  if (c.k === 'nombre') igual(red.limpiar_nombre(c.a[0]), c.r);
  if (c.k === 'cid') igual(red.limpiar_cid(c.a[0]), c.r);
  if (c.k === 'mensaje') igual(intentar(() => red.limpiar_mensaje(c.a[0])), c.r);
  if (c.k === 'eco') {
    const e = new red.Eco(), r = c.r;
    igual(e.agregar('Ana', 'hola', '1.1.1.1', 100.0, 'aa'), r[0]);
    igual(intentar(() => e.agregar('Ana', 'otra', '1.1.1.1', 100.2, 'aa')), r[1]);
    igual(e.agregar('Luis', 'ey', '1.1.1.2', 100.3, 'bb'), r[2]);
    igual(e.desde(0, '1.1.1.1', 101.0, 'aa'), r[3]);
    igual(e.desde(1, '1.1.1.9', 120.0), r[4]);
  }
});
console.log('paridad_basicos OK (' + n + ' comprobaciones)');
