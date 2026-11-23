/* =========================================================================
   R.E.T.O. - Módulo de soporte y validación para preguntas dinámicas
   -------------------------------------------------------------------------
   Archivo totalmente modular y complementario. No modifica ni afecta al
   importador estático (reto-tests-importar.js), garantizando la estabilidad
   del proyecto.
   ========================================================================= */
(function (raiz) {
  'use strict';

  function validarPreguntaDinamica(p) {
    var errores = [];
    if (!p.enunciado || !p.enunciado.trim()) {
      errores.push('La pregunta dinámica necesita un enunciado.');
    }
    if (!p.formula || !p.formula.trim()) {
      errores.push('La pregunta dinámica necesita una fórmula para calcular el resultado.');
    }
    if (!Array.isArray(p.variables) || p.variables.length === 0) {
      errores.push('Debe definir al menos una variable que cambie.');
    } else {
      p.variables.forEach(function (v, i) {
        if (!v.nombre || !v.nombre.trim()) {
          errores.push('A la variable ' + (i + 1) + ' le falta un nombre.');
        }
        if (Number(v.min) >= Number(v.max)) {
          errores.push('En la variable "' + (v.nombre || (i + 1)) + '", el mínimo debe ser menor que el máximo.');
        }
      });
    }
    return errores;
  }

  raiz.RetoTestsDinamico = {
    validar: validarPreguntaDinamica
  };
})(window);
