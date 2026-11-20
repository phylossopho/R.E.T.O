/* =========================================================================
   R.E.T.O. - Las fuentes de lectura
   -------------------------------------------------------------------------
   Este archivo sabe DOS cosas:

     1. Cuales fuentes trae el sitio (las de styles/fuentes/, la lista de
        abajo), y
     2. cuales instalo la persona desde sus propios archivos (.woff2, .woff,
        .ttf, .otf), que se guardan en ESTE navegador.

   Y nada mas. No sabe en que pantalla se usan ni como se ve el texto: quien
   quiera una fuente le pide aqui "la del id tal" y recibe el valor listo para
   poner en `font-family`.

     RetoFuentes.lista()            -> promesa de [{id, nombre, nota, familia,
                                                    origen, css}]
     RetoFuentes.aplicar(id)        -> promesa de {id, nombre, css}: la fuente ya
                                       cargada (o la de por defecto, si ese id
                                       no existe)
     RetoFuentes.instalar(archivo)  -> promesa de la entrada nueva; si no sirve,
                                       se rechaza con un mensaje que se puede
                                       mostrar tal cual
     RetoFuentes.quitar(id)         -> promesa; solo quita las de la persona
     RetoFuentes.POR_DEFECTO        -> el id de la fuente del sitio
     RetoFuentes.LIMITES            -> {bytes, cuantas}

   POR QUE LAS DE LA PERSONA SE GUARDAN EN TEXTO (base64) Y NO COMO ARCHIVO
   Porque viajan por tres caminos y solo el texto pasa por los tres:
     - IndexedDB, que guarda binarios sin problema;
     - el respaldo de localStorage (cuando el navegador no tiene IndexedDB),
       que solo guarda texto: un binario se volveria "{}" y la fuente se
       perderia sin aviso;
     - el archivo de respaldo .json de Configuracion, que tambien es texto.
   Cuesta un tercio mas de espacio (el base64). Para eso esta el tope de
   tamano, mas abajo.

   POR QUE SE PRUEBA LA FUENTE ANTES DE GUARDARLA
   Una fuente es un archivo que el navegador abre y lee por dentro, y uno
   dañado o que no es una fuente (un .txt renombrado) no debe llegar a
   guardarse: quedaria en la lista para siempre, rota. El navegador se niega a
   abrir lo que no es una fuente valida, y esa negativa es la prueba. Antes se
   mira el principio del archivo, solo para poder decir un mensaje claro en vez
   de "fallo".

   LA FUENTE NUNCA ES CODIGO
   Se carga con la API de fuentes del navegador (FontFace), que no ejecuta
   nada. Por eso aceptar "un archivo que la persona trae" es seguro aqui, a
   diferencia de aceptar un .js (ver lectura-veloz.md, seccion 7).
   ========================================================================= */
(function () {
  'use strict';

  var CLAVE = 'lectura_fuentes_usuario';
  var POR_DEFECTO = 'nunito';

  /* Tope de tamano de UN archivo y de cuantos se pueden tener. Son de
     seguridad, no de gusto: los datos viven en el navegador (unos 5 MB en el
     peor caso, el de localStorage) y viajan en el respaldo. Una fuente normal
     de texto pesa entre 20 y 300 KB; 1.5 MB es una con mucho mas de lo que hace
     falta para leer. */
  var LIMITES = { bytes: 1536 * 1024, cuantas: 6 };

  /* LAS DEL SITIO. Cada una esta en styles/fuentes/ y se declara en su
     @font-face (nunito.css y lectura/lectura.css). "familia" es EL MISMO NOMBRE
     que el font-family de ese @font-face: si no coinciden, el navegador no
     encuentra la fuente y cae a otra sin ningun aviso.

     Las notas son para quien elige. Dicen lo que se sabe, y no mas: una fuente
     "para dislexia" no es buena para todas las personas con dislexia, y decir
     lo contrario seria prometer lo que no esta probado. */
  var DEL_SITIO = [
    { id: 'nunito', nombre: 'Nunito', familia: 'Nunito',
      nota: 'La del sitio. Redonda y amable.' },
    { id: 'atkinson', nombre: 'Atkinson Hyperlegible', familia: 'Atkinson Hyperlegible',
      nota: 'Hecha para quien ve poco: cada letra se distingue bien de las otras.' },
    { id: 'lexend', nombre: 'Lexend', familia: 'Lexend',
      nota: 'Letras abiertas y anchas, pensada para leer con comodidad.' },
    { id: 'opendyslexic', nombre: 'OpenDyslexic', familia: 'OpenDyslexic',
      nota: 'Letras con la base pesada. A algunas personas con dislexia les ayuda; a otras no.' },
    { id: 'merriweather', nombre: 'Merriweather', familia: 'Merriweather',
      nota: 'Con remates, como un libro. Hecha para leer en pantalla.' },
    { id: 'roboto-mono', nombre: 'Roboto Mono', familia: 'Roboto Mono',
      nota: 'De ancho fijo, clara y sobria. Cada letra y cada número se distinguen bien.' },
    { id: 'orbitron', nombre: 'Orbitron', familia: 'Orbitron',
      nota: 'De ciencia ficción. Muy de espacio, pero cansa en textos largos.' }
  ];

  /* Lo que se pone al final de todo font-family: si la fuente elegida no
     carga, el texto se sigue leyendo con la del sitio y no con una cualquiera. */
  var RESPALDO = '"Nunito", system-ui, sans-serif';

  var caras = {};       // id -> FontFace ya agregada (solo las de la persona)

  /* ------------------------------------------------------------ utilidades */

  function css(familia) {
    return '"' + familia + '", ' + RESPALDO;
  }

  function guardadas() {
    if (!window.RetoDatos) return Promise.resolve([]);
    return window.RetoDatos.obtener(CLAVE).then(function (v) {
      return Array.isArray(v) ? v.filter(valida) : [];
    }).catch(function () { return []; });
  }

  /* Una entrada guardada se comprueba antes de usarla: el respaldo se puede
     haber editado a mano, o venir de una version con otro formato. Con una
     entrada rara, lo peor que pasa es que se ignora, no que se rompa el modal. */
  function valida(e) {
    return e && typeof e.id === 'string' && /^u[a-z0-9]{3,20}$/.test(e.id) &&
           typeof e.nombre === 'string' && typeof e.datos === 'string' &&
           e.datos.indexOf('data:') === 0;
  }

  function familiaDeLaPersona(id) { return 'RETO usuario ' + id; }

  function entradaDeLaPersona(e) {
    return {
      id: e.id, nombre: e.nombre, nota: 'Instalada por ti.',
      familia: familiaDeLaPersona(e.id), origen: 'usuario',
      css: css(familiaDeLaPersona(e.id))
    };
  }

  function entradaDelSitio(e) {
    return { id: e.id, nombre: e.nombre, nota: e.nota, familia: e.familia,
             origen: 'sitio', css: css(e.familia) };
  }

  /* Le dice al navegador que esta fuente existe. Devuelve la promesa de que
     cargue, que se rechaza si el archivo no es una fuente. */
  function registrar(e) {
    if (!window.FontFace || !document.fonts) return Promise.resolve();
    if (caras[e.id]) { try { document.fonts.delete(caras[e.id]); } catch (x) {} }
    var cara = new window.FontFace(familiaDeLaPersona(e.id), 'url("' + e.datos + '")');
    caras[e.id] = cara;
    return cara.load().then(function (c) { document.fonts.add(c); return c; });
  }

  /* Carga normal y negrita de una fuente del sitio, y NO se queda esperando
     siempre: si un archivo tarda o falla, a los 2 segundos se sigue con lo que
     haya. Esperar sin limite dejaria la lectura en blanco por una fuente. */
  function cargarDelSitio(e) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var q = function (peso) {
      return document.fonts.load(peso + ' 1em "' + e.familia + '"').catch(function () {});
    };
    return Promise.race([
      Promise.all([q(400), q(700)]),
      new Promise(function (r) { setTimeout(r, 2000); })
    ]);
  }

  /* ------------------------------------------------------------------ API */

  function lista() {
    return guardadas().then(function (g) {
      // Se registran para que el modal pueda mostrar cada nombre con SU letra.
      g.forEach(function (e) { if (!caras[e.id]) registrar(e).catch(function () {}); });
      return DEL_SITIO.map(entradaDelSitio).concat(g.map(entradaDeLaPersona));
    });
  }

  function aplicar(id) {
    return lista().then(function (todas) {
      var elegida = null;
      for (var i = 0; i < todas.length; i++) if (todas[i].id === id) elegida = todas[i];
      if (!elegida) elegida = todas[0];   // la del sitio: siempre es la primera
      var listo = elegida.origen === 'usuario'
        ? (caras[elegida.id] ? caras[elegida.id].loaded : Promise.resolve())
        : cargarDelSitio(elegida);
      return Promise.resolve(listo).catch(function () {}).then(function () {
        return { id: elegida.id, nombre: elegida.nombre, css: elegida.css };
      });
    });
  }

  /* ---------------------------------------------------------- instalar */

  var EXTENSIONES = /\.(woff2|woff|ttf|otf)$/i;

  function leer(blob, comoTexto) {
    return new Promise(function (resolver, rechazar) {
      var r = new FileReader();
      r.onload = function () { resolver(r.result); };
      r.onerror = function () { rechazar(new Error('No se pudo leer el archivo.')); };
      if (comoTexto) r.readAsDataURL(blob); else r.readAsArrayBuffer(blob);
    });
  }

  /* Los primeros cuatro bytes de cada formato. Se mira SOLO para dar un
     mensaje claro; quien decide de verdad si sirve es el navegador. */
  function pareceFuente(buf) {
    var b = new Uint8Array(buf);
    if (b.length < 4) return false;
    var s = String.fromCharCode(b[0], b[1], b[2], b[3]);
    return s === 'wOF2' || s === 'wOFF' || s === 'OTTO' || s === 'true' ||
           (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0);
  }

  function nombreBonito(nombreArchivo) {
    var n = String(nombreArchivo || '').replace(EXTENSIONES, '')
      .replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
    // Solo letras, numeros y espacios: el nombre se ve en pantalla y viaja en
    // el respaldo, y no hay razon para dejar pasar mas.
    n = n.replace(/[^A-Za-z0-9\u00C0-\u017F ]/g, '').trim();
    return (n || 'Mi fuente').slice(0, 40);
  }

  function idNuevo() {
    return 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  function instalar(archivo) {
    if (!archivo) return Promise.reject(new Error('No elegiste ningún archivo.'));
    if (!EXTENSIONES.test(archivo.name || '')) {
      return Promise.reject(new Error(
        'Ese archivo no parece una fuente. Sirven los que terminan en .woff2, .woff, .ttf u .otf.'));
    }
    if (archivo.size > LIMITES.bytes) {
      // Hacia ARRIBA: con un archivo de 1,5 MB y un byte, redondear al mas cercano
      // dice "pesa 1,5 MB y el maximo es 1,5 MB", que no explica nada.
      var mb = (Math.ceil(archivo.size / 1048576 * 10) / 10).toFixed(1).replace('.', ',');
      return Promise.reject(new Error(
        'Ese archivo pesa ' + mb + ' MB y el máximo es 1,5 MB. Busca una versión más liviana (.woff2 pesa menos).'));
    }
    var nombre = nombreBonito(archivo.name);
    var nueva;

    return leer(archivo.slice(0, 4), false).then(function (buf) {
      if (!pareceFuente(buf)) {
        throw new Error('Ese archivo no es una fuente, aunque tenga el nombre. Puede estar dañado.');
      }
      return leer(archivo, true);
    }).then(function (datos) {
      nueva = { id: null, nombre: nombre, datos: datos };
      return guardadas();
    }).then(function (g) {
      // La misma fuente dos veces: se reemplaza, no se duplica. Si quien la
      // vuelve a instalar cambio el archivo, asi queda con el nuevo.
      var i = 0;
      while (i < g.length && g[i].nombre.toLowerCase() !== nombre.toLowerCase()) i++;
      if (i === g.length && g.length >= LIMITES.cuantas) {
        throw new Error('Ya tienes ' + LIMITES.cuantas +
          ' fuentes instaladas. Quita una para poner otra.');
      }
      nueva.id = i < g.length ? g[i].id : idNuevo();
      // Se prueba ANTES de guardar. Si el navegador no la abre, no se guarda.
      return registrar(nueva).catch(function () {
        throw new Error('El navegador no pudo abrir esta fuente. Puede estar dañada o ser de un tipo raro.');
      }).then(function () {
        if (i < g.length) g[i] = nueva; else g.push(nueva);
        return window.RetoDatos.poner(CLAVE, g).catch(function () {
          // No cupo: se deshace lo registrado, para no dejar una fuente que
          // funciona hoy y desaparece al recargar.
          try { document.fonts.delete(caras[nueva.id]); } catch (x) {}
          delete caras[nueva.id];
          throw new Error('No se pudo guardar la fuente: este navegador no tiene espacio o no deja guardar.');
        });
      });
    }).then(function () {
      return entradaDeLaPersona(nueva);
    });
  }

  function quitar(id) {
    return guardadas().then(function (g) {
      var resto = g.filter(function (e) { return e.id !== id; });
      if (caras[id]) { try { document.fonts.delete(caras[id]); } catch (x) {} delete caras[id]; }
      return window.RetoDatos.poner(CLAVE, resto);
    });
  }

  window.RetoFuentes = {
    lista: lista,
    aplicar: aplicar,
    instalar: instalar,
    quitar: quitar,
    POR_DEFECTO: POR_DEFECTO,
    LIMITES: LIMITES
  };
})();
