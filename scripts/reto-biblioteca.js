/* =========================================================================
   R.E.T.O. - La biblioteca: lista, marcas, seleccion y busqueda
   ========================================================================= */
(function () {
  'use strict';

  var NOMBRES_MARCA = { '1': 'Azul', '2': 'Verde', '3': 'Rosa' };
  var CLAVE_ULTIMO = 'reto_biblioteca_ultimo';

  function crear(etiqueta, clase, texto) {
    var e = document.createElement(etiqueta);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function limpiar(e) {
    while (e.firstChild) e.removeChild(e.firstChild);
  }

  function fechaCorta(iso) {
    if (!iso) return '';
    var f = new Date(iso);
    if (isNaN(f.getTime())) return '';

    var hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    var dia = new Date(f);
    dia.setHours(0, 0, 0, 0);
    var dias = Math.round((hoy - dia) / 86400000);

    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    if (dias < 7) return 'hace ' + dias + ' días';
    if (dias < 30) { var s = Math.floor(dias / 7); return 'hace ' + s + (s === 1 ? ' semana' : ' semanas'); }

    var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var mes = MESES[f.getMonth()];
    if (f.getFullYear() !== hoy.getFullYear()) return f.getDate() + ' ' + mes + ' ' + f.getFullYear();
    return f.getDate() + ' ' + mes;
  }

  function rutas() {
    return {
      texto: document.body.getAttribute('data-ruta-texto') || '../revision/revision.html',
      importar: document.body.getAttribute('data-ruta-importar') || '../importar/importar.html'
    };
  }

  function unirId(destino, id) {
    return destino + (destino.indexOf('?') >= 0 ? '&' : '?') + 'id=' + encodeURIComponent(id);
  }

  function tarjeta(doc, destino) {
    var li = crear('li');
    var a = crear('a', 'tarjeta tarjeta-nav tarjeta-densa');
    a.href = unirId(destino, doc.id);
    a.setAttribute('data-id', doc.id);

    var partes = [];
    partes.push(doc.palabras + (doc.palabras === 1 ? ' palabra' : ' palabras'));

    if (tipoDeLaPagina() === 'todos') {
      partes.push(doc.tipo === 'libro' ? 'libro' : 'texto');
    } else {
      partes.push(fechaCorta(doc.modificado));
    }
    a.appendChild(crear('p', 'ficha-datos', partes.join(' · ')));
    a.appendChild(crear('h2', 'tarjeta-titulo', doc.nombre || 'Sin nombre'));

    if (doc.marca && NOMBRES_MARCA[doc.marca]) {
      var punto = crear('span', 'tarjeta-marca');
      punto.setAttribute('data-marca', doc.marca);
      punto.title = 'Marcado: ' + NOMBRES_MARCA[doc.marca];
      a.appendChild(punto);
    }

    li.appendChild(a);
    return li;
  }

  function tipoDeLaPagina() {
    return document.body.getAttribute('data-biblioteca') || '';
  }

  var lista, vacioEl, vacioTexto, vacioBoton;
  var docs = [];
  var r;
  var modoSeleccion = false;
  var elegidos = {};
  var busqueda = '';

  function estaElegido(id) { return !!elegidos[id]; }

  function seleccionadas() {
    return Object.keys(elegidos).filter(function (id) { return elegidos[id]; });
  }

  function pintar() {
    limpiar(lista);
    var visibles = docs;
    if (busqueda) {
      var q = busqueda.toLowerCase();
      visibles = docs.filter(function (d) {
        return (d.nombre || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    if (!visibles.length) {
      vacioTexto.textContent = busqueda
        ? 'Ningún documento tiene "' + busqueda + '" en el nombre.'
        : (tipoDeLaPagina() === 'libro' ? 'Todavía no hay libros guardados.'
          : (tipoDeLaPagina() === 'todos' ? 'Todavía no hay textos guardados.'
            : 'Todavía no hay textos guardados.'));
      vacioEl.hidden = false;
    } else {
      vacioEl.hidden = true;
      visibles.forEach(function (d) { lista.appendChild(tarjeta(d, r.texto)); });
    }
    actualizarModo();
  }

  function actualizarModo() {
    lista.classList.toggle('lista--seleccion', modoSeleccion);
    Array.prototype.forEach.call(lista.querySelectorAll('.tarjeta'), function (t) {
      var casilla = t.querySelector('.tarjeta-elegida');
      if (!modoSeleccion) {
        t.classList.remove('tarjeta--eligible', 'tarjeta--elegida');
        if (casilla) casilla.parentNode.removeChild(casilla);
        return;
      }
      t.classList.add('tarjeta--eligible');
      t.classList.toggle('tarjeta--elegida', estaElegido(t.getAttribute('data-id')));
      if (!casilla) {
        casilla = crear('span', 'tarjeta-elegida');
        casilla.setAttribute('aria-hidden', 'true');
        t.appendChild(casilla);
      }
    });
    var panel = document.querySelector('[data-panel]');
    if (panel) panel.setAttribute('data-seleccion', seleccionadas().length ? '1' : '0');
  }

  document.addEventListener('DOMContentLoaded', function () {
    lista = document.getElementById('lib-lista');
    if (!lista) return;
    vacioEl = document.getElementById('lib-vacio');
    vacioTexto = document.getElementById('lib-vacio-texto');
    vacioBoton = document.getElementById('lib-vacio-boton');
    r = rutas();
    vacioBoton.href = r.importar;

    var btnSeleccionar = document.querySelector('[data-seleccionar]');
    var btnMarcar = document.querySelector('[data-marcar-lista]');
    var btnBorrar = document.querySelector('[data-borrar-lista]');
    var btnSeguir = document.querySelector('[data-seguir]');
    var btnImportar = document.querySelector('[data-importar]');
    var buscar = document.getElementById('buscador');
    var btnBuscar = document.getElementById('buscador-boton');
    var campo = document.getElementById('buscador-campo');

    /* ANTES DE PINTAR LA LISTA, SE SIEMBRA.
     RetoEjemplos.sembrar() pone los textos de ejemplo en la biblioteca si esta
     vacia, y no hace nada si ya hay algo. Se espera a que termine antes de
     pedir la lista, porque si no la pagina mostraria "vacio" y despues, ya sin
     poder quitarlo, aparecieran tres tarjetas: un salto que parece un fallo.

     Va antes de "listar()" y no despues a proposito: pintar de mas y quitar
     despues es mas codigo, y se ve. Si el sitio no trae la siembra (porque la
     pagina no cargo el archivo, o el navegador esta sin la carpeta), la lista
     se pide igual, como estaba. */
    function pintarLista() {
      var sembrar = window.RetoEjemplos
        ? window.RetoEjemplos.sembrar()
        : Promise.resolve();
      return sembrar.then(function () {
        return window.RetoDatos.libros.listar();
      });
    }

    pintarLista().then(function (todos) {
      var tipo = tipoDeLaPagina();
      docs = tipo === 'todos'
        ? todos.slice()
        : todos.filter(function (d) { return d.tipo === tipo; });
      docs.sort(function (a, b) {
        return (b.modificado || '').localeCompare(a.modificado || '');
      });
      pintar();
    }).catch(function (e) {
      vacioTexto.textContent = 'No se pudo leer la biblioteca: ' + e.message;
      vacioBoton.hidden = true;
      vacioEl.hidden = false;
    });

    lista.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('.tarjeta') : null;
      if (!t) return;
      var id = t.getAttribute('data-id');
      if (!modoSeleccion) return;
      ev.preventDefault();
      elegidos[id] = !elegidos[id];
      actualizarModo();
    });

    if (btnSeleccionar) {
      btnSeleccionar.addEventListener('click', function () {
        modoSeleccion = !modoSeleccion;
        if (!modoSeleccion) elegidos = {};
        actualizarModo();
        if (modoSeleccion) {
          vacioTexto.textContent = 'Toca las tarjetas que quieras elegir. ' +
            'Con una elegida se puede marcar de color o borrar.';
          vacioEl.hidden = true;
        } else {
          pintar();
        }
      });
    }

    if (btnMarcar) {
      btnMarcar.addEventListener('click', function () {
        var ids = seleccionadas();
        if (!ids.length) { avisar('Elige primero algo.'); return; }
        var opciones = [{ texto: 'Quitar la marca', valor: '' }];
        ['1', '2', '3'].forEach(function (n) {
          opciones.push({ texto: NOMBRES_MARCA[n], valor: n });
        });
        window.RetoDialogo.lista({
          titulo: 'Marcar ' + ids.length + (ids.length === 1 ? ' documento' : ' documentos'),
          texto: 'Elige un color. El nombre es tan importante como el color:\n' +
                 'si no distingues bien algunos tonos, busca el nombre.',
          items: opciones
        }).then(function (marca) {
          if (marca === false || marca === undefined || marca === null) return;
          aplicarMarca(ids, marca);
        });
      });
    }

    if (btnBorrar) {
      btnBorrar.addEventListener('click', function () {
        var ids = seleccionadas();
        if (!ids.length) { avisar('Elige primero algo.'); return; }
        var texto = ids.length === 1
          ? 'Se va a eliminar 1 documento. No se puede deshacer, pero sigue en el respaldo.'
          : 'Se van a eliminar ' + ids.length + ' documentos. No se puede deshacer, pero siguen en el respaldo.';
        window.RetoDialogo.preguntar({
          titulo: ids.length === 1 ? '¿Eliminar 1 documento?' : '¿Eliminar ' + ids.length + ' documentos?',
          texto: texto,
          ok: 'Sí, eliminar',
          cancelar: 'No, mejor no'
        }).then(function (dijoQueSi) {
          if (!dijoQueSi) return;
          ids.reduce(function (anterior, id) {
            return anterior.then(function () {
              return window.RetoDatos.libros.borrar(id);
            });
          }, Promise.resolve()).then(function () {
            elegidos = {};
            modoSeleccion = false;
            return window.RetoDatos.libros.listar();
          }).then(function (todos) {
            var tipo = tipoDeLaPagina();
            docs = tipo === 'todos' ? todos.slice()
              : todos.filter(function (d) { return d.tipo === tipo; });
            docs.sort(function (a, b) { return (b.modificado || '').localeCompare(a.modificado || ''); });
            pintar();
          }).catch(function (e) {
            avisar('No se pudo eliminar todo: ' + e.message);
          });
        });
      });
    }

    function avisar(texto) {
      window.RetoDialogo.informar({ titulo: 'Nada seleccionado', texto: texto });
    }

    function aplicarMarca(ids, marca) {
      ids.reduce(function (anterior, id) {
        return anterior.then(function () {
          return window.RetoDatos.libros.obtener(id).then(function (doc) {
            if (!doc) return;
            doc.marca = marca;
            doc.modificado = new Date().toISOString();
            return window.RetoDatos.libros.guardar(doc);
          });
        });
      }, Promise.resolve()).then(function () {
        return window.RetoDatos.libros.listar();
      }).then(function (todos) {
        var tipo = tipoDeLaPagina();
        docs = tipo === 'todos' ? todos.slice()
          : todos.filter(function (d) { return d.tipo === tipo; });
        docs.sort(function (a, b) { return (b.modificado || '').localeCompare(a.modificado || ''); });
        elegidos = {};
        modoSeleccion = false;
        pintar();
      });
    }

    if (btnImportar) {
      btnImportar.addEventListener('click', function (ev) {
        ev.preventDefault();
        location.href = r.importar;
      });
    }

    if (btnSeguir) {
      var ultimo = null;
      try { ultimo = localStorage.getItem(CLAVE_ULTIMO); } catch (e) {}
      if (!ultimo) {
        btnSeguir.hidden = true;
      } else {
        btnSeguir.addEventListener('click', function (ev) {
          ev.preventDefault();
          location.href = unirId(r.texto, ultimo);
        });
      }
    }

    if (buscar && btnBuscar && campo) {
      btnBuscar.addEventListener('click', function () {
        var abierto = buscar.getAttribute('data-abierto') === '1';
        if (abierto) {
          buscar.removeAttribute('data-abierto');
          if (campo.value) { campo.value = ''; busqueda = ''; pintar(); }
          btnBuscar.setAttribute('aria-expanded', 'false');
        } else {
          buscar.setAttribute('data-abierto', '1');
          btnBuscar.setAttribute('aria-expanded', 'true');
          campo.focus();
        }
      });
      campo.addEventListener('input', function () {
        busqueda = campo.value.trim();
        pintar();
      });
      campo.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') btnBuscar.click();
      });
    }
  });
})();