/* =========================================================================
   R.E.T.O. - El registro de los motores de lectura que viven aparte
   -------------------------------------------------------------------------
   Los cuatro primeros motores (galactico, palabra, grupo, frases) estan dentro
   de reto-lectura.js. Los modulos que se agregaron despues NO: cada uno vive en
   su archivo y se anota aqui.

       window.RetoLecturaMotores.registrar(nombres, fabrica, ajustes)

     nombres   'pacer' o ['pacer', 'columnas'] (el valor de ?motor= en la direccion)
     fabrica   function (ctx, plan) -> motor, con el mismo contrato que los demas:
                 { reanudar, pausar, reiniciar, medir, limpiar }
               ctx es lo que reto-lectura.js les entrega (estado, marco, decir,
               pintarEstado, guardar, recuperar, pedirPlan, ponerVelocidad,
               detener). No ven nada mas de ese archivo.
     ajustes   opcional: function () que abre el modal de ajustes de ese modo
               (reto-lectura-ajustes.js le pasa el turno cuando se aprieta el
               boton de los controles deslizantes del panel).

   Este archivo va ANTES de reto-lectura.js y de los motores. Tambien trae las
   piezas del modal de ajustes (dialogo, select, rango, casilla) con las mismas
   clases del modal de los otros modos, para que se vean igual.
   ========================================================================= */
(function () {
  'use strict';

  var R = window.RetoLecturaMotores = window.RetoLecturaMotores || { fabricas: {}, ajustes: {} };

  R.registrar = function (nombres, fabrica, ajustes) {
    [].concat(nombres).forEach(function (n) {
      R.fabricas[n] = fabrica;
      if (ajustes) R.ajustes[n] = ajustes;
    });
  };

  R.existe = function (nombre) { return !!R.fabricas[nombre]; };

  R.el = function (tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };

  /* La preferencia del movimiento reducido: el interruptor del sitio manda
     (data-anim), y si la persona no decidio, el sistema. */
  R.movimientoReducido = function () {
    var a = document.documentElement.getAttribute('data-anim');
    if (a === 'off') return true;
    if (a === 'on') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  /* UN MODAL DE AJUSTES. Mientras esta abierto la lectura se para (suspender) y
     se reanuda al cerrar SOLO si estaba corriendo, igual que el de los otros
     modos. */
  R.dialogo = function (id, titulo) {
    var dlg = R.el('dialog', 'dialogo dialogo-ajustes');
    dlg.id = id;
    dlg.setAttribute('aria-labelledby', id + '-titulo');
    var h = R.el('h2', 'dialogo-titulo', titulo);
    h.id = id + '-titulo';
    dlg.appendChild(h);
    var cuerpo = R.el('div', 'ajustes-cuerpo');
    dlg.appendChild(cuerpo);
    var acciones = R.el('div', 'dialogo-acciones');
    var listo = R.el('button', 'boton boton--principal', 'Listo');
    listo.type = 'button';
    acciones.appendChild(listo);
    dlg.appendChild(acciones);
    document.body.appendChild(dlg);

    var reanudar = null;
    listo.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('close', function () {
      var seguir = reanudar;
      reanudar = null;
      if (seguir) seguir();
    });
    return {
      dlg: dlg,
      cuerpo: cuerpo,
      abrir: function () {
        if (dlg.open) return;
        if (window.RetoLectura && window.RetoLectura.suspender) reanudar = window.RetoLectura.suspender();
        dlg.showModal();
      }
    };
  };

  R.campoSelect = function (cuerpo, id, etiqueta, opciones, ayuda, alCambiar) {
    var campo = R.el('div', 'ajustes-campo');
    var l = R.el('label', '', etiqueta);
    l.setAttribute('for', id);
    var sel = R.el('select', 'editor-campo');
    sel.id = id;
    opciones.forEach(function (o) {
      var op = R.el('option', '', o[1]);
      op.value = String(o[0]);
      sel.appendChild(op);
    });
    campo.appendChild(l);
    campo.appendChild(sel);
    if (ayuda) {
      var p = R.el('p', 'ajustes-ayuda', ayuda);
      p.id = id + '-ayuda';
      sel.setAttribute('aria-describedby', p.id);
      campo.appendChild(p);
    }
    sel.addEventListener('change', function () { alCambiar(sel.value); });
    cuerpo.appendChild(campo);
    return sel;
  };

  R.campoRango = function (cuerpo, id, etiqueta, min, max, paso, sufijo, ayuda, alCambiar) {
    var campo = R.el('div', 'ajustes-campo');
    var l = R.el('label', '', etiqueta);
    l.setAttribute('for', id);
    var fila = R.el('div', 'ajustes-fila');
    var rango = R.el('input', 'rango');
    rango.type = 'range';
    rango.id = id;
    rango.min = min; rango.max = max; rango.step = paso;
    var valor = R.el('output', 'rango-valor');
    valor.setAttribute('for', id);
    fila.appendChild(rango);
    fila.appendChild(valor);
    campo.appendChild(l);
    campo.appendChild(fila);
    if (ayuda) {
      var p = R.el('p', 'ajustes-ayuda', ayuda);
      p.id = id + '-ayuda';
      rango.setAttribute('aria-describedby', p.id);
      campo.appendChild(p);
    }
    function pintar() { valor.textContent = rango.value + (sufijo || ''); }
    rango.addEventListener('input', pintar);
    rango.addEventListener('change', function () { pintar(); alCambiar(rango.value); });
    cuerpo.appendChild(campo);
    return { rango: rango, pintar: pintar };
  };

  R.campoCasilla = function (cuerpo, id, texto, ayuda, alCambiar) {
    var campo = R.el('div', 'ajustes-campo');
    var l = R.el('label', 'opcion');
    var inp = R.el('input');
    inp.type = 'checkbox';
    inp.id = id;
    l.appendChild(inp);
    l.appendChild(R.el('span', '', texto));
    campo.appendChild(l);
    if (ayuda) {
      var p = R.el('p', 'ajustes-ayuda', ayuda);
      p.id = id + '-ayuda';
      inp.setAttribute('aria-describedby', p.id);
      campo.appendChild(p);
    }
    inp.addEventListener('change', function () { alCambiar(inp.checked); });
    cuerpo.appendChild(campo);
    return inp;
  };
})();
