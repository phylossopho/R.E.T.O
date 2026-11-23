/* =========================================================================
   Ejercicio: SIGUIENTE EN LA FILA
   Una hilera de letras o numeros donde se resalta uno y la mirada salta al
   siguiente: entrena el avance de izquierda a derecha y el cambio de renglon.
   Se arma con la MISMA regla del pacer (plan_fila usa plan_pacer: cada renglon
   es un parrafo y cada simbolo un tramo; el fin de renglon pesa mas, con tope).

   El resaltado es relleno + borde (no solo color). Las filas se acomodan al
   ancho del marco: en pantallas angostas caben menos simbolos por fila y el
   plan se vuelve a pedir (reflujo).
   ========================================================================= */
(function () {
  'use strict';
  var V = window.RetoVision;
  if (!V) return;

  V.registrar('fila', {
    titulo: 'Siguiente en la fila',
    intro: {
      mirar: 'Filas de letras o números. Uno está resaltado.',
      hacer: 'Lleva la mirada al símbolo resaltado, y luego al siguiente, de izquierda a derecha, fila por fila. No hay que tocar nada.',
      dura: function (a) { return a.duracion + (a.duracion === 1 ? ' minuto.' : ' minutos.') + ' El resaltado avanza solo.'; }
    },
    ajustes: [{
      clave: 'tipo', tipo: 'select', defecto: 'letras', etiqueta: 'Símbolos',
      opciones: [['letras', 'Letras'], ['numeros', 'Números'], ['mixto', 'Letras y números']]
    }],
    crear: function (ctx) {
      var plan = null, caja = null, spans = [], idx = 0, t = 0, avance = 0, rondas = 0;
      var porFila = 0;

      function medidas() {
        var lado = Math.max(ctx.objetivo() * 1.1, 28);
        var cols = Math.floor((ctx.ancho() * 0.92) / (lado * 1.5));
        var filas = Math.floor((ctx.alto() * 0.72) / (lado * 1.7));
        return { cols: Math.max(3, Math.min(12, cols)), filas: Math.max(2, Math.min(6, filas)), lado: lado };
      }

      function dibujar() {
        ctx.vaciar(caja);
        spans = [];
        plan.filas.forEach(function (fila) {
          var f = ctx.el('div', 'vision-fila');
          fila.forEach(function (s) {
            var e = ctx.el('span', 'vision-simbolo', s);
            f.appendChild(e);
            spans.push(e);
          });
          caja.appendChild(f);
        });
      }

      function marcar() {
        spans.forEach(function (e) { e.classList.remove('vision-activo'); });
        var tr = plan.tramos[idx];
        if (!tr) return;
        for (var k = tr.desde; k <= tr.hasta; k++) if (spans[k]) spans[k].classList.add('vision-activo');
      }

      function cargar() {
        var m = medidas();
        porFila = m.cols;
        caja.style.setProperty('--simbolo', m.lado + 'px');
        return ctx.plan('fila', { tipo: ctx.ajustes.tipo, nivel: ctx.ajustes.nivel, por_fila: m.cols, filas: m.filas })
          .then(function (p) { plan = p; idx = 0; t = 0; dibujar(); marcar(); });
      }

      return {
        montar: function (escena) {
          caja = ctx.el('div', 'vision-filas');
          caja.setAttribute('aria-hidden', 'true');
          escena.appendChild(caja);
          return cargar();
        },
        actualizar: function (dt) {
          if (!plan) return;
          t += dt;
          var tr = plan.tramos[idx];
          var dur = (plan.ms_por_simbolo / 1000) * (tr ? tr.peso : 1);
          if (t >= dur) {
            t = 0; avance++;
            idx++;
            if (idx >= plan.tramos.length) { idx = 0; rondas++; cargar(); return; }
            marcar();
          }
        },
        recalcular: function () { if (plan && medidas().cols !== porFila) cargar(); },
        alAjustar: function (clave) { if (clave === 'nivel' || clave === 'tipo') cargar(); },
        resumen: function () { return ['Recorriste ' + avance + ' símbolos.']; }
      };
    }
  });
})();
