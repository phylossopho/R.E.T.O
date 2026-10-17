/* =========================================================================
   R.E.T.O. - Los textos de ejemplo
   -------------------------------------------------------------------------
   La carpeta ejemplos/ del proyecto trae tres textos de muestra. Este archivo
   los mete en la biblioteca **la primera vez que se abre el sitio**, para que
   quien llega tenga algo que leer y practicar desde el primer momento, en vez
   de una biblioteca vacía que parece un programa roto.

   QUE HACE, EN TRES PASOS
   1. Pregunta a la biblioteca quantos documentos hay.
   2. Si hay alguno, no hace NADA. Es la regla que importa: la siembra solo
      cuando esta vacia. Si alguien borro todo a proposito, los ejemplos no
      vuelven a aparecer solos.
   3. Si esta vacia, los pide al servidor, los pasa por el MISMO analizador que
      el importador de archivos y los guarda.

   POR QUE HACE FALTA EL SERVIDOR PARA LEER UNA CARPETA
   Un navegador no puede listar un directorio: no hay forma de pedirle "dime
   que hay dentro de ejemplos/". Por eso el servidor tiene una ruta que se lo
   dice (ver /api/ejemplos en server.py). Y no hay ningun archivo con la lista
   escrita a mano, porque entonces la verdad estaria en dos sitios y un texto
   nuevo no apareceria sin que nadie se avive.

   EL ANALIZADOR Y EL REGISTRO, LOS MISMOS QUE AL IMPORTAR
   Se usa RetoMarcado.documentoNuevo(), que es el camino comun. Un ejemplo se
   arma exactamente igual que un archivo que elige la persona: si el ejemplo
   estuviera mal marcado, alwebsite lo dira igual que a un archivo malo, y no
   se guardaria. Aqui no hay una via nueva que se pueda desincronizar.

   NUNCA ROMPE UNA PAGINA
   Si falta algo (el servidor no esta, la carpeta vacia, el navegador la corta
   por CORS), esta funcion resuelve sin guardar nada y sin lanzar errores. La
   biblioteca se queda vacia, que es como estaba antes, y la pagina sigue
   mostrando su lista vacia con su boton de Importar. Una siembra que no se
   puede hacer no puede romper el sitio.
   ========================================================================= */
(function () {
  'use strict';

  /* La bandera de "ya se sembro". Sin ella, si alguien borra todos sus
     documentos, los ejemplos volverian a aparecer en la siguiente visita, que
     es justo lo que uno no espera al borrar. Se guarda en localStorage, que
     es donde vive el resto de las preferencias; si ahi no se puede escribir
     (modo privado), se cae a la regla de "biblioteca vacia", que es peor pero
     no rompe nada. */
  var CLAVE = 'ejemplos_sembrados';

  function yaSembro() {
    try { return localStorage.getItem(CLAVE) === '1'; } catch (e) { return false; }
  }

  function marcarSembrado() {
    try { localStorage.setItem(CLAVE, '1'); } catch (e) { /* sin bandera */ }
  }

  /* Lo que se guarda en la lista, en una linea, para poder verlo con el
     informe de depuracion sin abrir la base de datos. */
  var ultimo = { sembrados: 0, omitidos: 0 };

  function pedir() {
    if (!window.fetch) return Promise.resolve([]);
    return window.fetch('/api/ejemplos')
      .then(function (r) { return r.ok ? r.json() : { ejemplos: [] }; })
      .then(function (d) { return (d && d.ejemplos) || []; })
      .catch(function () { return []; });
  }

  /* Siembra los ejemplos. SIEMPRE resuelve, nunca rechaza: quien la llama la
     encadena con la lista de la biblioteca, y un fallo aqui no puede dejar la
     pagina a medio pintar. */
  function sembrar() {
    if (!window.RetoDatos || !window.RetoDatos.libros || !window.RetoMarcado) {
      return Promise.resolve(ultimo);
    }
    if (yaSembro()) return Promise.resolve(ultimo);

    return window.RetoDatos.libros.listar().then(function (docs) {
      /* La biblioteca vacia es la unica razon para sembrar. Con algo dentro no
         se hace nada, ni aunque falten los ejemplos: la biblioteca es de la
         persona, no del programa. */
      if (docs && docs.length) return ultimo;

      return pedir().then(function (ejemplos) {
        if (!ejemplos.length) {
          /* No hay ejemplos en el servidor, o no se pudieron pedir. No se
             marca la bandera: si despues se agrega uno, entra sin borrar
             nada. */
          return ultimo;
        }

        /* Uno por uno y en cadena, y no todos a la vez: se escriben en el
           mismo almacen, y guardarlos al mismo tiempo a veces hace que uno se
           pierda sin que se note. Con el bucle se ve en que fallo. */
        var guardados = 0;
        var omitidos = 0;
        var i = 0;

        function siguiente() {
          if (i >= ejemplos.length) return Promise.resolve();
          var ej = ejemplos[i++];
          var hecho = window.RetoMarcado.documentoNuevo(ej.nombre, ej.cuerpo);
          if (!hecho.registro) {
            /* Un ejemplo mal marcado no se guarda, y no avisa a nadie: es un
               archivo del programa, no algo que la persona haya pedido. El
               informe de depuracion si lo cuenta (ver ultimo). */
            omitidos++;
            return siguiente();
          }
          return window.RetoDatos.libros.guardar(hecho.registro)
            .then(function () { guardados++; })
            .catch(function () { omitidos++; })
            .then(siguiente);
        }

        return siguiente().then(function () {
          ultimo = { sembrados: guardados, omitidos: omitidos };
          /* Se marca aunque algunos no se guardaran. Si no, se volveria a
             intentar en cada visita, y lo que quedo a medias se acumularia. */
          if (guardados) marcarSembrado();
          return ultimo;
        });
      });
    }).catch(function () {
      return ultimo;
    });
  }

  window.RetoEjemplos = {
    sembrar: sembrar,
    ultimo: function () { return ultimo; }
  };

})(window);