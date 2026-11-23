/* =========================================================================
   Ejercicio: ENFOQUE CERCA Y LEJOS
   Alternar el enfoque entre algo cercano (la pantalla) y algo lejano (mirar por
   la ventana). La app guia: "mira un objeto a unos 6 metros durante 20
   segundos". Python (plan_enfoque) reparte las fases; aqui solo hay una cuenta
   regresiva grande con su mensaje, sin sonido obligatorio.

   ACCESIBILIDAD: texto instruccional claro; el temporizador visual NO se anuncia
   cada segundo: aria-live al cambiar de fase y cada 5 s (4.1.3). Se puede saltar
   una fase y pausar con el panel.
   ========================================================================= */
(function () {
  'use strict';
  var V = window.RetoVision;
  if (!V) return;

  V.registrar('enfoque', {
    titulo: 'Enfoque cerca y lejos',
    intro: {
      mirar: 'Alternas entre un punto de esta pantalla (cerca) y un objeto lejano, a unos 6 metros, por ejemplo por la ventana (lejos).',
      hacer: 'Sigue el mensaje de la pantalla. Cuando diga "lejos", levanta la vista y mira algo a lo lejos; cuando diga "cerca", vuelve al punto.',
      dura: function (a) { return a.duracion + (a.duracion === 1 ? ' minuto.' : ' minutos.') + ' Veinte segundos mirando lejos y unos segundos cerca, varias veces.'; }
    },
    crear: function (ctx) {
      var plan = null, fases = [], k = 0, restante = 0, ultimoAviso = 0;
      var mensaje, numero, punto, saltar, fase = null, ciclos = 0;

      function aplicar() {
        fase = fases[k];
        restante = fase.seg;
        ultimoAviso = restante;
        mensaje.textContent = fase.mensaje;
        numero.textContent = Math.ceil(restante);
        punto.hidden = fase.fase !== 'cerca';
        numero.parentNode.setAttribute('data-fase', fase.fase);
        ctx.anunciar((fase.fase === 'lejos' ? 'Mira lejos. ' : 'Mira cerca. ') + fase.mensaje);
      }

      function siguiente() {
        k++;
        if (k >= fases.length) { ctx.terminar(); return; }
        if (fases[k].fase === 'lejos') ciclos++;
        aplicar();
      }

      return {
        montar: function (escena) {
          var caja = ctx.el('div', 'vision-pantalla vision-enfoque');
          mensaje = ctx.el('p', 'vision-enfoque-mensaje', '');
          numero = ctx.el('p', 'vision-contador', '');
          numero.setAttribute('aria-hidden', 'true');
          punto = ctx.el('span', 'vision-punto vision-punto--fijo');
          punto.setAttribute('aria-hidden', 'true');
          saltar = ctx.el('button', 'boton', 'Saltar esta parte');
          saltar.type = 'button';
          saltar.addEventListener('click', siguiente);
          caja.appendChild(mensaje);
          caja.appendChild(numero);
          caja.appendChild(punto);
          caja.appendChild(saltar);
          escena.appendChild(caja);
          return ctx.plan('enfoque', { duracion_min: ctx.ajustes.duracion, nivel: ctx.ajustes.nivel }).then(function (p) {
            plan = p; fases = p.fases; k = 0; ciclos = 1; aplicar();
          });
        },
        actualizar: function (dt) {
          if (!fase) return;
          restante -= dt;
          numero.textContent = Math.max(0, Math.ceil(restante));
          // Cada 5 s, no cada segundo.
          if (Math.ceil(restante) <= ultimoAviso - 5 && restante > 0) {
            ultimoAviso = Math.ceil(restante);
            ctx.anunciar('Quedan ' + ultimoAviso + ' segundos.');
          }
          if (restante <= 0) siguiente();
        },
        alAjustar: function (clave) { /* el nivel cambia la proxima vez */ },
        resumen: function () { return ['Alternaste el enfoque ' + ciclos + (ciclos === 1 ? ' vez.' : ' veces.')]; }
      };
    }
  });
})();
