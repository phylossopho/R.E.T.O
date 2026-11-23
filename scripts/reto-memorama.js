/* =========================================================================
   R.E.T.O. - El memorama, en el navegador
   -------------------------------------------------------------------------
   Aqui NO hay reglas. Las reglas estan en Python, en logica/memorama.py, y se
   prueban con python test_memorama.py. Este archivo solo:

     - pregunta al servidor que tablero hay (POST /api/memorama/nueva);
     - al tocar una carta, la destapa EN SEGUIDA y pregunta despues si hizo
       pareja (POST /api/memorama/voltear);
     - y cuando el servidor dice "no hicieron pareja", las tapa.

   POR QUE LA CARTA SE DESTAPA ANTES DE PREGUNTAR
   Si se esperara la respuesta del servidor antes de voltear, con un internet
   lento (o en PythonAnywhere, que no es instantaneo) el tablero se sentiria
   lento y la persona creeria que no esta tocando bien. La carta voltea al
   instante porque es la respuesta a "toco esto", que no necesita permiso de
   nadie. Lo que si necesita permiso es "¿hizo pareja?", y eso se pregunta
   despues, en segundo plano. Si el servidor contesta "ignorado", la carta se
   vuelve a tapar: ahi si se espera.

   EL SIMBOLO DE UNA CARTA TAPADA NO LLEGA NUNCA
   El servidor manda las cartas sin el simbolo de las que siguen tapadas, y eso
   esta probado en Python (la prueba "la pagina no ve los simbolos de las cartas
   tapadas"). Si el tablero entero llegara con sus simbolos, un nino podria
   abrir este archivo, ver donde esta cada uno y ganar sin jugar. Por eso el
   servidor es el unico que sabe el reparto y la pagina solo pide.

   LA MEJOR MARCA NO ESTA EN EL SERVIDOR
   Se guarda en el navegador, en la base de datos del sitio, como una
   preferencia. Dos razones: es un dato de LA PERSONA y no del juego, y asi sale
   en el archivo de respaldo y viaja a otra computadora. En el servidor se
   perderia al reiniciar y no se podria respaldar.

   OJO CON LA API DE PREFERENCIAS: obtener() y poner() DEVUELVEN UNA PROMESA.
   No son valores de una vez. Por eso mejorGuardado() devuelve la promesa y
   quien lo llama la espera. */
(function () {
  'use strict';

  var API = '/api/memorama';
  var tablero = document.getElementById('tablero');
  var mensaje = document.getElementById('mensaje');
  var lector = document.getElementById('lector');

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
      if (cfgMejor) cfgMejor.textContent = mejor ? String(mejor) : '—';
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
    if (relojTapado) { clearTimeout(relojTapado); relojTapado = null; }
    animando = false;

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

  /* ------------------------------------------------------------------ voltear */

  function voltear(id) {
    if (!partida || animando) return;
    if (relojTapado) return;   // ya hay dos cartas esperando a taparse

    var carta = cartas.filter(function (c) { return c.id === id; })[0];
    if (!carta || carta.volteada || carta.emparejada) return;

    animando = true;
    carta.volteada = true;
    aplicarEstadoACarta(elementoDe(id), carta);

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
    }, 1100);
  }

  function festejarPareja(estado, simbolo) {
    /* Tampoco hay texto en pantalla cuando se encuentra una pareja. La carta se
       queda descubierta y con el borde marcado: eso ya dice que se encontro, y
       decirlo otra vez abajo es ruido. Para quien no ve, el aviso se queda. */
    avisar('¡Pareja de ' + nombreDeSimbolo(simbolo) + '!');
    // El festejo de la carta se quita solo, para que el atributo no se queden
    // pegados si despues se vuelve a pintar el tablero.
    estado.volteadas.forEach(function (cid) {
      var el = elementoDe(cid);
      if (!el) return;
      el.setAttribute('data-pareja', '1');
      setTimeout(function () { el.removeAttribute('data-pareja'); }, 520);
    });
  }

  /* ------------------------------------------------------------------ el final

     AQUI ESTA la decision de que este juego no tenga castigo. Se celebra que se
     TERMINO, no que se fue rapido. El numero de intentos se informa al lado, y
     solo se dice "nuevo mejor" cuando de verdad se supero el record de ESA
     combinacion de tablero y conjunto.

     En una partida de 40 intentos no dice "mal". Dice lo que hizo, que es
     encontrar todas las parejas. Un memorama de concentration que regaña es
     justo el que hace que alguien deje de jugar. */
  function terminar(estado) {
    var combo = estado.tamano + ' con ' + nombreConjunto(estado.catalogo);
    mejorGuardado(estado.tamano, estado.catalogo).then(function (mejor) {
      var esNuevo = mejor === null || estado.intentos < mejor;
      if (esNuevo) {
        return window.RetoDatos
          .poner(claveMejor(estado.tamano, estado.catalogo), estado.intentos)
          .catch(function () {})
          .then(function () { return { esNuevo: true, mejor: estado.intentos }; });
      }
      // El numero se lleva en el objeto, NO en una variable suelta. Antes se
      // escribia "mejor" en el aviso de más abajo, y esa variable vivia solo
      // dentro de este pedazo. Cuando el juego NO era nuevo, la parte de
      // arriba no se ejecutaba y a la de abajo le faltaba la variable: salia
      // un "mejor is not defined" y el modal de final NUNCA aparecia. Solo
      // fallaba la segunda vez, porque la primera siempre era marca nueva.
      return { esNuevo: false, mejor: mejor };
    }).then(function (r) {
      var esNuevo = r.esNuevo;
      pintarCuentas(estado);
      var texto = esNuevo
        ? '¡Encontraste todas las parejas! Nuevo mejor en ' + combo + '.'
        : '¡Encontraste todas las parejas de ' + combo + '!';
      decir(texto, 'bien');
      avisar(texto + ' Con ' + estado.intentos + ' intentos.');

      /* LAS CUENTAS SALEN EN UN MODAL, no en la pagina. Mientras se juega el
         numero no sirve de nada; aqui ya cuenta, y es el momento de verlo junto
         con el record anterior. */
      window.RetoDialogo.lista({
        titulo: esNuevo ? '¡Nuevo mejor!' : '¡Terminaste!',
        texto: 'Tablero ' + combo + ', con ' + estado.intentos +
               (estado.intentos === 1 ? ' intento' : ' intentos') + '.\n' +
               (esNuevo ? 'Es tu mejor marca hasta ahora.'
                        : 'Tu mejor marca aquí sigue siendo ' + r.mejor + '.'),
        items: [{ texto: 'Elegir otro tablero', valor: 'config' },
                { texto: 'Jugar otra vez', valor: 'otra' },
                { texto: 'Ver el tablero', valor: 'quedarse' }],
        nota: 'En el tablero no hay ni títulos ni cuentas: solo las cartas, para no distraer.'
      }).then(function (elegido) {
        if (elegido === 'config') { abrirConfig(); }
        else if (elegido === 'otra') { nuevaPartida(); }
      });
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
    /* AQUI NO SE TOCA EL className DEL GRUPO. Antes habia una linea que lo
       vaciaba, y por eso los dibujitos salian en columna: al abrir el dialogo
       se borraba la clase "memo-fila--4" que arma la fila de cuatro, y los
       botones se acomodaban solos uno abajo del otro. Solo se nota la PRIMERA
       vez que se abre, porque la clase se vuelve a poner al cambiar de
       conjunto. */
    cfgDialogo.appendChild(gConjunto);

    cfgAyuda.className = 'memo-config-ayuda';
    gConjunto.appendChild(cfgAyuda);

    var cuentas = document.createElement('div');
    cuentas.className = 'memo-config-ayuda';
    cuentas.appendChild(document.createTextNode('Lo que llevas: '));
    var caja = document.getElementById('cfg-cuentas');
    caja.removeAttribute('class');
    cuentas.appendChild(caja);
    cfgDialogo.appendChild(cuentas);

    var acciones = document.createElement('div');
    acciones.className = 'dialogo-acciones';
    var btnCerrar = document.createElement('button');
    btnCerrar.type = 'button';
    btnCerrar.className = 'boton boton--principal';
    btnCerrar.textContent = 'Listo';
    btnCerrar.addEventListener('click', cerrarConfig);
    acciones.appendChild(btnCerrar);
    cfgDialogo.appendChild(acciones);

    // Clic en el fondo = cerrar, como en el resto de los modales del sitio.
    cfgDialogo.addEventListener('click', function (e) {
      if (e.target === cfgDialogo) { cerrarConfig(); }
    });

    document.body.appendChild(cfgDialogo);
  }

  function cerrarConfig() {
    if (cfgDialogo && cfgDialogo.open) { cfgDialogo.close(); }
  }

  function abrirConfig() {
    armarConfig();
    cfgDialogo.showModal();
    var listo = cfgDialogo.querySelector('.dialogo-acciones .boton');
    if (listo) listo.focus();
  }

  function armarOpciones() {
    cfgTamano.textContent = '';
    cfgTamano.className = 'memo-fila memo-fila--3';
    CATALOGOS.tamanos.forEach(function (t) {
      var b = botonOpcion(null, t.nombre, dibujitoRejilla(t.columnas, t.filas),
                          t.parejas + ' parejas',
                          function () {
        if (tablero.getAttribute('data-tamano') === t.id) return;
        marcarSolo(cfgTamano, 'data-tamano', t.id);
        tablero.setAttribute('data-tamano', t.id);
        preguntarSiEmpezar('Cambiaste de tablero.');
      });
      b.setAttribute('data-tamano', t.id);
      b.setAttribute('aria-pressed', t.id === '4x4' ? 'true' : 'false');
      cfgTamano.appendChild(b);
    });

    cfgConjunto.textContent = '';
    cfgConjunto.className = 'memo-fila memo-fila--4';
    CATALOGOS.catalogos.forEach(function (k, i) {
      var b = botonOpcion(null, k.nombre, dibujitoMuestra(k), null,
                          function () {
        if (conjuntoElegido() === k.id) return;
        marcarSolo(cfgConjunto, 'data-conjunto', k.id);
        cfgAyuda.textContent = k.ayuda;
        preguntarSiEmpezar('Cambiaste de dibujitos.');
      });
      b.setAttribute('data-conjunto', k.id);
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      cfgConjunto.appendChild(b);
    });
    if (CATALOGOS.catalogos[0]) { cfgAyuda.textContent = CATALOGOS.catalogos[0].ayuda; }
  }

  /* --------------------------------------------------------------- el tablero */

  tablero.addEventListener('click', function (e) {
    var b = e.target.closest('.memo-carta');
    if (b) { voltear(Number(b.getAttribute('data-id'))); }
  });

  /* Con el teclado: la carta es un <button>, asi que ya recibe Enter y Espacio
     solos. Este manejador es para las FLECHAS, que permiten recorrer el tablero
     sin pasar por todas con el Tab: son veinte cartas, y recorrerlas una por una
     en cada partida es un fastidio. */
  tablero.addEventListener('keydown', function (e) {
    var b = e.target.closest('.memo-carta');
    if (!b) return;
    var todas = Array.prototype.slice.call(tablero.querySelectorAll('.memo-carta'));
    var i = todas.indexOf(b);
    var columnas = getComputedStyle(tablero).gridTemplateColumns.split(' ').length;
    var destino = null;
    if (e.key === 'ArrowRight') destino = i + 1;
    else if (e.key === 'ArrowLeft') destino = i - 1;
    else if (e.key === 'ArrowDown') destino = i + columnas;
    else if (e.key === 'ArrowUp') destino = i - columnas;
    if (destino === null) return;
    e.preventDefault();
    if (todas[destino]) { todas[destino].focus(); }
  });

  /* ----------------------------------------------------------------- el panel */

  var btnReiniciar = document.querySelector('[data-reiniciar]');
  if (btnReiniciar) {
    btnReiniciar.addEventListener('click', function () {
      preguntarSiEmpezar('Vas a reiniciar.');
    });
  }

  var btnConfigurar = document.querySelector('[data-configurar]');
  if (btnConfigurar) {
    btnConfigurar.addEventListener('click', abrirConfig);
  }

  var btnAyuda = document.querySelector('[data-ayuda]');
  if (btnAyuda) {
    btnAyuda.addEventListener('click', function () {
      window.RetoDialogo.informar({
        titulo: 'Cómo se juega',
        texto: [
          'MEMORAMA',
          'Hay parejas escondidas. Destapa dos cartas a la vez.',
          'Si son iguales, se quedan descubiertas. Si no, se tapan otra vez.',
          '',
          'No hay reloj. Puedes tardar lo que quieras: aquí no se gana por',
          'rápido, se gana por recordar.',
          '',
          'CON EL TECLADO',
          'Las flechas para moverte entre las cartas, y Enter o Espacio para',
          'voltear. Con el dedo también funciona.',
          '',
          'EL CONJUNTO',
          'Si te cuesta distinguir dos cosas parecidas, cámbialo arriba. Las',
          'formas se ven igual en cualquier aparato; los números y las letras',
          'usan la letra del sitio; los emojis son los más bonitos pero',
          'necesitan un aparato que tenga los dibujitos.',
          '',
          'PARA LEER EN VOZ ALTA',
          'Cada carta se anuncia al voltearla y cada pareja se avisa. Si tu',
          'lector de pantalla lo repite mucho, se puede apagar en el sistema.'
        ].join('\n'),
        nota: 'El número de intentos no es una nota: solo se celebra cuando terminas, y el mejor se guarda aparte para cada tablero y cada conjunto.'
      });
    });
  }

  /* ------------------------------------------------------------------ arrancar */

  fetch(API + '/catalogos')
    .then(function (r) { return r.json(); })
    .then(function (c) {
      CATALOGOS = c;
      armarOpciones();
      return pedir(API + '/nueva', { tamano: '4x4', catalogo: 'formas' });
    })
    .then(function (e) {
      partida = e.partida;
      cartas = e.cartas;
      CATALOGOS.catalogos.forEach(function (k) {
        if (k.id === e.catalogo) { tipoSimbolo = k.tipo; }
      });
      construirTablero();
      pintarCuentas(e);
      avisar('Tablero listo. ' + e.totalParejas + ' parejas por encontrar.');
    })
    .catch(function (error) {
      decir('No se pudo cargar el juego: ' + error.message);
      tablero.classList.add('memo-oculto');
    });
})();
