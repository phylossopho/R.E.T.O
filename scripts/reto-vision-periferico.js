/* =========================================================================
   Ejercicio: PUNTO CENTRAL CON ESTIMULOS PERIFERICOS
   Se mira un punto fijo al centro; en los bordes aparece una figura o un numero
   un instante; hay que decir cual fue SIN mover los ojos. Amplia la atencion
   periferica (util para los modos Grupos y Galactico).

   Python (plan_periferico) elige el estimulo y su posicion en polares (radio:
   fraccion de la mitad del lado corto del marco; asi cae a la misma distancia
   visual en cualquier pantalla) y /api/vision/ajustar sube o baja el nivel: sube
   tras 3 aciertos seguidos y, si se falla, baja un nivel EN SILENCIO.

   El estimulo se ve al menos 400 ms con un fundido de 100 ms (no es un destello
   de pantalla). "Sin tiempo": el estimulo se queda hasta que se pulsa "Ya lo vi".
   Se responde con botones grandes o con las teclas 1 a 4.
   ========================================================================= */
(function () {
  'use strict';
  var V = window.RetoVision;
  if (!V) return;

  V.registrar('periferico', {
    titulo: 'Punto central y periferia',
    rapido: true,
    intro: {
      mirar: 'Un punto fijo en el centro. Durante un instante aparecerá una figura o un número en los bordes.',
      hacer: 'No muevas los ojos del punto. Después elige qué apareció (con los botones o con las teclas 1 a 4).',
      dura: function (a) { return a.duracion + (a.duracion === 1 ? ' minuto.' : ' minutos.') + ' Cada figura se ve menos de un segundo, sin parpadeos.'; }
    },
    ajustes: [{
      clave: 'sin_tiempo', tipo: 'check', defecto: false, etiqueta: 'Sin límite de tiempo',
      ayuda: 'La figura se queda hasta que pulses "Ya lo vi".'
    }],
    crear: function (ctx) {
      var rondas = [], r = 0, nivel = 2, racha = 0, tiempoMs = 0;
      var estimulo = null, centro = null, opcionesEl = null, listoBtn = null, escenaEl = null;
      var fase = 'espera', t = 0, aciertos = 0, total = 0, maxNivel = 1, cargando = false;

      function cargar() {
        cargando = true;
        return ctx.plan('periferico', { nivel: nivel, cantidad: 12, sin_tiempo: !!ctx.ajustes.sin_tiempo })
          .then(function (p) { rondas = p.rondas; r = 0; tiempoMs = p.tiempo_ms; cargando = false; });
      }

      function posicion(ronda) {
        var R = Math.min(ctx.ancho(), ctx.alto()) / 2;
        return [ctx.ancho() / 2 + Math.cos(ronda.angulo) * ronda.radio * R * 0.92,
                ctx.alto() / 2 + Math.sin(ronda.angulo) * ronda.radio * R * 0.92];
      }

      function mostrarEstimulo() {
        var ronda = rondas[r];
        var xy = posicion(ronda);
        estimulo.textContent = ronda.valor;
        estimulo.style.transform = 'translate(' + xy[0] + 'px,' + xy[1] + 'px) translate(-50%,-50%)';
        estimulo.classList.add('vision-visible');
        fase = 'estimulo'; t = 0;
        if (tiempoMs === 0) {
          listoBtn = ctx.el('button', 'boton boton--principal vision-grande vision-listo', 'Ya lo vi');
          listoBtn.type = 'button';
          listoBtn.addEventListener('click', ocultarEstimulo);
          escenaEl.appendChild(listoBtn);
          listoBtn.focus({ preventScroll: true });
        }
      }

      function ocultarEstimulo() {
        estimulo.classList.remove('vision-visible');
        if (listoBtn) { listoBtn.remove(); listoBtn = null; }
        fase = 'respuesta';
        var ronda = rondas[r];
        opcionesEl = ctx.el('div', 'vision-opciones vision-opciones--abajo');
        opcionesEl.setAttribute('role', 'group');
        opcionesEl.setAttribute('aria-label', '¿Qué apareció?');
        ronda.opciones.forEach(function (o, k) {
          var b = ctx.el('button', 'boton vision-opcion', o);
          b.type = 'button';
          b.setAttribute('aria-label', (k + 1) + ': ' + (ronda.tipo === 'numero' ? o : o));
          b.addEventListener('click', function () { responder(k); });
          opcionesEl.appendChild(b);
        });
        escenaEl.appendChild(opcionesEl);
        opcionesEl.querySelector('button').focus({ preventScroll: true });
      }

      function responder(k) {
        if (fase !== 'respuesta') return;
        var ronda = rondas[r];
        var ok = k === ronda.correcta;
        total++; if (ok) aciertos++;
        opcionesEl.remove(); opcionesEl = null;
        fase = 'ajuste';
        ctx.anunciar(ok ? 'Sí.' : 'Era ' + ronda.nombre + '.');
        ctx.ajustar('periferico', { nivel: nivel, racha: racha, acerto: ok }).then(function (n) {
          var cambio = n.nivel !== nivel;
          nivel = n.nivel; racha = n.racha; maxNivel = Math.max(maxNivel, nivel);
          r++;
          if (cambio || r >= rondas.length) return cargar();
        }).then(function () { fase = 'espera'; t = 0; });
      }

      function teclas(e) {
        if (fase !== 'respuesta' || e.target.tagName === 'INPUT') return;
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= 4 && rondas[r] && n <= rondas[r].opciones.length) responder(n - 1);
      }

      return {
        montar: function (escena) {
          escenaEl = escena;
          nivel = ctx.ajustes.nivel;
          centro = ctx.el('span', 'vision-punto vision-punto--centro');
          centro.setAttribute('aria-hidden', 'true');
          estimulo = ctx.el('span', 'vision-estimulo');
          estimulo.setAttribute('aria-hidden', 'true');
          escena.appendChild(centro);
          escena.appendChild(estimulo);
          document.addEventListener('keydown', teclas);
          return cargar().then(function () { fase = 'espera'; t = 0; });
        },
        actualizar: function (dt) {
          if (cargando) return;
          t += dt;
          if (fase === 'espera' && t >= 0.9) mostrarEstimulo();
          else if (fase === 'estimulo' && tiempoMs > 0 && t >= tiempoMs / 1000) ocultarEstimulo();
        },
        alAjustar: function (clave) {
          if (clave === 'nivel') { nivel = ctx.ajustes.nivel; racha = 0; cargar(); }
          if (clave === 'sin_tiempo') cargar();
        },
        limpiar: function () { document.removeEventListener('keydown', teclas); },
        resumen: function () {
          return ['Respuestas correctas: ' + aciertos + ' de ' + total + '.', 'Nivel más alto: ' + maxNivel + ' de 5.'];
        }
      };
    }
  });
})();
