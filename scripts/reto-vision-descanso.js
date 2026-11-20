/* =========================================================================
   Ejercicio: PAUSA 20-20-20 Y PARPADEO CONSCIENTE
   - Pausa 20-20-20: mirar a unos 6 metros durante 20 segundos. Aqui se hace
     guiada, ahora mismo. Los AVISOS cada 20 minutos de uso continuo viven en
     reto-descanso.js y se activan tambien dentro de las lecturas y de los demas
     ejercicios; esta pagina es donde se activan, se apagan y se cambia el
     intervalo (se guardan en vision-ajustes-descanso, que reto-descanso.js lee).
   - Parpadeo consciente: un circulo que se cierra y abre despacio marca el ritmo.
     Es una animacion de ESCALA Y OPACIDAD suave, nunca un parpadeo de pantalla.
     Con movimiento reducido: texto ("Parpadea 3 veces") y una barra de progreso
     que avanza por pasos, sin animacion.
   ========================================================================= */
(function () {
  'use strict';
  var V = window.RetoVision;
  if (!V) return;

  V.registrar('descanso', {
    titulo: 'Pausa 20-20-20 y parpadeo',
    intro: {
      mirar: 'Según lo que elijas: un objeto lejano (a unos 6 metros) o un círculo que se cierra y se abre despacio.',
      hacer: 'En la pausa, mira lejos hasta que termine la cuenta. En el parpadeo, parpadea despacio junto con el círculo.',
      dura: function (a) {
        return a.modo === 'pausa' ? '20 segundos.' : a.duracion + (a.duracion === 1 ? ' minuto.' : ' minutos.');
      }
    },
    ajustes: [
      { clave: 'modo', tipo: 'select', defecto: 'pausa', etiqueta: 'Qué quieres hacer',
        opciones: [['pausa', 'Pausa 20-20-20 (20 segundos)'], ['parpadeo', 'Parpadeo consciente']] },
      { clave: 'recordar', tipo: 'check', defecto: true, etiqueta: 'Recordarme la pausa 20-20-20',
        ayuda: 'Un aviso discreto, nunca bloquea la pantalla, cuando llevas mucho tiempo seguido en una lectura o un ejercicio.' },
      { clave: 'intervalo', tipo: 'select', defecto: 20, etiqueta: 'Cada cuántos minutos',
        opciones: [[10, '10 minutos'], [15, '15 minutos'], [20, '20 minutos (por defecto)'], [30, '30 minutos'], [45, '45 minutos'], [60, '1 hora']] }
    ],
    crear: function (ctx) {
      var modo = ctx.ajustes.modo;
      var restante = 20, numero, texto, circulo, barra, plan = null, t = 0, cuenta = 0, fasePar = '';

      function montarPausa(escena) {
        var caja = ctx.el('div', 'vision-pantalla vision-enfoque');
        texto = ctx.el('p', 'vision-enfoque-mensaje', 'Mira un objeto a unos 6 metros (por la ventana, por ejemplo) hasta que termine la cuenta.');
        numero = ctx.el('p', 'vision-contador', '20');
        numero.setAttribute('aria-hidden', 'true');
        caja.appendChild(texto);
        caja.appendChild(numero);
        escena.appendChild(caja);
        ctx.anunciar('Pausa 20-20-20. Mira lejos durante 20 segundos.');
        return ctx.plan('descanso', {}).then(function (p) {
          restante = p.descanso_seg;
          texto.textContent = p.mensaje;
          numero.textContent = restante;
        });
      }

      function montarParpadeo(escena) {
        return ctx.plan('parpadeo', { ritmo: Math.min(3, Math.max(1, ctx.ajustes.nivel - 1)), duracion_min: ctx.ajustes.duracion })
          .then(function (p) {
            plan = p;
            var caja = ctx.el('div', 'vision-pantalla vision-enfoque');
            if (ctx.reducido()) {
              texto = ctx.el('p', 'vision-enfoque-mensaje', p.texto_reducido);
              barra = ctx.el('progress', 'vision-barra');
              barra.max = Math.max(1, p.repeticiones); barra.value = 0;
              barra.setAttribute('aria-label', 'Avance del ejercicio de parpadeo');
              caja.appendChild(texto);
              caja.appendChild(barra);
            } else {
              circulo = ctx.el('div', 'vision-ojo');
              circulo.setAttribute('aria-hidden', 'true');
              texto = ctx.el('p', 'vision-enfoque-mensaje', 'Parpadea despacio junto con el círculo.');
              caja.appendChild(circulo);
              caja.appendChild(texto);
            }
            escena.appendChild(caja);
            ctx.anunciar('Parpadeo consciente. Parpadea despacio.');
          });
      }

      return {
        montar: function (escena) { return modo === 'pausa' ? montarPausa(escena) : montarParpadeo(escena); },
        actualizar: function (dt) {
          if (modo === 'pausa') {
            restante -= dt;
            numero.textContent = Math.max(0, Math.ceil(restante));
            var r = Math.ceil(restante);
            if (r > 0 && r % 5 === 0 && r !== cuenta) { cuenta = r; ctx.anunciar('Quedan ' + r + ' segundos.'); }
            if (restante <= 0) ctx.terminar();
            return;
          }
          if (!plan) return;
          t += dt;
          var pos = t % plan.ciclo_s;
          if (ctx.reducido()) {
            var n = Math.floor(t / plan.ciclo_s);
            if (barra && barra.value !== n) barra.value = n;
            return;
          }
          // cierra (escala 1 -> 0.12), abre (0.12 -> 1), espera; opacidad acompana.
          var s;
          if (pos < plan.cierra_s) s = 1 - 0.88 * (pos / plan.cierra_s);
          else if (pos < plan.cierra_s + plan.abre_s) s = 0.12 + 0.88 * ((pos - plan.cierra_s) / plan.abre_s);
          else s = 1;
          circulo.style.transform = 'scaleY(' + s.toFixed(3) + ')';
          circulo.style.opacity = (0.45 + 0.55 * s).toFixed(2);
        },
        resumen: function () {
          return modo === 'pausa' ? ['Hiciste una pausa 20-20-20. Tus ojos lo agradecen.']
                                  : ['Parpadeaste con calma ' + (plan ? Math.floor(ctx.tiempo() / plan.ciclo_s) : 0) + ' veces.'];
        }
      };
    }
  });
})();
