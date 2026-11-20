/* =========================================================================
   R.E.T.O. — La pantalla de lectura
   -------------------------------------------------------------------------
   Este archivo maneja el MANDO de la pantalla de lectura: reproducir, pausar,
   reiniciar, la velocidad y el tamano de la letra. Y nada mas todavia.

   QUE HACE Y QUE NO HACE
   Aqui NO se decide nada de la lectura. Que palabras se junten, cuantas letras
   entran en un grupo, cuanto dura cada palabra y donde va la pausa son reglas,
   y las reglas van en Python (logica/lectura_veloz.py), que devuelve el plan
   entero. Este archivo solo guarda el estado del mando y pinta el numero de la
   velocidad y el aviso. Cuando llegue el motor, este archivo le pasa el estado
   y el motor pinta; este archivo no cambia.

   POR QUE LOS BOTONES RESPONDEN AUNQUE NO HAYA TEXTO
   El proyecto tiene una regla: un boton que no puede hacer nada no se apaga,
   porque un boton apagado no avisa de nada y parece un fallo. Y la otra mitad de
   la regla: un boton que responde y explica es mejor que uno que se hace el
   muerto. Entonces, todavia sin motor, "leer" y "reiniciar" abren el dialogo y
   dicen lo que pasa. En cuanto haya texto, la misma llamada arranca la lectura
   y el mismo boton la pausa, sin cambiar ni una linea de la pagina.

   DONDE SE GUARDAN LAS PREFERENCIAS
   La velocidad y el tamano de la letra son del usuario, y los datos del
   usuario viven en IndexedDB (agents.md). Se guardan con RetoDatos.poner, que
   ademas tiene respaldo en localStorage si IndexedDB no esta. Si guardar
   falla (modo privado sin almacenamiento), la lectura sigue funcionando: solo
   se pierde el recuerdo, y eso no puede tirar la pantalla.
   ========================================================================= */
(function () {
  'use strict';

  var MARGEN = 0.25;          // cada paso de la letra
  var LETRA_CHICA = 1.5;       // topes: ni tan chica que no se lea, ni tan
  var LETRA_GRANDE = 6;        // grande que no quepan dos palabras
  var LETRA_POR_DEFECTO = 3;

  /* LA VELOCIDAD NO TIENE LISTA: TIENE BARRA.

     La primera version de esta pantalla ofrecia una lista con ocho
     velocidades (150, 200, ... 500) y abria un dialogo para elegir. Se quito
     por dos razones, y las dos importan:

       1. una lista cerrada quita opciones que alguien puede necesitar. El
          tope de 500 era demasiado bajito, y no habia forma de probarlo en
          serio: leer a 800 no es para todos, pero a alguien que esta
          practicando le puede servir;

       2. para lo que mas se usa durante la practica —afinar el ritmo—, una
          lista es mas lenta que un par de botones.

     Ahora la velocidad es un numero, y ese numero se cambia de tres maneras que
     hacen lo mismo: la barra (para buscar rapido), y los botones de mas y menos
     (para afinar de diez en diez). Los tres topes van aqui, y el motor usa el
     mismo numero. */
  var WPM_CHICA = 50;      // abajo de esto ya no es leer, es ir deslizando
  var WPM_GRANDE = 999;    // arriba de esto el texto entra antes de que el ojo
                           // lo lea, y eso no es leer mas rapido: es no leer
  var WPM_PASO = 10;       // de diez en diez, que es como se nota un cambio
  var WPM_POR_DEFECTO = 300;

  /* El estado del mando. Es de una sola pieza y vive aqui, no repartido por el
     DOM: cambiar la velocidad tiene que cambiar el numero, el ritmo y (cuando
     exista) el motor, y si eso vive en tres sitios se desincroniza. */
  var estado = {
    motor: null,        // el id del motor, todavia null (viene en la direccion)
    textoId: null,      // el texto elegido, todavia null
    wpm: WPM_POR_DEFECTO,
    letra: LETRA_POR_DEFECTO,
    leyendo: false,     // true = corriendo, false = parado
    posicion: 0,        // por donde va. Lo usara el motor.
    tamanoGrupo: 3,     // 3 o 4 palabras por grupo (modo chunk)

    /* Los ajustes del modo galactico (el modal del boton de
       los controles deslizantes). inicio y fin nacen null: sus limites y su
       valor por defecto los decide Python (logica/lectura_veloz.py) y llegan
       dentro del plan. Asi los numeros viven en UN solo sitio, y aqui no hay
       una copia que se pueda desincronizar. */
    galAnchoBase: 85,      // 81-93: ancho del texto abajo (base del trapecio)
    galAnchoTecho: 51,     // 51-93: ancho del texto arriba (techo del trapecio)
    galAngulo: 24,         // 1-33: inclinacion del suelo en grados
    galInterlineado: 1.4,  // 1-2: espacio entre renglones
    galFondo: '#000000',   // fondo de la escena (Star Wars: negro)
    galTexto: '#ffe81f',   // letra de la lectura (Star Wars: amarillo)

    /* Los ajustes del modo palabra por palabra.
       Los TRES colores nacen VACIOS, y vacio quiere decir "el del tema": el
       fondo es --surface, la letra --text y el foco --accent. No se inventan
       colores nuevos, porque un color nuevo hay que medirlo en los cinco temas
       (contra la superficie y contra la mezcla con la marca de agua), y en
       esta pantalla no hay marca de agua pero el fondo es el que eligio la
       persona. Los valores de fabrica del galactico si son fijos (negro y
       amarillo) porque ese modo ES una escena con esos dos colores; aqui la
       lectura es una pagina normal y lo correcto es que se parezca al resto
       del sitio hasta que la persona diga otra cosa.

       Escribirlos es TANTO escribir una variable, como no escribirla: si se
       quita la variable, el "var(--palabra-foco, var(--accent))" del CSS vuelve
       al color del tema. Por eso no hace falta un caso aparte para "volver al
       del tema": es borrar. */
    palabraFondo: '',
    palabraTexto: '',
    palabraFoco: '',
    palabraCantidad: 1,
    /* Los mismos tres para el MODO GRUPO (chunk), que tambien muestra el texto
       centrado y corto, con UNA palabra resaltada: el ORP. Alli el color del
       foco va a la palabra nitida (la del punto de fijacion optico), que es el
       mismo papel que plays la letra de fijacion en palabra por palabra. */
    grupoFondo: '',
    grupoTexto: '',
    grupoFoco: '',
    /* Y para el MODO FRASES, que es el unico con TEXTO LARGO: ahi el fondo y
       el color del texto, mas el INTERLINEADO (que si se ve, porque una frase
       se parte en varios renglones). Sin color de foco, porque no hay una letra
       que resaltar: se muestra la oracion entera. */
    frasesFondo: '',
    frasesTexto: '',
    frasesInterlineado: 1.4,
    /* Aqui NO hay interlineado, y es a proposito: el modo muestra una palabra
       sola, en una linea sola, siempre en el mismo punto. No hay un segundo
       renglon que separarle a nada, asi que el ajuste no hacia nada visible.
       Un control que no cambia nada hace pensar que esta roto. El
       interlineado que si sirve (el del galactico, que ocupa many renglones)
       vive en su propia tabla, y no se mezcla con este. */

    fuente: 'nunito'    // el id de la fuente (ver reto-fuentes.js)
  };

  /* LA TABLA DE LOS CUATRO AJUSTES DE FORMA
     Cada uno con su minimo, su maximo, su paso y su valor de fabrica. Viven
     aqui, en el navegador, y no en el servidor: son de la vista, no de la
     lectura, y no dependen de ningun dato del texto.

     El palabra por palabra NO tiene tabla: se queda solo con los tres colores,
     y un color no lleva minimo ni maximo (o es un hexadecimal valido, o no es
     un color). Ver la nota del estado.

     El MODO FRASES si tiene tabla, y tiene un solo ajuste: el interlineado.
     Es el unico de los cuatro modos donde el texto ocupa varios renglones, y
     por lo tanto el unico donde separar los renglones se ve de verdad. */
  var AJUSTES = {
    anchoBase:    { min: 10, max: 100, paso: 1,    defecto: 85 },
    anchoTecho:   { min: 10, max: 100, paso: 1,    defecto: 51 },
    angulo:       { min: 0,  max: 33,  paso: 1,    defecto: 24 },
    interlineado: { min: 1,  max: 2,   paso: 0.05, defecto: 1.4 }
  };

  /* La tabla del MODO FRASES. El interlineado es el unico ajuste con limites
     que no es del galactico, y por eso tiene su propia tabla y no se mezcla
     con la de arriba: una tabla por modo, y el modal pide la que necesita. */
  var AJUSTES_FRASES = {
    interlineado: { min: 1, max: 2, paso: 0.05, defecto: 1.4 }
  };

  /* LOS COLORES DE LOS MODOS, EN UNA TABLA.
     Palabras, grupo y frases tienen colores propios; el galáctico se aparta
     porque los suyos son fijos (negro y amarillo: ese modo ES una escena con
     esos dos colores) y van en su propio camino, mas arriba.

     Aqui van TRES nombres juntos y escritos: el del ajuste (que es el que pide
     el modal), el del estado donde se guarda en memoria, y el de la clave con
     que se guarda en el almacenamiento. Los tres tienen que coincidir, y
     escribiendolos en una tabla se nota de un vistazo cuando uno no cuadra.
     Antes se armaba la clave recortando el nombre del ajuste, y eso salia con
     mayuscula ("palabra_Fondo") y el ajuste se perdia al cerrar la pantalla,
     sin un solo error. Ver "Un nombre no se recorta, se escribe" en agents.md. */
  var COLORES = {
    palabraFondo: { destino: 'palabraFondo', clave: 'palabra_fondo', pintar: aplicarColoresPalabra },
    palabraTexto: { destino: 'palabraTexto', clave: 'palabra_texto', pintar: aplicarColoresPalabra },
    palabraFoco:  { destino: 'palabraFoco',  clave: 'palabra_foco',  pintar: aplicarColoresPalabra },
    grupoFondo:   { destino: 'grupoFondo',   clave: 'grupo_fondo',   pintar: aplicarColoresGrupo },
    grupoTexto:   { destino: 'grupoTexto',   clave: 'grupo_texto',   pintar: aplicarColoresGrupo },
    grupoFoco:    { destino: 'grupoFoco',    clave: 'grupo_foco',    pintar: aplicarColoresGrupo },
    frasesFondo:  { destino: 'frasesFondo',  clave: 'frases_fondo',  pintar: aplicarColoresFrases },
    frasesTexto:  { destino: 'frasesTexto',  clave: 'frases_texto',  pintar: aplicarColoresFrases }
  };

  /* Acotar un ajuste a los limites de SU tabla. El nombre del ajuste y el de
     la tabla van escritos, no derivados uno del otro: "frasesInterlineado"
     recortado de "frases" seria "Interlineado" con mayuscula, y esa
     mayuscula fue un bug real (ver agents.md). */
  function acotarAjusteDe(tabla, v) {
    var r = tabla;
    v = parseFloat(v);
    if (isNaN(v) || !isFinite(v)) return r.defecto;
    v = Math.round(v / r.paso) * r.paso;
    return Math.min(r.max, Math.max(r.min, v));
  }

  /* Los colores se guardan como cadenas "#rrggbb", que es lo que entiende el
     <input type="color"> del modal y lo que se puede escribir a mano en el
     campo de al lado. */
  function esHexValido(v) {
    return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  }

  /* Aplicar los colores de un modo. Se escriben como variables CSS en <html>,
     igual que los de galactico.
     Un valor VACIO no se escribe: se quita la variable, y asi el "var(--x,
     --del-tema)" del CSS vuelve a mandar. Esa es la forma de volver al color
     del tema sin un caso especial.

     La misma regla para los cuatro modos, con sus propias variables. Por eso
     esta funcion recibe la terna y no esta escrita cuatro veces: lo unico que
     cambia es el nombre de la variable, y eso lo decide el CSS. */
  function ponerVariables(pares) {
    var r = document.documentElement;
    pares.forEach(function (par) {
      if (par[1]) r.style.setProperty(par[0], par[1]);
      else r.style.removeProperty(par[0]);
    });
  }

  function aplicarColoresPalabra() {
    ponerVariables([
      ['--palabra-fondo', estado.palabraFondo],
      ['--palabra-texto', estado.palabraTexto],
      ['--palabra-foco', estado.palabraFoco]
    ]);
  }

  function aplicarColoresGrupo() {
    ponerVariables([
      ['--grupo-fondo', estado.grupoFondo],
      ['--grupo-texto', estado.grupoTexto],
      ['--grupo-foco', estado.grupoFoco]
    ]);
  }

  function aplicarColoresFrases() {
    ponerVariables([
      ['--frases-fondo', estado.frasesFondo],
      ['--frases-texto', estado.frasesTexto]
    ]);
    /* El interlineado viaja por la misma via que los colores. Sin esto habria
       que volver a medir la frase en JavaScript para saber que tan apretada va,
       y eso es justo lo que esta pantalla no hace. */
    document.documentElement.style.setProperty('--frases-interlineado', String(estado.frasesInterlineado));
  }

  /* El color que SE ESTA VIENDO, para que el modal lo muestre en la rueda y en
     el campo de codigo aunque la persona nunca haya tocado nada. Si el ajuste
     esta vacio, el que se ve es el del tema, y el tema se pregunta al
     navegador: los tokens son colores en hexadecimal, asi que lo que sale se
     puede poner tal cual en un <input type="color">.

     ESTA TABLA DICE QUE COLOR DEL TEMA ES EL DE CADA AJUSTE, y es lo unico
     que hay que cambiar para añadir un color a un modo nuevo. El nombre del
     ajuste y el token van juntos, a proposito: un modo sin su renglon aqui se
     quedaria sin color de fabrica, y se veria en el modal como un campo en
     negro sin explicación. */
  var COLOR_DEL_TEMA = {
    palabraFondo: '--surface', palabraTexto: '--text', palabraFoco: '--accent',
    grupoFondo:   '--surface', grupoTexto:   '--text', grupoFoco:   '--accent',
    frasesFondo:  '--surface', frasesTexto:  '--text'
  };

  function colorEfectivo(clave) {
    if (estado[clave]) return estado[clave];
    var v = window.getComputedStyle(document.documentElement)
              .getPropertyValue(COLOR_DEL_TEMA[clave]).trim();
    return esHexValido(v) ? v : '';
  }

  /* --- los pedacitos de la pagina -------------------------------------- */
  var marco = document.getElementById('marco');
  var aviso = document.getElementById('aviso');
  var wpmValor = document.getElementById('wpm-valor');
  var wpmRango = document.getElementById('wpm-rango');
  var botonLeer = document.querySelector('[data-leer]');
  var botonReiniciar = document.querySelector('[data-reiniciar]');
  var dibujoPlay = document.querySelector('[data-dibujo="play"]');
  var dibujoPausa = document.querySelector('[data-dibujo="pausa"]');
  var fuenteValor = document.getElementById('fuente-valor');

  if (!marco) return;   // esta pagina sin marco no es la pantalla de lectura

  /* ======================================================================
     LO QUE VE LA PERSONA
     ====================================================================== */

  /* El aviso. Se llena y se vacia. Cuando esta vacio no ocupa nada (por eso
     lleva ":empty" en el CSS), y por eso la pantalla se ve vacia en reposo. */
  function decir(texto) {
    if (aviso) aviso.textContent = texto || '';
  }

  /* La velocidad, en los DOS sitios donde se ve: el numero y la perilla de la
     barra. Se escriben los dos siempre juntos, aunque solo haya cambiado uno
     (por ejemplo, cuando llega de la barra y el numero ya traia ese valor), y
     con una sola funcion. Si esto se escribiera en dos sitios, un dia se
     olvidaria uno de los dos y la barra y el numero dirian cosas distintas.

     El golpecito va con un atributo que se quita y se vuelve a poner: sin
     forzarlo, el navegador no reinicia la animacion y no se ve nada. */
  function pintarVelocidad() {
    if (wpmRango && wpmRango.value !== String(estado.wpm)) {
      wpmRango.value = estado.wpm;
    }
    if (!wpmValor) return;
    wpmValor.textContent = String(estado.wpm);
    wpmValor.removeAttribute('data-cambio');
    // "reflow" a proposito: sin forzar el recalculo, quitar y poner el atributo
    // en el mismo turno no reinicia la animacion y el golpecito no se ve.
    void wpmValor.offsetWidth;
    wpmValor.setAttribute('data-cambio', '1');
  }

  /* El boton de leer: el dibujito y el texto cambian con el estado. El
     "aria-label" tambien, para que el lector de pantalla no diga "reproducir"
     cuando lo que va a hacer es pausar. */
  /* LA SESION DE LECTURA, PARA EL NIVEL DE PRACTICA.
     La lectura SI cuenta (regla acordada). Se suma el tiempo en que estado.leyendo
     estuvo en true, entre pausas, y se avisa a RetoProgreso cuando junta un
     minuto o mas (la sesion minima: entrar y salir no infla nada). Se hace en
     pintarEstado porque TODOS los motores pasan por ahi cada vez que empiezan o
     se paran. Las palabras son una estimacion (minutos x velocidad): cada motor
     cuenta distinto lo que "una posicion" significa. La prueba de velocidad y
     el skimming se registran solos, asi que aqui no se cuentan dos veces. */
  var SESION_PROPIA = { prueba: true, skimming: true };
  var sesionLectura = { desde: null, ms: 0 };

  function volcarSesion(forzar) {
    if (SESION_PROPIA[estado.motor] || !window.RetoProgreso) return;
    if (sesionLectura.desde !== null) {
      sesionLectura.ms += performance.now() - sesionLectura.desde;
      sesionLectura.desde = estado.leyendo ? performance.now() : null;
    }
    var minutos = sesionLectura.ms / 60000;
    if (minutos < 1 && !forzar) return;
    if (minutos < 1) return;       // aun con "forzar": menos de un minuto no suma
    sesionLectura.ms = 0;
    try {
      window.RetoProgreso.registrarSesion({
        tipo: 'lectura', motor: estado.motor,
        minutos: minutos, palabras: Math.round(minutos * estado.wpm)
      });
    } catch (e) {}
  }

  function seguirSesion() {
    if (estado.leyendo && sesionLectura.desde === null) sesionLectura.desde = performance.now();
    else if (!estado.leyendo && sesionLectura.desde !== null) { volcarSesion(false); sesionLectura.desde = null; }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { volcarSesion(true); sesionLectura.desde = null; }
    else if (estado.leyendo) sesionLectura.desde = performance.now();
  });
  window.addEventListener('pagehide', function () { volcarSesion(true); });

  function pintarEstado() {
    seguirSesion();
    if (!botonLeer) return;
    if (dibujoPlay && dibujoPausa) {
      if (estado.leyendo) {
        dibujoPlay.setAttribute('hidden', '');
        dibujoPausa.removeAttribute('hidden');
      } else {
        dibujoPausa.setAttribute('hidden', '');
        dibujoPlay.removeAttribute('hidden');
      }
    }
    botonLeer.setAttribute('data-estado', estado.leyendo ? 'leyendo' : 'parado');
    var etiqueta = estado.leyendo ? 'Pausar la lectura' : 'Empezar a leer';
    botonLeer.setAttribute('aria-label', etiqueta);
    botonLeer.setAttribute('title', etiqueta);
  }

  /* La letra del marco. Se escribe como variable CSS en el marco, no en el
     <body>: asi el numero se guarda una vez y el motor (cuando exista) puede
     cambiarlo sin volver a escribir el estilo. */
  function pintarLetra() {
    marco.style.setProperty('--lectura-texto', estado.letra + 'rem');
    // El numero entre el T- y el T+ (el <output> de practica.html). Se muestra
    // sin decimal cuando es entero (3 en vez de 3.0), con un decimal cuando no
    // (2.75), que es como se lee de un vistazo y como cabe en el hueco.
    if (fuenteValor) {
      var v = estado.letra;
      fuenteValor.textContent = (v % 1 === 0)
        ? String(v)
        : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    }
  }

  /* ======================================================================
     GUARDAR Y RECUPERAR (POR MODO, CON DEBOUNCE DE 3s)
     ====================================================================== */

  /* Clave base -> clave con prefijo de modo actual.
     El modo viene en estado.motor (galactico, palabra, grupo, frases, etc.).
     Si no hay modo todavia, no se guarda (evita claves sucias). */
  function claveModo(base) {
    var m = estado.motor;
    if (!m) return null;
    return base + '_' + m;
  }

  function guardar(claveBase, valor) {
    var clave = claveModo(claveBase);
    if (!clave) return;
    if (!window.RetoDatos) return;
    try {
      var p = window.RetoDatos.poner(clave, valor);
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function recuperar(claveBase) {
    var clave = claveModo(claveBase);
    if (!clave) return Promise.resolve(undefined);
    if (!window.RetoDatos) return Promise.resolve(undefined);
    try {
      return window.RetoDatos.obtener(clave).catch(function () { return undefined; });
    } catch (e) { return Promise.resolve(undefined); }
  }

  /* DEBOUNCE DE 3 SEGUNDOS PARA AJUSTES DE MODO.
     Los sliders/colores/fuente disparan muchos eventos; se guarda UNA vez
     3s despues del ULTIMO cambio. El UI se actualiza en vivo (input), pero
     la escritura en IndexedDB espera a que la persona deje de tocar. */
  var pendienteModo = {};

  function guardarModo(claveBase, valor) {
    var clave = claveModo(claveBase);
    if (!clave) return;
    if (pendienteModo[clave]) clearTimeout(pendienteModo[clave]);
    pendienteModo[clave] = setTimeout(function () {
      pendienteModo[clave] = null;
      guardar(claveBase, valor);
    }, 3000);
  }

  /* WPM: debounce de 500ms (ya existia), pero ahora POR MODO. */
  var pendienteWpm = null;

  function guardarWpm(valor) {
    if (pendienteWpm) clearTimeout(pendienteWpm);
    pendienteWpm = setTimeout(function () {
      pendienteWpm = null;
      guardar('lectura_wpm', valor);
    }, 500);
  }

  /* Un valor guardado se acota a los topes antes de usarlo, y se comprueba que
     sea un numero. Sin esa comprobacion, un valor raro guardado a mano (o de
     una version vieja con otros topes) pondria la perilla fuera de la barra, o
     la letra en un tamano que no existe. Con la cuenta, lo raro se vuelve lo
     del medio. */
  function acotarWpm(v) {
    v = parseInt(v, 10);
    if (isNaN(v)) return WPM_POR_DEFECTO;
    v = Math.round(v / WPM_PASO) * WPM_PASO;
    return Math.min(WPM_GRANDE, Math.max(WPM_CHICA, v));
  }

  function cargarPreferencias() {
    return Promise.all([
      recuperar('lectura_wpm'),
      recuperar('lectura_letra'),
      recuperar('galactico_ancho_base'),
      recuperar('galactico_ancho_techo'),
      recuperar('galactico_angulo'),
      recuperar('galactico_interlineado'),
      recuperar('lectura_fuente'),
      recuperar('galactico_fondo'),
      recuperar('galactico_texto'),
      recuperar('palabra_fondo'),
      recuperar('palabra_texto'),
      recuperar('palabra_foco'),
      recuperar('grupo_fondo'),
      recuperar('grupo_texto'),
      recuperar('grupo_foco'),
      recuperar('frases_fondo'),
      recuperar('frases_texto'),
      recuperar('frases_interlineado'),
      recuperar('palabra_cantidad')
    ]).then(function (r) {
      if (r[0]) estado.wpm = acotarWpm(r[0]);
      if (r[1]) estado.letra = Math.min(LETRA_GRANDE, Math.max(LETRA_CHICA, r[1]));
      if (r[2] != null) estado.galAnchoBase    = acotarAjuste('anchoBase', r[2]);
      if (r[3] != null) estado.galAnchoTecho   = acotarAjuste('anchoTecho', r[3]);
      if (r[4] != null) estado.galAngulo       = acotarAjuste('angulo', r[4]);
      if (r[5] != null) estado.galInterlineado = acotarAjuste('interlineado', r[5]);
      if (typeof r[6] === 'string') estado.fuente = r[6];
      if (esHexValido(r[7])) estado.galFondo = r[7];
      if (esHexValido(r[8])) estado.galTexto = r[8];
      if (esHexValido(r[9]))  estado.palabraFondo = r[9];
      if (esHexValido(r[10])) estado.palabraTexto = r[10];
      if (esHexValido(r[11])) estado.palabraFoco = r[11];
      if (esHexValido(r[12])) estado.grupoFondo = r[12];
      if (esHexValido(r[13])) estado.grupoTexto = r[13];
      if (esHexValido(r[14])) estado.grupoFoco = r[14];
      if (esHexValido(r[15])) estado.frasesFondo = r[15];
      if (esHexValido(r[16])) estado.frasesTexto = r[16];
      if (r[17] != null) estado.frasesInterlineado = acotarAjusteDe(AJUSTES_FRASES.interlineado, r[17]);
      if (r[18] != null) estado.palabraCantidad = parseInt(r[18], 10) === 3 ? 3 : 1;
      pintarVelocidad();
      pintarLetra();
      aplicarColores();
      /* Los tres modos con colores propios, de una vez. Que se pinten al
         cargar y no solo al montar el motor es lo que hace que cambiar de una
         lectura a otra con el mismo ajuste no dé un salto de color. */
      aplicarColoresPalabra();
      aplicarColoresGrupo();
      aplicarColoresFrases();
    });
  }

  /* LA FUENTE. Se pone como variable CSS en el marco (igual que la letra) y el
     CSS la usa en .lectura-marco. Se espera a que la fuente CARGUE antes de
     ponerla: con otra fuente el texto mide otro alto, y si se pusiera antes se
     veria un salto (letra de repuesto primero, la buena despues). Con un limite
     de 2 segundos dentro de RetoFuentes, para que una fuente lenta no deje la
     lectura en blanco. Si RetoFuentes no esta, se queda la del sitio. */
  /* Los colores se escriben como variables CSS en <html>, no en el marco: el
     fondo tiene que pintar TODA la pantalla de lectura y una variable puesta
     en un descendiente no llega a los lados. El CSS (body.pantalla-lectura
     [data-galactico]) lee estas variables. */
  function aplicarColores() {
    var r = document.documentElement;
    r.style.setProperty('--galactico-fondo', estado.galFondo);
    r.style.setProperty('--galactico-texto', estado.galTexto);
  }

  function pintarFuente() {
    if (!window.RetoFuentes) return Promise.resolve();
    return window.RetoFuentes.aplicar(estado.fuente).then(function (f) {
      // Si la que se pidio ya no existe (la persona la quito), la que se aplico
      // es la del sitio, y el estado se corrige para no volver a pedir la rota.
      estado.fuente = f.id;
      marco.style.setProperty('--lectura-fuente', f.css);
      if (motor) motor.medir();
    });
  }

  /* LA GEOMETRIA DE LA PERSPECTIVA, EN UN SOLO SITIO
     La usan el motor (para la pantalla de lectura) y la vista previa del modal
     (para su cuadrito). Si cada uno tuviera su propia cuenta, un dia la vista
     previa dejaria de parecerse a lo que de verdad se ve.

       alto   el alto del escenario, en pixeles
       s0     la escala de entrada (1 = la letra tal cual)
       r      la escala de fin, como FRACCION de la de entrada (0.3 = el 30 %)

     devuelve
       perspectiva  la perspectiva en pixeles
       extra        cuantos pixeles del suelo tiene que correr el texto DESPUES
                    de que el ultimo renglon pase el borde de abajo, hasta que ese
                    renglon llegue a la escala de fin
       angulo       la inclinacion, en grados
       marca        a que altura de la pantalla queda el ultimo renglon cuando se
                    da por terminado, como fraccion del alto (0 = abajo, 1 =
                    arriba). Sale de la misma cuenta: a esa escala, el renglon
                    esta a  (1 - r) x ALCANCE  del borde de abajo. La usa el
                    modal para dibujar la raya de "aqui se pierde".

     LA CUENTA DE "extra"
     Un renglon a u pixeles (del suelo) sobre el borde de abajo se ve a escala
         s0 x d / (d + s0 x u x sen(ANGULO)),   con d = la perspectiva.
     Igualando eso a  s0 x r  y despejando u sale
         u = (1/r - 1) x d / (s0 x sen(ANGULO))
     y como d = alto x ALCANCE x tan(ANGULO), queda la cuenta de abajo. */
  function geometria(alto, anchoBase, anchoTecho, angulo) {
    var rad = angulo * Math.PI / 180;
    var sinA = Math.sin(rad);
    var dif = anchoBase - anchoTecho;
    var perspectiva;
    if (dif <= 0.001 || sinA <= 0.001) {
      perspectiva = alto * 20;
    } else {
      perspectiva = anchoTecho * alto * sinA / dif;
      perspectiva = Math.max(200, Math.min(perspectiva, alto * 20));
    }
    return {
      perspectiva: Math.round(perspectiva),
      angulo: angulo
    };
  }

  /* ======================================================================
     EL MOTOR GALACTICO
     ======================================================================

     El texto sube desde abajo, como en la apertura de una pelicula. Es el modo
     de jugar: no tiene estudios detras (motores-de-lectura.md, seccion 5).

     LA REGLA QUE LO HACE FUNCIONAR: SE GUARDA EL LUGAR, NO EL TIEMPO
     El motor guarda "y", los pixeles que el texto ya ha subido. En cada
     fotograma suma  velocidad x tiempo-desde-el-fotograma-anterior, y nada mas.

     La forma facil de hacerlo es calcular la posicion desde el tiempo
     transcurrido:  y = velocidad x (ahora - inicio). Funciona hasta que alguien
     mueve la barra de la velocidad: entonces el tiempo transcurrido se multiplica
     por la velocidad NUEVA, y el texto salta de golpe hacia adelante o hacia
     atras. Perder el lugar al cambiar la velocidad es lo peor que puede pasar
     (lectura-veloz.md, 3.2), porque el ajuste se hace justo cuando algo va mal.
     Sumando en cada fotograma, la velocidad solo cambia cuanto se suma desde ese
     momento, y el texto sigue donde estaba.

     LA VELOCIDAD EN PIXELES
     La velocidad pedida esta en palabras por minuto, y el navegador pinta
     pixeles. El puente es el alto del texto: si el texto mide H pixeles y tiene
     N palabras, cada palabra ocupa H/N pixeles, y a W palabras por minuto:

         pixeles por segundo = (H / N) x (W / 60)

     El N (las palabras) lo cuenta Python; el H (los pixeles) solo lo sabe el
     navegador. Esa es la division del trabajo.

     LA INCLINACION NO CAMBIA LA CUENTA
     El texto se mueve sobre el suelo inclinado, y "y" se sigue midiendo en
     pixeles DEL SUELO, no de la pantalla. Asi la velocidad de arriba es la misma
     cuenta, y lo unico que cambia es lo que ve el ojo: la perspectiva hace que
     lo de arriba parezca ir mas lento, porque esta mas lejos. El camino entero
     es el alto del texto mas lo que hace falta para que el ultimo renglon se
     pierda en el horizonte (ver recorrido).

     LAS FASES
       cuenta   3, 2, 1, para que la vista se acomode (un segundo por numero)
       sube     el texto sube y se pierde en el horizonte
       fin      dice "Fin" y se detiene; reiniciar vuelve a empezar

     Y el reloj de cada fotograma se acota a 0.1 s: si la pestana estuvo
     escondida cinco minutos, el navegador no pinta fotogramas, y al volver el
     primer "tiempo desde el anterior" seria de cinco minutos: el texto saldria
     disparado y se perderia la lectura entera. */

  /* LA PERSPECTIVA: TRES NUMEROS, Y POR QUE ESOS
       ANGULO       cuanto se inclina el suelo hacia atras. 24 grados es lo
                    bastante para que se note la fuga y lo bastante poco para que
                    la mitad de abajo se siga leyendo. Mas de 35 ya cansa.
       ALCANCE      a que altura queda el horizonte (el punto donde todo se
                    junta), como fraccion del alto del escenario: 0.9 es cerca
                    del borde de arriba. De aqui sale la perspectiva en pixeles:
                        perspectiva = alto x ALCANCE x tan(ANGULO)
                    Se calcula con el alto, y no se deja fija, porque con una
                    perspectiva fija el horizonte quedaria en un sitio distinto
                    en un celular que en una pantalla grande.

     Y una cuarta cosa que ya NO es constante: con que tamano se da por
     terminado el ultimo renglon. Esperar a que llegue a cero seria esperar casi
     para siempre (el horizonte se alcanza, pero nunca se toca), asi que se acaba
     cuando se ha encogido hasta un porcentaje. Ese porcentaje (y el de entrada)
     los elige la persona en el modal, y sus limites vienen de Python
     (ESCALA_INICIO y ESCALA_FIN en logica/lectura_veloz.py). */
  var ALCANCE = 0.9;

  var motor = null;   // el motor que esta activo; null = todavia no hay

  function crearGalactico(plan) {
    var escena = document.createElement('div');
    escena.className = 'galactico-escena';
    var texto = document.createElement('div');
    texto.className = 'galactico-texto';
    plan.parrafos.forEach(function (par) {
      var el = document.createElement('p');
      el.textContent = par.texto;          // textContent: el texto nunca es HTML
      if (par.titulo) el.setAttribute('data-titulo', '');
      texto.appendChild(el);
    });
    var cuenta = document.createElement('p');
    cuenta.className = 'galactico-cuenta';
    cuenta.setAttribute('role', 'status');
    cuenta.setAttribute('aria-live', 'polite');
    var plano = document.createElement('div');
    plano.className = 'galactico-plano';
    plano.appendChild(texto);
    escena.appendChild(plano);
    escena.appendChild(cuenta);

    // El aviso se queda donde esta: solo se le pone el escenario al lado.
    marco.setAttribute('data-motor', 'galactico');
    // El fondo y el color de la letra se pintan en TODA la pantalla (ver el
    // CSS), por eso se marca el body. Al limpiar el motor se quita la marca y
    // la pantalla vuelve a su fondo normal.
    document.body.setAttribute('data-galactico', '1');
    marco.appendChild(escena);

    var fase = 'cuenta';
    var restante = plan.cuenta_seg;
    var y = 0;                  // pixeles que el texto ya subio
    var altoEscena = 0;
    var altoTexto = 0;
    var raf = null;
    var ultimo = null;          // marca de tiempo del fotograma anterior

    /* Medir. El texto que sube no mide lo mismo con otra letra o en otra
       pantalla, asi que se vuelve a medir cuando cambia algo, y el lugar se
       guarda como FRACCION del camino (0 a 1), no como pixeles: pasar de 40 a
       80 caracteres por linea cambia el alto del texto, y 400 px de un camino
       que ahora mide el doble ya no es el mismo lugar. */
    var horizonte = 0;     // lo que el suelo debe correr PASADO el texto para que
                           // el ultimo renglon se pierda (en pixeles del suelo)

    function recorrido() { return altoTexto + horizonte; }

    function medir() {
      var antes = recorrido();
      var fraccion = antes > 0 ? y / antes : 0;

      /* LAS CUATRO MEDIDAS QUE ELIGE LA PERSONA
         anchoBase   el ancho del texto abajo, en % del escenario (81-93)
         anchoTecho  el ancho del texto arriba, en % del escenario (51-93)
         angulo      la inclinacion del suelo, en grados (1-33)
         interlinea  el espacio entre renglones (1-2)
         Las cuatro son independientes: mover una no cambia las otras. */
      var anchoBase = estado.galAnchoBase / 100;
      var anchoTecho = estado.galAnchoTecho / 100;

      texto.style.width = (anchoBase * 100) + '%';
      texto.style.lineHeight = estado.galInterlineado;

      altoEscena = escena.clientHeight;
      altoTexto = texto.offsetHeight;

      var g = geometria(altoEscena, anchoBase, anchoTecho, estado.galAngulo);
      escena.style.perspective = g.perspectiva + 'px';
      escena.style.setProperty('--galactico-angulo', g.angulo + 'deg');
      horizonte = altoEscena * ALCANCE;

      y = fraccion * recorrido();
      pintar();
    }

    function pintar() {
      // -50 % en horizontal: el texto esta pegado al 50 % del suelo y mide 100/s0 %
      // de ancho, asi que se jala la mitad de su propio ancho para quedar centrado.
      texto.style.transform = 'translate3d(-50%,' + Math.round(altoEscena - y) + 'px,0)';
    }

    /* Lo que dice el centro del escenario, y con que tamano: el numero de la
       cuenta es grande, la indicacion de "Toca para empezar" es chica (en
       letra grande la frase se comeria el escenario), y el "Fin" va mediano.
       El tamano lo decide el CSS segun data-fase. */
    function decirCentro(fase_, texto_) {
      cuenta.setAttribute('data-fase', fase_);
      cuenta.textContent = texto_;
    }

    function esperar() { decirCentro('espera', 'Toca ▶ para empezar'); }

    function pintarCuenta() {
      if (fase === 'cuenta') decirCentro('cuenta', String(Math.max(1, Math.ceil(restante))));
      else if (fase === 'fin') decirCentro('fin', 'Fin');
      else decirCentro('sube', '');
    }

    function terminar() {
      fase = 'fin';
      // El texto se desvanece: que el ultimo renglon "se pierda" es la idea. Sin
      // esto se quedaria ahi, chiquito, a medio camino del horizonte.
      escena.setAttribute('data-fin', '1');
      estado.leyendo = false;
      pintarEstado();
      pintarCuenta();
    }

    function paso(t) {
      raf = null;
      if (!estado.leyendo) return;
      var dt = ultimo === null ? 0 : Math.min((t - ultimo) / 1000, 0.1);
      ultimo = t;

      if (fase === 'cuenta') {
        restante -= dt;
        if (restante <= 0) { fase = 'sube'; }
        pintarCuenta();
      } else if (fase === 'sube') {
        // Lee estado.wpm en CADA fotograma: por eso cambiar la velocidad se
        // oye al instante, sin que el boton tenga que avisarle al motor.
        var velocidad = (altoTexto / plan.total_palabras) * (estado.wpm / 60);
        y += velocidad * dt;
        if (y >= recorrido()) { y = recorrido(); pintar(); terminar(); return; }
        pintar();
      }
      raf = requestAnimationFrame(paso);
    }

    var api = {
      reanudar: function () {
        if (fase === 'fin') api.reiniciar();
        if (raf !== null) return;
        ultimo = null;     // el primer fotograma no suma: no cuenta el rato en pausa
        raf = requestAnimationFrame(paso);
      },
      pausar: function () {
        if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
        ultimo = null;
      },
      reiniciar: function () {
        escena.removeAttribute('data-fin');
        fase = 'cuenta';
        restante = plan.cuenta_seg;
        y = 0;
        ultimo = null;
        pintar();
        esperar();      // quieto en la linea de salida, esperando el play
      },
      medir: medir,
      limpiar: function () {
        api.pausar();
        window.removeEventListener('resize', medir);
        if (marco.contains(escena)) marco.removeChild(escena);
        marco.removeAttribute('data-motor');
        document.body.removeAttribute('data-galactico');
      }
    };

    window.addEventListener('resize', medir);
    medir();
    // Las fuentes pueden terminar de cargar DESPUES de medir, y con otra letra
    // el texto mide otro alto: sin esto el primer recorrido saldria corto o
    // largo, sin ningun error.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
    // Quieto, antes de empezar: el texto esta fuera de la vista, abajo, y se
    // dice como empezar. Una pantalla vacia sin explicacion parece un fallo.
    esperar();
    return api;
  }

  /* ======================================================================
     EL MOTOR PALABRA POR PALABRA (RSVP)
     ======================================================================

     Cada palabra aparece en el MISMO punto de la pantalla, una tras otra. El
     ojo no tiene que moverse nunca: lo que se gana en velocidad es el tiempo de
     los saltos que se quitan (motores-de-lectura.md, seccion 2).

     UNA LETRA CENTRADA, NO LA PALABRA ENTERA
     Si se centrara la palabra entera, cada una empezaria en un sitio distinto
     y el ojo tendria que buscarla. Se centra UNA LETRA, la del punto de
     fijacion, y el resto cuelga a los lados: lo de antes, alineado a la
     derecha, y lo de despues, alineado a la izquierda (ver .palabra-linea en
     el CSS). Cual es esa letra la decide Python (punto_de_fijacion): aqui solo
     se parte la palabra por ese indice.

     UN SOLO INDICE MANDA
     Por donde va la lectura es estado.posicion, y nada mas. No hay un contador
     propio del motor: asi, reiniciar (que pone estado.posicion en 0) y el
     motor nunca se desincronizan (lectura-veloz.md, 5.2).

     EL TIEMPO SE SUMA, NO SE CALCULA (la misma regla del galactico)
     Se guarda cuanto lleva la palabra en pantalla (`transcurrido`) y en cada
     fotograma se le suma el tiempo desde el fotograma anterior. Se compara con
     la duracion que corresponde a la velocidad de ESE momento: asi, mover la
     barra a media palabra cambia lo que falta, no el lugar donde se va.
     Tambien por eso no se usa un setTimeout por palabra: una palabra de 1,2 s
     (velocidad 50) obligaria a esperar a que termine antes de notar que se
     subio la velocidad a 999.

     LA DURACION DE CADA PALABRA
         ms = (60 000 / ppm) x (pausa / pausa_base_ms)
     El primer factor es lo que dura una palabra sin signo a esa velocidad. El
     segundo es cuantas "palabras normales" pesa esta: 1 sin signo, 1,75 con
     coma, 3 con punto (la tabla de lectura-veloz.md, 2.2, que Python manda en
     `pausa` y `pausa_base_ms`). Los numeros viven en Python; aqui no se repite
     ninguno.

     UNA PALABRA POR FOTOGRAMA, COMO MAXIMO
     Si un fotograma se retrasa, lo que sobro de tiempo se guarda para la
     palabra siguiente, pero con tope de una palabra: sin el tope, tras un
     tirón se verian pasar varias palabras de golpe, y leer es justo lo que no
     se puede hacer con palabras que no se vieron. Y el reloj de cada fotograma
     se acota a 0,1 s por la misma razon que en el galactico: una pestana
     escondida no pinta fotogramas, y al volver el primer "tiempo desde el
     anterior" seria de minutos.

     LAS FASES
       cuenta   3, 2, 1, para que la vista se acomode (un segundo por numero)
       lee      las palabras, una por una
       fin      dice "Fin" y se detiene; reiniciar vuelve a empezar

     LO QUE VE UN LECTOR DE PANTALLA
     La linea de la palabra va con aria-hidden: anunciar una palabra por cada
     fotograma a 300 por minuto no es leer, es ruido. Lo unico que se anuncia es
     lo que dice el centro (la cuenta, "Fin"), que es un role="status". */
  function crearPalabra(plan) {
    var palabras = plan.palabras;
    var focos = plan.foco;
    var pausas = plan.pausa;
    var total = palabras.length;

    var escena = document.createElement('div');
    escena.className = 'palabra-escena';
    escena.setAttribute('data-cantidad', estado.palabraCantidad);
    marco.setAttribute('data-cantidad', estado.palabraCantidad);

    /* LAS PALABRAS VECINAS (modo de 3 palabras) VIVEN DENTRO DE LA LINEA.
       Antes eran hijas de la escena y se colocaban con un margen en % que no
       sabia cuanto media la palabra central: con una palabra larga ("Material")
       la vecina de la derecha quedaba debajo de su final y se encimaban.
       Ahora la vecina izquierda va dentro de la columna "antes" (pegada a su
       borde izquierdo, a un hueco de distancia) y la derecha dentro de
       "despues". Como esas columnas ya se acomodan al ancho real de la palabra,
       las vecinas nunca pueden pisarla, sea cual sea su largo. */
    var izq = document.createElement('span');
    izq.className = 'palabra-lateral palabra-izquierda';
    izq.setAttribute('aria-hidden', 'true');
    var der = document.createElement('span');
    der.className = 'palabra-lateral palabra-derecha';
    der.setAttribute('aria-hidden', 'true');

    var linea = document.createElement('p');
    linea.className = 'palabra-linea';
    linea.setAttribute('aria-hidden', 'true');
    var antesCaja = document.createElement('span');
    antesCaja.className = 'palabra-antes';
    var antes = document.createElement('span');
    antes.className = 'palabra-antes-texto';
    antesCaja.appendChild(izq);
    antesCaja.appendChild(antes);
    var foco = document.createElement('span');
    foco.className = 'palabra-foco';
    var despuesCaja = document.createElement('span');
    despuesCaja.className = 'palabra-despues';
    var despues = document.createElement('span');
    despues.className = 'palabra-despues-texto';
    despuesCaja.appendChild(despues);
    despuesCaja.appendChild(der);
    linea.appendChild(antesCaja);
    linea.appendChild(foco);
    linea.appendChild(despuesCaja);

    // Lo que dice el centro cuando no se esta leyendo: la cuenta, la
    // indicacion de empezar y el "Fin". Ocupa el mismo sitio que la palabra
    // (ver el CSS), para que nada se mueva al pasar de uno a otro.
    var centro = document.createElement('p');
    centro.className = 'palabra-centro';
    centro.setAttribute('role', 'status');
    centro.setAttribute('aria-live', 'polite');

    escena.appendChild(linea);
    escena.appendChild(centro);
    marco.setAttribute('data-motor', 'palabra');
    /* El fondo y el color de la letra se pintan en TODA la pantalla de lectura
       (ver el CSS), por eso se marca el body y no solo el marco. Al limpiar el
       motor se quita la marca y la pantalla vuelve a su fondo normal. Los
       colores se escriben una vez aqui, y no en cada fotograma: son un ajuste,
       no algo que cambie con el tiempo. */
    document.body.setAttribute('data-palabra', '1');
    aplicarColoresPalabra();
    marco.appendChild(escena);

    var fase = 'cuenta';
    var restante = plan.cuenta_seg;
    var transcurrido = 0;       // ms que lleva la palabra actual en pantalla
    var raf = null;
    var ultimo = null;          // marca de tiempo del fotograma anterior

    /* La palabra actual, partida por su letra de fijacion. Se parte por
       CARACTERES (Array.from) y no por unidades de texto, porque el indice de
       Python cuenta caracteres: con un emoji en medio, cortar por unidades lo
       correria una posicion. */
    function vaciarPalabra() {
      antes.textContent = '';
      foco.textContent = '';
      despues.textContent = '';
      izq.textContent = '';
      der.textContent = '';
    }

    function pintarPalabra() {
      /* NADA DE TEXTO ANTES DE TIEMPO. Mientras no se este en la fase "lee"
         (la espera, la cuenta regresiva y el "Fin") el texto ni siquiera se
         escribe en la pagina: esconderlo con CSS no basta, porque seguiria ahi
         (se podria leer con un lector de pantalla o ver un parpadeo al
         cambiar de ajustes). Se vacia, y se vuelve a llenar en el instante en
         que la cuenta llega a cero. */
      if (fase !== 'lee') { vaciarPalabra(); return; }
      var i = estado.posicion;
      var letras = Array.from ? Array.from(palabras[i]) : palabras[i].split('');
      var f = focos[i];
      /* UN CARACTER INVISIBLE (espacio de ancho cero) EN LOS PEDAZOS VACIOS.
         Un pedazo sin texto no tiene linea base, y las palabras vecinas se
         alinean por la linea base: cuando la letra de fijacion era la primera o
         la ultima de la palabra ("Un", "y"), la columna vacia las subia o
         bajaba unos pixeles. Con el caracter invisible el pedazo siempre tiene
         linea, y las vecinas quedan al mismo nivel en todas las palabras. */
      var VACIO = '\u200b';
      antes.textContent = letras.slice(0, f).join('') || VACIO;
      foco.textContent = letras[f] || VACIO;
      despues.textContent = letras.slice(f + 1).join('') || VACIO;

      if (estado.palabraCantidad === 3) {
        izq.textContent = (i > 0) ? palabras[i - 1] : '';
        der.textContent = (i < total - 1) ? palabras[i + 1] : '';
      } else {
        izq.textContent = '';
        der.textContent = '';
      }
    }

    /* Solo se escribe si cambio: reescribir el mismo texto en un role="status"
       puede hacer que el lector de pantalla lo repita en cada fotograma. */
    function decirCentro(fase_, texto_) {
      centro.setAttribute('data-fase', fase_);
      if (centro.textContent !== texto_) centro.textContent = texto_;
    }

    function pintarFase() {
      escena.setAttribute('data-fase', fase);
      if (fase === 'cuenta') decirCentro('cuenta', String(Math.max(1, Math.ceil(restante))));
      else if (fase === 'fin') decirCentro('fin', 'Fin');
      else decirCentro('lee', '');
    }

    function esperar() {
      escena.setAttribute('data-fase', 'espera');
      decirCentro('espera', 'Toca ▶ para empezar');
    }

    function duracion() {
      return (60000 / estado.wpm) * (pausas[estado.posicion] / plan.pausa_base_ms);
    }

    function terminar() {
      fase = 'fin';
      estado.leyendo = false;
      pintarEstado();
      pintarFase();
    }

    function paso(t) {
      raf = null;
      if (!estado.leyendo) return;
      var dt = ultimo === null ? 0 : Math.min(t - ultimo, 100);
      ultimo = t;

      if (fase === 'cuenta') {
        restante -= dt / 1000;
        if (restante <= 0) {
          fase = 'lee';
          transcurrido = 0;
          pintarPalabra();
        }
        pintarFase();
      } else if (fase === 'lee') {
        // Lee estado.wpm en CADA fotograma: cambiar la velocidad se nota al
        // instante, sin que el boton tenga que avisarle al motor.
        transcurrido += dt;
        var d = duracion();
        if (transcurrido >= d) {
          transcurrido = Math.min(transcurrido - d, d);
          if (estado.posicion >= total - 1) { terminar(); return; }
          estado.posicion += 1;
          pintarPalabra();
        }
      }
      raf = requestAnimationFrame(paso);
    }

    var api = {
      reanudar: function () {
        if (fase === 'fin') api.reiniciar();
        if (raf !== null) return;
        ultimo = null;     // el primer fotograma no suma: no cuenta el rato en pausa
        raf = requestAnimationFrame(paso);
      },
      pausar: function () {
        if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
        ultimo = null;
      },
      reiniciar: function () {
        fase = 'cuenta';
        restante = plan.cuenta_seg;
        transcurrido = 0;
        estado.posicion = 0;
        ultimo = null;
        pintarPalabra();
        esperar();      // quieto en la linea de salida, esperando el play
      },
      // Aqui no hay nada que medir (el CSS acomoda la linea); se deja para que
      // los dos motores tengan la misma forma y quien llame no tenga que saber
      // cual esta activo. Los colores y el interlineado no se miden: los
      // escribe aplicarColoresPalabra y el CSS, y son un ajuste, no una medida.
      medir: function () { pintarPalabra(); },
      limpiar: function () {
        api.pausar();
        if (marco.contains(escena)) marco.removeChild(escena);
        marco.removeAttribute('data-motor');
        document.body.removeAttribute('data-palabra');
      }
    };

    estado.posicion = 0;
    pintarPalabra();
    esperar();
    return api;
  }

  /* ======================================================================
     EL MOTOR PALABRAS EN GRUPO (CHUNK)
     ======================================================================
 
     Muestra 3 o 4 palabras a la vez en el mismo punto fijo (RSVP por grupos).
     El ORP (punto de fijación) está en la palabra central del grupo.
     Las palabras laterales tienen blur progresivo según su distancia al ORP.
 
     Python decide la agrupación y envía:
       - grupos: [{palabras: [...], orp_idx: int, pausa: ms}, ...]
       - total_palabras, total_grupos, pausa_base_ms, wpm, cuenta_seg
 
     El navegador pinta el grupo actual centrado en el ORP y cronometra.
     Cambiar tamano_grupo (3/4) recarga el plan.
 
     LA MISMA REGLA DE TIEMPO: acumula dt en cada frame, no recalcula desde inicio.
     ====================================================================== */
  function crearGrupo(plan) {
    var grupos = plan.grupos;
    var total = grupos.length;
    var tamanoGrupo = plan.tamano_grupo || 3;
 
    var escena = document.createElement('div');
    escena.className = 'grupo-escena';
 
    var linea = document.createElement('p');
    linea.className = 'grupo-linea';
    linea.setAttribute('aria-hidden', 'true');
    // Las palabras se crean dinámicamente en pintarGrupo
 
    var centro = document.createElement('p');
    centro.className = 'grupo-centro';
    centro.setAttribute('role', 'status');
    centro.setAttribute('aria-live', 'polite');
 
    escena.appendChild(linea);
    escena.appendChild(centro);
    marco.setAttribute('data-motor', 'grupo');
    /* El fondo, el color del texto y el del ORP son ajustes de este modo, asi
       que la marca va en el <body> (ver el CSS) y no solo en el marco. Al
       limpiar el motor se quita la marca y la pantalla vuelve a su fondo
       normal. Se escriben una vez aqui y no en cada fotograma: son un ajuste,
       no algo que cambie con el tiempo. */
    document.body.setAttribute('data-grupo', '1');
    aplicarColoresGrupo();
    marco.appendChild(escena);
 
    var fase = 'cuenta';
    var restante = plan.cuenta_seg;
    var transcurrido = 0;
    var raf = null;
    var ultimo = null;
 
    function pintarGrupo() {
      // Nada de texto hasta que termine la cuenta regresiva (ver crearPalabra).
      if (fase !== 'lee') {
        while (linea.firstChild) linea.removeChild(linea.firstChild);
        return;
      }
      var i = estado.posicion;
      var g = grupos[i];
      var palabras = g.palabras;
      var orpIdx = g.orp_idx;
      var n = palabras.length;
 
      // Limpiar y recrear spans para cada palabra
      while (linea.firstChild) linea.removeChild(linea.firstChild);
 
      for (var w = 0; w < n; w++) {
        var span = document.createElement('span');
        span.className = 'grupo-palabra';
        span.textContent = palabras[w];
        // Distancia al ORP para blur progresivo
        var dist = Math.abs(w - orpIdx);
        if (w === orpIdx) {
          span.classList.add('orp');
        } else if (dist === 1) {
          span.classList.add('cerca');
        } else if (dist === 2) {
          span.classList.add('lejos');
        } else {
          span.classList.add('lejanis');
        }
        linea.appendChild(span);
      }
    }
 
    function decirCentro(fase_, texto_) {
      centro.setAttribute('data-fase', fase_);
      if (centro.textContent !== texto_) centro.textContent = texto_;
    }
 
    function pintarFase() {
      escena.setAttribute('data-fase', fase);
      if (fase === 'cuenta') decirCentro('cuenta', String(Math.max(1, Math.ceil(restante))));
      else if (fase === 'fin') decirCentro('fin', 'Fin');
      else decirCentro('lee', '');
    }
 
    function esperar() {
      escena.setAttribute('data-fase', 'espera');
      decirCentro('espera', 'Toca ▶ para empezar');
    }
 
    function duracion() {
      var g = grupos[estado.posicion];
      return (60000 / estado.wpm) * (g.pausa / plan.pausa_base_ms);
    }
 
    function terminar() {
      fase = 'fin';
      estado.leyendo = false;
      pintarEstado();
      pintarFase();
    }
 
    function paso(t) {
      raf = null;
      if (!estado.leyendo) return;
      var dt = ultimo === null ? 0 : Math.min(t - ultimo, 100);
      ultimo = t;
 
      if (fase === 'cuenta') {
        restante -= dt / 1000;
        if (restante <= 0) {
          fase = 'lee';
          transcurrido = 0;
          pintarGrupo();
        }
        pintarFase();
      } else if (fase === 'lee') {
        // Lee estado.wpm en CADA fotograma: cambiar la velocidad se nota al instante.
        transcurrido += dt;
        var d = duracion();
        if (transcurrido >= d) {
          transcurrido = Math.min(transcurrido - d, d); // tope 1 grupo
          if (estado.posicion >= total - 1) { terminar(); return; }
          estado.posicion += 1;
          pintarGrupo();
        }
      }
      raf = requestAnimationFrame(paso);
    }
 
    var api = {
      reanudar: function () {
        if (fase === 'fin') api.reiniciar();
        if (raf !== null) return;
        ultimo = null;
        raf = requestAnimationFrame(paso);
      },
      pausar: function () {
        if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
        ultimo = null;
      },
      reiniciar: function () {
        fase = 'cuenta';
        restante = plan.cuenta_seg;
        transcurrido = 0;
        estado.posicion = 0;
        ultimo = null;
        pintarGrupo();
        esperar();
      },
      actualizarPlan: function (nuevoPlan, palabraActual) {
        // Recalcular posición: encontrar grupo que contiene palabraActual
        var pos = 0;
        var acum = 0;
        for (var i = 0; i < nuevoPlan.grupos.length; i++) {
          var g = nuevoPlan.grupos[i];
          if (acum + g.palabras.length > palabraActual) { pos = i; break; }
          acum += g.palabras.length;
        }
        // Actualizar referencias del closure
        grupos = nuevoPlan.grupos;
        total = grupos.length;
        tamanoGrupo = nuevoPlan.tamano_grupo || 3;
        plan = nuevoPlan;
        // Actualizar referencias en api para futuros hot-swaps
        api.plan = nuevoPlan;
        api.planOriginal = nuevoPlan.parrafosOriginales;
        estado.posicion = Math.min(pos, total - 1);
        pintarGrupo();
      },
      medir: function () { pintarGrupo(); },
limpiar: function () {
        api.pausar();
        if (marco.contains(escena)) marco.removeChild(escena);
        marco.removeAttribute('data-motor');
        document.body.removeAttribute('data-grupo');
      }
    };

    estado.posicion = 0;
    pintarGrupo();
    esperar();
    // Adjuntar referencias para hot-swap
    api.plan = plan;
    api.planOriginal = plan.parrafosOriginales;
    return api;
  }
 
  /* ======================================================================
     EL MOTOR FRASES COMPLETAS
     ======================================================================

     Muestra UNA ORACION ENTERA a la vez, centrada, y pasa a la siguiente
     cuando se acaba el tiempo que le toca. No fragmenta nada: es para quien
     entiende mejor viendo la idea completa (motores-de-lectura.md, seccion 4).

     Python decide donde termina cada frase (y corta las oraciones demasiado
     largas) y cuanto pesa. Manda:
       - frases: [{texto, palabras, pausa}, ...]   pausa: ms medidos a 300 ppm
       - total_palabras, total_frases, pausa_base_ms, wpm, cuenta_seg
     Aqui no se repite ninguna regla ni ninguna cifra.

     EL TIEMPO: LA MISMA CUENTA DE LOS OTROS DOS
         ms = (60 000 / ppm) x (pausa / pausa_base_ms)
     y la misma regla de sumar, no calcular: se guarda cuanto lleva la frase en
     pantalla (`transcurrido`) y en cada fotograma se le suma el tiempo desde el
     anterior (acotado a 0,1 s). Mover la velocidad a media frase cambia lo que
     falta, no el lugar donde se va. A lo mas una frase por fotograma. Por donde
     va la lectura es estado.posicion, y nadie mas (lectura-veloz.md, 5.2).

     LA BARRA QUE SE VACIA
     Debajo de la frase hay una barrita que empieza llena y se vacia durante el
     tiempo de esa frase. Es el ritmo hecho visible: se ve cuanto falta para la
     siguiente sin tener que contar. Se pinta con transform: scaleX (no con el
     ancho), que no obliga al navegador a volver a acomodar la pagina en cada
     fotograma. No es una animacion de CSS: la mueve el mismo reloj de arriba,
     asi que si se pausa, se queda quieta donde iba.

     QUE PASA SI LA FRASE NO CABE
     Python corta lo largo (hasta 25 palabras), pero con la letra grande en un
     celular ni eso cabe. Python no ve la pantalla; el navegador si. Por eso,
     solo cuando la frase se pasa del alto que tiene el marco, se achica la
     letra de ESA frase (un 10 % cada vez, hasta el 40 %) y la siguiente vuelve
     a empezar a tamano completo. No toca la letra que eligio la persona
     (estado.letra): es un ajuste de una sola frase.

     LAS FASES
       cuenta   3, 2, 1
       lee      las frases, una por una
       fin      dice "Fin" y se detiene; reiniciar vuelve a empezar

     LO QUE VE UN LECTOR DE PANTALLA
     La frase y la barra van con aria-hidden: anunciar una oracion cada par de
     segundos mientras se lee no es leer, es ruido. Solo se anuncia lo que dice
     el centro (la cuenta, "Fin"), que es un role="status". */
  function crearFrases(plan) {
    var frases = plan.frases;
    var total = frases.length;
    var ESCALA_MIN = 0.4;       // la letra de una frase nunca baja de este %
    var ESCALA_PASO = 0.9;      // y baja de a un 10 % por vez

    var escena = document.createElement('div');
    escena.className = 'frases-escena';

    var texto = document.createElement('p');
    texto.className = 'frases-texto';
    texto.setAttribute('aria-hidden', 'true');

    // Lo que dice el centro cuando no se esta leyendo. Ocupa el mismo sitio que
    // la frase (ver el CSS), para que nada se mueva al pasar de uno a otro.
    var centro = document.createElement('p');
    centro.className = 'frases-centro';
    centro.setAttribute('role', 'status');
    centro.setAttribute('aria-live', 'polite');

    var barra = document.createElement('div');
    barra.className = 'frases-barra';
    barra.setAttribute('aria-hidden', 'true');
    var relleno = document.createElement('span');
    relleno.className = 'frases-barra-relleno';
    barra.appendChild(relleno);

    escena.appendChild(texto);
    escena.appendChild(centro);
    escena.appendChild(barra);
    marco.setAttribute('data-motor', 'frases');
    /* Igual que en los otros modos: los colores son un ajuste del modo, se
       pintan una vez al montar y la marca se quita al limpiar. El
       interlineado tambien se escribe aqui (aplicarColoresFrases), asi que el
       motor no vuelve a medir nada por cambiar un ajuste. */
    document.body.setAttribute('data-frases', '1');
    aplicarColoresFrases();
    marco.appendChild(escena);

    var fase = 'cuenta';
    var restante = plan.cuenta_seg;
    var transcurrido = 0;       // ms que lleva la frase actual en pantalla
    var raf = null;
    var ultimo = null;          // marca de tiempo del fotograma anterior
    var tope = 0;               // alto que tiene el marco para la frase, en px

    /* El alto que de verdad tiene el marco para la frase. Se mide con la letra
       al minimo: el marco crece con lo que lleva dentro, y con una frase larga
       encima el "alto del marco" seria el de la frase, que es justo lo que se
       quiere comparar. Con la letra chica el marco es lo que le sobra a la
       pagina. Se mide al abrir y cuando algo cambia (ventana, letra, fuente),
       no en cada frase. Sin pantalla (tope 0) no hay nada que ajustar. */
    function medirTope() {
      escena.style.setProperty('--frases-escala', String(ESCALA_MIN));
      var cs = window.getComputedStyle(marco);
      var hueco = parseFloat(window.getComputedStyle(barra).marginTop) || 0;
      tope = marco.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) -
             barra.offsetHeight - hueco;
      if (!(tope > 0)) tope = 0;
    }

    /* Se parte de la letra completa y se achica solo lo que haga falta. */
    function ajustar() {
      var escala = 1;
      escena.style.setProperty('--frases-escala', '1');
      if (!tope) return;
      while (texto.offsetHeight > tope && escala > ESCALA_MIN) {
        escala = Math.max(ESCALA_MIN, escala * ESCALA_PASO);
        escena.style.setProperty('--frases-escala', String(escala));
      }
    }

    function pintarFrase() {
      // Nada de texto hasta que termine la cuenta regresiva (ver crearPalabra).
      if (fase !== 'lee') { texto.textContent = ''; return; }
      texto.textContent = frases[estado.posicion].texto;
      ajustar();
    }

    function duracion() {
      return (60000 / estado.wpm) * (frases[estado.posicion].pausa / plan.pausa_base_ms);
    }

    /* La barra: llena al empezar la frase, vacia cuando se acaba su tiempo. */
    function pintarBarra() {
      var d = duracion();
      var llena = (fase === 'lee' && d > 0) ? Math.max(0, 1 - transcurrido / d) : 1;
      relleno.style.transform = 'scaleX(' + llena + ')';
    }

    /* Solo se escribe si cambio: reescribir el mismo texto en un role="status"
       puede hacer que el lector de pantalla lo repita en cada fotograma. */
    function decirCentro(fase_, texto_) {
      centro.setAttribute('data-fase', fase_);
      if (centro.textContent !== texto_) centro.textContent = texto_;
    }

    function pintarFase() {
      escena.setAttribute('data-fase', fase);
      if (fase === 'cuenta') decirCentro('cuenta', String(Math.max(1, Math.ceil(restante))));
      else if (fase === 'fin') decirCentro('fin', 'Fin');
      else decirCentro('lee', '');
    }

    function esperar() {
      escena.setAttribute('data-fase', 'espera');
      decirCentro('espera', 'Toca ▶ para empezar');
    }

    function terminar() {
      fase = 'fin';
      estado.leyendo = false;
      pintarEstado();
      pintarFase();
    }

    function paso(t) {
      raf = null;
      if (!estado.leyendo) return;
      var dt = ultimo === null ? 0 : Math.min(t - ultimo, 100);
      ultimo = t;

      if (fase === 'cuenta') {
        restante -= dt / 1000;
        if (restante <= 0) {
          fase = 'lee';
          transcurrido = 0;
          pintarFrase();
          pintarBarra();
        }
        pintarFase();
      } else if (fase === 'lee') {
        // Lee estado.wpm en CADA fotograma: cambiar la velocidad se nota al
        // instante, sin que el boton tenga que avisarle al motor.
        transcurrido += dt;
        var d = duracion();
        if (transcurrido >= d) {
          transcurrido = Math.min(transcurrido - d, d);   // tope: una frase
          if (estado.posicion >= total - 1) { terminar(); return; }
          estado.posicion += 1;
          pintarFrase();
        }
        pintarBarra();
      }
      raf = requestAnimationFrame(paso);
    }

    /* La ventana cambio de tamano, o la letra, o la fuente: se vuelve a medir.
       Si el motor ya se quito (limpiar), no hay nada que medir. */
    function medir() {
      if (!marco.contains(escena)) return;
      medirTope();
      pintarFrase();
    }

    var api = {
      reanudar: function () {
        if (fase === 'fin') api.reiniciar();
        if (raf !== null) return;
        ultimo = null;     // el primer fotograma no suma: no cuenta el rato en pausa
        raf = requestAnimationFrame(paso);
      },
      pausar: function () {
        if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
        ultimo = null;
      },
      reiniciar: function () {
        fase = 'cuenta';
        restante = plan.cuenta_seg;
        transcurrido = 0;
        estado.posicion = 0;
        ultimo = null;
        pintarFrase();
        pintarBarra();
        esperar();      // quieto en la linea de salida, esperando el play
      },
      medir: medir,
      limpiar: function () {
        api.pausar();
        window.removeEventListener('resize', medir);
        if (marco.contains(escena)) marco.removeChild(escena);
        marco.removeAttribute('data-motor');
        document.body.removeAttribute('data-frases');
      }
    };

    window.addEventListener('resize', medir);
    estado.posicion = 0;
    medirTope();
    pintarFrase();
    pintarBarra();
    // Las fuentes pueden terminar de cargar DESPUES de medir, y con otra letra
    // la frase mide otro alto.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
    esperar();
    return api;
  }

  /* De un libro o texto guardado a una lista plana de parrafos. El arbol trae
     titulos (t:'n') con hijos y parrafos (t:'p'); aqui se aplana en orden, y
     los titulos se quedan como un parrafo mas, en negrita, para que se note
     donde cambia el capitulo. */
  function aplanarArbol(nodos, salida, nivel) {
    nivel = nivel || 1;
    (nodos || []).forEach(function (nodo) {
      if (nodo.t === 'n') {
        // El nivel ([N1] a [N4]) es lo hondo que esta el titulo; lo usa el skimming.
        if (nodo.titulo) salida.push({ texto: nodo.titulo, titulo: true, nivel: Math.min(4, nivel) });
        aplanarArbol(nodo.hijos, salida, nivel + 1);
      } else if (nodo.txt) {
        salida.push({ texto: nodo.txt });
      }
    });
    return salida;
  }

  /* Pedirle el plan a Python. Las reglas (cuantas palabras, que se descarta,
     cuando un texto es demasiado grande) viven alla; aqui solo se manda y se
     recibe. Si el sitio se abrio sin servidor, no hay plan y se dice. */
  function pedirPlan(parrafos, nombre, tamano_grupo, extras) {
    var body = { motor: nombre, parrafos: parrafos.map(function (x) { return x.texto; }) };
    // El skimming necesita saber cuales son titulos y de que nivel ([N1]-[N4]).
    if (nombre === 'skimming') {
      body.parrafos = parrafos.map(function (x) {
        return { texto: x.texto, titulo: !!x.titulo, nivel: x.nivel || 0 };
      });
    }
    if (tamano_grupo) body.tamano_grupo = tamano_grupo;
    if (extras) Object.keys(extras).forEach(function (k) { body[k] = extras[k]; });

    // MODO OFFLINE: usar RetoLecturaVeloz local
    if (window.RetoOfflineCache && window.RetoOfflineCache.isOffline() && window.RetoLecturaVeloz) {
      try {
        var plan = window.RetoLecturaVeloz['plan' + nombre.charAt(0).toUpperCase() + nombre.slice(1)];
        if (plan) {
          return Promise.resolve(plan(parrafos.map(function (x) { return x.texto; })));
        }
      } catch (e) {
        console.warn('[Lectura] Error offline:', e);
      }
    }

    // MODO ONLINE
    return fetch('/api/lectura/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (datos) {
        if (!r.ok) throw new Error(datos && datos.error ? datos.error : 'No se pudo preparar la lectura.');
        return datos;
      });
    });
  }

  /* LOS MOTORES QUE VIVEN EN OTROS ARCHIVOS.
     reto-lectura-registro.js crea window.RetoLecturaMotores y cada archivo
     (prueba, pacer, skimming) anota ahi su fabrica. Se pregunta aqui, cada vez,
     y no se guarda: asi el orden en que cargan los scripts no importa. */
  function motoresNuevos() { return window.RetoLecturaMotores || null; }

  function esMotorConocido(nombre) {
    return nombre === 'galactico' || nombre === 'palabra' || nombre === 'grupo' ||
           nombre === 'frases' || !!(motoresNuevos() && motoresNuevos().existe(nombre));
  }

  /* Lo que se les entrega a los motores de otros archivos: el estado y lo
     poco que necesitan de este. No ven nada mas de aqui. */
  function contextoMotores() {
    return {
      estado: estado,
      marco: marco,
      decir: decir,
      pintarEstado: pintarEstado,
      guardar: guardar,
      recuperar: recuperar,
      pedirPlan: pedirPlan,
      ponerVelocidad: ponerVelocidad,
      /* El motor avisa que se acabo: la lectura se para y el boton vuelve a
         ser un play. */
      detener: function () { estado.leyendo = false; pintarEstado(); }
    };
  }

  /* Prepara el motor que pide la direccion: pide el plan a Python y monta el
     motor con el. Hasta aqui los dos motores hacen lo mismo (leer el texto
     guardado, pedir el plan, avisar si algo falla); lo unico que cambia es
     CUAL se monta, y eso esta en el if de abajo. */
  function cargarMotor(nombre) {
    if (!window.RetoDatos || !window.RetoDatos.libros) {
      decir('No se pudo abrir la biblioteca de este navegador.');
      return;
    }
    window.RetoDatos.libros.obtener(estado.textoId).then(function (doc) {
      if (!doc) throw new Error('Ese texto no está en este navegador. Vuelve y elige otro.');
      var parrafos = aplanarArbol(doc.arbol, []);
      return pedirPlan(parrafos, nombre).then(function (plan) {
        // Guardar párrafos originales para hot-swap de grupo
        plan.parrafosOriginales = parrafos;
        // Sin "escala" el servidor es de una version anterior a este modal (se
        // abrio servidor.cmd antes de actualizar los archivos). Se dice, en vez
        // de inventar unos limites aqui: los numeros son de Python.
        // Los cuatro ajustes de forma ya estan en estado: los puso
        // cargarPreferencias desde el navegador. El plan del servidor no
        // trae nada de esto, ni falta que hace.
        if (motor) motor.limpiar();
        if (nombre === 'galactico') {
          // El plan descarta parrafos vacios; se vuelve a marcar cual era
          // titulo por el texto, porque Python solo devuelve texto limpio.
          var titulos = {};
          parrafos.forEach(function (x) { if (x.titulo) titulos[x.texto.split(/\s+/).join(' ')] = true; });
          plan.parrafos.forEach(function (par) { if (titulos[par.texto]) par.titulo = true; });
          motor = crearGalactico(plan);
          // El boton de ajustes ya se mostro al entrar (ver mostrarAjustes):
          // no se repite aqui porque es el mismo boton en los dos modos.
        } else if (nombre === 'palabra') {
          motor = crearPalabra(plan);
        } else if (nombre === 'grupo') {
          // El modo grupo (chunk) usa tamanoGrupo del estado (3 o 4).
          // El plan ya trae tamano_grupo desde Python.
          motor = crearGrupo(plan);
          actualizarToggleGrupo();
        } else if (nombre === 'frases') {
          // Frases completas: cada oracion con su peso. Sin modal de ajustes
          // ni toggle de grupo: lo unico que se elige es la velocidad y la letra.
          motor = crearFrases(plan);
        } else if (motoresNuevos() && motoresNuevos().existe(nombre)) {
          // Prueba de velocidad, pacer, columnas y skimming: viven en sus
          // propios archivos (reto-lectura-*.js) y se anotan en
          // window.RetoLecturaMotores. Aqui solo se les da el contexto.
          document.body.setAttribute('data-modo', nombre);
          motor = motoresNuevos().fabricas[nombre](contextoMotores(), plan);
        } else {
          motor = crearPalabra(plan);
        }
        try { localStorage.setItem('reto_biblioteca_ultimo', doc.id); } catch (e) {}
      });
    }).catch(function (e) {
      // Un fallo de red del fetch trae un mensaje en ingles ("Failed to
      // fetch"); a la persona se le dice lo que puede hacer.
      var m = e && e.message ? e.message : '';
      if (/fetch|network|load failed/i.test(m) || !m) {
        m = 'No se pudo preparar la lectura. Abre el sitio con servidor.cmd: ' +
            'este modo necesita el servidor.';
      } else if (/todav[ií]a no est[aá] listo/i.test(m)) {
        // Un servidor de una version anterior no conoce el motor que se pidio
        // y contesta eso. Es lo que pasa si se actualizaron los archivos sin
        // cerrar y volver a abrir servidor.cmd.
        m = 'El servidor es de una versión anterior. Ciérralo y vuelve a abrir servidor.cmd.';
      }
      decir(m);
    });
  }

  /* Una escala dentro de su rango y de su paso. Es la misma regla que
     acotar_escala de Python; se repite aqui porque lo guardado se acota al
     leerlo, antes de tener al servidor. Los limites SON los del plan. */
  function acotarAjuste(clave, v) {
    var r = AJUSTES[clave];
    v = parseFloat(v);
    if (isNaN(v) || !isFinite(v)) return r.defecto;
    v = Math.round(v / r.paso) * r.paso;
    return Math.min(r.max, Math.max(r.min, v));
  }

    /* El boton de 3/4 palabras NACE ESCONDIDO y solo sale en el modo grupo.
     El nombre del modo se sabe de la direccion, asi que se enseña de
     inmediato, sin esperar al plan: si se hiciera despues, el boton
     apareceria un segundo tarde en el modo que si lo usa, que es peor que
     que no apareciera nunca en los otros.

     Y hay una razon de fondo para esconderlo y no solo para quitarlo: el
     proyecto ya decidio que "un boton que no puede hacer nada no se apaga,
     avisa". Ese aviso sirve cuando el boton esta ahi y la persona todavia no
     sabe que no aplica; pero un control que no aplica de plano, en una
     pantalla donde la unidad de lectura es una sola palabra, no es una
     limitacion temporal: es un control de otro modo. Ahi esconderlo es lo
     honesto. */
  function mostrarBotonGrupo() {
    if (estado.motor !== 'grupo') return;
    var b = document.querySelector('[data-grupo]');
    if (!b) return;
    b.removeAttribute('hidden');
    actualizarToggleGrupo();
  }

/* El boton de los ajustes esta escondido en el HTML y aparece cuando el modo
     de la direccion es uno que tiene ajustes. Un boton que abre un modal de
     ajustes de algo que no esta seria un boton que no hace nada.

     SE MUESTRA ANTES DE QUE LLEGUE EL PLAN, a proposito: pedirle el plan a
     Python tarda (una ida y vuelta al servidor), y el boton aparecia un
     segundo despues de entrar. Ese segundo se sentia como "esta pagina no
     tiene nada de ajustes". Si se aprieta antes de que el motor este listo, el
     modal lo dice (ver reto-lectura-ajustes.js): avisa, no falla en silencio.
     El nombre del boton tambien cambia con el modo, porque no es lo mismo lo
     que ajusta cada uno, y quien usa un lector de pantalla oye el texto. */
  var MODOS_CON_AJUSTES = { galactico: true, palabra: true, grupo: true, frases: true,
                            pacer: true, columnas: true, skimming: true };

  function mostrarAjustes() {
    var b = document.querySelector('[data-ajustes]');
    if (!b) return;
    b.removeAttribute('hidden');
    var nombre = { galactico: 'Ajustes de la animación y la fuente',
                 palabra:   'Ajustes de la lectura',
                 grupo:     'Ajustes de la lectura',
                 frases:    'Ajustes de la lectura',
                 pacer:     'Ajustes de la guía de lectura',
                 columnas:  'Ajustes de la lectura en columnas',
                 skimming:  'Ajustes de la lectura diagonal' }[estado.motor] || 'Ajustes';
    b.setAttribute('aria-label', nombre);
    b.setAttribute('title', nombre);
  }

  /* LO QUE EL MODAL DE AJUSTES PUEDE TOCAR. Es lo unico que sale de este
     archivo: el estado y el motor siguen siendo de aqui, y el modal (en
     reto-lectura-ajustes.js) pide y avisa, nada mas. */
  window.RetoLectura = {
    listo: function () { return !!motor; },

    /* Que motor esta montado. El modal de ajustes lo necesita para saber si
       tiene que mostrar los controles de la escena (galactico) o los de los
       colores y el interlineado (palabra por palabra). Sin esto, el modal
       tendria que adivinarlo por los controles que finds. */
    motor: function () { return estado.motor; },

    obtener: function () {
      var d = {
        anchoBase:    estado.galAnchoBase,
        anchoTecho:   estado.galAnchoTecho,
        angulo:       estado.galAngulo,
        interlineado: estado.galInterlineado,
        fondo:        estado.galFondo,
        texto:        estado.galTexto,
        fuente:       estado.fuente,
        ajustes:      AJUSTES,
        ajustesFrases: AJUSTES_FRASES,
        frasesInterlineado: estado.frasesInterlineado,
        palabraCantidad: estado.palabraCantidad
      };
      /* Los colores de los otros tres modos salen de la tabla COLORES, cada
         uno en dos versiones: el ajuste (que puede estar vacio) y el color que
         se ESTA VIENDO (que si esta vacio es el del tema). El modal usa el
         segundo, porque una rueda de color no puede quedarse en blanco: si el
         ajuste esta vacio y la persona no toca nada, el ajuste sigue vacio y
         el color sigue siendo el del tema. */
      Object.keys(COLORES).forEach(function (clave) {
        d[clave] = estado[COLORES[clave].destino];
        d[clave + 'Visto'] = colorEfectivo(clave);
      });
      return d;
    },

    /* clave: 'anchoBase' | 'anchoTecho' | 'angulo' | 'interlineado' | 'fondo' | 'texto' | 'fuente'
       | 'palabraFondo' | 'palabraTexto' | 'palabraFoco'.
       Devuelve el valor que quedo (ya acotado), o la promesa de la fuente.
       Los ajustes se ven al instante; se guardan con debounce de 3s tras el
       ultimo cambio (guardarModo), para no escribir en IndexedDB en cada pixel
       del arrastre. */
    poner: function (clave, valor) {
      if (AJUSTES[clave]) {
        var v = acotarAjuste(clave, valor);
        if (clave === 'anchoBase')         estado.galAnchoBase = v;
        else if (clave === 'anchoTecho')   estado.galAnchoTecho = v;
        else if (clave === 'angulo')       estado.galAngulo = v;
        else if (clave === 'interlineado') estado.galInterlineado = v;
        if (motor) motor.medir();
        guardarModo('galactico_' + clave, v);
        return v;
      }
      if (clave === 'fondo' || clave === 'texto') {
        if (!esHexValido(valor)) return;
        var c = valor.toLowerCase();
        if (clave === 'fondo') estado.galFondo = c;
        else estado.galTexto = c;
        aplicarColores();
        guardarModo('galactico_' + clave, c);
        return c;
      }
      /* Los colores de palabras, grupo y frases. Los ocho aceptan el valor VACIO,
         que significa "el del tema": se quita la variable y el CSS vuelve al
         --surface / --text / --accent. Sin eso no habria forma de deshacer un
         color que ya no le gusta a la persona sin salir de la pantalla.

         Los tres nombres van en la tabla COLORES; aqui solo se pregunta si la
         clave esta en ella. Un modo nuevo con colores es una fila mas en esa
         tabla, no un "if" mas aqui. */
      if (COLORES[clave]) {
        var c = (valor === '' || valor == null) ? '' : String(valor).trim().toLowerCase();
        if (c && !esHexValido(c)) return;
        var fila = COLORES[clave];
        estado[fila.destino] = c;
        fila.pintar();
        guardarModo(fila.clave, c);
        return c;
      }
      /* El interlineado del modo frases. Es el unico de los modos con texto
         largo, y por eso el unico donde el ajuste se ve. Al cambiarlo hay que
         volver a medir: el texto ocupa mas o menos renglones, y de eso depende
         el tamaño de letra que el motor calcula para que quepa en la pantalla. */
      if (clave === 'frasesInterlineado') {
        var vi = acotarAjusteDe(AJUSTES_FRASES.interlineado, valor);
        estado.frasesInterlineado = vi;
        if (motor && motor.medir) motor.medir();
        guardarModo('frases_interlineado', vi);
        return vi;
      }
      if (clave === 'palabraCantidad') {
        var qc = parseInt(valor, 10) === 3 ? 3 : 1;
        estado.palabraCantidad = qc;
        var escenaAct = marco.querySelector('.palabra-escena');
        if (escenaAct) escenaAct.setAttribute('data-cantidad', qc);
        if (marco) marco.setAttribute('data-cantidad', qc);
        if (motor && motor.medir) motor.medir();
        guardarModo('palabra_cantidad', qc);
        return qc;
      }
      if (clave === 'fuente') {
        estado.fuente = String(valor);
        return pintarFuente().then(function () {
          guardarModo('lectura_fuente', estado.fuente);
          return estado.fuente;
        });
      }
      return undefined;
    },

    /* Los ajustes de cada modo, a como vienen de fabrica.

         El galactico tiene dos colores FIJOS porque ese modo es una escena con
         esos dos colores, y cuatro escalas con sus limites.

         Los otros tres vuelven a los del tema, que es lo que se ve si la
         persona no toca nada, y por eso se restablecen con '' (vacio) y no con
         un color: vacio es "el del tema", y no hay ningun color de fabrica que
         medir en los cinco temas. El unico ajuste con numero propio es el
         interlineado de frases, que si tiene un valor de partida.

         Los colores se restablecen TODOS de una vez, con la misma tabla que usa
         poner(), para que los ocho se restablezcan unos con otros y no se quede
         ninguno sin volver al del tema. */
    restablecer: function () {
      window.RetoLectura.poner('anchoBase', AJUSTES.anchoBase.defecto);
      window.RetoLectura.poner('anchoTecho', AJUSTES.anchoTecho.defecto);
      window.RetoLectura.poner('angulo', AJUSTES.angulo.defecto);
      window.RetoLectura.poner('interlineado', AJUSTES.interlineado.defecto);
      window.RetoLectura.poner('fondo', '#000000');
      window.RetoLectura.poner('texto', '#ffe81f');
      Object.keys(COLORES).forEach(function (clave) {
        window.RetoLectura.poner(clave, '');
      });
      window.RetoLectura.poner('frasesInterlineado', AJUSTES_FRASES.interlineado.defecto);
      window.RetoLectura.poner('palabraCantidad', 1);
      return window.RetoLectura.poner('fuente', window.RetoFuentes ? window.RetoFuentes.POR_DEFECTO : 'nunito');
    },

    /* Para cuando se abre un modal encima: se para la lectura y se devuelve la
       funcion que la reanuda SOLO si estaba leyendo. Abrir los ajustes no debe
       dejar el texto corriendo por detras, y cerrarlos no debe arrancar una
       lectura que ya estaba parada. */
    suspender: function () {
      var leia = estado.leyendo;
      if (leia) {
        estado.leyendo = false;
        pintarEstado();
        if (motor) motor.pausar();
      }
      return function () {
        if (leia && motor) {
          estado.leyendo = true;
          pintarEstado();
          motor.reanudar();
        }
      };
    },

    geometria: geometria
  };

  /* ======================================================================
     LO QUE HACEN LOS BOTONES
     ====================================================================== */

  function hayTexto() { return !!estado.textoId; }

  /* LEER / PAUSAR. Sin motor todavia, esto explica; con motor, esto arranca y
     esto detiene. Se dejan las dos lineas separadas para que el motor entre
     despues sin reescribir el boton. */
  function alternarLectura() {
    if (!hayTexto()) {
      window.RetoDialogo.informar({
        titulo: 'Todavia no hay nada que leer',
        texto: 'Primero elige un texto. Vuelve con la flecha y elige uno de tus ' +
               'textos o libros, y aqui se leera solo.'
      });
      return;
    }
    if (!motor) {
      // Hay texto pero no hay motor: o este modo todavia no existe, o el
      // texto aun se esta preparando. No se finge que lee.
      if (!esMotorConocido(estado.motor)) {
        window.RetoDialogo.informar({
          titulo: 'Este modo todavía no está listo',
          texto: 'Vuelve y elige uno de los modos de lectura que sí funcionan.'
        });
      }
      return;
    }
    estado.leyendo = !estado.leyendo;
    pintarEstado();
    if (estado.leyendo) motor.reanudar(); else motor.pausar();
  }

  function reiniciar() {
    if (!hayTexto()) {
      window.RetoDialogo.informar({
        titulo: 'No hay nada que reiniciar',
        texto: 'Todavia no has elegido un texto. Cuando elijas uno, este ' +
               'boton lo vuelve a empezar desde la primera palabra.'
      });
      return;
    }
    estado.posicion = 0;
    if (motor) {
      // Vuelve al principio y se queda quieto, esperando el play: reiniciar
      // no es "leer otra vez", es "ponerlo en la linea de salida".
      motor.pausar();
      motor.reiniciar();
      estado.leyendo = false;
      pintarEstado();
    }
  }

  /* LA VELOCIDAD, Y POR QUE ES "EN EL MOMENTO"

     Esta funcion es el corazon del control, y los tres caminos (la barra, el
     boton de mas y el de menos) entran por aqui. Que entren por la misma
     puerta es lo que hace que los tres hagan lo mismo de verdad y no "casi lo
     mismo": si cada uno tocara el estado por su cuenta, un dia uno aplicaria el
     cambio y otro no, y la barra y los botones dejarian de llevar el mismo
     ritmo.

     "EN EL MOMENTO" significa dos cosas concretas:

       - se guarda la posicion (donde va por la lectura) y NO se toca. El
         cambio de ritmo no reinicia nada: se sigue leyendo donde se estaba, solo
         que mas rapido o mas lento. Perder el lugar en un cambio de velocidad
         es la peor cosa que puede pasar, porque el ajuste se hace justamente
         cuando algo va mal;

       - se guarda la preferencia, para que la proxima vez ya empiece asi.

     Cuando exista el motor, este es el unico sitio que hay que tocar para que
     el cambio de velocidad se oiga: el motor lee "estado.wpm" y recalcula el
     tiempo de la proxima palabra. */
  function ponerVelocidad(v) {
    v = acotarWpm(v);
    if (v === estado.wpm) {
      // Aunque no cambie el numero, se repinta: asi la barra y el numero quedan
      // descuadrados despues de haberlos tocado de mas, sin que se note.
      pintarVelocidad();
      return;
    }
    estado.wpm = v;
    pintarVelocidad();
    guardarWpm(v);
    // El motor lee estado.wpm en cada fotograma: no hay nada que avisarle.
  }

  /* LA LETRA. Un paso de 0.25 rem cada vez. En los topes NO se apaga el boton:
     avisa por el dialogo que ya no se puede. */
  function cambiarLetra(mas) {
    var antes = estado.letra;
    var despues = antes + (mas ? MARGEN : -MARGEN);
    // Un paso mas alla del tope para que el boton "suene" igual que los demas.
    if (despues > LETRA_GRANDE) {
      window.RetoDialogo.informar({
        titulo: 'Ya está en el máximo',
        texto: 'La letra no puede ser más grande. A este tamaño ya no caben ' +
               'dos palabras en una línea.'
      });
      return;
    }
    if (despues < LETRA_CHICA) {
      window.RetoDialogo.informar({
        titulo: 'Ya está en el mínimo',
        texto: 'La letra no puede ser más chica. A este tamaño ya no se lee, ' +
               'aunque tengas buenas lentes.'
      });
      return;
    }
    estado.letra = redondear(despues, 2);
    pintarLetra();
    if (motor) motor.medir();
    guardarModo('lectura_letra', estado.letra);
  }

  /* Redondear a centesimas, para que el numero guardado no salga con decimales
     de ruido de coma flotante (0.1+0.2 = 0.30000000000000004). */
  function redondear(x, d) {
    var m = Math.pow(10, d);
    return Math.round(x * m) / m;
  }

  /* ======================================================================
     CONECTAR LOS BOTONES
     ====================================================================== */

  if (botonLeer) botonLeer.addEventListener('click', alternarLectura);
  if (botonReiniciar) botonReiniciar.addEventListener('click', reiniciar);

  /* LA BARRA DE LA VELOCIDAD

     Se escucha el evento "input", no el "change". La diferencia es lo que hace
     que esto sea de verdad "en tiempo real":

       - "change" solo dispara cuando se SUELTA la perilla. Con el raton o el
         dedo seria un solo salto al final, y mientras arrastras no se veria
         nada cambiar;
       - "input" dispara en cada movimiento. La perilla se arrastra y el numero
         sube con ella, sin soltar.

     Al soltar no se hace nada extra a proposito: "input" ya habia guardado cada
     paso. */

  if (wpmRango) {
    wpmRango.addEventListener('input', function () {
      ponerVelocidad(wpmRango.value);
    });
  }

  /* Los dos botones de la velocidad. Los dos entran por la misma funcion que
     la barra, para que los tres hagan lo mismo de verdad. */
  var botonesWpm = document.querySelectorAll('[data-wpm]');
  for (var w = 0; w < botonesWpm.length; w++) {
    (function (b) {
      b.addEventListener('click', function () {
        var mas = b.getAttribute('data-wpm') === 'mas';
        ponerVelocidad(estado.wpm + (mas ? WPM_PASO : -WPM_PASO));
      });
    })(botonesWpm[w]);
  }

  var botonesLetra = document.querySelectorAll('[data-fuente]');
  for (var i = 0; i < botonesLetra.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        cambiarLetra(b.getAttribute('data-fuente') === 'mas');
      });
    })(botonesLetra[i]);
  }

  /* Botón de toggle grupo (3/4 palabras). Un solo botón que alterna. */
  var botonGrupo = document.querySelector('[data-grupo]');
  if (botonGrupo) {
    botonGrupo.addEventListener('click', function () {
      alternarTamanoGrupo();
    });
  }

  /* ======================================================================
     EL TECLADO
     ====================================================================== */
  /* En una pantalla donde se lee media hora, ir a buscar el boton con el raton
     cada dos minutos cansa. Con el teclado esta todo a mano:

       espacio      reproducir o pausar
       -  y  +      diez palabras por minuto mas, o menos
       flechas      lo mismo, si el foco no esta en la barrita; con el foco en
                    la barrita las flechas ya la mueven solas (el navegador) y
                    no se tocan, para no pelearse con ellas
       R            empezar de nuevo

     POR QUE EL ESPACIO SE SALTA CUANDO EL FOCO ESTA EN UN BOTON
     Si el foco esta en el boton de reproducir y se aprieta espacio, el
     navegador ya lo aprieta por su cuenta (es lo que hace espacio en un
     boton). Si este codigo tambien lo hiciera, se pausaria y se reiniciaria en
     el mismo instante y no pasaria nada. Por eso, con el foco en cualquier
     control, este archivo no hace caso: manda el control, no el atajo. */
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    var etiqueta = t && t.tagName;
    // Con un modal abierto (los ajustes), el teclado es del modal: sin esto el
    // espacio o la R, apretados con el foco dentro, moverian la lectura que hay
    // detras.
    if (t && t.closest && t.closest('dialog')) return;
    /* Con el foco en un campo, un boton o la barrita, manda el control y no el
       atajo. Para el texto es obvio (no se captura lo que se esta escribiendo);
       para los botones es por el espacio, que el navegador ya maneja; y para la
       barrita es porque las flechas ya la mueven y hay que dejarla. */
    if (etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || etiqueta === 'BUTTON' ||
        etiqueta === 'SELECT' || (t && t.isContentEditable)) {
      return;
    }

    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      alternarLectura();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight' ||
               e.key === '+' || e.key === '=') {
      e.preventDefault();
      ponerVelocidad(estado.wpm + WPM_PASO);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' ||
               e.key === '-' || e.key === '_') {
      e.preventDefault();
      ponerVelocidad(estado.wpm - WPM_PASO);
    } else if (e.key === 'r' || e.key === 'R') {
      reiniciar();
    } else if (e.key === 'g' || e.key === 'G') {
      // Solo en modo grupo: alterna entre 3 y 4 palabras por grupo
      if (estado.motor === 'grupo' && motor) {
        e.preventDefault();
        alternarTamanoGrupo();
      }
    }
  });

  /* Alternar tamaño de grupo (3 <-> 4) con hot-swap.
     No recarga el motor: pide nuevo plan al servidor y hace swap en caliente. */
  function alternarTamanoGrupo() {
    var nuevo = estado.tamanoGrupo === 3 ? 4 : 3;
    cambiarTamanoGrupo(nuevo);
  }

  function cambiarTamanoGrupo(nuevoTamano) {
    if (!motor || !motor.actualizarPlan || !estado.textoId) return;
    if (estado.tamanoGrupo === nuevoTamano) return;

    // Calcular índice de palabra actual (mitad del grupo actual)
    var palabraActual = 0;
    var planActual = motor.plan;
    if (planActual && planActual.grupos) {
      for (var i = 0; i < estado.posicion && i < planActual.grupos.length; i++) {
        palabraActual += planActual.grupos[i].palabras.length;
      }
      // Sumar mitad del grupo actual
      if (estado.posicion < planActual.grupos.length) {
        palabraActual += Math.floor(planActual.grupos[estado.posicion].palabras.length / 2);
      }
    } else {
      // Fallback estimado
      palabraActual = estado.posicion * estado.tamanoGrupo + Math.floor(estado.tamanoGrupo / 2);
    }

    estado.tamanoGrupo = nuevoTamano;
    actualizarToggleGrupo();

    var parrafos = motor.planOriginal;
    if (!parrafos) {
      window.RetoDatos.libros.obtener(estado.textoId).then(function (doc) {
        if (doc) hacerCambio(aplanarArbol(doc.arbol, []));
      });
      return;
    }
    hacerCambio(parrafos);

    function hacerCambio(parrafos) {
      pedirPlan(parrafos, 'grupo', nuevoTamano).then(function (nuevoPlan) {
        nuevoPlan.parrafosOriginales = parrafos;
        motor.actualizarPlan(nuevoPlan, palabraActual);
        actualizarToggleGrupo();
      });
    }
  }

  function actualizarToggleGrupo() {
    var valor = document.querySelector('[data-grupo] .grupo-valor');
    if (valor) valor.textContent = String(estado.tamanoGrupo);
  }

  /* ======================================================================
     ARRANQUE
     ====================================================================== */

  /* Al abrir: leer el motor y el texto de la direccion, y cargar lo que
     quedo de la vez pasada. De momento no hay motor, asi que la pantalla se
     queda vacia y eso es lo correcto. */
  function leerDeLaDireccion() {
    try {
      var p = new URLSearchParams(location.search);
      estado.motor = p.get('motor');
      estado.textoId = p.get('id');
    } catch (e) {
      // Navegadores viejos: la direccion se lee a mano. Sin esto, abrir la
      // pagina pegada tiraria una excepcion y el panel no responderia.
      var m = /[?&]motor=([^&]*)/.exec(location.search);
      if (m) estado.motor = decodeURIComponent(m[1]);
      var i = /[?&]id=([^&]*)/.exec(location.search);
      if (i) estado.textoId = decodeURIComponent(i[1]);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Detectar modo offline
    if (window.RetoOfflineCache) {
      window.RetoOfflineCache.installFetchInterceptor();
    }
    window.addEventListener('online', function () { document.documentElement.setAttribute('data-modo-offline', '0'); });
    window.addEventListener('offline', function () { document.documentElement.setAttribute('data-modo-offline', '1'); });

    leerDeLaDireccion();
    pintarEstado();
    /* Los botones que dependen del modo salen ya, sin esperar al plan: el modo
       se sabe de la direccion. El de ajustes, en los dos modos que lo tienen;
       el de 3/4, solo en el modo grupo. */
    if (MODOS_CON_AJUSTES[estado.motor]) mostrarAjustes();
    mostrarBotonGrupo();
    cargarPreferencias().then(function () {
      // La fuente se pone ANTES de preparar el motor, para medir el texto con la
      // letra definitiva. Si la fuente falla, la lectura sigue con la del sitio.
      return pintarFuente().catch(function () {});
    }).then(function () {
      if (esMotorConocido(estado.motor) && estado.textoId) cargarMotor(estado.motor);
    });
  });
})();
