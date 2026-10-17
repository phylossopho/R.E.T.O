/* =========================================================================
   R.E.T.O. - Generador de prompts (la pantalla)

   QUÉ ES
   Una pantalla con campos de texto (tema, materia, unidad, capítulo, saga,
   arco, fórmulas, público…) que arma un prompt listo para pegar en un asistente
   de IA, para que devuelva libros, textos o tests YA en el formato de marcado
   de R.E.T.O. Después se guarda la respuesta en un archivo .txt y se importa
   con las herramientas que ya existen.

   UN MOTOR, DOS PANTALLAS
   El mismo script sirve a las dos pantallas, y lo único que cambia es el atributo
   data-prompts de la página:
     data-prompts="biblioteca"  Libro y Texto corto      (categorias/biblioteca/prompts/)
     data-prompts="tests"       Test fijo y Test dinámico (categorias/test-conocimientos/prompts/)
   Son dos pantallas separadas, una en cada categoría, A PROPÓSITO: quien está
   creando un libro no tiene por qué ver los campos de un test, y viceversa. Se
   evita la confusión de una sola pantalla con campos que unas veces valen y
   otras no.

   LO QUE NO HACE, Y POR QUÉ
   No revisa lo que conteste la IA: de eso se encargan los importadores (de
   Biblioteca y del banco de tests), que ya dicen qué falla y en qué línea. Aquí
   solo se revisa lo que la persona ESCRIBE (que no falte lo obligatorio y que
   las fórmulas y variables se puedan usar), porque un prompt armado con una
   fórmula rota produce una pregunta rota que nadie notaría hasta importarla.

   DECISIONES (y por qué)
   - EL PROMPT SE VE MIENTRAS SE ESCRIBE. Cambia al instante con cada tecla:
     así se ve qué efecto tiene cada campo y se puede corregir antes de copiar.
   - NO SE PIERDE LO ESCRITO. Se recuerda en el dispositivo (se puede apagar en
     los ajustes): armar un prompt largo para volver a empezar de cero es el tipo
     de cosa que hace abandonar.
   - COPIAR CON UN CLIC, y también descargar como archivo, para quien su
     asistente de IA está en otro aparato.
   - UN ERROR DETIENE EL COPIADO Y SE EXPLICA JUNTO AL BOTÓN: el botón sigue
     siendo alcanzable (no se deshabilita del todo) y dice qué falta. Un aviso
     solo informa.
   - NINGÚN ESTADO DEPENDE SOLO DEL COLOR: errores y avisos llevan su palabra.
   ========================================================================= */
(function () {
  'use strict';

  var Logica = window.RetoPromptsLogica;
  var Datos = window.RetoDatos;
  var Dialogo = window.RetoDialogo;

  var PREFIJO = 'prompts-';

  var MODOS = {
    biblioteca: {
      titulo: 'Crea un libro o un texto con ayuda de una IA',
      intro: 'Llena los campos, copia el prompt y pégalo en tu asistente de IA. Te devolverá el contenido ya en el formato de R.E.T.O.',
      tipos: [
        ['libro', 'Libro', 'Con niveles y varias lecturas, para leer y estudiar.'],
        ['texto', 'Texto corto', 'Un solo texto de 2 a 3 minutos.']
      ],
      despues: 'Cuando el asistente te responda, copia su bloque de texto, guárdalo en un archivo .txt y súbelo en Importar.',
      destino: { href: '../importar/importar.html', texto: 'Ir a Importar' }
    },
    tests: {
      titulo: 'Crea un test con ayuda de una IA',
      intro: 'Llena los campos, copia el prompt y pégalo en tu asistente de IA. Te devolverá el test ya en el formato de R.E.T.O.',
      tipos: [
        ['test-fijo', 'Test fijo', 'Preguntas de opción múltiple con una respuesta correcta.'],
        ['test-dinamico', 'Test dinámico', 'Preguntas con números que cambian cada vez.']
      ],
      despues: 'Cuando el asistente te responda, copia su bloque de texto, guárdalo en un archivo .txt y súbelo con "Importar" en Gestionar banco de tests.',
      destino: { href: '../crud-tests/crud-tests.html', texto: 'Ir a Gestionar banco de tests' }
    }
  };

  var FABRICA_AJ = { ejemplo: 'on', recordar: 'on', vista: 'on' };

  var modo = null;
  var config = null;
  var tipo = null;
  var valores = {};            // { tipo: { campo: valor } }
  var aj = {};
  var raiz, estadoEl;
  var guardarId = null;
  var actualizarId = null;
  var dlgAjustes = null;

  /* ---------------------------------------------------------- utilidades */

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function limpiar(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function decir(t) { if (estadoEl) estadoEl.textContent = t || ''; }

  function boton(texto, clase, alClick) {
    var b = el('button', 'boton ' + (clase || ''), texto);
    b.type = 'button';
    if (alClick) b.addEventListener('click', alClick);
    return b;
  }

  function actuales() { return valores[tipo]; }

  function nombreDelTipo() {
    for (var i = 0; i < config.tipos.length; i++) if (config.tipos[i][0] === tipo) return config.tipos[i][1];
    return '';
  }

  /* ----------------------------------------------------------- recordar */

  function cargar() {
    var claves = [PREFIJO + 'tipo-' + modo];
    config.tipos.forEach(function (t) { claves.push(PREFIJO + t[0]); });
    Object.keys(FABRICA_AJ).forEach(function (k) { claves.push(PREFIJO + 'aj-' + k); });
    return Promise.all(claves.map(function (c) { return Datos.obtener(c); })).then(function (r) {
      Object.keys(FABRICA_AJ).forEach(function (k, i) {
        var v = r[1 + config.tipos.length + i];
        aj[k] = (v === null || v === undefined) ? FABRICA_AJ[k] : String(v);
      });
      config.tipos.forEach(function (t, i) {
        var base = Logica.valoresIniciales(t[0]);
        var guardado = null;
        if (aj.recordar === 'on' && r[1 + i]) {
          try { guardado = JSON.parse(r[1 + i]); } catch (e) { guardado = null; }
        }
        valores[t[0]] = Object.assign(base, guardado && typeof guardado === 'object' ? guardado : {});
      });
      var ultimo = r[0];
      tipo = config.tipos.some(function (t) { return t[0] === ultimo; }) ? ultimo : config.tipos[0][0];
    });
  }

  function guardarAjuste(clave, valor) {
    aj[clave] = valor;
    return Datos.poner(PREFIJO + 'aj-' + clave, valor);
  }

  /* Se guarda sin prisa: con cada tecla serían decenas de escrituras. */
  function programarGuardado() {
    if (aj.recordar !== 'on') return;
    if (guardarId !== null) window.clearTimeout(guardarId);
    guardarId = window.setTimeout(function () {
      guardarId = null;
      Datos.poner(PREFIJO + tipo, JSON.stringify(valores[tipo]));
    }, 400);
  }

  /* ============================================================ LA PANTALLA */

  function pintar(enfocarId) {
    limpiar(raiz);
    var sec = el('section', 'editor pr-pantalla');
    raiz.appendChild(sec);

    var h = el('h2', null, config.titulo);
    h.tabIndex = -1;
    sec.appendChild(h);
    sec.appendChild(el('p', 'ayuda', config.intro));

    sec.appendChild(pintarTipos());
    sec.appendChild(pintarFormulario());
    sec.appendChild(pintarSalida());

    actualizarSalida();
    if (enfocarId) {
      var e = document.getElementById(enfocarId);
      if (e) e.focus();
    }
  }

  function pintarTipos() {
    var cont = el('fieldset', 'pr-tipos');
    cont.appendChild(el('legend', null, 'Qué quieres crear'));
    config.tipos.forEach(function (t) {
      var lab = el('label', 'pr-tipo');
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'pr-tipo';
      radio.value = t[0];
      radio.checked = t[0] === tipo;
      radio.addEventListener('change', function () {
        if (!this.checked) return;
        tipo = t[0];
        Datos.poner(PREFIJO + 'tipo-' + modo, tipo);
        pintar('pr-tipo-' + t[0]);
        decir(t[1] + ': ' + t[2]);
      });
      radio.id = 'pr-tipo-' + t[0];
      lab.appendChild(radio);
      var txt = el('span', 'pr-tipo-texto');
      txt.appendChild(el('strong', null, t[1]));
      txt.appendChild(el('span', 'ayuda', t[2]));
      lab.appendChild(txt);
      cont.appendChild(lab);
    });
    return cont;
  }

  /* ------------------------------------------------------------- campos */

  function pintarFormulario() {
    var form = el('form', 'pr-form');
    form.setAttribute('novalidate', 'novalidate');
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });

    var campos = Logica.campos(tipo, actuales());
    var grupos = [];
    var porGrupo = {};
    campos.forEach(function (c) {
      if (!porGrupo[c.grupo]) { porGrupo[c.grupo] = []; grupos.push(c.grupo); }
      porGrupo[c.grupo].push(c);
    });
    grupos.forEach(function (g) {
      var fs = el('fieldset', 'pr-grupo');
      fs.appendChild(el('legend', null, g));
      porGrupo[g].forEach(function (c) { fs.appendChild(pintarCampo(c)); });
      form.appendChild(fs);
    });
    return form;
  }

  function etiquetaDe(c) {
    var lab = el('label', 'editor-label');
    lab.setAttribute('for', 'pr-' + c.id);
    lab.appendChild(document.createTextNode(c.etiqueta));
    if (c.requerido) lab.appendChild(el('span', 'pr-obl', 'obligatorio'));
    return lab;
  }

  function cambio(c, valor) {
    actuales()[c.id] = valor;
    programarGuardado();
    programarSalida();
  }

  function pintarCampo(c) {
    var v = actuales();
    var caja = el('div', 'pr-campo');
    caja.setAttribute('data-campo', c.id);
    var ayudaId = 'pr-' + c.id + '-ayuda';

    if (c.control === 'switch') {
      caja.appendChild(pintarInterruptor(c, ayudaId));
      return caja;
    }

    caja.appendChild(etiquetaDe(c));
    if (c.ayuda) {
      var ay = el('p', 'ayuda pr-ayuda', c.ayuda);
      ay.id = ayudaId;
      caja.appendChild(ay);
    }

    if (c.control === 'filas') { caja.appendChild(pintarFilas(c)); return caja; }

    var ctl;
    if (c.control === 'select') {
      ctl = document.createElement('select');
      ctl.className = 'editor-campo';
      c.opciones.forEach(function (op) {
        var o = el('option', null, op[1]);
        o.value = op[0];
        if (String(v[c.id]) === op[0]) o.selected = true;
        ctl.appendChild(o);
      });
      ctl.addEventListener('change', function () {
        cambio(c, this.value);
        /* El tipo de contenido cambia lo que dicen las etiquetas de los niveles:
           se vuelve a dibujar el formulario. */
        if (c.id === 'obra') pintar('pr-obra');
      });
    } else if (c.control === 'area') {
      ctl = document.createElement('textarea');
      ctl.className = 'editor-campo pr-area';
      ctl.rows = 3;
      ctl.value = v[c.id] || '';
      ctl.addEventListener('input', function () { cambio(c, this.value); });
    } else if (c.control === 'numero') {
      ctl = document.createElement('input');
      ctl.type = 'number';
      ctl.className = 'editor-campo pr-numero';
      ctl.setAttribute('inputmode', 'numeric');
      if (c.min !== undefined) ctl.min = c.min;
      if (c.max !== undefined) ctl.max = c.max;
      ctl.step = '1';
      ctl.value = v[c.id] === undefined ? '' : v[c.id];
      ctl.addEventListener('input', function () { cambio(c, this.value); });
    } else {
      ctl = document.createElement('input');
      ctl.type = 'text';
      ctl.className = 'editor-campo';
      ctl.value = v[c.id] || '';
      ctl.addEventListener('input', function () { cambio(c, this.value); });
    }
    ctl.id = 'pr-' + c.id;
    if (c.ayuda) ctl.setAttribute('aria-describedby', ayudaId);
    if (c.requerido) ctl.setAttribute('aria-required', 'true');
    if (c.ejemplo && c.control !== 'select' && c.control !== 'numero') ctl.placeholder = 'Ej.: ' + c.ejemplo;
    caja.appendChild(ctl);

    if (c.id === 'publico') caja.appendChild(pintarEjemplosPublico(ctl, c));
    return caja;
  }

  /* El campo de público es de texto libre. Estos botones solo evitan empezar de
     cero: ponen un ejemplo en el campo, que luego se edita. */
  function pintarEjemplosPublico(campo, c) {
    var cont = el('div', 'pr-ejemplos');
    cont.setAttribute('role', 'group');
    cont.setAttribute('aria-label', 'Ejemplos de público');
    cont.appendChild(el('span', 'pr-ejemplos-titulo', 'Usar un ejemplo:'));
    Logica.PUBLICOS.forEach(function (p) {
      var b = boton(p.nombre, 'boton--chico', function () {
        campo.value = p.texto;
        cambio(c, p.texto);
        campo.focus();
        decir('Público: ' + p.nombre + '. Puedes editar el texto.');
      });
      cont.appendChild(b);
    });
    return cont;
  }

  function pintarInterruptor(c, ayudaId) {
    var v = actuales();
    var label = el('label', 'interruptor');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'pr-' + c.id;
    input.checked = v[c.id] === 'on';
    if (c.ayuda) input.setAttribute('aria-describedby', ayudaId);
    var caja = el('span', 'interruptor-caja');
    caja.setAttribute('aria-hidden', 'true');
    var rotulo = el('span', 'interruptor-texto', c.etiqueta);
    if (c.ayuda) {
      var ay = el('span', 'ayuda', c.ayuda);
      ay.id = ayudaId;
      rotulo.appendChild(ay);
    }
    input.addEventListener('change', function () { cambio(c, this.checked ? 'on' : 'off'); });
    label.appendChild(input);
    label.appendChild(caja);
    label.appendChild(rotulo);
    return label;
  }

  /* Las filas repetibles (variables, errores típicos, pasos). Cada fila es un
     grupo con sus campos rotulados, y se puede agregar o quitar. */
  function pintarFilas(c) {
    var v = actuales();
    if (!Array.isArray(v[c.id])) v[c.id] = [];
    var lista = v[c.id];
    var cont = el('div', 'pr-filas');
    var nombreFila = c.etiqueta.replace(/\s*\[.*?\]\s*$/, '').replace(/\s*\(.*\)\s*$/, '');

    lista.forEach(function (fila, i) {
      var g = el('div', 'pr-fila');
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', nombreFila + ' ' + (i + 1));
      g.style.setProperty('--cols', String(c.columnas.length));
      c.columnas.forEach(function (col) {
        var celda = el('label', 'pr-celda');
        celda.appendChild(el('span', null, col.etiqueta));
        var ctl;
        if (col.opciones) {
          ctl = document.createElement('select');
          col.opciones.forEach(function (op) {
            var o = el('option', null, op[1]);
            o.value = op[0];
            if ((fila[col.id] || col.opciones[0][0]) === op[0]) o.selected = true;
            ctl.appendChild(o);
          });
          if (fila[col.id] === undefined) fila[col.id] = col.opciones[0][0];
        } else {
          ctl = document.createElement('input');
          ctl.type = 'text';
          if (col.numero) ctl.setAttribute('inputmode', 'decimal');
          ctl.value = fila[col.id] === undefined ? '' : fila[col.id];
          if (col.ejemplo) ctl.placeholder = col.ejemplo;
        }
        ctl.className = 'editor-campo';
        ctl.id = 'pr-' + c.id + '-' + i + '-' + col.id;
        ctl.addEventListener(col.opciones ? 'change' : 'input', function () {
          fila[col.id] = this.value;
          programarGuardado();
          programarSalida();
        });
        celda.appendChild(ctl);
        g.appendChild(celda);
      });
      var quitar = boton('Quitar', 'boton--chico pr-quitar', function () {
        lista.splice(i, 1);
        programarGuardado();
        pintar('pr-' + c.id + '-agregar');
        decir(nombreFila + ' ' + (i + 1) + ' quitada.');
      });
      quitar.setAttribute('aria-label', 'Quitar ' + nombreFila.toLowerCase() + ' ' + (i + 1));
      g.appendChild(quitar);
      cont.appendChild(g);
    });

    var agregar = boton(lista.length ? 'Agregar otra' : 'Agregar', 'boton--chico', function () {
      var nueva = {};
      c.columnas.forEach(function (col) { if (col.opciones) nueva[col.id] = col.opciones[0][0]; });
      lista.push(nueva);
      programarGuardado();
      pintar('pr-' + c.id + '-' + (lista.length - 1) + '-' + c.columnas[0].id);
      decir(nombreFila + ' ' + lista.length + ' agregada.');
    });
    agregar.id = 'pr-' + c.id + '-agregar';
    if (lista.length >= c.max) {
      agregar.disabled = true;
      agregar.title = 'Máximo ' + c.max;
    }
    cont.appendChild(agregar);
    return cont;
  }

  /* ------------------------------------------------------------- salida */

  function pintarSalida() {
    var sec = el('section', 'pr-salida');
    sec.id = 'pr-salida';
    sec.appendChild(el('h3', null, 'Tu prompt'));

    var problemas = el('div', 'pr-problemas');
    problemas.id = 'pr-problemas';
    sec.appendChild(problemas);

    var acciones = el('div', 'pr-acciones');
    var copiar = boton('Copiar el prompt', 'boton--principal', copiarPrompt);
    copiar.id = 'pr-copiar';
    acciones.appendChild(copiar);
    var bajar = boton('Descargar como archivo .txt', '', descargarPrompt);
    bajar.id = 'pr-descargar';
    acciones.appendChild(bajar);
    acciones.appendChild(boton('Limpiar los campos', '', limpiarCampos));
    sec.appendChild(acciones);

    var razon = el('p', 'pr-razon');
    razon.id = 'pr-razon';
    sec.appendChild(razon);

    var det = document.createElement('details');
    det.className = 'pr-vista';
    det.id = 'pr-vista';
    if (aj.vista !== 'off') det.open = true;
    det.appendChild(el('summary', null, 'Vista previa del prompt'));
    var area = document.createElement('textarea');
    area.className = 'editor-campo pr-prompt';
    area.id = 'pr-prompt';
    area.readOnly = true;
    area.rows = 16;
    area.setAttribute('aria-label', 'Prompt generado');
    det.appendChild(area);
    var cuenta = el('p', 'ayuda pr-cuenta');
    cuenta.id = 'pr-cuenta';
    det.appendChild(cuenta);
    sec.appendChild(det);

    var sigue = el('div', 'pr-sigue');
    sigue.appendChild(el('h3', null, 'Qué sigue'));
    sigue.appendChild(el('p', null, config.despues));
    var a = el('a', 'boton', config.destino.texto);
    a.href = config.destino.href;
    sigue.appendChild(a);
    sec.appendChild(sigue);
    return sec;
  }

  function textoDelPrompt() {
    return Logica.armarPrompt(tipo, actuales(), { ejemplo: aj.ejemplo !== 'off' });
  }

  /* Se vuelve a calcular con una pausa corta (con cada tecla sería demasiado). */
  function programarSalida() {
    if (actualizarId !== null) window.clearTimeout(actualizarId);
    actualizarId = window.setTimeout(function () { actualizarId = null; actualizarSalida(); }, 120);
  }

  function actualizarSalida() {
    var area = document.getElementById('pr-prompt');
    if (!area) return;
    var texto = textoDelPrompt();
    area.value = texto;
    var palabras = texto.split(/\s+/).filter(Boolean).length;
    document.getElementById('pr-cuenta').textContent = texto.length + ' caracteres, cerca de ' + palabras + ' palabras.';

    var lista = Logica.validar(tipo, actuales());
    var errores = lista.filter(function (p) { return p.tipo === 'error'; });
    var caja = document.getElementById('pr-problemas');
    limpiar(caja);
    if (lista.length) {
      var ul = el('ul', 'problemas');
      lista.forEach(function (p) {
        var li = el('li', 'problema' + (p.tipo === 'error' ? ' es-error' : ''));
        li.appendChild(el('span', 'problema-marca', p.tipo === 'error' ? '\u2715 Error' : '! Aviso'));
        li.appendChild(el('p', 'problema-texto', p.texto));
        ul.appendChild(li);
      });
      caja.appendChild(el('p', 'problema-titulo', errores.length
        ? 'Arregla esto antes de copiar el prompt'
        : 'Ten en cuenta'));
      caja.appendChild(ul);
    }

    var razon = document.getElementById('pr-razon');
    var bloqueado = errores.length > 0;
    razon.textContent = bloqueado
      ? 'Para copiar o descargar el prompt, corrige ' + (errores.length === 1 ? 'el error' : 'los ' + errores.length + ' errores') + ' de arriba.'
      : '';
    ['pr-copiar', 'pr-descargar'].forEach(function (id) {
      var b = document.getElementById(id);
      if (!b) return;
      if (bloqueado) { b.setAttribute('aria-disabled', 'true'); b.setAttribute('aria-describedby', 'pr-razon'); }
      else { b.removeAttribute('aria-disabled'); b.removeAttribute('aria-describedby'); }
    });
  }

  function hayErrores() {
    return Logica.validar(tipo, actuales()).some(function (p) { return p.tipo === 'error'; });
  }

  function negarPorErrores() {
    actualizarSalida();
    var caja = document.getElementById('pr-problemas');
    decir('No se puede copiar todavía: ' + (document.getElementById('pr-razon').textContent || 'hay errores.'));
    if (caja && caja.scrollIntoView) caja.scrollIntoView({ block: 'center' });
  }

  function copiarPrompt() {
    if (hayErrores()) { negarPorErrores(); return; }
    var texto = textoDelPrompt();
    var listo = function () { decir('Prompt copiado. Pégalo en tu asistente de IA.'); };
    var respaldo = function () {
      var area = document.getElementById('pr-prompt');
      var abierto = document.getElementById('pr-vista');
      var estaba = abierto.open;
      abierto.open = true;
      area.focus();
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      abierto.open = estaba;
      decir(ok ? 'Prompt copiado. Pégalo en tu asistente de IA.'
        : 'No se pudo copiar solo. El prompt está seleccionado: cópialo con Ctrl+C (o Cmd+C).');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(listo, respaldo);
    } else {
      respaldo();
    }
  }

  function nombreArchivo() {
    var base = String(actuales().titulo || '').trim().toLowerCase();
    if (base.normalize) base = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    base = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return 'prompt-' + tipo + (base ? '-' + base : '') + '.txt';
  }

  function descargarPrompt() {
    if (hayErrores()) { negarPorErrores(); return; }
    var blob = new Blob([textoDelPrompt()], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    decir('Archivo descargado: ' + a.download);
  }

  function limpiarCampos() {
    Dialogo.preguntar({
      titulo: 'Limpiar los campos',
      texto: 'Se borra lo que escribiste en "' + nombreDelTipo() + '". ¿Seguro?',
      ok: 'Sí, limpiar',
      cancelar: 'No, conservar'
    }).then(function (si) {
      if (!si) return;
      var obra = actuales().obra;
      valores[tipo] = Logica.valoresIniciales(tipo);
      valores[tipo].obra = obra;
      programarGuardado();
      pintar('pr-tipo-' + tipo);
      decir('Campos limpios.');
    });
  }

  /* ==================================================== MODAL DE AJUSTES */

  function interruptor(clave, texto, explicacion, alCambiar) {
    var label = el('label', 'interruptor');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = aj[clave] === 'on';
    var caja = el('span', 'interruptor-caja');
    caja.setAttribute('aria-hidden', 'true');
    var rotulo = el('span', 'interruptor-texto', texto);
    rotulo.appendChild(el('span', 'ayuda', explicacion));
    input.addEventListener('change', function () {
      var v = this.checked ? 'on' : 'off';
      guardarAjuste(clave, v).then(function () { if (alCambiar) alCambiar(v); });
    });
    label.appendChild(input);
    label.appendChild(caja);
    label.appendChild(rotulo);
    return label;
  }

  function grupo(dlg, legenda, ayuda) {
    var fs = document.createElement('fieldset');
    fs.appendChild(el('legend', null, legenda));
    if (ayuda) fs.appendChild(el('p', 'ayuda', ayuda));
    dlg.appendChild(fs);
    return fs;
  }

  function abrirAjustes() {
    if (dlgAjustes) return;
    var dlg = document.createElement('dialog');
    dlg.className = 'dialogo pr-config';
    dlg.setAttribute('aria-labelledby', 'pr-cfg-titulo');
    dlgAjustes = dlg;

    var titulo = el('h2', 'dialogo-titulo', 'Ajustes del generador de prompts');
    titulo.id = 'pr-cfg-titulo';
    dlg.appendChild(titulo);

    var gP = grupo(dlg, 'El prompt');
    gP.appendChild(interruptor('ejemplo', 'Incluir el ejemplo del formato',
      'Con el ejemplo, la IA imita mejor la forma de las marcas y se equivoca menos. Sin él, el prompt es más corto: sirve para asistentes que aceptan poco texto.',
      function () { actualizarSalida(); }));

    var gV = grupo(dlg, 'Vista previa');
    gV.appendChild(interruptor('vista', 'Mostrar la vista previa abierta',
      'Muestra el prompt completo debajo de los botones mientras escribes. Apagada, queda plegada y se abre cuando quieras.',
      function (v) { var d = document.getElementById('pr-vista'); if (d) d.open = v === 'on'; }));

    var gR = grupo(dlg, 'Lo que escribes',
      'Lo escrito se guarda solo en este dispositivo, para que no se pierda al cerrar la pantalla.');
    gR.appendChild(interruptor('recordar', 'Recordar lo que escribo',
      'Apagado, cada vez empiezas con los campos vacíos.'));
    gR.appendChild(boton('Borrar lo que se recordó', 'boton--chico', function () {
      Dialogo.preguntar({
        titulo: 'Borrar lo recordado',
        texto: 'Se borra lo que escribiste y se recordó, en todos los tipos de esta pantalla. ¿Seguro?',
        ok: 'Sí, borrar',
        cancelar: 'No, conservar'
      }).then(function (si) {
        if (!si) return;
        config.tipos.forEach(function (t) {
          valores[t[0]] = Logica.valoresIniciales(t[0]);
          Datos.poner(PREFIJO + t[0], '');
        });
        if (dlgAjustes) dlgAjustes.close();
        pintar('pr-tipo-' + tipo);
        decir('Se borró lo que estaba recordado.');
      });
    }));

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
    var main = document.querySelector('main[data-prompts]');
    if (!main || !Logica || !Datos || !Dialogo) return;
    modo = main.getAttribute('data-prompts');
    config = MODOS[modo];
    if (!config) return;
    raiz = document.getElementById('vistas');
    estadoEl = document.getElementById('estado');

    var cfg = document.querySelector('[data-configurar]');
    if (cfg) cfg.addEventListener('click', abrirAjustes);

    var ayuda = document.querySelector('[data-ayuda]');
    if (ayuda) {
      ayuda.addEventListener('click', function () {
        Dialogo.informar({
          titulo: 'Cómo se usa',
          texto: 'Llena los campos (los obligatorios dicen "obligatorio"). Abajo verás el prompt cambiar mientras escribes.\n\n' +
            'Cuando esté listo, toca "Copiar el prompt" y pégalo en tu asistente de IA. Pídele que responda solo con el contenido.\n\n' +
            'Guarda la respuesta del asistente en un archivo .txt y súbela en la pantalla de importar. Si algo falla en el archivo, el importador te dice qué y en qué línea.\n\n' +
            'El tono del prompt siempre es neutro de aprendizaje. Lo que cambia es el público: dile a quién va dirigido y se ajusta el vocabulario, los ejemplos y la profundidad.\n\n' +
            'En los ajustes (la rueda) puedes quitar el ejemplo del formato, plegar la vista previa y decidir si se recuerda lo que escribes.'
        });
      });
    }

    cargar().then(function () { pintar(); }).catch(function (e) { decir(e && e.message ? e.message : 'No se pudo abrir la pantalla.'); });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
