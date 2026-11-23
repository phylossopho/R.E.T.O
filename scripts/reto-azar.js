/* =========================================================================
   R.E.T.O. - Azar compatible con Python (reto-azar.js)
   -------------------------------------------------------------------------
   POR QUÉ EXISTE
   Las reglas del sitio vivían en Python (random.Random) y ahora viven en
   JavaScript. Para poder DEMOSTRAR que la conversión no cambió nada, este
   archivo reproduce exactamente el generador de Python (Mersenne Twister,
   MT19937) y sus métodos: con la misma semilla, `new PyRandom(7).shuffle(x)`
   da en JavaScript el mismo orden que `random.Random(7).shuffle(x)` en Python.
   Así las pruebas de paridad (tests/paridad.test.js) comparan, semilla por
   semilla, lo que sale de uno y de otro.

   QUÉ TRAE (los mismos nombres que en Python)
     random()  getrandbits(k)  randbelow(n)  randrange(a, b)  randint(a, b)
     choice(seq)  shuffle(arr)  sample(seq, k)  uniform(a, b)  choices(...)
   Semillas: enteros (de cualquier tamaño, con BigInt) y cadenas (con el mismo
   SHA-512 que usa Python 3 para sembrar con texto).
   `PyRandom.sistema()` da un generador sembrado con crypto.getRandomValues,
   que hace el papel de random.SystemRandom() / random.Random() sin semilla.

   FUNCIONA IGUAL EN EL NAVEGADOR Y EN NODE (UMD).
   ========================================================================= */
(function (raiz, fabrica) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.RetoAzar = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------------------
     SHA-512 (solo para sembrar con texto, como hace Python 3)
     --------------------------------------------------------------------- */
  var M64 = (1n << 64n) - 1n;
  var K512 = [
    0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
    0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
    0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
    0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
    0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
    0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
    0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
    0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
    0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
    0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
    0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
    0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
    0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
    0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
    0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
    0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
    0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
    0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
    0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
    0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n
  ];

  function rotr(x, n) { return ((x >> n) | (x << (64n - n))) & M64; }

  function sha512(bytes) {
    var h = [
      0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
      0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
    ];
    var largo = bytes.length;
    var relleno = (largo + 17 + 127) & ~127;            // múltiplo de 128
    var m = new Uint8Array(relleno);
    m.set(bytes);
    m[largo] = 0x80;
    var bits = BigInt(largo) * 8n;
    for (var i = 0; i < 16; i++) m[relleno - 1 - i] = Number((bits >> BigInt(8 * i)) & 0xffn);
    var w = new Array(80);
    for (var off = 0; off < relleno; off += 128) {
      for (var t = 0; t < 16; t++) {
        var v = 0n;
        for (var b = 0; b < 8; b++) v = (v << 8n) | BigInt(m[off + t * 8 + b]);
        w[t] = v;
      }
      for (t = 16; t < 80; t++) {
        var s0 = rotr(w[t - 15], 1n) ^ rotr(w[t - 15], 8n) ^ (w[t - 15] >> 7n);
        var s1 = rotr(w[t - 2], 19n) ^ rotr(w[t - 2], 61n) ^ (w[t - 2] >> 6n);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) & M64;
      }
      var a = h[0], bb = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (t = 0; t < 80; t++) {
        var S1 = rotr(e, 14n) ^ rotr(e, 18n) ^ rotr(e, 41n);
        var ch = (e & f) ^ ((~e & M64) & g);
        var t1 = (hh + S1 + ch + K512[t] + w[t]) & M64;
        var S0 = rotr(a, 28n) ^ rotr(a, 34n) ^ rotr(a, 39n);
        var maj = (a & bb) ^ (a & c) ^ (bb & c);
        var t2 = (S0 + maj) & M64;
        hh = g; g = f; f = e; e = (d + t1) & M64;
        d = c; c = bb; bb = a; a = (t1 + t2) & M64;
      }
      h[0] = (h[0] + a) & M64; h[1] = (h[1] + bb) & M64; h[2] = (h[2] + c) & M64; h[3] = (h[3] + d) & M64;
      h[4] = (h[4] + e) & M64; h[5] = (h[5] + f) & M64; h[6] = (h[6] + g) & M64; h[7] = (h[7] + hh) & M64;
    }
    var out = new Uint8Array(64);
    for (i = 0; i < 8; i++) for (b = 0; b < 8; b++) out[i * 8 + b] = Number((h[i] >> BigInt(56 - 8 * b)) & 0xffn);
    return out;
  }

  function utf8(texto) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(texto);
    var s = unescape(encodeURIComponent(texto)), o = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i);
    return o;
  }

  /* ---------------------------------------------------------------------
     MT19937 con la siembra de Python (init_by_array)
     --------------------------------------------------------------------- */
  var N = 624, M = 397;

  function imul(a, b) { return Math.imul(a, b) >>> 0; }

  function PyRandom(semilla) {
    this.mt = new Uint32Array(N);
    this.mti = N + 1;
    this.sembrar(semilla);
  }

  PyRandom.prototype._initGenrand = function (s) {
    var mt = this.mt;
    mt[0] = s >>> 0;
    for (var i = 1; i < N; i++) {
      var prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = (imul(1812433253, prev) + i) >>> 0;
    }
    this.mti = N;
  };

  PyRandom.prototype._initByArray = function (clave) {
    this._initGenrand(19650218);
    var mt = this.mt, i = 1, j = 0, k = Math.max(N, clave.length);
    for (; k; k--) {
      var prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ imul(prev, 1664525)) + clave[j] + j) >>> 0;
      i++; j++;
      if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
      if (j >= clave.length) j = 0;
    }
    for (k = N - 1; k; k--) {
      prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
    }
    mt[0] = 0x80000000;
  };

  PyRandom.prototype.sembrar = function (semilla) {
    var entero;
    if (semilla === undefined || semilla === null) {
      var buf = new Uint32Array(8);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf);
      else for (var q = 0; q < 8; q++) buf[q] = (Math.random() * 4294967296) >>> 0;
      entero = 0n;
      for (var z = 0; z < 8; z++) entero = (entero << 32n) | BigInt(buf[z]);
    } else if (typeof semilla === 'string') {
      // Python 3 (version=2): int.from_bytes(texto + sha512(texto), 'big')
      var bytes = utf8(semilla), dig = sha512(bytes), todo = new Uint8Array(bytes.length + 64);
      todo.set(bytes); todo.set(dig, bytes.length);
      entero = 0n;
      for (var t = 0; t < todo.length; t++) entero = (entero << 8n) | BigInt(todo[t]);
    } else {
      entero = BigInt(semilla);
      if (entero < 0n) entero = -entero;
    }
    var clave = [];
    if (entero === 0n) clave.push(0);
    while (entero > 0n) { clave.push(Number(entero & 0xffffffffn)); entero >>= 32n; }
    this._initByArray(clave);
  };

  PyRandom.prototype._genrandUint32 = function () {
    var mt = this.mt, y, kk;
    if (this.mti >= N) {
      for (kk = 0; kk < N - M; kk++) {
        y = (mt[kk] & 0x80000000) | (mt[kk + 1] & 0x7fffffff);
        mt[kk] = mt[kk + M] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0);
      }
      for (; kk < N - 1; kk++) {
        y = (mt[kk] & 0x80000000) | (mt[kk + 1] & 0x7fffffff);
        mt[kk] = mt[kk + (M - N)] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0);
      }
      y = (mt[N - 1] & 0x80000000) | (mt[0] & 0x7fffffff);
      mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0);
      this.mti = 0;
    }
    y = mt[this.mti++];
    y ^= (y >>> 11);
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= (y >>> 18);
    return y >>> 0;
  };

  PyRandom.prototype.random = function () {
    var a = this._genrandUint32() >>> 5, b = this._genrandUint32() >>> 6;
    return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
  };

  PyRandom.prototype.getrandbits = function (k) {
    if (k <= 0) return 0;
    if (k <= 32) return this._genrandUint32() >>> (32 - k);
    // Más de 32 bits: se devuelve un BigInt (como el entero grande de Python).
    var palabras = Math.floor((k - 1) / 32) + 1, resultado = 0n, falta = k;
    for (var i = 0; i < palabras; i++) {
      var r = this._genrandUint32();
      if (falta < 32) r = r >>> (32 - falta);
      resultado |= BigInt(r) << BigInt(32 * i);
      falta -= 32;
    }
    return resultado;
  };

  function bitLength(n) {
    var k = 0;
    if (typeof n === 'bigint') { while (n > 0n) { k++; n >>= 1n; } return k; }
    while (n > 0) { k++; n = Math.floor(n / 2); }
    return k;
  }

  // Devuelve un entero en [0, n). n puede ser Number (hasta 2^53) o BigInt.
  PyRandom.prototype.randbelow = function (n) {
    if (typeof n === 'bigint') {
      var kb = bitLength(n), rb = BigInt(this.getrandbits(kb));
      while (rb >= n) rb = BigInt(this.getrandbits(kb));
      return Number(rb);
    }
    if (n <= 0) throw new Error('randbelow necesita n > 0');
    var k = bitLength(n), r = this.getrandbits(k);
    while (Number(r) >= n) r = this.getrandbits(k);
    return Number(r);
  };

  PyRandom.prototype.randrange = function (inicio, fin) {
    if (fin === undefined) { fin = inicio; inicio = 0; }
    var ancho = fin - inicio;
    if (ancho <= 0) throw new Error('rango vacío para randrange');
    return inicio + this.randbelow(ancho);
  };

  PyRandom.prototype.randint = function (a, b) { return this.randrange(a, b + 1); };

  PyRandom.prototype.choice = function (seq) {
    if (!seq.length) throw new Error('no se puede elegir de una secuencia vacía');
    return seq[this.randbelow(seq.length)];
  };

  PyRandom.prototype.shuffle = function (x) {
    for (var i = x.length - 1; i >= 1; i--) {
      var j = this.randbelow(i + 1), tmp = x[i];
      x[i] = x[j]; x[j] = tmp;
    }
    return x;
  };

  PyRandom.prototype.sample = function (poblacion, k) {
    var n = poblacion.length;
    if (k < 0 || k > n) throw new Error('la muestra es mayor que la población o negativa');
    var resultado = new Array(k), tam = 21;
    if (k > 5) tam += Math.pow(4, Math.ceil(Math.log(k * 3) / Math.log(4)));
    var i, j;
    if (n <= tam) {
      var pool = Array.prototype.slice.call(poblacion);
      for (i = 0; i < k; i++) {
        j = this.randbelow(n - i);
        resultado[i] = pool[j];
        pool[j] = pool[n - i - 1];
      }
    } else {
      var elegidos = {};
      for (i = 0; i < k; i++) {
        j = this.randbelow(n);
        while (elegidos[j]) j = this.randbelow(n);
        elegidos[j] = true;
        resultado[i] = poblacion[j];
      }
    }
    return resultado;
  };

  PyRandom.prototype.uniform = function (a, b) { return a + (b - a) * this.random(); };

  // random.choices(poblacion, pesos) con k elementos (por defecto 1).
  PyRandom.prototype.choices = function (poblacion, pesos, k) {
    k = k === undefined ? 1 : k;
    var n = poblacion.length, acum = [], total = 0, i;
    if (pesos) { for (i = 0; i < n; i++) { total += pesos[i]; acum.push(total); } }
    var salida = [];
    for (i = 0; i < k; i++) {
      if (!pesos) { salida.push(poblacion[Math.floor(this.random() * n)]); continue; }
      var x = this.random() * total, lo = 0, hi = n - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (x < acum[mid]) hi = mid; else lo = mid + 1; }
      salida.push(poblacion[lo]);
    }
    return salida;
  };

  // Equivale a random.SystemRandom() / random.Random() sin semilla.
  PyRandom.sistema = function () { return new PyRandom(); };

  // Entero aleatorio de verdad en [0, n), como random.SystemRandom().randrange(n).
  PyRandom.sistemaRandrange = function (n) { return new PyRandom().randbelow(n); };

  return { PyRandom: PyRandom, sha512: sha512 };
});
