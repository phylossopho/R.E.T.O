/* =========================================================================
   R.E.T.O. - El panel flotante
   -------------------------------------------------------------------------
   El panel es una barra de botones flotando abajo, al estilo del dock de un
   sistema. Su forma y su color son CSS (30_componentes.css, .panel-flotante);
   lo de aqui es lo unico que CSS no puede hacer.

   QUE HACE, Y POR QUE NECESITA JAVASCRIPT
   El panel se vuelve casi transparente a los 2100 ms de la ULTIMA interaccion,
   y vuelve a verse en cuanto se le toca o se le pasa el raton encima. O sea:
   un reloj que se reinicia solo con cada toque.

   Eso no se puede escribir en CSS. Se podria hacer con una animacion que tarda
   2100 ms y se queda al final, pero esa cuenta NO vuelve a empezar cuando la
   persona toca el panel: solo se reinicia al recargar la pagina. Con un dock
   que se usa ratoneando, eso significa que a la segunda vez ya no funciona. Un
   reloj que reinicia con cada evento es exactamente el caso para el que el
   proyecto acepta JavaScript sin culpa.

   Y NO DEPENDE DEL INTERRUPTOR DE ANIMACIONES
   A proposito, y no es un descuido. La transparencia no es adorno: es lo que
   aparta el panel de en medio del texto. Si esta regla viviera dentro de
   [data-anim="on"], con el interruptor apagado el panel se quedaria opaco
   tapando lo que se esta leyendo, que es justo lo contrario de lo pedido.

   LO QUE NO SE ROMPE CUANDO NO HAY JAVASCRIPT
   Los botones son enlaces de verdad con su href. Sin este archivo, el panel se
   ve siempre opaco y los enlaces funcionan: se pierde el volverse transparente,
   no la manera de moverse por el sitio.

   CUANDO NADIE LO ESTE TOCANDO
   Si la persona esta escribiendo, o esta con el teclado dentro del panel, el
   reloj NO se pone en marcha. Perder el panel mientras se esta usando seria
   justo la falla que el panel transparente intenta evitar. */
(function () {
  'use strict';

  /* El tiempo quieto antes de volverse transparente. Es lo que la persona
     eligio en Configuracion, y llega aqui por un atributo en el <html> que
     puso el script del head (reto-panel-prefs.js). Si el atributo no esta, se usa
     el de antes.

     La funcion esta porque el valor se puede cambiar desde Configuracion con la
     pagina abierta, y asi el temporizador siempre usa el que esta de verdad en
     este momento, en vez de el que se leyo al abrir. */
  var ESPERA_POR_DEFECTO = 2100;

  function esperaElegida() {
    var v = parseInt(document.documentElement.getAttribute('data-panel-espera'), 10);
    if (isNaN(v)) return ESPERA_POR_DEFECTO;
    return Math.max(0, v);
  }

  var panel = document.querySelector('[data-panel]');
  if (!panel) return;

  var reloj = null;

  function dormirse() {
    if (reloj) clearTimeout(reloj);
    reloj = setTimeout(function () {
      panel.setAttribute('data-al-descanso', '1');
    }, esperaElegida());
  }

  function despertarse() {
    if (reloj) clearTimeout(reloj);
    panel.removeAttribute('data-al-descanso');
    dormirse();
  }

  /* Cada interaccion con el panel reinicia el reloj. "pointerenter" cubre el
     raton que se acerca; "pointerdown" y "touchstart" cubren el dedo, que no
     tiene hover; "focusin" cubre el teclado. Con eso quedan los tres: un raton,
     un dedo y un teclado. */
  panel.addEventListener('pointerenter', despertarse);
  panel.addEventListener('pointerdown', despertarse);
  panel.addEventListener('focusin', despertarse);
  panel.addEventListener('touchstart', despertarse, { passive: true });

  /* Si el foco se va del panel (Tab hacia otro lado, o Shift+Tab hacia atras),
     el reloj vuelve a correr. Mientras este dentro, NO: quien esta usando el
     panel con el teclado no puede perderlo a mitad de camino. */
  panel.addEventListener('focusout', function (e) {
    if (!panel.contains(e.relatedTarget)) dormirse();
  });

  /* El boton de "Volver" del panel: vuelve donde uno venia, no a una pagina
     fija. Por eso usa data-accion="atras" y no un href de verdad, porque "ir a
     la pagina anterior" no se puede escribir en un atributo.

     Sin JavaScript el href sigue apuntando a la biblioteca, que es una salida
     valida aunque no sea exactamente la de venida. Por eso el href existe y no
     se borra: es el camino de emergencia. */
  var atras = panel.querySelector('[data-accion="atras"]');
  if (atras) {
    atras.addEventListener('click', function (e) {
      // Si no hay historial (alguien abrio esta pagina pegada, o recargando
      // mucho), atras se quedaria sin hacer nada. En ese caso se deja que el
      // href haga su trabajo, que es salir a la biblioteca.
      if (window.history.length > 1) {
        e.preventDefault();
        window.history.back();
      }
    });
  }

  /* El id del texto que se esta leyendo solo se sabe en la direccion. Se lee una
     vez y se reutiliza para el boton de editar y el de borrar, en vez de repetir
     el mismo condicional en los dos. El camino con "catch" es para navegadores
     viejos que no tienen URLSearchParams. */
  function idDeLaDireccion() {
    try {
      return new URLSearchParams(location.search).get('id');
    } catch (e) {
      var m = /[?&]id=([^&]*)/.exec(location.search);
      return m ? decodeURIComponent(m[1]) : null;
    }
  }

  /* El boton de "Editar" necesita el id del texto que se esta leyendo, y ese id
     solo se sabe en la direccion. El href trae la ruta sin id (se declara en el
     HTML, como data-ruta-editar en el resto del proyecto) y aqui se le engancha
     lo que falta.

     Sin JavaScript el enlace lleva a la pagina de edicion, que es justo lo que
     hace falta: abre en blanco. Sigue siendo util. */
  var editar = panel.querySelector('[data-accion="editar"]');
  if (editar) {
    var base = panel.getAttribute('data-ruta-editar');
    var id = idDeLaDireccion();
    if (base && id) editar.setAttribute('href', base + '?id=' + encodeURIComponent(id));
  }

  /* Al abrir la pestana en segundo plano, o cambiar de pestana, el panel se
     pone transparente de una vez: nadie lo esta mirando y al volver debe estar
     en su estado de reposo, no recien despertado. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (reloj) clearTimeout(reloj);
      panel.setAttribute('data-al-descanso', '1');
    }
  });

  /* EL BOTON DE BORRAR
     Es el unico del panel que no lleva a ninguna parte: ejecuta. Por eso es un
     <button> y no un enlace.

     El boton NO avisa de nada. Es igual que los otros dos, y a proposito: un
     boton rojo al lado de dos grises no dice "cuidado", dice "presiona aqui",
     porque el color llama el ojo y el toque llega solo. El aviso va aqui, que
     es donde la persona ya decidio que va a hacer algo. */

  var borrar = panel.querySelector('[data-accion="borrar"]');
  if (borrar) {
    borrar.addEventListener('click', function () {
      var id = idDeLaDireccion();
      if (!id) return;
      // El titulo ya lo cambio la pagina al abrir el texto, asi que el aviso
      // dice el nombre real y no hay que adivinarlo.
      var nombre = (document.querySelector('header h1') || {}).textContent || 'este texto';

      window.RetoDialogo.preguntar({
        titulo: '¿Eliminar "' + nombre + '"?',
        texto: 'Esto no se puede deshacer. Todavía puedes recuperarlo desde ' +
               'Configuración, con el archivo de respaldo.',
        ok: 'Sí, eliminar',
        cancelar: 'No, mejor no'
      }).then(function (dijoQueSi) {
        if (!dijoQueSi) return;
        // Se apaga el boton mientras borra, para que dos toques seguidos no
        // borren dos textos distintos si la persona se impacienta.
        borrar.disabled = true;
        return window.RetoDatos.libros.borrar(id).then(function () {
          // Se va a la biblioteca. Si se hiciera "atras", un segundo borrado
          // seguido llevaria al mismo sitio y pareceria que no paso nada.
          location.href = '../biblioteca.html';
        }).catch(function (e) {
          borrar.disabled = false;
          window.RetoDialogo.preguntar({
            titulo: 'No se pudo eliminar',
            texto: e.message,
            ok: 'Entendido',
            cancelar: 'Entendido'
          });
        });
      });
    });
  }

  /* Arranca con la cuenta corriendo, no transparente de golpe. Al abrir la
     pagina todavia no ha pasado nada, y lo pedido son 2100 ms DESPUES de la
     ultima interaccion: aqui la ultima interaccion es abrir la pagina. Ponerlo
     transparente de entrada seria inventarse un instante que no existe. */
  dormirse();
})();
