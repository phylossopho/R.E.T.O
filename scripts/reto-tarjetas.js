/* =========================================================================
   R.E.T.O. - Tarjetas de estudio (la pantalla)

   QUÉ ES
   Tarjetas para repasar: la pregunta al frente; se piensa la respuesta, se
   voltea la tarjeta y se dice qué tan bien se sabía. Es estudiar, no
   examinarse: no hay "correcto" que el programa juzgue, juzga la persona.
   Lee los mismos tests del banco que "Resolver test" (fijas y dinámicas).

   EL RECORRIDO
     Elegir un test  →  Una tarjeta a la vez (frente, dorso, qué tal)  →  Resumen

   DECISIONES DE DISEÑO (y por qué)
   - SIN RELOJ, igual que los demás tests.
   - TRES RESPUESTAS HONESTAS, no dos: "La sabía", "Me costó" y "No la sabía".
     "Me costó" existe a propósito: acertar con dudas no demuestra que se sabe,
     y el registro de repaso lo trata distinto (no sube de caja). Obligar a
     elegir entre sabida y no sabida empuja a exagerar. Cómo se traduce a lo que
     entiende el registro está en reto-tests-instancia.js (autoevaluacion).
   - AQUÍ SÍ SE ENSEÑA LA RESPUESTA: es estudio. A diferencia de "Resolver" y
     "Escribir", donde el error no enseña la respuesta, en una tarjeta la
     respuesta está al voltearla; es la razón de ser de la tarjeta. Lo que se
     cuida es que antes de voltear no se vea nada.
   - EN LAS DINÁMICAS, el dorso trae el resultado y, debajo, la fórmula con los
     números de esa vez: cada vez que sale es con números nuevos, y la fórmula
     puesta en números es lo que se estudia.
   - SE PUEDE EMPEZAR POR LA RESPUESTA ("¿qué pregunta tiene esta respuesta?"):
     útil con definiciones. Con preguntas dinámicas siempre se empieza por la
     pregunta (un número suelto no dice nada).
   - EL VOLTEO NO ES LA ÚNICA FORMA: es un botón y también se voltea con la
     tarjeta, con Enter o con espacio. Sin movimiento (o si se apagó), la cara
     cambia de golpe, sin giro.
   - LO QUE SE ANOTA SE PUEDE APAGAR: a veces solo se quiere mirar el material
     sin que cuente en el registro de repaso.
   - LOS AJUSTES PROPIOS están en el botón del panel; el escuchar, el tamaño de
     letra y la fuente son los compartidos de todos los tests.
   ========================================================================= */
(function () {
  'use strict';

  var Muestra = window.RetoTestsMuestra;
  var icono = Muestra.icono;
  var Aj = window.RetoTestsAjustes;
  var Lista = window.RetoTestsLista;
  var Banco = window.RetoTestsBanco;
  var Inst = window.RetoTestsInstancia;
  var Datos = window.RetoDatos;

  var PREFIJO = 'tarjetas-';

  var FABRICA = {
    cuantas: '10',
    cuales: 'prioridad',
    cara: 'pregunta',      // pregunta | respuesta: por cuál se empieza
    explicar: 'on',        // mostrar la explicación al voltear
    anotar: 'on'           // anotar en el registro de repaso
  };

  var CUANTAS = ['5', '10', '15', '20', '30'];
  var CUALES = [
    ['prioridad', 'Las que más me conviene repasar'],
    ['azar', 'Al azar'],
    ['orden', 'En el orden del test']
  ];

  var AUTOS = [
    ['sabia', 'La sabía', 'visto'],
    ['costo', 'Me costó', 'info'],
    ['no', 'No la sabía', 'cruz']
  ];
  var ETIQUETA = { sabia: 'La sabía', costo: 'Me costó', no: 'No la sabía' };

  var ajustes = {};
  var tests = [];
  var resumenes = {};
  var test = null;
  var mazo = [];
  var indice = 0;
  var volteada = false;
  var resultados = [];
  var estado = 'elegir';       // elegir | tarjeta | resultado
  var estadosPrevios = {};
  var pendientes = [];
  var dlgAjustes = null;
  var listaCtl = null;

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
  function cancelarVoz() { if (Aj) Aj.callar(); }

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

  function conMovimiento() {
    if (ajustesTests().movimiento === 'off') return false;
    var anim = document.documentElement.getAttribute('data-anim');
    if (anim === 'off') return false;
    var menos = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !(menos && anim !== 'on');
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
    cancelarVoz();
    document.documentElement.setAttribute('data-tst-vista', cual === 'tarjeta' ? 'pregunta' : cual);
    limpiar(raiz);
    var sec = el('section', 'tst-vista');
    sec.id = 'v-' + cual;
    var h = el('h2', cual === 'tarjeta' ? 'oculto-a-la-vista' : null, titulo);
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

  function tarjetaTarjetas(t, ctx) {
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
    var go = el('span', 'tst-empezar', 'Estudiar');
    go.insertAdjacentHTML('beforeend', icono('flecha'));
    a.appendChild(go);
    a.setAttribute('aria-label', 'Estudiar con tarjetas el test ' + t.titulo + '. ' +
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
    v.sec.appendChild(el('p', null, 'Mira la pregunta, piensa la respuesta, voltea la tarjeta y di qué tan bien la sabías. Es para estudiar: sin reloj y sin nota.'));
    var cont = el('div');
    v.sec.appendChild(cont);
    enfocar(v);
    Banco.cargar().then(function (lista) {
      tests = lista;
      listaCtl = Lista.montar({
        contenedor: cont,
        prefijo: 'tar',
        tests: function () { return tests; },
        tarjeta: tarjetaTarjetas,
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

  /* ======================================================== ARMAR EL MAZO */

  function empezar(t, ids) {
    var porIdP = {};
    t.preguntas.forEach(function (p) { porIdP[p.id] = p; });
    var jugables = t.preguntas.filter(function (p) {
      return Banco.jugable(p) && (!ids || ids.indexOf(p.id) >= 0);
    });
    if (jugables.length < 1) { decir('Este test no tiene preguntas para estudiar.'); return; }
    var cuantas = ids ? Math.min(30, ids.length) : Number(ajustes.cuantas);
    Promise.all([
      Banco.ronda(t, ids, Math.min(jugables.length, cuantas), ids ? 'azar' : ajustes.cuales).catch(function () { return null; }),
      Banco.estados(t.id).catch(function () { return {}; })
    ]).then(function (g) {
      var r = g[0];
      var cands = r && r.preguntas
        ? r.preguntas.map(function (it) { return porIdP[it.id]; }).filter(Boolean)
        : Inst.barajar(jugables);
      if (cands.length < 1) cands = Inst.barajar(jugables);
      var armado = Inst.armarMazo(cands, cuantas, { evaluador: window.RetoTestsEval });
      if (!armado.length) { decir('No se pudo armar el mazo con las preguntas de este test.'); return; }
      test = t;
      mazo = armado;
      indice = 0;
      volteada = false;
      resultados = [];
      estadosPrevios = g[1] || {};
      pendientes = [];
      titularCabecera('Estudiando el test ', t.titulo);
      pantallaTarjeta();
    }).catch(function (e) { decir(e.message); });
  }

  /* =========================================================== LA TARJETA */

  /* Por cuál cara se empieza: con una dinámica, siempre por la pregunta. */
  function carasDe(q) {
    var ok = Inst.respuestaOk(q).texto;
    if (ajustes.cara === 'respuesta' && q.tipo === 'estatica') {
      return { frente: { rotulo: 'Respuesta', texto: ok }, dorso: { rotulo: 'Pregunta', texto: q.enunciado }, invertida: true };
    }
    return { frente: { rotulo: 'Pregunta', texto: q.enunciado }, dorso: { rotulo: 'Respuesta', texto: ok }, invertida: false };
  }

  function textoParaOir(q, mostrandoDorso) {
    var c = carasDe(q);
    var cara = mostrandoDorso ? c.dorso : c.frente;
    return cara.rotulo + ': ' + cara.texto;
  }

  function pintarCara(tarjeta, q) {
    var c = carasDe(q);
    var cara = volteada ? c.dorso : c.frente;
    limpiar(tarjeta);
    tarjeta.setAttribute('data-cara', volteada ? 'dorso' : 'frente');

    tarjeta.appendChild(el('p', 'tar-rotulo', cara.rotulo));
    tarjeta.appendChild(el('p', 'tar-texto', cara.texto));

    if (volteada && ajustes.explicar !== 'off') {
      var extra = el('div', 'tar-extra');
      if (q.tipo === 'dinamica' && q.explicacion) {
        extra.appendChild(el('p', 'tar-extra-titulo', 'Cómo se calcula'));
        extra.appendChild(Muestra.explicacion(q.explicacion));
      } else if (q.contexto) {
        extra.appendChild(el('p', 'tar-extra-titulo', 'Para recordarlo'));
        parrafos(extra, q.contexto);
      }
      if (extra.firstChild) tarjeta.appendChild(extra);
    }
  }

  function pantallaTarjeta() {
    var q = mazo[indice];
    volteada = false;
    var v = mostrar('tarjeta', 'Tarjeta ' + (indice + 1));
    decir('');
    var a = ajustesTests();

    var cuerpo = el('div', 'tst-pregunta');
    v.sec.appendChild(cuerpo);

    var lateral = el('div', 'tst-lateral');
    if (a.avance !== 'off') {
      var av = el('div', 'tst-avance');
      av.appendChild(el('p', null, 'Tarjeta ' + (indice + 1) + ' de ' + mazo.length));
      var barra = el('div', 'tst-barra-avance');
      barra.setAttribute('aria-hidden', 'true');
      var rel = el('div', 'tst-barra-relleno');
      rel.style.width = Math.round((indice / mazo.length) * 100) + '%';
      barra.appendChild(rel);
      av.appendChild(barra);
      lateral.appendChild(av);
    }
    cuerpo.appendChild(lateral);

    var col = el('div', 'tst-columna tst-columna--pregunta tar-columna');
    cuerpo.appendChild(col);

    /* LA TARJETA es un botón: tocarla, Enter o espacio la voltea. Después de
       voltear no hace nada más (para no devolverla sin querer; hay un botón). */
    var fila = el('div', 'tar-fila');
    var tarjeta = el('button', 'tar-tarjeta');
    tarjeta.type = 'button';
    tarjeta.id = 'tar-tarjeta';
    fila.appendChild(tarjeta);
    if (a.escuchar !== 'off') {
      var esc = el('button', 'boton tst-escuchar-icono');
      esc.type = 'button';
      esc.setAttribute('aria-label', 'Escuchar esta cara de la tarjeta');
      esc.title = 'Escuchar esta cara de la tarjeta';
      esc.insertAdjacentHTML('afterbegin', icono('sonido'));
      esc.addEventListener('click', function () {
        if (!Aj.hablar(textoParaOir(q, volteada))) decir('Este aparato no tiene voz para leer en voz alta.');
      });
      fila.appendChild(esc);
    }
    col.appendChild(fila);

    var zona = el('div', 'tar-zona');
    zona.id = 'tar-zona';
    col.appendChild(zona);

    pintarCara(tarjeta, q);
    pintarZona(q);
    tarjeta.addEventListener('click', function () { if (!volteada) voltear(q); });

    enfocar(v);
    tarjeta.focus();
    if (a.leerSola === 'on') Aj.hablar(textoParaOir(q, false));
  }

  /* Debajo de la tarjeta: antes de voltear, el botón de voltear; después, las
     tres maneras de decir qué tal. */
  function pintarZona(q) {
    var zona = document.getElementById('tar-zona');
    limpiar(zona);
    if (!volteada) {
      var b = boton('Voltear la tarjeta', 'flecha', 'boton--principal', function () { voltear(q); });
      b.id = 'tar-voltear';
      zona.appendChild(b);
      zona.appendChild(el('p', 'ayuda', 'Piensa primero la respuesta. Cuando la tengas, voltea.'));
      return;
    }
    zona.appendChild(el('p', 'tar-pregunta-auto', '¿Qué tal la sabías?'));
    var fila = el('div', 'tar-autos');
    fila.setAttribute('role', 'group');
    fila.setAttribute('aria-label', '¿Qué tal la sabías?');
    AUTOS.forEach(function (par, i) {
      var b = el('button', 'boton tar-auto');
      b.type = 'button';
      b.setAttribute('data-auto', par[0]);
      b.insertAdjacentHTML('afterbegin', icono(par[2]));
      b.appendChild(document.createTextNode(par[1]));
      b.appendChild(el('span', 'tar-atajo', String(i + 1)));
      b.setAttribute('aria-label', par[1] + ' (tecla ' + (i + 1) + ')');
      b.addEventListener('click', function () { calificar(par[0]); });
      fila.appendChild(b);
    });
    zona.appendChild(fila);
  }

  function voltear(q) {
    if (volteada || estado !== 'tarjeta') return;
    volteada = true;
    var tarjeta = document.getElementById('tar-tarjeta');
    if (conMovimiento()) {
      tarjeta.removeAttribute('data-gira');
      void tarjeta.offsetWidth;
      tarjeta.setAttribute('data-gira', '1');
    }
    pintarCara(tarjeta, q);
    pintarZona(q);
    var primero = document.querySelector('.tar-auto');
    if (primero) primero.focus();
    decir('Tarjeta volteada. ' + carasDe(q).dorso.rotulo + ': ' + carasDe(q).dorso.texto);
    if (ajustesTests().leerSola === 'on') Aj.hablar(textoParaOir(q, true));
  }

  /* Las teclas 1, 2 y 3 dicen qué tal, y Espacio o Enter voltean desde
     cualquier parte (con el foco en la tarjeta ya lo hace el botón). */
  function enTeclado(ev) {
    if (estado !== 'tarjeta' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (!volteada) return;
    var n = parseInt(ev.key, 10);
    if (n >= 1 && n <= AUTOS.length) {
      ev.preventDefault();
      calificar(AUTOS[n - 1][0]);
    }
  }

  function calificar(clave) {
    if (!volteada || estado !== 'tarjeta') return;
    var q = mazo[indice];
    var auto = Inst.autoevaluacion(clave);
    if (!auto) return;
    resultados.push({ q: q, auto: clave, acierto: auto.acierto, clase: auto.clase });
    if (ajustes.anotar !== 'off') anotar(q, auto);
    if (indice + 1 < mazo.length) { indice++; pantallaTarjeta(); }
    else pantallaResultado();
  }

  function anotar(q, auto) {
    var id = test.id;
    pendientes.push(Banco.registrarIntento(id, {
      ts: Date.now(), qid: q.id, acierto: auto.acierto, seguridad: auto.seguridad,
      clase: auto.clase, eleccion: ''
    }).catch(function () {}));
    pendientes.push(Banco.registrarRespuesta(id, q.id, estadosPrevios[q.id], auto.acierto, auto.seguridad).catch(function (e) {
      decir('No se pudo anotar una tarjeta: ' + e.message);
    }));
  }

  /* ============================================================ EL FINAL */

  function temasParaRepasar() {
    var cuenta = {};
    var orden = [];
    resultados.filter(function (r) { return r.auto !== 'sabia'; }).forEach(function (r) {
      var k = Lista.rutaDeTema(r.q.tema).join(', ');
      if (!k) return;
      if (!cuenta[k]) { cuenta[k] = 0; orden.push(k); }
      cuenta[k]++;
    });
    return orden.map(function (k) { return { ruta: k, n: cuenta[k] }; });
  }

  function pantallaResultado() {
    var v = mostrar('resultado', 'Terminaste el mazo');
    titularCabecera('Resumen de tarjetas ', test.titulo);
    if (ajustes.anotar !== 'off') Datos.poner('tests-hecho-' + test.id, Date.now());
    decir('');
    var cuenta = { sabia: 0, costo: 0, no: 0 };
    resultados.forEach(function (r) { cuenta[r.auto]++; });
    var total = resultados.length;

    var col = el('div', 'tst-columna tar-resultado');
    v.sec.appendChild(col);
    col.appendChild(el('p', 'tst-enunciado', 'Repasaste ' + total + (total === 1 ? ' tarjeta.' : ' tarjetas.')));

    var ul = el('ul', 'tar-cuenta');
    AUTOS.forEach(function (par) {
      var li = el('li', 'tar-cuenta-fila');
      li.setAttribute('data-auto', par[0]);
      li.insertAdjacentHTML('afterbegin', icono(par[2]));
      li.appendChild(el('strong', null, String(cuenta[par[0]])));
      li.appendChild(document.createTextNode(' ' + par[1].toLowerCase()));
      ul.appendChild(li);
    });
    col.appendChild(ul);

    col.appendChild(el('p', null, cuenta.sabia === total
      ? 'Las sabías todas. Para fijarlas, vuelve a verlas otro día: lo que se espacia se queda.'
      : 'Las que te costaron o no sabías son las que más conviene volver a ver.'));

    var pend = resultados.filter(function (r) { return r.auto !== 'sabia'; });
    if (pend.length) {
      col.appendChild(el('p', 'tst-prep-sub', 'Para volver a ver:'));
      var lista = el('ol', 'tar-repasar');
      pend.forEach(function (r) {
        var c = carasDe(r.q);
        var li = el('li', 'tar-repasar-fila');
        li.setAttribute('data-auto', r.auto);
        li.appendChild(el('p', 'tar-repasar-p', c.frente.texto));
        var d = el('p', 'tar-repasar-r');
        d.appendChild(el('strong', null, c.dorso.rotulo + ': '));
        d.appendChild(document.createTextNode(c.dorso.texto));
        li.appendChild(d);
        li.appendChild(el('p', 'tar-repasar-e', ETIQUETA[r.auto]));
        lista.appendChild(li);
      });
      col.appendChild(lista);
    }

    var repasar = temasParaRepasar();
    if (repasar.length) {
      col.appendChild(el('p', 'tst-prep-sub', 'Temas que conviene repasar:'));
      var ult = el('ul', 'tst-prep-temas');
      repasar.forEach(function (x) {
        ult.appendChild(el('li', null, x.ruta + ' (' + x.n + (x.n === 1 ? ' tarjeta)' : ' tarjetas)')));
      });
      col.appendChild(ult);
    }
    col.appendChild(el('p', 'ayuda', ajustes.anotar !== 'off'
      ? 'Se guardó lo que dijiste: lo que te costó o no sabías vuelve pronto, y lo que sabías se va espaciando.'
      : 'Esta ronda no se anotó en tu registro de repaso (lo elegiste en los ajustes).'));

    var acc = el('div', 'tst-acciones');
    if (pend.length) {
      acc.appendChild(boton('Repetir las que me costaron o no sabía', 'dinamica', 'boton--principal', function () {
        var ids = pend.map(function (r) { return r.q.id; });
        var t = test;
        Promise.all(pendientes).then(function () { empezar(t, ids); }, function () { empezar(t, ids); });
      }));
    }
    acc.appendChild(boton('Otro mazo', 'dinamica', pend.length ? '' : 'boton--principal', function () {
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

  /* ==================================================== MODAL DE AJUSTES */

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

  function interruptor(clave, texto, explicacion) {
    var label = el('label', 'interruptor');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = ajustes[clave] === 'on';
    var caja = el('span', 'interruptor-caja');
    caja.setAttribute('aria-hidden', 'true');
    var rotulo = el('span', 'interruptor-texto', texto);
    rotulo.appendChild(el('span', 'ayuda', explicacion));
    input.addEventListener('change', function () { guardarAjuste(clave, this.checked ? 'on' : 'off'); });
    label.appendChild(input);
    label.appendChild(caja);
    label.appendChild(rotulo);
    return label;
  }

  function abrirAjustes() {
    if (dlgAjustes) return;
    cancelarVoz();
    var dlg = document.createElement('dialog');
    dlg.className = 'dialogo tar-config';
    dlg.setAttribute('aria-labelledby', 'tar-cfg-titulo');
    dlgAjustes = dlg;

    var titulo = el('h2', 'dialogo-titulo', 'Ajustes de Tarjetas de estudio');
    titulo.id = 'tar-cfg-titulo';
    dlg.appendChild(titulo);
    dlg.appendChild(el('p', 'ayuda', 'Los cambios de este modal valen desde el siguiente mazo.'));

    var gCuantas = grupo(dlg, 'Cuántas tarjetas', 'Por mazo.');
    gCuantas.appendChild(grupoRadios('tar-cuantas', CUANTAS.map(function (n) { return [n, n]; }),
      ajustes.cuantas, function (v) { guardarAjuste('cuantas', v); }));

    var gCuales = grupo(dlg, 'Cuáles preguntas', 'De las del test.');
    gCuales.appendChild(grupoRadios('tar-cuales', CUALES, ajustes.cuales, function (v) { guardarAjuste('cuales', v); }));

    var gCara = grupo(dlg, 'Por dónde empezar',
      'Con la pregunta al frente, piensas la respuesta. Con la respuesta al frente, piensas qué pregunta tiene: sirve con definiciones. Las preguntas con números que cambian siempre empiezan por la pregunta.');
    gCara.appendChild(grupoRadios('tar-cara', [
      ['pregunta', 'La pregunta'],
      ['respuesta', 'La respuesta']
    ], ajustes.cara, function (v) { guardarAjuste('cara', v); }));

    var gDorso = grupo(dlg, 'Al voltear');
    gDorso.appendChild(interruptor('explicar', 'Mostrar la explicación',
      'Junto a la respuesta, el contexto de la pregunta y, en las de números, la fórmula con los números de esa vez.'));

    var gAnotar = grupo(dlg, 'Registro de repaso');
    gAnotar.appendChild(interruptor('anotar', 'Anotar lo que digo',
      'Lo que te costó o no sabías vuelve pronto en "Resolver", "Escribir" y "Asociar". Apagado, solo miras el material y no cuenta.'));

    var gMas = grupo(dlg, 'Letra, voz y sonido',
      'Son los mismos ajustes de todos los tests: el tamaño y la fuente de la letra y escuchar en voz alta.');
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
    if (!raiz || !window.RetoDialogo || !Muestra || !Lista || !Banco || !Inst || !Datos) return;

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
    document.addEventListener('keydown', enTeclado);

    var ayuda = document.querySelector('[data-ayuda]');
    if (ayuda) {
      ayuda.addEventListener('click', function () {
        window.RetoDialogo.informar({
          titulo: 'Cómo se estudia con tarjetas',
          texto: 'Elige un test. Verás una tarjeta con una pregunta: piensa la respuesta y voltea la tarjeta (tócala, o usa el botón).\n\n' +
            'Luego di qué tal la sabías: "La sabía", "Me costó" o "No la sabía". Con las teclas 1, 2 y 3 también. ' +
            'Sé honesto: "Me costó" existe para eso. Lo que te cuesta vuelve pronto; lo que sabes se va espaciando.\n\n' +
            'No hay reloj ni nota: es para estudiar.\n\n' +
            'En los ajustes (la rueda) eliges cuántas tarjetas, por cuál cara empezar, si ves la explicación al voltear y si se anota en tu registro.'
        });
      });
    }
    Promise.all(listos).then(pantallaElegir).catch(function (e) { decir(e.message); });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
