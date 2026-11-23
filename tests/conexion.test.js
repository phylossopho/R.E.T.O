// Multijugador sin servidor: anfitrión e invitado son dos instancias separadas de la "API"
// y se hablan por un enlace (en memoria) o por BroadcastChannel (entre pestañas).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { crearApi } = require('../scripts/reto-api.js');
const { crearConexion } = require('../scripts/reto-conexion.js');
const raiz = path.join(__dirname, '..');

function nuevaPestana(nombre, opcionesConexion) {
  let api;
  api = crearApi({
    base: 'http://sitio.test/',
    cargarLogica: (n) => require(path.join(raiz, 'scripts', 'logica', n + '.js')),
    leerJson: (rel) => Promise.resolve(JSON.parse(fs.readFileSync(path.join(raiz, rel), 'utf8'))),
    cargarConexion: (a) => { crearConexion(a, opcionesConexion || {}); return Promise.resolve(); }
  });
  api.nombre = nombre;
  api.llamar = (metodo, ruta, cuerpo, consulta) => api.manejar({ metodo, ruta, cuerpo, consulta, origen: 'local' });
  return api;
}
const mazo = (n = 24, p = 'm') => Array.from({ length: n }, (_, i) => ({ id: p + i, enunciado: 'P' + i, tema: 'T',
  opciones: [{ id: 'a', texto: 'A' }, { id: 'b', texto: 'B' }, { id: 'c', texto: 'C' }], correcta: 'abc'[i % 3] }));
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
let n = 0;
const ok = (r, m) => { assert.strictEqual(r.status, 200, (m || '') + ' → ' + r.status + ' ' + JSON.stringify(r.body)); n++; return r.body; };

let contadorEnlaces = 0;
function unirPorEnlace(anfitrion, invitado) {
  const id = 'inv' + (++contadorEnlaces);
  [anfitrion, invitado].forEach(a => { if (!a.conexion()) crearConexion(a, {}); });
  const ca = anfitrion.conexion(), ci = invitado.conexion();
  ca.agregarEnlace(id, { rol: 'anfitrion', enviar: (m) => setImmediate(() => ci.recibir('anf', JSON.parse(JSON.stringify(m)))) });
  ci.agregarEnlace('anf', { rol: 'cliente', enviar: (m) => setImmediate(() => ca.recibir(id, JSON.parse(JSON.stringify(m)))) });
}

(async () => {
  /* ===== 1. Ding! por enlace directo ===== */
  {
    const A = nuevaPestana('anfitrion'), I = nuevaPestana('invitado');
    const pres = ok(await A.llamar('POST', '/api/ding/crear', { nombre: 'Profe' }), 'crear ding');
    await I.llamar('GET', '/api/red/info');
    // un código que no existe en ninguna pestaña ni enlace: 404 como "no existe esa sala"
    const sin = await I.llamar('POST', '/api/ding/unirse', { codigo: 'ZZZZ', nombre: 'Ana' });
    assert.strictEqual(sin.status, 404); n++;
    unirPorEnlace(A, I);
    const j1 = ok(await I.llamar('POST', '/api/ding/unirse', { codigo: pres.codigo, nombre: 'Ana' }), 'unirse por enlace');
    assert.strictEqual(j1.yo, 'p1'); n++;
    const I2 = nuevaPestana('invitado2'); unirPorEnlace(A, I2);
    const j2 = ok(await I2.llamar('POST', '/api/ding/unirse', { codigo: pres.codigo, nombre: 'Luis' }));
    assert.strictEqual(j2.yo, 'p2'); n++;
    ok(await A.llamar('POST', `/api/ding/${pres.codigo}/test`, { token: pres.token, titulo: 'Demo', preguntas: mazo(4).map(q => ({ ...q, id: 'q' + q.id })) }), 'test');
    ok(await A.llamar('POST', `/api/ding/${pres.codigo}/configurar`, { token: pres.token, config: { efecto: 'ninguno', auto_avance: false } }));
    ok(await A.llamar('POST', `/api/ding/${pres.codigo}/accion`, { token: pres.token, tipo: 'empezar' }), 'empezar');
    const ve = ok(await I.llamar('GET', `/api/ding/${pres.codigo}/estado`, null, { token: j1.token }), 'estado invitado');
    assert.strictEqual(ve.fase, 'abierta'); assert.ok(Array.isArray(ve.opciones)); n++;
    // el invitado contesta; el ganador es quien acierta primero
    const sala = A.estado.dings._salas[pres.codigo], correcta = sala.actual.correcta;
    const r1 = ok(await I.llamar('POST', `/api/ding/${pres.codigo}/accion`, { token: j1.token, tipo: 'responder', opcion: correcta }), 'responder');
    assert.strictEqual(r1.ding, true); n++;
    const vis = ok(await I2.llamar('GET', `/api/ding/${pres.codigo}/estado`, null, { token: j2.token }));
    assert.strictEqual(vis.ding, false); n++;                                    // el otro no sabe quién ganó, solo que no fue él
    // un invitado no puede crear salas "remotas" ni mandar cosas fuera de multijugador
    const mal = await A.ejecutarRemota({ metodo: 'POST', ruta: '/api/ding/crear', cuerpo: {} }, 'x'); assert.strictEqual(mal.status, 403); n++;
    const mal2 = await A.ejecutarRemota({ metodo: 'POST', ruta: '/api/pve/iniciar', cuerpo: {} }, 'x'); assert.strictEqual(mal2.status, 403); n++;
    // cerrar: solo el presentador
    const cerrarMal = await I.llamar('POST', `/api/ding/${pres.codigo}/cerrar`, { token: j1.token }); assert.strictEqual(cerrarMal.status, 403); n++;
    ok(await A.llamar('POST', `/api/ding/${pres.codigo}/cerrar`, { token: pres.token }));
  }

  /* ===== 2. Duelo por enlace directo: partida completa ===== */
  {
    const A = nuevaPestana('anfitrion'), I = nuevaPestana('invitado');
    unirPorEnlace(A, I);
    const c = ok(await A.llamar('POST', '/api/sala/crear', { nombre: 'Ana' }));
    const u = ok(await I.llamar('POST', '/api/sala/unirse', { codigo: c.codigo, nombre: 'Luis' }));
    const toks = { j1: c.token, j2: u.token }, quien = { j1: A, j2: I };
    for (const j of ['j1', 'j2']) ok(await quien[j].llamar('POST', `/api/sala/${c.codigo}/preparar`, { token: toks[j], clase: j === 'j1' ? 'mago' : 'guerrero', mazo: mazo(24, j), equipo: [] }));
    for (const j of ['j1', 'j2']) ok(await quien[j].llamar('POST', `/api/sala/${c.codigo}/listo`, { token: toks[j], listo: true }));
    let est = ok(await I.llamar('GET', `/api/sala/${c.codigo}/estado`, null, { token: toks.j2 }));
    assert.strictEqual(est.fase, 'duelo'); n++;
    let vueltas = 0;
    while (est.fase === 'duelo' && vueltas++ < 400) {
      const sala = A.estado.salas._salas[c.codigo], b = sala.batalla, atq = b.atacante, dfn = atq === 'j1' ? 'j2' : 'j1';
      if (b.fase === 'elegir') ok(await quien[atq].llamar('POST', `/api/sala/${c.codigo}/accion`, { token: toks[atq], tipo: 'elegir', pregunta: b.jugadores[atq].oferta[0] }));
      else {
        const p = b.pregunta, q = b.jugadores[p.de].mazo.preguntas[p.id];
        const opcion = dfn === 'j1' ? q.correcta : q.opciones.find(o => o.id !== q.correcta).id;   // j1 acierta, j2 falla
        ok(await quien[dfn].llamar('POST', `/api/sala/${c.codigo}/accion`, { token: toks[dfn], tipo: 'responder', opcion }), 'responder');
      }
      est = ok(await quien.j2.llamar('GET', `/api/sala/${c.codigo}/estado`, null, { token: toks.j2 }));
    }
    assert.strictEqual(est.fase, 'fin', 'el duelo debía terminar'); assert.strictEqual(est.resultado.ganador, 'j1'); n++;
    const rev = ok(await I.llamar('POST', `/api/sala/${c.codigo}/accion`, { token: toks.j2, tipo: 'revancha' })); assert.strictEqual(rev.fase, 'espera'); n++;
    // una sala que no existe → 404 con el mismo texto que daba el servidor
    const nada = await I.llamar('GET', '/api/sala/QQQQ/estado', null, { token: 'x' });
    assert.strictEqual(nada.status, 404); assert.strictEqual(nada.body.error, 'No existe esa sala. Revisa el código.'); n++;
  }

  /* ===== 3. Entre pestañas (BroadcastChannel) ===== */
  {
    const A = nuevaPestana('pestana-A'), I = nuevaPestana('pestana-B');
    const c = ok(await A.llamar('POST', '/api/sala/crear', { nombre: 'Ana' }), 'crear en A');
    const u = ok(await I.llamar('POST', '/api/sala/unirse', { codigo: c.codigo.toLowerCase(), nombre: 'Luis' }), 'unirse desde B por canal');
    assert.strictEqual(u.yo, 'j2'); n++;
    const e = ok(await I.llamar('GET', `/api/sala/${c.codigo}/estado`, null, { token: u.token }), 'estado desde B');
    assert.strictEqual(e.jugadores.length, 2); n++;
    const t0 = Date.now();
    const nada = await I.llamar('POST', '/api/sala/unirse', { codigo: 'ZZZZ', nombre: 'Luis' });
    assert.strictEqual(nada.status, 404); assert.ok(Date.now() - t0 >= 500, 'esperó a que alguna pestaña contestara'); n++;
    A.conexion().cerrarTodo(); I.conexion().cerrarTodo();
  }
  console.log('conexion OK (' + n + ' comprobaciones)');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
