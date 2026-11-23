// Paridad Python -> JS: mahjong y memorama.
const assert = require('assert');
const path = require('path');
const F = require('./fixtures/juegos.json');
const L = (m) => require(path.join('..', 'scripts', 'logica', m + '.js'));
const mahjong = L('mahjong'), memorama = L('memorama'), { ValueError } = L('_base');
let n = 0;
function intentar(f) { try { return { ok: f() }; } catch (e) { if (e instanceof ValueError) return { error: e.message }; throw e; } }
function igual(a, b, m) { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, m); n++; }

F.mahjong.forEach(c => igual(intentar(() => mahjong.nueva_partida(...c.a)), c.r, 'mahjong ' + c.a));
F.revolver.forEach(c => {
  igual(intentar(() => mahjong.revolver(...c.a)), c.r, 'revolver');
  if (c.jug) igual(mahjong.jugadas(c.a[0]), c.jug, 'jugadas');
});
igual(mahjong.catalogos(), F.cat_mahjong, 'catalogos mahjong');
igual(memorama.catalogos(), F.cat_memorama, 'catalogos memorama');
F.memorama.forEach(c => igual(intentar(() => memorama.nueva_partida(...c.a)), c.r, 'memorama ' + c.a));

let p = memorama.nueva_partida('4x4', 'formas', 7), i = 0;
const simb = {};
p.cartas.forEach(c => (simb[c.simbolo] = simb[c.simbolo] || []).push(c.id));
const reg = (c) => { const r = memorama.voltear(p, c); p = r[0]; const e = F.juego[i++]; igual(r[1], e.res); igual(memorama.estado_para_la_pagina(p), e.vista); };
reg(0); reg(1);
if (p.bloqueado) { const e = F.juego[i++]; igual(memorama.estado_para_la_pagina(memorama.ocultar(p)), e.vista); }
Object.values(simb).forEach(ids => ids.forEach(reg));
console.log('paridad_juegos OK (' + n + ' comprobaciones)');
