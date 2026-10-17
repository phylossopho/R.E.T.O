/* =========================================================================
   R.E.T.O. - El dialogo: preguntar antes de hacer algo
   -------------------------------------------------------------------------
   Se usa para las preguntas que hay que responder antes de continuar:
   "¿de verdad quieres eliminar este texto?". Devuelve una promesa: true si la
   persona dijo que si, false si dijo que no, o si cerro el dialogo sin
   contestar. Cerrar sin contestar cuenta como "no", que es lo seguro.

   POR QUE ESTO ES UN COMPONENTE Y NO UN TROZO DE CADA PAGINA
   Va a aparecer en mas de un sitio. El primero es este; el siguiente va a ser el
   modal de error del test (ver PROPUESTA 4.4), que es el mismo problema con otro
   texto. Si cada pagina trae el suyo, hay dos modales con dos estilos, y un dia
   uno de los dos se queda sin actualizar. Con un componente, el estilo del aviso
   se cambia en un solo lugar y se ve igual en todas partes.

   QUE HACE HTML Y QUE HACEMOS NOSOTROS
   Todo lo dificil lo hace el navegador y este archivo casi no trabaja:
   showModal() pone la ventana de encima, vuelve inerte el fondo (no se puede
   hacer clic en el contenido que queda atras), encierra el foco dentro del
   dialogo para que el Tab no se vaya a la pagina, cierra con Escape, y al
   cerrar devuelve el foco al boton que lo abrio. Todo eso viene hecho y bien
   hecho; escribirlo a mano son unas 60 lineas mas y tres errores en potencia.

   Lo unico que hace este archivo es:
     - escribir el texto que le pasen (con textContent, nunca con innerHTML);
     - poner el foco en el boton de NO, no en el de si;
     - y devolver la respuesta como promesa.

   POR QUE EL FOCO VA AL BOTON DE "NO"
   El boton de confirmar esta en el borde derecho del dialogo, que es donde
   fingers empiezan a moverse y donde el dedo se detiene primero al deslizar. Si
   ahi estuviera "Eliminar" y la persona solo esta mirando, un doble toque
   rapido y con descuido lo activaria. Con "No" en ese lado, hay que deslizar a
   proposito hasta el otro boton para confirmar.

   PARA QUE SIRVE ESTO Y NO ES ADORNO
   Un boton de borrar abre la pregunta. Si alguien la pierde, vuelve al texto y
   no pasa nada. Si alguien la pulsa, el texto se va. Por eso la pregunta dice las
   dos cosas que importan: que no se puede deshacer, y que todavia queda en el
   archivo de respaldo.

   SI EL NAVEGADOR NO TIENE <dialog>
   Es un caso raro: <dialog> esta en todos los navegadores del piso que pide el
   proyecto. Pero si no estuviera, este archivo cae a la pregunta del navegador
   (window.confirm), que es fea pero funciona. Nunca se queda sin preguntar. */
(function () {
  'use strict';

  var dlg, tituloEl, textoEl, notaEl, accionesEl, listaEl, btnOk, btnCancelar, btnCancelarFab, resolverActual = null;
  var elementoCreado = false;

  /* Un <dialog> por pagina es suficiente, y se reutiliza. Se crea al vuelo (y
     no en el HTML de cada pagina) porque el dialogo es del componente: si cada
     pagina escribiera su propio <dialog>, cada una tendria que acordarse de
     pegarle los id correctos, y uno mal pegado es un boton que no hace nada. */
  function armar() {
    dlg = document.createElement('dialog');
    dlg.className = 'dialogo';
    dlg.setAttribute('aria-labelledby', 'dialogo-titulo');

    /* El icono va dentro de un envoltorio, y no directo en el dialogo. Un
       elemento con position: absolute se coloca respecto al antepasado
       POSICIONADO mas cercano, y el dialogo no lo es: su posicion la pone el
       navegador, no el CSS. Sin ese envoltorio el icono se colocaba respecto a
       la pagina entera y se salia por la derecha, y por eso aparecia la barrita
       horizontal de scroll. El envoltorio tiene height: 0, asi que no le cambia
       el tamano al dialogo. Ver el mismo comentario en 30_componentes. */
    var fondo = document.createElement('div');
    fondo.className = 'dialogo-fondo';
    fondo.setAttribute('aria-hidden', 'true');

    var icono = document.createElement('span');
    icono.className = 'dialogo-icono';
    var reserva = document.createElement('span');
    reserva.className = 'reserva';
    reserva.textContent = '\u26A0';
    icono.appendChild(reserva);
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z');
    var l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l1.setAttribute('x1', '12'); l1.setAttribute('y1', '9'); l1.setAttribute('x2', '12'); l1.setAttribute('y2', '13');
    var l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l2.setAttribute('x1', '12'); l2.setAttribute('y1', '17'); l2.setAttribute('x2', '12.01'); l2.setAttribute('y2', '17');
    svg.appendChild(p); svg.appendChild(l1); svg.appendChild(l2);
    icono.appendChild(svg);
    fondo.appendChild(icono);
    dlg.appendChild(fondo);

    tituloEl = document.createElement('h2');
    tituloEl.className = 'dialogo-titulo';
    tituloEl.id = 'dialogo-titulo';
    dlg.appendChild(tituloEl);

    textoEl = document.createElement('p');
    textoEl.className = 'dialogo-texto';
    dlg.appendChild(textoEl);

    /* La NOTA: una linea de letra chica debajo del texto, para lo que es
       secundario. Sirve para lo que se debe saber pero no se debe leer primero:
       "estos marcadores se ven abajo, en la edicion". Va en letra chica a
       proposito, porque si va en la misma que el texto principal compite con
       el y las dos se leen a la misma importancia, y no la tienen. */
    notaEl = document.createElement('p');
    notaEl.className = 'dialogo-nota';
    notaEl.hidden = true;
    dlg.appendChild(notaEl);

    accionesEl = document.createElement('div');
    accionesEl.className = 'dialogo-acciones';

    btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'boton';
    btnCancelar.textContent = 'No, mejor no';
    accionesEl.appendChild(btnCancelar);

    btnOk = document.createElement('button');
    btnOk.type = 'button';
    btnOk.className = 'boton boton--principal';
    btnOk.textContent = 'Sí, eliminar';
    accionesEl.appendChild(btnOk);

    dlg.appendChild(accionesEl);

    /* EL BOTON DE CANCELAR DEL MODAL
       Flota en la esquina inferior derecha, y sale SOLO en los avisos que no
       tienen fila de botones (los que se eligen de una lista). En los otros ya
       esta el boton de "No", y dos maneras de cancelar en la misma pantalla es
       una de mas.

       Va flotando y no dentro de la fila porque con una lista larga la fila se
       va hasta abajo y deja de verse. Un boton en la esquina se ve siempre,
       por cuantos renglones tenga la lista.

       Es del color de aviso, el mismo del boton de eliminar, para que se lea
       como parte de la misma familia de controles del sitio. */
    btnCancelarFab = document.createElement('button');
    btnCancelarFab.type = 'button';
    btnCancelarFab.className = 'dialogo-cancelar';
    btnCancelarFab.setAttribute('aria-label', 'Cancelar');
    btnCancelarFab.title = 'Cancelar';
    var fabReserva = document.createElement('span');
    fabReserva.className = 'reserva';
    fabReserva.setAttribute('aria-hidden', 'true');
    fabReserva.textContent = '\u2715';
    btnCancelarFab.appendChild(fabReserva);
    var fabSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    fabSvg.setAttribute('viewBox', '0 0 24 24');
    fabSvg.setAttribute('fill', 'none');
    fabSvg.setAttribute('stroke', 'currentColor');
    fabSvg.setAttribute('stroke-width', '2');
    fabSvg.setAttribute('stroke-linecap', 'round');
    fabSvg.setAttribute('aria-hidden', 'true');
    fabSvg.setAttribute('focusable', 'false');
    var x1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    x1.setAttribute('d', 'M18 6 6 18');
    var x2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    x2.setAttribute('d', 'm6 6 12 12');
    fabSvg.appendChild(x1);
    fabSvg.appendChild(x2);
    btnCancelarFab.appendChild(fabSvg);
    dlg.appendChild(btnCancelarFab);

    btnCancelar.addEventListener('click', function () { cerrar(false); });
    btnOk.addEventListener('click', function () { cerrar(true); });
    btnCancelarFab.addEventListener('click', function () { cerrar(false); });

    /* La LISTA, para los avisos que se eligen de una lista y no con dos
       botones: el indice de un libro, por ejemplo, que puede tener quince
       capitulos y no caben en dos botones.

       Va antes que el texto y se esconde en el resto de las preguntas. Se
       escribe una vez y se llena o se vacia, en vez de armarse cada vez, para
       que no haya dos caminos distintos para la misma cosa. */
    listaEl = document.createElement('ul');
    listaEl.className = 'dialogo-lista';
    listaEl.hidden = true;
    dlg.insertBefore(listaEl, textoEl);

    /* Escape y el clic en el fondo. Los dos cuentan como "no": si alguien
       cierra el dialogo sin contestar, lo prudente es no borrar nada. */
    dlg.addEventListener('cancel', function (e) {
      e.preventDefault();
      cerrar(false);
    });
    dlg.addEventListener('click', function (e) {
      // Solo si el clic fue en el fondo. Un clic dentro del dialogo tiene
      // target distinto del dialogo, y esto lo distingue sin medir pixeles.
      if (e.target === dlg) cerrar(false);
    });

    /* Red de seguridad. Si el dialogo se cierra por una via que no es un boton
       (que en la practica no pasa, porque el "cancel" de arriba ya esta
       frenado), la promesa quedaria colgada para siempre y la pagina se
       quedaria esperando. Aqui se resuelve como "no", que es la respuesta
       segura. Comprobando que quede alguien por resolver, no hay riesgo de
       resolver dos veces. */
    dlg.addEventListener('close', function () {
      if (resolverActual) cerrar(false);
    });

    document.body.appendChild(dlg);
    elementoCreado = true;
  }

  /* ACOMODAR EL BOTON FLOTANTE FUERA DEL MODAL
     El boton de cancelar va "asomado" por la esquina inferior derecha del
     dialogo, con 12 px de margen. No se pone en posicion fija contra la esquina
     de la pantalla porque en una pantalla grande queda lejisimos del modal, y
     ya no se ve que le pertenece. Tampoco se puede poner en posicion absoluta
     dentro del dialogo, porque el dialogo no es su ancestro posicionado: esa
     posicion la pone el navegador, y lo que escribe la pagina le gana. Asi que
     lo unico que queda es MEDIR donde quedo el dialogo y colocarse ahi.

     Se vuelve a medir cuando se abre y cuando se cambia el tamano de la
     ventana, porque en un celular al girar el modal cambia de lugar. */
  var SALIDA = 12;

  function acomodarCancelar() {
    /* "!btnCancelarFab" va PRIMERO, y no es un detalle de orden.
       Todas esas variables se declaran en una sola linea con "var a, b, c;" y el
       "= null" solo se le aplica a la ULTIMA. O sea que btnCancelarFab nace
       "undefined", no "null", hasta que armar() la crea.

       Y esta funcion se llama con cada redimensionado de la ventana, mucho
       ANTES de que se abra un dialogo: cuando eso pasaba, se leia
       "undefined.hidden" y salia un error en CADA movimiento de la ventana. Un
       error por pixel que se arrastra, que ademas dejaba el boton sin colocar
       (su posicion la pone justamente esta funcion), y por eso se veia por
       fuera del modal. */
    if (!btnCancelarFab || btnCancelarFab.hidden || !dlg) return;
    var r = dlg.getBoundingClientRect();
    // "right" y "bottom" se miden desde la esquina de la ventana, asi que se
    // resta lo que el dialogo se acerca de esa esquina.
    btnCancelarFab.style.right = Math.max(8, window.innerWidth - r.right + SALIDA) + 'px';
    btnCancelarFab.style.bottom = Math.max(8, window.innerHeight - r.bottom + SALIDA) + 'px';
  }

  window.addEventListener('resize', function () { acomodarCancelar(); });

  function limpiar(e) {
    while (e.firstChild) e.removeChild(e.firstChild);
  }

  function cerrar(respuesta) {
    if (resolverActual) {
      var r = resolverActual;
      resolverActual = null;
      if (dlg.open) dlg.close();
      r(respuesta);
    }
  }

  /* ------------------------------------------------------------------ API

     TRES FORMAS DE AVISAR, y son tres porque son tres cosas distintas:

       preguntar({titulo, texto, ok, cancelar})   -> true o false
         Una pregunta con dos respuestas. "Borrar o no".

       informar({titulo, texto})                   -> true, siempre
         Un aviso que no se contesta: solo se lee y se cierra. "Como funciona
         esto". Aqui NO se pone boton de cancelar: un boton que hace lo mismo
         que el otro, pero con otro nombre, es ruido, y el dedo lo aprieta dos
         veces sin querer. Con uno solo no hay forma de apretar el equivocado.

       lista({titulo, items})                      -> el valor elegido, o false
         Un aviso de donde se elige UNA de varias, tocando la lista. El indice
         de un libro, por ejemplo. Con dos botones no cabe, y con quince
         botones en fila tampoco. */
  function pintarLista(items) {
    limpiar(listaEl);
    if (!items || !items.length) return;
    items.forEach(function (item) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dialogo-item';
      b.textContent = item.texto;
      b.addEventListener('click', function () { cerrar(item.valor); });
      li.appendChild(b);
      listaEl.appendChild(li);
    });
  }

  /* El armazon comun: escribe los textos, decide que se ve, y abre. "pie" es lo
     que se hace con los botones: cada forma de aviso trae el suyo. */
  function abrir(o, pie) {
    tituloEl.textContent = o.titulo || '';
    textoEl.textContent = o.texto || '';
    textoEl.hidden = !o.texto;
    notaEl.textContent = o.nota || '';
    notaEl.hidden = !o.nota;
    pie();
    dlg.showModal();
    // Se mide DESPUES de abrir, porque antes el dialogo todavia no tiene lugar.
    // Un rAF para que el navegador ya lo haya pintado al menos una vez, que es
    // cuando de verdad estan las medidas.
    requestAnimationFrame(acomodarCancelar);
    return new Promise(function (resolver) { resolverActual = resolver; });
  }

  function perderElFocoA(preferido) {
    (preferido || btnCancelar).focus();
  }

  window.RetoDialogo = {
    /* Dos respuestas. */
    preguntar: function (opciones) {
      var o = opciones || {};
      if (!window.HTMLDialogElement) {
        return Promise.resolve(window.confirm((o.titulo || '') + '\n\n' + (o.texto || '')));
      }
      if (!elementoCreado) armar();
      if (document.querySelector('dialog.dialogo[open]')) cerrar(false);

      listaEl.hidden = true;
      accionesEl.hidden = false;
      btnCancelar.hidden = false;
      btnCancelar.textContent = o.cancelar || 'No';
      btnOk.textContent = o.ok || 'Sí';
      btnCancelarFab.hidden = true;   // aqui ya esta el boton de "No"

      return abrir(o, function () {
        // El foco va al boton de cancelar, que es la respuesta que no destruye
        // nada. Un doble toque sin querer no puede ser la opcion que borra.
        perderElFocoA(btnCancelar);
      });
    },

    /* Sin respuesta: solo se lee. Un solo boton, que cierra. */
    informar: function (opciones) {
      var o = opciones || {};
      if (!window.HTMLDialogElement) {
        window.alert((o.titulo || '') + '\n\n' + (o.texto || ''));
        return Promise.resolve(true);
      }
      if (!elementoCreado) armar();
      if (document.querySelector('dialog.dialogo[open]')) cerrar(false);

      listaEl.hidden = true;
      accionesEl.hidden = false;
      btnCancelar.hidden = true;      // <- lo evita el boton repetido
      btnCancelarFab.hidden = true;   // <- y no hace falta el flotante
      btnOk.textContent = o.ok || 'Entendido';

      return abrir(o, function () { perderElFocoA(btnOk); });
    },

    /* Se elige UNO de una lista. Devuelve el valor del item, o false si se
       cierra sin elegir. */
    lista: function (opciones) {
      var o = opciones || {};
      if (!window.HTMLDialogElement) {
        // Sin <dialog> no hay lista que tocar. Se avisa con un numero: es
        // degrado, no perdida, porque el numero de linea sigue sirviendo.
        var lineas = (o.items || []).map(function (i) { return i.texto; }).join('\n');
        var choix = window.prompt((o.titulo || '') + '\n\n' + lineas + '\n\nEscribe el numero:');
        if (choix === null) return Promise.resolve(false);
        var n = parseInt(choix, 10);
        var item = (o.items || [])[n - 1];
        return Promise.resolve(item ? item.valor : false);
      }
      if (!elementoCreado) armar();
      if (document.querySelector('dialog.dialogo[open]')) cerrar(false);

      pintarLista(o.items);
      listaEl.hidden = false;
      accionesEl.hidden = true;       // la lista ES la eleccion
      btnCancelarFab.hidden = false;  // <- en la lista no hay boton de "No"

      return abrir(o, function () {
        // El foco arranca en el primer item, que es donde se empieza a leer.
        var primero = listaEl.querySelector('button');
        if (primero) primero.focus();
      });
    }
  };
})();
