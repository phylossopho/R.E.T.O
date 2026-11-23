/* =========================================================================
   R.E.T.O. - Escribir (la parte que no depende de la pantalla)

   QUÉ ES
   "Escribir" es contestar un test SIN ver las opciones: se lee la pregunta y se
   escribe la respuesta. Recordar sin ayuda enseña más que reconocer la correcta
   entre varias, y por eso es el paso que sigue al opción múltiple. Lee las
   mismas preguntas del banco (fijas y dinámicas); no hay formato nuevo.

   LO DIFÍCIL DE ESTE MODO ES DECIDIR SI LO ESCRITO ES LA RESPUESTA
   Una persona no escribe igual que el banco. Aquí se decide con estas reglas, y
   todas buscan lo mismo: no castigar la forma cuando el fondo está bien.

   - Mayúsculas, acentos y espacios de más no cuentan: "oceano indico" es
     "Océano Índico". La ñ sí cuenta (año no es ano).
   - Los artículos del principio ("el lago Baikal" = "Lago Baikal") y los signos
     de los extremos se ignoran.
   - LOS NÚMEROS SE COMPARAN COMO NÚMEROS, no como texto: "116,2" y "116.20"
     son lo mismo. En las dinámicas la tolerancia es la mitad del último
     decimal que pide la pregunta: con 2 decimales, 116.214 vale y 116.2 no.
   - TOLERANCIA A ERRORES DE ESCRITURA (se elige en los ajustes): "flexible"
     acepta una letra de más, de menos o cambiada en palabras de 5 a 9 letras
     y dos en las de 10 o más; las de 4 o menos tienen que ir exactas. Pero
     NUNCA pasa algo que se parezca más a un distractor que a la correcta: si
     alguien escribe lo que sería una opción incorrecta, es incorrecta aunque
     le falte una letra.
   - Lo escrito que coincide con un distractor se reconoce: en las dinámicas
     eso dice QUÉ error se cometió ('calculo' o 'concepto') y en qué paso.

   QUÉ PREGUNTAS SIRVEN
   Escribir una oración entera no es recordar, es teclear. Las preguntas cuya
   respuesta correcta pasa de 40 caracteres no entran a este modo (para esas
   están las tarjetas).
   ========================================================================= */
(function (raiz) {
  'use strict';

  var Inst = (typeof module !== 'undefined' && module.exports)
    ? require('./reto-tests-instancia.js') : raiz.RetoTestsInstancia;

  var MAX_CARACTERES = 40;
  var ARTICULOS = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'];

  /* El texto "limpio" para comparar. */
  function normalizar(texto) {
    var t = String(texto === undefined || texto === null ? '' : texto).toLowerCase();
    t = t.replace(/\u00f1/g, '\u0001');                    // la ñ se guarda aparte
    t = t.normalize ? t.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : t;
    t = t.replace(/\u0001/g, '\u00f1');
    t = t.replace(/^[\s"'\u00ab\u00bb\u201c\u201d\u00bf\u00a1.,;:!?()\-]+|[\s"'\u00ab\u00bb\u201c\u201d\u00bf\u00a1.,;:!?()\-]+$/g, '');
    t = t.replace(/\s+/g, ' ');
    var partes = t.split(' ');
    if (partes.length > 1 && ARTICULOS.indexOf(partes[0]) >= 0) partes.shift();
    return partes.join(' ');
  }

  /* Un número escrito, o NaN si no es solo un número. `miles`: si un punto o una
     coma seguidos de exactamente tres cifras son separador de miles (en las
     fijas: "2,300"); en las dinámicas son decimales ("1.500" con 3 decimales). */
  function numero(texto, miles) {
    var t = String(texto === undefined || texto === null ? '' : texto).trim().replace(/\s/g, '');
    if (!t) return NaN;
    if (miles && /^-?\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ''));
    if (/^-?\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
    return NaN;
  }

  function distancia(a, b) {
    if (a === b) return 0;
    var fila = [];
    for (var j = 0; j <= b.length; j++) fila.push(j);
    for (var i = 1; i <= a.length; i++) {
      var anterior = fila[0];
      fila[0] = i;
      for (var k = 1; k <= b.length; k++) {
        var viejo = fila[k];
        fila[k] = Math.min(
          fila[k] + 1,
          fila[k - 1] + 1,
          anterior + (a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1)
        );
        anterior = viejo;
      }
    }
    return fila[b.length];
  }

  function permitidos(longitud) {
    if (longitud <= 4) return 0;
    if (longitud <= 9) return 1;
    return 2;
  }

  /* ¿Sirve esta pregunta armada para escribirla? */
  function sirve(q) {
    var ok = Inst.respuestaOk(q);
    if (!ok) return false;
    var t = String(ok.texto).trim();
    return t.length > 0 && t.length <= MAX_CARACTERES;
  }

  /* Compara lo escrito con la pregunta armada `q`.
       tolerancia: 'estricta' | 'flexible'
     Devuelve { resultado: 'ok'|'mal'|'vacio', cercano: bool, opcion }
       cercano: acertó, pero con alguna letra distinta (para avisarlo)
       opcion:  el distractor que coincide con lo escrito, si lo hay */
  function evaluar(q, escrito, tolerancia) {
    var ok = Inst.respuestaOk(q);
    var esc = normalizar(escrito);
    if (!esc) return { resultado: 'vacio', cercano: false, opcion: null };
    var distractores = q.opciones.filter(function (o) { return !o.correcta; });

    /* Números: se comparan como números. */
    var miles = q.tipo !== 'dinamica';
    var nOk = numero(ok.texto, miles);
    var nEsc = numero(escrito, miles);
    if (!isNaN(nOk)) {
      if (isNaN(nEsc)) return { resultado: 'mal', cercano: false, opcion: null };
      var tol = q.tipo === 'dinamica' ? 0.5 * Math.pow(10, -(q.decimales === null ? 2 : q.decimales)) : 1e-9;
      if (Math.abs(nOk - nEsc) <= tol + 1e-12) return { resultado: 'ok', cercano: false, opcion: null };
      var coincide = null;
      distractores.forEach(function (o) {
        var n = numero(o.texto, miles);
        if (!isNaN(n) && Math.abs(n - nEsc) <= tol + 1e-12) coincide = o;
      });
      return { resultado: 'mal', cercano: false, opcion: coincide };
    }

    /* Texto. */
    var objetivo = normalizar(ok.texto);
    if (esc === objetivo) return { resultado: 'ok', cercano: false, opcion: null };
    var opcion = null;
    distractores.forEach(function (o) { if (normalizar(o.texto) === esc) opcion = o; });
    if (opcion) return { resultado: 'mal', cercano: false, opcion: opcion };

    if (tolerancia === 'flexible') {
      var d = distancia(esc, objetivo);
      var maximo = permitidos(objetivo.length);
      if (d > 0 && d <= maximo) {
        /* Nunca se aprueba algo que se parezca más a un distractor. */
        var masCerca = distractores.some(function (o) {
          return distancia(esc, normalizar(o.texto)) <= d;
        });
        if (!masCerca) return { resultado: 'ok', cercano: true, opcion: null };
      }
    }
    return { resultado: 'mal', cercano: false, opcion: null };
  }

  /* La clase del resultado, la misma que entiende el registro de repaso. */
  function clasificar(acierto, opcion) {
    if (acierto) return 'dominada';
    if (opcion && opcion.clase === 'calculo') return 'calculo';
    if (opcion && opcion.clase === 'concepto') return 'concepto';
    return 'repasar';
  }

  /* Una ayuda para quien no recuerda: 'longitud' dice cuántas letras tiene la
     respuesta; 'inicial' además da la primera. Los números solo dan la
     longitud (la primera cifra ya sería media respuesta). Una raya por letra
     solo cuando caben (hasta 16); más larga, con los rayones se vuelve una
     fila ilegible y basta con decir cuántas son. */
  function pista(q, modo) {
    var ok = Inst.respuestaOk(q);
    if (!ok || !modo || modo === 'off') return '';
    var t = String(ok.texto).trim();
    var raya = function (s) { return s.replace(/[^\s]/g, '_').split('').join(' ').replace(/ {2,}/g, '   '); };
    var esNum = !isNaN(numero(t, true));
    var cuantos = t.length + (t.length === 1 ? ' carácter' : ' caracteres');
    var inicial = modo === 'inicial' && !esNum && t.length > 1;
    if (t.length > 16) {
      return (inicial ? 'empieza con \u00AB' + t.charAt(0) + '\u00BB y ' : '') + 'tiene ' + cuantos;
    }
    if (inicial) return t.charAt(0) + ' ' + raya(t.slice(1)) + '  (' + cuantos + ')';
    return raya(t) + '  (' + cuantos + ')';
  }

  var API = {
    MAX_CARACTERES: MAX_CARACTERES,
    normalizar: normalizar,
    numero: numero,
    distancia: distancia,
    sirve: sirve,
    evaluar: evaluar,
    clasificar: clasificar,
    pista: pista
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.RetoEscribirLogica = API;
})(typeof window !== 'undefined' ? window : this);
