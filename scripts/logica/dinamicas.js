/* R.E.T.O. - Preguntas dinámicas (puerto de logica/dinamicas.py)
   Genera una instancia concreta de una pregunta con números que cambian.
   La fórmula la evalúa un analizador PROPIO (sin eval): solo entiende números,
   variables, + - * / // % **, paréntesis y abs, round, floor, ceil, min, max,
   con la misma aritmética que Python (división real, // hacia abajo, % con el
   signo del divisor, round al par). */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var B = nodo ? require('./_base.js') : raiz.RetoLogica._base;
  var D = B.dependencias(raiz, []);
  var m = fabrica(B, D);
  if (nodo) module.exports = m; else B.registrar(raiz, 'dinamicas', m);
})(typeof self !== 'undefined' ? self : this, function (B, D) {
  'use strict';
  var PyRandom = D.azar.PyRandom, ValueError = B.ValueError;

  /* ---------------- el evaluador de fórmulas ---------------- */
  function Error_(msg) { return new Error(msg); }

  function tokenizar(src) {
    var t = [], i = 0, m;
    while (i < src.length) {
      var c = src.charAt(i);
      if (/\s/.test(c)) { i++; continue; }
      if ((m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i)))) { t.push({ k: 'n', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i)))) { t.push({ k: 'id', v: m[0] }); i += m[0].length; continue; }
      if (src.substr(i, 2) === '**') { t.push({ k: 'op', v: '**' }); i += 2; continue; }
      if (src.substr(i, 2) === '//') { t.push({ k: 'op', v: '//' }); i += 2; continue; }
      if ('+-*/%(),'.indexOf(c) >= 0) { t.push({ k: 'op', v: c }); i++; continue; }
      throw Error_('carácter no válido: ' + c);
    }
    return t;
  }

  var FUNCIONES = {
    abs: function (a) { if (a.length !== 1) throw Error_('abs pide 1 argumento'); return Math.abs(a[0]); },
    round: function (a) {
      if (a.length === 1) return B.pyRound(a[0], 0);
      if (a.length === 2) return B.pyRound(a[0], Math.trunc(a[1]));
      throw Error_('round pide 1 o 2 argumentos');
    },
    floor: function (a) { if (a.length !== 1) throw Error_('floor pide 1 argumento'); return Math.floor(a[0]); },
    ceil: function (a) { if (a.length !== 1) throw Error_('ceil pide 1 argumento'); return Math.ceil(a[0]); },
    min: function (a) { if (!a.length) throw Error_('min pide argumentos'); return Math.min.apply(null, a); },
    max: function (a) { if (!a.length) throw Error_('max pide argumentos'); return Math.max.apply(null, a); }
  };

  function evaluar(src, vars) {
    var tk = tokenizar(src), p = 0;
    function ver() { return tk[p]; }
    function es(v) { return p < tk.length && tk[p].k === 'op' && tk[p].v === v; }
    function suma() {
      var a = producto();
      while (es('+') || es('-')) { var op = tk[p++].v, b = producto(); a = op === '+' ? a + b : a - b; }
      return a;
    }
    function producto() {
      var a = unario();
      while (es('*') || es('/') || es('//') || es('%')) {
        var op = tk[p++].v, b = unario();
        if (op === '*') a = a * b;
        else {
          if (b === 0) throw Error_(op === '/' ? 'division by zero' : op === '//' ? 'integer division or modulo by zero' : 'integer modulo by zero');
          if (op === '/') a = a / b;
          else if (op === '//') a = Math.floor(a / b);
          else a = a - b * Math.floor(a / b);
        }
      }
      return a;
    }
    function unario() {
      if (es('-')) { p++; return -unario(); }
      if (es('+')) { p++; return +unario(); }
      return potencia();
    }
    function potencia() {
      var a = atomo();
      if (es('**')) {
        p++;
        var b = unario();                                  // asociativa a la derecha, y admite -n
        if (a === 0 && b < 0) throw Error_('0.0 cannot be raised to a negative power');
        if (a < 0 && Math.floor(b) !== b) throw Error_('resultado complejo');
        return Math.pow(a, b);
      }
      return a;
    }
    function atomo() {
      var t = ver();
      if (!t) throw Error_('fórmula incompleta');
      if (t.k === 'n') { p++; return t.v; }
      if (t.k === 'id') {
        p++;
        if (es('(')) {
          p++;
          var args = [];
          if (!es(')')) { do { args.push(suma()); } while (es(',') && ++p); }
          if (!es(')')) throw Error_('falta )');
          p++;
          if (!Object.prototype.hasOwnProperty.call(FUNCIONES, t.v)) throw Error_('función no permitida: ' + t.v);
          return FUNCIONES[t.v](args);
        }
        if (Object.prototype.hasOwnProperty.call(vars, t.v)) return vars[t.v];
        throw Error_("name '" + t.v + "' is not defined");
      }
      if (es('(')) {
        p++;
        var v = suma();
        if (es(',')) throw Error_('tuplas no permitidas');
        if (!es(')')) throw Error_('falta )');
        p++;
        return v;
      }
      throw Error_('símbolo inesperado');
    }
    var r = suma();
    if (p < tk.length) throw Error_('sobra algo al final de la fórmula');
    return r;
  }

  function evaluarFormula(formula, variables) {
    try {
      if (!/^[a-zA-Z0-9_+\-*\/%().,\s]+$/.test(formula)) throw new Error('Fórmula con caracteres no permitidos');
      var r = evaluar(formula, variables);
      if (typeof r !== 'number' || !isFinite(r)) throw new Error('el resultado no es un número finito');
      return r;
    } catch (e) {
      throw new ValueError('Error evaluando fórmula ' + B.repr(formula) + ': ' + e.message);
    }
  }

  /* ---------------- formato de números ---------------- */
  function conComas(entero) { return String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function formatearNumero(val) {
    if (typeof val !== 'number') return String(val);
    if (Number.isInteger(val)) {
      var s = val < 0 ? '-' + conComas(String(-val)) : conComas(String(val));
      return Math.abs(val) >= 1e21 ? String(val) : s;
    }
    var texto = B.pyFloatRepr(val);
    if (texto.indexOf('.') >= 0 && texto.indexOf('e') < 0) {
      var partes = texto.split('.'), signo = partes[0].charAt(0) === '-' ? '-' : '';
      return signo + conComas(partes[0].replace('-', '')) + '.' + partes[1];
    }
    return texto;
  }

  function paraMostrar(formula) {
    var t = String(formula).replace(/\*\*/g, '\x01');
    t = t.replace(/\s*\*\s*/g, ' \u00d7 ').replace(/\s*\/\s*/g, ' \u00f7 ').replace(/\s*\x01\s*/g, ' ^ ');
    return t.replace(/\s+/g, ' ').trim();
  }

  function conNumeros(formula, valores) {
    return String(formula).replace(/[A-Za-z_][A-Za-z0-9_]*/g, function (nombre) {
      if (nombre === 'resultado' || !Object.prototype.hasOwnProperty.call(valores, nombre)) return nombre;
      var valor = valores[nombre];
      var texto = Number.isInteger(valor) ? String(valor) : B.pyFloatRepr(valor);
      return valor < 0 ? '(' + texto + ')' : texto;
    });
  }

  // str.format(**valores) de Python, solo con campos {nombre}. Lo demás lanza error (se usa la plantilla tal cual).
  function aplicarPlantilla(plantilla, valores) {
    var salida = '', i = 0;
    while (i < plantilla.length) {
      var c = plantilla.charAt(i);
      if (c === '{') {
        if (plantilla.charAt(i + 1) === '{') { salida += '{'; i += 2; continue; }
        var fin = plantilla.indexOf('}', i);
        if (fin < 0) throw new Error('llave sin cerrar');
        var nombre = plantilla.slice(i + 1, fin);
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nombre) || !Object.prototype.hasOwnProperty.call(valores, nombre)) throw new Error('campo no válido');
        salida += valores[nombre];
        i = fin + 1;
      } else if (c === '}') {
        if (plantilla.charAt(i + 1) === '}') { salida += '}'; i += 2; continue; }
        throw new Error('llave suelta');
      } else { salida += c; i++; }
    }
    return salida;
  }

  function num(v, nombre) {
    var n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    if (typeof n !== 'number' || isNaN(n)) throw new ValueError('la variable necesita ' + nombre + ' numérico');
    return n;
  }

  /* ---------------- la instancia ---------------- */
  function generarInstancia(pd, semilla) {
    if (!B.esObjeto(pd)) throw new ValueError('la pregunta dinámica no es válida');
    var rng = new PyRandom(semilla === undefined ? null : semilla);
    var varsDef = pd.variables || [], valoresVars = {};
    varsDef.forEach(function (v) {
      var nombre = ('name' in v) ? v.name : v.nombre;
      if (typeof nombre !== 'string') throw new ValueError('una variable no tiene nombre');
      var minV = num(v.min, 'min'), maxV = num(v.max, 'max');
      var pasoV = v.paso === undefined ? 1 : num(v.paso, 'paso');
      var dec = Math.trunc(v.decimales === undefined ? 0 : num(v.decimales, 'decimales'));
      if (pasoV <= 0) pasoV = 1.0;
      var nPasos = Math.max(0, Math.floor((maxV - minV) / pasoV));
      var elegido = rng.randint(0, Math.max(0, nPasos));
      var val = minV + (elegido * pasoV);
      valoresVars[nombre] = dec === 0 ? B.pyRound(val) : B.pyRound(val, dec);
    });
    var formula = pd.formula === undefined ? '' : pd.formula;
    var decRes = Math.trunc(pd.decimales === undefined ? 2 : num(pd.decimales, 'decimales'));
    var valRes = evaluarFormula(formula, valoresVars);
    valRes = decRes === 0 ? B.pyRound(valRes) : B.pyRound(valRes, decRes);
    valoresVars.resultado = valRes;
    var fmt = {};
    Object.keys(valoresVars).forEach(function (k) { fmt[k] = formatearNumero(valoresVars[k]); });
    var tpl = pd.enunciado === undefined ? '' : pd.enunciado, enunciado;
    try { enunciado = aplicarPlantilla(tpl, fmt); } catch (e) { enunciado = tpl; }

    var opciones = [{ texto: formatearNumero(valRes), correcta: true }];
    (pd.distractores || []).forEach(function (d) {
      var dClase = d.clase === undefined ? 'concepto' : d.clase;
      try {
        var dVal = evaluarFormula(d.formula === undefined ? '' : d.formula, valoresVars);
        dVal = decRes === 0 ? B.pyRound(dVal) : B.pyRound(dVal, decRes);
        var texto = formatearNumero(dVal);
        if (!opciones.some(function (o) { return o.texto === texto; })) opciones.push({ texto: texto, correcta: false, clase: dClase });
      } catch (e) { /* un distractor que no se puede calcular se omite */ }
    });
    var aMostrar = Math.trunc(pd.opcionesAMostrar === undefined ? 4 : num(pd.opcionesAMostrar, 'opcionesAMostrar'));
    while (opciones.length < aMostrar) {
      var delta = rng.choice([-2, -1, 1, 2, 5, 10]);
      var texto2 = formatearNumero(valRes + delta);
      if (!opciones.some(function (o) { return o.texto === texto2; })) opciones.push({ texto: texto2, correcta: false, clase: 'calculo' });
    }
    rng.shuffle(opciones);
    var sinRes = {};
    Object.keys(valoresVars).forEach(function (k) { if (k !== 'resultado') sinRes[k] = valoresVars[k]; });
    return {
      enunciado: enunciado, opciones: opciones,
      explicacion: { formula: paraMostrar(formula), sustitucion: paraMostrar(conNumeros(formula, sinRes)), resultado: formatearNumero(valRes) },
      valores: valoresVars
    };
  }

  return { generar_instancia: generarInstancia, evaluar_formula: evaluarFormula, formatear_numero: formatearNumero };
});
