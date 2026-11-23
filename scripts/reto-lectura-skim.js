/* =========================================================================
   R.E.T.O. - El motor del skimming (lectura diagonal)
   -------------------------------------------------------------------------
   Antes de leer a fondo se da una vista rapida, por pasadas:

     Pasada 1  los titulos ([N1] a [N4]; solo si el texto los trae)
     Pasada 2  la primera frase de cada parrafo
     Pasada 3  el texto con las palabras clave marcadas
     Cierre    "¿de que trata?" y, si se quiere, leerlo a fondo con el pacer
               (la "pasada 4": es otro modo, y aqui solo se ofrece el enlace)

   Python (plan_skimming) decide que va en cada pasada y cuanto dura; aqui solo
   se pinta. Cada pasada avanza sola al cabo de su tiempo, o antes con el boton
   "Siguiente pasada", que SIEMPRE esta: nada depende del reloj. El play/pausa
   del panel arranca y para el avance automatico; sin darle play, las pasadas
   se cambian a mano.

   ACCESIBILIDAD
   - Cada pasada se anuncia por aria-live ("Pasada 2 de 4: primeras frases").
   - Las palabras clave van en negrita + subrayado + fondo (no solo color).
   - Orden de lectura logico en el DOM; los botones son botones de verdad.
   - Sin destellos: lo unico que se mueve es la barra del tiempo, y con
     movimiento reducido no se anima.
   - La respuesta libre no se guarda en ningun lado: es para compararse.
   ========================================================================= */
(function () {
  'use strict';

  var R = window.RetoLecturaMotores;
  if (!R) return;

  var viva = null;

  function crearSkim(ctx, plan) {
    var estado = ctx.estado;
    var marco = ctx.marco;
    var el = R.el;
    var pasadas = plan.pasadas;
    var ultima = pasadas.length - 1;
    var cfg = { segundos: 0 };            // 0 = el que sugiere el plan
    var transcurrido = 0;
    var raf = null;
    var ultimoT = null;
    var paso4 = false;                    // ya se comparo la respuesta
    var inicio = performance.now();
    var registrado = false;

    var escena = el('div', 'skim-escena');
    escena.setAttribute('role', 'region');
    escena.setAttribute('aria-label', 'Lectura diagonal');
    var aviso = el('p', 'skim-aviso');
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('aria-live', 'polite');
    var barra = el('div', 'skim-barra');
    barra.setAttribute('aria-hidden', 'true');
    var relleno = el('span', 'skim-barra-relleno');
    barra.appendChild(relleno);
    var cuerpo = el('div', 'skim-cuerpo');
    cuerpo.tabIndex = -1;
    var pie = el('div', 'skim-pie');
    var btnAnterior = el('button', 'boton', 'Pasada anterior');
    btnAnterior.type = 'button';
    var btnSiguiente = el('button', 'boton boton--principal', 'Siguiente pasada');
    btnSiguiente.type = 'button';
    pie.appendChild(btnAnterior);
    pie.appendChild(btnSiguiente);
    escena.appendChild(aviso);
    escena.appendChild(barra);
    escena.appendChild(cuerpo);
    escena.appendChild(pie);
    marco.setAttribute('data-motor', 'skimming');
    document.body.setAttribute('data-skim', '1');
    marco.appendChild(escena);

    function segundosDe(p) { return cfg.segundos || p.segundos || 20; }

    function pintarBarra() {
      var p = pasadas[estado.posicion];
      var total = p && p.segundos ? segundosDe(p) * 1000 : 0;
      var llena = total ? Math.max(0, 1 - transcurrido / total) : 0;
      relleno.style.transform = 'scaleX(' + llena + ')';
    }

    /* ----------------------------------------------------- cada pasada */
    function pintarTitulos(p) {
      var ul = el('ul', 'skim-titulos');
      p.items.forEach(function (it) {
        var li = el('li', 'skim-titulo skim-nivel-' + (it.nivel || 1), it.texto);
        ul.appendChild(li);
      });
      cuerpo.appendChild(ul);
    }

    function pintarPrimeras(p) {
      p.items.forEach(function (it) { cuerpo.appendChild(el('p', 'skim-frase', it.texto)); });
    }

    function pintarClaves(p) {
      if (plan.claves_sin_repeticion) {
        cuerpo.appendChild(el('p', 'skim-nota', 'Este texto no repite palabras largas; se marcan las más largas.'));
      }
      p.items.forEach(function (it) {
        var par = el('p', 'skim-parrafo');
        it.partes.forEach(function (parte) {
          if (parte[1]) par.appendChild(el('strong', 'skim-clave', parte[0]));
          else par.appendChild(document.createTextNode(parte[0]));
        });
        cuerpo.appendChild(par);
      });
    }

    function pintarCierre() {
      var h = el('h2', 'skim-pregunta-titulo', '¿De qué trata este texto?');
      var ayuda = el('p', 'skim-nota', 'Escríbelo con tus palabras. No se guarda: es solo para que te compares.');
      var campo = el('textarea', 'editor-campo skim-respuesta');
      campo.id = 'skim-respuesta';
      campo.rows = 4;
      campo.setAttribute('aria-label', 'Qué crees que dice el texto');
      var comparar = el('button', 'boton boton--principal', 'Compararlo con el texto');
      comparar.type = 'button';
      var referencia = el('div', 'skim-referencia');
      referencia.hidden = true;
      referencia.tabIndex = -1;
      cuerpo.appendChild(h);
      cuerpo.appendChild(ayuda);
      cuerpo.appendChild(campo);
      cuerpo.appendChild(comparar);
      cuerpo.appendChild(referencia);

      comparar.addEventListener('click', function () {
        paso4 = true;
        referencia.hidden = false;
        referencia.textContent = '';
        referencia.appendChild(el('h3', 'skim-referencia-titulo', 'Lo que decía el texto'));
        var primeras = plan.primeras_frases || [];
        var lista = el('ul', 'skim-lista');
        primeras.slice(0, 6).forEach(function (f) { lista.appendChild(el('li', '', f)); });
        referencia.appendChild(lista);
        if (plan.claves && plan.claves.length) {
          referencia.appendChild(el('p', 'skim-nota', 'Palabras clave: ' + plan.claves.slice(0, 10).join(', ') + '.'));
        }
        var acciones = el('div', 'skim-acciones');
        var pacer = el('a', 'boton boton--principal', 'Leerlo a fondo con el pacer');
        pacer.href = 'practica.html?motor=pacer&id=' + encodeURIComponent(estado.textoId || '');
        var fin = el('button', 'boton', 'Terminar');
        fin.type = 'button';
        fin.addEventListener('click', function () {
          registrar();
          ctx.detener();
          aviso.textContent = 'Terminaste la lectura diagonal. ¡Buen trabajo!';
        });
        acciones.appendChild(pacer);
        acciones.appendChild(fin);
        referencia.appendChild(acciones);
        registrar();
        referencia.focus();
      });
    }

    function pintarPasada() {
      var p = pasadas[estado.posicion];
      cuerpo.textContent = '';
      transcurrido = 0;
      escena.setAttribute('data-pasada', p.clave);
      var anuncio = p.clave === 'pacer' ? 'Cierre: ¿de qué trata?' : p.aviso;
      aviso.textContent = anuncio;
      if (p.clave === 'titulos') pintarTitulos(p);
      else if (p.clave === 'primeras') pintarPrimeras(p);
      else if (p.clave === 'claves') pintarClaves(p);
      else pintarCierre();
      btnAnterior.disabled = estado.posicion <= 0;
      btnSiguiente.hidden = estado.posicion >= ultima;
      cuerpo.scrollTop = 0;
      pintarBarra();
    }

    function ir(delta) {
      var n = estado.posicion + delta;
      if (n < 0 || n > ultima) return;
      estado.posicion = n;
      pintarPasada();
      if (n === ultima) { api.pausar(); ctx.detener(); }
    }

    function registrar() {
      if (registrado || !window.RetoProgreso) return;
      var minutos = (performance.now() - inicio) / 60000;
      registrado = true;
      try {
        window.RetoProgreso.registrarSesion({
          tipo: 'lectura', motor: 'skimming', minutos: minutos, palabras: plan.total_palabras
        });
      } catch (e) {}
    }

    btnAnterior.addEventListener('click', function () { ir(-1); });
    btnSiguiente.addEventListener('click', function () { ir(1); });

    function paso(t) {
      raf = null;
      if (!estado.leyendo) return;
      var dt = ultimoT === null ? 0 : Math.min(t - ultimoT, 100);
      ultimoT = t;
      var p = pasadas[estado.posicion];
      transcurrido += dt;
      if (p.segundos && transcurrido >= segundosDe(p) * 1000) {
        ir(1);
        if (!estado.leyendo) return;
      }
      pintarBarra();
      raf = requestAnimationFrame(paso);
    }

    var api = {
      reanudar: function () {
        if (estado.posicion >= ultima) { api.reiniciar(); }
        if (raf !== null) return;
        ultimoT = null;
        raf = requestAnimationFrame(paso);
      },
      pausar: function () {
        if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
        ultimoT = null;
      },
      reiniciar: function () {
        api.pausar();
        estado.posicion = 0;
        paso4 = false;
        pintarPasada();
      },
      medir: function () {},
      limpiar: function () {
        api.pausar();
        if (marco.contains(escena)) marco.removeChild(escena);
        marco.removeAttribute('data-motor');
        document.body.removeAttribute('data-skim');
        document.body.removeAttribute('data-modo');
        if (viva === api) viva = null;
      },
      ajustes: {
        obtener: function () { return { segundos: cfg.segundos }; },
        poner: function (clave, valor) {
          if (clave !== 'segundos') return;
          var v = parseInt(valor, 10);
          cfg.segundos = (v >= plan.segundos_pasada.min && v <= plan.segundos_pasada.max) ? v : 0;
          ctx.guardar('skim_ajustes', cfg);
          pintarBarra();
        }
      }
    };

    estado.posicion = 0;
    viva = api;
    ctx.recuperar('skim_ajustes').then(function (g) {
      if (g && typeof g.segundos === 'number') cfg.segundos = g.segundos;
    }).catch(function () {}).then(pintarPasada);
    pintarPasada();
    return api;
  }

  var modal = null;
  var control = null;

  function abrirAjustes() {
    if (!viva) return;
    if (!modal) {
      modal = R.dialogo('skim-ajustes', 'Ajustes de la lectura diagonal');
      control = R.campoSelect(modal.cuerpo, 'skim-segundos', 'Tiempo de cada pasada',
        [[0, 'El que sugiere el texto (15 a 30 s)'], [10, '10 segundos'], [15, '15 segundos'],
         [20, '20 segundos'], [30, '30 segundos'], [45, '45 segundos'], [60, '1 minuto']],
        'Es solo para el avance automático (botón ▶). Con "Siguiente pasada" avanzas cuando quieras.',
        function (v) { if (viva) viva.ajustes.poner('segundos', v); });
    }
    control.value = String(viva.ajustes.obtener().segundos);
    modal.abrir();
  }

  R.registrar('skimming', crearSkim, abrirAjustes);
})();
