#!/usr/bin/env node
/* Corre todas las pruebas de tests/*.test.js, una por una, y resume. Sale con error si alguna falla. */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archivos = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();
let fallos = 0;
archivos.forEach((f) => {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8' });
  const salida = (r.stdout || '').trim().split('\n').pop();
  if (r.status === 0) console.log('  ✔ ' + salida);
  else { fallos++; console.log('  ✘ ' + f + '\n' + (r.stdout || '') + (r.stderr || '')); }
});
console.log(fallos ? '\n' + fallos + ' prueba(s) fallaron.' : '\nTodo en orden: ' + archivos.length + ' archivos de pruebas.');
process.exit(fallos ? 1 : 0);
