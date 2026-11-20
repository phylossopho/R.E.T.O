/* =========================================================================
   R.E.T.O. - El motor del pacer (la guia) y de la lectura en columnas
   -------------------------------------------------------------------------
   El texto completo se ve como una pagina normal, pintado UNA sola vez (cada
   palabra en su <span>). Un resaltador avanza solo, por grupos de 1, 2 o 3
   palabras o por linea, a las palabras por minuto que se elijan. La mirada
   sigue la guia y no hay saltos de lugar.

   LA LECTURA EN COLUMNAS NO ES OTRO MOTOR: es este mismo con otro ancho
   (?motor=columnas arranca con 2 palabras por renglon). Las dos tienen sus
   propias preferencias guardadas, porque el nombre del modo va en la clave.

   QUIEN HACE QUE
   - Python (plan_pacer) reparte las palabras en tramos y dice cuanto pesa
     cada uno. Python NO sabe donde cae cada renglon, asi que la opcion "una
     linea" la arma ESTE archivo midiendo las palabras ya pintadas.
   - Duracion de un tramo = (60 000 / ppm) x (pausa / pausa_base_ms), la misma
     cuenta de los demas modos; se lee estado.wpm en cada fotograma, asi que
     cambiar la velocidad se nota al instante.

   ACCESIBILIDAD (lo que ya esta resuelto aqui)
   - El texto es texto normal: un lector de pantalla lo lee entero. El
     resaltado es decorativo y no genera avisos.
   - La guia se distingue por relleno + subrayado, no solo por color; usa el par
     acento/fondo del tema, que ya tiene el contraste de los botones.
   - "A mi ritmo": avanza con espacio, flecha derecha o tocando el texto, sin
     temporizador. Esos atajos solo valen con el foco en el texto (2.1.4).
   - Con movimiento reducido no hay deslizamiento: el desplazamiento salta.
   - Texto alineado a la izquierda, nunca justificado; alturas en em; las
     palabras largas se parten en vez de desbordar.
   ========================================================================= */
(function () {
  'use strict';

  var R = window.RetoLecturaMotores;
  if (!R) return;

  var DEFECTOS = {
    tramo: 3,          // 1, 2, 3 palabras, o 0 = una linea
    guia: 'fondo',     // fondo | subrayado | regla
    resto: 100,        // opacidad del texto que no es la guia (30 a 100)
    ritmo: 'auto',     // auto | manual
    scroll: true,      // desplazamiento automatico
    columna: 0,        // palabras por renglon (0 = texto normal)
    doble: false,      // dos columnas en pantalla ancha
    cuenta: true       // cuenta regresiva suave antes de empezar
  };
  var TRAMOS = [0, 1, 2, 3];
  var GUIAS = ['fondo', 'subrayado', 'regla'];
  var COLUMNAS = [0, 2, 3, 4];
  var PESO_REGLA = 35;     // con la guia "regla" el resto baja al menos a este %

  var viva = null;         // la instancia montada, para el modal de ajustes

  function dentro(v, lista, defecto) { return lista.indexOf(v) >= 0 ? v : defecto; }

  function normalizar(a, nombre) {
    var d = {};
    Object.keys(DEFECTOS).forEach(function (k) { d[k] = DEFECTOS[k]; });
    if (nombre === 'columnas') d.columna = 2;
    a = a || {};
    d.tramo = dentro(parseInt(a.tramo, 10), TRAMOS, d.tramo);
    d.guia = dentro(a.guia, GUIAS, d.guia);
    var r = parseInt(a.resto, 10);
    if (!isNaN(r)) d.resto = Math.min(100, Math.max(30, Math.round(r / 5) * 5));
    d.ritmo = a.ritmo === 'manual' ? 'manual' : (a.ritmo === 'auto' ? 'auto' : d.ritmo);
    if (typeof a.scroll === 'boolean') d.scroll = a.scroll;
    d.columna = dentro(parseInt(a.columna, 10), COLUMNAS, d.columna);
    if (typeof a.doble === 'boolean') d.doble = a.doble;
    if (typeof a.cuenta === 'boolean') d.cuenta = a.cuenta;
    return d;
  }

  function crearPacer(ctx, plan, nombre) {
    var estado = ctx.estado;
    var marco = ctx.marco;
    var el = R.el;
    var aj = normalizar({}, nombre);
    var palabras = plan.palabras;
    var inicios = plan.parrafo_inicio;
    var porTamano = {};                    // tramos ya pedidos, por tamano
    porTamano[plan.palabras_por_tramo] = plan.tramos;
    var tramos = plan.tramos;
    var fase = 'espera';                   // espera | cuenta | lee | fin
    var restante = plan.cuenta_seg || 3;
    var transcurrido = 0;
    var raf = null;
    var ultimo = null;
    var marcado = null;
    var cuentaMostrada = null;

    /* ---------------------------------------------------------- la escena */
    var escena = el('div', 'pacer-escena');
    escena.setAttribute('role', 'region');
    escena.setAttribute('aria-label', 'Texto con guía de lectura');
    escena.tabIndex = 0;
    var aviso = el('p', 'pacer-aviso');
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('aria-live', 'polite');
    var texto = el('div', 'pacer-texto');
    escena.appendChild(aviso);
    escena.appendChild(texto);

    /* Los titulos se reconocen por su texto (Python solo devuelve texto
       limpio), igual que hace el galactico. */
    var titulos = {};
    (plan.parrafosOriginales || []).forEach(function (x) {
      if (x.titulo) titulos[x.texto.split(/\s+/).join(' ').normalize('NFC')] = true;
    });

    var spans = new Array(palabras.length);
    var frag = document.createDocumentFragment();
    inicios.forEach(function (ini, j) {
      var fin = j + 1 < inicios.length ? inicios[j + 1] : palabras.length;
      var p = el('p', 'pacer-parrafo');
      for (var i = ini; i < fin; i++) {
        var s = el('span', 'pacer-p', palabras[i]);
        spans[i] = s;
        p.appendChild(s);
        if (i < fin - 1) p.appendChild(document.createTextNode(' '));
      }
      if (titulos[palabras.slice(ini, fin).join(' ')]) p.className += ' pacer-titulo';
      frag.appendChild(p);
    });
    texto.appendChild(frag);

    marco.setAttribute('data-motor', 'pacer');
    document.body.setAttribute('data-pacer', '1');
    marco.appendChild(escena);

    /* -------------------------------------------------------------- avisos */
    function decir(t) {
      if (aviso.textContent !== t) aviso.textContent = t;
    }

    /* ----------------------------------------------------------- la guia */
    function desmarcar() {
      if (!marcado) return;
      for (var k = marcado.desde; k <= marcado.hasta; k++) spans[k].classList.remove('pacer-activo');
      marcado = null;
    }

    function visible(a, b) {
      if (!aj.scroll) return;
      var c = escena.getBoundingClientRect();
      var ra = a.getBoundingClientRect();
      var rb = b.getBoundingClientRect();
      var reserva = c.height * 0.2;
      var arriba = c.top + c.height * 0.12;
      var abajo = c.bottom - c.height * 0.3 - reserva * 0.3;
      if (ra.top >= arriba && rb.bottom <= abajo) return;
      var destino = escena.scrollTop + (ra.top - c.top) - c.height * 0.3;
      if (typeof escena.scrollTo === 'function') {
        escena.scrollTo({ top: Math.max(0, destino), behavior: R.movimientoReducido() ? 'auto' : 'smooth' });
      } else {
        escena.scrollTop = Math.max(0, destino);
      }
    }

    function marcar(i) {
      desmarcar();
      var t = tramos[i];
      if (!t) return;
      for (var k = t.desde; k <= t.hasta; k++) spans[k].classList.add('pacer-activo');
      marcado = t;
      visible(spans[t.desde], spans[t.hasta]);
    }

    function tramoDePalabra(w) {
      var lo = 0, hi = tramos.length - 1;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (tramos[mid].hasta < w) lo = mid + 1; else hi = mid;
      }
      return lo;
    }

    /* "Una linea": se agrupa por lo que mide el navegador, no por Python. Una
       palabra nueva empieza otra linea cuando su borde de arriba cambia, y un
       parrafo nuevo siempre empieza otra. La pausa de cada tramo es la suma de la
       de sus palabras (viene en el plan). */
    function armarLineas() {
      var inicioDeParrafo = {};
      inicios.forEach(function (n) { inicioDeParrafo[n] = true; });
      var res = [];
      var desde = 0;
      var topPrevio = null;
      function cerrar(hasta) {
        var suma = 0;
        for (var k = desde; k <= hasta; k++) suma += plan.pausa[k];
        res.push({ desde: desde, hasta: hasta, pausa: suma,
                   peso: Math.round(suma / ((hasta - desde + 1) * plan.pausa_base_ms) * 100) / 100 });
      }
      for (var i = 0; i < spans.length; i++) {
        var top = spans[i].getBoundingClientRect().top;
        if (i > 0 && (inicioDeParrafo[i] || Math.abs(top - topPrevio) > 3)) {
          cerrar(i - 1);
          desde = i;
        }
        topPrevio = top;
      }
      if (spans.length) cerrar(spans.length - 1);
      return res;
    }

    function aplicarTramos(nuevos) {
      var w = tramos[estado.posicion] ? tramos[estado.posicion].desde : 0;
      tramos = nuevos;
      estado.posicion = Math.min(tramos.length - 1, tramoDePalabra(w));
      transcurrido = 0;
      marcar(estado.posicion);
    }

    function reajustarTramos() {
      if (aj.tramo === 0) { aplicarTramos(armarLineas()); return; }
      if (porTamano[aj.tramo]) { aplicarTramos(porTamano[aj.tramo]); return; }
      var pedido = aj.tramo;
      ctx.pedirPlan(plan.parrafosOriginales || [], nombre, null, { palabras_por_tramo: pedido })
        .then(function (nuevo) {
          porTamano[pedido] = nuevo.tramos;
          if (aj.tramo === pedido) aplicarTramos(nuevo.tramos);
        })
        .catch(function (e) { ctx.decir(e && e.message ? e.message : 'No se pudo cambiar el tamaño del tramo.'); });
    }

    /* ----------------------------------------------------- aspecto / ajustes */
    function pintarAspecto() {
      escena.setAttribute('data-guia', aj.guia);
      var resto = aj.guia === 'regla' ? Math.min(aj.resto, PESO_REGLA) : aj.resto;
      escena.setAttribute('data-atenuar', resto < 100 ? '1' : '0');
      escena.style.setProperty('--pacer-resto', String(resto / 100));
      texto.style.setProperty('--palabras-col', String(aj.columna));
      texto.setAttribute('data-columna', aj.columna ? '1' : '0');
      texto.setAttribute('data-doble', aj.doble ? '1' : '0');
      escena.setAttribute('data-ritmo', aj.ritmo);
    }

    function guardarAjustes() { ctx.guardar('pacer_ajustes', aj); }

    /* ------------------------------------------------------- el reloj (auto) */
    function duracion() {
      var t = tramos[estado.posicion];
      return (60000 / estado.wpm) * (t.pausa / plan.pausa_base_ms);
    }

    function terminar() {
      fase = 'fin';
      desmarcar();
      ctx.detener();
      decir('Terminaste el texto. ¡Buen trabajo!');
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
          decir('');
          marcar(estado.posicion);
        } else {
          var n = Math.max(1, Math.ceil(restante));
          if (n !== cuentaMostrada) { cuentaMostrada = n; decir('Empieza en ' + n); }
        }
      } else if (fase === 'lee') {
        transcurrido += dt;
        var d = duracion();
        if (transcurrido >= d) {
          transcurrido = Math.min(transcurrido - d, d);
          if (estado.posicion >= tramos.length - 1) { terminar(); return; }
          estado.posicion += 1;
          marcar(estado.posicion);
        }
      }
      raf = requestAnimationFrame(paso);
    }

    /* ------------------------------------------------------- a mi ritmo */
    function ir(delta) {
      if (fase === 'fin') return;
      var n = estado.posicion + delta;
      if (n < 0) n = 0;
      if (n >= tramos.length) { terminar(); return; }
      estado.posicion = n;
      marcar(n);
    }

    function teclado(e) {
      if (aj.ritmo !== 'manual' || !estado.leyendo || fase !== 'lee') return;
      if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); ir(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(-1); }
    }
    function toque() {
      if (aj.ritmo === 'manual' && estado.leyendo && fase === 'lee') ir(1);
    }
    escena.addEventListener('keydown', teclado);
    escena.addEventListener('click', toque);

    function arrancarReloj() {
      if (raf !== null) return;
      ultimo = null;
      raf = requestAnimationFrame(paso);
    }

    /* ------------------------------------------------------- el contrato */
    var api = {
      reanudar: function () {
        if (fase === 'fin') api.reiniciar();
        if (fase === 'espera') {
          if (aj.ritmo === 'manual') {
            fase = 'lee';
          } else if (aj.cuenta) {
            fase = 'cuenta';
            restante = plan.cuenta_seg || 3;
            cuentaMostrada = null;
          } else {
            fase = 'lee';
            transcurrido = 0;
          }
        }
        if (aj.ritmo === 'manual') {
          decir('A tu ritmo: espacio, flecha derecha o toca el texto para avanzar.');
          escena.focus({ preventScroll: true });
          return;
        }
        if (fase === 'lee') decir('');
        arrancarReloj();
      },
      pausar: function () {
        if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
        ultimo = null;
        if (fase === 'lee' || fase === 'cuenta') decir('En pausa');
      },
      reiniciar: function () {
        if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
        fase = 'espera';
        restante = plan.cuenta_seg || 3;
        transcurrido = 0;
        ultimo = null;
        estado.posicion = 0;
        marcar(0);
        escena.scrollTop = 0;
        decir('Pulsa ▶ para empezar');
      },
      medir: function () {
        if (!marco.contains(escena)) return;
        if (aj.tramo === 0) reajustarTramos(); else marcar(estado.posicion);
      },
      limpiar: function () {
        api.pausar();
        window.removeEventListener('resize', api.medir);
        if (marco.contains(escena)) marco.removeChild(escena);
        marco.removeAttribute('data-motor');
        document.body.removeAttribute('data-pacer');
        document.body.removeAttribute('data-modo');
        if (viva === api) viva = null;
      },
      /* Lo que usa el modal de ajustes. */
      ajustes: {
        obtener: function () { return normalizar(aj, nombre); },
        poner: function (clave, valor) {
          var nuevo = {};
          Object.keys(aj).forEach(function (k) { nuevo[k] = aj[k]; });
          nuevo[clave] = valor;
          var anterior = aj;
          aj = normalizar(nuevo, nombre);
          pintarAspecto();
          if (clave === 'tramo' || clave === 'columna' || clave === 'doble') reajustarTramos();
          if (clave === 'ritmo') {
            if (aj.ritmo === 'manual' && raf !== null) { cancelAnimationFrame(raf); raf = null; }
            else if (aj.ritmo === 'auto' && estado.leyendo && fase === 'lee') arrancarReloj();
          }
          if (clave === 'scroll' && aj.scroll) marcar(estado.posicion);
          guardarAjustes();
          return anterior !== aj;
        }
      }
    };

    window.addEventListener('resize', api.medir);
    estado.posicion = 0;
    viva = api;

    function arrancar() {
      pintarAspecto();
      reajustarTramos();
      marcar(0);
      decir('Pulsa ▶ para empezar');
    }

    /* Los ajustes guardados y la velocidad sugerida (si nunca eligio una) se
       leen antes de ensenar la guia; mientras, el texto ya esta a la vista. */
    Promise.all([ctx.recuperar('pacer_ajustes'), ctx.recuperar('lectura_wpm')]).then(function (r) {
      aj = normalizar(r[0], nombre);
      if (!r[1] && plan.ppm_sugerida) ctx.ponerVelocidad(plan.ppm_sugerida);
      arrancar();
    }).catch(arrancar);

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(api.medir);
    return api;
  }

  /* ------------------------------------------------------ el modal de ajustes */
  var modal = null;
  var controles = {};

  function armarModal() {
    var m = R.dialogo('pacer-ajustes', 'Ajustes de la guía de lectura');
    var c = m.cuerpo;
    function poner(clave) {
      return function (v) { if (viva) viva.ajustes.poner(clave, v); };
    }
    controles.tramo = R.campoSelect(c, 'pacer-tramo', 'Palabras por tramo',
      [[1, '1 palabra'], [2, '2 palabras'], [3, '3 palabras'], [0, 'Una línea completa']],
      'Cuánto texto resalta la guía cada vez. "Una línea" mide el renglón real de tu pantalla.',
      function (v) { poner('tramo')(parseInt(v, 10)); });
    controles.guia = R.campoSelect(c, 'pacer-guia', 'Tipo de guía',
      [['fondo', 'Fondo (por defecto)'], ['subrayado', 'Subrayado'], ['regla', 'Regla: atenúa todo lo demás']],
      'La guía siempre se distingue por algo más que el color.', poner('guia'));
    var resto = R.campoRango(c, 'pacer-resto', 'Opacidad del resto del texto', 30, 100, 5, ' %',
      'Bájala si te distraes con lo que no es la guía. Al bajarla se reduce el contraste del texto atenuado.',
      function (v) { poner('resto')(parseInt(v, 10)); });
    controles.resto = resto;
    controles.ritmo = R.campoSelect(c, 'pacer-ritmo', 'Cómo avanza',
      [['auto', 'Solo, a las palabras por minuto elegidas'], ['manual', 'A mi ritmo: yo avanzo']],
      'En "a mi ritmo" avanzas con espacio, flecha derecha o tocando el texto (con el foco en el texto) y vuelves con flecha izquierda.',
      poner('ritmo'));
    controles.scroll = R.campoCasilla(c, 'pacer-scroll', 'Desplazamiento automático',
      'Con movimiento reducido el texto salta por páginas en vez de deslizarse.', poner('scroll'));
    controles.cuenta = R.campoCasilla(c, 'pacer-cuenta', 'Cuenta regresiva suave al empezar',
      'Tres segundos antes de que se mueva la guía. Puedes quitarla.', poner('cuenta'));
    controles.columna = R.campoSelect(c, 'pacer-columna', 'Ancho de la columna',
      [[0, 'Texto normal'], [2, '2 palabras por renglón'], [3, '3 palabras por renglón'], [4, '4 palabras por renglón']],
      'Una columna angosta hace que la guía solo baje, sin movimientos laterales.',
      function (v) { poner('columna')(parseInt(v, 10)); });
    controles.doble = R.campoCasilla(c, 'pacer-doble', 'Dos columnas en pantallas anchas',
      'Solo se aplica con 900 px de ancho o más; en el celular siempre es una.', poner('doble'));
    modal = m;
  }

  function sincronizar() {
    if (!viva) return;
    var a = viva.ajustes.obtener();
    controles.tramo.value = String(a.tramo);
    controles.guia.value = a.guia;
    controles.resto.rango.value = String(a.resto);
    controles.resto.pintar();
    controles.ritmo.value = a.ritmo;
    controles.scroll.checked = a.scroll;
    controles.cuenta.checked = a.cuenta;
    controles.columna.value = String(a.columna);
    controles.doble.checked = a.doble;
  }

  function abrirAjustes() {
    if (!viva) return;
    if (!modal) armarModal();
    sincronizar();
    modal.abrir();
  }

  R.registrar('pacer', function (ctx, plan) { return crearPacer(ctx, plan, 'pacer'); }, abrirAjustes);
  R.registrar('columnas', function (ctx, plan) { return crearPacer(ctx, plan, 'columnas'); }, abrirAjustes);
})();
