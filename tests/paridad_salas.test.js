// Paridad Python -> JS: aventura (pve), duelo (sala) y Ding!, con reloj falso y azar determinista.
const assert = require('assert');
const path = require('path');
const F = require('./fixtures/salas.json');
const L = (m) => require(path.join('..', 'scripts', 'logica', m + '.js'));
const pve = L('pve'), sala = L('sala'), ding = L('ding'), { ValueError } = L('_base');
const { PyRandom } = require('../scripts/reto-azar.js');
let n = 0;

// Mismo azar determinista que tools/paridad/gen_salas.py
const cont = { tok: 0, let: 0, sys: 0 };
const azar = {
  token_urlsafe: (k) => { cont.tok++; return 'tok' + cont.tok + '_' + (k === undefined ? 32 : k); },
  choice: (t) => { cont.let++; return t.charAt((cont.let * 7) % t.length); }
};
PyRandom.sistemaRandrange = (k) => { cont.sys++; return (cont.sys * 7919 + 13) % k; };
const reloj = { t: 1000 };
const ahora = () => reloj.t;

function igual(a, b, m) { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, m); n++; }
function repetir(obj, ops, etiqueta) {
  ops.forEach((o, i) => {
    reloj.t = o.at;
    let r;
    try { r = { ok: obj[o.m](...o.a) }; }
    catch (e) {
      if (e instanceof pve.ErrorPve || e instanceof sala.ErrorSala) r = { error: e.message, http: e.http };
      else if (e instanceof ValueError) r = { valueerror: e.message };
      else throw e;
    }
    // Los textos de error de las fórmulas vienen de Python; se comparan sin el detalle del intérprete.
    const norm = (x) => { const s = JSON.stringify(x); return JSON.parse(s.replace(/(no se puede calcular: ).*?"/, '$1X"')); };
    igual(norm(r), norm(o.r), etiqueta + ' #' + i + ' ' + o.m + ' ' + JSON.stringify(o.a).slice(0, 120));
  });
}

F.pve.forEach(c => { cont.tok = cont.let = cont.sys = 0; repetir(new pve.Aventuras({ reloj: ahora, azar }), c.ops, 'pve ' + c.n); });
F.sala.forEach(c => { cont.tok = cont.let = cont.sys = 0; repetir(new sala.Salas({ reloj: ahora, azar }), c.ops, 'sala ' + c.n); });
F.ding.forEach(c => { cont.tok = cont.let = cont.sys = 0; repetir(new ding.Dings({ reloj: ahora, azar, rng: new PyRandom(77 + c.n) }), c.ops, 'ding ' + c.n); });
console.log('paridad_salas OK (' + n + ' comprobaciones)');
