// Salud del sitio: lo que se publica no debe traer conflictos de Git a medias,
// referencias rotas ni restos de los módulos que ya no existen.
// Si esta prueba falla, el despliegue de GitHub se detiene y dice qué archivo es.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RAIZ = path.join(__dirname, '..');
const problemas = [];
let revisados = 0;

const OMITIR = new Set(['.git', '.github', 'node_modules', '_legacy_python', 'plantilla-RETOapp', 'tests', 'tools', 'imagenes', 'sonidos']);
function recorrer(dir, salida) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (OMITIR.has(e.name)) return;
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) recorrer(ruta, salida); else salida.push(ruta);
  });
  return salida;
}
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const archivos = recorrer(RAIZ, []);
const sitio = archivos.filter((f) => /\.(html|js|css|json|webmanifest)$/.test(f) && !/(^|\/)(test_|_)[^/]*\.js$/.test(rel(f)));

// 1) Marcas de conflicto de Git (<<<<<<<, >>>>>>>) y 2) sintaxis de cada JavaScript, 3) JSON válidos
sitio.forEach((f) => {
  const texto = fs.readFileSync(f, 'utf8');
  revisados++;
  texto.split('\n').forEach((l, i) => {
    if (/^(<<<<<<<|>>>>>>>)( |$)/.test(l)) problemas.push(rel(f) + ':' + (i + 1) + ' tiene una marca de conflicto de Git (' + l.slice(0, 7) + '). Hay que resolver ese conflicto.');
  });
  if (f.endsWith('.js')) {
    try { new vm.Script(texto, { filename: rel(f) }); }
    catch (e) { problemas.push(rel(f) + ' tiene un error de sintaxis: ' + e.message); }
  }
  if (/\.(json|webmanifest)$/.test(f)) {
    try { JSON.parse(texto); } catch (e) { problemas.push(rel(f) + ' no es un JSON válido: ' + e.message); }
  }
});

// 4) Lo que cada página carga existe; 5) no quedan módulos retirados; 6) las páginas con API traen reto-api.js
const RETIRADOS = /reto-(api-local|basepath|offline-cache|rpg-logica|lectura-veloz-logica|mahjong-logica|memorama-logica|vision-logica|webrtc|salas|duelo-p2p|ding-p2p|firebase|firebase-sync|duelo-firebase|ding-firebase)\.js/;
const PROHIBIDO_EN_JS = ['llamarPveLocal', 'RetoDueloP2P', 'RetoApiLocal'];
sitio.filter((f) => f.endsWith('.html')).forEach((f) => {
  const html = fs.readFileSync(f, 'utf8');
  const re = /<(?:script|link)\b[^>]*?\b(?:src|href)="([^"#]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1].split('?')[0];
    if (/^([a-z]+:|\/\/|data:)/i.test(u)) continue;
    if (RETIRADOS.test(u)) problemas.push(rel(f) + ' todavía carga ' + u + ', un módulo que ya no existe.');
    const destino = u.charAt(0) === '/' ? path.join(RAIZ, u) : path.resolve(path.dirname(f), u);
    if (!fs.existsSync(destino)) problemas.push(rel(f) + ' carga ' + u + ' pero ese archivo no existe.');
  }
  const esPagina = /^(index\.html|categorias\/.*\.html|configuracion[^/]*\.html)$/.test(rel(f));
  if (esPagina && !/scripts\/reto-api\.js/.test(html)) problemas.push(rel(f) + ' no carga scripts/reto-api.js (sin él no responden las reglas del sitio).');
});
sitio.filter((f) => f.endsWith('.js')).forEach((f) => {
  const t = fs.readFileSync(f, 'utf8');
  PROHIBIDO_EN_JS.forEach((p) => { if (t.includes(p)) problemas.push(rel(f) + ' todavía usa "' + p + '" (código de la conversión anterior).'); });
});

// 7) Lo imprescindible está
['index.html', 'sw.js', 'manifest.webmanifest', 'scripts/reto-api.js', 'scripts/reto-azar.js', 'scripts/reto-conexion.js', 'scripts/logica/_base.js',
 'scripts/logica/rpg.js', 'scripts/logica/pve.js', 'scripts/logica/sala.js', 'scripts/logica/ding.js', 'datos/powerups.json', 'datos/powerups_textos.json',
 'datos/ejemplos.json', 'datos/fondos.json', 'datos/sprites.json', 'datos/incognito.json'].forEach((a) => {
  if (!fs.existsSync(path.join(RAIZ, a))) problemas.push('Falta ' + a + ' (¿lo ignoró .gitignore o no se copió?).');
});

if (problemas.length) {
  console.error('\nEl sitio tiene ' + problemas.length + ' problema(s):');
  problemas.slice(0, 60).forEach((p) => console.error('  ✘ ' + p));
  process.exit(1);
}
console.log('sitio OK (' + revisados + ' archivos revisados: sin conflictos, sin referencias rotas)');
