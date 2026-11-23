/* =========================================================================
   R.E.T.O. - Marcado de textos y libros
   -------------------------------------------------------------------------
   Lee un archivo de texto plano con el marcado de R.E.T.O. y lo convierte en
   una estructura de arbol. Sirve para lo mismo en el navegador y en Node, para
   poder probarlo sin abrir nada: en el navegador, importar; en la terminal,
   comprobar que el formato aguanta.

   EL FORMATO
   -----------
   Dos tipos de documento, y la diferencia es uno solo: si el archivo tiene
   marcadores de nivel, es un LIBRO; si no tiene ninguno, es un TEXTO.

     LIBRO
       [N1] Los numeros que usamos
       Un parrafo comun, sin nada especial.
       [N2] La suma
       Otro parrafo.
       [N2] La resta
       Y aqui las lecturas, que son los textos de 2 a 3 minutos:
       [N3] Sumar sin llevar
       El cuerpo de la lectura.

     TEXTO
       Solo parrafos. Sin marcadores. Dos o tres minutos de lectura.

   La unica marca es de ESTRUCTURA:

     [N1] a [N4]  Van al principio de la linea, sin espacios antes. Dicen DONDE
                   estamos dentro del libro. El 1 es el nivel mas alto (bloque)
                   y el 4 el mas bajo (la lectura).

   (Las versiones anteriores tenian una segunda marca, [A1], para senalar las
   ideas que se podian preguntar. Ya no se usa. Si un archivo viejo la trae,
   se quita en silencio al leerlo, para que no aparezca como texto raro.)

   QUE HACE ESTE ARCHIVO
   ---------------------
   1. Convierte el texto en un arbol de nodos.
   2. Lo revisa y devuelve los PROBLEMAS que encuentra, con el numero de linea.
   3. Decide si el documento es texto o libro.

   LO QUE NO HACE, Y POR QUE
   -------------------------
   No inventa ni arregla nada. Si un nivel esta mal puesto, lo dice y ya; no
   lo mueve a donde "tendria que estar". Un libro descuadrado en silencio es
   peor que un libro que se niega a cargar: el primero poisoned el test y el
   mapa sin que nadie lo note, y el segundo avisa.
   ========================================================================= */
(function (raiz) {
  'use strict';

  /* ------------------------------------------------------------ marcadores */

  // [N1] .. [N9] al principio de la linea. Se pide al menos un espacio, pero se
  // acepta que no haya ninguno: un "[N2]" solo, sin titulo, tiene que dar el
  // error de "le falta el titulo" y no el confuso de "no se entiende".
  var RE_NIVEL = /^\[N([1-9])\][ \t]*(.*)$/;

  // Un marcador que esta bien escrito pero con espacios antes. Se busca aparte,
  // ANTES de probar el formato, porque si no caeria en el mensaje generico de
  // "no se entiende [N2]", que no dice la verdad: el marcador si se entiende, lo
  // que esta mal son los espacios. Y el que lo escribio necesita saber eso.
  var RE_INDENTADO = /^[ \t]+\[N[1-9]\]/;

  // [A1], [A23]... de versiones anteriores, en cualquier parte de la linea. Ya
  // no significan nada: se quitan en silencio (con el espacio que las separaba).
  var RE_MARCA_VIEJA = /[ \t]*\[A\d+\]/g;

  var NIVEL_MAXIMO = 4;

  /* ------------------------------------------------------- Constructores */

  function nodoNivel(nivel, titulo, linea) {
    return { t: 'n', n: nivel, titulo: titulo, linea: linea, hijos: [] };
  }

  function nodoParrafo(texto, linea) {
    return { t: 'p', txt: texto, linea: linea };
  }

  /* ------------------------------------------------------------- El analizador
     Se construye por partes y se devuelve con problemas; nunca lanza excepcion
     por contenido malo del archivo. Un archivo con errores tiene que poder
     ABRIRSE para que la persona vea que le dicen, no rechazarse en silencio. */

  function analizar(texto, opciones) {
    opciones = opciones || {};
    var maximo = opciones.nivelMaximo || NIVEL_MAXIMO;

    var problemas = [];
    var raiz_ = [];
    var pila = [];          // los niveles abiertos, del mas alto al mas bajo
    var Actual = null;      // donde cae el siguiente parrafo
    var hayNiveles = false;
    var nivelesUsados = {};

    function avisar(lin, tipo, mensaje) {
      problemas.push({ linea: lin, tipo: tipo, mensaje: mensaje });
    }

    // Donde cae lo que sigue: dentro del nivel abierto mas profundo, o en la
    // raiz del documento si todavia no se abrio ninguno.
    function dondeVa() {
      return pila.length ? pila[pila.length - 1].hijos : raiz_;
    }

    // Se agrupan parrafos seguidos: una linea en blanco separa, varias lineas
    // pegadas son el mismo parrafo. Es la convencion de todos los editores y
    // la que un modelo de lenguaje respeta sin que se le diga.
    var lineaNum = 0;
    var lineas = String(texto == null ? '' : texto).replace(RE_MARCA_VIEJA, '').replace(/\r\n?/g, '\n').split('\n');
    var buffer = [];
    var bufferDesde = 0;

    function cerrarParrafo() {
      if (buffer.length === 0) return;
      var p = nodoParrafo(buffer.join(' ').trim(), bufferDesde);
      if (p.txt) dondeVa().push(p);
      buffer = [];
    }

    for (var i = 0; i < lineas.length; i++) {
      lineaNum = i + 1;
      var cruda = lineas[i];
      var linea = cruda;

      if (/^[ \t]*$/.test(cruda)) { cerrarParrafo(); continue; }

      // Primero los espacios. Va antes del formato porque un "[N2]" con dos
      // espacios delante tiene que decir que hay que quitar los espacios, y no
      // caer en el mensaje de "no se entiende".
      var mIndenta = RE_INDENTADO.exec(cruda);
      if (mIndenta) {
        avisar(lineaNum, 'error',
          mIndenta[1] + ' tiene espacios antes. Quítalos para que se reconozca.');
        cerrarParrafo();
        continue;
      }

      var mNivel = RE_NIVEL.exec(linea);
      if (mNivel) {
        cerrarParrafo();
        hayNiveles = true;
        var nivel = parseInt(mNivel[1], 10);
        var titulo = mNivel[2].trim();
        nivelesUsados[nivel] = true;

        if (nivel > maximo) {
          avisar(lineaNum, 'error',
            'El nivel ' + nivel + ' no existe: los niveles llegan hasta N' + maximo + '.');
          continue;
        }
        if (!titulo) {
          avisar(lineaNum, 'error', 'El marcador [N' + nivel + '] no tiene título.');
          continue;
        }

        // El nivel no puede saltar: para abrir un N3 tiene que haber un N2
        // abierto. Si no, se avisa y se ignora la linea en vez de inventarle
        // un padre.
        if (pila.length && nivel > pila.length + 1) {
          avisar(lineaNum, 'error',
            'Salto de nivel: se abre N' + nivel + ' cuando lo abierto es N' +
            pila.length + '. Falta el N' + (pila.length + 1) + '.');
          continue;
        }
        if (!pila.length && nivel !== 1) {
          avisar(lineaNum, 'error',
            'El documento empieza en N' + nivel + '. Siempre se empieza en N1.');
          continue;
        }
        // Un nivel igual o menor que el actual cierra los que queden encima.
        while (pila.length >= nivel) pila.pop();

        var nodo = nodoNivel(nivel, titulo, lineaNum);
        dondeVa(lineaNum).push(nodo);
        pila.push(nodo);
        continue;
      }

      // Marcador parecido pero mal escrito: mejor un error claro que un
      // parrafo raro que nadie entiende despues.
      var Sospechoso = cruda.match(/^\s*\[([^\]]{0,12})\]/);
      if (Sospechoso && /^[Nn\s0-9]/.test(Sospechoso[1])) {
        avisar(lineaNum, 'error',
          'No se entiende [' + Sospechoso[1] + ']. Los niveles son [N1] a [N' +
          maximo + '].');
        cerrarParrafo();
        continue;
      }

      if (!buffer.length) bufferDesde = lineaNum;
      buffer.push(linea.trim());
    }
    cerrarParrafo();

    /* --- Lo que el documento es ------------------------------------------- */

    var tipo = hayNiveles ? 'libro' : 'texto';

    if (tipo === 'libro') {
      var ultimo = 0;
      for (var n = 1; n <= maximo; n++) if (nivelesUsados[n]) ultimo = n;
      if (ultimo < 4) {
        avisar(0, 'aviso',
          'Este libro no tiene nivel N4, o sea que no tiene lecturas. Un libro ' +
          'sin textos que practicar no se puede usar en lectura veloz ni en el test.');
      }
      var total = 0;
      (function contar(lista) {
        lista.forEach(function (x) {
          if (x.t === 'n') { total++; contar(x.hijos); }
        });
      })(raiz_);
      if (total === 0) {
        avisar(0, 'error', 'Hay marcadores de nivel pero ninguno se pudo usar, así que el libro quedó vacío.');
      }
    }

    return {
      tipo: tipo,
      raiz: raiz_,
      problemas: problemas,
      nivelesUsados: nivelesUsados,
      palabras: contarPalabras(lineas),
      lineas: lineas.length
    };
  }

  function contarPalabras(lineas) {
    var n = 0;
    lineas.forEach(function (l) {
      var limpia = l.trim();
      if (!limpia) return;
      n += limpia.split(/\s+/).length;
    });
    return n;
  }

  /* -------------------------------------------------------------- Validacion
     Aparte del analizador, para poder VOLVER a validar un documento ya
     guardado sin volver a leer el archivo, y para que el editor pueda
     preguntar "¿esto ya esta bien?" mientras se escribe. */

  function revisar(documento) {
    var problemas = (documento.problemas || []).slice();

    return {
      ok: problemas.every(function (p) { return p.tipo !== 'error'; }),
      problemas: problemas
    };
  }

  /* ------------------------------------------------------------ Presentacion
     Solo para la terminal. Devuelve texto plano con el arbol, que es como se
     revisa de un vistazo si la estructura quedo bien. */

  function dibujar(documento, opciones) {
    opciones = opciones || {};
    var nombres = opciones.nombres || { 1: 'Bloque', 2: 'Capítulo', 3: 'Sección', 4: 'Texto' };
    var L = [];
    L.push('tipo: ' + documento.tipo + '   palabras: ' + documento.palabras);
    L.push('');

    (function caminar(lista, sangria) {
      lista.forEach(function (x) {
        if (x.t === 'n') {
          var palabra = nombres[x.n] || ('N' + x.n);
          // El numero que va al lado es el NIVEL, no un numero de capitulo, y
          // por eso se dice "nivel 2" y no "Capitulo 2": escrito asi se leia
          // como si el segundo capitulo fuera "La suma", que es exactamente el
          // malentendido que hace CONFUNDIR el arbol.
          L.push(sangria + palabra + ' (nivel ' + x.n + ') · ' + x.titulo);
          caminar(x.hijos, sangria + '    ');
        } else {
          var texto = x.txt;
          if (texto.length > 66) texto = texto.slice(0, 66) + '…';
          L.push(sangria + texto);
        }
      });
    })(documento.raiz, '');

    if (documento.problemas.length) {
      L.push('');
      L.push('--- problemas ---');
      documento.problemas.forEach(function (p) {
        L.push((p.tipo === 'error' ? 'ERROR' : 'aviso') +
               (p.linea ? '  linea ' + p.linea : '') + ': ' + p.mensaje);
      });
    }
    return L.join('\n');
  }

  /* ------------------------------------------------------------ El registro
     Arma el documento que se guarda en la biblioteca a partir de un texto
     suelto: lo analiza, lo revisa y junta el resultado en el registro.

     ESTO ESTA AQUI Y NO EN LA PAGINA DE IMPORTAR porque hay dos puertas de
     entrada al mismo camino: el selector de archivos de la persona, y la
     siembra de los textos de ejemplo del primer uso. Las dos tienen que
     producir EXACTAMENTE el mismo registro, y si cada una arma el suyo, un
     dia uno se queda sin un campo y el documento guardado se ve bien en la
     lista y se rompe al abrirlo. Con el camino aqui, las dos llaman a lo
     mismo y no hay nada que sincronizar.

     Lo que devuelve:
       registro    el documento para guardar, o null si el texto no sirve
       problemas   los del analisis y los de la revision, juntos
       hayError    si hay algun ERROR. Un aviso no impide guardar; un error
                   si, que es lo que hace el importador. */
  function documentoNuevo(nombre, cuerpo) {
    // Las marcas [A#] de versiones anteriores ya no se usan: no se guardan.
    var texto = String(cuerpo == null ? '' : cuerpo).replace(RE_MARCA_VIEJA, '');
    if (!texto.trim()) return { registro: null, problemas: [], hayError: true };

    var doc = analizar(texto);
    var revision = revisar(doc);
    var problemas = (doc.problemas || []).concat(revision.problemas || []);
    var hayError = problemas.some(function (p) { return p.tipo === 'error'; });
    if (hayError) return { registro: null, problemas: problemas, hayError: true };

    var ahora = new Date().toISOString();
    return {
      registro: {
        id: 'doc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
        nombre: String(nombre),
        tipo: doc.tipo,
        cuerpo: texto,
        arbol: doc.raiz,
        palabras: doc.palabras,
        problemas: problemas,
        /* Los nombres de los niveles los escribe quien compone el texto. Un
           documento nuevo viene sin ninguno, que es lo mismo que los cuatro
           vacios. */
        niveles: ['', '', '', ''],
        creado: ahora,
        modificado: ahora
      },
      problemas: problemas,
      hayError: hayError
    };
  }

  var RetoMarcado = {
    analizar: analizar,
    revisar: revisar,
    dibujar: dibujar,
    documentoNuevo: documentoNuevo,
    NIVEL_MAXIMO: NIVEL_MAXIMO
  };

  raiz.RetoMarcado = RetoMarcado;
  if (typeof module !== 'undefined' && module.exports) module.exports = RetoMarcado;

})(typeof window !== 'undefined' ? window : globalThis);
