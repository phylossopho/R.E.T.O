/* =========================================================================
   R.E.T.O. - La prueba de velocidad base
   -------------------------------------------------------------------------
   La persona lee un texto a su propio ritmo, pulsa "Terminé", contesta unas
   preguntas de comprension y obtiene su velocidad efectiva. Se repite de vez en
   cuando para ver el progreso.

     velocidad bruta    = palabras / minutos
     comprension        = aciertos / preguntas
     velocidad efectiva = bruta x comprension      <- la que va a la grafica

   Python hace las cuentas (calcular_velocidad, /api/lectura/velocidad) y decide
   que es "lectura saltada". Aqui solo se mide el tiempo, se pintan las
   preguntas y se muestra el resultado.

   LAS PREGUNTAS SALEN DEL BANCO DE TESTS (RetoTestsBanco): la persona elige con
   que test comprobar la comprension y se acuerda por texto. Solo se usan las
   preguntas fijas (estaticas) con su respuesta correcta; si no hay test o no
   tiene de esas, la prueba mide solo la velocidad bruta y NO entra a la grafica
   (sin comprension no hay velocidad efectiva).

   SIN PRESION
   - No hay limite de tiempo para leer ni para contestar. El reloj es solo
     medicion, y esta OCULTO por defecto (se puede mostrar).
   - El tiempo que la pestana estuvo escondida no cuenta.
   - El resultado se compara solo contra la propia persona, nunca contra otras,
     y con lenguaje neutro. Es una medicion orientativa, no un diagnostico.
   - Mas de 1500 palabras por minuto no se guarda: es un texto saltado.
   ========================================================================= */
(function () {
  'use strict';

  var R = window.RetoLecturaMotores;
  if (!R) return;

  var MAX_PUNTOS = 12;
  var UMBRAL_CAMBIO = 3;      // por debajo de este % se dice "muy parecido"

  function mezclar(lista) {
    var a = lista.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function diasEntre(iso) {
    var d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d <= 0) return 'hoy';
    if (d === 1) return 'ayer';
    return 'hace ' + d + ' días';
  }

  function formatoFecha(iso) {
    try { return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' }); }
    catch (e) { return iso.slice(0, 10); }
  }

  function crearPrueba(ctx, plan) {
    var estado = ctx.estado;
    var marco = ctx.marco;
    var el = R.el;
    var prefs = { reloj: false, tests: {} };
    var tests = [];                       // los del banco con preguntas fijas
    var preguntas = [];                   // las elegidas para esta prueba
    var etapa = 'espera';
    var t0 = 0;
    var oculto = 0;
    var ocultoDesde = null;
    var relojId = null;
    var segundos = 0;

    var escena = el('div', 'prueba-escena');
    escena.setAttribute('role', 'region');
    escena.setAttribute('aria-label', 'Prueba de velocidad base');
    var vivo = el('p', 'prueba-vivo');
    vivo.setAttribute('role', 'status');
    vivo.setAttribute('aria-live', 'polite');
    var cuerpo = el('div', 'prueba-cuerpo');
    escena.appendChild(vivo);
    escena.appendChild(cuerpo);
    marco.setAttribute('data-motor', 'prueba');
    document.body.setAttribute('data-prueba', '1');
    marco.appendChild(escena);

    function decir(t) { vivo.textContent = t || ''; }
    function limpiarCuerpo() { cuerpo.textContent = ''; }

    function guardarPrefs() { ctx.guardar('prueba_prefs', prefs); }

    function sacarPreguntas(test) {
      if (!test) return [];
      var validas = (test.preguntas || []).filter(function (p) {
        return p && p.tipo === 'estatica' && p.opciones && p.opciones.length >= 2 && p.correcta;
      });
      var n = Math.min(validas.length, (plan.preguntas && plan.preguntas.defecto) || 4);
      return mezclar(validas).slice(0, n);
    }

    function elegido() {
      var id = prefs.tests[estado.textoId];
      for (var i = 0; i < tests.length; i++) if (tests[i].id === id) return tests[i];
      return null;
    }

    /* --------------------------------------------------------------- espera */
    function pintarEspera() {
      etapa = 'espera';
      detenerReloj();
      limpiarCuerpo();
      decir('');
      cuerpo.appendChild(el('h2', 'prueba-titulo', 'Prueba de velocidad base'));
      cuerpo.appendChild(el('p', 'prueba-texto-ayuda',
        'Lee el texto a tu ritmo, como lo harías normalmente, y pulsa «Terminé» cuando acabes. ' +
        'Después contestas unas preguntas para saber cuánto entendiste.'));
      cuerpo.appendChild(el('p', 'prueba-texto-ayuda',
        'No hay límite de tiempo y no se compara con nadie más. Es una medición orientativa, no un diagnóstico.'));
      cuerpo.appendChild(el('p', 'prueba-texto-ayuda',
        'Texto de ' + plan.total_palabras + ' palabras' +
        (plan.recortado ? ' (se tomó solo el principio: la prueba usa como máximo 600).' : '.')));

      var campo = el('div', 'ajustes-campo');
      var l = el('label', '', 'Comprobar la comprensión con este test');
      l.setAttribute('for', 'prueba-test');
      var sel = el('select', 'editor-campo');
      sel.id = 'prueba-test';
      var ninguno = el('option', '', 'Ninguno: solo medir la velocidad');
      ninguno.value = '';
      sel.appendChild(ninguno);
      tests.forEach(function (t) {
        var o = el('option', '', (t.titulo || t.nombre || t.id));
        o.value = t.id;
        sel.appendChild(o);
      });
      var actual = elegido();
      sel.value = actual ? actual.id : '';
      var ayuda = el('p', 'ajustes-ayuda', tests.length
        ? 'Las preguntas se toman del banco de tests, al azar (hasta ' + ((plan.preguntas && plan.preguntas.defecto) || 4) + ').'
        : 'Todavía no hay tests con preguntas fijas en el banco. Sin preguntas se mide solo la velocidad bruta y no entra a tu progreso.');
      ayuda.id = 'prueba-test-ayuda';
      sel.setAttribute('aria-describedby', ayuda.id);
      campo.appendChild(l);
      campo.appendChild(sel);
      campo.appendChild(ayuda);
      cuerpo.appendChild(campo);
      sel.addEventListener('change', function () {
        if (sel.value) prefs.tests[estado.textoId] = sel.value; else delete prefs.tests[estado.textoId];
        guardarPrefs();
      });

      var cr = el('label', 'opcion');
      var chk = el('input');
      chk.type = 'checkbox';
      chk.checked = !!prefs.reloj;
      cr.appendChild(chk);
      cr.appendChild(el('span', '', 'Mostrar el reloj mientras leo'));
      cuerpo.appendChild(cr);
      chk.addEventListener('change', function () { prefs.reloj = chk.checked; guardarPrefs(); });

      var ir = el('button', 'boton boton--principal prueba-grande', 'Empezar a leer');
      ir.type = 'button';
      ir.addEventListener('click', empezar);
      cuerpo.appendChild(ir);
      ir.focus({ preventScroll: true });
    }

    /* ---------------------------------------------------------------- lectura */
    function detenerReloj() {
      if (relojId !== null) { clearInterval(relojId); relojId = null; }
    }

    function tiempoLeido() {
      var extra = ocultoDesde !== null ? performance.now() - ocultoDesde : 0;
      return Math.max(0, (performance.now() - t0 - oculto - extra) / 1000);
    }

    function alCambiarVisibilidad() {
      if (etapa !== 'lee') return;
      if (document.hidden) ocultoDesde = performance.now();
      else if (ocultoDesde !== null) { oculto += performance.now() - ocultoDesde; ocultoDesde = null; }
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    function empezar() {
      preguntas = sacarPreguntas(elegido());
      etapa = 'lee';
      oculto = 0;
      ocultoDesde = null;
      limpiarCuerpo();
      var reloj = el('p', 'prueba-reloj');
      reloj.setAttribute('aria-hidden', 'true');
      reloj.hidden = !prefs.reloj;
      cuerpo.appendChild(reloj);
      var texto = el('div', 'prueba-lectura');
      plan.parrafos.forEach(function (p) { texto.appendChild(el('p', 'prueba-parrafo', p)); });
      cuerpo.appendChild(texto);
      var fin = el('button', 'boton boton--principal prueba-grande', 'Terminé');
      fin.type = 'button';
      fin.addEventListener('click', terminarLectura);
      cuerpo.appendChild(fin);
      escena.scrollTop = 0;
      t0 = performance.now();
      if (prefs.reloj) {
        relojId = setInterval(function () {
          var s = Math.floor(tiempoLeido());
          reloj.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
        }, 1000);
        reloj.textContent = '0:00';
      }
      ctx.estado.leyendo = true;
      ctx.pintarEstado();
    }

    function terminarLectura() {
      segundos = tiempoLeido();
      detenerReloj();
      ctx.detener();
      if (preguntas.length) pintarPreguntas(); else mostrarResultado(0);
    }

    /* ------------------------------------------------------------ preguntas */
    function pintarPreguntas() {
      etapa = 'preguntas';
      limpiarCuerpo();
      decir('Ahora, unas preguntas sobre lo que leíste.');
      cuerpo.appendChild(el('h2', 'prueba-titulo', 'Preguntas de comprensión'));
      cuerpo.appendChild(el('p', 'prueba-texto-ayuda', 'Sin límite de tiempo. Elige una respuesta en cada pregunta.'));
      var form = el('div', 'prueba-preguntas');
      var grupos = preguntas.map(function (p, qi) {
        var fs = el('fieldset', 'prueba-pregunta');
        fs.appendChild(el('legend', '', (qi + 1) + '. ' + p.enunciado));
        var nombre = 'prueba-q' + qi;
        mezclar(p.opciones).forEach(function (o, oi) {
          var id = nombre + '-' + oi;
          var lab = el('label', 'opcion');
          var inp = el('input');
          inp.type = 'radio';
          inp.name = nombre;
          inp.value = o.id;
          inp.id = id;
          lab.appendChild(inp);
          lab.appendChild(el('span', '', o.texto));
          fs.appendChild(lab);
        });
        form.appendChild(fs);
        return { fs: fs, nombre: nombre, pregunta: p };
      });
      cuerpo.appendChild(form);
      var ver = el('button', 'boton boton--principal prueba-grande', 'Ver mi resultado');
      ver.type = 'button';
      cuerpo.appendChild(ver);
      ver.addEventListener('click', function () {
        var aciertos = 0;
        for (var i = 0; i < grupos.length; i++) {
          var marcado = form.querySelector('input[name="' + grupos[i].nombre + '"]:checked');
          if (!marcado) {
            decir('Falta contestar la pregunta ' + (i + 1) + '.');
            var primero = grupos[i].fs.querySelector('input');
            if (primero) primero.focus();
            return;
          }
          if (marcado.value === String(grupos[i].pregunta.correcta)) aciertos++;
        }
        mostrarResultado(aciertos);
      });
    }

    /* ------------------------------------------------------------ resultado */
    function pedirVelocidad(aciertos) {
      return fetch('/api/lectura/velocidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ palabras: plan.total_palabras, segundos: segundos,
                               aciertos: aciertos, preguntas: preguntas.length })
      }).then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d && d.error ? d.error : 'No se pudo calcular la velocidad.');
          return d;
        });
      });
    }

    function mostrarResultado(aciertos) {
      etapa = 'resultado';
      limpiarCuerpo();
      decir('');
      cuerpo.appendChild(el('p', 'prueba-texto-ayuda', 'Calculando…'));
      pedirVelocidad(aciertos).then(function (v) {
        var previas = [];
        var guardado = Promise.resolve(null);
        return (window.RetoProgreso ? window.RetoProgreso.mediciones.listar() : Promise.resolve([])).then(function (lista) {
          previas = lista.filter(function (m) { return typeof m.ppm_efectivas === 'number'; });
          if (v.entra_al_historial && window.RetoProgreso) {
            guardado = window.RetoProgreso.mediciones.guardar({
              textoId: estado.textoId, palabras: plan.total_palabras, segundos: segundos,
              aciertos: aciertos, preguntas: preguntas.length,
              ppm_brutas: v.ppm_brutas, ppm_efectivas: v.ppm_efectivas
            });
          }
          if (window.RetoProgreso) {
            window.RetoProgreso.registrarSesion({
              tipo: 'lectura', motor: 'prueba', minutos: segundos / 60, palabras: plan.total_palabras
            });
          }
          return guardado;
        }).then(function (nueva) {
          pintarResultado(v, aciertos, previas, nueva);
        });
      }).catch(function (e) {
        limpiarCuerpo();
        cuerpo.appendChild(el('p', 'prueba-texto-ayuda', e && e.message ? e.message :
          'No se pudo calcular la velocidad. Abre el sitio con servidor.cmd.'));
      });
    }

    function mensajeComparacion(v, previas) {
      if (!v.entra_al_historial) return '';
      if (!previas.length) return 'Esta es tu primera medición: será tu punto de partida.';
      var ant = previas[previas.length - 1];
      var cambio = Math.round((v.ppm_efectivas - ant.ppm_efectivas) / ant.ppm_efectivas * 100);
      var cuando = diasEntre(ant.fecha);
      if (cambio >= UMBRAL_CAMBIO) {
        return 'Tu velocidad efectiva es un ' + cambio + ' % mayor que en tu medición anterior (' + cuando + ').';
      }
      if (cambio <= -UMBRAL_CAMBIO) {
        return 'Esta vez tu velocidad efectiva fue un ' + Math.abs(cambio) + ' % menor que en tu medición anterior (' +
               cuando + '). Cada texto es distinto, y es normal que varíe.';
      }
      return 'Muy parecida a tu medición anterior (' + cuando + ').';
    }

    function pintarResultado(v, aciertos, previas, nueva) {
      limpiarCuerpo();
      var caja = el('div', 'prueba-resultado');
      caja.setAttribute('role', 'status');
      caja.setAttribute('aria-live', 'polite');
      caja.appendChild(el('h2', 'prueba-titulo', 'Tu resultado'));

      if (v.saltada) {
        caja.appendChild(el('p', 'prueba-texto-ayuda',
          'Con ese tiempo salen más de ' + plan.ppm_brutas_max + ' palabras por minuto, así que parece que el texto se leyó muy por encima o se saltó. ' +
          'No se guardó esta medición. Puedes repetirla cuando quieras, sin prisa.'));
      } else {
        if (v.ppm_efectivas !== null) {
          var grande = el('p', 'prueba-numero');
          grande.appendChild(el('strong', '', String(v.ppm_efectivas)));
          grande.appendChild(document.createTextNode(' palabras por minuto efectivas'));
          caja.appendChild(grande);
        }
        var lista = el('ul', 'prueba-datos');
        lista.appendChild(el('li', '', 'Velocidad de lectura: ' + v.ppm_brutas + ' palabras por minuto'));
        if (v.comprension !== null) {
          lista.appendChild(el('li', '', 'Comprensión: ' + aciertos + ' de ' + preguntas.length +
            ' (' + Math.round(v.comprension * 100) + ' %)'));
        } else {
          lista.appendChild(el('li', '', 'Sin preguntas: solo se midió la velocidad, y no entra a tu progreso.'));
        }
        caja.appendChild(lista);
        var comp = mensajeComparacion(v, previas);
        if (comp) caja.appendChild(el('p', 'prueba-comparacion', comp));
      }
      caja.appendChild(el('p', 'prueba-nota', 'Es una medición orientativa, no un diagnóstico. Cada texto es distinto: úsala como referencia, no como marca exacta.'));
      cuerpo.appendChild(caja);

      var historial = previas.slice();
      if (nueva) historial.push(nueva);
      if (historial.length) cuerpo.appendChild(grafica(historial, nueva));

      var acciones = el('div', 'skim-acciones');
      var otra = el('a', 'boton boton--principal', 'Hacer otra prueba');
      otra.href = '../prueba-velocidad/prueba-velocidad.html';
      var repetir = el('button', 'boton', 'Repetir con este texto');
      repetir.type = 'button';
      repetir.addEventListener('click', function () { api.reiniciar(); });
      acciones.appendChild(otra);
      acciones.appendChild(repetir);
      cuerpo.appendChild(acciones);
      escena.scrollTop = 0;
    }

    /* La grafica de progreso: la imagen (linea, con un punto redondo por
       medicion y un rombo en la de hoy) Y su tabla de datos, para los lectores
       de pantalla (1.1.1, 1.3.1). Usa solo ppm_efectivas. */
    function grafica(lista, actual) {
      var caja = el('div', 'prueba-grafica');
      caja.appendChild(el('h3', 'prueba-subtitulo', 'Tu progreso'));
      var datos = lista.slice(-MAX_PUNTOS);
      var W = 320, H = 140, M = 28;
      var max = Math.max.apply(null, datos.map(function (d) { return d.ppm_efectivas; }));
      var min = Math.min.apply(null, datos.map(function (d) { return d.ppm_efectivas; }));
      if (max === min) { max += 10; min = Math.max(0, min - 10); }
      function x(i) { return datos.length === 1 ? W / 2 : M + i * (W - 2 * M) / (datos.length - 1); }
      function y(v) { return H - M + 6 - (v - min) * (H - 2 * M) / (max - min); }
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('class', 'prueba-svg');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Gráfica de tu velocidad efectiva en las últimas ' + datos.length +
        ' pruebas. Los datos están en la tabla de abajo.');
      var pts = datos.map(function (d, i) { return x(i) + ',' + y(d.ppm_efectivas); }).join(' ');
      var linea = document.createElementNS(ns, 'polyline');
      linea.setAttribute('points', pts);
      linea.setAttribute('class', 'prueba-linea');
      svg.appendChild(linea);
      datos.forEach(function (d, i) {
        var esActual = actual && d.id === actual.id;
        var f;
        if (esActual) {
          f = document.createElementNS(ns, 'rect');
          f.setAttribute('x', x(i) - 6); f.setAttribute('y', y(d.ppm_efectivas) - 6);
          f.setAttribute('width', 12); f.setAttribute('height', 12);
          f.setAttribute('transform', 'rotate(45 ' + x(i) + ' ' + y(d.ppm_efectivas) + ')');
          f.setAttribute('class', 'prueba-punto prueba-punto--hoy');
        } else {
          f = document.createElementNS(ns, 'circle');
          f.setAttribute('cx', x(i)); f.setAttribute('cy', y(d.ppm_efectivas)); f.setAttribute('r', 5);
          f.setAttribute('class', 'prueba-punto');
        }
        svg.appendChild(f);
      });
      caja.appendChild(svg);
      caja.appendChild(el('p', 'prueba-nota', '● pruebas anteriores   ◆ esta prueba'));
      var det = el('details', 'prueba-tabla-caja');
      det.appendChild(el('summary', '', 'Ver los datos en una tabla'));
      var tabla = el('table', 'prueba-tabla');
      var cap = el('caption', '', 'Velocidad efectiva por prueba');
      tabla.appendChild(cap);
      var cab = el('tr');
      ['Fecha', 'Palabras por minuto efectivas', 'Comprensión'].forEach(function (t) {
        var th = el('th', '', t); th.scope = 'col'; cab.appendChild(th);
      });
      tabla.appendChild(cab);
      datos.slice().reverse().forEach(function (d) {
        var tr = el('tr');
        tr.appendChild(el('td', '', formatoFecha(d.fecha)));
        tr.appendChild(el('td', '', String(d.ppm_efectivas)));
        tr.appendChild(el('td', '', d.preguntas ? Math.round(d.aciertos / d.preguntas * 100) + ' %' : '—'));
        tabla.appendChild(tr);
      });
      det.appendChild(tabla);
      caja.appendChild(det);
      return caja;
    }

    /* ------------------------------------------------------------- contrato */
    var api = {
      /* El play del panel esta escondido en este modo; si llega, solo sirve para
         empezar. */
      reanudar: function () { if (etapa === 'espera') empezar(); },
      pausar: function () {},
      reiniciar: function () {
        detenerReloj();
        ctx.detener();
        pintarEspera();
      },
      medir: function () {},
      limpiar: function () {
        detenerReloj();
        document.removeEventListener('visibilitychange', alCambiarVisibilidad);
        if (marco.contains(escena)) marco.removeChild(escena);
        marco.removeAttribute('data-motor');
        document.body.removeAttribute('data-prueba');
        document.body.removeAttribute('data-modo');
      }
    };

    estado.posicion = 0;
    pintarEspera();
    // Las preferencias y los tests llegan despues; la pantalla ya esta.
    Promise.all([
      ctx.recuperar('prueba_prefs'),
      window.RetoTestsBanco ? window.RetoTestsBanco.cargar().catch(function () { return []; }) : Promise.resolve([])
    ]).then(function (r) {
      if (r[0] && typeof r[0] === 'object') {
        prefs.reloj = !!r[0].reloj;
        prefs.tests = (r[0].tests && typeof r[0].tests === 'object') ? r[0].tests : {};
      }
      tests = (r[1] || []).filter(function (t) { return sacarPreguntas(t).length > 0; });
      if (etapa === 'espera') pintarEspera();
    }).catch(function () {});
    return api;
  }

  R.registrar('prueba', crearPrueba);
})();
