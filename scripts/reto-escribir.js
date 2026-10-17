/* =========================================================================
   R.E.T.O. - Escribir (la pantalla)

   QUÉ ES
   Contestar un test SIN ver las opciones: se lee la pregunta y se escribe la
   respuesta. Recordar sin ayuda enseña más que reconocer la correcta entre
   varias. Lee los mismos tests del banco que "Resolver test" (fijas y
   dinámicas) y lo que se contesta entra al mismo registro de repaso.

   EL RECORRIDO
     Elegir un test  →  Una pregunta a la vez  →  Resultado

   DECISIONES DE DISEÑO (y por qué)
   - SIN RELOJ, igual que "Resolver" (PROPUESTA 5.2, WCAG 2.2.1).
   - EL ERROR NO ENSEÑA LA RESPUESTA (PROPUESTA 4.4), como en "Resolver": al
     fallar se abre "Mira esto" con el contexto o, en las dinámicas, la fórmula con
     los números de esa pregunta y su resultado. Al cerrarlo se sigue. (Si se acierta con una letra distinta,
     sí se muestra cómo se escribe: ya la sabía.)
   - SE COMPARA CON JUSTICIA: mayúsculas, acentos, artículos y espacios no
     cuentan; los números se comparan como números; y los errores de escritura
     se toleran (se puede apagar). Todo eso vive en reto-escribir-logica.js.
   - "NO LO SÉ" ES UNA RESPUESTA HONESTA: cuenta como no sabida y abre "Mira
     esto". No hay que inventar algo para poder seguir.
   - Lo que sigue después de contestar bien (avanzar solo tras una pausa, o con
     un botón), la racha, el sonido y el escuchar son los ajustes COMPARTIDOS
     de todos los tests (RetoTestsAjustes): se cambian en un solo lugar.
   - LOS AJUSTES PROPIOS (cuántas preguntas, cuáles, tolerancia y pista) están
     en el botón del panel. Valen desde la ronda siguiente.
   - TODO LO QUE SE VE LLEVA UN TEXTO: un acierto dice "Correcta" con un visto,
     y nada depende solo del color.
   ========================================================================= */
(function () {
  'use strict';

  var Muestra = window.RetoTestsMuestra;
  var icono = Muestra.icono;
  var Aj = window.RetoTestsAjustes;
  var Lista = window.RetoTestsLista;
  var Banco = window.RetoTestsBanco;
  var Inst = window.RetoTestsInstancia;
  var Logica = window.RetoEscribirLogica;
  var Datos = window.RetoDatos;

  var PREFIJO = 'escribir-';

  var FABRICA = {
    cuantas: '8',
    cuales: 'prioridad',
    tolerancia: 'flexible',
    pista: 'off'
  };

  var CUANTAS = ['5', '8', '10', '15', '20'];
  var CUALES = [
    ['prioridad', 'Las que más me conviene repasar'],
    ['azar', 'Al azar'],
    ['orden', 'En el orden del test']
  ];

  var ajustes = {};
  var tests = [];
  var resumenes = {};
  var test = null;
  var mazo = [];
  var indice = 0;
  var racha = 0;
  var mejorRacha = 0;
  var resultados = [];
  var estado = 'elegir';       // elegir | pregunta | respondida | resultado
  var estadosPrevios = {};
  var pendientes = [];
  var avanceId = null;
  var modalAbierto = null;
  var dlgAjustes = null;
  var listaCtl = null;
  var columna = null;

  var raiz, estadoEl, cabEl, cabOriginal;

  /* ---------------------------------------------------------- utilidades */

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function limpiar(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function decir(t) { if (estadoEl) estadoEl.textContent = t || ''; }
  function ajustesTests() { return Aj ? Aj.valores() : {}; }

  function boton(texto, iconoId, clase, alClick) {
    var b = el('button', 'boton ' + (clase || ''));
    b.type = 'button';
    if (iconoId) b.insertAdjacentHTML('afterbegin', icono(iconoId));
    b.appendChild(document.createTextNode(texto));
    if (alClick) b.addEventListener('click', alClick);
    return b;
  }

  function parrafos(contenedor, texto) {
    String(texto || '').split(/\n+/).forEach(function (linea) {
      if (linea.trim()) contenedor.appendChild(el('p', null, linea));
    });
  }

  function porId(id) { return document.getElementById(id); }
  function cancelarVoz() { if (Aj) Aj.callar(); }
  function cancelarAvance() { if (avanceId !== null) { window.clearTimeout(avanceId); avanceId = null; } }

  function conMovimiento() {
    if (ajustesTests().movimiento === 'off') return false;
    var anim = document.documentElement.getAttribute('data-anim');
    if (anim === 'off') return false;
    var menos = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !(menos && anim !== 'on');
  }

  function espera() {
    var n = parseInt(ajustesTests().espera, 10);
    if (isNaN(n)) n = 800;
    return Math.min(1500, Math.max(200, n));
  }

  function titularCabecera(prefijo, titulo) {
    if (!cabEl) return;
    limpiar(cabEl);
    if (!prefijo) {
      cabEl.textContent = cabOriginal;
      cabEl.removeAttribute('title');
      document.title = cabOriginal;
      return;
    }
    cabEl.appendChild(el('span', 'tst-cab-pre', prefijo));
    cabEl.appendChild(document.createTextNode('\u00AB' + titulo + '\u00BB'));
    cabEl.setAttribute('title', prefijo + '\u00AB' + titulo + '\u00BB');
    document.title = prefijo + '\u00AB' + titulo + '\u00BB';
  }

  function mostrar(cual, titulo) {
    estado = cual;
    cancelarAvance();
    cancelarVoz();
    document.documentElement.setAttribute('data-tst-vista', cual === 'respondida' ? 'pregunta' : cual);
    limpiar(raiz);
    var oculto = cual === 'pregunta';
    var sec = el('section', 'tst-vista');
    sec.id = 'v-' + cual;
    var h = el('h2', oculto ? 'oculto-a-la-vista' : null, titulo);
    h.tabIndex = -1;
    sec.appendChild(h);
    raiz.appendChild(sec);
    return { sec: sec, h: h };
  }

  function enfocar(v) {
    v.h.focus();
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------- ajustes */

  function cargarAjustes() {
    return Promise.all(Object.keys(FABRICA).map(function (clave) {
      return Datos.obtener(PREFIJO + clave).then(function (v) {
        ajustes[clave] = (v === null || v === undefined) ? FABRICA[clave] : String(v);
      });
    }));
  }

  function guardarAjuste(clave, valor) {
    ajustes[clave] = valor;
    return Datos.poner(PREFIJO + clave, valor);
  }

  /* ========================================================= ELEGIR TEST */

  function tarjetaEscribir(t, ctx) {
    var a = el('a', 'tarjeta tarjeta-nav tst-tarjeta');
    a.href = '#' + t.id;
    a.insertAdjacentHTML('afterbegin', Muestra.iconoTarjeta(t.materia));
    a.appendChild(el('strong', 'tarjeta-titulo', t.titulo));
    if (t.descripcion) a.appendChild(el('span', 'tarjeta-texto', t.descripcion));
    var meta = el('span', 'tst-tarjeta-meta');
    meta.appendChild(document.createTextNode(
      (ctx.plano ? t.materia + ' · ' : '') +
      (t.preguntas.length === 1 ? '1 pregunta' : t.preguntas.length + ' preguntas')));
    meta.appendChild(Lista.etiquetaTipo(Lista.tipoDeTest(t)));
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
    a.setAttribute('aria-label', 'Escribir las respuestas del test ' + t.titulo + '. ' +
      (t.preguntas.length === 1 ? '1 pregunta' : t.preguntas.length + ' preguntas') + '. ' + ctx.hace + '.' +
      (repasar ? ' ' + repasar + ' por repasar.' : ''));
    a.addEventListener('click', function (ev) { ev.preventDefault(); empezar(t, null); });
    return a;
  }

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
    cancelarVoz();
    titularCabecera(null);
    var v = mostrar('elegir', 'Elige un test');
    decir('');
    v.sec.appendChild(el('p', null, 'Lee la pregunta y escribe la respuesta, sin ver opciones. Sin reloj y sin prisa: recordar sin ayuda es lo que más se aprende.'));
    var cont = el('div');
    v.sec.appendChild(cont);
    enfocar(v);
    Banco.cargar().then(function (lista) {
      tests = lista;
      listaCtl = Lista.montar({
        contenedor: cont,
        prefijo: 'esc',
        tests: function () { return tests; },
        tarjeta: tarjetaEscribir,
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

  /* `ids` (opcional) limita a esas preguntas ("repetir las que fallé"). Las
     ordena el servidor por prioridad de repaso, como en "Resolver"; si no
     contesta, se usa un orden al azar y se juega igual. */
  function empezar(t, ids) {
    var porIdP = {};
    t.preguntas.forEach(function (p) { porIdP[p.id] = p; });
    var jugables = t.preguntas.filter(function (p) {
      return Banco.jugable(p) && (!ids || ids.indexOf(p.id) >= 0);
    });
    if (jugables.length < 1) { decir('Este test no tiene preguntas para jugar.'); return; }
    var cuantas = ids ? Math.min(20, ids.length) : Number(ajustes.cuantas);
    /* Se piden de sobra: las respuestas largas no sirven para escribir y se
       descartan. */
    var pedir = Math.min(jugables.length, cuantas + 10);
    Promise.all([
      Banco.ronda(t, ids, pedir, ids ? 'azar' : ajustes.cuales).catch(function () { return null; }),
      Banco.estados(t.id).catch(function () { return {}; })
    ]).then(function (g) {
      var r = g[0];
      var cands = r && r.preguntas
        ? r.preguntas.map(function (it) { return porIdP[it.id]; }).filter(Boolean)
        : Inst.barajar(jugables);
      if (cands.length < 1) cands = Inst.barajar(jugables);
      var armado = Inst.armarMazo(cands, cuantas, { evaluador: window.RetoTestsEval, sirve: Logica.sirve });
      if (!armado.length) {
        decir('Este test no tiene preguntas de respuesta corta para escribir. Prueba con "Tarjetas de estudio".');
        return;
      }
      test = t;
      mazo = armado;
      indice = 0;
      racha = 0;
      mejorRacha = 0;
      resultados = [];
      estadosPrevios = g[1] || {};
      pendientes = [];
      titularCabecera('Escribiendo el test ', t.titulo);
      pantallaPregunta();
    }).catch(function (e) { decir(e.message); });
  }

  /* ============================================================ LA PREGUNTA */

  function textoParaOir(q) { return q.enunciado; }

  function esNumerica(q) {
    var ok = Inst.respuestaOk(q);
    return !!ok && !isNaN(Logica.numero(ok.texto, q.tipo !== 'dinamica'));
  }

  function pintarRacha(sube) {
    var chip = porId('racha');
    if (!chip) return;
    var ver = ajustesTests().racha !== 'off' && racha >= 2;
    chip.hidden = !ver;
    if (!ver) { chip.removeAttribute('data-sube'); return; }
    chip.querySelector('.tst-racha-texto').textContent = 'Racha de ' + racha;
    chip.style.setProperty('--nivel', String(Math.min(3, Math.floor(racha / 2))));
    chip.removeAttribute('data-sube');
    if (sube && conMovimiento()) {
      void chip.offsetWidth;
      chip.setAttribute('data-sube', '1');
    }
  }

  function pantallaPregunta() {
    var q = mazo[indice];
    var v = mostrar('pregunta', 'Pregunta ' + (indice + 1));
    decir('');
    var a = ajustesTests();

    var cuerpo = el('div', 'tst-pregunta');
    v.sec.appendChild(cuerpo);

    var lateral = el('div', 'tst-lateral');
    if (a.avance !== 'off') {
      var av = el('div', 'tst-avance');
      av.appendChild(el('p', null, 'Pregunta ' + (indice + 1) + ' de ' + mazo.length));
      var barra = el('div', 'tst-barra-avance');
      barra.setAttribute('aria-hidden', 'true');
      var rel = el('div', 'tst-barra-relleno');
      rel.style.width = Math.round((indice / mazo.length) * 100) + '%';
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

    /* LA RESPUESTA ESCRITA. Un <form>: Enter envía. Sin autocorrección ni
       mayúscula automática (el teclado del celular no debe "arreglar" lo que se
       está tratando de recordar). En respuestas numéricas, el teclado de
       números. */
    var form = el('form', 'esc-form');
    form.id = 'esc-form';
    form.setAttribute('novalidate', 'novalidate');
    var etiqueta = el('label', 'esc-etiqueta', 'Tu respuesta');
    etiqueta.setAttribute('for', 'esc-campo');
    form.appendChild(etiqueta);
    var campo = el('input', 'esc-campo');
    campo.id = 'esc-campo';
    campo.type = 'text';
    campo.autocomplete = 'off';
    campo.setAttribute('autocapitalize', 'off');
    campo.setAttribute('autocorrect', 'off');
    campo.spellcheck = false;
    if (esNumerica(q)) campo.setAttribute('inputmode', 'decimal');
    form.appendChild(campo);

    var pista = Logica.pista(q, ajustes.pista);
    if (pista) {
      var p = el('p', 'esc-pista');
      p.appendChild(el('span', 'esc-pista-titulo', 'Pista: '));
      p.appendChild(el('span', 'esc-pista-texto', pista));
      p.setAttribute('aria-label', 'Pista: la respuesta tiene ' + String(Inst.respuestaOk(q).texto).trim().length + ' caracteres');
      form.appendChild(p);
    }

    var aviso = el('p', 'esc-aviso');
    aviso.id = 'esc-aviso';
    aviso.setAttribute('role', 'status');
    form.appendChild(aviso);

    var zona = el('div', 'tst-acciones');
    zona.id = 'zona-responder';
    var responder = el('button', 'boton boton--principal', 'Responder');
    responder.type = 'submit';
    responder.insertAdjacentHTML('afterbegin', icono('flecha'));
    zona.appendChild(responder);
    zona.appendChild(boton('No lo sé', 'info', '', function () { responder_(null); }));
    form.appendChild(zona);
    col.appendChild(form);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      responder_(campo.value);
    });

    enfocar(v);
    campo.focus();
    if (a.leerSola === 'on') Aj.hablar(textoParaOir(q));
  }

  /* ----------------------------------------------------------- responder */

  /* `escrito` es null cuando se toca "No lo sé". */
  function responder_(escrito) {
    if (estado !== 'pregunta') return;
    var q = mazo[indice];
    var campo = porId('esc-campo');
    var veredicto;
    if (escrito === null) {
      veredicto = { resultado: 'mal', cercano: false, opcion: null, nose: true };
    } else {
      veredicto = Logica.evaluar(q, escrito, ajustes.tolerancia);
      if (veredicto.resultado === 'vacio') {
        porId('esc-aviso').textContent = 'Escribe tu respuesta, o toca "No lo sé".';
        decir('Escribe tu respuesta, o toca "No lo sé".');
        if (campo) campo.focus();
        return;
      }
    }
    estado = 'respondida';
    var acierto = veredicto.resultado === 'ok';
    var clase = Logica.clasificar(acierto, veredicto.opcion);
    var eleccion = escrito === null ? '' : String(escrito).trim();
    resultados.push({ q: q, acierto: acierto, clase: clase, eleccion: eleccion, nose: !!veredicto.nose, opcion: veredicto.opcion });
    anotar(q, acierto, clase, eleccion);
    bloquearCampo();

    if (acierto) {
      racha++;
      if (racha > mejorRacha) mejorRacha = racha;
      if (Aj) Aj.sonarAcierto();
      mostrarAcierto(q, veredicto);
    } else {
      racha = 0;
      abrirMira(q, veredicto.opcion, escrito === null, function () { siguiente(); });
    }
  }

  function anotar(q, acierto, clase, eleccion) {
    var id = test.id;
    pendientes.push(Banco.registrarIntento(id, {
      ts: Date.now(), qid: q.id, acierto: acierto, seguridad: null,
      clase: clase, eleccion: eleccion
    }).catch(function () {}));
    pendientes.push(Banco.registrarRespuesta(id, q.id, estadosPrevios[q.id], acierto, null).catch(function (e) {
      decir('No se pudo anotar esta respuesta: ' + e.message);
    }));
  }

  function bloquearCampo() {
    var campo = porId('esc-campo');
    if (campo) { campo.readOnly = true; campo.setAttribute('aria-readonly', 'true'); }
    var zona = porId('zona-responder');
    if (zona) zona.hidden = true;
  }

  /* El acierto: el campo se pinta de verde (si se pidió), lleva el visto y la
     palabra "Correcta", y se anuncia. Si se acertó con una letra distinta, se
     dice cómo se escribe: ya la sabía, y así se queda bien escrita. */
  function mostrarAcierto(q, veredicto) {
    var campo = porId('esc-campo');
    var aviso = porId('esc-aviso');
    var a = ajustesTests();
    if (a.acierto !== 'off' && campo) {
      campo.setAttribute('data-resultado', 'acierto');
      if (conMovimiento()) campo.setAttribute('data-anim', '1');
    }
    var ok = Inst.respuestaOk(q).texto;
    aviso.textContent = '';
    aviso.insertAdjacentHTML('afterbegin', icono('visto'));
    aviso.appendChild(document.createTextNode(veredicto.cercano
      ? 'Correcta. Se escribe: \u00AB' + ok + '\u00BB'
      : 'Correcta'));
    aviso.setAttribute('data-resultado', 'acierto');
    pintarRacha(true);
    decir('Respuesta correcta.' + (veredicto.cercano ? ' Se escribe ' + ok + '.' : '') +
      (racha >= 2 && a.racha !== 'off' ? ' Racha de ' + racha + '.' : ''));
    continuar();
  }

  function continuar() {
    cancelarAvance();
    var hayOtra = indice + 1 < mazo.length;
    if (ajustesTests().siguiente === 'yo') {
      if (porId('zona-siguiente')) return;
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

  function siguiente() {
    if (estado !== 'respondida') return;
    cancelarAvance();
    if (indice + 1 < mazo.length) { indice++; pantallaPregunta(); }
    else pantallaResultado();
  }

  /* ----------------------------------------------------- "Mira esto" */

  /* Lo mismo que en "Resolver": se enseña qué mirar. Con números que cambian, la
     fórmula, la fórmula con los números de esa pregunta y el resultado. */
  function contenidoMira(q, opcion) {
    var caja = document.createDocumentFragment();
    caja.appendChild(el('p', 'tst-enunciado', q.enunciado));
    if (q.tipo === 'dinamica' && q.explicacion) {
      caja.appendChild(el('p', null, 'Aquí está la fórmula, con los números de esta pregunta.'));
      caja.appendChild(Muestra.explicacion(q.explicacion));
    } else if (q.contexto) {
      caja.appendChild(el('p', null, 'Esto te puede ayudar a recordar. Léelo con calma.'));
      var tmp = el('div');
      parrafos(tmp, q.contexto);
      while (tmp.firstChild) caja.appendChild(tmp.firstChild);
    } else {
      caja.appendChild(el('p', null, 'Piensa otra vez en esta pregunta y en lo que ya sabes de ella.'));
    }
    return caja;
  }

  function abrirMira(q, opcion, nose, alCerrar) {
    var d = document.createElement('dialog');
    d.className = 'dialogo tst-modal';
    d.setAttribute('aria-labelledby', 'esc-mira-titulo');
    var h = el('h2', 'dialogo-titulo', nose ? 'Está bien no saberlo. Mira esto' : 'Mira esto antes de seguir');
    h.id = 'esc-mira-titulo';
    h.tabIndex = -1;
    d.appendChild(h);
    d.appendChild(contenidoMira(q, opcion));
    var acc = el('div', 'dialogo-acciones');
    var hayOtra = indice + 1 < mazo.length;
    acc.appendChild(boton(hayOtra ? 'Entendido, seguir' : 'Entendido, ver cómo fue', 'flecha', 'boton--principal', function () { d.close(); }));
    d.appendChild(acc);
    d.addEventListener('close', function () {
      if (d.parentNode) d.parentNode.removeChild(d);
      modalAbierto = null;
      if (alCerrar) alCerrar();
    });
    document.body.appendChild(d);
    modalAbierto = d;
    d.showModal();
    h.focus();
    if (ajustesTests().leerSola === 'on' && Aj) Aj.hablar(q.contexto || q.enunciado);
  }

  /* ============================================================ EL FINAL */

  function temasParaRepasar() {
    var cuenta = {};
    var orden = [];
    resultados.filter(function (r) { return !r.acierto; }).forEach(function (r) {
      var k = Lista.rutaDeTema(r.q.tema).join(', ');
      if (!k) return;
      if (!cuenta[k]) { cuenta[k] = 0; orden.push(k); }
      cuenta[k]++;
    });
    return orden.map(function (k) { return { ruta: k, n: cuenta[k] }; });
  }

  function pantallaResultado() {
    var v = mostrar('resultado', 'Terminaste');
    titularCabecera('Resultado de escribir ', test.titulo);
    Datos.poner('tests-hecho-' + test.id, Date.now());
    decir('');
    var aciertos = resultados.filter(function (r) { return r.acierto; }).length;
    var total = resultados.length;

    var col = el('div', 'tst-columna esc-resultado');
    v.sec.appendChild(col);
    col.appendChild(el('p', 'tst-enunciado', 'Acertaste ' + aciertos + ' de ' + total + (total === 1 ? ' pregunta.' : ' preguntas.')));
    if (mejorRacha >= 2 && ajustesTests().racha !== 'off') {
      col.appendChild(el('p', null, 'Tu mejor racha fue de ' + mejorRacha + ' seguidas.'));
    }
    col.appendChild(el('p', null, aciertos === total
      ? 'Las escribiste todas bien, sin ver opciones. Para fijarlo, vuelve a intentarlo otro día.'
      : 'Lo que falló te dice qué mirar. No es una nota: es un mapa de lo que conviene repasar.'));

    var ol = el('ol', 'esc-resumen');
    resultados.forEach(function (r) {
      var li = el('li', 'esc-resumen-fila');
      li.setAttribute('data-acierto', r.acierto ? 'si' : 'no');
      li.appendChild(el('p', 'esc-resumen-cab', r.q.enunciado));
      var est = el('p', 'esc-resumen-estado');
      est.insertAdjacentHTML('afterbegin', icono(r.acierto ? 'visto' : 'cruz'));
      est.appendChild(document.createTextNode(r.acierto
        ? 'Bien: ' + r.eleccion
        : (r.nose ? 'Dijiste que no lo sabías' : 'Falló. Escribiste: \u00AB' + r.eleccion + '\u00BB')));
      li.appendChild(est);
      if (!r.acierto) {
        var det = el('details', 'esc-detalle');
        det.appendChild(el('summary', null, 'Mira esto'));
        det.appendChild(contenidoMira(r.q, r.opcion));
        li.appendChild(det);
      }
      ol.appendChild(li);
    });
    col.appendChild(ol);

    var repasar = temasParaRepasar();
    if (repasar.length) {
      col.appendChild(el('p', 'tst-prep-sub', 'Temas que conviene repasar:'));
      var ul = el('ul', 'tst-prep-temas');
      repasar.forEach(function (x) {
        ul.appendChild(el('li', null, x.ruta + ' (' + x.n + (x.n === 1 ? ' pregunta)' : ' preguntas)')));
      });
      col.appendChild(ul);
    }
    col.appendChild(el('p', 'ayuda', 'Tus respuestas se guardaron: lo que fallaste vuelve pronto y lo que dominas se va espaciando.'));

    var acc = el('div', 'tst-acciones');
    var fallos = resultados.filter(function (r) { return !r.acierto; });
    if (fallos.length) {
      acc.appendChild(boton('Repetir solo las que fallé', 'dinamica', 'boton--principal', function () {
        var ids = fallos.map(function (r) { return r.q.id; });
        var t = test;
        Promise.all(pendientes).then(function () { empezar(t, ids); }, function () { empezar(t, ids); });
      }));
    }
    acc.appendChild(boton('Hacer otra ronda', 'dinamica', fallos.length ? '' : 'boton--principal', function () {
      var t = test;
      Promise.all(pendientes).then(function () { return Banco.resumenes([t]); }).then(function (r) {
        resumenes[t.id] = r[t.id] || resumenes[t.id];
        empezar(t, null);
      }, function () { empezar(t, null); });
    }));
    acc.appendChild(boton('Elegir otro test', 'lista', '', pantallaElegir));
    col.appendChild(acc);
    enfocar(v);
  }

  /* ==================================================== MODAL DE AJUSTES

     El del botón del panel: lo propio de este modo (cuántas preguntas, cuáles,
     qué tanto se perdonan los errores de escritura y si hay pista) y, abajo,
     los atajos a los ajustes que ya comparten todos los tests. Se arma de nuevo
     cada vez que se abre, para que refleje siempre lo guardado. */

  function grupo(dlg, legenda, ayuda) {
    var fs = document.createElement('fieldset');
    fs.appendChild(el('legend', null, legenda));
    if (ayuda) fs.appendChild(el('p', 'ayuda', ayuda));
    dlg.appendChild(fs);
    return fs;
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

  function grupoRadios(nombre, lista, elegido, alCambiar) {
    var caja = el('div', 'opciones');
    caja.setAttribute('role', 'radiogroup');
    lista.forEach(function (par) { caja.appendChild(opcionRadio(nombre, par[0], par[1], elegido, alCambiar)); });
    return caja;
  }

  function abrirAjustes() {
    if (dlgAjustes) return;
    cancelarVoz();
    var dlg = document.createElement('dialog');
    dlg.className = 'dialogo esc-config';
    dlg.setAttribute('aria-labelledby', 'esc-cfg-titulo');
    dlgAjustes = dlg;

    var titulo = el('h2', 'dialogo-titulo', 'Ajustes de Escribir');
    titulo.id = 'esc-cfg-titulo';
    dlg.appendChild(titulo);
    dlg.appendChild(el('p', 'ayuda', 'Los cambios de este modal valen desde la siguiente ronda.'));

    var gCuantas = grupo(dlg, 'Cuántas preguntas', 'Por ronda. Una ronda corta se termina; una larga se abandona.');
    gCuantas.appendChild(grupoRadios('esc-cuantas', CUANTAS.map(function (n) { return [n, n]; }),
      ajustes.cuantas, function (v) { guardarAjuste('cuantas', v); }));

    var gCuales = grupo(dlg, 'Cuáles preguntas',
      'De las del test. Solo entran las de respuesta corta (hasta ' + Logica.MAX_CARACTERES + ' caracteres): escribir una oración entera es teclear, no recordar. Para esas están las tarjetas de estudio.');
    gCuales.appendChild(grupoRadios('esc-cuales', CUALES, ajustes.cuales, function (v) { guardarAjuste('cuales', v); }));

    var gTol = grupo(dlg, 'Errores de escritura',
      'Flexible acepta una letra de más, de menos o cambiada en palabras de 5 a 9 letras (dos en las de 10 o más). Nunca acepta algo que se parezca más a una respuesta equivocada. Mayúsculas, acentos y artículos nunca cuentan.');
    gTol.appendChild(grupoRadios('esc-tolerancia', [
      ['flexible', 'Flexible: perdona una letra'],
      ['estricta', 'Estricta: exacta']
    ], ajustes.tolerancia, function (v) { guardarAjuste('tolerancia', v); }));

    var gPista = grupo(dlg, 'Pista',
      'Una ayuda debajo del campo para quien no recuerda. Los números nunca dan su primera cifra.');
    gPista.appendChild(grupoRadios('esc-pista', [
      ['off', 'Sin pista'],
      ['longitud', 'Cuántas letras tiene'],
      ['inicial', 'Cuántas letras y la primera']
    ], ajustes.pista, function (v) { guardarAjuste('pista', v); }));

    var gMas = grupo(dlg, 'Letra, voz, avance y sonido',
      'Son los mismos ajustes de todos los tests: el tamaño y la fuente de la letra, escuchar en voz alta, si la siguiente pregunta sale sola o con un botón, la racha y el sonido.');
    var filaMas = el('div', 'tst-acciones');
    filaMas.appendChild(boton('Ajustes de lectura y de sonido', 'lista', 'boton--chico', function () {
      dlg.close();
      if (Aj) Aj.abrir('general');
    }));
    filaMas.appendChild(boton('Cómo se ve la lista de tests', 'lista', 'boton--chico', function () {
      dlg.close();
      if (Aj) Aj.abrir('lista');
    }));
    gMas.appendChild(filaMas);

    var acciones = el('div', 'dialogo-acciones');
    var listo = el('button', 'boton boton--principal', 'Listo');
    listo.type = 'button';
    listo.addEventListener('click', function () { dlg.close(); });
    acciones.appendChild(listo);
    dlg.appendChild(acciones);

    dlg.addEventListener('close', function () {
      if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
      dlgAjustes = null;
    });
    document.body.appendChild(dlg);
    dlg.showModal();
    var primero = dlg.querySelector('input, button');
    if (primero) primero.focus();
  }

  /* ================================================================ ARRANQUE */

  function iniciar() {
    raiz = document.getElementById('vistas');
    estadoEl = document.getElementById('estado');
    cabEl = document.querySelector('header h1');
    cabOriginal = cabEl ? cabEl.textContent : '';
    if (!raiz || !window.RetoDialogo || !Muestra || !Lista || !Banco || !Inst || !Logica || !Datos) return;

    var listos = [cargarAjustes()];
    if (Aj) {
      listos.push(Aj.iniciar({
        resolver: false,
        alCambiar: function () {
          if (estado === 'elegir' && listaCtl) listaCtl.repintar();
        }
      }));
    }
    var cfg = document.querySelector('[data-configurar]');
    if (cfg) cfg.addEventListener('click', abrirAjustes);

    var ayuda = document.querySelector('[data-ayuda]');
    if (ayuda) {
      ayuda.addEventListener('click', function () {
        window.RetoDialogo.informar({
          titulo: 'Cómo se escribe',
          texto: 'Elige un test. Verás una pregunta sin opciones: escribe la respuesta y toca "Responder" (o Enter). No hay reloj.\n\n' +
            'No importan las mayúsculas, los acentos ni los artículos ("el lago Baikal" es "Lago Baikal"). Los números valen con coma o con punto. ' +
            'Si te falta una letra, en modo flexible se te perdona.\n\n' +
            'Si no lo sabes, toca "No lo sé": es una respuesta honesta, y te enseña qué mirar. Si fallas, tampoco se te dice cuál era: se te enseña qué mirar.\n\n' +
            'Tus respuestas se guardan, y lo que fallas vuelve pronto.\n\n' +
            'En los ajustes (la rueda) eliges cuántas preguntas, cuáles, qué tanto se perdonan los errores de escritura y si quieres una pista.'
        });
      });
    }
    Promise.all(listos).then(pantallaElegir).catch(function (e) { decir(e.message); });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
