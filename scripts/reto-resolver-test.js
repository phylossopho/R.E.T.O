/* =========================================================================
   R.E.T.O. - Resolver test (LA INTERFAZ, todavía sin motor)

   QUÉ ES ESTO
   La pantalla donde se responde un test: se elige uno, se responde pregunta
   por pregunta, y al final se ve cómo fue. Es una MAQUETA: lee los tests de
   muestra (reto-tests-muestra.js) y no calcula nada. Las preguntas con números
   que cambian salen con números ya puestos, escritos a mano en la muestra; el
   motor de Python los elegirá al azar cuando exista. Lo único que se guarda de
   verdad es CUÁNDO se hizo cada test por última vez (para ordenar la lista).

   EL RECORRIDO, que es lo que se está diseñando
     Elegir un test  →  Pregunta  →  (si se falla) Mira esto  →  Siguiente
                                                             →  Resultado

   DECISIONES DE DISEÑO (y por qué)
   - SIN RELOJ, en ningún sitio (PROPUESTA 5.2, WCAG 2.2.1).
   - TODO LO QUE SE RESPONDE CABE EN LA PANTALLA, SIN SCROLL: la cabecera, la
     pregunta y las respuestas. Para eso la pantalla de la pregunta no lleva
     nada de relleno (ni títulos, ni avisos, ni textos de ayuda): las respuestas
     van en una cuadrícula de 2 x 2 que se reparte el alto que sobra, el icono de
     escuchar va delante de la pregunta, y lo que se dice ("Respuesta correcta")
     se anuncia a quien usa lector de pantalla sin ocupar lugar. Se mide el
     alto libre al dibujar y al cambiar el tamaño de la ventana. Si algo no cabe
     (un texto para leer muy largo, una letra enorme), la página se desplaza
     antes que cortar contenido; el texto para leer se desplaza por dentro.
   - LA CABECERA DICE QUÉ TEST ES: "Resolviendo el test «…»" (en pantallas
     chicas, solo «…»).
   - SE RESPONDE CON UN TOQUE. Elegir una respuesta la ENVÍA (valor de fábrica) y,
     tras una pausa de 200 a 1500 ms, la siguiente pregunta aparece sola. En los
     ajustes se puede pedir confirmar antes de enviar (por si se va el dedo), o
     que nada avance solo. Si se pregunta la seguridad (apagada de fábrica) se
     confirma siempre: los tres botones de seguridad son la confirmación.
   - LAS RESPUESTAS SON BOTONES, NO RADIOS. Con radios, la primera flecha del
     teclado ya elegiría (y enviaría) una respuesta. Con botones, las flechas
     solo mueven el foco y Enter o espacio eligen. También sirven A a F y 1 a 6.
   - NO HAY RECUADRO AL ACERTAR. La respuesta correcta se pinta de verde, lleva
     un visto y la palabra "Correcta", y se anuncia a quien no ve. Un recuadro
     aparte repetía lo mismo y empujaba las respuestas hacia abajo.
   - EL ERROR NO ENSEÑA LA RESPUESTA (PROPUESTA 4.4). Se abre "Mira esto" con el
     contexto, y al cerrarlo SE SIGUE. Al fallar no suena nada ni se pinta de rojo.
   - REFUERZO AL ACERTAR (opcional, para TDAH): verde con un pulso de 0,35 s y,
     desde 2 seguidas, una llama con la racha. Llevan texto: no dependen del
     color ni del emoji. Al fallar la racha se reinicia sin aviso.
   - TODO LO QUE SE VE LLEVA UN TEXTO. Ningún estado depende del color.
   ========================================================================= */
(function () {
  'use strict';

  var Muestra = window.RetoTestsMuestra;
  var icono = Muestra.icono;
  var Aj = window.RetoTestsAjustes;
  var Lista = window.RetoTestsLista;
  var Banco = window.RetoTestsBanco;

  /* Las tres seguridades, escritas como las diría una persona ("Estoy seguro"),
     y no como etiquetas sueltas ("Seguro", "Dudando"): sin el contexto de la
     frase, la primera versión no se entendía. */
  var SEGURIDADES = [
    { id: 'seguro', nombre: 'Estoy seguro', ayuda: 'Sé la respuesta.' },
    { id: 'dudando', nombre: 'Tengo dudas', ayuda: 'Creo que es esta, pero no estoy seguro.' },
    { id: 'adivinando', nombre: 'No sé', ayuda: 'La elegí al azar.' }
  ];

  var COLUMNAS_RESPUESTAS = 2;

  var tests = [];             // el banco, cargado de IndexedDB (reto-tests-banco.js)
  var resumenes = {};         // { idTest: { nuevas, por_repasar, … } } (lo calcula el servidor)
  var pendientes = [];        // lo que se está guardando de las respuestas de esta ronda
  var test = null;            // el test que se está resolviendo
  var preguntas = [];         // las preguntas de esta ronda, ya armadas
  var indice = 0;
  var resultados = [];        // uno por pregunta respondida
  var vueltas = 0;            // para rotar los ejemplos de las preguntas dinámicas
  var elegida = null;         // índice de la opción elegida
  var racha = 0;              // aciertos seguidos
  var mejorRacha = 0;
  var avanceId = null;        // el temporizador del avance automático
  var estado = 'elegir';      // elegir | pregunta | respondida | resultado
  var modalAbierto = null;
  var columna = null;         // la columna de la pregunta de ahora
  var listaCtl = null;        // la lista de tests de "Elegir"

  var raiz, estadoEl, cabEl, cabOriginal;

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function limpiar(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function porId(id) { return document.getElementById(id); }
  function decir(t) { estadoEl.textContent = t || ''; }

  function boton(texto, iconoId, clase, alClick) {
    var b = el('button', 'boton ' + (clase || ''));
    b.type = 'button';
    if (iconoId) b.insertAdjacentHTML('afterbegin', icono(iconoId));
    b.appendChild(document.createTextNode(texto));
    if (alClick) b.addEventListener('click', alClick);
    return b;
  }

  function ajustes() { return Aj ? Aj.valores() : {}; }

  /* Los párrafos de un texto con saltos de línea, sin innerHTML: lo que se
     escribe en el banco nunca se interpreta como HTML. */
  function parrafos(contenedor, texto) {
    String(texto || '').split(/\n+/).forEach(function (linea) {
      if (linea.trim()) contenedor.appendChild(el('p', null, linea));
    });
  }

  function tipoDeTest(t) { return Lista.tipoDeTest(t); }
  function etiquetaTipo(tipo) { return Lista.etiquetaTipo(tipo); }

  function cancelarAvance() {
    if (avanceId !== null) { window.clearTimeout(avanceId); avanceId = null; }
  }

  /* LA CABECERA. En "Elegir" dice lo de siempre ("Resolver test"); al resolver
     dice qué test es. En pantallas chicas el "Resolviendo el test" se esconde
     (CSS) y queda solo el título entre comillas, que es lo que importa. */
  function titularCabecera(modo, titulo) {
    if (!cabEl) return;
    limpiar(cabEl);
    if (!modo) {
      cabEl.textContent = cabOriginal;
      cabEl.removeAttribute('title');
      document.title = cabOriginal;
      return;
    }
    var pre = modo === 'resultado' ? 'Resultado del test ' : 'Resolviendo el test ';
    cabEl.appendChild(el('span', 'tst-cab-pre', pre));
    cabEl.appendChild(document.createTextNode('\u00AB' + titulo + '\u00BB'));
    cabEl.setAttribute('title', pre + '\u00AB' + titulo + '\u00BB');
    document.title = pre + '\u00AB' + titulo + '\u00BB';
  }

  function mostrar(cual, titulo) {
    estado = cual;
    cancelarAvance();
    document.documentElement.setAttribute('data-tst-vista', cual);
    limpiar(raiz);
    var sec = el('section', 'tst-vista' + (cual === 'pregunta' ? ' tst-vista--pregunta' : ''));
    sec.id = 'v-' + cual;
    /* En la pantalla de la pregunta el título no ocupa lugar (cabe todo sin
       scroll), pero sigue ahí: lo lee el lector de pantalla y recibe el foco. */
    var h = el('h2', cual === 'pregunta' ? 'oculto-a-la-vista' : null, titulo);
    h.tabIndex = -1;
    sec.appendChild(h);
    raiz.appendChild(sec);
    return { sec: sec, h: h };
  }

  function enfocar(v) {
    v.h.focus();
    window.scrollTo(0, 0);
  }

  /* El alto que queda para la pregunta: lo que mide la ventana menos lo que ya
     hay arriba. Se escribe como variable en la sección y el CSS la usa como
     alto MÍNIMO (no fijo): si el contenido no cabe, crece en vez de recortarse. */
  function ajustarAlto() {
    var sec = porId('v-pregunta');
    if (!sec) return;
    var arriba = sec.getBoundingClientRect().top + (window.pageYOffset || 0);
    /* Lo que se reserva abajo para que el panel flotante no tape las respuestas
       (70_tests.css: --tst-reserva-panel). Sin descontarlo, la pagina quedaria
       justo ese alto mas larga que la ventana y saldria el scroll. */
    var principal = sec.closest ? sec.closest('main') : null;
    var reserva = 0;
    if (principal && window.getComputedStyle) {
      reserva = parseFloat(window.getComputedStyle(principal).paddingBottom) || 0;
    }
    var libre = window.innerHeight - arriba - 12 - reserva;
    sec.style.setProperty('--tst-libre', Math.max(260, Math.round(libre)) + 'px');
  }

  /* ========================================================= ELEGIR TEST */

  /* Un test en "Elegir" es un ENLACE-tarjeta (a.tarjeta.tarjeta-nav), igual que
     las demás tarjetas de la plataforma: con ellas vienen solos la entrada
     animada, el zoom y el borde de acento al pasar el mouse. El enlace apunta a
     "#id-del-test" y se intercepta para empezar sin recargar. */
  function tarjetaResolver(t, ctx) {
    var a = el('a', 'tarjeta tarjeta-nav tst-tarjeta');
    a.href = '#' + t.id;
    a.insertAdjacentHTML('afterbegin', Muestra.iconoTarjeta(t.materia));
    a.appendChild(el('strong', 'tarjeta-titulo', t.titulo));
    if (t.descripcion) a.appendChild(el('span', 'tarjeta-texto', t.descripcion));
    var meta = el('span', 'tst-tarjeta-meta');
    meta.appendChild(document.createTextNode(
      (ctx.plano ? t.materia + ' · ' : '') +
      (t.preguntas.length === 1 ? '1 pregunta' : t.preguntas.length + ' preguntas')));
    meta.appendChild(etiquetaTipo(tipoDeTest(t)));
    a.appendChild(meta);
    a.appendChild(el('span', 'tst-tarjeta-hecho', ctx.hace));
    var repasar = ctx.resumen && ctx.resumen.por_repasar > 0 ? ctx.resumen.por_repasar : 0;
    if (repasar) {
      var rr = el('span', 'tst-tarjeta-repasar');
      rr.insertAdjacentHTML('afterbegin', icono('dinamica'));
      rr.appendChild(document.createTextNode(repasar + ' por repasar'));
      a.appendChild(rr);
    }
    var go = el('span', 'tst-empezar', 'Empezar');
    go.insertAdjacentHTML('beforeend', icono('flecha'));
    a.appendChild(go);
    a.setAttribute('aria-label', 'Empezar el test ' + t.titulo + '. ' +
      (t.preguntas.length === 1 ? '1 pregunta' : t.preguntas.length + ' preguntas') + '. ' + ctx.hace + '.' +
      (repasar ? ' ' + repasar + ' por repasar.' : ''));
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      preparar(t);
    });
    return a;
  }

  /* El banco recién estrenado: no hay nada que elegir todavía. */
  function bancoVacio() {
    var c = el('div');
    c.appendChild(el('p', null, 'Todavía no hay tests. Créalos en "Gestionar banco de tests", o carga unos de ejemplo para probar.'));
    var fila = el('div', 'tst-acciones');
    fila.appendChild(boton('Cargar tests de ejemplo', 'mas', 'boton--chico', function () {
      Banco.ejemplos().then(function () { pantallaElegir(); }, function (e) { decir(e.message); });
    }));
    var a = el('a', 'boton boton--chico', 'Ir a Gestionar banco de tests');
    a.href = '../crud-tests/crud-tests.html';
    fila.appendChild(a);
    c.appendChild(fila);
    return c;
  }

  function pantallaElegir() {
    Aj && Aj.callar();
    titularCabecera(null);
    var v = mostrar('elegir', 'Elige un test');
    decir('');
    v.sec.appendChild(el('p', null, 'Sin reloj y sin prisa. Elige un tema y responde a tu ritmo.'));
    var cont = el('div');
    v.sec.appendChild(cont);
    enfocar(v);
    /* La lista sale del banco de IndexedDB; lo de "por repasar" lo calcula el
       servidor y llega un momento después: la lista no espera por ello. */
    Banco.cargar().then(function (lista) {
      tests = lista;
      listaCtl = Lista.montar({
        contenedor: cont,
        prefijo: 'res',
        tests: function () { return tests; },
        tarjeta: tarjetaResolver,
        resumenes: function () { return resumenes; },
        vacio: bancoVacio
      });
      return Banco.resumenes(tests).then(function (r) {
        resumenes = r || {};
        if (estado === 'elegir' && listaCtl) listaCtl.repintar();
      }).catch(function () {
        resumenes = {};
        if (estado === 'elegir' && listaCtl) listaCtl.repintar();
      });
    }).catch(function (e) { decir(e.message); });
  }

  /* ======================================================== ARMAR LA RONDA */

  /* Una pregunta fija se queda como está. Una con números que cambian se
     "arma": en la maqueta, se toma uno de sus ejemplos escritos a mano, y se
     rota cada vez para que, al repetir, salgan otros números. Con el motor, esto
     lo hará Python con valores al azar. */
  /* `orden` es el que decidió el servidor al armar la ronda: la opción que se
     muestra en el lugar k es la `orden[k]` de las escritas (la correcta va
     mezclada con las demás). `estadoPrevio` es lo que se sabía de la pregunta
     antes de contestarla, para calcular el estado nuevo. */
  function ordenar(lista, orden) {
    if (!orden || orden.length !== lista.length) return lista;
    return orden.map(function (i) { return lista[i]; });
  }

  function armar(p, orden, estadoPrevio) {
    if (p.tipo === 'estatica') {
      return {
        id: p.id, tipo: 'estatica', tema: p.tema || {}, enunciado: p.enunciado, pasaje: p.pasaje || '',
        fraseClave: p.fraseClave || '', contexto: p.contexto, estadoPrevio: estadoPrevio || null,
        opciones: ordenar(p.opciones.map(function (o) {
          return { texto: o.texto, correcta: o.id === p.correcta || o.texto === p.correcta };
        }), orden)
      };
    }
    var ej;
    if (window.RetoTestsEval) {
      ej = window.RetoTestsEval.generar({
        enunciado: p.enunciado,
        variables: p.variables || [],
        formula: p.formula,
        decimales: p.decimales !== undefined ? p.decimales : 2,
        distractores: p.distractores || [],
        opcionesAMostrar: p.opcionesAMostrar || 4
      });
    } else {
      ej = { enunciado: p.enunciado, opciones: [], explicacion: null };
    }
    return {
      id: p.id, tipo: 'dinamica', tema: p.tema || {}, enunciado: ej.enunciado, explicacion: ej.explicacion || null,
      estadoPrevio: estadoPrevio || null,
      opciones: ordenar(ej.opciones.map(function (o) {
        return { texto: o.texto, correcta: !!o.correcta, clase: o.clase || null };
      }), orden)
    };
  }

  /* ------------------------------------------------ PREPARAR UNA RONDA
     Antes de empezar, la persona elige CUÁNTAS preguntas quiere (un test de 100
     no se responde de golpe) y cuáles: las que más le conviene repasar (valor de
     fábrica), al azar o en el orden del test. Lo último que eligió se recuerda. */
  var CANTIDADES = [10, 20, 30, 50, 100];
  var MODOS = [
    { id: 'prioridad', nombre: 'Las que más me conviene repasar',
      ayuda: 'Siete de cada diez son para repasar lo que fallaste o ya toca; el resto son nuevas.' },
    { id: 'azar', nombre: 'Al azar', ayuda: 'Cualquiera del test, sin importar cómo te fue.' },
    { id: 'orden', nombre: 'En el orden del test', ayuda: 'Las primeras, tal como están escritas.' }
  ];

  function opcionRadio(nombre, valor, texto, marcado) {
    var op = el('label', 'opcion');
    var r = document.createElement('input');
    r.type = 'radio';
    r.name = nombre;
    r.value = String(valor);
    r.checked = !!marcado;
    op.appendChild(r);
    op.appendChild(el('span', null, texto));
    return op;
  }

  function preparar(t) {
    var jugables = Banco.cantidadJugable(t);
    var saltadas = t.preguntas.length - jugables;
    if (!jugables) {
      decir('Este test todavía no tiene preguntas que se puedan responder: las de números que cambian aún no se pueden resolver.');
      return;
    }
    var res = resumenes[t.id] || null;
    Promise.all([window.RetoDatos.obtener('tests-cantidad'), window.RetoDatos.obtener('tests-modo')]).then(function (g) {
      var opcionesCantidad = CANTIDADES.filter(function (n) { return n < jugables; });
      opcionesCantidad.push('todas');
      var cantidadGuardada = g[0] === 'todas' || opcionesCantidad.indexOf(Number(g[0])) >= 0 ? g[0] : null;
      var porDefecto = cantidadGuardada !== null ? String(cantidadGuardada) : (jugables <= 10 ? 'todas' : '10');
      var modoGuardado = MODOS.some(function (m) { return m.id === g[1]; }) ? g[1] : 'prioridad';

      var d = document.createElement('dialog');
      d.className = 'dialogo tst-preparar';
      d.setAttribute('aria-labelledby', 'tst-prep-titulo');
      var h = el('h2', 'dialogo-titulo', 'Antes de empezar');
      h.id = 'tst-prep-titulo';
      d.appendChild(h);
      d.appendChild(el('p', 'tst-prep-test', t.titulo));
      var resumen = jugables + (jugables === 1 ? ' pregunta' : ' preguntas');
      if (res && (res.nuevas || res.por_repasar || res.dominadas)) {
        resumen += ' · ' + res.nuevas + (res.nuevas === 1 ? ' nueva' : ' nuevas') + ' · ' + res.por_repasar + ' por repasar' +
          (res.dominadas ? ' · ' + res.dominadas + (res.dominadas === 1 ? ' dominada' : ' dominadas') : '');
      }
      d.appendChild(el('p', null, resumen + '.'));
      if (res && res.temas_debiles && res.temas_debiles.length) {
        d.appendChild(el('p', 'tst-prep-sub', 'Temas que conviene repasar:'));
        var ul = el('ul', 'tst-prep-temas');
        res.temas_debiles.forEach(function (x) {
          ul.appendChild(el('li', null, x.ruta.join(', ') + ' (' + x.n + (x.n === 1 ? ' pregunta)' : ' preguntas)')));
        });
        d.appendChild(ul);
      }
      if (saltadas) {
        d.appendChild(el('p', 'ayuda', saltadas + (saltadas === 1 ? ' pregunta no se puede responder desde esta pantalla y se omitirá.' : ' preguntas no se pueden responder desde esta pantalla y se omitirán.')));
      }

      var fc = el('fieldset');
      fc.appendChild(el('legend', null, '¿Cuántas preguntas?'));
      var oc = el('div', 'opciones');
      opcionesCantidad.forEach(function (n) {
        oc.appendChild(opcionRadio('tst-cantidad', n, n === 'todas' ? 'Todas (' + jugables + ')' : String(n), String(n) === porDefecto));
      });
      fc.appendChild(oc);
      d.appendChild(fc);

      var fm = el('fieldset');
      fm.appendChild(el('legend', null, '¿Cuáles?'));
      var om = el('div', 'opciones');
      MODOS.forEach(function (m) { om.appendChild(opcionRadio('tst-modo', m.id, m.nombre, m.id === modoGuardado)); });
      fm.appendChild(om);
      var ayudaModo = el('p', 'ayuda');
      fm.appendChild(ayudaModo);
      function textoModo() {
        var r = d.querySelector('input[name="tst-modo"]:checked');
        var m = MODOS.filter(function (x) { return r && x.id === r.value; })[0] || MODOS[0];
        ayudaModo.textContent = m.ayuda;
      }
      fm.addEventListener('change', textoModo);
      textoModo();
      d.appendChild(fm);

      var acc = el('div', 'dialogo-acciones');
      var cancelar = boton('Cancelar', null, '', function () { d.close(); });
      var empezarBtn = boton('Empezar', 'flecha', 'boton--principal', function () {
        var rc = d.querySelector('input[name="tst-cantidad"]:checked');
        var rm = d.querySelector('input[name="tst-modo"]:checked');
        var cant = rc && rc.value !== 'todas' ? Number(rc.value) : jugables;
        var modo = rm ? rm.value : 'prioridad';
        window.RetoDatos.poner('tests-cantidad', rc ? rc.value : 'todas');
        window.RetoDatos.poner('tests-modo', modo);
        d.close();
        iniciarRonda(t, null, cant, modo);
      });
      acc.appendChild(cancelar);
      acc.appendChild(empezarBtn);
      d.appendChild(acc);
      d.addEventListener('close', function () { if (d.parentNode) d.parentNode.removeChild(d); });
      document.body.appendChild(d);
      d.showModal();
      empezarBtn.focus();
    });
  }

  /* Pide la ronda al servidor, la arma y empieza. `ids` (opcional) limita a
     esas preguntas (para "repetir las que fallé"). */
  function iniciarRonda(t, ids, cantidad, modo) {
    Promise.all([Banco.ronda(t, ids, cantidad, modo), Banco.estados(t.id)]).then(function (g) {
      var r = g[0], est = g[1];
      var porId = {};
      t.preguntas.forEach(function (p) { porId[p.id] = p; });
      test = t;
      preguntas = r.preguntas.map(function (it) { return armar(porId[it.id], it.orden, est[it.id]); });
      indice = 0;
      resultados = [];
      pendientes = [];
      racha = 0;
      mejorRacha = 0;
      vueltas++;
      titularCabecera('resolviendo', t.titulo);
      pantallaPregunta();
    }).catch(function (e) { decir(e.message); });
  }

  /* ========================================================== LA PREGUNTA */

  function textoParaOir(q) {
    return (q.pasaje ? q.pasaje + ' ' : '') + q.enunciado;
  }

  /* Con la seguridad prendida SIEMPRE se confirma: los tres botones son la
     confirmación. */
  function necesitaConfirmar() {
    return ajustes().confirmar === 'on' || ajustes().seguridad === 'on';
  }

  function pantallaPregunta() {
    var q = preguntas[indice];
    elegida = null;
    var v = mostrar('pregunta', 'Pregunta ' + (indice + 1));
    decir('');
    var a = ajustes();

    var cuerpo = el('div', 'tst-pregunta');
    v.sec.appendChild(cuerpo);

    /* Lo de al lado: cuántas van y la racha. En móvil es una franja arriba; en
       pantalla ancha, una columna pegada a la derecha (40_adaptativo.css). */
    var lateral = el('div', 'tst-lateral');
    if (a.avance !== 'off') {
      var av = el('div', 'tst-avance');
      av.appendChild(el('p', null, 'Pregunta ' + (indice + 1) + ' de ' + preguntas.length));
      var barra = el('div', 'tst-barra-avance');
      barra.setAttribute('aria-hidden', 'true');
      var rel = el('div', 'tst-barra-relleno');
      rel.style.width = Math.round((indice / preguntas.length) * 100) + '%';
      barra.appendChild(rel);
      av.appendChild(barra);
      lateral.appendChild(av);
    }
    var chip = el('p', 'tst-racha');
    chip.id = 'racha';
    chip.hidden = true;
    var llama = el('span', 'tst-llama', '\uD83D\uDD25');
    llama.setAttribute('aria-hidden', 'true');
    chip.appendChild(llama);
    chip.appendChild(el('span', 'tst-racha-texto'));
    lateral.appendChild(chip);
    cuerpo.appendChild(lateral);
    pintarRacha(false);

    var col = el('div', 'tst-columna tst-columna--pregunta');
    cuerpo.appendChild(col);
    columna = col;

    if (q.pasaje) {
      var pas = el('div', 'tst-pasaje');
      pas.tabIndex = 0;
      pas.setAttribute('role', 'region');
      pas.setAttribute('aria-label', 'Texto para leer');
      pas.appendChild(el('p', null, q.pasaje));
      col.appendChild(pas);
    }

    /* El icono de escuchar va DELANTE de la pregunta: ocupa lo de un renglón y se
       entiende sin leerlo. La palabra queda en el nombre accesible. */
    var fila = el('div', 'tst-enunciado-fila');
    var enun = el('p', 'tst-enunciado', q.enunciado);
    enun.id = 'enunciado';
    fila.appendChild(enun);
    if (a.escuchar !== 'off') {
      var esc = el('button', 'boton tst-escuchar-icono');
      esc.type = 'button';
      esc.setAttribute('aria-label', 'Escuchar la pregunta');
      esc.title = 'Escuchar la pregunta';
      esc.insertAdjacentHTML('afterbegin', icono('sonido'));
      esc.addEventListener('click', function () {
        if (!Aj.hablar(textoParaOir(q))) decir('Este aparato no tiene voz para leer en voz alta.');
      });
      fila.appendChild(esc);
    }
    col.appendChild(fila);

    /* LAS RESPUESTAS: botones en una cuadrícula de 2 columnas. */
    var fs = el('fieldset', 'tst-opciones');
    fs.appendChild(el('legend', 'oculto-a-la-vista', 'Elige una respuesta'));
    q.opciones.forEach(function (o, i) {
      var b = el('button', 'tst-opcion');
      b.type = 'button';
      b.setAttribute('data-i', String(i));
      b.setAttribute('aria-pressed', 'false');
      b.appendChild(el('span', 'tst-letra', String.fromCharCode(65 + i)));
      b.appendChild(el('span', 'tst-opcion-texto', o.texto));
      b.appendChild(el('span', 'tst-estado-opcion'));
      b.insertAdjacentHTML('beforeend', icono('visto').replace('tst-icono', 'tst-icono tst-visto'));
      if (a.escuchar !== 'off') {
        var escOp = el('button', 'boton tst-escuchar-opcion');
        escOp.type = 'button';
        escOp.setAttribute('aria-label', 'Escuchar opción ' + String.fromCharCode(65 + i));
        escOp.title = 'Escuchar esta opción';
        escOp.insertAdjacentHTML('afterbegin', icono('sonido'));
        escOp.addEventListener('click', function (e) {
          e.stopPropagation();
          if (!Aj.hablar('Opción ' + String.fromCharCode(65 + i) + ': ' + o.texto)) {
            decir('Este aparato no tiene voz para leer en voz alta.');
          }
        });
        b.appendChild(escOp);
      }
      b.addEventListener('click', function () { elegirOpcion(i); });
      fs.appendChild(b);
    });
    fs.addEventListener('keydown', flechasRespuestas);
    col.appendChild(fs);

    if (necesitaConfirmar()) col.appendChild(zonaConfirmar());

    ajustarAlto();
    enfocar(v);
    if (a.leerSola === 'on') Aj.hablar(textoParaOir(q));
  }

  /* La zona de confirmar. Siempre ocupa su lugar (apagada hasta que se elige
     una respuesta), para que las respuestas no salten al elegir. */
  function zonaConfirmar() {
    var zona;
    if (ajustes().seguridad === 'on') {
      zona = el('fieldset', 'tst-seguridad');
      var cab = el('div', 'tst-seguridad-cab');
      cab.appendChild(el('legend', null, '¿Qué tan seguro estás?'));
      cab.appendChild(boton('¿Para qué sirve?', 'info', 'boton--chico', explicarSeguridad));
      zona.appendChild(cab);
      var fila = el('div', 'tst-opciones-fila');
      SEGURIDADES.forEach(function (sg) {
        var b = el('button', 'boton tst-responder');
        b.type = 'button';
        b.setAttribute('aria-disabled', 'true');
        b.setAttribute('aria-label', 'Confirmar: ' + sg.nombre.toLowerCase() + '. ' + sg.ayuda);
        b.appendChild(el('strong', null, sg.nombre));
        b.appendChild(el('span', 'ayuda', sg.ayuda));
        b.addEventListener('click', function () { responder(sg.id); });
        fila.appendChild(b);
      });
      zona.appendChild(fila);
    } else {
      zona = el('div', 'tst-acciones tst-confirmar-zona');
      var c = boton('Confirmar', 'visto', 'boton--principal tst-confirmar', function () { responder(null); });
      c.setAttribute('aria-disabled', 'true');
      zona.appendChild(c);
    }
    zona.id = 'zona-responder';
    return zona;
  }

  function explicarSeguridad() {
    window.RetoDialogo.informar({
      titulo: '¿Para qué sirve decir qué tan seguro estás?',
      texto: 'Es una forma de decirle a la aplicación qué tanto sabías la respuesta. No cambia tu ' +
        'resultado ni cuenta como error.\n\n' +
        'Estoy seguro: sabes la respuesta y no tienes dudas.\n' +
        'Tengo dudas: crees que es esa, pero no estás del todo seguro.\n' +
        'No sé: no sabías y probaste suerte.\n\n' +
        'Para qué sirve: si fallas estando seguro, creías algo que no era así, y toca volver a ' +
        'entender la idea. Si fallas adivinando, simplemente no lo sabías y hay que estudiarlo. Si ' +
        'aciertas con dudas, la respuesta está frágil y conviene repasarla pronto. Así el resultado ' +
        'te dice qué hacer con cada pregunta, no solo cuántas acertaste.\n\n' +
        'Puedes apagar esta pregunta en los ajustes.'
    });
  }

  function opcionesEl() {
    return columna ? columna.querySelectorAll('.tst-opcion') : [];
  }

  function marcarElegidas() {
    var ops = opcionesEl();
    for (var i = 0; i < ops.length; i++) {
      var activa = i === elegida;
      ops[i].setAttribute('aria-pressed', activa ? 'true' : 'false');
      ops[i].classList.toggle('tst-opcion--elegida', activa);
    }
  }

  /* Los botones de confirmar se "encienden" cuando ya hay una respuesta
     elegida. Se apagan con aria-disabled y no con disabled: así el foco no se
     pierde. */
  function actualizarBoton() {
    var zona = porId('zona-responder');
    if (!zona) return;
    var botones = zona.querySelectorAll('.tst-responder, .tst-confirmar');
    for (var i = 0; i < botones.length; i++) {
      botones[i].setAttribute('aria-disabled', elegida === null ? 'true' : 'false');
    }
  }

  /* Elegir una respuesta. Si no hay que confirmar, es lo que la envía. */
  function elegirOpcion(i) {
    if (estado !== 'pregunta') return;
    elegida = i;
    marcarElegidas();
    var q = preguntas[indice];
    if (necesitaConfirmar()) {
      actualizarBoton();
      avisar('Elegiste la opción ' + String.fromCharCode(65 + i) + ': ' + q.opciones[i].texto +
             '. Confírmala para enviarla.');
      return;
    }
    responder(null);
  }

  function avisar(texto) { decir(texto); }

  /* Las flechas mueven el foco por la cuadrícula SIN elegir. */
  function flechasRespuestas(ev) {
    var b = ev.target.closest && ev.target.closest('.tst-opcion');
    if (!b) return;
    var i = Number(b.getAttribute('data-i'));
    var total = opcionesEl().length;
    var destino = null;
    if (ev.key === 'ArrowRight') destino = i + 1;
    else if (ev.key === 'ArrowLeft') destino = i - 1;
    else if (ev.key === 'ArrowDown') destino = i + COLUMNAS_RESPUESTAS;
    else if (ev.key === 'ArrowUp') destino = i - COLUMNAS_RESPUESTAS;
    if (destino === null || destino < 0 || destino >= total) return;
    if ((ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') &&
        Math.floor(destino / COLUMNAS_RESPUESTAS) !== Math.floor(i / COLUMNAS_RESPUESTAS)) return;
    ev.preventDefault();
    opcionesEl()[destino].focus();
  }

  /* A a F y 1 a 6 eligen la respuesta de ese lugar. */
  function enTeclado(ev) {
    if (estado !== 'pregunta' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    var obj = ev.target;
    if (obj && /^(INPUT|SELECT|TEXTAREA)$/.test(obj.tagName)) return;
    var k = ev.key;
    var i = -1;
    if (/^[1-6]$/.test(k)) i = Number(k) - 1;
    else if (/^[a-fA-F]$/.test(k)) i = k.toUpperCase().charCodeAt(0) - 65;
    if (i < 0 || i >= opcionesEl().length) return;
    ev.preventDefault();
    opcionesEl()[i].focus();
    elegirOpcion(i);
  }

  /* ------------------------------------------------------ responder */

  /* Qué clase de resultado fue, con las cuatro situaciones de PROPUESTA 4.3.
     Sin seguridad (null) un acierto cuenta como dominado, y un fallo en una
     pregunta fija como "toca repasar". */
  function clasificar(q, opcion, seg) {
    if (opcion.correcta) {
      return seg === 'seguro' || seg === null ? 'dominada' : 'fragil';
    }
    if (q.tipo === 'dinamica' && opcion.clase === 'calculo') return 'calculo';
    if (q.tipo === 'dinamica' && opcion.clase === 'concepto') return 'concepto';
    return seg === 'seguro' ? 'concepto' : 'repasar';
  }

  var ETIQUETAS = {
    dominada: 'Bien: acertaste con seguridad.',
    fragil: 'Acertaste, pero con dudas. Conviene repasarla.',
    calculo: 'No fue la fórmula: el valor se fue en la cuenta.',
    concepto: 'Hay que volver a entender esta idea.',
    repasar: 'Toca repasar este tema.'
  };

  /* `seg` es la seguridad del botón que se tocó, o null si no se pregunta. */
  function responder(seg) {
    if (estado !== 'pregunta') return;
    if (elegida === null) {
      decir('Primero elige una respuesta.');
      return;
    }
    estado = 'respondida';
    var q = preguntas[indice];
    var op = q.opciones[elegida];
    var clase = clasificar(q, op, seg);
    resultados.push({ q: q, acierto: op.correcta, clase: clase, opcion: op });
    anotar(q, op, seg, clase);
    bloquearPregunta();
    if (op.correcta) {
      racha++;
      if (racha > mejorRacha) mejorRacha = racha;
      Aj && Aj.sonarAcierto();
      mostrarAcierto();
    } else {
      racha = 0;
      abrirModal(q, op);
    }
  }

  /* Cada respuesta se anota de inmediato (el registro) y el servidor calcula el
     estado nuevo de la pregunta, que también se guarda. Va en segundo plano para
     que pasar a la siguiente pregunta no espere; la pantalla de resultados sí
     espera a que termine, para no mostrar algo que luego cambia. */
  function anotar(q, op, seg, clase) {
    var id = test.id;
    pendientes.push(Banco.registrarIntento(id, {
      ts: Date.now(), qid: q.id, acierto: op.correcta, seguridad: seg || null,
      clase: clase, eleccion: op.texto
    }).catch(function () {}));
    pendientes.push(Banco.registrarRespuesta(id, q.id, q.estadoPrevio, op.correcta, seg).catch(function (e) {
      decir('No se pudo anotar esta respuesta: ' + e.message);
    }));
  }

  function conMovimiento() {
    if (ajustes().movimiento === 'off') return false;
    var anim = document.documentElement.getAttribute('data-anim');
    if (anim === 'off') return false;
    var menos = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !(menos && anim !== 'on');
  }

  /* La llama de la racha. Se enseña desde 2 aciertos seguidos (con 1 no hay
     "racha"), con el número escrito al lado, y crece un poco con la racha. La
     animación (una sola vez) solo cuando acaba de subir. */
  function pintarRacha(sube) {
    var chip = porId('racha');
    if (!chip) return;
    var ver = ajustes().racha !== 'off' && racha >= 2;
    chip.hidden = !ver;
    if (!ver) { chip.removeAttribute('data-sube'); return; }
    chip.querySelector('.tst-racha-texto').textContent = 'Racha de ' + racha;
    chip.style.setProperty('--nivel', String(Math.min(3, Math.floor(racha / 2))));
    chip.removeAttribute('data-sube');
    if (sube && conMovimiento()) {
      void chip.offsetWidth;     // reinicia la animación si ya estaba puesta
      chip.setAttribute('data-sube', '1');
    }
  }

  /* La respuesta correcta: se pinta de verde (si se pidió), lleva el visto y la
     palabra "Correcta", y se anuncia. NO hay recuadro aparte. */
  function mostrarAcierto() {
    var opcionEl = opcionesEl()[elegida];
    if (ajustes().acierto !== 'off') {
      opcionEl.setAttribute('data-resultado', 'acierto');
      if (conMovimiento()) opcionEl.setAttribute('data-anim', '1');
    }
    opcionEl.querySelector('.tst-estado-opcion').textContent =
      ajustes().acierto !== 'off' ? 'Correcta' : 'Elegida';
    pintarRacha(true);
    decir('Respuesta correcta.' + (racha >= 2 && ajustes().racha !== 'off' ? ' Racha de ' + racha + '.' : ''));
    continuar();
  }

  function espera() {
    var n = parseInt(ajustes().espera, 10);
    if (isNaN(n)) n = 800;
    return Math.min(1500, Math.max(200, n));
  }

  /* Qué sigue después de contestar bien: avanzar solo tras la pausa o, si se
     pidió, un botón. Se vuelve a llamar si se abrieron los ajustes a medias. */
  function continuar() {
    cancelarAvance();
    var hayOtra = indice + 1 < preguntas.length;
    var zona = porId('zona-responder');
    if (zona) zona.hidden = true;
    if (ajustes().siguiente === 'yo') {
      var viejo = porId('zona-siguiente');
      if (viejo) return;
      var acc = el('div', 'tst-acciones');
      acc.id = 'zona-siguiente';
      var b = boton(hayOtra ? 'Siguiente pregunta' : 'Ver cómo fue', 'flecha', 'boton--principal', siguiente);
      acc.appendChild(b);
      columna.appendChild(acc);
      b.focus();
      return;
    }
    avanceId = window.setTimeout(function () {
      avanceId = null;
      if (estado === 'respondida') siguiente();
    }, espera());
  }

  function bloquearPregunta() {
    var ops = opcionesEl();
    for (var i = 0; i < ops.length; i++) {
      ops[i].setAttribute('aria-disabled', 'true');
      ops[i].tabIndex = -1;
    }
    var zona = porId('zona-responder');
    if (zona) zona.hidden = true;
  }

  function siguiente() {
    cancelarAvance();
    if (indice + 1 < preguntas.length) {
      indice++;
      pantallaPregunta();
    } else {
      pantallaResultado();
    }
  }

  /* ===================================================== EL MODAL DEL ERROR */

  function abrirModal(q, opcion) {
    estado = 'respondida';
    bloquearPregunta();
    var d = document.createElement('dialog');
    d.className = 'dialogo tst-modal';
    d.setAttribute('aria-labelledby', 'tst-modal-titulo');
    var h = el('h2', 'dialogo-titulo', 'Mira esto antes de seguir');
    h.id = 'tst-modal-titulo';
    h.tabIndex = -1;
    d.appendChild(h);
    d.appendChild(el('p', null, q.tipo === 'dinamica' && q.explicacion
      ? 'Aquí está la fórmula, con los números de esta pregunta.'
      : 'Esto te puede ayudar a recordar. Léelo con calma.'));

    if (q.tipo === 'dinamica' && q.explicacion) {
      d.appendChild(window.RetoTestsMuestra.explicacion(q.explicacion));
    } else {
      if (q.pasaje && q.fraseClave) {
        var pas = el('div', 'tst-pasaje');
        var p = el('p');
        var i = q.pasaje.indexOf(q.fraseClave);
        if (i >= 0) {
          p.appendChild(document.createTextNode(q.pasaje.slice(0, i)));
          var m = el('mark', 'tst-marca');
          m.appendChild(el('span', 'oculto-a-la-vista', 'Aquí: '));
          m.appendChild(document.createTextNode(q.fraseClave));
          p.appendChild(m);
          p.appendChild(document.createTextNode(q.pasaje.slice(i + q.fraseClave.length)));
        } else {
          p.textContent = q.pasaje;
        }
        pas.appendChild(p);
        var nota = el('p', 'tst-aqui');
        nota.insertAdjacentHTML('afterbegin', icono('aviso'));
        nota.appendChild(document.createTextNode('La frase subrayada es la que tienes que mirar.'));
        pas.appendChild(nota);
        d.appendChild(pas);
      }
      parrafos(d, q.contexto);
    }

    var acc = el('div', 'dialogo-acciones');
    var ok = boton('Entendido, seguir', 'flecha', 'boton--principal', function () { d.close(); });
    acc.appendChild(ok);
    d.appendChild(acc);
    d.addEventListener('close', function () {
      if (d.parentNode) d.parentNode.removeChild(d);
      modalAbierto = null;
      /* Al cerrarlo, SE SIGUE: no se pide reintentar (PROPUESTA 4.4). */
      siguiente();
    });
    document.body.appendChild(d);
    modalAbierto = d;
    d.showModal();
    h.focus();
  }

  /* ========================================================== EL RESULTADO */

  /* QUÉ REPASAR. De cada pregunta fallada sale su tema: los niveles 2 a 4 que
     tenga, en orden, separados por comas. El nivel 1 es el título del test y NO se
     repite (decir "Matemáticas" en un test de matemáticas sería redundante); en un
     examen global, el nivel 2 sí aparece ("Matemáticas, Bloque I, Las fracciones").
     Un nivel que no se escribió no se concatena. Los temas iguales se juntan con
     su cuenta. Si ninguna pregunta fallada tiene tema, se dice el título del
     test, que es lo único que se sabe. */
  function temasParaRepasar() {
    var cuenta = {};
    var orden = [];
    var fallos = resultados.filter(function (r) { return !r.acierto; });
    fallos.forEach(function (r) {
      var k = Lista.rutaDeTema(r.q.tema).join(', ');
      if (!k) return;
      if (!cuenta[k]) { cuenta[k] = 0; orden.push(k); }
      cuenta[k]++;
    });
    if (!orden.length && fallos.length) return [{ tema: test.titulo, n: fallos.length }];
    return orden.map(function (k) { return { tema: k, n: cuenta[k] }; });
  }

  function bloqueRepasar(lista) {
    var b = el('section', 'tst-repasar');
    b.setAttribute('aria-labelledby', 'repasar-titulo');
    var h = el('h3', null, 'Qué repasar');
    h.id = 'repasar-titulo';
    b.appendChild(h);
    b.appendChild(el('p', null, lista.length === 1 ? 'Te conviene repasar:' : 'Te conviene repasar estos temas:'));
    var ul = el('ul');
    lista.forEach(function (t) {
      var li = el('li', null, t.tema + ' ');
      li.appendChild(el('span', null, '(' + t.n + (t.n === 1 ? ' pregunta fallada)' : ' preguntas falladas)')));
      ul.appendChild(li);
    });
    b.appendChild(ul);
    return b;
  }

  function pantallaResultado() {
    var v = mostrar('resultado', 'Terminaste');
    titularCabecera('resultado', test.titulo);
    /* Lo único que se guarda de verdad: cuándo se hizo este test, para poder
       ordenar la lista "por último test realizado". */
    window.RetoDatos.poner('tests-hecho-' + test.id, Date.now());
    Promise.all(pendientes);
    var aciertos = resultados.filter(function (r) { return r.acierto; }).length;
    var total = resultados.length;
    decir('');
    var col = el('div', 'tst-columna');
    v.sec.appendChild(col);
    var resumen = el('p', 'tst-enunciado', 'Acertaste ' + aciertos + ' de ' + total + '.');
    col.appendChild(resumen);
    if (ajustes().racha !== 'off' && mejorRacha >= 2) {
      var rr = el('p', 'tst-racha');
      rr.style.setProperty('--nivel', String(Math.min(3, Math.floor(mejorRacha / 2))));
      var ll = el('span', 'tst-llama', '\uD83D\uDD25');
      ll.setAttribute('aria-hidden', 'true');
      rr.appendChild(ll);
      rr.appendChild(el('span', null, 'Tu mejor racha: ' + mejorRacha + ' seguidas'));
      col.appendChild(rr);
    }
    col.appendChild(el('p', null, aciertos === total
      ? 'Las contestaste todas bien. Para fijarlo, vuelve a hacer este test otro día.'
      : 'Lo que falló te dice qué mirar. No es una nota: es un mapa de lo que conviene repasar.'));

    /* Los tests tambien dan power ups (cada 10 aciertos acumulados, maximo 10 al dia). Una sola vez por ronda. */
    if (window.RetoRpg && !resultados._premiado) {
      resultados._premiado = true;
      window.RetoRpg.mostrarPremiosDeTest(col, aciertos);
    }

    var repasar = temasParaRepasar();
    if (repasar.length) col.appendChild(bloqueRepasar(repasar));

    col.appendChild(el('p', 'ayuda', 'Tus respuestas se guardaron: lo que fallaste vuelve pronto y lo que dominas se va espaciando.'));

    var acc = el('div', 'tst-acciones');
    var fallos = resultados.filter(function (r) { return !r.acierto; });
    if (fallos.length) {
      acc.appendChild(boton('Repetir solo las que fallé', 'dinamica', 'boton--principal', function () {
        var ids = fallos.map(function (r) { return r.q.id; });
        iniciarRonda(test, ids, ids.length, 'azar');
      }));
    }
    acc.appendChild(boton('Hacer otra ronda', 'dinamica', fallos.length ? '' : 'boton--principal', function () {
      var t = test;
      Promise.all(pendientes).then(function () { return Banco.resumenes([t]); }).then(function (r) {
        resumenes[t.id] = r[t.id] || resumenes[t.id];
        preparar(t);
      }, function () { preparar(t); });
    }));
    acc.appendChild(boton('Elegir otro test', 'lista', '', pantallaElegir));
    col.appendChild(acc);
    enfocar(v);
  }

  /* ================================================================ ARRANQUE */

  function iniciar() {
    raiz = document.getElementById('vistas');
    estadoEl = document.getElementById('estado');
    cabEl = document.querySelector('header h1');
    cabOriginal = cabEl ? cabEl.textContent : '';
    if (!raiz || !window.RetoDialogo || !Muestra || !Lista || !Banco) return;
    document.addEventListener('keydown', enTeclado);
    window.addEventListener('resize', ajustarAlto);

    if (Aj) {
      Aj.iniciar({
        resolver: true,
        /* Abrir los ajustes detiene el avance automático: no se puede estar
           configurando con la pantalla cambiando detrás. Al cerrarlos, si se
           estaba esperando para avanzar, se retoma (ver alCerrar). */
        alAbrir: cancelarAvance,
        alCerrar: function () {
          if (estado === 'respondida' && !modalAbierto && avanceId === null) continuar();
        },
        alCambiar: function (clave) {
          /* Lo de la lista (ver, vista, tamaño) se aplica volviendo a pintarla. Lo
             que cambia lo que hay en la pregunta (el avance, confirmar, la
             seguridad, el icono de escuchar) se aplica al volver a dibujarla,
             conservando la respuesta elegida. Lo demás ya lo hizo el módulo de
             ajustes en <html>. */
          if (estado === 'elegir') {
            if (listaCtl) listaCtl.repintar();
          } else if (estado === 'pregunta' && (clave === 'avance' || clave === 'confirmar' ||
              clave === 'seguridad' || clave === 'escuchar' || clave === 'racha' ||
              clave === 'perfil' || clave === 'fabrica')) {
            var eleg = elegida;
            pantallaPregunta();
            if (eleg !== null && necesitaConfirmar()) { elegida = eleg; marcarElegidas(); actualizarBoton(); }
          } else if (clave === 'racha') {
            pintarRacha(false);
          }
        }
      });
      var cfg = document.querySelector('[data-configurar]');
      if (cfg) cfg.addEventListener('click', function () { Aj.abrir(estado === 'elegir' ? 'lista' : 'general'); });
    }
    var ayuda = document.querySelector('[data-ayuda]');
    if (ayuda) {
      ayuda.addEventListener('click', function () {
        window.RetoDialogo.informar({
          titulo: 'Cómo se resuelve un test',
          texto: 'Elige un test y responde pregunta por pregunta. No hay reloj: tómate el tiempo que necesites.\n\n' +
            'Toca la respuesta que creas correcta: se envía al tocarla y, tras una pausa corta, aparece la ' +
            'siguiente pregunta. Si prefieres confirmar antes de enviar, o que nada avance solo, ' +
            'cámbialo en los ajustes. Con el teclado: las flechas mueven entre las respuestas, y ' +
            'Enter, la barra espaciadora, las letras A a F o los números 1 a 6 eligen.\n\n' +
            'El altavoz que va antes de la pregunta la lee en voz alta.\n\n' +
            'Si no era, no se te dice cuál era la correcta: se te enseña qué mirar para que lo rehagas tú, ' +
            'y al cerrarlo sigues con la siguiente pregunta.\n\n' +
            'Tus respuestas se guardan en este navegador (y entran en tu respaldo de datos): lo que fallas vuelve pronto.'
        });
      });
    }
    pantallaElegir();
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
