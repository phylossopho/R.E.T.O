/* =========================================================================
   R.E.T.O. - La lista de tests (la comparten "Resolver test" y el banco)

   Las dos pantallas muestran los mismos tests, y la persona espera que se
   vean igual y se ordenen igual en las dos. Por eso esto es UNO, y lo que cada
   pantalla pone es solo lo propio: qué lleva cada tarjeta (en "Resolver" es un
   enlace que empieza el test; en el banco, botones para editar, duplicar y
   borrar).

   LO QUE HACE
   - La barra de búsqueda: un texto y la materia (en el banco, también el tipo).
   - Ver por: "categorías" (agrupados por materia, el valor de fábrica), "fecha
     de modificación" o "último test realizado" (planos, del más reciente al más
     viejo; los que nunca se hicieron, al final).
   - Mostrar en tarjetas o en lista, y el tamaño de las tarjetas.
   - Contar cuántos se ven, para quien usa lector de pantalla.

   LAS TARJETAS SON LAS DE LA PLATAFORMA (.rejilla > li > .tarjeta): con ellas
   vienen solas la entrada animada, el zoom al pasar el mouse y el apagado con
   el interruptor de animaciones. Aquí NO se escribe ninguna animación: así,
   cuando se pueda variar la animación de las tarjetas desde Configuración,
   estas cambian con las demás.

   "ÚLTIMO TEST REALIZADO" es un dato de verdad (RetoDatos, "tests-hecho-<id>"),
   no de la muestra: lo escribe "Resolver" al terminar un test.
   ========================================================================= */
(function () {
  'use strict';

  var Muestra = window.RetoTestsMuestra;
  var icono = Muestra.icono;

  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var NOMBRE_TIPO = { estatica: 'Fijas', dinamica: 'Números que cambian', mixto: 'Mezcla' };

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function limpiar(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function tipoDeTest(t) {
    var din = t.preguntas.filter(function (p) { return p.tipo === 'dinamica'; }).length;
    if (din === 0) return 'estatica';
    if (din === t.preguntas.length) return 'dinamica';
    return 'mixto';
  }

  function etiquetaTipo(tipo) {
    var s = el('span', 'tst-tipo');
    s.setAttribute('data-tipo', tipo);
    s.insertAdjacentHTML('afterbegin', icono(tipo));
    s.appendChild(document.createTextNode(NOMBRE_TIPO[tipo]));
    return s;
  }

  /* LA RUTA DE UN TEMA: los niveles 2, 3 y 4 que existan, en orden. El nivel 1 es
     el titulo del test y no se repite ("Matemáticas" en un test de matematicas
     seria redundante); si falta un nivel, no se concatena: {n2:'Bloque I',
     n4:'Las fracciones'} da ['Bloque I', 'Las fracciones'], sin huecos. */
  function rutaDeTema(tema) {
    var salida = [];
    ['n2', 'n3', 'n4'].forEach(function (k) {
      var v = tema && typeof tema[k] === 'string' ? tema[k].trim() : '';
      if (v) salida.push(v);
    });
    return salida;
  }

  function fechaCorta(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return '';
    return Number(p[2]) + ' ' + MESES[Number(p[1]) - 1];
  }

  /* "Hecho hoy", "hace 3 días", "aún no lo has hecho": dicho como se diría en voz
     alta, sin fechas exactas que obliguen a calcular. */
  function hace(ts) {
    if (!ts) return 'Aún no lo has hecho';
    var dias = Math.floor((Date.now() - ts) / 86400000);
    if (dias <= 0) return 'Hecho hoy';
    if (dias === 1) return 'Hecho ayer';
    return 'Hecho hace ' + dias + ' días';
  }

  /* Los datos de "último realizado": una promesa con { idTest: marcaDeTiempo }. */
  function cargarHechos(tests) {
    var mapa = {};
    return Promise.all(tests.map(function (t) {
      return window.RetoDatos.obtener('tests-hecho-' + t.id).then(function (v) {
        if (v) mapa[t.id] = Number(v);
      });
    })).then(function () { return mapa; });
  }

  function ordenar(lista, ver, hechos) {
    var salida = lista.slice();
    if (ver === 'modificacion') {
      salida.sort(function (a, b) { return String(b.modificado || '').localeCompare(String(a.modificado || '')); });
    } else if (ver === 'ultimo') {
      salida.sort(function (a, b) { return (hechos[b.id] || 0) - (hechos[a.id] || 0); });
    } else {
      salida.sort(function (a, b) { return a.titulo.localeCompare(b.titulo, 'es'); });
    }
    return salida;
  }

  function filtrar(lista, filtro) {
    var q = (filtro.texto || '').trim().toLowerCase();
    return lista.filter(function (t) {
      if (filtro.materia && t.materia !== filtro.materia) return false;
      if (filtro.tipo && tipoDeTest(t) !== filtro.tipo) return false;
      if (!q) return true;
      return (t.titulo + ' ' + t.materia + ' ' + (t.descripcion || '')).toLowerCase().indexOf(q) >= 0;
    });
  }

  /* `opciones`:
       contenedor   dónde se monta (se vacía)
       tests()      los tests de ahora
       tarjeta(t, ctx)  devuelve la tarjeta (un <a> o un <article>) de un test;
                    ctx = { hecho, hace, modificado, plano, vista }
       conTipo      si la barra incluye "Tipo de preguntas" (el banco)
       prefijo      para que los ids de la barra no se repitan entre pantallas
       vacio        qué decir cuando no hay ni un test (un texto, o una función que
                    devuelve un elemento, para poder poner un botón)
       resumenes()  (opcional) { idTest: { por_repasar, nuevas, … } } para que cada
                    tarjeta diga cuántas preguntas toca repasar
     Devuelve { repintar() }. */
  function montar(opciones) {
    var cont = opciones.contenedor;
    var pre = opciones.prefijo || 'lt';
    var filtro = { texto: '', materia: '', tipo: '' };
    var hechos = {};
    var primera = true;
    limpiar(cont);

    var barra = el('div', 'tst-barra');
    function campo(id, etiqueta, control) {
      var c = el('div', 'tst-campo');
      var l = el('label', null, etiqueta);
      l.setAttribute('for', id);
      c.appendChild(l);
      c.appendChild(control);
      barra.appendChild(c);
    }
    var buscar = document.createElement('input');
    buscar.className = 'editor-campo';
    buscar.id = pre + '-buscar';
    buscar.type = 'search';
    buscar.autocomplete = 'off';
    buscar.addEventListener('input', function () { filtro.texto = this.value; repintar(); });
    campo(buscar.id, 'Buscar un test', buscar);

    var selM = document.createElement('select');
    selM.className = 'editor-campo';
    selM.id = pre + '-materia';
    selM.addEventListener('change', function () { filtro.materia = this.value; repintar(); });
    campo(selM.id, 'Materia', selM);

    if (opciones.conTipo) {
      var selT = document.createElement('select');
      selT.className = 'editor-campo';
      selT.id = pre + '-tipo';
      [['', 'Todos'], ['estatica', NOMBRE_TIPO.estatica], ['dinamica', NOMBRE_TIPO.dinamica], ['mixto', NOMBRE_TIPO.mixto]]
        .forEach(function (o) { var op = el('option', '', o[1]); op.value = o[0]; selT.appendChild(op); });
      selT.addEventListener('change', function () { filtro.tipo = this.value; repintar(); });
      campo(selT.id, 'Tipo de preguntas', selT);
    }
    cont.appendChild(barra);

    var cuenta = el('p', 'ayuda');
    cuenta.setAttribute('aria-live', 'polite');
    cont.appendChild(cuenta);
    var zona = el('div', 'tst-zona-lista');
    cont.appendChild(zona);

    function llenarMaterias(todos) {
      var vistas = {};
      todos.forEach(function (t) { if (t.materia) vistas[t.materia] = true; });
      var nombres = Object.keys(vistas).sort(function (a, b) { return a.localeCompare(b, 'es'); });
      var actual = filtro.materia;
      limpiar(selM);
      var todas = el('option', '', 'Todas'); todas.value = ''; selM.appendChild(todas);
      nombres.forEach(function (m) { var o = el('option', '', m); o.value = m; selM.appendChild(o); });
      if (nombres.indexOf(actual) < 0) { filtro.materia = ''; actual = ''; }
      selM.value = actual;
    }

    function crearLista(lista, ajustes, plano) {
      var ul = el('ul', 'rejilla tst-rejilla' + (primera ? '' : ' tst-sin-entrada'));
      ul.setAttribute('data-vista', ajustes.vista || 'tarjetas');
      ul.setAttribute('data-tarjeta', ajustes.tarjeta || 'pequena');
      lista.forEach(function (t) {
        var li = el('li');
        li.appendChild(opciones.tarjeta(t, {
          hecho: hechos[t.id] || 0,
          hace: hace(hechos[t.id]),
          resumen: opciones.resumenes ? (opciones.resumenes()[t.id] || null) : null,
          modificado: fechaCorta(t.modificado),
          plano: plano,
          vista: ajustes.vista || 'tarjetas'
        }));
        ul.appendChild(li);
      });
      return ul;
    }

    function repintar() {
      var ajustes = window.RetoTestsAjustes ? window.RetoTestsAjustes.valores() : {};
      var todos = opciones.tests();
      llenarMaterias(todos);
      var vistos = ordenar(filtrar(todos, filtro), ajustes.ver || 'categorias', hechos);
      limpiar(zona);
      cuenta.textContent = vistos.length === todos.length
        ? (todos.length === 1 ? 'Tienes 1 test.' : 'Tienes ' + todos.length + ' tests.')
        : 'Se ven ' + vistos.length + ' de ' + todos.length + ' tests.';

      if (!vistos.length) {
        var vacio = el('div', 'tst-vacio');
        if (todos.length) {
          vacio.appendChild(el('p', null, 'Ningún test coincide con lo que buscas.'));
        } else if (typeof opciones.vacio === 'function') {
          vacio.appendChild(opciones.vacio());
        } else {
          vacio.appendChild(el('p', null, opciones.vacio || 'Todavía no hay tests.'));
        }
        zona.appendChild(vacio);
        primera = false;
        return;
      }

      if ((ajustes.ver || 'categorias') === 'categorias') {
        var grupos = {};
        var orden = [];
        vistos.forEach(function (t) {
          var m = t.materia || 'Sin materia';
          if (!grupos[m]) { grupos[m] = []; orden.push(m); }
          grupos[m].push(t);
        });
        orden.sort(function (a, b) { return a.localeCompare(b, 'es'); });
        orden.forEach(function (m, i) {
          var sec = el('section', 'tst-grupo');
          var h = el('h3', 'tst-grupo-titulo');
          h.id = pre + '-grupo-' + i;
          h.appendChild(document.createTextNode(m + ' '));
          h.appendChild(el('span', 'tst-grupo-cuenta', '(' + grupos[m].length + ')'));
          sec.setAttribute('aria-labelledby', h.id);
          sec.appendChild(h);
          sec.appendChild(crearLista(grupos[m], ajustes, false));
          zona.appendChild(sec);
        });
      } else {
        zona.appendChild(crearLista(vistos, ajustes, true));
      }
      primera = false;
    }

    cargarHechos(opciones.tests()).then(function (m) { hechos = m; repintar(); });
    repintar();
    return { repintar: repintar, recargarHechos: function () {
      return cargarHechos(opciones.tests()).then(function (m) { hechos = m; repintar(); });
    } };
  }

  window.RetoTestsLista = {
    montar: montar,
    tipoDeTest: tipoDeTest,
    etiquetaTipo: etiquetaTipo,
    hace: hace,
    rutaDeTema: rutaDeTema,
    fechaCorta: fechaCorta
  };
})();
