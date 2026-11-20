/* =========================================================================
   R.E.T.O. - La tabla de Schulte

   -------------------------------------------------------------------------
   QUÉ ES
   Una rejilla de símbolos que hay que tocar EN ORDEN, del primero al último.
   La inventó Walter Schulte como instrumento de psicodiagnóstico, y hoy es un
   juego de entrenamiento de la atención.

   LA TÉCNICA, QUE EL JUEGO ENSEÑA SIN DECIR NADA
   La mirada se queda fija en el CENTRO de la tabla y los símbolos se encuentran
   con la visión periférica. Mover los ojos renglón por renglón es justo lo que
   hay que evitar. Por eso hay un punto en el centro: es el ancla. Y por eso el
   punto va DETRÁS del número, con el número llevando un contorno del color del
   fondo (ver 60_juegos.css), que es lo único que deja ver las dos cosas.

   -------------------------------------------------------------------------
   AL FALLAR NO SE HACE NADA
   Ni un color, ni un temblor, ni un sonido. Es una decisión, y de las
   importantes: quien tiene TDAH oteespertismo autista ve una señal roja cada vez
   que se equivoca, aprende a miedo, y deja de intentar. El error SE CUENTA,
   porque sirve para ver la tendencia al final, pero no se enseña durante la
   partida.

   -------------------------------------------------------------------------
   QUÉ VIVE EN EL SERVIDOR Y QUÉ AQUÍ
   El tablero lo arma Python (logica/schulte.py) y se pide UNA vez al empezar.
   Todo lo demás —el reloj, el desvanecido, los errores— vive aquí, porque un
   viaje al servidor por cada casilla falsearía el tiempo, y el tiempo es justo
   lo que se mide. En el memorama el servidor guarda la partida porque tiene
   cartas boca abajo; aquí la rejilla entera está a la vista, así que no hay
   nada que esconder.

   -------------------------------------------------------------------------
   LOS AJUSTES
   Se guardan con RetoDatos, con el prefijo "schulte-". Los que nunca se tocan
   NO se guardan: se usa su valor de fábrica. Así, si mañana cambia un valor de
   fábrica, quien nunca lo tocó recibe el nuevo, y solo se entera quien lo había
   cambiado a mano.

   Los colores son la excepción: valen "" cuando no se han tocado, y "" quiere
   decir "el del tema". Se escriben como variables CSS en <html> y el tablero y
   el cuadrito del modal las heredan, que es lo que hace que la vista previa se
   mueva al instante sin que nada las copie a mano.
   ========================================================================= */
(function () {
  'use strict';

  var API = '/api/schulte';
  var PREFIJO = 'schulte-';

  /* ---------------------------------------------------------------------
     LOS AJUSTES Y SUS VALORES DE FÁBRICA

     El TAMAÑO viene en 3x3 a propósito, aunque el 5x5 sea el clásico: este
     sitio es para niños y el primer tablero que se ve tiene que ser el que se
     puede terminar. El 5x5 está a un clic.

     El RÉCORD empieza APAGADO. Lo que dice la investigación que hay detrás del
     juego es que lo que sirve no es superar una marca, sino ver la propia
     tendencia. El récord es un extra para quien lo quiera, no el centro.

     El PUNTO va en 1. Con 0 desaparece, que es una opción de más para quien
     prefiera el tablero limpio.

     LA LETRA y la FUENTE también son ajustes, como en los motores de lectura.
     La letra va en rem por tamaño de casilla, y hay tres pasos: con el más
     grande, en un 5x5 de celular el número casi no cabe.

     EL VOLUMEN DEL JUEGO va en CUATRO PASOS (25, 50, 75 y 100), no en un
     deslizador. Un deslizador fino invita a pasarse de largo; cuatro botones se
     eligen a ojo y se saben de memoria. OJO con esto: el sitio tiene un volumen
     general en Configuración → Sonido. Aquí **no se multiplica** uno por otro
     (la mitad de la mitad es un doce por ciento, y no hay forma de pedirlo):
     el de aquí sustituye al general. Lo que SÍ manda del sitio es el
     interruptor general: con ese apagado, este juego se calla igual.
     --------------------------------------------------------------------- */
  var FABRICA = {
    tamano: '3x3',
    contenido: 'numeros',
    reloj: 'on',
    sonido: 'on',
    desvanecer: 'on',
    record: 'off',
    punto: '1',
    fallo: 'mensaje',       // al fallar: mensaje | sacudida | nada
    letra: '2',
    fuente: 'nunito',
    sonidoAcierto: 'ding',
    sonidoFinal: 'charm',
    volumen: '50'
  };

  /* Los colores. SOLO el fondo y el texto, igual que el galáctico: son las dos
     cosas que alguien puede querer cambiar de verdad. El verde del acierto y el
     del punto son los del tema, porque son el mismo verde ya medido en los cinco
     temas y no hay nada que elegir.

     Vacío = el color del tema. */
  var COLOR_FABRICA = { fondo: '', texto: '' };

  var VARIABLE = {
    fondo: '--schulte-fondo',
    texto: '--schulte-texto'
  };

  /* La letra, en rem por casilla. Tres pasos, como los del volumen. */
  var LETRAS = [
    { id: '1', nombre: 'Pequeña', valor: '1.2' },
    { id: '2', nombre: 'Mediana', valor: '1.6' },
    { id: '3', nombre: 'Grande', valor: '2.1' }
  ];


  /* Los sonidos que hay. Son los mismos tres del sitio, con los mismos
     archivos: no se agrega ninguno nuevo. El segundo y el tercero son para
     escoger; el "activar" es lo que enciende o apaga el juego. */
  var SONIDOS = [
    { id: 'ding', nombre: 'Ding' },
    { id: 'charm', nombre: 'Charm' },
    { id: 'soft', nombre: 'Suave' }
  ];

  /* Cuántas partidas se guardan de cada tabla para la tendencia. Ocho es de
     sobra para ver si se va mejor o peor, y son pocos datos para guardar en el
     dispositivo de alguien. */
  var CUANTAS_SE_GUARDAN = 8;

  /* ---------------------------------------------------------------------
     EL ESTADO

     De una sola pieza y aquí, no repartido por el DOM: cambiar el tamaño tiene
     que cambiar el tablero, el total y el reloj, y si eso vive en tres sitios
     se desincroniza.
     --------------------------------------------------------------------- */
  var ajustes = {};
  var colores = {};
  var tablero = null;      // lo que devuelve el servidor
  var esperados = null;    // los símbolos EN ORDEN: cuál toca ahora
  var encontrados = 0;
  var errores = 0;
  var corriendo = false;
  var empieza = 0;
  var ocultoMs = 0;        // lo que la pestana estuvo escondida: no se cuenta
  var ocultoDesde = null;
  var sesionMs = 0;        // lo jugado en esta visita, para el progreso
  var objetivoEl = null;

  var tableroEl, mensajeEl, lectorEl, relojEl, cuentasEl, rellenoEl;
  var cfg = null;
  var cfgAbierto = false;

  /* ------------------------------------------------------------- avisos */

  /* Dos caminos distintos que a veces se parecen y no son lo mismo.
     `mensaje()` se VE en la pantalla y ocupa sitio, para que el tablero no
     salte de altura a mitad de la partida.
     `avisar()` solo se ANUNCIA, para quien no ve. */
  function avisar(texto) {
    if (lectorEl) lectorEl.textContent = texto;
  }

  function mensaje(texto) {
    if (mensajeEl) {
      mensajeEl.textContent = texto || '';
      if (mensajeEl.removeAttribute) mensajeEl.removeAttribute('data-tipo');
    }
  }

  function decir(texto) {
    mensaje(texto);
    avisar(texto);
  }

  /* ---------------------------------------------------------- el tiempo */

  function formatear(segundos) {
    return segundos.toFixed(2) + ' s';
  }

  /* El tiempo que la pestana estuvo escondida no cuenta: el ejercicio se pausa
     solo si se cambia de pestana (el reloj mide la vista, no la ausencia). */
  function tiempoOculto() {
    return ocultoMs + (ocultoDesde !== null ? performance.now() - ocultoDesde : 0);
  }

  function segundos() {
    return corriendo ? (performance.now() - empieza - tiempoOculto()) / 1000 : 0;
  }

  /* ------------------------------------------------------- los ajustes */

  function cargarAjustes() {
    var tareas = Object.keys(FABRICA).map(function (clave) {
      return window.RetoDatos.obtener(PREFIJO + clave).then(function (v) {
        ajustes[clave] = (v === null || v === undefined) ? FABRICA[clave] : String(v);
      });
    });
    Object.keys(COLOR_FABRICA).forEach(function (clave) {
      return window.RetoDatos.obtener(PREFIJO + 'color-' + clave).then(function (v) {
        colores[clave] = (v === null || v === undefined) ? COLOR_FABRICA[clave] : String(v);
      });
    });
    return Promise.all(tareas);
  }

  function guardarAjuste(clave, valor) {
    ajustes[clave] = valor;
    return window.RetoDatos.poner(PREFIJO + clave, valor);
  }

  function guardarColor(clave, valor) {
    colores[clave] = valor;
    aplicarColores();
    return window.RetoDatos.poner(PREFIJO + 'color-' + clave, valor);
  }

  /* Los colores van al <html>, no al tablero. Así los HEREDAN tanto el tablero
     como el cuadrito del modal, y la vista previa se mueve al instante sin que
     haya que copiarlos a los dos lados. Un vacío quita la variable, y el
     "var(--x, --del-tema)" del CSS vuelve a mandar. */
  function aplicarColores() {
    var r = document.documentElement;
    Object.keys(VARIABLE).forEach(function (clave) {
      if (colores[clave]) r.style.setProperty(VARIABLE[clave], colores[clave]);
      else r.style.removeProperty(VARIABLE[clave]);
    });
  }

  /* LA LETRA Y LA FUENTE, IGUAL QUE LOS COLORES: al <html>, para que el
     cuadrito del modal las herede y se vean al momento. Se escriben SIEMPRE
     (tengan o no valor elegido), porque aquí sí hay un valor de fábrica y no
     un "vacío = el del tema".

     La fuente se pone entre comillas porque puede ser un nombre con espacios
     ("Open Sans"), y sin comillas el CSS lo parte en dos y no encuentra nada. */
  function aplicarForma() {
    var r = document.documentElement;
    var letra = LETRAS.filter(function (l) { return l.id === ajustes.letra; })[0] || LETRAS[1];
    r.style.setProperty('--schulte-letra', letra.valor);
    r.style.setProperty('--schulte-fuente', '"' + ajustes.fuente + '", var(--font)');
  }

  /* EL SONIDO DEL JUEGO.
     Pasa siempre por RetoSonido, que es el módulo del sitio: ese es el que
     sabe si el sonido general está apagado. Aquí solo se decide el QUÉ y el
     VOLUMEN, y el interruptor general del sitio manda igual.

     Si el sonido general está apagado, RetoSonido no suena y esta función no
     tiene por qué enterarse: así el juego y el sitio no pueden discrepar. */
  function tocarSonido(que) {
    if (ajustes.sonido !== 'on' || !window.RetoSonido) return;
    var clave = que === 'final' ? ajustes.sonidoFinal : ajustes.sonidoAcierto;
    var volumen = (parseInt(ajustes.volumen, 10) || 50) / 100;
    window.RetoSonido.reproducir(clave, volumen);
  }

  /* ------------------------------------------------------------- pintar */

  /* "Busca: ..." Solo en los contenidos sin orden natural (dibujos y colores con
     forma), donde la persona no puede saber cual toca: lo dice la pantalla. */
  function nombreEsperado() {
    if (tablero && tablero.orden_detalle && tablero.orden_detalle.length) {
      var d = tablero.orden_detalle[encontrados];
      return d ? d.nombre : '';
    }
    return esperados ? String(esperados[encontrados]) : '';
  }

  /* "Busca el 7" para numeros y letras; "Busca: manzana" para dibujos y colores
     (los nombres no comparten genero, asi que no lleva articulo). */
  function fraseBuscar() {
    var n = nombreEsperado();
    return (tablero && tablero.mostrar_objetivo) ? 'Busca: ' + n + '.' : 'Busca el ' + n + '.';
  }

  function pintarObjetivo() {
    if (!objetivoEl) return;
    var ver = !!(tablero && tablero.mostrar_objetivo && tablero.orden_detalle &&
                 tablero.orden_detalle[encontrados]);
    objetivoEl.hidden = !ver;
    while (objetivoEl.firstChild) objetivoEl.removeChild(objetivoEl.firstChild);
    if (!ver) return;
    var d = tablero.orden_detalle[encontrados];
    objetivoEl.appendChild(document.createTextNode('Busca: '));
    var simbolo = document.createElement('span');
    simbolo.className = 'schulte-simbolo';
    if (d.color) simbolo.setAttribute('data-color', d.color);
    simbolo.setAttribute('aria-hidden', 'true');
    simbolo.textContent = d.texto;
    objetivoEl.appendChild(simbolo);
    objetivoEl.appendChild(document.createTextNode(' ' + d.nombre));
  }

  function pintarCuentas() {
    var total = tablero ? tablero.total : 1;
    if (rellenoEl) {
      rellenoEl.style.width = Math.round((encontrados / total) * 100) + '%';
    }
    if (cuentasEl) cuentasEl.textContent = encontrados + ' de ' + total;
  }

  function pintarReloj() {
    if (!relojEl) return;
    /* El reloj se apaga DEL TODO cuando la persona no lo quiere. Si no lo
       quieres ver, no verlo es el ajuste entero. */
    relojEl.hidden = ajustes.reloj !== 'on';
    if (ajustes.reloj === 'on' && corriendo) relojEl.textContent = segundos().toFixed(2);
  }

  /* Un solo "pintar" para todo, y no uno por cada cosa. */
  function pintar() {
    pintarCuentas();
    pintarReloj();
    pintarObjetivo();
  }

  function pintarTablero() {
    while (tableroEl.firstChild) tableroEl.removeChild(tableroEl.firstChild);
    tableroEl.setAttribute('data-tamano', tablero.tamano || ajustes.tamano);
    tableroEl.setAttribute('data-punto', ajustes.punto === '0' ? '0' : '1');

    tablero.celdas.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'schulte-celda';
      b.setAttribute('data-id', String(c.id));
      /* El nombre accesible dice DÓNDE y QUÉ, no solo el número: para quien
         navega con el lector, "casilla 4, número 13" sirve; "13", no tanto. */
      /* Dibujos y colores traen su texto, su color y su nombre: la forma se ve
         Y se dice ("triangulo rojo"), asi que no depende solo del color. */
      b.setAttribute('aria-label', 'Casilla ' + (c.id + 1) + ', ' +
                                   (c.nombre ? c.nombre : tablero.contenido + ' ' + c.valor));
      if (c.color) b.setAttribute('data-color', c.color);
      b.textContent = c.texto || c.valor;
      tableroEl.appendChild(b);
    });

    /* El punto central: detrás (el CSS lo pone en z-index 0), invisible para
       el lector de pantalla, y SIN RECIBIR LOS TOQUES. Sin lo último
       bloquearía la casilla de debajo sin que se notara. */
    var punto = document.createElement('span');
    punto.className = 'schulte-punto';
    punto.setAttribute('aria-hidden', 'true');
    punto.style.setProperty('--schulte-punto-largo', ajustes.punto);
    tableroEl.appendChild(punto);
  }

  function aplicarPunto(valor) {
    ajustes.punto = valor;
    [tableroEl, cfg && cfg.querySelector('.schulte-tablero')].forEach(function (caja) {
      if (!caja) return;
      caja.setAttribute('data-punto', valor === '0' ? '0' : '1');
      var punto = caja.querySelector('.schulte-punto');
      if (punto) punto.style.setProperty('--schulte-punto-largo', valor);
    });
  }

  function aplicarDesvanecer() {
    if (!tableroEl) return;
    var hechas = tableroEl.querySelectorAll('[data-estado="hecha"]');
    for (var i = 0; i < hechas.length; i++) {
      hechas[i].setAttribute('data-desvanecer', ajustes.desvanecer === 'on' ? '1' : '0');
    }
  }

  /* -------------------------------------------------------- la partida */

  /* LA TABLA QUE CABE. Una casilla nunca baja de 44 px (WCAG 2.5.8): si en esta
     pantalla no caben las casillas del tamano pedido, se baja de 5x5 a 4x4 (o
     a 3x3) y se avisa. No se guarda como ajuste: en otra pantalla, o girando
     el aparato, vuelve a salir la que se pidio. */
  var CASILLA_MIN = 44;

  function tamanoQueCabe(pedido) {
    var n = parseInt(String(pedido), 10) || 3;
    var caja = tableroEl && tableroEl.parentElement;
    var ancho = (caja && caja.clientWidth) || window.innerWidth || 1000;
    var alto = (window.innerHeight || 800) - 112;     // lo que ocupan la barra y el panel
    var lado = Math.min(ancho, alto);
    var hueco = 8;
    while (n > 3 && (lado - (n - 1) * hueco) / n < CASILLA_MIN) n--;
    return n + 'x' + n;
  }

  function nuevaPartida() {
    /* POR QUÉ ESTE ERROR DICE LO QUE DICE
     Un "no se pudo preparar el tablero" a secas deja a la persona sin saber qué
     hacer, y esta falla tiene una causa concreta y frecuente: el servidor que
     está corriendo es MÁS VIEJO que el código, y entonces no conoce la ruta.

     Y se reconoce por el código de respuesta: el servidor tiene una regla que
     sirve cualquier archivo, pero solo por GET. Una ruta que no existe en esa
     versión antigua cae en esa regla, y un POST encima da 405. Así que **404 y
     405 significan lo mismo aquí: hay que reiniciar el servidor**, y no es un
     problema del juego.

     Lo mismo pasó con los ejemplos: hasta que el servidor se levantó con la
     ruta nueva, la siembra no hizo nada en silencio. */
    var tamanoPedido = ajustes.tamano;
    return fetch(API + '/nueva', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tamano: tamanoPedido = tamanoQueCabe(ajustes.tamano), contenido: ajustes.contenido })
    }).then(function (r) {
      if (r.ok) return r.json();
      if (r.status === 404 || r.status === 405) {
        throw new Error('El servidor que está corriendo es más viejo que el juego. '
          + 'Ciérralo y abre servidor.cmd otra vez para que aparezca.');
      }
      throw new Error('El servidor no pudo preparar la tabla (error ' + r.status + ').');
    }).catch(function (e) {
      /* Si el fallo es de la red (el servidor está apagado, o no se alcanza),
         el mensaje de arriba no sirve de nada: se dice otra cosa. */
      if (e instanceof TypeError) {
        decir('No se pudo hablar con el servidor. ¿Está abierto?');
        return;
      }
      decir(e.message);
      avisar(e.message);
    }).then(function (d) {
      if (!d) return;
      tablero = d;
      esperados = d.orden;
      encontrados = 0;
      errores = 0;
      corriendo = false;
      empieza = 0;
      ocultoMs = 0;
      ocultoDesde = null;
      mensaje(tamanoPedido !== ajustes.tamano
        ? 'La pantalla es chica: se usa una tabla de ' + tamanoPedido + '.' : '');
      pintarTablero();
      pintar();
      avisar('Tablero de ' + d.columnas + ' por ' + d.filas + '. ' + fraseBuscar() +
             ' La primera casilla que toques empieza el reloj.');
    });
  }

  /* EL RELOJ ARRANCA CON EL PRIMER TOQUE, no al abrir la página. Puede pasar un
     rato antes de que alguien se decida, y contar ese rato sería medir la
     duda de la persona en vez de su vista. */
  function arrancarSiHaceFalta() {
    if (corriendo) return;
    corriendo = true;
    empieza = performance.now();
    ocultoMs = 0;
    ocultoDesde = null;
  }

  function tocar(id) {
        if (!tablero) return;
    var celda = tablero.celdas[id];
    if (!celda || celda.hecha) return;

    var esperado = esperados[encontrados];

    if (celda.valor === esperado) {
      arrancarSiHaceFalta();
      celda.hecha = true;
      encontrados++;
      var el = tableroEl.querySelector('[data-id="' + id + '"]');
      if (el) {
        el.setAttribute('data-estado', 'hecha');
        el.setAttribute('data-desvanecer', ajustes.desvanecer === 'on' ? '1' : '0');
        el.setAttribute('aria-label', 'Casilla ' + (id + 1) + ', ' +
                                       (celda.nombre ? celda.nombre : tablero.contenido + ' ' + celda.valor) + ', encontrada');
        el.tabIndex = -1;   // ya no es un objetivo: sale del recorrido del teclado
      }
      tocarSonido('acierto');
      if (mensajeEl && mensajeEl.getAttribute('data-tipo') === 'fallo') mensaje('');

      if (encontrados >= esperados.length) terminar();
      else {
        pintar();
        avisar('Muy bien. ' + fraseBuscar());
      }
    } else {
      /* AQUÍ NO SE HACE NADA. Ni color, ni sonido, ni temblor, ni reinicio.
         Solo se cuenta, y el dato sale al final. A propósito: la señal de error
         asusta más de lo que enseña, y desanima a quien ya le cuesta. */
      errores++;
      /* EL AVISO AL FALLAR (ajuste "Si te equivocas"): un mensaje neutro que
         dice que buscar ("Busca el 7"), sin rojo ni sonido; opcionalmente una
         sacudida suave de la casilla (no con movimiento reducido); o nada. */
      if (ajustes.fallo !== 'nada') {
        mensaje(fraseBuscar());
        if (mensajeEl) mensajeEl.setAttribute('data-tipo', 'fallo');
      }
      if (ajustes.fallo === 'sacudida') {
        var tocada = tableroEl.querySelector('[data-id="' + id + '"]');
        if (tocada) {
          tocada.classList.add('schulte-sacude');
          window.setTimeout(function () { tocada.classList.remove('schulte-sacude'); }, 320);
        }
      }
      avisar('Esa no era. ' + fraseBuscar());
    }
  }

  /* --------------------------------------------------------- el teclado */

  function enTeclado(evento) {
    if (!tablero) return;
    var celda = evento.target.closest && evento.target.closest('.schulte-celda');
    if (!celda) return;
    var id = Number(celda.getAttribute('data-id'));
    var columnas = tablero.columnas;
    var destino = null;

    if (evento.key === 'ArrowRight') destino = id + 1;
    else if (evento.key === 'ArrowLeft') destino = id - 1;
    else if (evento.key === 'ArrowDown') destino = id + columnas;
    else if (evento.key === 'ArrowUp') destino = id - columnas;
    if (destino === null) return;

    /* La flecha no sale de la rejilla ni salta de fila: de una fila a la
       siguiente se baja con la flecha de abajo, como en cualquier teclado. Si
       la flecha derecha envolviera, el tabulador llevaría a otro sitio sin
       querer. */
    if (destino < 0 || destino >= tablero.celdas.length) return;
    var cambioFila = (evento.key === 'ArrowUp' || evento.key === 'ArrowDown');
    if (!cambioFila && Math.floor(destino / columnas) !== Math.floor(id / columnas)) return;

    evento.preventDefault();
    var siguiente = tableroEl.querySelector('[data-id="' + destino + '"]');
    if (siguiente && siguiente.tabIndex !== -1) siguiente.focus();
  }

  /* --------------------------------------------------------- el final */

  function claveMejor() {
    return PREFIJO + 'mejor-' + (tablero ? tablero.tamano : ajustes.tamano) + '-' + ajustes.contenido;
  }

  function leerMejor() {
    return window.RetoDatos.obtener(claveMejor()).then(function (v) {
      return (v === null || v === undefined) ? null : Number(v);
    });
  }

  function guardarHistorial(tiempo) {
    var clave = PREFIJO + 'historial-' + (tablero ? tablero.tamano : ajustes.tamano) + '-' + ajustes.contenido;
    return window.RetoDatos.obtener(clave).then(function (v) {
      var lista = (v === null || v === undefined || !Array.isArray(v)) ? [] : v;
      lista.push(Number(tiempo.toFixed(2)));
      if (lista.length > CUANTAS_SE_GUARDAN) lista = lista.slice(-CUANTAS_SE_GUARDAN);
      return window.RetoDatos.poner(clave, lista).then(function () { return lista; });
    });
  }

  /* LA TENDENCIA. Lo que dice la investigación del juego es que una partida es
     un punto y lo que cuenta son varias. Así que se compara esta con el promedio
     de las últimas, y se dice en palabras llanas. Nunca "mal": solo más rápido
     o más lento. */
  function leerTendencia(lista, este) {
    if (lista.length < 2) return '';
    var previas = lista.slice(0, -1);
    var ventana = lista.length >= 4 ? lista.slice(-4, -1) : previas;
    var media = ventana.reduce(function (a, b) { return a + b; }, 0) / ventana.length;
    if (este < media - 0.15) return 'Vas más rápido que en tus últimas partidas.';
    if (este > media + 0.15) return 'Esta te salió más lenta que las últimas.';
    return 'Igual que tus últimas partidas.';
  }

  function terminar() {
    var tiempo = segundosFinales();
    corriendo = false;
    sesionMs += tiempo * 1000;
    volcarSesion();
    pintar();
    tocarSonido('final');

    Promise.all([leerMejor(), guardarHistorial(tiempo)]).then(function (r) {
      var mejorAntes = r[0];
      var lista = r[1];
      var nuevo = (mejorAntes === null || tiempo < mejorAntes);
      var seguir = nuevo
        ? window.RetoDatos.poner(claveMejor(), Number(tiempo.toFixed(2)))
        : Promise.resolve();
      return seguir.then(function () {
        return { lista: lista, mejor: nuevo ? tiempo : mejorAntes, nuevo: nuevo };
      });
    }).then(function (info) {
      var ultima = info.lista[info.lista.length - 1];
      var lineas = [];
      lineas.push('Buscaste ' + tablero.total + ' símbolos en ' + formatear(ultima) + '.');
      var tendencia = leerTendencia(info.lista, ultima);
      if (tendencia) lineas.push(tendencia);
      /* EL RÉCORD SOLO SI SE PIDIÓ. Con el ajuste apagado no sale ni en el
         texto ni en el anuncio: si no lo quiere, no lo ve. */
      if (ajustes.record === 'on') {
        lineas.push(info.nuevo ? 'Es tu mejor tiempo.' : 'Mejor: ' + formatear(info.mejor) + '.');
      }
      lineas.push('Errores: ' + errores + '.');

      var texto = lineas.join('\n');
      var items = [
        { texto: 'Jugar otra vez', valor: 'otra' },
        { texto: 'Cambiar ajustes', valor: 'config' },
        /* EL PUENTE A LA LECTURA: la razón de que este juego esté aquí. Dos o
           tres tablas antes de leer activan la atención visual y mejoran la
           lectura. Sin esto el juego quedaría suelto. */
        { texto: 'Ahora lee algo', valor: 'leer' }
      ];

      avisar((info.nuevo ? 'Tu mejor tiempo. ' : 'Terminaste. ') + texto);
      window.RetoDialogo.lista({
        titulo: info.nuevo ? '¡Tu mejor tiempo!' : '¡Terminaste!',
        texto: texto,
        items: items
      }).then(function (elegido) {
        if (elegido === 'otra') nuevaPartida();
        else if (elegido === 'config') abrirConfig();
        else if (elegido === 'leer') {
          window.location.href = '../../lectura-veloz/lectura-veloz.html';
        }
      });
    });
  }

  /* EL PROGRESO. Cada visita suma lo jugado y, cuando junta un minuto, avisa a
     RetoProgreso ({tipo: 'vision', ejercicio: 'schulte'}): el ejercicio ocular
     SI cuenta para el nivel de practica. Menos de un minuto no suma, para que
     entrar y salir no infle nada. */
  function volcarSesion() {
    var minutos = sesionMs / 60000;
    if (minutos < 1 || !window.RetoProgreso) return;
    sesionMs = 0;
    try {
      window.RetoProgreso.registrarSesion({ tipo: 'vision', ejercicio: 'schulte', minutos: minutos });
    } catch (e) {}
  }

  function segundosFinales() {
    return (performance.now() - empieza - tiempoOculto()) / 1000;
  }

  /* --------------------------------------------------------- el modal */

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  /* Un grupo del modal: el título, la explicación, y lo que sigue. Se usa el
     <fieldset> y el <legend> del sitio, que es como se agrupan los ajustes en
     todas las páginas de configuración. */
  function grupo(legenda, ayuda) {
    var fs = document.createElement('fieldset');
    fs.appendChild(el('legend', null, legenda));
    if (ayuda) fs.appendChild(el('p', 'ayuda', ayuda));
    cfg.appendChild(fs);
    return fs;
  }

/* EL CUADRITO DEL MODAL, PRIMERO DE TODO.
     Va antes que los ajustes, y no por adorno: es lo que se está mirando
     mientras se cambia algo. Si los ajustes van primero, hay que leerlos y
     después bajar a ver el efecto, y eso rompe el ir-y-ver.

     Es un tablero DE VERDAD, con las clases de la pantalla, así que lo que se ve
     aquí es lo que se ve jugando. Y como la letra, la fuente y los colores van
     al <html>, los HEREDA sin que nadie los copie: al mover una rueda, al
     cambiar la letra o al elegir otra fuente, el cuadrito se mueve en el mismo
     instante.

     Es un 3x3 aunque el juego esté en 5x5: un cuadrito de 25 casillas dentro
     de un modal se vuelve ilegible, y lo que se quiere es VER, no contar. Y
     lleva una casilla "encontrada" a propósito, para que se vea el verde y el
     desvanecido de verdad y no haya que imaginárselos. */
  function pintarCuadrito() {
    if (!cfg) return;
    var caja = cfg.querySelector('.schulte-cuadrito');
    if (!caja) return;
    while (caja.firstChild) caja.removeChild(caja.firstChild);

    var cajaSchulte = el('div', 'schulte');
    /* El cuadro se achica con este multiplicador, para que la letra grande no
       lo desborde dentro del dialogo. Es lo UNICO que cambia: la letra, la
       fuente y los colores los hereda tal cual. */
    cajaSchulte.style.setProperty('--schulte-largo', '0.7');

    var rejilla = el('div', 'schulte-tablero');
    rejilla.setAttribute('data-tamano', '3x3');
    rejilla.setAttribute('data-punto', ajustes.punto === '0' ? '0' : '1');
    rejilla.setAttribute('aria-hidden', 'true');

    var MUESTRAS = {
      letras: ['Q', 'M', 'Z', 'R', 'A', 'H', 'F', 'C', 'D'],
      emojis: ['🍎', '🐱', '🚗', '🍌', '🌻', '🐟', '🎈', '🔑', '🏠'],
      colores: ['▲', '●', '■', '◆', '★', '✚', '▼', '▲', '●'],
      numeros: ['14', '3', '9', '21', '1', '17', '6', '11', '8']
    };
    var valores = MUESTRAS[ajustes.contenido] || MUESTRAS.numeros;
    valores.forEach(function (v, i) {
      var celda = el('div', 'schulte-celda', v);
      if (ajustes.contenido === 'colores') celda.setAttribute('data-color', 'c' + (i % 4 + 1));
      if (i === 4) {
        celda.setAttribute('data-estado', 'hecha');
        celda.setAttribute('data-desvanecer', ajustes.desvanecer === 'on' ? '1' : '0');
      }
      rejilla.appendChild(celda);
    });
    var punto = el('span', 'schulte-punto');
    punto.style.setProperty('--schulte-punto-largo', ajustes.punto);
    rejilla.appendChild(punto);
    cajaSchulte.appendChild(rejilla);
    caja.appendChild(cajaSchulte);
  }

  function opcionRadio(nombre, valor, texto, elegido, alCambiar) {
    var op = el('label', 'opcion');
    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = nombre;
    radio.value = valor;
    if (valor === elegido) radio.checked = true;
    radio.addEventListener('change', function () {
      if (!this.checked) return;
      alCambiar(valor);
    });
    op.appendChild(radio);
    op.appendChild(el('span', null, texto));
    return op;
  }

  function interruptor(clave, texto, explicacion, alCambiar) {
    var label = el('label', 'interruptor');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = ajustes[clave] === 'on';
    var caja = el('span', 'interruptor-caja');
    caja.setAttribute('aria-hidden', 'true');
    var rotulo = el('span', 'interruptor-texto', texto);
    rotulo.appendChild(el('span', 'ayuda', explicacion));
    input.addEventListener('change', function () {
      var v = this.checked ? 'on' : 'off';
      guardarAjuste(clave, v).then(function () {
        if (alCambiar) alCambiar(v);
      });
    });
    label.appendChild(input);
    label.appendChild(caja);
    label.appendChild(rotulo);
    return label;
  }

/* UN CAMPO DE COLOR, IGUAL QUE EN LOS MODOS DE LECTURA.
     Se copia el mismo camino: un `.ajustes-campo` con su etiqueta, y adentro
     una fila con la rueda y el campo de hexadecimal. Las clases son las del
     modal de lectura (`ajustes-color-fila`, `ajustes-color-rueda`,
     `ajustes-color-hex`), para que el campo se vea igual en todos los modos y
     no haya dosecer de lo mismo.

     El campo de hexadecimal existe para dos cosas: escribir un color copiado de
     otra parte, y **dejarlo vacío para volver al del tema**. Con solo la rueda
     no hay forma de volver, porque la rueda siempre tiene un color. */
  function filaColor(clave, titulo) {
    var campo = el('div', 'ajustes-campo');
    var id = 'ajustes-color-' + clave;
    var etiqueta = el('label', '', titulo);
    etiqueta.setAttribute('for', id);
    campo.appendChild(etiqueta);

    var fila = el('div', 'ajustes-color-fila');

    var rueda = el('input', 'ajustes-color-rueda');
    rueda.type = 'color';
    rueda.id = id;
    rueda.value = colores[clave] || '#ffffff';

    var hex = el('input', 'editor-campo ajustes-color-hex');
    hex.type = 'text';
    hex.maxLength = 7;
    hex.spellcheck = false;
    hex.value = colores[clave];
    hex.placeholder = 'del tema';
    hex.setAttribute('aria-label', titulo + ' en código hexadecimal');

    function cambia(v) {
      var valor = (v === '' || v === null) ? '' : String(v).trim().toLowerCase();
      /* Se ignora lo que no sea un hexadecimal de seis. Un campo de texto donde
         se puede escribir cualquier cosa necesita decir que no: sin esto, un
         "#ff" mal escrito se guarda y el color se rompe en silencio. */
      if (valor && !/^#[0-9a-f]{6}$/.test(valor)) return;
      rueda.value = valor || '#ffffff';
      hex.value = valor;
      guardarColor(clave, valor);
    }
    rueda.addEventListener('input', function () { cambia(this.value); });
    hex.addEventListener('change', function () { cambia(this.value); });

    fila.appendChild(rueda);
    fila.appendChild(hex);
    campo.appendChild(fila);
    return campo;
  }

/* --------------------------------------------------------- el modal

     El orden de las secciones es el de este bloque, y está pensado de arriba
     hacia abajo: primero el cuadrito (lo que se está mirando), después lo que
     cambia el juego, después lo que cambia cómo se ve, y al final los colores.

     TODO SE APLICA AL MOMENTO. El tamaño y el contenido piden una tabla nueva al
     servidor (no hay forma de scientearlo: el tablero está mezclado). Los
     colores, la letra, la fuente, el punto y el desvanecido se aplican sin
     pedir nada, porque son variables CSS en <html> que el tablero y el cuadrito
     heredan. */
  function armarConfig() {
    if (cfg) return;
    cfg = document.createElement('dialog');
    cfg.className = 'dialogo schulte-config';
    cfg.setAttribute('aria-labelledby', 'schulte-cfg-titulo');

    var titulo = el('h2', 'dialogo-titulo', 'Ajustes de Schulte');
    titulo.id = 'schulte-cfg-titulo';
    cfg.appendChild(titulo);

    /* EL CUADRITO, PRIMERO. Este es el contenedor vacio; lo pinta
       pintarCuadrito(), que se llama cada vez que cambia algo. */
    var hueco = el('div', 'schulte-cuadrito');
    cfg.appendChild(hueco);

    /* --- la tabla */
    var gTabla = grupo('La tabla',
      'Tres por tres para empezar. Cinco por cinco es la clásica, y con letras '
      + 'el ejercicio es el mismo.');
    var ops = el('div', 'opciones');
    ops.setAttribute('role', 'radiogroup');
    ['3x3', '4x4', '5x5'].forEach(function (t) {
      ops.appendChild(opcionRadio('schulte-tamano', t, t, ajustes.tamano, function (v) {
        guardarAjuste('tamano', v).then(function () {
          pintarCuadrito();
          return nuevaPartida();
        });
      }));
    });
    gTabla.appendChild(ops);

    var ops2 = el('div', 'opciones');
    ops2.setAttribute('role', 'radiogroup');
    [['numeros', 'Números'], ['letras', 'Letras'], ['emojis', 'Dibujos'], ['colores', 'Colores con forma']].forEach(function (par) {
      ops2.appendChild(opcionRadio('schulte-contenido', par[0], par[1],
                                   ajustes.contenido, function (v) {
        guardarAjuste('contenido', v).then(function () {
          pintarCuadrito();
          return nuevaPartida();
        });
      }));
    });
    gTabla.appendChild(ops2);

    /* --- el punto */
    var gPunto = grupo('El punto del centro',
      'Es el ancla de la mirada: la vista se queda ahí y los símbolos se buscan '
      + 'de reojo. Agrándalo si no lo distingues.');
    var filaPunto = el('div', 'rango-lectura');
    var rango = document.createElement('input');
    rango.type = 'range';
    rango.className = 'rango';
    rango.min = '0';
    rango.max = '3';
    rango.step = '1';
    rango.value = ajustes.punto;
    var salida = el('output', 'rango-valor', ajustes.punto === '0' ? 'ninguno' : ajustes.punto);
    rango.addEventListener('input', function () {
      aplicarPunto(this.value);
      salida.textContent = this.value === '0' ? 'ninguno' : this.value;
      pintarCuadrito();
    });
    rango.addEventListener('change', function () {
      guardarAjuste('punto', this.value).then(pintarCuadrito);
    });
    filaPunto.appendChild(rango);
    filaPunto.appendChild(salida);
    gPunto.appendChild(filaPunto);

    /* --- el comportamiento */
    var gComportamiento = grupo('Comportamiento',
      'El tiempo siempre se mide: el interruptor solo decide si se ve.');
    gComportamiento.appendChild(interruptor('reloj', 'Ver el cronómetro',
      'Si te distrae, apagado. Se puede volver a prender cuando quieras.',
      pintarReloj));
    gComportamiento.appendChild(interruptor('desvanecer', 'Vaciar la casilla al acertar',
      'La casilla se queda vacía y se ve cómo se va llenando la tabla. Si lo '
      + 'apasgas, la casilla se queda con su número.',
      function () { aplicarDesvanecer(); pintarCuadrito(); }));
    gComportamiento.appendChild(interruptor('record', 'Mostrar también el récord',
      'Tu mejor tiempo en este tamaño y con estos símbolos. Apagado sale el '
      + 'tiempo y la tendencia, que es lo que de verdad sirve.'));

    /* --- si te equivocas */
    var gFallo = grupo('Si te equivocas',
      'Nunca hay castigo. Elige si quieres un recordatorio de qué buscar.');
    var opsFallo = el('div', 'opciones');
    opsFallo.setAttribute('role', 'radiogroup');
    [['mensaje', 'Solo un mensaje'], ['sacudida', 'Mensaje y sacudida suave'], ['nada', 'Nada']].forEach(function (par) {
      opsFallo.appendChild(opcionRadio('schulte-fallo', par[0], par[1], ajustes.fallo, function (v) {
        guardarAjuste('fallo', v);
      }));
    });
    gFallo.appendChild(opsFallo);

    /* --- la letra: el tamaño y la fuente */
    var gLetra = grupo('La letra',
      'El tamaño y la fuente de los números o las letras de la tabla.');
    var opsLetra = el('div', 'opciones');
    opsLetra.setAttribute('role', 'radiogroup');
    LETRAS.forEach(function (l) {
      opsLetra.appendChild(opcionRadio('schulte-letra', l.id, l.nombre,
                                       ajustes.letra, function (v) {
        guardarAjuste('letra', v).then(function () {
          aplicarForma();
          pintarCuadrito();
        });
      }));
    });
    gLetra.appendChild(opsLetra);

    /* La fuente. Se usan las MISMAS fuentes del sitio y el mismo botón de
       instalar, para que no haya dos listas de fuentes que se puedan
       desincronizar. */
    var filaFuente = el('div', 'ajustes-fuente-fila');
    var select = document.createElement('select');
    select.className = 'editor-campo';
    var labelFuente = el('label', 'oculto-a-la-vista', 'Fuente de la tabla');
    labelFuente.setAttribute('for', 'schulte-fuente');
    filaFuente.appendChild(labelFuente);
    filaFuente.appendChild(select);
    var instalar = el('button', 'boton', 'Instalar una fuente');
    instalar.type = 'button';
    filaFuente.appendChild(instalar);
    gLetra.appendChild(filaFuente);

    var archivo = document.createElement('input');
    archivo.type = 'file';
    archivo.accept = '.woff2,.woff,.ttf,.otf';
    archivo.hidden = true;
    archivo.setAttribute('aria-label', 'Elegir un archivo de fuente');
    gLetra.appendChild(archivo);

    /* --- el sonido */
    var gSonido = grupo('El sonido',
      'El aviso corto al acertar y el de cuando terminas. Si en Configuración '
      + '→ Sonido está apagado, aquí no se oye nada.');
gSonido.appendChild(interruptor('sonido', 'Activar el sonido',
      'Con esto apagado, el juego no suena. El interruptor general del sitio '
      + 'también manda y apaga todo.'));
    gSonido.appendChild(menuSonido('sonidoAcierto', 'Al acertar'));
    gSonido.appendChild(menuSonido('sonidoFinal', 'Al terminar'));

    /* EL VOLUMEN, CON UN DESLIZADOR.
       Antes eran cuatro botones y se cambió a deslizador porque seeka más
       fácil: con cuatro botones hay que decidir el 50 y el 75 de memoria, y con
       un deslizador la persona lo ve mientras lo mueve. El deslizador tiene
       CUATRO(topes, no Continuo: 25, 50, 75 y 100. Un volumen continuo invites
       a pararlo en un 63 % que nadie quiere, y lo que hay entre topes no sirve
       para nada. */
    gSonido.appendChild(el('p', 'editor-label', 'Volumen'));
    var filaVolumen = el('div', 'rango-lectura');
    var rangoVol = document.createElement('input');
    rangoVol.type = 'range';
    rangoVol.className = 'rango';
    rangoVol.min = '25';
    rangoVol.max = '100';
    rangoVol.step = '25';
    rangoVol.value = ajustes.volumen;
    var salidaVol = el('output', 'rango-valor', ajustes.volumen + ' %');
    rangoVol.addEventListener('input', function () {
      salidaVol.textContent = this.value + ' %';
      ajustes.volumen = this.value;
      /* Se oye mientras se mueve: un volumen no se ve, se oye. */
      tocarSonido('acierto');
    });
    rangoVol.addEventListener('change', function () {
      guardarAjuste('volumen', this.value);
    });
    filaVolumen.appendChild(rangoVol);
    filaVolumen.appendChild(salidaVol);
    gSonido.appendChild(filaVolumen);

    /* --- los colores: SOLO el fondo y el texto, como en el galáctico */
    var gColores = grupo('Colores',
      'Un color vacío es el color del tema. El verde con el que se marcan las '
      + 'casillas es del tema en los cinco, y no se cambia.');
    gColores.appendChild(filaColor('fondo', 'Fondo de la tabla'));
    gColores.appendChild(filaColor('texto', 'Color de los números'));

    /* --- los botones */
    var acciones = el('div', 'dialogo-acciones');
    var listo = el('button', 'boton boton--principal', 'Listo');
    listo.type = 'button';
    listo.addEventListener('click', function () { cfg.close(); });
    acciones.appendChild(listo);
    cfg.appendChild(acciones);

    cfg.addEventListener('close', function () { cfgAbierto = false; });
    document.body.appendChild(cfg);

    /* La lista de fuentes se pide DESPUÉS de colgar el diálogo, porque cada
       fuente tiene que pintar su nombre con SU letra, y para eso el <select> ya
       tiene que estar en la página. */
    pintarListaFuentes(select);
    instalar.addEventListener('click', function () { archivo.click(); });
    archivo.addEventListener('change', function () {
      if (!this.files || !this.files[0] || !window.RetoFuentes) return;
      window.RetoFuentes.instalar(this.files[0]).then(function (nueva) {
        this.value = '';
        return pintarListaFuentes(select).then(function () {
          guardarAjuste('fuente', nueva.id).then(function () {
            aplicarForma();
            pintarCuadrito();
            decir('Fuente instalada: ' + nueva.nombre);
          });
        });
      }.bind(this)).catch(function (e) {
        this.value = '';
        decir(e.message);
      }.bind(this));
    });
  }

/* EL MENÚ DE UN SONIDO. Es un <select>, no botones: son tres opciones con
     nombre largo (Charm, Suave) y en un celular angosto tres botones largos se
     salen del diálogo. Con un menú desplegable caben siempre, y además se puede
     elegir con el teclado, sin que se salga de la pantalla.

     Al cambiar SUENA, porque un sonido no se ve: sin esto habría que escogerlo
     a ciegas y no habría forma de saber si ese es el que quiere. */
  function menuSonido(clave, cuando) {
    var caja = el('div', 'ajustes-sonido');
    var id = 'schulte-' + clave;
    var etiqueta = el('label', 'editor-label', cuando);
    etiqueta.setAttribute('for', id);
    caja.appendChild(etiqueta);

    var select = document.createElement('select');
    select.className = 'editor-campo';
    select.id = id;
    SONIDOS.forEach(function (s) {
      var op = el('option', '', s.nombre);
      op.value = s.id;
      if (s.id === ajustes[clave]) op.selected = true;
      select.appendChild(op);
    });
    select.addEventListener('change', function () {
      guardarAjuste(clave, this.value).then(function () { tocarSonido('final'); });
    });
    caja.appendChild(select);
    return caja;
  }

  /* La lista de fuentes del sitio, en un <select>. Cada opción se pinta con SU
     PROPIA letra, para que se vea cómo queda antes de elegirla. */
  function pintarListaFuentes(select) {
    if (!window.RetoFuentes) return Promise.resolve();
    return window.RetoFuentes.lista().then(function (todas) {
      while (select.firstChild) select.removeChild(select.firstChild);
      todas.forEach(function (f) {
        var op = el('option', '', f.nombre);
        op.value = f.id;
        op.style.fontFamily = '"' + f.id + '", sans-serif';
        if (f.id === ajustes.fuente) op.selected = true;
        select.appendChild(op);
      });
    });
  }

  function abrirConfig() {
    if (!cfg) armarConfig();
    pintarCuadrito();
    cfg.showModal();
    cfgAbierto = true;
    var primero = cfg.querySelector('input, button');
    if (primero) primero.focus();
  }

  function cerrarConfig() {
    cfgAbierto = false;
  }

  /* ------------------------------------------------------------- arranque */

  function iniciar() {
    tableroEl = document.getElementById('tablero');
    mensajeEl = document.getElementById('mensaje');
    lectorEl = document.getElementById('lector');
    relojEl = document.getElementById('reloj');
    cuentasEl = document.getElementById('cuentas');
    rellenoEl = document.getElementById('avance');
    if (!tableroEl || !window.RetoDatos || !window.RetoDialogo) return;

    tableroEl.addEventListener('click', function (e) {
      var celda = e.target.closest && e.target.closest('.schulte-celda');
      if (!celda || celda.getAttribute('data-estado') === 'hecha') return;
      tocar(Number(celda.getAttribute('data-id')));
    });
    tableroEl.addEventListener('keydown', enTeclado);

    if (document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          if (corriendo && ocultoDesde === null) ocultoDesde = performance.now();
        } else if (ocultoDesde !== null) {
          ocultoMs += performance.now() - ocultoDesde;
          ocultoDesde = null;
        }
      });
    }
    if (window.addEventListener) {
      window.addEventListener('pagehide', function () {
        if (corriendo) sesionMs += segundos() * 1000;
        volcarSesion();
      });
    }
    objetivoEl = document.getElementById('objetivo');

    var btnConfig = document.querySelector('[data-configurar]');
    if (btnConfig) btnConfig.addEventListener('click', abrirConfig);

    var btnReinicio = document.querySelector('[data-reiniciar]');
    if (btnReinicio) btnReinicio.addEventListener('click', nuevaPartida);

    var btnAyuda = document.querySelector('[data-ayuda]');
    if (btnAyuda) {
      btnAyuda.addEventListener('click', function () {
        window.RetoDialogo.informar({
          titulo: 'Cómo se juega',
          texto: 'Toca los símbolos en orden, del primero al último.\n\n'
            + 'El punto del centro es el ancla: deja la mirada ahí y busca de reojo, '
            + 'sin recorrer la tabla con los ojos. Si te equivocas no pasa nada.\n\n'
            + 'El reloj se apaga con un interruptor, por si te distrae. Y con las '
            + 'flechas del teclado también se juega.'
        });
      });
    }

    /* El reloj se refresca solo mientras corre, para no depender de que alguien
       toque algo. Se para en cuanto termina la tabla. */
    window.setInterval(function () {
      if (corriendo && ajustes.reloj === 'on') pintarReloj();
    }, 100);

cargarAjustes().then(function () {
      aplicarColores();
      aplicarForma();
      /* Los sonidos se descargan al entrar, y no al primer acierto: si se
         descargaran al tocar, el primer aviso tardaría y se oiría tarde. */
      if (window.RetoSonido && window.RetoSonido.precargar) window.RetoSonido.precargar();
      return nuevaPartida();
    });
  }

    document.addEventListener('DOMContentLoaded', iniciar);
})(window);