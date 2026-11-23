/* =========================================================================
   Ejercicio: DESTELLO BREVE (MEMORIA VISUAL RAPIDA)
   Se muestran de 3 a 6 palabras, numeros o figuras durante una fraccion de
   segundo y luego se ELIGE cual fue el grupo. Entrena a percibir grupos de
   palabras de golpe (conecta con el modo Grupos).

   NO ES UN PARPADEO (WCAG 2.3.1). El material se muestra UNA vez, con un fundido
   de 100 ms al entrar y al salir, sobre el mismo fondo (sin alternar con blanco
   ni cambiar la luminancia de golpe). Python decide la exposicion: empieza en
   1000 ms, baja 100 ms por acierto hasta el minimo (por defecto 500; nunca menos
   de 300; con sensibilidad a la luz o movimiento reducido, nunca menos de 800), y
   sube en silencio si se falla. "Sin tiempo": el material se queda hasta que se
   pulsa "Ya lo vi".
   ========================================================================= */
(function () {
  'use strict';
  var V = window.RetoVision;
  if (!V) return;

  V.registrar('destello', {
    titulo: 'Destello breve',
    rapido: true,
    sensible: true,
    intro: {
      mirar: 'Un grupo de palabras, números o figuras que se ve una fracción de segundo.',
      hacer: 'Míralo con calma y luego elige, entre cuatro opciones, cuál fue (con los botones o con las teclas 1 a 4).',
      dura: function (a) { return a.duracion + (a.duracion === 1 ? ' minuto.' : ' minutos.') + ' Sin parpadeos: se ve una vez y se apaga suavemente.'; }
    },
    ajustes: [
      { clave: 'material', tipo: 'select', defecto: 'palabras', etiqueta: 'Material',
        opciones: [['palabras', 'Palabras'], ['numeros', 'Números'], ['figuras', 'Figuras']] },
      { clave: 'cantidad', tipo: 'select', defecto: 4, etiqueta: 'Cuántos elementos',
        opciones: [[3, '3'], [4, '4'], [5, '5'], [6, '6']] },
      { clave: 'minimo', tipo: 'select', defecto: 500, etiqueta: 'Exposición mínima',
        opciones: [[300, '300 ms'], [500, '500 ms (por defecto)'], [800, '800 ms'], [1000, '1 segundo']],
        ayuda: 'Lo más corto que puede llegar a verse. Con sensibilidad a la luz nunca baja de 800 ms.' },
      { clave: 'sin_tiempo', tipo: 'check', defecto: false, etiqueta: 'Sin límite de tiempo',
        ayuda: 'El grupo se queda hasta que pulses "Ya lo vi".' }
    ],
    crear: function (ctx) {
      var ronda = null, exposicion = 1000, fase = 'espera', t = 0;
      var caja = null, opcionesEl = null, listoBtn = null, escenaEl = null;
      var aciertos = 0, total = 0, mejor = 1000, cargando = false;

      function sensible() { return !!ctx.ajustes.sensible; }

      function cargar() {
        cargando = true;
        return ctx.plan('destello', {
          material: ctx.ajustes.material, cantidad: ctx.ajustes.cantidad, exposicion_ms: exposicion,
          minimo_ms: ctx.ajustes.minimo, sensible: sensible(), reducido: ctx.reducido()
        }).then(function (r) { ronda = r; exposicion = r.exposicion_ms; cargando = false; });
      }

      function mostrar() {
        ctx.vaciar(caja);
        ronda.items.forEach(function (it) { caja.appendChild(ctx.el('span', 'vision-item', it)); });
        caja.classList.add('vision-visible');
        fase = 'mira'; t = 0;
        if (ctx.ajustes.sin_tiempo) {
          listoBtn = ctx.el('button', 'boton boton--principal vision-grande vision-listo', 'Ya lo vi');
          listoBtn.type = 'button';
          listoBtn.addEventListener('click', ocultar);
          escenaEl.appendChild(listoBtn);
          listoBtn.focus({ preventScroll: true });
        }
      }

      function ocultar() {
        caja.classList.remove('vision-visible');
        if (listoBtn) { listoBtn.remove(); listoBtn = null; }
        fase = 'respuesta';
        opcionesEl = ctx.el('div', 'vision-opciones vision-opciones--lista');
        opcionesEl.setAttribute('role', 'group');
        opcionesEl.setAttribute('aria-label', '¿Cuál fue el grupo?');
        ronda.opciones.forEach(function (o, k) {
          var b = ctx.el('button', 'boton vision-opcion vision-opcion--grupo', o.join('  '));
          b.type = 'button';
          b.setAttribute('aria-label', (k + 1) + ': ' + o.join(', '));
          b.addEventListener('click', function () { responder(k); });
          opcionesEl.appendChild(b);
        });
        escenaEl.appendChild(opcionesEl);
        opcionesEl.querySelector('button').focus({ preventScroll: true });
      }

      function responder(k) {
        if (fase !== 'respuesta') return;
        var ok = k === ronda.correcta;
        total++; if (ok) aciertos++;
        opcionesEl.remove(); opcionesEl = null;
        fase = 'ajuste';
        ctx.anunciar(ok ? 'Sí.' : 'Era: ' + ronda.items.join(', ') + '.');
        ctx.ajustar('destello', { exposicion_ms: exposicion, acerto: ok, minimo_ms: ctx.ajustes.minimo,
                                  sensible: sensible(), reducido: ctx.reducido() }).then(function (n) {
          exposicion = n.exposicion_ms; mejor = Math.min(mejor, exposicion);
          return cargar();
        }).then(function () { fase = 'espera'; t = 0; });
      }

      function teclas(e) {
        if (fase !== 'respuesta') return;
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= 4) responder(n - 1);
      }

      return {
        montar: function (escena) {
          escenaEl = escena;
          caja = ctx.el('div', 'vision-destello');
          caja.setAttribute('aria-hidden', 'true');
          var centro = ctx.el('span', 'vision-punto vision-punto--centro');
          centro.setAttribute('aria-hidden', 'true');
          escena.appendChild(centro);
          escena.appendChild(caja);
          document.addEventListener('keydown', teclas);
          return cargar().then(function () { fase = 'espera'; t = 0; });
        },
        actualizar: function (dt) {
          if (cargando) return;
          t += dt;
          if (fase === 'espera' && t >= 1) mostrar();
          else if (fase === 'mira' && !ctx.ajustes.sin_tiempo && t >= exposicion / 1000) ocultar();
        },
        alAjustar: function (clave) { if (clave !== 'nivel') cargar(); },
        limpiar: function () { document.removeEventListener('keydown', teclas); },
        resumen: function () {
          return ['Respuestas correctas: ' + aciertos + ' de ' + total + '.',
                  total ? 'Lo más corto que viste bien: ' + mejor + ' ms.' : 'Sin prisa: la próxima vez.'];
        }
      };
    }
  });
})();
