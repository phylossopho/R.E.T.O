/* =========================================================================
   Ejercicio: SEGUIMIENTO SUAVE
   Un punto se mueve y la persona lo sigue solo con los ojos, sin mover la
   cabeza. Python (plan_seguimiento) manda el recorrido en 0..1 del marco y el
   largo acumulado; aqui se interpola POR DISTANCIA (velocidad pareja) con el
   tiempo delta, y se dibuja en x * ancho, y * alto del marco real.

   Con movimiento reducido el punto NO se desliza: salta de posicion en
   posicion (entre 8 y 12) y se queda 1,5 s en cada una.
   ========================================================================= */
(function () {
  'use strict';
  var V = window.RetoVision;
  if (!V) return;

  V.registrar('seguimiento', {
    titulo: 'Seguimiento suave',
    intro: {
      mirar: 'Un punto que se mueve por la pantalla.',
      hacer: 'Síguelo solo con los ojos, sin mover la cabeza. Respira con calma y no te esfuerces.',
      dura: function (a) { return a.duracion + (a.duracion === 1 ? ' minuto.' : ' minutos.') + ' Puedes pausar cuando quieras.'; }
    },
    defectos: {},
    ajustes: [{
      clave: 'trayectoria', tipo: 'select', defecto: 'horizontal', etiqueta: 'Recorrido',
      opciones: [['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['diagonal', 'Diagonal'],
                 ['circulo', 'Círculo'], ['infinito', 'Ocho acostado (infinito)']],
      ayuda: 'La forma que recorre el punto.'
    }],
    crear: function (ctx) {
      var plan = null;
      var punto = null;
      var dist = 0;          // distancia recorrida sobre el recorrido
      var vueltas = 0;
      var paso = 0;          // version por pasos
      var espera = 0;
      var colocadoPaso = false;
      var cargando = false;

      function posicion(d) {
        var a = plan.acumulado;
        var lo = 0, hi = a.length - 1;
        while (lo < hi - 1) {
          var m = (lo + hi) >> 1;
          if (a[m] <= d) lo = m; else hi = m;
        }
        var tramo = (a[hi] - a[lo]) || 1;
        var f = (d - a[lo]) / tramo;
        var p0 = plan.puntos[lo], p1 = plan.puntos[hi];
        return [p0[0] + f * (p1[0] - p0[0]), p0[1] + f * (p1[1] - p0[1])];
      }

      function colocar(xy) {
        if (!punto) return;
        var x = xy[0] * ctx.ancho();
        var y = xy[1] * ctx.alto();
        punto.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
      }

      function pedir() {
        cargando = true;
        return ctx.plan('seguimiento', { trayectoria: ctx.ajustes.trayectoria, nivel: ctx.ajustes.nivel })
          .then(function (p) { plan = p; dist = 0; paso = 0; espera = 0; colocadoPaso = false; cargando = false; colocar(plan.puntos[0]); });
      }

      return {
        montar: function (escena) {
          punto = ctx.el('span', 'vision-punto');
          punto.setAttribute('aria-hidden', 'true');
          escena.appendChild(punto);
          return pedir();
        },
        actualizar: function (dt) {
          if (!plan || cargando) return;
          if (ctx.reducido()) {
            if (!colocadoPaso) { colocar(plan.pasos[paso]); colocadoPaso = true; }
            espera += dt;
            if (espera >= plan.pausa_paso_s) {
              espera = 0;
              paso = (paso + 1) % plan.pasos.length;
              if (paso === 0) vueltas++;
              colocar(plan.pasos[paso]);
            }
            return;
          }
          dist += (plan.velocidad / 100) * dt;
          if (dist >= plan.longitud) { dist -= plan.longitud; vueltas++; }
          colocar(posicion(dist));
        },
        recalcular: function () {
          if (!plan) return;
          colocar(ctx.reducido() ? plan.pasos[paso] : posicion(dist));
        },
        alAjustar: function (clave) {
          if (clave === 'nivel' || clave === 'trayectoria') pedir();
        },
        resumen: function () {
          return ['Seguiste el punto durante ' + Math.round(ctx.tiempo()) + ' segundos.',
                  vueltas ? 'Vueltas completas: ' + vueltas + '.' : 'Buen ritmo, sin prisa.'];
        }
      };
    }
  });
})();
