/* =========================================================================
   Ejercicio: PIRAMIDE DE LETRAS
   Filas centradas cuyo ancho crece (1 letra, 3, 5, 7...), con la mirada en una
   linea central: sirve para captar cada vez mas de un vistazo.

   Python (plan_piramide) arma las filas segun lo que cabe: el navegador dice
   cuantas letras caben de ancho y cuantas filas de alto. Si no cabe, se REDUCE
   EL NUMERO DE FILAS y no el tamano de la letra (minimo 24 px). Fuente
   monoespaciada; la fila del centro lleva una linea guia de alto contraste.
   Cada piramide se queda unos segundos (segun la velocidad) y luego sale otra;
   "a mi ritmo" la cambia el boton "Otra piramide".
   ========================================================================= */
(function () {
  'use strict';
  var V = window.RetoVision;
  if (!V) return;

  V.registrar('piramide', {
    titulo: 'Pirámide de letras',
    intro: {
      mirar: 'Filas de letras que crecen hacia abajo, con una línea guía en el centro.',
      hacer: 'Mantén la mirada en la línea del centro y trata de ver cada fila entera de un vistazo, sin recorrerla con los ojos.',
      dura: function (a) { return a.duracion + (a.duracion === 1 ? ' minuto.' : ' minutos.') + ' La pirámide cambia sola o a tu ritmo.'; }
    },
    ajustes: [{
      clave: 'ritmo', tipo: 'select', defecto: 'auto', etiqueta: 'Cuándo cambia la pirámide',
      opciones: [['auto', 'Sola, cada pocos segundos'], ['manual', 'A mi ritmo: con el botón o la tecla Intro']]
    }],
    crear: function (ctx) {
      var plan = null, caja = null, t = 0, vistas = 0, escenaEl = null, sig = null;

      function letraPx() {
        var base = Math.max(24, ctx.objetivo() * 0.7);
        return base * [1, 1.3, 1.7][(ctx.ajustes.letra || 1) - 1];
      }

      function cargar() {
        var px = letraPx();
        var cw = px * 0.62 + 3;                   // ancho de una letra monoespaciada + espacio
        var maxAncho = Math.floor((ctx.ancho() * 0.9) / cw);
        var maxFilas = Math.floor((ctx.alto() * 0.8) / (px * 1.55));
        return ctx.plan('piramide', { max_ancho: maxAncho, max_filas: maxFilas, nivel: ctx.ajustes.nivel })
          .then(function (p) { plan = p; t = 0; dibujar(); });
      }

      function dibujar() {
        if (!caja) return;
        ctx.vaciar(caja);
        caja.style.setProperty('--piramide', letraPx() + 'px');
        var guia = ctx.el('span', 'vision-guia-central');
        guia.setAttribute('aria-hidden', 'true');
        caja.appendChild(guia);
        plan.filas.forEach(function (f) {
          var fila = ctx.el('div', 'vision-piramide-fila', f);
          caja.appendChild(fila);
        });
        vistas++;
      }

      function teclas(e) {
        if (ctx.ajustes.ritmo === 'manual' && e.key === 'Enter' && !document.querySelector('dialog[open]') &&
            e.target.tagName !== 'BUTTON') { e.preventDefault(); cargar(); }
      }

      return {
        montar: function (escena) {
          escenaEl = escena;
          caja = ctx.el('div', 'vision-piramide');
          caja.setAttribute('aria-hidden', 'true');
          escena.appendChild(caja);
          sig = ctx.el('button', 'boton vision-otra', 'Otra pirámide');
          sig.type = 'button';
          sig.addEventListener('click', cargar);
          sig.hidden = ctx.ajustes.ritmo !== 'manual';
          escena.appendChild(sig);
          document.addEventListener('keydown', teclas);
          return cargar();
        },
        actualizar: function (dt) {
          if (!plan || ctx.ajustes.ritmo === 'manual') return;
          t += dt;
          if (t >= plan.segundos) cargar();
        },
        recalcular: function () { if (plan) cargar(); },
        alAjustar: function (clave) {
          if (sig) sig.hidden = ctx.ajustes.ritmo !== 'manual';
          if (clave === 'nivel' || clave === 'letra' || clave === 'tam') cargar();
        },
        limpiar: function () { document.removeEventListener('keydown', teclas); },
        resumen: function () { return ['Miraste ' + vistas + ' pirámides.']; }
      };
    }
  });
})();
