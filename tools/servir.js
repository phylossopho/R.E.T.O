#!/usr/bin/env node
/* R.E.T.O. - Servidor local para probar el sitio (tools/servir.js)
   El sitio es estático: en GitHub Pages no hace falta nada más. Para probarlo en
   tu computadora, abre la carpeta del proyecto y ejecuta:   node tools/servir.js
   y luego entra a http://localhost:8000   (localhost cuenta como "contexto seguro",
   así que funcionan IndexedDB y el modo sin conexión aunque no sea https).
   Uso:  node tools/servir.js [puerto]                                           */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const PUERTO = parseInt(process.argv[2] || process.env.PORT || '8000', 10);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8' };
// Lo que NO se publica (igual que en el despliegue).
const OCULTO = /^\/(\.git|node_modules|_legacy_python|plantilla-RETOapp|tests|tools)(\/|$)|\.cmd$/;

http.createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (OCULTO.test(ruta) || ruta.includes('..')) { res.writeHead(404); return res.end('No encontrado'); }
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = path.join(RAIZ, ruta);
  fs.readFile(archivo, (err, datos) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado: ' + ruta); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(datos);
  });
}).listen(PUERTO, () => console.log('R.E.T.O. en http://localhost:' + PUERTO + '   (Ctrl+C para detener)'));
