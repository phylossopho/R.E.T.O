/* =========================================================================
   R.E.T.O. - El memorama, en el navegador
   -------------------------------------------------------------------------
   Hibrido offline/online: usa logica local (RetoMemorama) si no hay red,
   y API del servidor si hay conexion.
   ========================================================================= */
(function () {
  'use strict';

  var API = '/api/memorama';
  var tablero = document.getElementById('tablero');
  var mensaje = document.getElementById('mensaje');
  var lector = document.getElementById('lector');

  /* Estado local (RetoMemorama) para modo offline */
  var modoOffline = false;
  var partidaLocal = null;

  /* Detectar si estamos offline y mostrar indicador */
  function actualizarModoOffline() {
    var offline = !navigator.onLine || (window.RetoOfflineCache && window.RetoOfflineCache.isOffline());
    if (offline !== modoOffline) {
      modoOffline = offline;
      document.documentElement.setAttribute('data-modo-offline', modoOffline ? '1' : '0');
      if (modoOffline) {
        avisar('🌐 Sin conexión — Modo práctica offline activado');
      }
    }
    return modoOffline;
  }

  /* Escuchar cambios de conectividad */
  window.addEventListener('online', function () { actualizarModoOffline(); });
  window.addEventListener('offline', function () { actualizarModoOffline(); });

  /* Lo que vive DENTRO del modal de configurar. No esta en la pagina a la vista
     porque mientras se juega no hace falta: el tablero se cambia una vez y ya,
     y el numero de intentos solo cuenta cuando se acabo. */
  var cfgTamano = document.getElementById('cfg-tamano');
  var cfgConjunto = document.getElementById('cfg-conjunto');
  var cfgAyuda = document.getElementById('cfg-ayuda');
  var cfgIntentos = document.getElementById('cfg-intentos');
  var cfgParejas = document.getElementById('cfg-parejas');
  var cfgMejor = document.getElementById('cfg-mejor');
  var cfgDialogo = null;

  var CATALOGOS = { tamanos: [], catalogos: [] };
  var tipoSimbolo = 'forma';
  var partida = null;      // el id que lleva el servidor
  var cartas = [];         // lo que dijo el servidor; las tapadas llegan sin simbolo
  var animando = false;    // hay un giro en marcha
  var relojTapado = null;  // el giro de tapar las que no hicieron pareja

  /* ------------------------------------------------------------- la marca

     La clave lleva el tamano Y el conjunto, porque un tablero de 12 con formas
     no se compara con uno de 20 con emojis: son dos juegos distintos y
     mezclarlos daria una marca sin sentido.

     OJO CON COMO SE LLAMA ESTA API. Las preferencias de un solo valor NO van
     dentro de un objeto "preferencias": van en la raiz de RetoDatos, con
     RetoDatos.poner(clave, valor) y RetoDatos.obtener(clave). Escribirlas
     como "RetoDatos.preferencias.obtener" tira un
     "Cannot read properties of undefined", y como hasta ahora ninguna pagina
     las usaba, no habia forma de copiarlo bien de otro lado. */
  function claveMejor(tamano, conjunto) {
    return 'memorama-mejor-' + tamano + '-' + conjunto;
  }

  function mejorGuardado(tamano, conjunto) {
    return window.RetoDatos.obtener(claveMejor(tamano, conjunto))
      .then(function (v) { return (v === null || v === undefined) ? null : Number(v); })
      .catch(function () { return null; });
  }

  function decir(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.setAttribute('data-tipo', tipo || '');
  }

  function avisar(texto) {
    lector.textContent = texto;
  }

  /* ------------------------------------------------------------- los simbolos

     Las FORMAS son un cuadrado con una clase que le da la silueta, y el color
     lo pone el tema. Los de TEXTO y EMOJI se escriben tal cual.

     ESTA FUNCION DEVUELVE SIEMPRE UN NODO DE DOM, y eso no es un detalle: la
     guarda con appendChild() no acepta un texto, y una carta tapada llega SIN

     guarda con appendChild() no acepta un texto, y una carta tapada llega SIN
     simbolo, o sea con null. Si aqui se devolvia "" (un texto) para ese caso,
     appendChild("") tiraba el error "parameter 1 is not of type 'Node' y el
     juego se caia entero al empezar. Por eso se devuelve un nodo de texto
     VACIO, que si es un nodo y no dibuja nada, que es justo lo que tiene que
     pasar con una carta que sigue tapada. */
  /* Pinta un boton de opcion con su dibujito adentro.
     "dibujito" se construye antes y se pasa ya armado, porque cada tipo de
     conjunto se ve distinto: el tablero es una rejilla de puntos, y los
     dibujitos son una carta chiquita con un simbolo de ejemplo. */
  function botonOpcion(clase, etiqueta, dibujito, chico, alPulsar) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'memo-opcion';
    b.appendChild(dibujito);
    b.appendChild(document.createTextNode(etiqueta));
    if (chico) {
      var c = document.createElement('small');
      c.textContent = chico;
      b.appendChild(c);
    }
    b.addEventListener('click', alPulsar);
    return b;
  }

  /* El dibujito del tablero: la rejilla chiquita, con sus filas y columnas
     de verdad. Se ve el tablero antes de elegirlo. */
  function dibujitoRejilla(columnas, filas) {
    var s = document.createElement('span');
    s.className = 'memo-rejilla';
    s.setAttribute('data-cols', String(columnas));
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  /* El dibujito de los dibujitos: una carta chiquita con un simbolo de ejemplo.
     Es la misma carta del juego, en miniatura, con el mismo fondo y el mismo
     borde, para que se vea de verdad y no haya que imaginarlo. */
  function dibujitoMuestra(conjunto) {
    var marco = document.createElement('span');
    marco.className = 'memo-muestra';
    marco.setAttribute('aria-hidden', 'true');
    marco.appendChild(pintarSimbolo(conjunto.muestra, conjunto.tipo));
    return marco;
  }

  function pintarSimbolo(simbolo, tipo) {
    var clase = tipo || tipoSimbolo;
    if (simbolo === null || simbolo === undefined) {
      return document.createTextNode('');
    }
    if (clase === 'forma') {
      var caja = document.createElement('span');
      caja.className = 'memo-forma memo-forma-' + simbolo;
      return caja;
    }
    return document.createTextNode(simbolo);
  }

  function nombreDeSimbolo(simbolo) {
    if (simbolo === null) return '';
    if (tipoSimbolo === 'forma') {
      return 'la forma ' + simbolo;   // para que se lea en voz alta
    }
    return 'el ' + simbolo;
  }

  /* ---------------------------------------------------------------- el tablero */

  function nombreDeCarta(c) {
    var numero = c.id + 1;
    if (c.emparejada) return 'Carta ' + numero + ', encontrada';
    if (c.volteada) return 'Carta ' + numero + ', ' + nombreDeSimbolo(c.simbolo);
    return 'Carta ' + numero + ', boca abajo';
  }

  function aplicarEstadoACarta(el, c) {
    el.setAttribute('data-vuelta', (c.volteada || c.emparejada) ? '1' : '0');
    el.setAttribute('data-encontrada', c.emparejada ? '1' : '0');
    // El nombre que se lee en voz alta cambia cuando la carta se voltea. Con
    // uno fijo ("carta boca abajo") el lector de pantalla miente, y alguien que
    // no ve no podria jugar: solo oiria que todas estan tapadas.
    el.setAttribute('aria-label', nombreDeCarta(c));

    /* Y AQUI SE PINTA EL SIMBOLO, que es lo que hace que la carta se vea de
       verdad. El servidor no lo manda en el tablero inicial (porque tapada no
       puede saberlo nadie) sino en la respuesta a cada volteo. Si aqui no se
       dibuja, la carta da la vuelta VACIA: el juego funciona, suena, y no se ve
       nada. Que es peor que romperse, porque no se nota. */
    var frente = el.querySelector('.memo-carta-frente');
    if (frente) {
      frente.textContent = '';
      frente.appendChild(pintarSimbolo(c.simbolo));
    }
  }

  function construirTablero() {
    tablero.textContent = '';
    var frag = document.createDocumentFragment();
    cartas.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'memo-carta';
      b.setAttribute('data-id', String(c.id));

      var interior = document.createElement('span');
      interior.className = 'memo-carta-interior';

      var atras = document.createElement('span');
      atras.className = 'memo-cara memo-carta-atras';
      atras.setAttribute('aria-hidden', 'true');

      var frente = document.createElement('span');
      frente.className = 'memo-cara memo-carta-frente';
      frente.setAttribute('aria-hidden', 'true');
      frente.appendChild(pintarSimbolo(c.simbolo));

      interior.appendChild(atras);
      interior.appendChild(frente);
      b.appendChild(interior);
      aplicarEstadoACarta(b, c);
      frag.appendChild(b);
    });
    tablero.appendChild(frag);
  }

  function elementoDe(id) {
    return tablero.querySelector('.memo-carta[data-id="' + id + '"]');
  }

  function pintarCuentas(estado) {
    if (cfgIntentos) cfgIntentos.textContent = String(estado.intentos);
    if (cfgParejas) cfgParejas.textContent = estado.parejas + ' / ' + estado.totalParejas;
    mejorGuardado(estado.tamano, estado.catalogo).then(function (mejor) {
      if (cfgMejor) cfgMejor.textContent = mejor ? String(mejor) : '\u2014';
    });
  }

  function conjuntoElegido() {
    var marcado = cfgConjunto.querySelector('[aria-pressed="true"]');
    return marcado ? marcado.getAttribute('data-conjunto') : 'formas';
  }

  function hayJuegoEmpezado() {
    return cartas.some(function (c) { return c.volteada || c.emparejada; });
  }

  function nombreConjunto(id) {
    var encontrado = CATALOGOS.catalogos.filter(function (k) { return k.id === id; })[0];
    return encontrado ? encontrado.nombre : id;
  }

  /* ------------------------------------------------------------- la partida */

  function nuevaPartida() {
    var tamano = tablero.getAttribute('data-tamano') || '4x4';
    var conjunto = conjuntoElegido();

    // Verificar modo offline
    actualizarModoOffline();

    if (relojTapado) { clearTimeout(relojTapado); relojTapado = null; }
    animando = false;

    if (modoOffline && window.RetoMemorama) {
      // MODO OFFLINE: usar logica local
      try {
        var r = window.RetoMemorama.nueva_partida(tamano, conjunto);
        partidaLocal = r;
        cartas = r.cartas.map(function (c) {
          return { id: c.id, simbolo: c.simbolo, volteada: c.volteada, emparejada: c.emparejada };
        });
        tablero.setAttribute('data-tamano', tamano);
        tipoSimbolo = 'texto';
        CATALOGOS.catalogos.forEach(function (k) {
          if (k.id === conjunto) { tipoSimbolo = k.tipo; }
        });
        construirTablero();
        pintarCuentas({
          intentos: r.intentos,
          parejas: r.parejas,
          totalParejas: r.totalParejas,
          tamano: tamano,
          catalogo: conjunto
        });
        decir('');
        avisar('Tablero de ' + r.columnas + ' por ' + r.filas + ' con ' +
               r.totalParejas + ' parejas. Modo offline — progreso local.');
        return;
      } catch (e) {
        console.warn('[Memorama] Error offline, probando online:', e);
        // Caer a online si falla
      }
    }

    // MODO ONLINE: usar API del servidor
    pedir(API + '/nueva', { tamano: tamano, catalogo: conjunto })
      .then(function (e) {
        partida = e.partida;
        cartas = e.cartas;
        tablero.setAttribute('data-tamano', e.tamano);
        tipoSimbolo = 'texto';
        CATALOGOS.catalogos.forEach(function (k) {
          if (k.id === e.catalogo) { tipoSimbolo = k.tipo; }
        });
        construirTablero();
        pintarCuentas(e);
        decir('');
        avisar('Tablero de ' + e.columnas + ' por ' + e.filas + ' con ' +
               e.totalParejas + ' parejas. Todas las cartas estan boca abajo.');
      })
      .catch(function (error) {
        decir('No se pudo empezar la partida: ' + error.message);
      });
  }

  /* --------------------------------------------------------------- pedir */

  function pedir(ruta, cuerpo) {
    return fetch(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) { throw new Error(d && d.error ? d.error : 'error ' + r.status); }
        return d;
      });
    });
  }

  /* ------------------------------------------------------------ los botones */

  function marcarSolo(grupo, atributo, valor) {
    grupo.querySelectorAll('[' + atributo + ']').forEach(function (x) {
      x.setAttribute('aria-pressed', x.getAttribute(atributo) === valor ? 'true' : 'false');
    });
  }

  function preguntarSiEmpezar(que) {
    if (!hayJuegoEmpezado()) { nuevaPartida(); cerrarConfig(); return; }
    window.RetoDialogo.preguntar({
      titulo: '¿Empezar de nuevo?',
      texto: que + ' Vas a medio juego, y esto pierde lo que llevas.',
      ok: 'Sí, empezar de nuevo',
      cancelar: 'No, seguir aquí'
    }).then(function (si) { if (si) { nuevaPartida(); cerrarConfig(); } });
  }

  /* -------------------------------------------------------- el modal de ajustes

     Es un <dialog> armado aqui y no el del sitio, porque este necesita BOTONES
     DENTRO (los tres tableros y los cuatro conjuntos), y el del sitio recibe
     texto. Se hace con showModal(), que es lo que trae el foco dentro, cierra con
     Escape y vuelve a poner el foco donde estaba.

     El boton de cerrar esta ABAJO y es el ultimo: en un dialogo de configuracion
     se llega con el Tab y con las flechas, y volver a cerrarlo tiene que estar
     a mano sin tener que cazarlo. */
  function armarConfig() {
    if (cfgDialogo) return;
    cfgDialogo = document.createElement('dialog');
    cfgDialogo.className = 'dialogo memo-config';
    cfgDialogo.setAttribute('aria-labelledby', 'memo-cfg-titulo');

    var titulo = document.createElement('h2');
    titulo.className = 'dialogo-titulo';
    titulo.id = 'memo-cfg-titulo';
    titulo.textContent = 'Configurar el juego';
    cfgDialogo.appendChild(titulo);

    var gTablero = document.createElement('div');
    gTablero.className = 'memo-config-grupo';
    var etTablero = document.createElement('p');
    etTablero.className = 'editor-label';
    etTablero.id = 'memo-cfg-et-tablero';
    etTablero.textContent = 'Tablero';
    cfgTamano.setAttribute('role', 'group');
    cfgTamano.setAttribute('aria-labelledby', 'memo-cfg-et-tablero');
    gTablero.appendChild(etTablero);
    gTablero.appendChild(cfgTamano);
    cfgDialogo.appendChild(gTablero);

    var gConjunto = document.createElement('div');
    gConjunto.className = 'memo-config-grupo';
    var etConjunto = document.createElement('p');
    etConjunto.className = 'editor-label';
    etConjunto.id = 'memo-cfg-et-conjunto';
    etConjunto.textContent = 'Con qué dibujitos';
    cfgConjunto.setAttribute('role', 'group');
    cfgConjunto.setAttribute('aria-labelledby', 'memo-cfg-et-conjunto');
    gConjunto.appendChild(etConjunto);
    gConjunto.appendChild(cfgConjunto);
    cfgDialogo.appendChild(gConjunto);

    var gAyuda = document.createElement('div');
    gAyuda.className = 'memo-config-grupo';
    var etAyuda = document.createElement('p');
    etAyuda.className = 'editor-label';
    etAyuda.id = 'memo-cfg-et-ayuda';
    etAyuda.textContent = 'Ayuda';
    cfgAyuda.setAttribute('role', 'group');
    cfgAyuda.setAttribute('aria-labelledby', 'memo-cfg-et-ayuda');
    gAyuda.appendChild(etAyuda);
    gAyuda.appendChild(cfgAyuda);
    cfgDialogo.appendChild(gAyuda);

    var cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'boton boton--principal';
    cerrar.textContent = 'Listo';
    cerrar.addEventListener('click', cerrarConfig);
    cfgDialogo.appendChild(cerrar);

    document.body.appendChild(cfgDialogo);
  }

  function abrirConfig() {
    if (!cfgDialogo) armarConfig();
    cfgDialogo.showModal();
  }

  function cerrarConfig() {
    if (cfgDialogo) cfgDialogo.close();
  }

  /* ------------------------------------------------------------ inicializacion */

  function iniciar() {
    if (!tablero) return;

    actualizarModoOffline();

    var btnConfig = document.getElementById('btn-config');
    if (btnConfig) btnConfig.addEventListener('click', abrirConfig);

    var btnOtra = document.getElementById('btn-otra-partida');
    if (btnOtra) btnOtra.addEventListener('click', function () { nuevaPartida(); });

    CATALOGOS = { tamanos: [], catalogos: [] };
    fetch(API + '/catalogos')
      .then(function (r) { return r.json(); })
      .then(function (c) {
        CATALOGOS = c;
        // Poblar botones de tablero
        c.tamanos.forEach(function (t) {
          var btn = botonOpcion('memo-tamano', t.nombre, dibujitoRejilla(t.columnas, t.filas), t.parejas + ' parejas', function () {
            tablero.setAttribute('data-tamano', t.id);
            preguntarSiEmpezar('Cambiaste el tablero a ' + t.nombre + '.');
            marcarSolo(cfgTamano, 'data-tamano', t.id);
          });
          btn.setAttribute('data-tamano', t.id);
          cfgTamano.appendChild(btn);
        });
        // Marcar el actual
        var tamActual = tablero.getAttribute('data-tamano') || '4x4';
        marcarSolo(cfgTamano, 'data-tamano', tamActual);

        // Poblar botones de conjunto
        c.catalogos.forEach(function (k) {
          var btn = botonOpcion('memo-conjunto', k.nombre, dibujitoMuestra(k), k.ayuda, function () {
            preguntarSiEmpezar('Cambiaste los dibujitos a ' + k.nombre + '.');
            marcarSolo(cfgConjunto, 'data-conjunto', k.id);
          });
          btn.setAttribute('data-conjunto', k.id);
          cfgConjunto.appendChild(btn);
        });
        // Marcar el actual (por defecto formas)
        marcarSolo(cfgConjunto, 'data-conjunto', 'formas');

        // Poblar ayuda
        c.catalogos.forEach(function (k) {
          var li = document.createElement('li');
          li.textContent = k.nombre + ': ' + k.ayuda;
          cfgAyuda.appendChild(li);
        });

        // Cargar mejor marca guardada
        mejorGuardado(tamActual, 'formas').then(function (m) {
          if (cfgMejor) cfgMejor.textContent = m ? String(m) : '\u2014';
        });

        // Si no hay juego empezado, empezar uno nuevo
        if (!hayJuegoEmpezado()) nuevaPartida();
      })
      .catch(function () {
        // Si falla el servidor, intentar modo offline
        actualizarModoOffline();
        if (modoOffline && window.RetoMemorama) {
          nuevaPartida();
        } else {
          decir('No se pudo cargar la configuración. Verifica la conexión.');
        }
      });
  }

  /* -------------------------------------------------------------- voltear */

  function voltear(id) {
    if (!partida && !partidaLocal || animando) return;
    if (relojTapado) return;   // ya hay dos cartas esperando a taparse

    var carta = (cartas || []).filter(function (c) { return c.id === id; })[0];
    if (!carta || carta.volteada || carta.emparejada) return;

    actualizarModoOffline();

    animando = true;
    carta.volteada = true;
    aplicarEstadoACarta(elementoDe(id), carta);

    if (modoOffline && window.RetoMemorama && partidaLocal) {
      // MODO OFFLINE: usar logica local
      try {
        var r = window.RetoMemorama.voltear(partidaLocal, id);
        partidaLocal = r.partida;
        var resultado = r.resultado;

        // Actualizar cartas locales
        cartas = partidaLocal.cartas.map(function (c) {
          return { id: c.id, simbolo: c.simbolo, volteada: c.volteada, emparejada: c.emparejada };
        });

        animando = false;
        sincronizar();
        pintarCuentas({
          intentos: partidaLocal.intentos,
          parejas: partidaLocal.parejas,
          totalParejas: partidaLocal.totalParejas,
          tamano: partidaLocal.tamano,
          catalogo: partidaLocal.catalogo
        });

        if (resultado === 'ignorado') {
          volverATapar(id);
        } else if (resultado === 'volteada') {
          // Primera de la pareja
        } else if (resultado === 'sin-pareja') {
          taparDespues(partidaLocal.volteadas);
        } else if (resultado === 'pareja') {
          festejarPareja({ volteadas: partidaLocal.volteadas }, carta.simbolo);
        } else if (resultado === 'completo') {
          terminar({ intentos: partidaLocal.intentos, parejas: partidaLocal.parejas, totalParejas: partidaLocal.totalParejas });
        }
        return;
      } catch (e) {
        console.warn('[Memorama] Error offline voltear:', e);
        // Caer a online si falla
      }
    }

    // MODO ONLINE
    pedir(API + '/voltear', { partida: partida, carta: id })
      .then(function (e) {
        animando = false;
        cartas = e.cartas;
        pintarCuentas(e);
        var simbolo = carta.simbolo;

        /* SE VUELVE A PINTAR LO QUE RESPONDIÓ EL SERVIDOR.
           Antes de preguntar, la carta se destapa con el simbolo que YA TENIA,
           y ese es null: esta tapada y nadie lo sabe todavia. El simbolo de
           verdad llega aqui, en la respuesta.

           Y SE REPINTAN TODAS LAS CARTAS, no solo las que vinieron en la lista.
           Antes se sincronizaban la que se toco y las que el servidor said
           "volteadas", y aqui esta el fallo: cuando hay pareja, el servidor
           vacia esa lista (ya estan emparejadas, no hay nada pendiente), asi
           que la SEGUNDA carta de la pareja si se marcaba y la PRIMERA se
           quedaba como si nada. En una partida terminada se veian la mitad de
           las parejas sin marcar, y por eso el color de las cartas no cambiaba
           donde tenia que cambiar.

           Volver a pintar veinte elementos cuesta nada, y ademas asi no hay
           que estar adivinando quais cartas toco el servidor. */
        sincronizar();

        if (e.resultado === 'ignorado') {
          // Solo pasa si el servidor cambio de opinion. La carta se devuelve.
          volverATapar(id);
        } else if (e.resultado === 'volteada') {
          // Primera de la pareja: se espera a la segunda. El bloqueo lo hace
          // "relojTapado" mas abajo, no hace falta nada mas aqui.
          animando = false;
        } else if (e.resultado === 'sin-pareja') {
          taparDespues(e.volteadas);
        } else if (e.resultado === 'pareja') {
          festejarPareja(e, simbolo);
        } else if (e.resultado === 'completo') {
          terminar(e);
        }
      })
      .catch(function (error) {
        animando = false;
        volverATapar(id);
        decir('Se perdió la conexión con el juego. Vuelve a cargar la página.');
      });
  }

  /* Vuelve a pintar las cartas que se le digan, con el simbolo que tiene cada
     una AHORA. Sin argumentos, las pinta todas.

     Se llama sin redibujar el tablero entero, porque redibujarlo destruiria el
     elemento que tiene el foco: quien esta jugando con el teclado perderia el
     hilo a media partida. Solo se cambian atributos y el simbolo de las caras,
     que es lo unico que cambio. */
  function sincronizar(ids) {
    var lista = ids || cartas.map(function (c) { return c.id; });
    lista.forEach(function (id) {
      var c = cartas.filter(function (x) { return x.id === id; })[0];
      var el = elementoDe(id);
      if (c && el) { aplicarEstadoACarta(el, c); }
    });
  }

  function volverATapar(id) {
    var c = cartas.filter(function (x) { return x.id === id; })[0];
    var el = elementoDe(id);
    if (c && el) {
      c.volteada = false;
      aplicarEstadoACarta(el, c);
    }
  }

  /* Las dos cartas que no hicieron pareja se dejan ver un instante antes de
     taparse. Si se taparan de golpe, no se alcanza a ver que se fallaron, y
     el fallo es la parte que hay que entender. */
  function taparDespues(ids) {
    /* SIN TEXTO EN PANTALLA, y a proposito: las dos cartas ya se tapan solas y
       eso se explica solo. Un "no son pareja" escrito abajo solo ocupa el lugar
       donde va el tablero y repite lo que ya se ven los ojos.

       El aviso para quien no ve SI se queda, porque ahi el texto es lo unico
       que hay: sin vista no hay nada mas que se vea. */
    avisar('No son pareja.');
    relojTapado = setTimeout(function () {
      relojTapado = null;
      if (modoOffline && window.RetoMemorama && partidaLocal) {
        // OFFLINE: ocultar local
        var r = window.RetoMemorama.ocultar(partidaLocal);
        partidaLocal = r;
        cartas = r.cartas.map(function (c) {
          return { id: c.id, simbolo: c.simbolo, volteada: c.volteada, emparejada: c.emparejada };
        });
        sincronizar(ids);
      } else {
        // ONLINE
        pedir(API + '/ocultar', { partida: partida })
          .then(function (f) {
            cartas = f.cartas;
            sincronizar(ids);
          })
          .catch(function () {
            // Si el servidor no responde, las cartas se tapan igual. Que el
            // tablero se atrase es feo; que queden dos cartas descubiertas
            // para siempre es un juego roto.
            ids.forEach(function (cid) { volverATapar(cid); });
          });
      }
    }, 1100);
  }

  function festejarPareja(estado, simbolo) {
    /* Tampoco hay texto en pantalla cuando se encuentra una pareja. La carta se
       queda descubierta y con el borde marcado: eso ya dice que se encontro, y
       decirlo otra vez abajo es ruido. Para quien no ve, el aviso se queda. */
    avisar('¡Pareja de ' + nombreDeSimbolo(simbolo) + '!');
    // El festejo de la carta se quita solo, para que el atributo no se queden
    // pegados si despues se vuelve a pintar el tablero.
    (estado.volteadas || []).forEach(function (cid) {
      var el = elementoDe(cid);
      if (!el) return;
      el.setAttribute('data-pareja', '1');
      setTimeout(function () { el.removeAttribute('data-pareja'); }, 520);
    });
  }

  /* ------------------------------------------------------------------ el final

     AQUI ESTA la decision de que este juego no tenga castigo. Se celebra que se
     acabo, se guarda la mejor marca, y se deja elegir otra partida. */

  function terminar(estado) {
    var intentos = estado.intentos;
    var tamano = modoOffline && partidaLocal ? partidaLocal.tamano : (partida && partida.tamano || tablero.getAttribute('data-tamano'));
    var conjunto = modoOffline && partidaLocal ? partidaLocal.catalogo : (partida && partida.catalogo || 'formas');

    mejorGuardado(tamano, conjunto).then(function (mejor) {
      var esRecord = !mejor || intentos < mejor;
      if (esRecord) {
        window.RetoDatos.poner(claveMejor(tamano, conjunto), intentos);
        if (cfgMejor) cfgMejor.textContent = String(intentos);
        avisar('¡Nueva mejor marca: ' + intentos + ' intentos! 🎉');
      } else {
        avisar('¡Completado en ' + intentos + ' intentos! (Mejor: ' + (mejor || '—') + ')');
      }
    });
    avisar('¡Encontraste todas las parejas! Intentos: ' + intentos);
    setTimeout(function () {
      window.RetoDialogo.preguntar({
        titulo: '¡Partida completada!',
        texto: 'Lo hiciste en ' + intentos + ' intentos.' + (esRecord ? ' 🎉 ¡Nuevo récord!' : ''),
        ok: 'Otra partida',
        cancelar: 'Cambiar ajustes'
      }).then(function (si) {
        if (si) nuevaPartida(); else abrirConfig();
      });
    }, 800);
  }

  // Iniciar cuando el DOM este listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  window.RetoMemoramaUI = { iniciar: iniciar };

})();