/* =========================================================================
   Ejercicio: SACADAS (SALTOS)
   Aparecen puntos, uno por vez, en distintos lugares; la mirada salta de uno a
   otro. Es lo mas parecido a lo que hacen los ojos al leer. Python
   (plan_sacadas) manda la secuencia con distancias crecientes y el tiempo de
   permanencia (nunca menos de 700 ms).

   Cada punto aparece con un fundido de 100 ms (sin cambios bruscos de brillo).
   No hay respuesta que dar. OPCIONAL (apagado): un mini reto "que simbolo
   aparecio" cada cinco puntos, sin tiempo y sin castigo. OPCIONAL (apagado):
   narrar cada punto por aria-live.
   ========================================================================= */
(function () {
  'use strict';
  var V = window.RetoVision;
  if (!V) return;

  var PREGUNTA_CADA = 5;

  function descripcion(p) {
    var h = p.x < 0.4 ? 'a la izquierda' : (p.x > 0.6 ? 'a la derecha' : 'al centro');
    var v = p.y < 0.4 ? 'arriba' : (p.y > 0.6 ? 'abajo' : '');
    return 'Punto ' + (v ? v + ' ' : '') + h;
  }

  V.registrar('sacadas', {
    titulo: 'Sacadas (saltos)',
    intro: {
      mirar: 'Puntos que aparecen de uno en uno, en distintos lugares.',
      hacer: 'Salta con la mirada de un punto al siguiente, sin mover la cabeza. No hay nada que responder, solo mirar.',
      dura: function (a) { return a.duracion + (a.duracion === 1 ? ' minuto.' : ' minutos.') + ' Cada punto se queda más de medio segundo.'; }
    },
    ajustes: [
      { clave: 'variante', tipo: 'select', defecto: 'horizontal', etiqueta: 'Dirección de los saltos',
        opciones: [['horizontal', 'Horizontales (como un renglón)'], ['vertical', 'Verticales'], ['aleatoria', 'Al azar']] },
      { clave: 'reto', tipo: 'check', defecto: false, etiqueta: 'Mini reto: ¿qué símbolo apareció?',
        ayuda: 'Cada cinco puntos te pregunta qué símbolo viste. Sin tiempo y sin castigo.' },
      { clave: 'narrar', tipo: 'check', defecto: false, etiqueta: 'Narrar cada punto (lector de pantalla)',
        ayuda: 'Anuncia dónde aparece cada punto. Apagado por defecto para no saturar.' }
    ],
    crear: function (ctx) {
      var plan = null, punto = null, escenaEl = null;
      var i = 0, t = 0, espera = false, visto = 0, aciertos = 0, preguntas = 0, panel = null;

      function mostrar() {
        var p = plan.puntos[i % plan.puntos.length];
        punto.style.transform = 'translate(' + (p.x * ctx.ancho()) + 'px,' + (p.y * ctx.alto()) + 'px) translate(-50%,-50%)';
        punto.textContent = ctx.ajustes.reto ? p.simbolo : '';
        punto.classList.remove('vision-aparece');
        void punto.offsetWidth;
        punto.classList.add('vision-aparece');
        if (ctx.ajustes.narrar) ctx.anunciar(descripcion(p));
      }

      function preguntar(ultimo) {
        espera = true;
        panel = ctx.el('div', 'vision-pregunta');
        panel.appendChild(ctx.el('p', 'vision-pregunta-texto', '¿Qué símbolo viste?'));
        var fila = ctx.el('div', 'vision-opciones');
        plan.simbolos.forEach(function (s, k) {
          var b = ctx.el('button', 'boton vision-opcion', s);
          b.type = 'button';
          b.setAttribute('aria-label', (k + 1) + ': ' + (s === '▲' ? 'triángulo' : (s === '●' ? 'círculo' : 'cuadrado')));
          b.addEventListener('click', function () {
            preguntas++;
            if (s === ultimo) aciertos++;
            ctx.anunciar(s === ultimo ? 'Sí.' : 'Era ' + ultimo + '.');
            panel.remove(); panel = null; espera = false; t = 0; i++; mostrar();
          });
          fila.appendChild(b);
        });
        panel.appendChild(fila);
        escenaEl.appendChild(panel);
        panel.querySelector('button').focus({ preventScroll: true });
        punto.textContent = '';
      }

      function cargar() {
        return ctx.plan('sacadas', { variante: ctx.ajustes.variante, nivel: ctx.ajustes.nivel,
                                     cantidad: 40, reto: !!ctx.ajustes.reto }).then(function (p) {
          plan = p; i = 0; t = 0; mostrar();
        });
      }

      return {
        montar: function (escena) {
          escenaEl = escena;
          punto = ctx.el('span', 'vision-punto vision-punto--simbolo');
          punto.setAttribute('aria-hidden', 'true');
          escena.appendChild(punto);
          return cargar();
        },
        actualizar: function (dt) {
          if (!plan || espera) return;
          t += dt;
          if (t >= Math.max(plan.permanencia_s, plan.intervalo_min_s)) {
            t = 0; visto++;
            var actual = plan.puntos[i % plan.puntos.length];
            if (plan.reto && visto % PREGUNTA_CADA === 0) { preguntar(actual.simbolo); return; }
            i++; mostrar();
          }
        },
        recalcular: function () { if (plan) mostrar(); },
        alAjustar: function (clave) { if (clave === 'nivel' || clave === 'variante' || clave === 'reto') cargar(); },
        pausar: function () {},
        resumen: function () {
          var r = ['Miraste ' + visto + ' puntos.'];
          if (preguntas) r.push('Símbolos acertados: ' + aciertos + ' de ' + preguntas + '.');
          return r;
        }
      };
    }
  });
})();
