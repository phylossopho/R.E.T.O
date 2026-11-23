/* =========================================================================
   R.E.T.O. - Reglas del Mahjong (la parte que no depende de la pantalla)

   Dos funciones puras: qué fichas están libres y qué parejas se pueden quitar.
   No tocan la página, así que se cargan igual en el navegador y en Node.

   ESTA REGLA ESTÁ ESCRITA DOS VECES: aquí y en scripts/logica/mahjong.js (libres() y
   jugadas()). El navegador la necesita en cada toque para marcar qué se puede
   tocar, y un viaje al servidor por toque retrasaría el juego. Por eso
   test_mahjong.py corre ESTE archivo con Node y comprueba que dé lo mismo que
   Python en cientos de tableros. Si cambias una, cambia la otra.

   Una ficha ocupa 2 x 2 unidades. Está LIBRE si no tiene nada encima (ni
   siquiera en parte) y, por lo menos, uno de sus lados está despejado.
   Cada ficha es { id, x, y, z, t }: posición, piso y cara.
   ========================================================================= */
(function (raiz) {
  'use strict';

  var ANCHO = 2;
  var ALTO = 2;

  function tapa(a, b) {
    return b.z === a.z + 1 && Math.abs(b.x - a.x) < ANCHO &&
           Math.abs(b.y - a.y) < ALTO;
  }

  function vecina(a, b, lado) {
    if (b.z !== a.z || Math.abs(b.y - a.y) >= ALTO) return false;
    var dx = b.x - a.x;
    return lado < 0 ? (dx < 0 && dx >= -ANCHO) : (dx > 0 && dx <= ANCHO);
  }

  /* Los ids de las fichas libres. */
  function libres(fichas) {
    var salida = [];
    for (var i = 0; i < fichas.length; i++) {
      var a = fichas[i];
      var tapada = false, izq = false, der = false;
      for (var j = 0; j < fichas.length; j++) {
        if (i === j) continue;
        var b = fichas[j];
        if (tapa(a, b)) { tapada = true; break; }
        if (vecina(a, b, -1)) izq = true;
        else if (vecina(a, b, 1)) der = true;
      }
      if (!tapada && !(izq && der)) salida.push(a.id);
    }
    return salida;
  }

  /* Las parejas que se pueden quitar ahora: [[idA, idB], ...]. */
  function jugadas(fichas) {
    var ids = libres(fichas);
    var porId = {};
    fichas.forEach(function (f) { porId[f.id] = f; });
    var salida = [];
    for (var i = 0; i < ids.length; i++) {
      for (var j = i + 1; j < ids.length; j++) {
        if (porId[ids[i]].t === porId[ids[j]].t) salida.push([ids[i], ids[j]]);
      }
    }
    return salida;
  }

  var API = { libres: libres, jugadas: jugadas };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.RetoMahjongReglas = API;
})(typeof window !== 'undefined' ? window : this);
