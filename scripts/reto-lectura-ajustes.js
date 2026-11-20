/* =========================================================================
   R.E.T.O. - El modal de ajustes de los modos de lectura
   -------------------------------------------------------------------------
   Se abre con el boton de los controles deslizantes del panel. Tiene dos
   variantes segun el motor activo:

   GALACTICO:
     - cuatro ajustes de forma del trapecio (ancho de la base, ancho del
       techo, rotacion en X, interlineado);
     - dos colores en una fila de dos columnas: fondo y texto;
     - la fuente, en una fila de dos columnas: la lista desplegable a la
       izquierda, el boton de instalar a la derecha;
     - una vista previa con el mismo escenario del modo.

   PALABRA POR PALABRA:
     - interlineado (1 a 2);
     - tres colores en una fila de tres columnas: fondo, texto principal,
       color del foco;
     - la fuente, en una fila de dos columnas: la lista desplegable a la
       izquierda, el boton de instalar a la derecha;
     - una vista previa con la misma linea del modo (palabra con foco).

   QUE ES DE QUIEN
   El estado vive en reto-lectura.js (window.RetoLectura). Aqui solo se pinta
   y se pide. Los limites de cada slider vienen de RetoLectura.obtener().ajustes:
   este archivo no tiene ni un numero de esos copiado.

   MIENTRAS ESTA ABIERTO
   La lectura se para (suspender) y se reanuda al cerrar SOLO si estaba
   corriendo.

   CUANDO SE GUARDA
   Los sliders se ven en la vista previa mientras se arrastran ("input") y se
   aplican y guardan al soltar ("change"): aplicar en cada pixel del arrastre
   volveria a medir el texto entero cientos de veces por segundo.
   ========================================================================= */
(function () {
  'use strict';

  var boton = document.querySelector('[data-ajustes]');
  if (!boton) return;

  var dlg = null;
  var refs = {};
  var reanudar = null;
  var abriendo = false;
  var motorActual = null;   // 'galactico' | 'palabra'

  var FRASES = [
    'Hace mucho tiempo,', 'en una galaxia', 'muy, muy lejana,', 'un texto se puso',
    'en marcha hacia', 'el horizonte', 'mientras alguien', 'lo leia sin parar.',
    'Las letras entran', 'grandes por abajo', 'y se van achicando', 'camino de un punto',
    'donde ya nadie', 'las puede ver.', 'Asi se pierde', 'una historia',
    'en el fondo', 'del espacio.'
  ];

  /* ----------------------------------------------------------- utilidades */

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function limpiar(e) { while (e.firstChild) e.removeChild(e.firstChild); }

  function decir(texto, error) {
    refs.estado.textContent = texto || '';
    refs.estado.className = 'ajustes-estado' + (error ? ' es-error' : '');
  }

  /* ---------------------------------------------------------- armar el modal */

  function campoAjuste(clave, titulo, ayuda, sufijo) {
    var campo = el('div', 'ajustes-campo');
    var id = 'ajustes-' + clave;
    var etiqueta = el('label', '', titulo);
    etiqueta.setAttribute('for', id);
    var fila = el('div', 'ajustes-fila');
    var rango = el('input', 'rango');
    rango.type = 'range';
    rango.id = id;
    var valor = el('output', 'rango-valor');
    valor.setAttribute('for', id);
    fila.appendChild(rango);
    fila.appendChild(valor);
    campo.appendChild(etiqueta);
    campo.appendChild(fila);
    var p = el('p', 'ajustes-ayuda', ayuda);
    p.id = id + '-ayuda';
    rango.setAttribute('aria-describedby', p.id);
    campo.appendChild(p);
    refs[clave] = rango;
    refs[clave + 'Valor'] = valor;
    refs[clave + 'Sufijo'] = sufijo || '';
    return campo;
  }

  /* Un campo de color con DOS formas de elegirlo, la rueda y el hex, porque
     no todos los colores se eligen igual: a veces se sabe el codigo exacto
     (para copiarlo de otra parte) y otras se quiere probar a ojo. Las dos
     formas escriben el MISMO color: la rueda al cambiarla, el texto al salir
     del campo (change), para no pelear cuando se esta escribiendo. */
  function campoColor(clave, titulo) {
    var campo = el('div', 'ajustes-campo');
    var id = 'ajustes-color-' + clave;
    var etiqueta = el('label', '', titulo);
    etiqueta.setAttribute('for', id);
    campo.appendChild(etiqueta);

    var fila = el('div', 'ajustes-color-fila');

    var rueda = el('input', 'ajustes-color-rueda');
    rueda.type = 'color';
    rueda.id = id;

    var hex = el('input', 'editor-campo ajustes-color-hex');
    hex.type = 'text';
    hex.maxLength = 7;
    hex.spellcheck = false;
    hex.setAttribute('aria-label', titulo + ' en codigo hexadecimal');

    fila.appendChild(rueda);
    fila.appendChild(hex);
    campo.appendChild(fila);

    refs['color_' + clave] = rueda;
    refs['color_' + clave + '_hex'] = hex;
    return campo;
  }

  /* EL TITULO DEL MODAL, QUE CAMBIA CON EL MODO.
     El boton se llama igual en los dos modos, pero lo que se ajusta no es lo
     mismo: en el galactico es la forma de la escena, y en el palabra por
     palabra son los colores y el interlineado. */
  var TITULOS = {
    galactico: 'Ajustes de la animación',
    palabra:   'Ajustes de la lectura',
    grupo:     'Ajustes de la lectura',
    frases:    'Ajustes de la lectura'
  };

  /* LOS SLIDERS DEL MODAL, EN UNA TABLA.
     Cada uno con el nombre de su ajuste en el estado y la tabla donde estan sus
     limites. Los limites los pone reto-lectura.js, y aqui no hay ni un numero
     copiado.

     Esta tabla es la que hace que un modo nuevo no se olvide: los listeners y
     los limites se cuelgan de las claves que estan aqui, no de una lista
     escrita a mano que hay que ampliar cada vez. Cuando se agrego el
     interlineado de frases, lo unico que hubo que hacer fue escribir su fila.

     ESTA ARRIBA DEL ARCHIVO, y no junto a donde se usan, a proposito: la usan
     armar() y sincronizar(), que son funciones distintas. Su primer versión
     estaba dentro de armar(), y ahi la veia armar() pero no sincronizar(): al
     abrir el modal salia "SLIDERS is not defined" y no se abria nada. Un
     `node --check` no dice nada de eso, porque es un error de alcance, no de
     sintaxis. */
  var SLIDERS = {
    anchoBase:          { valor: 'anchoBase',          ajuste: 'anchoBase',    tabla: 'ajustes' },
    anchoTecho:         { valor: 'anchoTecho',         ajuste: 'anchoTecho',   tabla: 'ajustes' },
    angulo:             { valor: 'angulo',             ajuste: 'angulo',       tabla: 'ajustes' },
    interlineado:       { valor: 'interlineado',       ajuste: 'interlineado', tabla: 'ajustes' },
    frasesInterlineado: { valor: 'frasesInterlineado', ajuste: 'interlineado', tabla: 'ajustesFrases' }
  };

  /* Los diez campos de color del modal: dos del galactico (que tienen nombre
     corto porque son suyos) y ocho de los otros tres modos. Los nombres van
     escritos y completos, porque "palabraFondo" y "grupoFondo" se parecen lo
     suficiente como para que un prefijo recortado sea un error esperando a
     pasar. */
  var COLORES_MODAL = ['fondo', 'texto',
                       'palabraFondo', 'palabraTexto', 'palabraFoco',
                       'grupoFondo', 'grupoTexto', 'grupoFoco',
                       'frasesFondo', 'frasesTexto'];

  /* LA FUENTE ELEGIDA, EN LAS CUATRO VISTAS PREVIAS.
     Las cuatro son del mismo sitio, asi que los cuatro cuadritos tienen que
     enseñar la misma tipografía que se va a ver en la pantalla. Se recorre la
     tabla de vistas en vez de escribir cuatro lineas: con cuatro a mano, el día
     que haya un quinto modo hay que acordarse de añadirlo otra vez.

     Va arriba del archivo, y no junto a donde se usa, por lo mismo que
     SLIDERS: la usan armar() y pintarLista(), que son funciones distintas. Su
     primera version estaba dentro de armar() y ahi la veia armar() pero no
     pintarLista(), que se llamaba al abrir el modal: el resultado era que
     "showModal" no llegaba a ejecutarse y el boton no hacia nada. */
  function ponerFuenteEnLasVistas(css) {
    Object.keys(refs.vistas).forEach(function (m) {
      refs.vistas[m].style.setProperty('--lectura-fuente', css);
    });
  }

  /* QUE BLOQUE ES DE CADA MODO. Se recorre en mostrarBloque() para enseñar uno
     y esconder los demas. Los nombres van escritos: son cuatro, y si uno se
     queda fuera el modal ensena lo de otro modo. */
  var BLOQUES = {
    galactico: 'bloqueGal',
    palabra:   'bloquePal',
    grupo:     'bloqueGrupo',
    frases:    'bloqueFrases'
  };

  /* EL CONTROL QUE RECIBE EL FOCO AL ABRIR, en el orden en que esta escrito el
     bloque de cada modo. Se escribe como una lista de NOMBRES porque `refs`
     todavia esta vacio mientras se arma el modal: se resuelven al abrir. */
  var FOCO_INICIAL = {
    galactico: ['anchoBase'],
    palabra:   ['color_palabraFondo'],
    grupo:     ['color_grupoFondo'],
    frases:    ['frasesInterlineado']
  };

  function armar() {
    dlg = el('dialog', 'dialogo dialogo-ajustes');
    dlg.setAttribute('aria-labelledby', 'ajustes-titulo');

    var titulo = el('h2', 'dialogo-titulo', 'Ajustes');
    titulo.id = 'ajustes-titulo';
    dlg.appendChild(titulo);
    refs.titulo = titulo;

    /* Las dos vistas previas se arman UNA vez y se enseñan y se esconden segun
       el modo. Es la misma idea que en la pantalla real: el cuadrito del modal
       reusa las clases del motor (.galactico-*, .palabra-*), para que lo que se
       ve aqui sea lo que se ve alla y no una aproximacion. */
    var vistaGal = el('div', 'ajustes-vista ajustes-vista--galactico');
    vistaGal.setAttribute('aria-hidden', 'true');
    var escena = el('div', 'galactico-escena');
    var plano = el('div', 'galactico-plano');
    var texto = el('div', 'galactico-texto');
    FRASES.forEach(function (f) { texto.appendChild(el('p', '', f)); });
    plano.appendChild(texto);
    escena.appendChild(plano);
    vistaGal.appendChild(escena);
    dlg.appendChild(vistaGal);

    /* La vista previa del palabra por palabra: la misma linea de tres pedazos
       que la pantalla real (antes, foco, despues), para que se vea de verdad
       donde va la letra que se resalta.

       LA PALABRA ES "Configuración", y la letra de fijacion es la "f". No es
       un capricho: la cuenta sale de la misma regla de Python
       (punto_de_fijacion, en logica/lectura_veloz.py) que usa la lectura de
       verdad. La palabra sin signos tiene 13 letras, y de 10 a 13 la fijacion
       cae en la cuarta, que es la "f". Si un dia cambia esa regla, el cuadrito
       tiene que cambiar con ella, o el preview estaria enseñando una letra que
       la pantalla real nunca pondria.

       Y es una palabra larga, con tilde y con ie: es la que hace ver los dos
       problemas que con una palabra corta nunca salen — que la palabra no
       cabe en el ancho del modal, y que el acento se lee bien. Un preview con
       "LECTURA" no enseña nada de eso. */
    var vistaPal = el('div', 'ajustes-vista ajustes-vista--palabra');
    vistaPal.setAttribute('aria-hidden', 'true');
    var pEscena = el('div', 'palabra-escena');
    /* El cuadrito se pone en fase "lee" a proposito. Fuera de esa fase, el CSS
       esconde la linea (visibility: hidden) para que el marco no cambie de alto
       al pasar de la cuenta a la primera palabra. El cuadrito no tiene marco ni
       cuenta: enseña la palabra como si ya se estuviera leyendo, y sin este
       atributo la palabra salia invisible. Es el mismo motivo por el que la
       linea se esconde con "visibility" y no con "display": aqui no hay alto
       que conservar, solo la palabra que hay que ver. */
    pEscena.setAttribute('data-fase', 'lee');
    var pLinea = el('p', 'palabra-linea');
    var pAntes = el('span', 'palabra-antes');
    var pFoco = el('span', 'palabra-foco');
    var pDespues = el('span', 'palabra-despues');
    /* LAS DOS PALABRAS DEL CUADRITO, Y CUAL SE USA.

       La primera es "Configuración": es larga, lleva tilde y eso es justo lo que
       un cuadrito de ajuste tiene que enseñar — que la palabra es larga y que
       el acento se lee bien. Un "LECTURA" no enseñaba nada de eso.

       Pero si no cabe en el ancho del modal (una pantalla muy angosta, o la
       letra muy grande), se cambia por "Preview", que es más corta y sigue
       cumpliendo lo mismo: una palabra con su letra de fijación, para ver de
       dónde a dónde va lo que se resalta. La palabra corta también lleva su
       letra de fijación por la misma regla: "Preview" tiene siete letras y de
       seis a nueve la fijación cae en la tercera, que es la "e".

       Se decide midiendo: si lo que ocupa la línea es más ancho que el cuadro,
       se cambia. No a ojo. */
    var PALABRA_LARGA = { antes: 'Con', foco: 'f', despues: 'iguración' };
    var PALABRA_CORTA = { antes: 'Pr',  foco: 'e', despues: 'view' };

    refs.antesPal = pAntes;
    refs.focoPal = pFoco;
    refs.despuesPal = pDespues;
    refs.lineaPal = pLinea;
    pLinea.appendChild(pAntes);
    pLinea.appendChild(pFoco);
    pLinea.appendChild(pDespues);
    pEscena.appendChild(pLinea);
    vistaPal.appendChild(pEscena);
    dlg.appendChild(vistaPal);

    /* La vista previa del MODO GRUPO. Reusa las clases de la pantalla real, y
       por eso el cuadrito enseña la cosa que hay que ver en este modo: COMO SE
       VE LA PALABRA FIJADA. Se pone un grupo de tres palabras con su ORP en la
       del medio (la nitida, la unica sin desenfoque) y las otras dos con su
       desenfoque, que es lo que distingue este modo de palabra por palabra. */
    var vistaGrupo = el('div', 'ajustes-vista ajustes-vista--grupo');
    vistaGrupo.setAttribute('aria-hidden', 'true');
    var gEscena = el('div', 'grupo-escena');
    gEscena.setAttribute('data-fase', 'lee');   // fuera de esta fase la linea se esconde
    var gLinea = el('p', 'grupo-linea');
    ['lectura', 'rápida', 'ahora'].forEach(function (txt, i) {
      var s = el('span', 'grupo-palabra', txt);
      s.className = 'grupo-palabra ' + (i === 1 ? 'orp' : (i === 0 ? 'cerca' : 'lejos'));
      gLinea.appendChild(s);
    });
    gEscena.appendChild(gLinea);
    vistaGrupo.appendChild(gEscena);
    dlg.appendChild(vistaGrupo);

    /* La vista previa del MODO FRASES. Aqui lo que hay que ver es el TEXTO
       LARGO y el interlineado, asi que el cuadrito lleva una oracion entera
       (no una palabra), con las clases de la pantalla. La frase es larga a
       proposito: es lo que hace ver si el interlineado apretado junta las lineas
       y si las palabras separadas se siguen distinguiendo. */
    var vistaFrases = el('div', 'ajustes-vista ajustes-vista--frases');
    vistaFrases.setAttribute('aria-hidden', 'true');
    var fEscena = el('div', 'frases-escena');
    var fTexto = el('p', 'frases-texto',
      'La lectura rápida se entrena leyendo, y no con atajos.');
    fTexto.setAttribute('aria-hidden', 'true');
    fEscena.appendChild(fTexto);
    vistaFrases.appendChild(fEscena);
    dlg.appendChild(vistaFrases);

    refs.escena = escena; refs.plano = plano; refs.texto = texto;
    refs.vistaPalabra = vistaPal;
    refs.vistaGrupo = vistaGrupo;
    refs.vistaFrases = vistaFrases;

    /* LAS CUATRO VISTAS, EN UNA TABLA.
       Se arman una vez y se enseñan o se esconden segun el modo (ver
       mostrarBloque). La tabla es para no repetir el mismo "if" en tres sitios:
       la fuente se pone en todas, mostrarBloque esconde una, y pintarVista
       escribe en la que toca. Con una lista escrita de cuadros sueltos, cada
       sitio nuevo obliga a acordarse de los cuatro. */
    refs.vistas = {
      galactico: vistaGal,
      palabra: vistaPal,
      grupo: vistaGrupo,
      frases: vistaFrases
    };

    /* --- LOS AJUSTES DEL GALACTICO, en su propio bloque */
    var bloqueGal = el('div', 'ajustes-bloque');
    bloqueGal.appendChild(campoAjuste('anchoBase',
      'Ancho en la base',
      'Qué tan ancho es el texto cuando aparece por abajo. Porcentaje del ancho de la pantalla.',
      '%'));
    bloqueGal.appendChild(campoAjuste('anchoTecho',
      'Ancho en el techo',
      'Qué tan ancho es el texto cuando se pierde arriba. Más chico que la base: el techo se cierra.',
      '%'));
    bloqueGal.appendChild(campoAjuste('angulo',
      'Rotación del suelo',
      'Cuánto se inclina el suelo hacia atrás. Más grados: el horizonte queda más lejos y el efecto es más marcado.',
      '°'));
    bloqueGal.appendChild(campoAjuste('interlineado',
      'Interlineado',
      'Espacio entre renglones. 1 es apretado, 2 es aireado.',
      ''));
    // Los dos colores del galactico, en UNA fila de DOS columnas
    var filaColores = el('div', 'ajustes-color-fila--doble');
    filaColores.appendChild(campoColor('fondo', 'Fondo'));
    filaColores.appendChild(campoColor('texto', 'Texto de la lectura'));
    bloqueGal.appendChild(filaColores);
    dlg.appendChild(bloqueGal);

    /* --- LOS AJUSTES DEL PALABRA POR PALABRA, en su propio bloque

       Aqui NO hay control de interlineado, y es a proposito. En el galactico
       el texto ocupa muchos renglones y el interlineado separa esos renglones:
       se ve. En palabra por palabra se muestra UNA palabra, en UNA linea, en el
       mismo punto de la pantalla; no hay un segundo renglón que separarle a
       nada, asi que el control no hacia nada visible. Un control que no cambia
       nada es peor que no tenerlo: la persona lo mueve, no ve diferencia, y
       deduce que el botón está roto. */
    var bloquePal = el('div', 'ajustes-bloque');
    // Los TRES colores del palabra por palabra, en UNA fila de TRES columnas:
    // fondo, texto de la palabra y el color de la letra que se resalta.
    var filaPal = el('div', 'ajustes-color-fila--triple');
    filaPal.appendChild(campoColor('palabraFondo', 'Fondo'));
    filaPal.appendChild(campoColor('palabraTexto', 'Texto de la palabra'));
    filaPal.appendChild(campoColor('palabraFoco', 'Color del foco'));
    bloquePal.appendChild(filaPal);

    var campoCantidad = el('div', 'ajustes-campo');
    var labelCantidad = el('label', '', 'Cantidad de palabras visibles');
    labelCantidad.setAttribute('for', 'ajustes-palabra-cantidad');
    var selectCantidad = el('select', 'editor-campo');
    selectCantidad.id = 'ajustes-palabra-cantidad';
    [{val: 1, txt: '1 palabra (enfocada)'}, {val: 3, txt: '3 palabras (con contexto lateral)'}].forEach(function(o) {
      var op = el('option', '', o.txt);
      op.value = String(o.val);
      selectCantidad.appendChild(op);
    });
    campoCantidad.appendChild(labelCantidad);
    campoCantidad.appendChild(selectCantidad);
    bloquePal.appendChild(campoCantidad);
    refs.palabraCantidad = selectCantidad;

    dlg.appendChild(bloquePal);

    /* --- LOS AJUSTES DEL MODO GRUPO (CHUNK), en su propio bloque

       Los mismos TRES colores que palabra por palabra, y por el mismo motivo:
       el texto es corto y centrado, y hay UNA palabra resaltada (la del ORP,
       el punto de fijación óptico). El color de ese papel es el "foco" aqui.

       Tampoco lleva interlineado: son tres o cuatro palabras, que ocupan una
       línea o dos, y un ajuste que separa renglones no tiene nada que separar.
       Mismo razonamiento que en palabra por palabra. */
    var bloqueGrupo = el('div', 'ajustes-bloque');
    var filaGrupo = el('div', 'ajustes-color-fila--triple');
    filaGrupo.appendChild(campoColor('grupoFondo', 'Fondo'));
    filaGrupo.appendChild(campoColor('grupoTexto', 'Texto del grupo'));
    filaGrupo.appendChild(campoColor('grupoFoco', 'Color de la palabra fijada'));
    bloqueGrupo.appendChild(filaGrupo);
    dlg.appendChild(bloqueGrupo);

    /* --- LOS AJUSTES DEL MODO FRASES, en su propio bloque

       Aqui el interlineado SI vuelve, porque este es el unico modo donde el
       texto ocupa varios renglones: una oracion entera se parte en las lineas
       que haga falta, y el espacio entre esas lineas es justo lo que dice este
       ajuste. En los otros tres modos no habria nada que separar.

       Y son solo DOS colores, no tres: en frases no hay ninguna palabra ni
       letra que resaltar (se muestra la oracion completa), asi que no hay un
       "foco" que elegir. Poner un campo de color del foco aqui seria un control
       que no cambia nada. */
    var bloqueFrases = el('div', 'ajustes-bloque');
    bloqueFrases.appendChild(campoAjuste('frasesInterlineado',
      'Interlineado',
      'Espacio entre renglones. 1 es apretado, 2 es aireado.',
      ''));
    var filaFrases = el('div', 'ajustes-color-fila--doble');
    filaFrases.appendChild(campoColor('frasesFondo', 'Fondo'));
    filaFrases.appendChild(campoColor('frasesTexto', 'Texto de la frase'));
    bloqueFrases.appendChild(filaFrases);
    dlg.appendChild(bloqueFrases);

    refs.bloqueGal = bloqueGal;
    refs.bloquePal = bloquePal;
    refs.bloqueGrupo = bloqueGrupo;
    refs.bloqueFrases = bloqueFrases;

    // --- las fuentes, en una fila de dos columnas
    var fs = el('fieldset', 'ajustes-grupo');
    fs.appendChild(el('legend', 'ajustes-fuentes-titulo', 'Fuente'));
    var filaFuente = el('div', 'ajustes-fuente-fila');

    var select = el('select', 'editor-campo ajustes-fuente-select');
    select.id = 'ajustes-fuente';
    var labelSelect = el('label', 'oculto-a-la-vista', 'Fuente de la lectura');
    labelSelect.setAttribute('for', 'ajustes-fuente');
    filaFuente.appendChild(labelSelect);
    filaFuente.appendChild(select);

    var instalar = el('button', 'boton ajustes-instalar', 'Instalar una fuente');
    instalar.type = 'button';
    filaFuente.appendChild(instalar);

    fs.appendChild(filaFuente);
    dlg.appendChild(fs);

    var archivo = el('input');
    archivo.type = 'file';
    archivo.accept = '.woff2,.woff,.ttf,.otf';
    archivo.hidden = true;
    archivo.setAttribute('aria-label', 'Elegir un archivo de fuente');
    dlg.appendChild(archivo);

    refs.selectFuente = select;
    refs.instalar = instalar;
    refs.archivo = archivo;

    var estado = el('p', 'ajustes-estado');
    estado.setAttribute('role', 'status');
    dlg.appendChild(estado);
    refs.estado = estado;

    // --- los botones de abajo
    var acciones = el('div', 'dialogo-acciones');
    var fabrica = el('button', 'boton', 'Valores de fábrica');
    fabrica.type = 'button';
    var listo = el('button', 'boton boton--principal', 'Listo');
    listo.type = 'button';
    acciones.appendChild(fabrica);
    acciones.appendChild(listo);
    dlg.appendChild(acciones);
    refs.fabrica = fabrica; refs.listo = listo;

/* --- eventos */
    Object.keys(SLIDERS).forEach(function (clave) {
      refs[clave].addEventListener('input', pintarVista);
      refs[clave].addEventListener('change', function () {
        window.RetoLectura.poner(clave, refs[clave].value);
        sincronizar();
      });
    });

    if (refs.palabraCantidad) {
      refs.palabraCantidad.addEventListener('change', function () {
        window.RetoLectura.poner('palabraCantidad', parseInt(this.value, 10));
      });
    }

    COLORES_MODAL.forEach(function (clave) {
      var rueda = refs['color_' + clave];
      var hex   = refs['color_' + clave + '_hex'];
      rueda.addEventListener('input', function () {
        hex.value = rueda.value;
        window.RetoLectura.poner(clave, rueda.value);
      });
      hex.addEventListener('change', function () {
        var v = hex.value.trim();
        if (!/^#?[0-9a-fA-F]{6}$/.test(v)) return;   // se ignora lo que no sea hex
        if (v.charAt(0) !== '#') v = '#' + v;
        v = v.toLowerCase();
        hex.value = v;
        rueda.value = v;
        window.RetoLectura.poner(clave, v);
      });
    });

    select.addEventListener('change', function () {
      decir('');
      window.RetoLectura.poner('fuente', select.value).then(pintarVista);
      var elegida = window.RetoFuentes.lista().then(function (todas) {
        var f = todas.filter(function (x) { return x.id === select.value; })[0];
        if (f) ponerFuenteEnLasVistas(f.css);
      });
      elegida.catch(function () {});
    });

    instalar.addEventListener('click', function () { archivo.click(); });
    archivo.addEventListener('change', function () {
      var f = archivo.files && archivo.files[0];
      archivo.value = '';
      if (f) instalarArchivo(f);
    });

    fabrica.addEventListener('click', function () {
      decir('');
      window.RetoLectura.restablecer().then(function () {
        sincronizar();
        return pintarLista();
      });
    });

    listo.addEventListener('click', function () { dlg.close(); });

    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

    dlg.addEventListener('close', function () {
      var seguir = reanudar;
      reanudar = null;
      if (seguir) seguir();
    });

    document.body.appendChild(dlg);
  }

  /* ------------------------------------------------------------ los ajustes */

  function sincronizar() {
    var a = window.RetoLectura.obtener();

    /* Los sliders. Cada uno toma sus limites de la tabla que le dice su fila (la
       del galactico, o la de frases), y ninguno lleva aqui ni un numero: los
       limites viven en reto-lectura.js. */
    Object.keys(SLIDERS).forEach(function (clave) {
      var fila = SLIDERS[clave];
      var r = a[fila.tabla][fila.ajuste];
      var control = refs[clave];
      control.min = r.min;
      control.max = r.max;
      control.step = r.paso;
      control.value = a[fila.valor];
    });

    /* Los diez colores, cada uno en sus dos formas (rueda y campo de codigo).
       Del galactico se escribe el ajuste; de los otros tres modos, el color
       QUE SE ESTA VIENDO: si el ajuste esta vacio (es decir, "el del tema"),
       una rueda de color no puede quedarse en blanco, asi que enseña el del
       tema. Tocar el campo guarda ese valor; no tocarlo no cambia nada. */
    var pares = [['fondo', a.fondo], ['texto', a.texto]];
    COLORES_MODAL.slice(2).forEach(function (clave) {
      pares.push([clave, a[clave + 'Visto']]);
    });
    pares.forEach(function (par) {
      var rueda = refs['color_' + par[0]];
      var hex   = refs['color_' + par[0] + '_hex'];
      if (rueda && par[1]) rueda.value = par[1];
      if (hex && par[1]) hex.value = par[1];
    });
    if (refs.palabraCantidad) refs.palabraCantidad.value = String(a.palabraCantidad || 1);
    pintarVista();
  }

  /* EL PREVIEW NO SE ESCRIBE: SE HEREDA.

     Este cuadro NO pinta los colores con JavaScript. Las variables
     --palabra-fondo, --palabra-texto y --palabra-foco las escribe
     reto-lectura.js en <html>, el cuadrito está dentro del modal y está en el
     mismo documento, asi que las ve sin que nadie se las copie. Por eso mover
     una rueda cambia la pantalla y el cuadro en el MISMO instante,
     sin nada que sincronizar.

     La primera version si las escribia aqui, con setProperty, y por eso habia
     que salir del modal y volver a entrar para ver el cambio: las escribia al
     abrir y no al mover la rueda. Es el mismo camino que ya lleva el
     galáctico, y por eso se dejó así. */

  /* QUE PALABRA SE PONE EN EL CUADRITO.
     Se mide la linea con la palabra larga puesta y se compara con el ancho del
     cuadro. Si no cabe, se cambia por la corta. Si el cuadro todavia no tiene
     ancho (el modal acabo de abrir y todavia no se ha medido), se queda con la
     larga: despues se vuelve a medir al cambiar el interlineado o la fuente, y
     ahi ya si hay ancho. Nunca se adivina. */
  function elegirPalabraDelCuadro() {
    if (!refs.lineaPal) return;
    var ancho = refs.vistaPalabra.clientWidth;
    if (!ancho) {
      escribirPalabra('Con', 'f', 'iguración');
      return;
    }
    escribirPalabra('Con', 'f', 'iguración');
    if (refs.lineaPal.scrollWidth > ancho) escribirPalabra('Pr', 'e', 'view');
  }

  /* Se escribe una palabra con su letra de fijacion en los tres pedazos. Se
     comparan los textos antes de escribir: reescribir el mismo texto en un
     nodo que se esta midiendo puede relayoutar la pagina, y esta medida se
     hace en cada cambio del interlineado. */
  function escribirPalabra(antes, foco, despues) {
    if (refs.antesPal.textContent !== antes)   refs.antesPal.textContent = antes;
    if (refs.focoPal.textContent !== foco)     refs.focoPal.textContent = foco;
    if (refs.despuesPal.textContent !== despues) refs.despuesPal.textContent = despues;
  }

  function pintarVista() {
    var sufijo = function (clave) { return refs[clave + 'Sufijo'] || ''; };

    /* En este modo lo unico que hay que pintar es la palabra del cuadrito (que
       se escoge midiendo si cabe). Los colores no se tocan aqui: el cuadrito
       HEREDA las variables que escribe la pantalla, y por eso se ven al
       instante sin que nadie las copie. */
    if (motorActual === 'palabra') {
      elegirPalabraDelCuadro();
      return;
    }

    /* Grupo y frases no tienen nada que pintar en el cuadrito: sus colores se
       heredan igual que en palabra por palabra, y no tienen slider. El
       interlineado de frases tampoco: lo lee el CSS de una variable, igual que
       los colores. Aqui solo el galactico tiene algo que calcular, porque es el
       unico con una escena en perspectiva. */
    if (motorActual === 'grupo' || motorActual === 'frases') return;

    var anchoBase    = parseFloat(refs.anchoBase.value);
    var anchoTecho   = parseFloat(refs.anchoTecho.value);
    var angulo       = parseFloat(refs.angulo.value);
    var interlineado = parseFloat(refs.interlineado.value);

    refs.anchoBaseValor.textContent    = anchoBase + sufijo('anchoBase');
    refs.anchoTechoValor.textContent   = anchoTecho + sufijo('anchoTecho');
    refs.anguloValor.textContent       = angulo + sufijo('angulo');
    refs.interlineadoValor.textContent = interlineado.toString();

    // La MISMA cuenta que el motor: no hay una segunda version de la geometria.
    var anchoBaseF  = anchoBase / 100;
    var anchoTechoF = anchoTecho / 100;

    refs.texto.style.width = (anchoBaseF * 100) + '%';
    refs.texto.style.lineHeight = interlineado;

    /* El alto del CUADRICTO, por la tabla de vistas. Va por la tabla y no por
       refs.vista porque ya no hay un solo cuadrito: hay cuatro, y el que se
       mide es el del galactico, que es el unico con perspectiva que calcular. */
    var alto = refs.vistas.galactico.clientHeight;
    if (!alto) return;

    var g = window.RetoLectura.geometria(alto, anchoBaseF, anchoTechoF, angulo);
    refs.escena.style.perspective = g.perspectiva + 'px';
    refs.escena.style.setProperty('--galactico-angulo', g.angulo + 'deg');
    refs.texto.style.transform = 'translate3d(-50%,0,0)';
  }

  /* --------------------------------------------------------------- fuentes */

  function pintarLista() {
    return window.RetoFuentes.lista().then(function (todas) {
      var actual = window.RetoLectura.obtener().fuente;
      limpiar(refs.selectFuente);
      todas.forEach(function (f) {
        var op = el('option', '', f.nombre);
        op.value = f.id;
        if (f.id === actual) op.selected = true;
        refs.selectFuente.appendChild(op);
        /* La fuente se pone en las CUATRO vistas previas: los cuadritos tienen
           que enseñar la misma tipografía que se va a ver en la pantalla, y los
           cuatro son del mismo sitio. */
        if (f.id === actual) ponerFuenteEnLasVistas(f.css);
      });
    });
  }

  function instalarArchivo(archivo) {
    refs.instalar.disabled = true;
    decir('Instalando…');
    window.RetoFuentes.instalar(archivo).then(function (f) {
      return window.RetoLectura.poner('fuente', f.id).then(pintarLista).then(function () {
        pintarVista();
        decir('Listo: “' + f.nombre + '” quedó instalada y elegida.');
      });
    }).catch(function (e) {
      decir(e && e.message ? e.message : 'No se pudo instalar la fuente.', true);
    }).then(function () {
      refs.instalar.disabled = false;
    });
  }

  /* ----------------------------------------------------------------- abrir */

  /* QUE BLOQUE SE VE. Los dos se arman una vez y aqui se decide cual se
     enseña. El boton se llama igual en los dos modos, porque el boton abre
     "los ajustes de este modo", y lo que hay dentro depende del modo. Un solo
     modal con las dos cosas mezcladas seria peor: habria sliders de la escena
     en un modo que no tiene escena. */
  function mostrarBloque(modo) {
    /* Se enseñan el bloque y el cuadrito de ESE modo, y los otros tres se
       esconden. Se recorre la tabla de bloques, no se escriben cuatro "if":
       con cuatro lineas a mano, el día que haya un quinto modo hay que
       acordarse de esconder el cuarto, y un bloque que se queda visible por
       olvido enseña sliders de otro modo, que es peor que un modal vacío. */
    Object.keys(BLOQUES).forEach(function (m) {
      var esEste = (m === modo);
      refs[BLOQUES[m]].hidden = !esEste;
      refs.vistas[m].hidden = !esEste;
    });
    if (refs.titulo) refs.titulo.textContent = TITULOS[modo] || 'Ajustes';
  }

  function abrir() {
    /* Todavia no hay motor: se esta pidiendo el plan a Python. Un boton que no
       hace nada es un boton que parece roto, y esta es la unica vez que se
       puede apretar antes de tiempo (por eso el boton se muestra al entrar y
       no despues). Aqui no se avisa con un alert: lo dice el mismo dialogo del
       sitio, que se anuncia al lector de pantalla. */
    if (!window.RetoLectura || !window.RetoLectura.motor) return;
    if (!window.RetoLectura.listo()) {
      if (window.RetoDialogo) {
        window.RetoDialogo.informar({
          titulo: 'Todavía se está preparando',
          texto: 'Un momento: se está pidiendo el texto al servidor para poder ' +
                 'mostrarlo. Ya va a estar, y el botón va a servir.'
        });
      }
      return;
    }
    /* Los modos que viven en otros archivos (pacer, columnas, skimming) traen su
       propio modal: aqui solo se les pasa el turno. */
    var propio = window.RetoLecturaMotores && window.RetoLecturaMotores.ajustes &&
                 window.RetoLecturaMotores.ajustes[window.RetoLectura.motor()];
    if (propio) { propio(); return; }
    if (!window.RetoFuentes) return;
    if (abriendo || (dlg && dlg.open)) return;
    if (!window.HTMLDialogElement) {
      window.alert('Este navegador no puede abrir los ajustes. Usa uno más reciente.');
      return;
    }
    var modo = window.RetoLectura.motor();
    /* Un modo sin bloque en BLOQUES no tiene modal: se sale sin hacer nada,
       porque abrir un dialogo vacio confunde mas que no abrir nada. Con los
       cuatro modos actuales la comprobacion nunca se cumple, y sigue ahi para
       el quinto. */
    if (!BLOQUES[modo]) return;
    abriendo = true;
    if (!dlg) armar();
    motorActual = modo;
    mostrarBloque(modo);
    decir('');
    reanudar = window.RetoLectura.suspender();
    sincronizar();
    pintarLista().then(function () {
      dlg.showModal();
      pintarVista();
      /* El foco se va al primer control del bloque que se acaba de abrir, que
      // es el que la persona va a mover primero. Con el bloque escondido, el
      // foco se iria a un control invisible, que es peor que donde quede: el
      // tabulador_empezaria por algo que no se ve.
      //
      // En el galactico el primero es el primer slider; en frases es su unico
      // slider (el interlineado); en palabra y en grupo no hay ninguno, asi que
      // es la rueda del fondo, que es lo primero que hay en su bloque. */
      var primero = refs[FOCO_INICIAL[modo][0]];
      if (primero) primero.focus();
    }).catch(function () {
      var seguir = reanudar;
      reanudar = null;
      if (seguir) seguir();
    }).then(function () { abriendo = false; });
  }

  boton.addEventListener('click', abrir);
})();
