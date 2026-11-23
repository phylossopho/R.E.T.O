// Paridad HTTP: las mismas peticiones que se le hicieron al server.py original (Flask)
// contra el enrutador de reto-api.js. Se comparan código de estado y JSON.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const F = require('./fixtures/http.json');
const { crearApi } = require('../scripts/reto-api.js');
const raiz = path.join(__dirname, '..');

const api = crearApi({
  base: 'http://sitio.test/',
  cargarLogica: (n) => require(path.join(raiz, 'scripts', 'logica', n + '.js')),
  leerJson: (rel) => Promise.resolve(JSON.parse(fs.readFileSync(path.join(raiz, rel), 'utf8')))
});

function quitar(o, claves) { // quita campos que dependen del reloj
  if (Array.isArray(o)) return o.forEach(x => quitar(x, claves));
  if (o && typeof o === 'object') Object.keys(o).forEach(k => { if (claves.includes(k)) delete o[k]; else quitar(o[k], claves); });
}

(async () => {
  let n = 0;
  for (const q of F.reqs) {
    if (q.status >= 500) continue;                  // el original se caía (500); aquí devuelve 400 con mensaje
    const [rutaSola, qs] = q.ruta.split('?');
    const consulta = {}; if (qs) qs.split('&').forEach(p => { const [k, v] = p.split('='); consulta[k] = decodeURIComponent(v); });
    const r = await api.manejar({ metodo: q.m, ruta: rutaSola, consulta, cuerpo: q.cuerpo, origen: 'local' });
    const got = JSON.parse(JSON.stringify(r.body)), exp = q.json;
    if (q.ruta === '/api/rpg/tarjeta' && r.status === 200) {      // la fecha de hoy cambia la huella: se comprueba su forma y la validez
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(got.fecha) && /^[0-9a-f]{20}$/.test(got.huella), 'tarjeta con fecha y huella');
      const v = await api.manejar({ metodo: 'POST', ruta: '/api/rpg/tarjeta/validar', cuerpo: { tarjeta: got }, origen: 'local' });
      assert.strictEqual(v.status, 200, 'la tarjeta recién creada debe validar'); n++;
    }
    quitar(got, ['ahora', 'ultimo', 'vence', 'fecha', 'huella']); quitar(exp, ['ahora', 'ultimo', 'vence', 'fecha', 'huella']);
    assert.strictEqual(r.status, q.status, q.m + ' ' + q.ruta + ' ' + JSON.stringify(q.cuerpo).slice(0, 100) + ' → estado ' + r.status + ' en vez de ' + q.status + ' ' + JSON.stringify(got).slice(0, 200));
    if (/memorama\/(voltear|ocultar)/.test(q.ruta) && q.status === 404) { assert.strictEqual(r.status, 404); n++; continue; }   // el texto cambia a propósito: ya no hay "servidor"
    assert.deepStrictEqual(got, exp, q.m + ' ' + q.ruta + ' ' + JSON.stringify(q.cuerpo).slice(0, 100));
    n++;
  }
  console.log('paridad_http OK (' + n + ' peticiones iguales al servidor original)');
})().catch(e => { console.error(e.message || e); process.exit(1); });
