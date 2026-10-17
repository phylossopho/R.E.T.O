/* =========================================================================
   R.E.T.O. - Gestionar banco de tests (LA INTERFAZ, todavía sin motor)

   QUÉ ES ESTO
   La pantalla donde se crean, se editan, se duplican y se borran los tests.
   Hay dos clases de pregunta, y la diferencia es lo que más pesa en el diseño:

   - FIJA ("estática"): las respuestas están escritas y no cambian. Es la fácil.
   - CON NÚMEROS QUE CAMBIAN ("dinámica"): el enunciado lleva {variables} y el
     resultado sale de una fórmula. Cada vez que sale la pregunta, la
     aplicación elige valores al azar dentro de los rangos que la persona
     puso, calcula el resultado, y arma las respuestas incorrectas con otras
     fórmulas ("distractores"). Por eso el editor pide cosas que una pregunta
     fija no tiene: variables con su mínimo y máximo, la fórmula, y por cada
     distractor QUÉ ERROR REPRESENTA y DÓNDE SE VA EL VALOR (PROPUESTA 4.3 y
     4.4: separar el error de concepto de la falla de cálculo).

   ES UNA MAQUETA, Y LO DICE
   Los cambios se hacen sobre una copia en memoria y se pierden al recargar.
   Nada se guarda en IndexedDB y nada se calcula: la "vista previa" de una
   pregunta con números que cambian sustituye las variables por un valor de
   ejemplo y enseña las FÓRMULAS, pero no las evalúa. Evaluarlas es trabajo del
   motor de Python, que todavía no existe. Ver reto-tests-muestra.js.

   DECISIONES DE DISEÑO (y por qué)
   - UNA SOLA ACCIÓN PRINCIPAL POR PANTALLA (PROPUESTA 5.2). El banco ofrece
     "Crear un test nuevo"; el test ofrece "Guardar test"; la pregunta ofrece
     "Guardar pregunta". Lo demás es secundario y se ve como tal.
   - NADA SE HACE SOLO ARRASTRANDO (WCAG 2.5.7): se ordenan las preguntas con
     "Subir" y "Bajar".
   - NINGÚN CAMPO DEPENDE DE UN PLACEHOLDER: cada uno lleva su etiqueta visible
     y, debajo, una ayuda en palabras sencillas.
   - LOS ERRORES SE DICEN CON PALABRAS, NO CON ROJO: un resumen arriba con
     enlaces a cada campo, y en cada campo un icono y la frase. Se avisa al
     guardar, no mientras se escribe: no se regaña a quien todavía está
     escribiendo.
   - LOS BOTONES QUE NO SE PUEDEN USAR (subir la primera pregunta) llevan
     aria-disabled y no "disabled": así no se pierde el foco al moverla.
   - SE PREGUNTA ANTES DE BORRAR, y se pregunta también antes de salir de algo
     con cambios sin guardar.
   ========================================================================= */
(function () {
  'use strict';

  var Muestra = window.RetoTestsMuestra;
  var icono = Muestra.icono;
  var Lista = window.RetoTestsLista;
  var Imp = window.RetoTestsImportar;
  var Banco = window.RetoTestsBanco;

  var FUNCIONES = ['floor', 'ceil', 'round', 'abs', 'min', 'max', 'sqrt'];
  var LETRAS_OPCION = ['a', 'b', 'c', 'd', 'e', 'f'];

  var MAX_OPCIONES = 6;
  var MIN_OPCIONES = 2;
  var MAX_VARIABLES = 5;
  var MAX_DISTRACTORES = 6;

  var CLASES = [
    { id: 'concepto', nombre: 'De concepto: eligió otra fórmula u otra idea' },
    { id: 'calculo', nombre: 'De cálculo: la fórmula estaba bien y el valor se fue en la cuenta' }
  ];

  /* ------------------------------------------------------------- estado */
  var tests = [];              // el banco, cargado de IndexedDB (reto-tests-banco.js)
  var vista = 'banco';
  var borrador = null;        // el test que se está editando (copia)
  var nuevo = false;          // si el test es nuevo o ya existía
  var pBorrador = null;       // la pregunta que se está editando (copia)
  var pIndice = -1;           // su lugar en el test; -1 si es nueva
  var sucio = false;          // si hay algo sin guardar en la pantalla de ahora
  var testSucio = false;      // lo mismo, pero del test, mientras se edita una pregunta
  var contador = 0;
  var listaCtl = null;        // la lista de tests (módulo compartido)

  var raiz, rutaEl, estadoEl;

  /* ------------------------------------------------------------ utilidades */
  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function limpiar(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function nuevoId(prefijo) {
    contador++;
    return prefijo + '-' + Date.now().toString(36) + contador;
  }

  function copia(x) { return JSON.parse(JSON.stringify(x)); }

  function decir(texto) { estadoEl.textContent = texto || ''; }

  function conIcono(id, texto, clase) {
    var s = el('span', clase || 'tst-con-icono');
    s.insertAdjacentHTML('afterbegin', icono(id));
    s.appendChild(document.createTextNode(texto));
    return s;
  }

  function boton(texto, iconoId, clase, alClick) {
    var b = el('button', 'boton ' + (clase || ''));
    b.type = 'button';
    if (iconoId) b.insertAdjacentHTML('afterbegin', icono(iconoId));
    b.appendChild(document.createTextNode(texto));
    if (alClick) b.addEventListener('click', alClick);
    return b;
  }

  function tipoDeTest(t) {
    var din = t.preguntas.filter(function (p) { return p.tipo === 'dinamica'; }).length;
    if (din === 0) return 'estatica';
    if (din === t.preguntas.length) return 'dinamica';
    return 'mixto';
  }

  var NOMBRE_TIPO = { estatica: 'Fijas', dinamica: 'Números que cambian', mixto: 'Mezcla' };

  function etiquetaTipo(tipo) {
    var s = el('span', 'tst-tipo');
    s.setAttribute('data-tipo', tipo);
    s.insertAdjacentHTML('afterbegin', icono(tipo));
    s.appendChild(document.createTextNode(NOMBRE_TIPO[tipo]));
    return s;
  }

  function resumirTexto(t, n) {
    t = (t || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  }

  /* Un campo con etiqueta visible, ayuda y lugar para el error. `control` ya
     trae su id; aquí se le conecta la ayuda y el error. */
  function campo(id, etiqueta, ayuda, control) {
    var c = el('div', 'tst-campo');
    var l = el('label', null, etiqueta);
    l.setAttribute('for', id);
    c.appendChild(l);
    var describe = [];
    if (ayuda) {
      var a = el('span', 'ayuda', ayuda);
      a.id = id + '-ayuda';
      c.appendChild(a);
      describe.push(a.id);
    }
    c.appendChild(control);
    var e = el('p', 'tst-error');
    e.id = id + '-error';
    e.hidden = true;
    c.appendChild(e);
    describe.push(e.id);
    control.setAttribute('aria-describedby', describe.join(' '));
    return c;
  }

  function entrada(id, tipo, valor, extra) {
    var i = document.createElement('input');
    i.className = 'editor-campo';
    i.id = id;
    i.type = tipo || 'text';
    i.value = (valor === undefined || valor === null) ? '' : valor;
    if (extra) Object.keys(extra).forEach(function (k) { i.setAttribute(k, extra[k]); });
    i.addEventListener('input', function () { sucio = true; });
    return i;
  }

  function areaTexto(id, valor, filas) {
    var t = document.createElement('textarea');
    t.className = 'editor-campo';
    t.id = id;
    t.rows = filas || 4;
    t.value = valor || '';
    t.addEventListener('input', function () { sucio = true; });
    return t;
  }

  function seleccion(id, lista, valor) {
    var s = document.createElement('select');
    s.className = 'editor-campo';
    s.id = id;
    lista.forEach(function (o) {
      var op = el('option', '', o.nombre);
      op.value = o.id;
      if (String(o.id) === String(valor)) op.selected = true;
      s.appendChild(op);
    });
    s.addEventListener('change', function () { sucio = true; });
    return s;
  }

  function porId(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------- las vistas */

  function mostrar(cual, titulo) {
    vista = cual;
    limpiar(raiz.vistas);
    var sec = el('section', 'tst-vista');
    sec.id = 'v-' + cual;
    var h = el('h2', null, titulo);
    h.tabIndex = -1;
    sec.appendChild(h);
    raiz.vistas.appendChild(sec);
    return { sec: sec, h: h };
  }

  function enfocarTitulo(v) {
    v.h.focus();
    window.scrollTo(0, 0);
  }

  function pintarRuta() {
    limpiar(rutaEl);
    function item(texto, alClick, actual) {
      var li = el('li');
      if (actual) {
        var s = el('strong', null, texto);
        s.setAttribute('aria-current', 'page');
        li.appendChild(s);
      } else {
        li.appendChild(boton(texto, null, 'boton--chico', alClick));
      }
      rutaEl.appendChild(li);
    }
    item('Banco de tests', irAlBanco, vista === 'banco');
    if (vista === 'importar') item('Importar tests', null, true);
    if (vista === 'test' || vista === 'pregunta') {
      var nombre = (borrador && borrador.titulo.trim()) || 'Test nuevo';
      item(resumirTexto(nombre, 28), function () { salirDePregunta(); }, vista === 'test');
    }
    if (vista === 'pregunta') {
      item(pIndice >= 0 ? 'Pregunta ' + (pIndice + 1) : 'Pregunta nueva', null, true);
    }
  }

  /* ============================================================== EL BANCO */

  function hayCambios() {
    return vista === 'pregunta' ? (sucio || testSucio) : sucio;
  }

  function irAlBanco() {
    if (hayCambios() && (vista === 'test' || vista === 'pregunta' || vista === 'importar')) {
      confirmarSalir().then(function (si) { if (si) renderBanco(); });
      return;
    }
    renderBanco();
  }

  function confirmarSalir() {
    return window.RetoDialogo.preguntar({
      titulo: 'Salir sin guardar',
      texto: 'Tienes cambios que no se han guardado. Si sales ahora, se pierden.',
      ok: 'Sí, salir',
      cancelar: 'No, seguir aquí'
    });
  }

  function renderBanco() {
    borrador = null;
    pBorrador = null;
    sucio = false;
    testSucio = false;
    var v = mostrar('banco', 'Tus tests');
    pintarRuta();

    v.sec.appendChild(el('p', null,
      'Aquí están los tests de tu banco. Abre uno para cambiarlo, o crea uno nuevo.'));

    var acciones = el('div', 'tst-acciones');
    acciones.appendChild(boton('Crear un test nuevo', 'mas', 'boton--principal', crearTest));
    acciones.appendChild(boton('Importar tests', 'subir', '', renderImportar));
    v.sec.appendChild(acciones);

    /* La búsqueda, el agrupar por materia, el orden y las tarjetas o la lista las
       pone el módulo compartido (reto-tests-lista.js): así el banco y "Resolver
       test" se ven y se ordenan igual. */
    var cont = el('div');
    v.sec.appendChild(cont);
    listaCtl = Lista.montar({
      contenedor: cont,
      prefijo: 'bk',
      conTipo: true,
      tests: function () { return tests; },
      tarjeta: tarjetaBanco,
      vacio: bancoVacio
    });
    enfocarTitulo(v);
  }

  /* El banco recién estrenado: se puede empezar de cero o con los tests de
     ejemplo para probar cómo se ve todo. */
  function bancoVacio() {
    var c = el('div');
    c.appendChild(el('p', null, 'Todavía no tienes tests. Crea el primero, impórtalo desde un archivo, o carga unos de ejemplo para ver cómo funciona.'));
    c.appendChild(boton('Cargar tests de ejemplo', 'mas', 'boton--chico', cargarEjemplos));
    return c;
  }

  function cargarEjemplos() {
    Banco.ejemplos().then(function (n) { return recargar().then(function () {
      decir('Se agregaron ' + n + ' tests de ejemplo.');
    }); }).catch(function (e) { decir('No se pudieron guardar: ' + e.message); });
  }

  /* Vuelve a leer el banco de IndexedDB y repinta la lista. */
  function recargar() {
    return Banco.cargar().then(function (lista) {
      tests = lista;
      if (vista === 'banco') repintarLista();
    });
  }

  function falloAlGuardar(e) { decir('No se pudo guardar: ' + (e && e.message ? e.message : e)); }

  function repintarLista() { if (listaCtl) listaCtl.repintar(); }

  /* Un test es una TARJETA, la misma del resto de la plataforma (.tarjeta con
     su icono, título y texto). No es un enlace: abre, duplica y borra, así que
     lleva botones adentro y no .tarjeta-nav. */
  function tarjetaBanco(t, ctx) {
    var tj = el('article', 'tarjeta tst-tarjeta');
    tj.insertAdjacentHTML('afterbegin', Muestra.iconoTarjeta(t.materia));
    tj.appendChild(el('h3', 'tarjeta-titulo', t.titulo));
    if (t.descripcion) tj.appendChild(el('p', 'tarjeta-texto', t.descripcion));
    var meta = el('p', 'tst-tarjeta-meta');
    meta.appendChild(document.createTextNode(
      (ctx.plano ? (t.materia || 'Sin materia') + ' · ' : '') +
      (t.preguntas.length === 1 ? '1 pregunta' : t.preguntas.length + ' preguntas')));
    meta.appendChild(etiquetaTipo(tipoDeTest(t)));
    tj.appendChild(meta);
    tj.appendChild(el('p', 'tst-tarjeta-hecho',
      'Modificado ' + (ctx.modificado || 'hoy') + ' · ' + ctx.hace));

    var bs = el('div', 'tst-fila-botones tst-tarjeta-acciones');
    var be = boton('Editar', 'editar', 'boton--principal boton--chico', function () { editarTest(t.id); });
    be.setAttribute('aria-label', 'Editar el test ' + t.titulo);
    var bd = boton('Duplicar', 'copiar', 'boton--chico', function () { duplicarTest(t.id); });
    bd.setAttribute('aria-label', 'Duplicar el test ' + t.titulo);
    var bb = boton('Borrar', 'borrar', 'boton--chico', function () { borrarTest(t.id); });
    bb.setAttribute('aria-label', 'Borrar el test ' + t.titulo);
    bs.appendChild(be); bs.appendChild(bd); bs.appendChild(bb);
    tj.appendChild(bs);
    return tj;
  }

  function hoyISO() { return new Date().toISOString().slice(0, 10); }

  /* ============================================================ IMPORTAR */

  /* El desplazamiento (en caracteres) donde empieza una línea de un texto. */
  function inicioDeLinea(texto, linea) {
    var pos = 0;
    for (var i = 1; i < linea; i++) {
      var k = texto.indexOf('\n', pos);
      if (k < 0) return texto.length;
      pos = k + 1;
    }
    return pos;
  }

  function descargarPlantilla() {
    var blob = new Blob([Imp.plantilla], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-tests.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    decir('Se descargó "plantilla-tests.txt". Ábrela, cámbiale las preguntas y súbela otra vez.');
  }

  /* Cómo se escribe: una lista corta de marcas. La explicación larga vive en
     reto-tests-importar.js y en la plantilla que se descarga. */
  function guiaDelFormato() {
    var det = el('details', 'tst-bloque');
    det.appendChild(el('summary', null, 'Cómo se escribe el archivo'));
    det.appendChild(el('p', null,
      'Cada marca va al principio de una línea, sin espacios antes. Lo que escribas después (y en las ' +
      'líneas de abajo, hasta la siguiente marca) es su texto. Las líneas con # son comentarios.'));
    var dl = el('dl');
    [
      ['[N1] Título', 'El título del test. Cada [N1] empieza un test nuevo, y el archivo puede traer varios.'],
      ['[N2] [N3] [N4]', 'El tema de las preguntas que siguen. Usa los que necesites: los que falten no se cuentan. Uno nuevo borra los de abajo.'],
      ['[MATERIA] [DESCRIPCION]', 'Opcionales, justo después del [N1]. Sin [MATERIA], el test se agrupa con su título.'],
      ['[P] Pregunta', 'La pregunta.'],
      ['[R] Respuesta', 'Una respuesta incorrecta (de 2 a 6 en total).'],
      ['[OK] Respuesta', 'LA respuesta correcta. Solo una por pregunta.'],
      ['[EXPLICA] Texto', 'Lo que se le muestra a quien falla: ayuda a rehacerla, nunca dice la respuesta.'],
      ['[TEXTO] [FRASE]', 'Para preguntas de lectura: el texto, y la frase del texto donde está la respuesta. Van ANTES del [P] y solo afectan a esa pregunta.']
    ].forEach(function (d) {
      var dt = el('dt');
      dt.appendChild(el('span', 'tst-codigo', d[0]));
      dl.appendChild(dt);
      dl.appendChild(el('dd', null, d[1]));
    });
    det.appendChild(dl);
    det.appendChild(el('p', null, 'Las preguntas con números que cambian todavía no se pueden importar.'));
    return det;
  }

  function renderImportar() {
    borrador = null;
    pBorrador = null;
    sucio = false;
    testSucio = false;
    var ultimo = null;
    var v = mostrar('importar', 'Importar tests');
    pintarRuta();
    decir('');
    v.sec.appendChild(el('p', null,
      'Escribe tus preguntas en un archivo de texto con las marcas de R.E.T.O. (las mismas [N1], [N2]… de los ' +
      'textos), y súbelo o pégalo aquí. Antes de agregar nada se revisa y se te dice en qué línea hay un problema.'));
    v.sec.appendChild(guiaDelFormato());

    var barra = el('div', 'tst-acciones');
    var archivo = document.createElement('input');
    archivo.type = 'file';
    archivo.accept = '.txt,.md,text/plain';
    archivo.hidden = true;
    archivo.setAttribute('aria-label', 'Elegir un archivo de texto con las preguntas');
    var bArchivo = boton('Elegir un archivo', 'subir', '', function () { archivo.click(); });
    barra.appendChild(bArchivo);
    barra.appendChild(archivo);
    barra.appendChild(boton('Descargar un ejemplo', 'bajar', '', descargarPlantilla));
    v.sec.appendChild(barra);

    var ta = areaTexto('imp-texto', '', 12);
    ta.classList.add('tst-importar-texto');
    ta.spellcheck = false;
    v.sec.appendChild(campo('imp-texto', 'O pega aquí el texto de las preguntas',
      'Mientras escribes no se revisa nada: toca "Revisar el texto" cuando termines.', ta));

    var acc = el('div', 'tst-acciones');
    acc.appendChild(boton('Revisar el texto', 'visto', 'boton--principal', revisar));
    acc.appendChild(boton('Cancelar', null, '', irAlBanco));
    v.sec.appendChild(acc);

    var zona = el('div', 'tst-resumen-import');
    zona.id = 'imp-resultado';
    zona.setAttribute('aria-live', 'polite');
    v.sec.appendChild(zona);

    /* Si se cambia el texto, lo revisado ya no vale: se borra el resultado para
       no agregar al banco algo distinto de lo que se ve. */
    ta.addEventListener('input', function () { ultimo = null; limpiar(zona); });

    archivo.addEventListener('change', function () {
      var f = archivo.files && archivo.files[0];
      if (!f) return;
      var lector = new FileReader();
      lector.onload = function () {
        ta.value = String(lector.result || '');
        sucio = true;
        archivo.value = '';
        revisar();
      };
      lector.onerror = function () { decir('No se pudo leer el archivo.'); };
      lector.readAsText(f, 'utf-8');
    });

    function irALinea(n) {
      var inicio = inicioDeLinea(ta.value, n);
      var fin = ta.value.indexOf('\n', inicio);
      if (fin < 0) fin = ta.value.length;
      ta.focus();
      ta.setSelectionRange(inicio, fin);
      var alto = parseFloat(w_estilo(ta).lineHeight) || 20;
      ta.scrollTop = Math.max(0, (n - 3) * alto);
    }

    function w_estilo(nodo) { return window.getComputedStyle ? window.getComputedStyle(nodo) : {}; }

    function arbolDe(t) {
      var cuenta = {};
      var orden = [];
      t.preguntas.forEach(function (q) {
        var k = Imp.ruta(q.tema).join(', ') || 'Sin tema';
        if (!cuenta[k]) { cuenta[k] = 0; orden.push(k); }
        cuenta[k]++;
      });
      var ul = el('ul', 'tst-arbol');
      orden.forEach(function (k) {
        ul.appendChild(el('li', null, k + ': ' + cuenta[k] + (cuenta[k] === 1 ? ' pregunta' : ' preguntas')));
      });
      return ul;
    }

    function revisar() {
      if (!ta.value.trim()) {
        ultimo = null;
        limpiar(zona);
        zona.appendChild(el('p', 'tst-error', 'Falta el texto. Pega las preguntas o elige un archivo.'));
        zona.firstChild.insertAdjacentHTML('afterbegin', icono('aviso'));
        return;
      }
      ultimo = Imp.parsear(ta.value);
      var r = ultimo, res = r.resumen;
      limpiar(zona);
      zona.appendChild(el('h3', null, 'Esto es lo que se encontró'));
      zona.appendChild(el('p', null,
        res.tests + (res.tests === 1 ? ' test' : ' tests') + ' y ' + res.preguntas +
        (res.preguntas === 1 ? ' pregunta' : ' preguntas') + '. ' + res.validas + ' sin errores' +
        (res.errores ? ', ' + res.errores + (res.errores === 1 ? ' error' : ' errores') : '') +
        (res.avisos ? ' y ' + res.avisos + (res.avisos === 1 ? ' aviso' : ' avisos') : '') + '.'));
      r.tests.forEach(function (t) {
        var det = el('div');
        var titulo = el('p');
        titulo.appendChild(el('strong', null, t.titulo || '(sin título)'));
        titulo.appendChild(document.createTextNode(' — ' + t.preguntas.length +
          (t.preguntas.length === 1 ? ' pregunta' : ' preguntas') + (t.materia ? ', materia: ' + t.materia : '')));
        det.appendChild(titulo);
        det.appendChild(arbolDe(t));
        zona.appendChild(det);
      });
      if (r.problemas.length) {
        zona.appendChild(el('h3', null, 'Lo que hay que mirar'));
        var ul = el('ul', 'tst-problemas');
        r.problemas.forEach(function (pb) {
          var li = el('li', 'tst-problema');
          li.setAttribute('data-tipo', pb.tipo);
          li.insertAdjacentHTML('afterbegin', icono(pb.tipo === 'error' ? 'aviso' : 'info'));
          li.appendChild(el('strong', null, (pb.tipo === 'error' ? 'Error' : 'Aviso') + ', línea ' + pb.linea + ':'));
          li.appendChild(el('p', null, pb.texto));
          var ir = boton('Ir a la línea', null, 'boton--chico', function () { irALinea(pb.linea); });
          ir.setAttribute('aria-label', 'Ir a la línea ' + pb.linea + ' del texto');
          li.appendChild(ir);
          ul.appendChild(li);
        });
        zona.appendChild(ul);
      }
      var fin = el('div', 'tst-acciones');
      if (res.validas > 0) {
        fin.appendChild(boton(res.errores ? 'Agregar las ' + res.validas + ' preguntas sin errores' : 'Agregar al banco',
          'mas', 'boton--principal', agregar));
      }
      zona.appendChild(fin);
      if (res.errores && res.validas > 0) {
        zona.appendChild(el('p', 'ayuda', 'Las preguntas con errores no se agregan. Corrígelas en el texto y vuelve a revisar.'));
      } else if (res.validas === 0) {
        zona.appendChild(el('p', 'tst-error', 'No hay preguntas que se puedan agregar. Corrige los errores y vuelve a revisar.'));
        zona.lastChild.insertAdjacentHTML('afterbegin', icono('aviso'));
      }
      decir(res.validas + ' de ' + res.preguntas + ' preguntas sin errores.');
    }

    function agregar() {
      if (!ultimo) return;
      var nuevos = Imp.aTests(ultimo, { soloValidas: true, hoy: hoyISO() });
      if (!nuevos.length) return;
      var repetidos = nuevos.filter(function (n) {
        return tests.some(function (t) { return t.titulo.trim().toLowerCase() === n.titulo.trim().toLowerCase(); });
      }).length;
      nuevos.forEach(function (n) { tests.push(n); });
      var total = nuevos.reduce(function (a, n) { return a + n.preguntas.length; }, 0);
      sucio = false;
      renderBanco();
      Banco.guardarVarios(nuevos).then(function () {
        decir('Se agregaron ' + nuevos.length + (nuevos.length === 1 ? ' test' : ' tests') + ' con ' + total +
              (total === 1 ? ' pregunta' : ' preguntas') + '.' +
              (repetidos ? ' ' + repetidos + (repetidos === 1 ? ' tiene' : ' tienen') + ' el mismo título que otro que ya tenías.' : ''));
      }, falloAlGuardar);
    }
    enfocarTitulo(v);
  }

  function crearTest() {
    nuevo = true;
    borrador = { id: nuevoId('t'), titulo: '', materia: '', descripcion: '', modificado: hoyISO(), preguntas: [] };
    sucio = false;
    renderTest();
  }

  function editarTest(id) {
    var t = tests.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    nuevo = false;
    borrador = copia(t);
    sucio = false;
    renderTest();
  }

  function duplicarTest(id) {
    var t = tests.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    var c = copia(t);
    c.id = nuevoId('t');
    c.titulo = t.titulo + ' (copia)';
    c.modificado = hoyISO();
    tests.push(c);
    repintarLista();
    Banco.guardar(c).then(function () {
      decir('Se duplicó el test. La copia se llama «' + c.titulo + '».');
    }, falloAlGuardar);
  }

  function borrarTest(id) {
    var t = tests.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    window.RetoDialogo.preguntar({
      titulo: 'Borrar este test',
      texto: '«' + t.titulo + '» y sus ' + t.preguntas.length +
             ' preguntas se borran. No se puede deshacer.',
      ok: 'Sí, borrar',
      cancelar: 'No'
    }).then(function (si) {
      if (!si) return;
      tests = tests.filter(function (x) { return x.id !== id; });
      repintarLista();
      Banco.borrar(id).then(function () {
        decir('Se borró «' + t.titulo + '».');
        var bc = document.querySelector('#v-banco .boton--principal');
        if (bc) bc.focus();
      }, falloAlGuardar);
    });
  }

  /* ============================================================== EL TEST */

  function renderTest() {
    pBorrador = null;
    pIndice = -1;
    var v = mostrar('test', nuevo ? 'Crear un test' : 'Editar el test');
    pintarRuta();
    decir('');

    var datos = el('div');
    var titulo = entrada('f-titulo', 'text', borrador.titulo, { maxlength: '80', autocomplete: 'off' });
    datos.appendChild(campo('f-titulo', 'Título del test', 'Un nombre corto que te diga de qué trata.', titulo));

    var materia = entrada('f-test-materia', 'text', borrador.materia, { list: 'materias', maxlength: '40', autocomplete: 'off' });
    var dl = el('datalist'); dl.id = 'materias';
    Muestra.materias.forEach(function (m) { var o = el('option'); o.value = m; dl.appendChild(o); });
    datos.appendChild(campo('f-test-materia', 'Materia', 'Escribe una o elige una de la lista.', materia));
    datos.appendChild(dl);

    var desc = areaTexto('f-descripcion', borrador.descripcion, 3);
    datos.appendChild(campo('f-descripcion', 'Descripción (opcional)', 'Una o dos frases.', desc));
    v.sec.appendChild(datos);

    v.sec.appendChild(el('h3', null, 'Preguntas'));
    var lista = el('ol', 'tst-preguntas');
    lista.id = 'lista-preguntas';
    v.sec.appendChild(lista);
    pintarPreguntas();

    var err = el('p', 'tst-error');
    err.id = 'error-preguntas';
    err.hidden = true;
    v.sec.appendChild(err);

    var agregar = el('div', 'tst-acciones');
    agregar.appendChild(boton('Agregar una pregunta', 'mas', '', elegirTipo));
    v.sec.appendChild(agregar);

    var fin = el('div', 'tst-acciones');
    fin.appendChild(boton('Guardar test', 'visto', 'boton--principal', guardarTest));
    fin.appendChild(boton('Cancelar', null, '', irAlBanco));
    v.sec.appendChild(fin);
    enfocarTitulo(v);
  }

  function capturarTest() {
    var t = porId('f-titulo');
    if (!t) return;
    borrador.titulo = t.value;
    borrador.materia = porId('f-test-materia').value;
    borrador.descripcion = porId('f-descripcion').value;
  }

  function pintarPreguntas(foco) {
    var lista = porId('lista-preguntas');
    limpiar(lista);
    if (!borrador.preguntas.length) {
      var vacio = el('li', 'tst-vacio');
      vacio.appendChild(el('p', null, 'Este test todavía no tiene preguntas.'));
      lista.appendChild(vacio);
      return;
    }
    var total = borrador.preguntas.length;
    borrador.preguntas.forEach(function (p, i) {
      var li = el('li', 'tst-fila-pregunta');
      var info = el('div', 'tst-fila-info');
      var cab = el('div', 'tst-fila-cab');
      cab.appendChild(el('span', 'tst-num', 'Pregunta ' + (i + 1)));
      cab.appendChild(etiquetaTipo(p.tipo));
      info.appendChild(cab);
      info.appendChild(el('p', null, resumirTexto(p.enunciado, 110) || '(sin enunciado)'));
      var rutaTema = Lista.rutaDeTema(p.tema);
      info.appendChild(el('p', 'tst-tema-ruta', rutaTema.length ? 'Tema: ' + rutaTema.join(', ') : 'Sin tema'));
      li.appendChild(info);

      var bs = el('div', 'tst-fila-botones');
      var be = boton('Editar', 'editar', 'boton--chico', function () { editarPregunta(i); });
      be.setAttribute('aria-label', 'Editar la pregunta ' + (i + 1));
      var bsu = boton('Subir', 'subir', 'boton--chico', function () { mover(i, -1, 'subir'); });
      bsu.setAttribute('aria-label', 'Subir la pregunta ' + (i + 1));
      bsu.setAttribute('data-mov', 'subir');
      if (i === 0) bsu.setAttribute('aria-disabled', 'true');
      var bba = boton('Bajar', 'bajar', 'boton--chico', function () { mover(i, 1, 'bajar'); });
      bba.setAttribute('aria-label', 'Bajar la pregunta ' + (i + 1));
      bba.setAttribute('data-mov', 'bajar');
      if (i === total - 1) bba.setAttribute('aria-disabled', 'true');
      var bdu = boton('Duplicar', 'copiar', 'boton--chico', function () { duplicarPregunta(i); });
      bdu.setAttribute('aria-label', 'Duplicar la pregunta ' + (i + 1));
      var bbo = boton('Borrar', 'borrar', 'boton--chico', function () { borrarPregunta(i); });
      bbo.setAttribute('aria-label', 'Borrar la pregunta ' + (i + 1));
      [be, bsu, bba, bdu, bbo].forEach(function (b) { bs.appendChild(b); });
      li.appendChild(bs);
      lista.appendChild(li);
    });
    if (foco) {
      var b = lista.children[foco.i] && lista.children[foco.i].querySelector('[data-mov="' + foco.cual + '"]');
      if (b && b.getAttribute('aria-disabled') === 'true') {
        b = lista.children[foco.i].querySelector('[data-mov="' + (foco.cual === 'subir' ? 'bajar' : 'subir') + '"]');
      }
      if (b) b.focus();
    }
  }

  function mover(i, d, cual) {
    var j = i + d;
    if (j < 0 || j >= borrador.preguntas.length) return;
    capturarTest();
    var p = borrador.preguntas.splice(i, 1)[0];
    borrador.preguntas.splice(j, 0, p);
    sucio = true;
    pintarPreguntas({ i: j, cual: cual });
    decir('La pregunta pasó al lugar ' + (j + 1) + ' de ' + borrador.preguntas.length + '.');
  }

  function duplicarPregunta(i) {
    capturarTest();
    var c = copia(borrador.preguntas[i]);
    c.id = nuevoId('q');
    borrador.preguntas.splice(i + 1, 0, c);
    sucio = true;
    pintarPreguntas();
    decir('Se duplicó la pregunta ' + (i + 1) + '. La copia es la ' + (i + 2) + '.');
  }

  function borrarPregunta(i) {
    window.RetoDialogo.preguntar({
      titulo: 'Borrar esta pregunta',
      texto: 'La pregunta ' + (i + 1) + ' se borra de este test. No se puede deshacer.',
      ok: 'Sí, borrar',
      cancelar: 'No'
    }).then(function (si) {
      if (!si) return;
      capturarTest();
      borrador.preguntas.splice(i, 1);
      sucio = true;
      pintarPreguntas();
      decir('Se borró la pregunta ' + (i + 1) + '.');
    });
  }

  function guardarTest() {
    capturarTest();
    var errores = {};
    if (!borrador.titulo.trim()) errores['f-titulo'] = 'Falta el título del test.';
    if (!borrador.preguntas.length) errores['error-preguntas'] = 'Agrega por lo menos una pregunta.';
    if (mostrarErrores(errores, 'Hay cosas por arreglar antes de guardar')) return;
    borrador.titulo = borrador.titulo.trim();
    borrador.materia = borrador.materia.trim();
    borrador.modificado = hoyISO();
    var i = -1;
    tests.forEach(function (t, k) { if (t.id === borrador.id) i = k; });
    var guardado = copia(borrador);
    if (i >= 0) tests[i] = guardado; else tests.push(guardado);
    sucio = false;
    var nombre = borrador.titulo;
    renderBanco();
    Banco.guardar(guardado).then(function () {
      decir('Se guardó «' + nombre + '».');
    }, falloAlGuardar);
  }

  /* ------------------------------------------------------ elegir el tipo */

  function elegirTipo() {
    capturarTest();
    var d = document.createElement('dialog');
    d.className = 'dialogo';
    d.setAttribute('aria-labelledby', 'tst-tipo-titulo');
    var t = el('h2', 'dialogo-titulo', '¿Qué clase de pregunta?');
    t.id = 'tst-tipo-titulo';
    d.appendChild(t);
    d.appendChild(el('p', 'dialogo-texto', 'Puedes mezclar las dos clases en un mismo test.'));
    var caja = el('div', 'tst-elegir-tipo');

    function opcion(tipo, titulo, texto) {
      var b = el('button', 'tst-eleccion');
      b.type = 'button';
      var s = el('strong');
      s.insertAdjacentHTML('afterbegin', icono(tipo));
      s.appendChild(document.createTextNode(titulo));
      b.appendChild(s);
      b.appendChild(el('span', null, texto));
      b.addEventListener('click', function () { d.close(); nuevaPregunta(tipo); });
      return b;
    }
    caja.appendChild(opcion('estatica', 'Pregunta fija',
      'Escribes la pregunta y las respuestas. No cambian nunca.'));
    caja.appendChild(opcion('dinamica', 'Pregunta con números que cambian',
      'Escribes una fórmula. Cada vez salen otros números y otras respuestas.'));
    d.appendChild(caja);
    var acc = el('div', 'dialogo-acciones');
    acc.appendChild(boton('Cancelar', null, '', function () { d.close(); }));
    d.appendChild(acc);
    d.addEventListener('close', function () {
      if (d.parentNode) d.parentNode.removeChild(d);
    });
    document.body.appendChild(d);
    d.showModal();
    var primero = d.querySelector('.tst-eleccion');
    if (primero) primero.focus();
  }

  /* ========================================================== LA PREGUNTA */

  function nuevaPregunta(tipo) {
    pIndice = -1;
    testSucio = sucio;
    sucio = false;
    /* Al escribir muchas preguntas seguidas, casi siempre son del mismo tema que
       la de arriba: una pregunta nueva empieza con ese tema y solo se cambia si
       hace falta. */
    var anterior = borrador.preguntas.length ? borrador.preguntas[borrador.preguntas.length - 1].tema : null;
    var temaInicial = anterior ? copia(anterior) : {};
    if (tipo === 'estatica') {
      pBorrador = {
        id: nuevoId('q'), tipo: 'estatica', tema: temaInicial, enunciado: '', pasaje: '', fraseClave: '',
        opciones: [{ id: 'a', texto: '' }, { id: 'b', texto: '' }], correcta: null, contexto: ''
      };
    } else {
      pBorrador = {
        id: nuevoId('q'), tipo: 'dinamica', tema: temaInicial, enunciado: '',
        variables: [{ nombre: '', min: 1, max: 10, paso: 1, decimales: 0 }],
        formula: '', decimales: 2,
        distractores: [
          { formula: '', clase: 'concepto' },
          { formula: '', clase: 'calculo' }
        ],
        opcionesAMostrar: 3
      };
    }
    renderPregunta();
  }

  function editarPregunta(i) {
    capturarTest();
    testSucio = sucio;
    sucio = false;
    pIndice = i;
    pBorrador = copia(borrador.preguntas[i]);
    renderPregunta();
  }

  function salirDePregunta() {
    if (vista === 'pregunta') {
      var ok = function () { renderTestConservado(); };
      if (sucio) confirmarSalir().then(function (si) { if (si) ok(); });
      else ok();
    }
  }

  /* Volver al test desde una pregunta sin perder lo que ya se había escrito
     del test (el borrador sigue en memoria). */
  function renderTestConservado() {
    renderTest();
    sucio = testSucio;
  }

  function renderPregunta() {
    var titulo = pIndice >= 0 ? 'Editar la pregunta ' + (pIndice + 1)
      : (pBorrador.tipo === 'estatica' ? 'Nueva pregunta fija' : 'Nueva pregunta con números que cambian');
    var v = mostrar('pregunta', titulo);
    pintarRuta();
    decir('');

    var form = el('div');
    form.id = 'form-pregunta';
    v.sec.appendChild(form);
    if (pBorrador.tipo === 'estatica') formEstatica(form); else formDinamica(form);

    var fin = el('div', 'tst-acciones');
    fin.appendChild(boton('Guardar pregunta', 'visto', 'boton--principal', guardarPregunta));
    fin.appendChild(boton('Cancelar', null, '', function () {
      if (sucio) confirmarSalir().then(function (si) { if (si) renderTestConservado(); });
      else renderTestConservado();
    }));
    v.sec.appendChild(fin);
    enfocarTitulo(v);
  }

  /* Lee lo que hay escrito en la pantalla y lo pasa al borrador. Se llama antes
     de CUALQUIER cambio que vuelva a dibujar la pantalla (agregar, quitar), para
     no perder lo que la persona acaba de escribir. */
  function capturarPregunta() {
    var p = pBorrador;
    var en = porId('f-enunciado');
    if (!en) return;
    p.enunciado = en.value;
    var tema = {};
    ['n2', 'n3', 'n4'].forEach(function (k) {
      var campoTema = porId('f-tema-' + k);
      var v = campoTema ? campoTema.value.trim() : '';
      if (v) tema[k] = v;
    });
    p.tema = tema;
    if (p.tipo === 'estatica') {
      p.pasaje = porId('f-pasaje').value;
      p.fraseClave = porId('f-frase').value;
      p.contexto = porId('f-contexto').value;
      p.opciones.forEach(function (o, i) { o.texto = porId('f-opcion-' + i).value; });
      var marcada = document.querySelector('input[name="correcta"]:checked');
      p.correcta = marcada ? p.opciones[Number(marcada.value)].id : null;
    } else {
      p.variables.forEach(function (x, i) {
        x.nombre = porId('f-var-' + i + '-nombre').value.trim();
        x.min = porId('f-var-' + i + '-min').value;
        x.max = porId('f-var-' + i + '-max').value;
        x.paso = porId('f-var-' + i + '-paso').value;
        x.decimales = porId('f-var-' + i + '-dec').value;
      });
      p.formula = porId('f-formula').value;
      p.decimales = porId('f-decimales').value;
      p.distractores.forEach(function (d, i) {
        d.formula = porId('f-dis-' + i + '-formula').value;
        d.clase = porId('f-dis-' + i + '-clase').value;
      });
      p.opcionesAMostrar = Number(porId('f-cuantas').value);
    }
  }

  /* Vuelve a dibujar el formulario con lo que hay en el borrador. NO captura lo
     escrito: quien llama ya lo hizo ANTES de cambiar el borrador (agregar o
     quitar una fila). Capturar aquí leería la pantalla vieja con el borrador
     nuevo, y las filas se pisarían entre sí. */
  function refrescarPregunta(enfocarId) {
    var form = porId('form-pregunta');
    limpiar(form);
    if (pBorrador.tipo === 'estatica') formEstatica(form); else formDinamica(form);
    if (enfocarId && porId(enfocarId)) porId(enfocarId).focus();
  }

  /* --------------------------------------------------- pregunta fija */

  /* ¿DE QUÉ TEMA ES? Los niveles 2 a 4 del marcado [N1]..[N4]: el nivel 1 es el
     título del test. Son opcionales y los que falten no se concatenan: al
     terminar, el resultado dice "Bloque I, Las fracciones" y no "Bloque I, , Las
     fracciones". Los campos sugieren lo que ya se escribió en este test, para no
     teclear el mismo tema cien veces. */
  function temasUsados(nivel) {
    var vistos = {};
    (borrador ? borrador.preguntas : []).forEach(function (q) {
      var v = q.tema && q.tema['n' + nivel];
      if (v) vistos[v] = true;
    });
    return Object.keys(vistos);
  }

  function grupoTema(form) {
    var p = pBorrador;
    var g = el('fieldset', 'tst-bloque');
    g.appendChild(el('legend', null, '¿De qué tema es?'));
    g.appendChild(el('p', 'ayuda',
      'El título del test es el nivel 1. Aquí van los niveles 2 a 4: por ejemplo "Matemáticas", ' +
      '"Bloque I" y "Las fracciones". Usa los que necesites; los que dejes vacíos no se cuentan. ' +
      'Con esto, al terminar el test se dice qué repasar.'));
    var fila = el('div', 'tst-grupo-campos');
    [['n2', 'Nivel 2', 'Matemáticas'], ['n3', 'Nivel 3', 'Bloque I'], ['n4', 'Nivel 4 (opcional)', 'Las fracciones']].forEach(function (d) {
      var k = d[0];
      var id = 'f-tema-' + k;
      var ent = entrada(id, 'text', p.tema && p.tema[k] ? p.tema[k] : '', { list: 'temas-' + k, autocomplete: 'off', maxlength: '80' });
      fila.appendChild(campo(id, d[1], 'Por ejemplo: ' + d[2], ent));
      var dl = el('datalist');
      dl.id = 'temas-' + k;
      temasUsados(Number(k.charAt(1))).forEach(function (t) { var o = el('option'); o.value = t; dl.appendChild(o); });
      fila.appendChild(dl);
    });
    g.appendChild(fila);
    form.appendChild(g);
  }

  function formEstatica(form) {
    var p = pBorrador;
    var en = areaTexto('f-enunciado', p.enunciado, 3);
    form.appendChild(campo('f-enunciado', 'La pregunta',
      'Escríbela completa, con frases cortas.', en));
    grupoTema(form);

    var det = el('details');
    det.className = 'tst-bloque';
    if (p.pasaje || p.fraseClave) det.open = true;
    det.appendChild(el('summary', null, 'Agregar un texto para leer (opcional)'));
    det.appendChild(campo('f-pasaje', 'El texto',
      'Para preguntas de lectura: el texto que hay que leer antes de responder.',
      areaTexto('f-pasaje', p.pasaje, 4)));
    det.appendChild(campo('f-frase', 'La frase donde está la respuesta',
      'Cópiala igual que en el texto. Si la persona falla, se le señala.',
      entrada('f-frase', 'text', p.fraseClave, { autocomplete: 'off' })));
    form.appendChild(det);

    var gr = el('fieldset', 'tst-bloque');
    gr.appendChild(el('legend', null, 'Las respuestas'));
    gr.appendChild(el('p', 'ayuda', 'Escribe entre 2 y 6. Marca cuál es la correcta.'));
    var lista = el('ul', 'tst-bloques');
    p.opciones.forEach(function (o, i) {
      var li = el('li', 'tst-bloque');
      li.appendChild(campo('f-opcion-' + i, 'Respuesta ' + String.fromCharCode(65 + i), null,
        entrada('f-opcion-' + i, 'text', o.texto, { autocomplete: 'off' })));
      var lab = el('label', 'tst-correcta');
      var r = document.createElement('input');
      r.type = 'radio';
      r.name = 'correcta';
      r.value = String(i);
      r.id = 'f-correcta-' + i;
      if (p.correcta === o.id) r.checked = true;
      r.addEventListener('change', function () { sucio = true; });
      lab.appendChild(r);
      lab.appendChild(document.createTextNode(' Esta es la correcta'));
      li.appendChild(lab);
      var q = boton('Quitar esta respuesta', 'borrar', 'boton--chico', function () { quitarOpcion(i); });
      if (p.opciones.length <= MIN_OPCIONES) q.setAttribute('aria-disabled', 'true');
      li.appendChild(q);
      lista.appendChild(li);
    });
    gr.appendChild(lista);
    var errC = el('p', 'tst-error'); errC.id = 'f-correcta-error'; errC.hidden = true;
    gr.appendChild(errC);
    var add = boton('Agregar otra respuesta', 'mas', 'boton--chico', agregarOpcion);
    if (p.opciones.length >= MAX_OPCIONES) add.setAttribute('aria-disabled', 'true');
    gr.appendChild(add);
    form.appendChild(gr);

    form.appendChild(campo('f-contexto', 'Qué se le muestra si falla',
      'Los hechos, las fechas y por qué importan. Nunca pongas la respuesta: se muestra para que la rehaga.',
      areaTexto('f-contexto', p.contexto, 5)));
  }

  function agregarOpcion() {
    if (pBorrador.opciones.length >= MAX_OPCIONES) { decir('Ya hay 6 respuestas, que es el máximo.'); return; }
    capturarPregunta();
    var usadas = pBorrador.opciones.map(function (o) { return o.id; });
    var id = LETRAS_OPCION.filter(function (l) { return usadas.indexOf(l) < 0; })[0];
    pBorrador.opciones.push({ id: id, texto: '' });
    sucio = true;
    refrescarPregunta('f-opcion-' + (pBorrador.opciones.length - 1));
  }

  function quitarOpcion(i) {
    if (pBorrador.opciones.length <= MIN_OPCIONES) { decir('Hacen falta por lo menos 2 respuestas.'); return; }
    capturarPregunta();
    var quitada = pBorrador.opciones.splice(i, 1)[0];
    if (pBorrador.correcta === quitada.id) pBorrador.correcta = null;
    sucio = true;
    refrescarPregunta('f-opcion-' + Math.min(i, pBorrador.opciones.length - 1));
    decir('Se quitó la respuesta ' + String.fromCharCode(65 + i) + '.');
  }

  /* --------------------------------------------- pregunta con números */

  function formDinamica(form) {
    var p = pBorrador;

    var en = areaTexto('f-enunciado', p.enunciado, 3);
    form.appendChild(campo('f-enunciado', 'La pregunta',
      'Donde va un número que cambia, pon su nombre entre llaves, como {d}.', en));
    grupoTema(form);
    var ins = el('div', 'tst-insertar');
    ins.appendChild(el('span', null, 'Insertar en la pregunta:'));
    var hay = false;
    p.variables.forEach(function (x) {
      if (!x.nombre) return;
      hay = true;
      var b = boton('{' + x.nombre + '}', null, 'boton--chico', function () { insertarVariable(x.nombre); });
      b.setAttribute('aria-label', 'Insertar la variable ' + x.nombre + ' en la pregunta');
      ins.appendChild(b);
    });
    if (!hay) ins.appendChild(el('span', 'ayuda', 'Primero ponle nombre a una variable, abajo.'));
    form.appendChild(ins);

    /* LAS VARIABLES */
    var gv = el('fieldset', 'tst-bloque');
    gv.appendChild(el('legend', null, 'Los números que cambian'));
    gv.appendChild(el('p', 'ayuda',
      'Cada variable toma un valor al azar entre su mínimo y su máximo cada vez que sale la pregunta.'));
    var lv = el('ul', 'tst-bloques');
    p.variables.forEach(function (x, i) {
      var li = el('li', 'tst-bloque');
      li.appendChild(el('h4', null, 'Variable ' + (i + 1)));
      var g = el('div', 'tst-grupo-campos');
      g.appendChild(campo('f-var-' + i + '-nombre', 'Nombre', 'Una letra, como d.',
        entrada('f-var-' + i + '-nombre', 'text', x.nombre, { maxlength: '12', autocomplete: 'off' })));
      g.appendChild(campo('f-var-' + i + '-min', 'Mínimo', null,
        entrada('f-var-' + i + '-min', 'number', x.min, { step: 'any' })));
      g.appendChild(campo('f-var-' + i + '-max', 'Máximo', null,
        entrada('f-var-' + i + '-max', 'number', x.max, { step: 'any' })));
      g.appendChild(campo('f-var-' + i + '-paso', 'De cuánto en cuánto', 'Por ejemplo, de 10 en 10.',
        entrada('f-var-' + i + '-paso', 'number', x.paso, { step: 'any', min: '0' })));
      g.appendChild(campo('f-var-' + i + '-dec', 'Decimales', '0 si son enteros.',
        entrada('f-var-' + i + '-dec', 'number', x.decimales, { min: '0', max: '4', step: '1' })));
      li.appendChild(g);
      var q = boton('Quitar esta variable', 'borrar', 'boton--chico', function () { quitarVariable(i); });
      if (p.variables.length <= 1) q.setAttribute('aria-disabled', 'true');
      li.appendChild(q);
      lv.appendChild(li);
    });
    gv.appendChild(lv);
    var av = boton('Agregar otra variable', 'mas', 'boton--chico', agregarVariable);
    if (p.variables.length >= MAX_VARIABLES) av.setAttribute('aria-disabled', 'true');
    gv.appendChild(av);
    form.appendChild(gv);

    /* LA FÓRMULA */
    var gf = el('fieldset', 'tst-bloque');
    gf.appendChild(el('legend', null, 'El resultado correcto'));
    gf.appendChild(campo('f-formula', 'Fórmula', 'Usa los nombres de las variables. Suma +, resta -, multiplica * y divide /. Ejemplo: d / t',
      entrada('f-formula', 'text', p.formula, { autocomplete: 'off', spellcheck: 'false' })));
    gf.appendChild(campo('f-decimales', 'Decimales del resultado', 'Cuántos decimales se muestran. El resultado se redondea.',
      entrada('f-decimales', 'number', p.decimales, { min: '0', max: '4', step: '1' })));
    form.appendChild(gf);

    /* LOS DISTRACTORES */
    var gd = el('fieldset', 'tst-bloque');
    gd.appendChild(el('legend', null, 'Las respuestas incorrectas'));
    gd.appendChild(el('p', 'ayuda',
      'Cada una es otra fórmula que representa un error posible. Di de qué clase es: así el registro de ' +
      'repaso sabe si a la persona le conviene repasar la cuenta o la idea.'));
    var ld = el('ul', 'tst-bloques');
    p.distractores.forEach(function (d, i) {
      var li = el('li', 'tst-bloque');
      li.appendChild(el('h4', null, 'Respuesta incorrecta ' + (i + 1)));
      li.appendChild(campo('f-dis-' + i + '-formula', 'Fórmula', null,
        entrada('f-dis-' + i + '-formula', 'text', d.formula, { autocomplete: 'off', spellcheck: 'false' })));
      li.appendChild(campo('f-dis-' + i + '-clase', 'Qué error es', null,
        seleccion('f-dis-' + i + '-clase', CLASES, d.clase)));
      var q = boton('Quitar esta respuesta', 'borrar', 'boton--chico', function () { quitarDistractor(i); });
      if (p.distractores.length <= 2) q.setAttribute('aria-disabled', 'true');
      li.appendChild(q);
      ld.appendChild(li);
    });
    gd.appendChild(ld);
    var ad = boton('Agregar otra respuesta incorrecta', 'mas', 'boton--chico', agregarDistractor);
    if (p.distractores.length >= MAX_DISTRACTORES) ad.setAttribute('aria-disabled', 'true');
    gd.appendChild(ad);
    gd.appendChild(campo('f-cuantas', 'Cuántas respuestas se muestran',
      'La correcta y las demás, tomadas al azar de las incorrectas que escribiste.',
      seleccion('f-cuantas', [{ id: 3, nombre: '3 respuestas' }, { id: 4, nombre: '4 respuestas' }, { id: 5, nombre: '5 respuestas' }], p.opcionesAMostrar)));
    form.appendChild(gd);

    /* LA EXPLICACIÓN: no se escribe, se arma sola. */
    var gp = el('fieldset', 'tst-bloque');
    gp.appendChild(el('legend', null, 'Qué se le muestra si falla'));
    gp.appendChild(el('p', 'ayuda',
      'No hay nada que escribir: se arma sola, con los números de cada pregunta. Muestra la fórmula, la ' +
      'fórmula con los números puestos y el resultado. Más abajo ves cómo quedaría.'));
    form.appendChild(gp);

    /* LA VISTA PREVIA */
    var pv = el('section', 'tst-previa');
    pv.setAttribute('aria-labelledby', 'previa-titulo');
    var ph = el('h3', null, 'Así quedaría con números de ejemplo');
    ph.id = 'previa-titulo';
    pv.appendChild(ph);
    pv.appendChild(el('p', 'ayuda',
      'Pone un valor de ejemplo en cada variable. Todavía no calcula los resultados: eso lo hará el ' +
      'motor de Python cuando exista.'));
    pv.appendChild(boton('Mostrar la vista previa', 'foco', 'boton--chico', function () { pintarPrevia(); }));
    var salida = el('div');
    salida.id = 'previa-salida';
    salida.setAttribute('aria-live', 'polite');
    pv.appendChild(salida);
    form.appendChild(pv);
  }

  function insertarVariable(nombre) {
    var t = porId('f-enunciado');
    var ini = t.selectionStart, fin = t.selectionEnd;
    var txt = '{' + nombre + '}';
    t.value = t.value.slice(0, ini) + txt + t.value.slice(fin);
    t.focus();
    t.selectionStart = t.selectionEnd = ini + txt.length;
    sucio = true;
    decir('Se insertó ' + txt + ' en la pregunta.');
  }

  function agregarVariable() {
    if (pBorrador.variables.length >= MAX_VARIABLES) { decir('Ya hay 5 variables, que es el máximo.'); return; }
    capturarPregunta();
    pBorrador.variables.push({ nombre: '', min: 1, max: 10, paso: 1, decimales: 0 });
    sucio = true;
    refrescarPregunta('f-var-' + (pBorrador.variables.length - 1) + '-nombre');
  }

  function quitarVariable(i) {
    if (pBorrador.variables.length <= 1) { decir('Hace falta por lo menos 1 variable.'); return; }
    capturarPregunta();
    pBorrador.variables.splice(i, 1);
    sucio = true;
    refrescarPregunta('f-var-' + Math.min(i, pBorrador.variables.length - 1) + '-nombre');
    decir('Se quitó la variable ' + (i + 1) + '.');
  }

  function agregarDistractor() {
    if (pBorrador.distractores.length >= MAX_DISTRACTORES) { decir('Ya hay 6 respuestas incorrectas, que es el máximo.'); return; }
    capturarPregunta();
    pBorrador.distractores.push({ formula: '', clase: 'concepto' });
    sucio = true;
    refrescarPregunta('f-dis-' + (pBorrador.distractores.length - 1) + '-formula');
  }

  function quitarDistractor(i) {
    if (pBorrador.distractores.length <= 2) { decir('Hacen falta por lo menos 2 respuestas incorrectas.'); return; }
    capturarPregunta();
    pBorrador.distractores.splice(i, 1);
    sucio = true;
    refrescarPregunta('f-dis-' + Math.min(i, pBorrador.distractores.length - 1) + '-formula');
    decir('Se quitó la respuesta incorrecta ' + (i + 1) + '.');
  }

  /* La explicación tal como la vería quien falla, con los valores de ejemplo de la
     vista previa. Se arma con el mismo evaluador que usan las pantallas de
     respuesta, así que lo que se ve aquí es lo que se verá allá. Devuelve null si
     la fórmula no se puede calcular con esos valores. */
  function explicacionDeEjemplo(p, valores) {
    var Eval = window.RetoTestsEval;
    if (!Eval || !p.formula || !String(p.formula).trim()) return null;
    try {
      var vars = p.variables.filter(function (x) { return x.nombre && Object.prototype.hasOwnProperty.call(valores, x.nombre); })
        .map(function (x) {
          return { nombre: x.nombre, min: valores[x.nombre], max: valores[x.nombre], paso: 1, decimales: Math.max(0, Number(x.decimales) || 0) };
        });
      var g = Eval.generar({
        enunciado: '', variables: vars, formula: p.formula,
        decimales: Math.max(0, Number(p.decimales) || 0), distractores: [], opcionesAMostrar: 1
      }, 1);
      return g.explicacion;
    } catch (e) {
      return null;
    }
  }

  /* La vista previa sustituye cada variable por un valor del rango (el del
     medio, ajustado al paso) y enseña las fórmulas. No las evalúa. */
  function valorEjemplo(x) {
    var min = Number(x.min), max = Number(x.max), paso = Number(x.paso) > 0 ? Number(x.paso) : 1;
    if (isNaN(min) || isNaN(max) || max < min) return null;
    var medio = min + Math.floor(((max - min) / paso) / 2) * paso;
    var dec = Math.max(0, Math.min(4, Number(x.decimales) || 0));
    return Number(medio.toFixed(dec));
  }

  function pintarPrevia() {
    capturarPregunta();
    var p = pBorrador, salida = porId('previa-salida');
    limpiar(salida);
    var valores = {};
    var huecos = false;
    p.variables.forEach(function (x) {
      if (!x.nombre) return;
      var v = valorEjemplo(x);
      if (v === null) huecos = true; else valores[x.nombre] = v;
    });
    var enun = (p.enunciado || '').replace(/\{(\w+)\}/g, function (m, n) {
      return Object.prototype.hasOwnProperty.call(valores, n) ? String(valores[n]) : m;
    });
    var dl = el('dl');
    dl.appendChild(el('dt', null, 'La pregunta'));
    dl.appendChild(el('dd', null, enun || '(todavía no la escribes)'));
    dl.appendChild(el('dt', null, 'Valores de ejemplo'));
    var nombres = Object.keys(valores);
    dl.appendChild(el('dd', null, nombres.length
      ? nombres.map(function (n) { return n + ' = ' + valores[n]; }).join(', ')
      : 'Ponle nombre y rango a una variable.'));
    dl.appendChild(el('dt', null, 'Lo que se le muestra si falla'));
    var de = el('dd');
    var ex = explicacionDeEjemplo(p, valores);
    if (ex) {
      [['Fórmula', ex.formula], ['Con los números', ex.sustitucion], ['Resultado', ex.resultado]].forEach(function (par) {
        var linea = el('p', 'tst-explica-linea');
        linea.appendChild(el('strong', null, par[0] + ': '));
        linea.appendChild(el('span', 'tst-codigo', par[1]));
        de.appendChild(linea);
      });
    } else {
      de.appendChild(document.createTextNode(p.formula && p.formula.trim()
        ? '(Revisa la fórmula: con estos valores no se puede calcular.)'
        : '(Todavía no hay fórmula.)'));
    }
    dl.appendChild(de);
    dl.appendChild(el('dt', null, 'Respuestas incorrectas posibles'));
    var dd = el('dd');
    var ul = el('ul');
    p.distractores.forEach(function (d) {
      var li = el('li');
      li.appendChild(el('span', 'tst-codigo', d.formula || '(sin fórmula)'));
      li.appendChild(document.createTextNode(' — error ' + (d.clase === 'calculo' ? 'de cálculo' : 'de concepto')));
      ul.appendChild(li);
    });
    dd.appendChild(ul);
    dl.appendChild(dd);
    salida.appendChild(dl);
    if (huecos) salida.appendChild(el('p', 'ayuda', 'Hay una variable con el mínimo mayor que el máximo.'));
  }

  /* ------------------------------------------------ validar y guardar */

  function validarPregunta(p) {
    var e = {};
    if (!p.enunciado.trim()) e['f-enunciado'] = 'Falta escribir la pregunta.';
    if (p.tipo === 'estatica') {
      var llenas = 0;
      p.opciones.forEach(function (o, i) {
        if (!o.texto.trim()) e['f-opcion-' + i] = 'Falta escribir la respuesta ' + String.fromCharCode(65 + i) + '.';
        else llenas++;
      });
      if (!p.correcta) e['f-correcta-error'] = 'Marca cuál es la respuesta correcta.';
      if (p.pasaje.trim() && p.fraseClave.trim() && p.pasaje.indexOf(p.fraseClave.trim()) < 0) {
        e['f-frase'] = 'La frase no aparece igual en el texto. Cópiala tal cual.';
      }
      return e;
    }
    var nombres = {};
    p.variables.forEach(function (x, i) {
      var base = 'f-var-' + i + '-';
      if (!x.nombre) e[base + 'nombre'] = 'Falta el nombre de la variable.';
      else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(x.nombre)) e[base + 'nombre'] = 'El nombre solo puede llevar letras, números y _, y no empezar con un número.';
      else if (x.nombre === 'resultado') e[base + 'nombre'] = '«resultado» está reservado. Elige otro nombre.';
      else if (nombres[x.nombre]) e[base + 'nombre'] = 'Ese nombre ya lo usa otra variable.';
      else nombres[x.nombre] = true;
      if (x.min === '' || isNaN(Number(x.min))) e[base + 'min'] = 'Falta el mínimo.';
      if (x.max === '' || isNaN(Number(x.max))) e[base + 'max'] = 'Falta el máximo.';
      if (!e[base + 'min'] && !e[base + 'max'] && Number(x.min) >= Number(x.max)) e[base + 'max'] = 'El máximo tiene que ser mayor que el mínimo.';
      if (!(Number(x.paso) > 0)) e[base + 'paso'] = 'El paso tiene que ser mayor que 0.';
      if (x.decimales === '' || Number(x.decimales) < 0 || Number(x.decimales) > 4) e[base + 'dec'] = 'Los decimales van de 0 a 4.';
    });
    var usadas = (p.enunciado.match(/\{(\w+)\}/g) || []).map(function (s) { return s.slice(1, -1); });
    usadas.forEach(function (n) {
      if (!nombres[n] && !e['f-enunciado']) e['f-enunciado'] = 'La pregunta usa {' + n + '}, que no es una variable.';
    });
    function revisarFormula(id, texto, vacio) {
      if (!texto.trim()) { e[id] = vacio; return; }
      var ident = texto.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
      for (var k = 0; k < ident.length; k++) {
        if (!nombres[ident[k]] && FUNCIONES.indexOf(ident[k]) < 0) {
          e[id] = 'La fórmula usa «' + ident[k] + '», que no es una variable.';
          return;
        }
      }
      if (/[^0-9A-Za-z_+\-*/().,\s]/.test(texto)) e[id] = 'La fórmula tiene un signo que no se entiende. Usa + - * / y paréntesis.';
    }
    revisarFormula('f-formula', p.formula, 'Falta la fórmula del resultado.');
    if (p.decimales === '' || Number(p.decimales) < 0 || Number(p.decimales) > 4) e['f-decimales'] = 'Los decimales van de 0 a 4.';
    p.distractores.forEach(function (d, i) {
      revisarFormula('f-dis-' + i + '-formula', d.formula, 'Falta la fórmula de esta respuesta.');
      if (!e['f-dis-' + i + '-formula'] && d.formula.replace(/\s+/g, '') === p.formula.replace(/\s+/g, '')) {
        e['f-dis-' + i + '-formula'] = 'Es la misma fórmula que la correcta.';
      }
    });
    if (p.distractores.length < p.opcionesAMostrar - 1 && !e['f-cuantas']) {
      e['f-cuantas'] = 'Para mostrar ' + p.opcionesAMostrar + ' respuestas hacen falta por lo menos ' +
        (p.opcionesAMostrar - 1) + ' incorrectas.';
    }
    return e;
  }

  function guardarPregunta() {
    capturarPregunta();
    var errores = validarPregunta(pBorrador);
    if (mostrarErrores(errores, 'Hay cosas por arreglar antes de guardar')) return;
    var p = copia(pBorrador);
    if (p.tipo === 'dinamica') {
      p.variables.forEach(function (x) {
        x.min = Number(x.min); x.max = Number(x.max); x.paso = Number(x.paso); x.decimales = Number(x.decimales);
      });
      p.decimales = Number(p.decimales);
      /* Las preguntas guardadas antes traian pasos, un "dónde se va el valor" y una
         nota en cada error típico: ya no se usan, y al guardar se quitan. */
      delete p.pasos;
      p.distractores = p.distractores.map(function (d) { return { formula: d.formula, clase: d.clase }; });
    }
    if (pIndice >= 0) borrador.preguntas[pIndice] = p; else borrador.preguntas.push(p);
    var lugar = pIndice >= 0 ? pIndice + 1 : borrador.preguntas.length;
    renderTest();
    sucio = true;
    decir('Se guardó la pregunta ' + lugar + '. Falta guardar el test.');
  }

  /* Muestra el resumen de errores arriba, con enlaces a cada campo, y el
     mensaje junto a cada campo con su icono. Devuelve true si había errores. */
  function mostrarErrores(errores, titulo) {
    var viejos = document.querySelectorAll('.tst-resumen');
    for (var v = 0; v < viejos.length; v++) viejos[v].parentNode.removeChild(viejos[v]);
    var marcados = document.querySelectorAll('[aria-invalid="true"]');
    for (var m = 0; m < marcados.length; m++) marcados[m].removeAttribute('aria-invalid');
    var visibles = document.querySelectorAll('.tst-error');
    for (var w = 0; w < visibles.length; w++) { visibles[w].hidden = true; limpiar(visibles[w]); }

    var ids = Object.keys(errores);
    if (!ids.length) return false;

    ids.forEach(function (id) {
      var campoEl = porId(id);
      var msg = id.slice(-6) === '-error' || id === 'error-preguntas' ? porId(id) : porId(id + '-error');
      if (campoEl && campoEl.tagName !== 'P') campoEl.setAttribute('aria-invalid', 'true');
      if (msg) {
        msg.hidden = false;
        limpiar(msg);
        msg.insertAdjacentHTML('afterbegin', icono('aviso'));
        msg.appendChild(document.createTextNode('Falta o está mal: ' + errores[id]));
      }
    });

    var res = el('div', 'tst-resumen');
    res.tabIndex = -1;
    res.setAttribute('role', 'alert');
    res.appendChild(el('h3', null, titulo + ' (' + ids.length + ')'));
    var ul = el('ul');
    ids.forEach(function (id) {
      var li = el('li');
      var a = el('a', null, errores[id]);
      a.href = '#' + id;
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var destino = porId(id === 'f-correcta-error' ? 'f-correcta-0' : id);
        if (destino && destino.focus) destino.focus();
        else if (destino) destino.scrollIntoView();
      });
      li.appendChild(a);
      ul.appendChild(li);
    });
    res.appendChild(ul);
    var sec = raiz.vistas.firstChild;
    sec.insertBefore(res, sec.children[1]);
    res.focus();
    return true;
  }

  /* ------------------------------------------------------------ arranque */

  function iniciar() {
    raiz = { vistas: document.getElementById('vistas') };
    rutaEl = document.getElementById('ruta');
    estadoEl = document.getElementById('estado');
    if (!raiz.vistas || !window.RetoDialogo || !Muestra || !Lista || !Banco) return;

    var ajustes = window.RetoTestsAjustes;
    if (ajustes) {
      ajustes.iniciar({
        resolver: false,
        alCambiar: function () { if (vista === 'banco') repintarLista(); }
      });
      /* En el banco, los ajustes son los de la LISTA (cómo se ven y se ordenan
         los tests); al editar un test o una pregunta, los de lectura. */
      var cfg = document.querySelector('[data-configurar]');
      if (cfg) cfg.addEventListener('click', function () { ajustes.abrir(vista === 'banco' ? 'lista' : 'general'); });
    }
    var ayuda = document.querySelector('[data-ayuda]');
    if (ayuda) {
      ayuda.addEventListener('click', function () {
        window.RetoDialogo.informar({
          titulo: 'Cómo se usa esta pantalla',
          texto: 'Aquí guardas tus tests. Hay dos clases de pregunta.\n\n' +
            'Las fijas llevan las respuestas escritas y no cambian.\n\n' +
            'Las de números que cambian llevan una fórmula: cada vez que salen, la aplicación ' +
            'elige otros números y arma otras respuestas. Para cada respuesta incorrecta dices de qué ' +
            'clase de error es. Si alguien falla, se le muestra la fórmula, la fórmula con sus números ' +
            'y el resultado: se arma sola.\n\n' +
            'Para ordenar las preguntas usa "Subir" y "Bajar". Todo se guarda en este navegador ' +
            'y entra en el respaldo de datos que haces desde Configuración.'
        });
      });
    }
    Banco.cargar().then(function (lista) {
      tests = lista;
      renderBanco();
    }, function (e) {
      renderBanco();
      falloAlGuardar(e);
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
