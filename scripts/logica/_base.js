/* =========================================================================
   R.E.T.O. - Utilidades comunes de la lógica en JavaScript (_base.js)
   -------------------------------------------------------------------------
   Aquí están las piezas que en Python venían "de fábrica" y que las reglas
   portadas necesitan: ValueError, round() con redondeo bancario, divisiones
   enteras, int()/float() tolerantes y la unión de módulos (navegador y Node).
   ========================================================================= */
(function (raiz, fabrica) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else { raiz.RetoLogica = raiz.RetoLogica || {}; raiz.RetoLogica._base = fabrica(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // El equivalente de ValueError: el enrutador lo convierte en una respuesta 400.
  function ValueError(mensaje) {
    this.name = 'ValueError';
    this.message = mensaje;
    this.stack = (new Error(mensaje)).stack;
  }
  ValueError.prototype = Object.create(Error.prototype);
  ValueError.prototype.constructor = ValueError;

  // round() de Python: el empate exacto (.5) va al par más cercano, y lo demás
  // se redondea según el valor decimal EXACTO del número, no según x * 10^n.
  function pyRound(x, nd) {
    nd = nd || 0;
    if (!isFinite(x) || Math.abs(x) >= 1e21) return x;
    var largo = x.toFixed(Math.min(100, nd + 25)), punto = largo.indexOf('.');
    var cola = largo.slice(punto + 1 + nd);
    if (/^50*$/.test(cola)) {                                   // empate exacto
      var base = largo.slice(0, nd === 0 ? punto : punto + 1 + nd);
      var ultimo = largo.charAt(nd === 0 ? punto - 1 : punto + nd);
      if ((ultimo.charCodeAt(0) - 48) % 2 === 0) return Number(base);
      return x < 0 ? -Number((-x).toFixed(nd)) : Number(x.toFixed(nd));
    }
    return Number(x.toFixed(nd));
  }

  // repr() de un float de Python: 0.1 -> '0.1', 3.0 -> '3.0', 1e16 -> '1e+16', 1e-5 -> '1e-05'.
  function pyFloatRepr(x) {
    if (x !== x) return 'nan';
    if (x === Infinity) return 'inf';
    if (x === -Infinity) return '-inf';
    if (x === 0) return (1 / x < 0) ? '-0.0' : '0.0';
    var signo = x < 0 ? '-' : '', e = Math.abs(x).toExponential(), p = e.split('e');
    var digitos = p[0].replace('.', ''), exp = parseInt(p[1], 10);
    if (exp >= -4 && exp < 16) {
      var r;
      if (exp >= 0) {
        while (digitos.length < exp + 1) digitos += '0';
        r = digitos.slice(0, exp + 1) + '.' + (digitos.slice(exp + 1) || '0');
      } else r = '0.' + new Array(-exp).join('0') + digitos;
      return signo + r;
    }
    var m = digitos.length > 1 ? digitos.charAt(0) + '.' + digitos.slice(1) : digitos;
    var ae = Math.abs(exp);
    return signo + m + 'e' + (exp < 0 ? '-' : '+') + (ae < 10 ? '0' + ae : String(ae));
  }

  // int(x) de Python para números (trunca hacia cero).
  function pyInt(x) { return x < 0 ? Math.ceil(x) : Math.floor(x); }

  // x // y y x % y con el signo de Python (el resto lleva el signo del divisor).
  function floorDiv(a, b) { return Math.floor(a / b); }
  function mod(a, b) { return ((a % b) + b) % b; }

  // %r de Python para los valores simples que salen en los mensajes de error.
  function repr(v) {
    if (v === null || v === undefined) return 'None';
    if (typeof v === 'string') return v.indexOf("'") >= 0 && v.indexOf('"') < 0 ? '"' + v + '"' : "'" + v.replace(/'/g, "\\'") + "'";
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    return String(v);
  }

  // ---- texto: lo que str.split(), isalnum() e int()/float() hacen en Python ----
  var ESPACIOS_PY = /[\t\n\v\f\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/;
  // texto.split() de Python: separa por cualquier espacio Unicode y no deja vacíos.
  function pySplit(texto) { return String(texto).split(ESPACIOS_PY).filter(function (x) { return x !== ''; }); }
  var ALNUM = /^[\p{L}\p{N}]$/u, ALFA = /^\p{L}$/u;
  function _en(re, texto, i) {
    var c = texto.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF && i + 1 < texto.length) return re.test(texto.substr(i, 2));
    if (c >= 0xDC00 && c <= 0xDFFF && i > 0) return re.test(texto.substr(i - 1, 2));
    return re.test(texto.charAt(i));
  }
  function esAlnumEn(texto, i) { return _en(ALNUM, texto, i); }
  function esAlfaEn(texto, i) { return _en(ALFA, texto, i); }
  function esAlfa(texto) { if (!texto.length) return false; for (var i = 0; i < texto.length; i++) if (!esAlfaEn(texto, i)) return false; return true; }

  // int(v) y float(v) de Python: lanzan ConvError (TypeError/ValueError) cuando Python fallaría.
  function ConvError(m) { this.name = 'ConvError'; this.message = m; }
  ConvError.prototype = Object.create(Error.prototype);
  function aInt(v) {
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') { if (!isFinite(v)) throw new ConvError('no es entero'); return pyInt(v); }
    if (typeof v === 'string') {
      var t = v.trim();
      if (/^[+-]?\d+(_\d+)*$/.test(t)) return parseInt(t.replace(/_/g, ''), 10);
      throw new ConvError('no es entero');
    }
    throw new ConvError('tipo no válido');
  }
  function aFloat(v) {
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      var t = v.trim().toLowerCase();
      if (/^[+-]?(inf|infinity)$/.test(t)) return t.charAt(0) === '-' ? -Infinity : Infinity;
      if (/^[+-]?nan$/.test(t)) return NaN;
      if (/^[+-]?(\d+(_\d+)*\.?(\d+(_\d+)*)?|\.\d+(_\d+)*)(e[+-]?\d+)?$/.test(t) && /\d/.test(t)) return Number(t.replace(/_/g, ''));
      throw new ConvError('no es número');
    }
    throw new ConvError('tipo no válido');
  }

  // ---- más equivalentes de Python: bool(), str(), strip(), cortes por caracteres ----
  function pyBool(v) {
    if (v === null || v === undefined || v === false || v === 0 || v === '' || v !== v) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }
  function pyStr(v) {
    if (v === null || v === undefined) return 'None';
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : pyFloatRepr(v);
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return '[' + v.map(function (x) { return typeof x === 'string' ? repr(x) : pyStr(x); }).join(', ') + ']';
    return '{' + Object.keys(v).map(function (k) { return repr(k) + ': ' + (typeof v[k] === 'string' ? repr(v[k]) : pyStr(v[k])); }).join(', ') + '}';
  }
  function pyStrip(texto) { return String(texto).replace(/^[\t\n\v\f\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\t\n\v\f\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g, ''); }
  function pySlice(texto, n) { return Array.from(String(texto)).slice(0, n).join(''); }
  function pyMin(a, b) { return b < a ? b : a; }
  function pyMax(a, b) { return b > a ? b : a; }

  // SHA-256 en JavaScript puro y síncrono (las tarjetas de jugador llevan su huella).
  var K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
    0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
    0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256hex(texto) {
    var bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(texto) : (function () {
      var s = unescape(encodeURIComponent(texto)), o = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; })();
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var largo = bytes.length, total = (largo + 9 + 63) & ~63, m = new Uint8Array(total), i, t;
    m.set(bytes); m[largo] = 0x80;
    var bitsAlto = Math.floor(largo / 0x20000000), bitsBajo = (largo << 3) >>> 0;
    m[total - 8] = bitsAlto >>> 24; m[total - 7] = bitsAlto >>> 16; m[total - 6] = bitsAlto >>> 8; m[total - 5] = bitsAlto;
    m[total - 4] = bitsBajo >>> 24; m[total - 3] = bitsBajo >>> 16; m[total - 2] = bitsBajo >>> 8; m[total - 1] = bitsBajo;
    var w = new Array(64);
    function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (var off = 0; off < total; off += 64) {
      for (t = 0; t < 16; t++) w[t] = ((m[off + 4 * t] << 24) | (m[off + 4 * t + 1] << 16) | (m[off + 4 * t + 2] << 8) | m[off + 4 * t + 3]) | 0;
      for (t = 16; t < 64; t++) {
        var s0 = rr(w[t - 15], 7) ^ rr(w[t - 15], 18) ^ (w[t - 15] >>> 3), s1 = rr(w[t - 2], 17) ^ rr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (t = 0; t < 64; t++) {
        var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K256[t] + w[t]) | 0;
        var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    return h.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  // json.dumps(valor, sort_keys=True, ensure_ascii=False) de Python (separadores ", " y ": ").
  // Los números enteros salen como enteros; los de `comoFlotante` (rutas) con ".0".
  function jsonCanonico(v, flotantes, ruta) {
    ruta = ruta || '';
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return (flotantes && flotantes[ruta]) ? pyFloatRepr(v) : String(v);
      return pyFloatRepr(v);
    }
    if (typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(function (x) { return jsonCanonico(x, flotantes, ruta + '[]'); }).join(', ') + ']';
    return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ': ' + jsonCanonico(v[k], flotantes, ruta + '.' + k); }).join(', ') + '}';
  }

  function pyLen(texto) { return Array.from(String(texto)).length; }

  // Equivalentes de secrets.token_urlsafe(n) y secrets.choice(texto) (azar de verdad del navegador).
  function bytesAzar(n) {
    var a = new Uint8Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    return a;
  }
  function tokenUrlsafe(n) {
    n = n || 32;
    var a = bytesAzar(n), s = '';
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function eligeSeguro(texto) {
    var lim = Math.floor(256 / texto.length) * texto.length, b;
    do { b = bytesAzar(1)[0]; } while (b >= lim);
    return texto.charAt(b % texto.length);
  }
  var azarSeguro = { token_urlsafe: tokenUrlsafe, choice: eligeSeguro };

  function esEntero(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function esObjeto(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  function copiar(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  // Un conjunto de claves de un objeto, en orden (como los dict de Python).
  function items(obj) { return Object.keys(obj).map(function (k) { return [k, obj[k]]; }); }

  // Registro del módulo: Node usa require, el navegador cuelga de RetoLogica.
  function dependencias(raiz, nombres) {
    var d = {};
    if (typeof module === 'object' && module.exports) {
      d.azar = require('../reto-azar.js');
      nombres.forEach(function (n) { d[n] = require('./' + n + '.js'); });
    } else {
      d.azar = raiz.RetoAzar;
      nombres.forEach(function (n) { d[n] = raiz.RetoLogica[n]; });
    }
    return d;
  }

  function registrar(raiz, nombre, modulo) {
    if (typeof module === 'object' && module.exports) return modulo;
    raiz.RetoLogica = raiz.RetoLogica || {};
    raiz.RetoLogica[nombre] = modulo;
    return modulo;
  }

  return { pyLen: pyLen, azarSeguro: azarSeguro, pyBool: pyBool, pyStr: pyStr, pyStrip: pyStrip, pySlice: pySlice, pyMin: pyMin, pyMax: pyMax, sha256hex: sha256hex, jsonCanonico: jsonCanonico, pySplit: pySplit, esAlnumEn: esAlnumEn, esAlfaEn: esAlfaEn, esAlfa: esAlfa, ConvError: ConvError, aInt: aInt, aFloat: aFloat, repr: repr, ValueError: ValueError, pyRound: pyRound, pyFloatRepr: pyFloatRepr, pyInt: pyInt, floorDiv: floorDiv, mod: mod,
           esEntero: esEntero, esObjeto: esObjeto, copiar: copiar, items: items,
           dependencias: dependencias, registrar: registrar };
});
