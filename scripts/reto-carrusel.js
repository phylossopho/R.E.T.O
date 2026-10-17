/* =========================================================================
   R.E.T.O. - Módulo de Carrusel (Controlador JS)
   -------------------------------------------------------------------------
   Gestiona la navegación por botones, teclado (flechas izquierda/derecha),
   sincronización de scroll y accesibilidad para cualquier carrusel.
   ========================================================================= */
(function () {
  'use strict';

  function inicializarCarrusel(contenedorEl) {
    if (!contenedorEl) return;
    var pista = contenedorEl.querySelector('.carrusel-pista');
    var btnPrev = contenedorEl.querySelector('.carrusel-btn-prev');
    var btnNext = contenedorEl.querySelector('.carrusel-btn-next');

    if (!pista) return;

    var desplazamiento = 300; // píxeles a desplazar por clic

    if (btnPrev) {
      btnPrev.addEventListener('click', function () {
        pista.scrollBy({ left: -desplazamiento, behavior: 'smooth' });
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', function () {
        pista.scrollBy({ left: desplazamiento, behavior: 'smooth' });
      });
    }

    pista.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        pista.scrollBy({ left: -desplazamiento, behavior: 'smooth' });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        pista.scrollBy({ left: desplazamiento, behavior: 'smooth' });
      }
    });
  }

  function inicializarTodos() {
    var carruseles = document.querySelectorAll('[data-carrusel]');
    for (var i = 0; i < carruseles.length; i++) {
      inicializarCarrusel(carruseles[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarTodos);
  } else {
    inicializarTodos();
  }

  window.RetoCarrusel = {
    inicializar: inicializarCarrusel,
    inicializarTodos: inicializarTodos
  };
})();
