/* =========================================================================
   R.E.T.O. - Ajustes de los tests (los comparten las dos pantallas)

   "Gestionar banco de tests" y "Resolver test" se leen y se escriben mucho, y
   cada persona necesita algo distinto para poder hacerlo cómoda: otra letra,
   otra anchura de línea, que se lea en voz alta, que no haya movimiento. Por
   eso los ajustes son UNO, con las mismas claves, y valen en las dos pantallas:
   se cambian en una y se ven en la otra.

   LO QUE SE PUEDE CAMBIAR
   - La letra: fuente (incluidas las de dislexia y las que la persona instale),
     tamaño, espacio entre letras y líneas, y lo ancho de la línea de lectura.
   - Los contornos gruesos.
   - El movimiento (la barra de avance, las transiciones).
   - La lectura en voz alta: un botón "Escuchar" en cada pregunta y, si se
     quiere, que cada pregunta se lea sola al aparecer.
   - El sonido: si suena un aviso al acertar, cuál, y el volumen. AL FALLAR
     NUNCA SUENA NADA: una señal de error asusta más de lo que enseña.
   - Solo en "Resolver":
       · ver el avance;
       · si se pregunta "¿qué tan seguro estás?" (lo que separa "olvidé" de
         "entendí mal", PROPUESTA 4.3);
       · si al elegir una respuesta se ENVÍA SOLA (valor de fábrica) o hay que
         confirmarla antes (por si se va el dedo);
       · si, después de contestar, la siguiente pregunta aparece SOLA (como el
         avance automático de Secuencia) y cuánto espera, de 200 a 1500 ms. Al
         fallar se abre la explicación y no avanza hasta cerrarla;
       · si la respuesta correcta se pinta de verde con un pulso suave, y si
         aparece la racha de fuego cuando se acierta varias seguidas (pensado
         para quien necesita un refuerzo inmediato, por ejemplo con TDAH).
   - Perfiles: un clic deja puestos varios ajustes. Son un punto de partida,
     no un diagnóstico; después se cambia cada cosa.

   DOS DIALOGOS DE AJUSTES, según dónde se esté:
   - "general": lo de arriba, para leer y responder (y, en el editor del banco,
     para escribir).
   - "lista": solo para la pantalla de ELEGIR un test (y para el banco): cómo se
     ven los tests (tarjetas o lista), de qué tamaño, y por qué se ordenan
     (por materia, por fecha de modificación o por último test realizado).
   Cada pantalla pide el que le toca con abrir('general') o abrir('lista').

   NO HAY RELOJ en ningún ajuste, porque no hay reloj en ningún test
   (PROPUESTA 5.2 y WCAG 2.2.1).

   Los ajustes se guardan con RetoDatos, con el prefijo "tests-". Los que
   nunca se tocan NO se guardan: se usa su valor de fábrica, y así, si mañana
   cambia uno, quien nunca lo tocó recibe el nuevo.

   LO DE LA PANTALLA SE ESCRIBE EN <html> (atributos data-tst-* y las variables
   --tst-fuente y --tst-texto-escala), y lo leen 70_tests.css y el cuadrito de
   este modal. El valor por defecto va en el CSS, donde se usa.
   ========================================================================= */
(function () {
  'use strict';

  var PREFIJO = 'tests-';

  var FABRICA = {
    fuente: 'nunito',
    letra: '2',
    espaciado: 'normal',
    columna: 'normal',
    borde: 'off',
    movimiento: 'on',
    avance: 'on',
    seguridad: 'off',
    confirmar: 'off',
    siguiente: 'sola',
    espera: '800',
    acierto: 'on',
    racha: 'on',
    ver: 'categorias',
    vista: 'tarjetas',
    tarjeta: 'pequena',
    escuchar: 'on',
    leerSola: 'off',
    sonido: 'on',
    sonidoAcierto: 'soft',
    volumen: '50'
  };

  var LETRAS = [
    { id: '1', nombre: 'Pequeña', texto: '1' },
    { id: '2', nombre: 'Mediana', texto: '1.15' },
    { id: '3', nombre: 'Grande', texto: '1.4' },
    { id: '4', nombre: 'Muy grande', texto: '1.7' }
  ];

  var ESPACIADOS = [
    { id: 'normal', nombre: 'Normal' },
    { id: 'amplio', nombre: 'Amplio' }
  ];

  var COLUMNAS = [
    { id: 'normal', nombre: 'Normal',
      ayuda: 'Unos 75 caracteres por línea: lo que se lee cómodo en casi todos los casos.' },
    { id: 'estrecha', nombre: 'Estrecha',
      ayuda: 'Unos 55 caracteres por línea. Se sigue mejor con la vista.' },
    { id: 'completa', nombre: 'Completa',
      ayuda: 'El texto usa todo el ancho del contenedor. En pantallas grandes las líneas quedan muy largas.' }
  ];

  var SIGUIENTES = [
    { id: 'sola', nombre: 'Sola, después de una pausa',
      ayuda: 'Después de contestar, la siguiente pregunta aparece sola. Si fallas, se abre la ' +
             'explicación y avanzas cuando la cierres.' },
    { id: 'yo', nombre: 'Cuando yo lo pida',
      ayuda: 'Después de contestar aparece un botón "Siguiente pregunta". Nada avanza solo.' }
  ];

  /* LA PAUSA ANTES DE AVANZAR: un deslizador de 200 ms a 1500 ms. Debajo de 200
     ms la respuesta correcta no alcanza a verse; arriba de 1500 ya es esperar. */
  var ESPERA_MIN = 200;
  var ESPERA_MAX = 1500;
  var ESPERA_PASO = 100;

  var VERES = [
    { id: 'categorias', nombre: 'Por materia',
      ayuda: 'Los tests agrupados por materia o tema principal.' },
    { id: 'modificacion', nombre: 'Por fecha de modificación',
      ayuda: 'Una sola lista, de lo que cambiaste hace poco a lo más viejo.' },
    { id: 'ultimo', nombre: 'Por último test realizado',
      ayuda: 'Una sola lista: arriba los que hiciste hace poco y al final los que nunca has hecho.' }
  ];

  var VISTAS = [
    { id: 'tarjetas', nombre: 'Tarjetas', ayuda: 'Cada test es una tarjeta.' },
    { id: 'lista', nombre: 'Lista', ayuda: 'Una fila por test: ocupa menos espacio.' }
  ];

  var TARJETAS = [
    { id: 'pequena', nombre: 'Pequeña', ayuda: 'Lo más compacto: cabe la mayor cantidad en pantalla.' },
    { id: 'mediana', nombre: 'Mediana', ayuda: 'Con la descripción de cada test.' },
    { id: 'grande', nombre: 'Grande', ayuda: 'Tarjetas amplias, para ver mejor.' }
  ];

  var CLAVES_LISTA = ['ver', 'vista', 'tarjeta'];

  var SONIDOS = [
    { id: 'soft', nombre: 'Suave' },
    { id: 'ding', nombre: 'Ding' },
    { id: 'charm', nombre: 'Charm' },
    { id: 'ninguno', nombre: 'Ninguno' }
  ];

  var PERFILES = [
    { id: 'calma', nombre: 'Tranquilo',
      ayuda: 'Sin movimiento ni racha, sonido bajito, líneas cortas y confirmando cada respuesta.',
      ajustes: { movimiento: 'off', racha: 'off', confirmar: 'on', espera: '1500', sonido: 'on',
                 sonidoAcierto: 'soft', volumen: '25', columna: 'estrecha' } },
    { id: 'vista', nombre: 'Ver mejor',
      ayuda: 'Letra muy grande, contornos gruesos y una fuente clara.',
      ajustes: { letra: '4', borde: 'on', fuente: 'atkinson', columna: 'estrecha' } },
    { id: 'lectura', nombre: 'Lectura',
      ayuda: 'Fuente abierta, más espacio entre letras y líneas cortas.',
      ajustes: { fuente: 'lexend', espaciado: 'amplio', columna: 'estrecha', letra: '3' } },
    { id: 'atencion', nombre: 'Atención',
      ayuda: 'Refuerzo al acertar (verde y racha), la siguiente pregunta sola y el avance a la vista.',
      ajustes: { columna: 'estrecha', movimiento: 'on', avance: 'on', acierto: 'on', racha: 'on',
                 siguiente: 'sola', confirmar: 'off', espera: '800', leerSola: 'off' } },
    { id: 'escuchar', nombre: 'Escuchar',
      ayuda: 'Cada pregunta se lee sola, se confirma la respuesta y nada avanza solo.',
      ajustes: { escuchar: 'on', leerSola: 'on', confirmar: 'on', siguiente: 'yo', sonido: 'on',
                 volumen: '75' } },
    { id: 'sinsonido', nombre: 'Sin sonido',
      ayuda: 'Nada suena, ni siquiera al acertar.',
      ajustes: { sonido: 'off', leerSola: 'off' } }
  ];

  var ajustes = {};
  var opciones = {};
  var dlg = null;
  var dlgModo = null;
  var cuerpoMuestra = null;
  var refs = {};
  var listo = null;
  var ignorarCierre = 0;

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function limpiar(nodo) {
    while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  }

  function porId(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return lista[0];
  }

  /* ------------------------------------------------------- guardar y aplicar */

  function guardar(clave, valor) {
    ajustes[clave] = valor;
    return window.RetoDatos.poner(PREFIJO + clave, valor);
  }

  function cargar() {
    var tareas = Object.keys(FABRICA).map(function (clave) {
      return window.RetoDatos.obtener(PREFIJO + clave).then(function (v) {
        ajustes[clave] = (v === null || v === undefined) ? FABRICA[clave] : String(v);
      });
    });
    return Promise.all(tareas);
  }

  function aplicar() {
    var r = document.documentElement;
    r.style.setProperty('--tst-texto-escala', porId(LETRAS, ajustes.letra).texto);
    r.setAttribute('data-tst-espaciado', ajustes.espaciado);
    r.setAttribute('data-tst-columna', ajustes.columna);
    r.setAttribute('data-tst-borde', ajustes.borde);
    r.setAttribute('data-tst-mov', ajustes.movimiento);

    r.style.setProperty('--tst-fuente', '"Nunito", system-ui, sans-serif');
    if (window.RetoFuentes) {
      window.RetoFuentes.aplicar(ajustes.fuente).then(function (f) {
        r.style.setProperty('--tst-fuente', f.css);
      }).catch(function () {});
    }
  }

  function avisarCambio(clave) {
    aplicar();
    pintarMuestra();
    if (clave === 'siguiente' && refs.espera) refs.espera.disabled = ajustes.siguiente === 'yo';
    if (opciones.alCambiar) opciones.alCambiar(clave, ajustes[clave]);
  }

  /* ------------------------------------------------------- voz y sonido */

  function volumen() {
    return (parseInt(ajustes.volumen, 10) || 50) / 100;
  }

  /* El interruptor GENERAL del sitio manda siempre: con el sonido apagado en
     Configuración, esto se calla igual. */
  function sitioPermiteSonido() {
    if (!window.RetoSonido || !window.RetoSonido.preferencias) return false;
    return window.RetoSonido.preferencias().activado;
  }

  function sonarAcierto() {
    if (ajustes.sonido !== 'on' || !sitioPermiteSonido()) return;
    if (ajustes.sonidoAcierto === 'ninguno') return;
    window.RetoSonido.reproducir(ajustes.sonidoAcierto, volumen());
  }

  function hablar(texto) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
    try {
      window.speechSynthesis.cancel();
      var dicho = new window.SpeechSynthesisUtterance(texto);
      dicho.lang = 'es';
      dicho.volume = Math.max(0.25, volumen());
      var vozElegida = localStorage.getItem('voz_preferida');
      if (vozElegida && window.speechSynthesis.getVoices) {
        var voices = window.speechSynthesis.getVoices() || [];
        var v = voices.find(function (voice) { return voice.name === vozElegida || voice.voiceURI === vozElegida; });
        if (v) dicho.voice = v;
      }
      window.speechSynthesis.speak(dicho);
      return true;
    } catch (e) { return false; }
  }

  function callar() {
    if (!window.speechSynthesis) return;
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }

  /* --------------------------------------------------------- el modal */

  function grupo(legenda, ayuda) {
    var fs = document.createElement('fieldset');
    fs.appendChild(el('legend', null, legenda));
    if (ayuda) fs.appendChild(el('p', 'ayuda', ayuda));
    dlg.appendChild(fs);
    return fs;
  }

  /* El cuadrito: una pregunta de ejemplo que usa las MISMAS clases que la de
     verdad, así lo que se ve aquí es lo que se ve resolviendo. */
  function pintarMuestra() {
    if (!cuerpoMuestra) return;
    limpiar(cuerpoMuestra);
    var caja = el('div', 'tst-muestra');
    caja.setAttribute('aria-hidden', 'true');
    caja.appendChild(el('p', 'tst-enunciado', '¿Cuántos lados tiene un hexágono?'));
    var celebra = opciones.resolver && ajustes.acierto === 'on';
    [['A', 'Seis', true], ['B', 'Ocho', false]].forEach(function (o) {
      var op = el('div', 'tst-opcion' + (o[2] && !celebra ? ' tst-opcion--elegida' : ''));
      if (o[2] && celebra) op.setAttribute('data-resultado', 'acierto');
      op.appendChild(el('span', 'tst-letra', o[0]));
      op.appendChild(el('span', 'tst-opcion-texto', o[1]));
      if (o[2]) op.appendChild(el('span', 'tst-estado-opcion', celebra ? 'Correcta' : 'Elegida'));
      op.insertAdjacentHTML('beforeend', window.RetoTestsMuestra.icono('visto').replace('tst-icono', 'tst-icono tst-visto'));
      caja.appendChild(op);
    });
    if (opciones.resolver && ajustes.racha === 'on') {
      var chip = el('p', 'tst-racha');
      chip.style.setProperty('--nivel', '1');
      var llama = el('span', 'tst-llama', '\uD83D\uDD25');
      llama.setAttribute('aria-hidden', 'true');
      chip.appendChild(llama);
      chip.appendChild(el('span', null, 'Racha de 3'));
      caja.appendChild(chip);
    }
    cuerpoMuestra.appendChild(caja);
  }

  function opcionRadio(nombre, valor, texto, elegido, alCambiar) {
    var op = el('label', 'opcion');
    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = nombre;
    radio.value = valor;
    if (valor === elegido) radio.checked = true;
    radio.addEventListener('change', function () { if (this.checked) alCambiar(valor); });
    op.appendChild(radio);
    op.appendChild(el('span', null, texto));
    return op;
  }

  function campoRadios(padre, clave, titulo, lista) {
    padre.appendChild(el('p', 'editor-label', titulo));
    var ops = el('div', 'opciones');
    ops.setAttribute('role', 'radiogroup');
    ops.setAttribute('aria-label', titulo);
    var ayuda = lista.some(function (o) { return o.ayuda; }) ? el('p', 'ayuda') : null;
    function texto() { if (ayuda) ayuda.textContent = porId(lista, ajustes[clave]).ayuda || ''; }
    lista.forEach(function (o) {
      ops.appendChild(opcionRadio(PREFIJO + clave, o.id, o.nombre, ajustes[clave], function (v) {
        guardar(clave, v).then(function () { texto(); avisarCambio(clave); });
      }));
    });
    padre.appendChild(ops);
    if (ayuda) { texto(); padre.appendChild(ayuda); }
  }

  function campoSelect(padre, clave, titulo, lista, alCambiar) {
    var caja = el('div', 'ajustes-sonido');
    var id = PREFIJO + 'sel-' + clave;
    var etiqueta = el('label', 'editor-label', titulo);
    etiqueta.setAttribute('for', id);
    caja.appendChild(etiqueta);
    var sel = document.createElement('select');
    sel.className = 'editor-campo';
    sel.id = id;
    lista.forEach(function (o) {
      var op = el('option', '', o.nombre);
      op.value = o.id;
      if (o.id === ajustes[clave]) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () {
      guardar(clave, this.value).then(function () {
        avisarCambio(clave);
        if (alCambiar) alCambiar(sel.value);
      });
    });
    caja.appendChild(sel);
    padre.appendChild(caja);
  }

  function interruptor(padre, clave, texto, explicacion) {
    var label = el('label', 'interruptor');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = ajustes[clave] === 'on';
    var caja = el('span', 'interruptor-caja');
    caja.setAttribute('aria-hidden', 'true');
    var rotulo = el('span', 'interruptor-texto', texto);
    rotulo.appendChild(el('span', 'ayuda', explicacion));
    input.addEventListener('change', function () {
      guardar(clave, this.checked ? 'on' : 'off').then(function () { avisarCambio(clave); });
    });
    label.appendChild(input);
    label.appendChild(caja);
    label.appendChild(rotulo);
    padre.appendChild(label);
  }

  function listarFuentes(select) {
    if (!window.RetoFuentes) return Promise.resolve();
    return window.RetoFuentes.lista().then(function (lista) {
      limpiar(select);
      lista.forEach(function (f) {
        var op = el('option', '', f.nombre);
        op.value = f.id;
        if (f.id === ajustes.fuente) op.selected = true;
        select.appendChild(op);
      });
    });
  }

  function armar() {
    var esteDlg = document.createElement('dialog');
    dlg = esteDlg;
    dlgModo = 'general';
    dlg.className = 'dialogo tst-config';
    dlg.setAttribute('aria-labelledby', 'tst-cfg-titulo');
    refs = {};

    var titulo = el('h2', 'dialogo-titulo', 'Ajustes de los tests');
    titulo.id = 'tst-cfg-titulo';
    dlg.appendChild(titulo);

    var caja = el('div', 'tst-muestra-caja');
    cuerpoMuestra = el('div');
    caja.appendChild(cuerpoMuestra);
    caja.appendChild(el('p', 'ayuda', 'Así se ve una pregunta.'));
    dlg.appendChild(caja);
    pintarMuestra();

    var gPerfiles = grupo('Perfiles',
      'Un clic deja puestos varios ajustes. Son un punto de partida: después cambias lo que quieras.');
    var rejilla = el('div', 'tst-perfiles');
    PERFILES.forEach(function (p) {
      var b = el('button', 'boton tst-perfil');
      b.type = 'button';
      b.appendChild(el('strong', null, p.nombre));
      b.appendChild(el('span', 'ayuda', p.ayuda));
      b.addEventListener('click', function () { perfil(p); });
      rejilla.appendChild(b);
    });
    gPerfiles.appendChild(rejilla);

    var gLetra = grupo('La letra', 'Cómo se ve el texto de las preguntas y de las pantallas.');
    var filaFuente = el('div', 'ajustes-fuente-fila');
    var sel = document.createElement('select');
    sel.className = 'editor-campo';
    sel.id = PREFIJO + 'fuente';
    var labelFuente = el('label', 'oculto-a-la-vista', 'Fuente');
    labelFuente.setAttribute('for', sel.id);
    filaFuente.appendChild(labelFuente);
    filaFuente.appendChild(sel);
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
    sel.addEventListener('change', function () {
      guardar('fuente', this.value).then(function () { avisarCambio('fuente'); });
    });
    campoRadios(gLetra, 'letra', 'Tamaño', LETRAS);
    campoRadios(gLetra, 'espaciado', 'Espacio entre letras y líneas', ESPACIADOS);
    campoRadios(gLetra, 'columna', 'Ancho de la línea', COLUMNAS);
    interruptor(gLetra, 'borde', 'Contornos gruesos',
      'Un borde grueso en las opciones y las tarjetas. Ayuda a verlas mejor.');

    var gMov = grupo('Movimiento', 'Nada parpadea. Esto solo apaga las transiciones suaves.');
    interruptor(gMov, 'movimiento', 'Movimiento suave',
      'La barra de avance se llena poco a poco. Apagado, todo cambia de golpe. Si en ' +
      'Configuración tienes las animaciones apagadas, aquí tampoco hay movimiento.');

    var gVoz = grupo('Lectura en voz alta', 'Para oír las preguntas en lugar de leerlas, o además de leerlas.');
    interruptor(gVoz, 'escuchar', 'Botón para escuchar',
      'Cada pregunta tiene un botón "Escuchar" que lee el enunciado y las opciones.');
    interruptor(gVoz, 'leerSola', 'Leer cada pregunta sola',
      'Al aparecer una pregunta, se lee sin que la pidas. Funciona si el aparato tiene voz.');

    var gSon = grupo('El sonido',
      'Si en Configuración → Sonido está apagado, aquí no se oye nada. Al fallar nunca suena nada.');
    interruptor(gSon, 'sonido', 'Sonar al acertar',
      'Un aviso corto cuando la respuesta es correcta.');
    campoSelect(gSon, 'sonidoAcierto', 'Qué suena al acertar', SONIDOS, function () { sonarAcierto(); });
    gSon.appendChild(el('p', 'editor-label', 'Volumen'));
    var filaVol = el('div', 'rango-lectura');
    var rango = document.createElement('input');
    rango.type = 'range';
    rango.className = 'rango';
    rango.min = '25';
    rango.max = '100';
    rango.step = '25';
    rango.value = ajustes.volumen;
    rango.setAttribute('aria-label', 'Volumen');
    var salida = el('output', 'rango-valor', ajustes.volumen + ' %');
    rango.addEventListener('input', function () {
      salida.textContent = this.value + ' %';
      ajustes.volumen = this.value;
      sonarAcierto();
    });
    rango.addEventListener('change', function () { guardar('volumen', this.value); });
    filaVol.appendChild(rango);
    filaVol.appendChild(salida);
    gSon.appendChild(filaVol);

    if (opciones.resolver) {
      var gRes = grupo('Al responder', 'Lo que cambia cómo se siente una sesión.');
      interruptor(gRes, 'avance', 'Ver cuántas preguntas van',
        'Un "Pregunta 2 de 5" y una barra. Si te pone nervioso, apágalo.');
      interruptor(gRes, 'confirmar', 'Confirmar la respuesta antes de avanzar',
        'Al elegir una respuesta, tocas "Confirmar" para enviarla. Útil si se te va el dedo. ' +
        'Apagado, la respuesta se envía en cuanto la eliges.');
      interruptor(gRes, 'seguridad', 'Decir qué tan seguro estás',
        'Al responder eliges entre "Estoy seguro", "Tengo dudas" y "No sé". No cambia tu ' +
        'resultado: sirve para saber qué repasar y qué volver a entender. Con esto prendido ' +
        'siempre se confirma la respuesta.');

      var gAv = grupo('Al avanzar',
        'Como el avance automático de Secuencia: un toque menos por pregunta.');
      campoRadios(gAv, 'siguiente', 'La siguiente pregunta aparece', SIGUIENTES);
      gAv.appendChild(el('p', 'editor-label', 'Cuánto espera antes de avanzar'));
      var filaEsp = el('div', 'rango-lectura');
      var rangoEsp = document.createElement('input');
      rangoEsp.type = 'range';
      rangoEsp.className = 'rango';
      rangoEsp.min = String(ESPERA_MIN);
      rangoEsp.max = String(ESPERA_MAX);
      rangoEsp.step = String(ESPERA_PASO);
      rangoEsp.value = ajustes.espera;
      rangoEsp.id = PREFIJO + 'espera';
      rangoEsp.setAttribute('aria-label', 'Cuánto espera antes de avanzar, en milisegundos');
      rangoEsp.disabled = ajustes.siguiente === 'yo';
      var salidaEsp = el('output', 'rango-valor', ajustes.espera + ' ms');
      rangoEsp.addEventListener('input', function () {
        salidaEsp.textContent = this.value + ' ms';
        ajustes.espera = this.value;
      });
      rangoEsp.addEventListener('change', function () { guardar('espera', this.value); });
      filaEsp.appendChild(rangoEsp);
      filaEsp.appendChild(salidaEsp);
      gAv.appendChild(filaEsp);
      gAv.appendChild(el('p', 'ayuda',
        'De 200 ms (casi sin pausa) a 1500 ms. Solo cuenta si la siguiente pregunta aparece sola. ' +
        'Si la respuesta es correcta, es el tiempo que se ve en verde antes de pasar.'));
      refs.espera = rangoEsp;

      var gAc = grupo('Cuando aciertas',
        'Un refuerzo inmediato. Siempre lleva un visto y la palabra "Correcta": no depende del color.');
      interruptor(gAc, 'acierto', 'Pintar de verde la respuesta correcta',
        'La respuesta se pone verde (según el tema que uses) y hace un pulso suave. ' +
        'Si el movimiento está apagado, se pinta sin pulso.');
      interruptor(gAc, 'racha', 'Racha de fuego',
        'Cuando aciertas varias seguidas aparece una llama con tu racha. Al fallar, ' +
        'la racha empieza otra vez sin ningún aviso.');
    }

    var acciones = el('div', 'dialogo-acciones');
    var fabrica = el('button', 'boton', 'Valores de fábrica');
    fabrica.type = 'button';
    fabrica.addEventListener('click', volverALaFabrica);
    var cerrar = el('button', 'boton boton--principal', 'Listo');
    cerrar.type = 'button';
    cerrar.addEventListener('click', function () { dlg.close(); });
    acciones.appendChild(fabrica);
    acciones.appendChild(cerrar);
    dlg.appendChild(acciones);

    dlg.addEventListener('close', function () {
      callar();
      if (ignorarCierre > 0) { ignorarCierre--; return; }
      if (dlg === esteDlg && opciones.alCerrar) opciones.alCerrar();
    });
    document.body.appendChild(dlg);

    listarFuentes(sel);
    instalar.addEventListener('click', function () { archivo.click(); });
    archivo.addEventListener('change', function () {
      var input = this;
      if (!input.files || !input.files[0] || !window.RetoFuentes) return;
      window.RetoFuentes.instalar(input.files[0]).then(function (nueva) {
        input.value = '';
        return listarFuentes(sel).then(function () {
          return guardar('fuente', nueva.id).then(function () {
            sel.value = nueva.id;
            avisarCambio('fuente');
          });
        });
      }).catch(function () { input.value = ''; });
    });
  }

  /* EL DIÁLOGO DE LA LISTA: solo cómo se ven y se ordenan los tests. Sin
     cuadrito de pregunta (no hay nada que previsualizar aquí: lo que cambia se
     ve detrás, en la propia lista) y sin perfiles. */
  function armarLista() {
    var esteDlg = document.createElement('dialog');
    dlg = esteDlg;
    dlgModo = 'lista';
    refs = {};
    cuerpoMuestra = null;
    dlg.className = 'dialogo tst-config';
    dlg.setAttribute('aria-labelledby', 'tst-cfg-titulo');
    var titulo = el('h2', 'dialogo-titulo', 'Ajustes de la lista de tests');
    titulo.id = 'tst-cfg-titulo';
    dlg.appendChild(titulo);
    dlg.appendChild(el('p', 'ayuda', 'Lo que cambies se ve al momento en la lista de atrás.'));

    var gVer = grupo('Cómo se ordenan', 'Qué orden tienen los tests.');
    campoRadios(gVer, 'ver', 'Ver', VERES);

    var gVista = grupo('Cómo se ven', 'Tarjetas o una lista, y qué tan grandes.');
    campoRadios(gVista, 'vista', 'Mostrar en', VISTAS);
    campoRadios(gVista, 'tarjeta', 'Tamaño de las tarjetas', TARJETAS);
    gVista.appendChild(el('p', 'ayuda', 'El tamaño solo cuenta si los tests se muestran en tarjetas.'));

    var acciones = el('div', 'dialogo-acciones');
    var fabrica = el('button', 'boton', 'Valores de fábrica');
    fabrica.type = 'button';
    fabrica.addEventListener('click', volverALaFabrica);
    var cerrar = el('button', 'boton boton--principal', 'Listo');
    cerrar.type = 'button';
    cerrar.addEventListener('click', function () { dlg.close(); });
    acciones.appendChild(fabrica);
    acciones.appendChild(cerrar);
    dlg.appendChild(acciones);
    dlg.addEventListener('close', function () {
      if (ignorarCierre > 0) { ignorarCierre--; return; }
      if (dlg === esteDlg && opciones.alCerrar) opciones.alCerrar();
    });
    document.body.appendChild(dlg);
  }

  function quitarDialogo() {
    if (dlg) {
      if (dlg.open) { ignorarCierre++; dlg.close(); }
      if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
      dlg = null;
    }
  }

  function rearmar() {
    var modo = dlgModo || 'general';
    quitarDialogo();
    abrir(modo);
  }

  function perfil(p) {
    var tareas = Object.keys(p.ajustes).map(function (clave) {
      return guardar(clave, p.ajustes[clave]);
    });
    Promise.all(tareas).then(function () {
      aplicar();
      if (opciones.alCambiar) opciones.alCambiar('perfil', p.id);
      rearmar();
    });
  }

  function volverALaFabrica() {
    var modo = dlgModo || 'general';
    if (dlg && dlg.open) { ignorarCierre++; dlg.close(); }
    window.RetoDialogo.preguntar({
      titulo: 'Volver a los valores de fábrica',
      texto: modo === 'lista'
        ? 'La forma de ver y ordenar los tests vuelve a como venía.'
        : 'Los ajustes de lectura, sonido y respuesta vuelven a como venían.',
      ok: 'Sí, volver',
      cancelar: 'No'
    }).then(function (si) {
      if (!si) { abrir(modo); return; }
      var claves = Object.keys(FABRICA).filter(function (c) {
        var esLista = CLAVES_LISTA.indexOf(c) >= 0;
        return modo === 'lista' ? esLista : !esLista;
      });
      var tareas = claves.map(function (clave) {
        ajustes[clave] = FABRICA[clave];
        return window.RetoDatos.poner(PREFIJO + clave, null);
      });
      Promise.all(tareas).then(function () {
        aplicar();
        if (opciones.alCambiar) opciones.alCambiar('fabrica', null);
        quitarDialogo();
        abrir(modo);
      });
    });
  }

  function abrir(modo) {
    modo = modo === 'lista' ? 'lista' : 'general';
    if (opciones.alAbrir) opciones.alAbrir();
    if (dlg && dlgModo !== modo) quitarDialogo();
    if (!dlg) { if (modo === 'lista') armarLista(); else armar(); }
    pintarMuestra();
    if (!dlg.open) dlg.showModal();
    var primero = dlg.querySelector('input, button');
    if (primero) primero.focus();
  }

  /* `opcionesIniciales`: resolver (muestra los ajustes de la sesión),
     alCambiar(clave, valor), alAbrir() y alCerrar(). Devuelve una promesa que se cumple
     cuando los ajustes ya están cargados y puestos en la página. */
  function iniciar(opcionesIniciales) {
    opciones = opcionesIniciales || {};
    listo = cargar().then(function () {
      aplicar();
      if (window.RetoSonido && window.RetoSonido.precargar) window.RetoSonido.precargar();
      return ajustes;
    });
    return listo;
  }

  window.RetoTestsAjustes = {
    iniciar: iniciar,
    abrir: abrir,
    valores: function () { return ajustes; },
    hablar: hablar,
    callar: callar,
    sonarAcierto: sonarAcierto
  };
})();
