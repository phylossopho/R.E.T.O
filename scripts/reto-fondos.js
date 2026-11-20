/* ==========================================================================
   R.E.T.O. - Fondos de la batalla

   Las imagenes de fondo viven en imagenes/fondos/. Para agregar una basta con dejarla
   ahi (webp, png, jpg, jpeg o avif): la lista estatica esta en /datos/fondos.json y
   aqui se elige una AL AZAR para cada batalla. No hay que registrar nada ni tocar codigo.

   window.RetoFondos
     lista()    -> Promise<[url]>      los fondos que hay (vacio si no se pudo preguntar)
     elegir()   -> Promise<url|null>   uno al azar; null si no hay ninguno (la batalla se ve
                                       igual, solo con su degradado de siempre)
   ========================================================================== */
(function () {
  'use strict';

  var cache = null;

  function lista() {
    if (cache) return cache;
    cache = fetch('/datos/fondos.json').then(function (r) { return r.ok ? r.json() : { fondos: [] }; })
      .then(function (d) { return Array.isArray(d.fondos) ? d.fondos : []; })
      .catch(function () { return []; });
    return cache;
  }

  function elegir() {
    return lista().then(function (l) { return l.length ? l[Math.floor(Math.random() * l.length)] : null; });
  }

  window.RetoFondos = { lista: lista, elegir: elegir };
}());
