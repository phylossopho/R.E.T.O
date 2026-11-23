/* =========================================================================
   R.E.T.O. - Evaluador de preguntas dinámicas en el cliente
   -------------------------------------------------------------------------
   Módulo JavaScript puro y modular para calcular instancias dinámicas de
   preguntas con números que cambian (variables, fórmulas y distractores)
   directamente en el navegador.

   LA EXPLICACIÓN DE UNA PREGUNTA DINÁMICA
   Cada instancia trae `explicacion`, con tres líneas que se arman SOLAS con los
   números de esa pregunta (nadie las escribe, así que nunca se desajustan):

     formula       la fórmula tal como se escribió, con × y ÷ en vez de * y /
     sustitucion   la misma fórmula con los números ya puestos
     resultado     lo que da

   Ejemplo, con dividendo = 4358.2 y divisor = 37.5:
     formula:      round(dividendo ÷ divisor, 2)
     sustitucion:  round(4358.2 ÷ 37.5, 2)
     resultado:    116.21

   Los números se escriben igual que en el enunciado, para que coincidan con lo
   que se leyó. Uno negativo va entre paréntesis: (-3).
   ========================================================================= */
(function (raiz) {
  'use strict';

  function numeroAlAzar(min, max, paso, decimales, rng) {
    rng = rng || Math.random;
    paso = paso || 1;
    var nPasos = Math.max(0, Math.floor((max - min) / paso));
    var pasoElegido = Math.floor(rng() * (nPasos + 1));
    var val = min + (pasoElegido * paso);
    return Number(val.toFixed(decimales));
  }

  function evaluarFormula(formulaStr, vars) {
    // Entorno seguro para evaluar fórmulas matemáticas simples usando Function
    var llaves = Object.keys(vars);
    var valores = llaves.map(function (k) { return vars[k]; });
    try {
      var customRound = function (val, ndigits) {
        if (ndigits === undefined) return Math.round(val);
        var factor = Math.pow(10, ndigits);
        return Math.round(val * factor) / factor;
      };
      // Permitir Math y funciones auxiliares
      var fn = Function.apply(null, llaves.concat(['Math', 'round', 'floor', 'ceil', 'abs', 'min', 'max', 'return ' + formulaStr + ';']));
      var res = fn.apply(null, valores.concat([Math, customRound, Math.floor, Math.ceil, Math.abs, Math.min, Math.max]));
      return Number(res);
    } catch (e) {
      throw new Error('Error evaluando fórmula "' + formulaStr + '": ' + e.message);
    }
  }

  /* La fórmula como se lee en la escuela: × y ÷ en vez de * y /, con espacios
     alrededor, y ^ para la potencia. Solo es para MOSTRAR: lo que se calcula es
     la fórmula original. */
  function paraMostrar(formula) {
    return String(formula)
      .replace(/\*\*/g, '\u0001')
      .replace(/\s*\*\s*/g, ' \u00D7 ')
      .replace(/\s*\/\s*/g, ' \u00F7 ')
      .replace(/\s*\u0001\s*/g, ' ^ ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* La fórmula con cada variable cambiada por su valor. */
  function conNumeros(formula, valores) {
    return String(formula).replace(/[A-Za-z_][A-Za-z0-9_]*/g, function (nombre) {
      if (nombre === 'resultado' || !Object.prototype.hasOwnProperty.call(valores, nombre)) return nombre;
      var v = valores[nombre];
      return v < 0 ? '(' + v + ')' : String(v);
    });
  }

  function generarInstancia(p, semilla) {
    // Generador pseudoaleatorio simple basado en semilla si existe, o Math.random
    var rng = Math.random;
    if (semilla !== undefined) {
      var s = Number(semilla);
      rng = function () {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    }

    var valores = {};
    var variablesDef = p.variables || [];
    
    variablesDef.forEach(function (v) {
      var nombre = v.nombre || v.name;
      var min = Number(v.min);
      var max = Number(v.max);
      var paso = Number(v.paso || 1);
      var dec = Number(v.decimales || 0);
      valores[nombre] = numeroAlAzar(min, max, paso, dec, rng);
    });

    var decRes = Number(p.decimales !== undefined ? p.decimales : 2);
    var valoresDeVariables = {};
    Object.keys(valores).forEach(function (k) { valoresDeVariables[k] = valores[k]; });
    var resultado = evaluarFormula(p.formula, valores);
    resultado = Number(resultado.toFixed(decRes));
    valores.resultado = resultado;

    // Sustituir en enunciado
    var enunciado = p.enunciado || '';
    Object.keys(valores.resultado !== undefined ? valores : {}).forEach(function (k) {
      enunciado = enunciado.replace(new RegExp('\\{' + k + '\\}', 'g'), valores[k]);
    });

    // Opciones
    var opciones = [];
    opciones.push({ texto: String(resultado), correcta: true });

    // Distractores
    var distractoresDef = p.distractores || [];
    distractoresDef.forEach(function (d) {
      try {
        var dVal = evaluarFormula(d.formula, valores);
        dVal = Number(dVal.toFixed(decRes));
        var txt = String(dVal);
        if (!opciones.some(function (o) { return o.texto === txt; })) {
          opciones.push({
            texto: txt,
            correcta: false,
            clase: d.clase || 'concepto'
          });
        }
      } catch (err) {}
    });

    // Rellenar si faltan
    var maxOps = Number(p.opcionesAMostrar || 4);
    /* Con un tope de intentos y saltos cada vez mayores: con pocos errores
       escritos, sumar o restar 1 solo da dos valores posibles, y el ciclo no
       terminaba nunca. */
    var intentosRelleno = 0;
    while (opciones.length < maxOps && intentosRelleno < 60) {
      intentosRelleno++;
      var salto = 1 + Math.floor(intentosRelleno / 4);
      var delta = (rng() > 0.5 ? 1 : -1) * salto;
      var falsoVal = Number((resultado + delta).toFixed(decRes));
      var txtFalso = String(falsoVal);
      if (!opciones.some(function (o) { return o.texto === txtFalso; })) {
        opciones.push({ texto: txtFalso, correcta: false, clase: 'calculo' });
      }
    }

    // Barajar opciones
    for (var i = opciones.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var temp = opciones[i];
      opciones[i] = opciones[j];
      opciones[j] = temp;
    }

    return {
      enunciado: enunciado,
      opciones: opciones,
      explicacion: {
        formula: paraMostrar(p.formula),
        sustitucion: paraMostrar(conNumeros(p.formula, valoresDeVariables)),
        resultado: String(resultado)
      },
      valores: valores
    };
  }

  raiz.RetoTestsEval = {
    generar: generarInstancia,
    evaluar: evaluarFormula
  };
})(window);
