#!/usr/bin/env node
/* R.E.T.O. - Generador de índices (tools/generar-indices.js)
   Un sitio estático no puede "listar una carpeta". Este script recorre las
   carpetas y escribe los índices que antes armaba server.py al vuelo:

     datos/ejemplos.json    ← ejemplos/*.txt
     datos/fondos.json      ← imagenes/fondos/*
     datos/sprites.json     ← imagenes/sprites/<personaje>/<frente|espalda>/<espera|ataque|herido>[_N].(webp|png)
     datos/incognito.json   ← imagenes/incognito/*

   Se corre solo en cada despliegue (.github/workflows/deploy-pages.yml). Para
   verlo en tu computadora tras agregar imágenes:   node tools/generar-indices.js
*/
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const IMAGENES = new Set(['.webp', '.png', '.jpg', '.jpeg', '.avif']);
const SPRITE = /^(espera|ataque|herido)(?:_(\d+))?\.(webp|png)$/i;

const ordenar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function listar(carpeta) { try { return fs.readdirSync(carpeta).sort(ordenar); } catch (e) { return []; } }
function esCarpeta(p) { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }
function escribir(nombre, obj) {
  const ruta = path.join(RAIZ, 'datos', nombre);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function ejemplos() {
  const dir = path.join(RAIZ, 'ejemplos'), salida = [];
  listar(dir).forEach((nombre) => {
    if (!nombre.toLowerCase().endsWith('.txt')) return;
    let cuerpo;
    try { cuerpo = fs.readFileSync(path.join(dir, nombre), 'utf8'); } catch (e) { return; }
    cuerpo = cuerpo.replace(/\r\n?/g, '\n');                       // como hacía Python al leer en modo texto
    if (cuerpo.charAt(0) === '\ufeff') cuerpo = cuerpo.slice(1);
    if (!cuerpo.trim()) return;
    salida.push({ nombre: nombre.slice(0, nombre.length - path.extname(nombre).length), cuerpo });
  });
  return { ejemplos: salida };
}
function imagenesDe(sub) {
  return listar(path.join(RAIZ, 'imagenes', sub)).filter((n) => IMAGENES.has(path.extname(n).toLowerCase()));
}
function sprites() {
  const raiz = path.join(RAIZ, 'imagenes', 'sprites'), mapa = {};
  listar(raiz).forEach((personaje) => {
    if (personaje.startsWith('_') || !esCarpeta(path.join(raiz, personaje))) return;
    ['frente', 'espalda'].forEach((vista) => {
      const carpeta = path.join(raiz, personaje, vista);
      if (!esCarpeta(carpeta)) return;
      const estados = {};
      listar(carpeta).forEach((nombre) => {
        const m = SPRITE.exec(nombre);
        if (m) (estados[m[1].toLowerCase()] = estados[m[1].toLowerCase()] || []).push([parseInt(m[2] || '0', 10), nombre]);
      });
      Object.keys(estados).forEach((estado) => {
        const url = 'imagenes/sprites/' + personaje + '/' + vista + '/';
        ((mapa[personaje] = mapa[personaje] || {})[vista] = mapa[personaje][vista] || {})[estado] =
          estados[estado].sort((a, b) => (a[0] - b[0]) || ordenar(a[1], b[1])).map((c) => url + c[1]);
      });
    });
  });
  return { sprites: mapa };
}

const e = ejemplos(), f = imagenesDe('fondos'), i = imagenesDe('incognito'), s = sprites();
escribir('ejemplos.json', e);
escribir('fondos.json', { fondos: f.map((n) => 'imagenes/fondos/' + n) });
escribir('sprites.json', s);
escribir('incognito.json', { imagen: i.length ? 'imagenes/incognito/' + i[0] : null });
console.log('Índices listos: ' + e.ejemplos.length + ' ejemplos, ' + f.length + ' fondos, ' +
  Object.keys(s.sprites).length + ' personajes con sprites, imagen incógnito: ' + (i.length ? i[0] : 'ninguna'));
