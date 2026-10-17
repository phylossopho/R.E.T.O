/* =========================================================================
   R.E.T.O. - Módulo de Arrastrar y Soltar (HTML5 Drag and Drop con UX Visual)
   -------------------------------------------------------------------------
   Permite reorganizar las tarjetas rectangulares con indicadores visuales
   claros de posición (borde de inserción superior/inferior).
   ========================================================================= */
(function () {
  'use strict';

  var elementoArrastrado = null;

  function inicializarZona(zonaEl) {
    if (!zonaEl) return;

    var items = zonaEl.querySelectorAll('li');
    if (!items.length) items = zonaEl.querySelectorAll('.tarjeta');

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      item.setAttribute('draggable', 'true');
      item.classList.add('arrastrable');

      var enlace = item.querySelector('a');
      if (enlace) {
        enlace.addEventListener('click', function (e) {
          if (item._fueArrastrado) {
            e.preventDefault();
            item._fueArrastrado = false;
          }
        });
      }

      item.addEventListener('dragstart', function (e) {
        elementoArrastrado = this;
        this._fueArrastrado = false;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
        setTimeout(function () {
          elementoArrastrado.classList.add('arrastrando');
        }, 0);
      });

      item.addEventListener('dragend', function (e) {
        this.classList.remove('arrastrando');
        if (elementoArrastrado) {
          elementoArrastrado._fueArrastrado = true;
        }
        elementoArrastrado = null;
        limpiarEstilos(zonaEl);
      });

      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        var actual = this;
        if (elementoArrastrado && elementoArrastrado !== actual) {
          limpiarIndicadores(zonaEl);
          var rect = actual.getBoundingClientRect();
          var midpointY = rect.top + rect.height / 2;
          var midpointX = rect.left + rect.width / 2;
          
          if (e.clientY < midpointY || e.clientX < midpointX) {
            actual.classList.add('arrastrable-sobre-arriba');
            zonaEl.insertBefore(elementoArrastrado, actual);
          } else {
            actual.classList.add('arrastrable-sobre-abajo');
            zonaEl.insertBefore(elementoArrastrado, actual.nextSibling);
          }
        }
      });

      item.addEventListener('dragleave', function (e) {
        this.classList.remove('arrastrable-sobre-arriba', 'arrastrable-sobre-abajo');
      });
    }
  }

  function limpiarIndicadores(zonaEl) {
    var items = zonaEl.querySelectorAll('.arrastrable');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('arrastrable-sobre-arriba', 'arrastrable-sobre-abajo');
    }
  }

  function limpiarEstilos(zonaEl) {
    var items = zonaEl.querySelectorAll('.arrastrable');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('arrastrando');
      items[i].classList.remove('arrastrable-sobre-arriba', 'arrastrable-sobre-abajo');
    }
  }

  function inicializarTodas() {
    var zonas = document.querySelectorAll('[data-zona-arrastre]');
    for (var i = 0; i < zonas.length; i++) {
      inicializarZona(zonas[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarTodas);
  } else {
    inicializarTodas();
  }

  window.RetoArrastrar = {
    inicializarZona: inicializarZona,
    inicializarTodas: inicializarTodas
  };
})();
