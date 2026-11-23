/* =========================================================================
   R.E.T.O. - Importar tests desde un archivo de texto

   Lee un texto plano con las marcas de R.E.T.O. y lo convierte en tests del
   banco. Sirve igual en el navegador y en Node, para poder probarlo sin abrir
   nada (test_importar_tests.js) y revisar un archivo desde la terminal
   (_revisar_tests.js). Es la hermana de scripts/reto-marcado.js: usa las
   mismas [N1] a [N4], y devuelve los problemas con el mismo aspecto
   ({ tipo: 'error' | 'aviso', linea, texto }).

   POR QUÉ UN ARCHIVO DE TEXTO
   Escribir 100 preguntas en un formulario es lento. En un archivo de texto se
   escriben en un editor cualquiera, se copian y se pegan, se corrigen con
   buscar y reemplazar, y se le pueden pedir a un asistente que las redacte ya
   en este formato. Y, como cada marca lleva todo lo que el editor del banco
   pide (tema, respuesta correcta, texto para leer, explicación del error), lo
   importado queda IGUAL que lo escrito a mano.

   EL FORMATO
   ----------
   Una marca va al principio de la línea, sin espacios antes. Lo que sigue en la
   misma línea (y en las líneas siguientes, hasta la próxima marca) es su texto.

     [N1] Examen global de sexto grado    EL TÍTULO DEL TEST. Cada [N1] empieza un
                                           test nuevo; un archivo puede traer varios.
     [MATERIA] Examen global               (opcional) con qué se agrupa en las tarjetas.
                                           Si falta, se usa el título.
     [DESCRIPCION] Un poco de todo.        (opcional)

     [N2] Matemáticas                      EL TEMA de las preguntas que siguen,
     [N3] Bloque I                         en hasta tres niveles. Son opcionales
     [N4] Las fracciones                   y NO hay que usarlos todos: lo que no
                                           existe no se concatena.

     [TEXTO] Un zorro hambriento...        (opcional) texto para leer. Va ANTES del [P]
     [FRASE] Saltó una y otra vez.         (opcional) la frase del texto donde está la
                                           respuesta. Va después de [TEXTO], antes del [P]
     [P] ¿Cuánto es 1/2 + 1/4?             LA PREGUNTA
     [R] 2/6                               una respuesta incorrecta
     [OK] 3/4                              LA respuesta correcta (solo una)
     [R] 1/6
     [EXPLICA] Para sumar fracciones...    qué se le muestra a quien falla. Nunca la
                                           respuesta: lo que ayuda a rehacerla.

   Un texto largo ([TEXTO], [EXPLICA], la pregunta o una respuesta) puede seguir en
   las líneas de abajo: se unen con un espacio, como un párrafo que se partió
   para que cupiera en el editor. Para un PÁRRAFO NUEVO dentro de un [TEXTO] o un
   [EXPLICA], deja una línea en blanco.

   Las líneas que empiezan con # son comentarios y se ignoran.

   REGLAS QUE SE PIDEN, y por qué
   - El archivo empieza con [N1]. Sin título no hay test.
   - Cada [N2], [N3] o [N4] REEMPLAZA a su nivel y BORRA los de abajo: un [N2]
     nuevo deja sin [N3] ni [N4] hasta que se escriban otra vez. Es lo que
     esperaría quien escribió un índice.
   - Una marca solo afecta a la pregunta donde está. Un [TEXTO] compartido por dos
     preguntas se escribe dos veces: es más largo pero no hay ningún estado
     escondido que adivinar ("¿esta pregunta heredó el texto de la de arriba?").
   - De 2 a 6 respuestas y UNA sola [OK].
   - [FRASE] tiene que aparecer, tal cual, dentro de [TEXTO].

   QUÉ NO HACE, Y POR QUÉ
   No inventa ni arregla nada: igual que reto-marcado.js, dice lo que está mal y
   en qué línea, y no lo mueve a donde "tendría que estar". Una pregunta con un
   error NO se importa (las demás sí, si la persona lo decide), porque una
   pregunta sin respuesta correcta que se cuela en el banco es peor que una que
   se queda afuera avisando.

   Todavía no hay marcas para las preguntas con números que cambian: eso espera
   al motor (ver ESTADO.md).
   ========================================================================= */
(function (raiz) {
  'use strict';

  var MAX_RESPUESTAS = 6;
  var MIN_RESPUESTAS = 2;
  var LETRAS = ['a', 'b', 'c', 'd', 'e', 'f'];

  // Una marca al principio de la linea: [N1], [P], [OK]... Letras, numeros y
  // acentos, para que una [DESCRIPCIÓN] con acento se reconozca.
  var RE_MARCA = /^\[([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+)\][ \t]*(.*)$/;
  // Una marca bien escrita pero con espacios antes: se avisa aparte, igual que
  // en reto-marcado.js, porque "no se entiende" no diria lo que pasa.
  var RE_INDENTADA = /^[ \t]+\[[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+\]/;

  var MARCAS = { N1: 1, N2: 1, N3: 1, N4: 1, MATERIA: 1, DESCRIPCION: 1, TEXTO: 1,
                 FRASE: 1, P: 1, R: 1, OK: 1, EXPLICA: 1, DINAMICA: 1, VAR: 1,
                 FORMULA: 1, DISTRACTOR: 1, PASO: 1 };

  var PLANTILLA = [
    '# R.E.T.O. - Plantilla para importar tests',
    '# Las lineas que empiezan con # son comentarios: se ignoran.',
    '# Cada marca va al principio de la linea, sin espacios antes.',
    '',
    '# [N1] es el TITULO del test. Cada [N1] empieza un test nuevo.',
    '[N1] Examen global de sexto grado',
    '[MATERIA] Examen global',
    '[DESCRIPCION] Un poco de todo lo aprendido.',
    '',
    '# [N2], [N3] y [N4] son el TEMA de las preguntas que siguen.',
    '# No hay que usar los tres: lo que falta no se concatena.',
    '[N2] Matematicas',
    '[N3] Bloque I',
    '[N4] Las fracciones',
    '',
    '[P] Cuanto es 1/2 + 1/4?',
    '[R] 2/6',
    '[OK] 3/4',
    '[R] 1/6',
    '[R] 2/4',
    '[EXPLICA] Para sumar fracciones con distinto denominador, primero busca un',
    'denominador comun: 1/2 es lo mismo que 2/4. Despues se suman los numeradores.',
    '',
    '# Un nuevo [N3] borra el [N4] anterior.',
    '[N3] Bloque II',
    '',
    '[P] Cuantos centimetros hay en un metro?',
    '[R] 10',
    '[OK] 100',
    '[R] 1000',
    '[EXPLICA] "Centi" significa centesima parte.',
    '',
    '# Una pregunta de lectura: [TEXTO] y [FRASE] van ANTES del [P].',
    '[N2] Lectura',
    '[TEXTO] Un zorro hambriento vio unas uvas maduras en una parra alta. Salto una y otra',
    'vez, pero no logro alcanzarlas. Cansado, se alejo diciendo que seguro estaban verdes.',
    '[FRASE] Salto una y otra vez, pero no logro alcanzarlas.',
    '[P] Por que el zorro se fue sin las uvas?',
    '[R] Eran de otro dueno',
    '[OK] No pudo alcanzarlas',
    '[R] Estaban podridas',
    '[EXPLICA] La respuesta esta en el texto: fijate en lo que hizo con las uvas.',
    ''
  ].join('\n');

  /* La ruta de un tema: los niveles 2 a 4 que existan, en orden. Misma regla que
     rutaDeTema() de reto-tests-lista.js. */
  function ruta(tema) {
    var s = [];
    ['n2', 'n3', 'n4'].forEach(function (k) {
      var v = tema && tema[k] ? String(tema[k]).trim() : '';
      if (v) s.push(v);
    });
    return s;
  }

  function normalizar(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }

  function copiarTema(t) {
    var c = {};
    ['n2', 'n3', 'n4'].forEach(function (k) { if (t[k]) c[k] = t[k]; });
    return c;
  }

  /* Convierte el texto en { tests, problemas }. Cada test trae sus preguntas con
     `valida` (true si no tiene errores) y la linea donde empezo. */
  function parsear(texto) {
    var lineas = String(texto === undefined || texto === null ? '' : texto)
      .replace(/^\uFEFF/, '').split(/\r?\n/);
    var problemas = [];
    var tests = [];
    var test = null;
    var tema = {};
    var q = null;               // la pregunta abierta
    var pend = null;            // { texto, frase, linea } de un [TEXTO] que espera su [P]
    var campo = null;           // a que campo se agregan las lineas de continuacion
    var salto = false;          // hubo una linea en blanco dentro de un [TEXTO] o [EXPLICA]
    var empezoTest = false;

    function problema(tipo, linea, txt) { problemas.push({ tipo: tipo, linea: linea, texto: txt }); }
    function error(linea, txt) { problema('error', linea, txt); }
    function aviso(linea, txt) { problema('aviso', linea, txt); }

    function cerrarPregunta() {
      if (!q) return;
      var n = problemas.length;
      var pre = 'La pregunta de la línea ' + q.linea;
      if (!q.enunciado) error(q.linea, pre + ' no tiene texto.');

      if (q.tipo === 'dinamica') {
        if (!q.variables.length) error(q.linea, pre + ' (dinámica) no tiene variables ([VAR]).');
        if (!q.formula) error(q.linea, pre + ' (dinámica) no tiene fórmula ([FORMULA]).');
        if (!q.distractores || q.distractores.length < 2) error(q.linea, pre + ' (dinámica) necesita al menos 2 distractores ([DISTRACTOR]).');
      } else {
        if (q.opciones.length < MIN_RESPUESTAS) {
          error(q.linea, pre + ' tiene ' + q.opciones.length + (q.opciones.length === 1 ? ' respuesta' : ' respuestas') +
            '. Necesita entre ' + MIN_RESPUESTAS + ' y ' + MAX_RESPUESTAS + '.');
        } else if (q.opciones.length > MAX_RESPUESTAS) {
          error(q.linea, pre + ' tiene ' + q.opciones.length + ' respuestas. El máximo es ' + MAX_RESPUESTAS + '.');
        }
        var buenas = q.opciones.filter(function (o) { return o.correcta; }).length;
        if (buenas === 0) error(q.linea, pre + ' no tiene respuesta correcta. Marca una con [OK].');
        if (buenas > 1) error(q.linea, pre + ' tiene ' + buenas + ' respuestas [OK]. Solo una puede ser la correcta.');
        q.opciones.forEach(function (o) {
          if (!o.texto) error(o.linea, 'La respuesta de la línea ' + o.linea + ' está vacía.');
        });
        if (q.frase && !q.pasaje) error(q.linea, pre + ' tiene [FRASE] pero no [TEXTO].');
        if (q.frase && q.pasaje && normalizar(q.pasaje).indexOf(normalizar(q.frase)) < 0) {
          error(q.linea, pre + ': la [FRASE] no aparece igual dentro del [TEXTO]. Cópiala tal cual.');
        }
        var vistos = {};
        q.opciones.forEach(function (o) {
          var k = normalizar(o.texto).toLowerCase();
          if (k && vistos[k]) aviso(o.linea, 'La respuesta "' + o.texto + '" está repetida en la pregunta de la línea ' + q.linea + '.');
          vistos[k] = true;
        });
      }

      q.valida = problemas.length === n || !problemas.slice(n).some(function (p) { return p.tipo === 'error'; });
      test.preguntas.push(q);
      q = null;
      campo = null;
    }

    function cerrarTest() {
      if (!test) return;
      cerrarPregunta();
      if (pend) {
        aviso(pend.linea, 'Hay un [TEXTO] en la línea ' + pend.linea + ' sin pregunta después. No se importa.');
        pend = null;
      }
      if (!test.preguntas.length) error(test.linea, 'El test "' + test.titulo + '" no tiene preguntas.');
      var sinTema = test.preguntas.filter(function (p) { return !ruta(p.tema).length; }).length;
      if (sinTema) {
        aviso(test.linea, sinTema + (sinTema === 1 ? ' pregunta' : ' preguntas') + ' de "' + test.titulo +
          '" ' + (sinTema === 1 ? 'no tiene' : 'no tienen') + ' tema ([N2] a [N4]): al terminar, el resultado no podrá decir qué repasar.');
      }
      var sinExplica = test.preguntas.filter(function (p) { return !p.contexto; }).length;
      if (sinExplica) {
        aviso(test.linea, sinExplica + (sinExplica === 1 ? ' pregunta' : ' preguntas') + ' de "' + test.titulo +
          '" ' + (sinExplica === 1 ? 'no tiene' : 'no tienen') + ' [EXPLICA]: si alguien falla, no habrá nada que mostrarle.');
      }
      var enunciados = {};
      test.preguntas.forEach(function (p) {
        var k = normalizar(p.enunciado).toLowerCase();
        if (k && enunciados[k]) aviso(p.linea, 'La pregunta de la línea ' + p.linea + ' es igual a la de la línea ' + enunciados[k] + '.');
        else if (k) enunciados[k] = p.linea;
      });
      tests.push(test);
      test = null;
    }

    function agregar(texto, sep) {
      // Agrega una linea de continuacion al campo abierto.
      if (campo === 'enunciado') q.enunciado = (q.enunciado + ' ' + texto).trim();
      else if (campo === 'opcion') {
        var o = q.opciones[q.opciones.length - 1];
        o.texto = (o.texto + ' ' + texto).trim();
      } else if (campo === 'explica') q.contexto = (q.contexto ? q.contexto + (salto ? '\n' : ' ') : '') + texto;
      else if (campo === 'texto') pend.texto = (pend.texto ? pend.texto + (salto ? '\n' : ' ') : '') + texto;
      else if (campo === 'frase') pend.frase = (pend.frase + ' ' + texto).trim();
      else if (campo === 'descripcion') test.descripcion = (test.descripcion ? test.descripcion + ' ' : '') + texto;
    }

    for (var i = 0; i < lineas.length; i++) {
      var n = i + 1;
      var crudo = lineas[i].replace(/\s+$/, '');
      if (!crudo.trim()) {                                  // linea en blanco
        if (campo === 'texto' || campo === 'explica') salto = true;
        continue;
      }
      if (/^#/.test(crudo)) continue;                       // comentario

      if (RE_INDENTADA.test(crudo)) {
        error(n, 'La marca de la línea ' + n + ' tiene espacios antes. Las marcas van pegadas al borde izquierdo.');
        continue;
      }
      var m = RE_MARCA.exec(crudo);
      if (!m) {
        // Texto sin marca: sigue al campo abierto, o no pertenece a nada.
        if (campo) { agregar(crudo.trim()); salto = false; }
        else if (!test) {
          if (!empezoTest) { error(n, 'El archivo tiene que empezar con [N1] y el título del test.'); empezoTest = true; }
        } else {
          error(n, 'La línea ' + n + ' no pertenece a nada. Ponle una marca ([P], [R], [OK]…) o bórrala.');
        }
        continue;
      }
      salto = false;
      var nombre = m[1].toUpperCase().replace('Ó', 'O');
      var cuerpo = m[2].trim();
      if (!MARCAS[nombre]) {
        error(n, 'No se conoce la marca [' + m[1] + '] (línea ' + n + '). Las marcas son: N1 a N4, MATERIA, DESCRIPCION, TEXTO, FRASE, P, R, OK y EXPLICA.');
        campo = null;
        continue;
      }

      if (nombre === 'N1') {
        cerrarTest();
        empezoTest = true;
        if (!cuerpo) error(n, 'Al [N1] de la línea ' + n + ' le falta el título.');
        test = { titulo: cuerpo, materia: '', descripcion: '', linea: n, preguntas: [] };
        tema = {};
        campo = null;
        continue;
      }
      if (!test) {
        if (!empezoTest) { error(n, 'El archivo tiene que empezar con [N1] y el título del test (línea ' + n + ').'); empezoTest = true; }
        continue;
      }

      if (nombre === 'N2' || nombre === 'N3' || nombre === 'N4') {
        cerrarPregunta();
        if (pend) { aviso(pend.linea, 'Hay un [TEXTO] en la línea ' + pend.linea + ' sin pregunta después. No se importa.'); pend = null; }
        var nivel = Number(nombre.charAt(1));
        if (!cuerpo) { error(n, 'Al [' + nombre + '] de la línea ' + n + ' le falta el nombre del tema.'); campo = null; continue; }
        tema['n' + nivel] = cuerpo;
        for (var d = nivel + 1; d <= 4; d++) delete tema['n' + d];
        campo = null;
        continue;
      }

      if (nombre === 'MATERIA' || nombre === 'DESCRIPCION') {
        if (test.preguntas.length || q) {
          error(n, 'El [' + nombre + '] de la línea ' + n + ' va justo después del [N1], antes de las preguntas.');
          campo = null;
          continue;
        }
        if (nombre === 'MATERIA') { test.materia = cuerpo; campo = null; }
        else { test.descripcion = cuerpo; campo = 'descripcion'; }
        continue;
      }

      if (nombre === 'TEXTO') {
        cerrarPregunta();
        if (pend) aviso(pend.linea, 'Hay un [TEXTO] en la línea ' + pend.linea + ' sin pregunta después. No se importa.');
        pend = { texto: cuerpo, frase: '', linea: n };
        campo = 'texto';
        continue;
      }
      if (nombre === 'FRASE') {
        if (!pend) { error(n, 'El [FRASE] de la línea ' + n + ' va después de un [TEXTO] y antes del [P].'); campo = null; continue; }
        pend.frase = cuerpo;
        campo = 'frase';
        continue;
      }
      if (nombre === 'P' || nombre === 'DINAMICA') {
        cerrarPregunta();
        q = { linea: n, tipo: nombre === 'DINAMICA' ? 'dinamica' : 'estatica', enunciado: cuerpo, opciones: [], correcta: null, pasaje: pend ? pend.texto : '',
              frase: pend ? pend.frase : '', contexto: '', tema: copiarTema(tema), variables: [], distractores: [], decimales: 2, valida: false };
        pend = null;
        campo = 'enunciado';
        continue;
      }
      // R, OK, EXPLICA, VAR, FORMULA, DISTRACTOR, PASO necesitan una pregunta abierta
      if (!q) {
        error(n, 'El [' + nombre + '] de la línea ' + n + ' no tiene una pregunta arriba. Empieza con [P] o [DINAMICA].');
        campo = null;
        continue;
      }
      if (nombre === 'R' || nombre === 'OK') {
        q.opciones.push({ texto: cuerpo, correcta: nombre === 'OK', linea: n });
        campo = 'opcion';
        continue;
      }
      if (nombre === 'EXPLICA') {
        q.contexto = cuerpo;
        campo = 'explica';
        continue;
      }
      if (nombre === 'VAR') {
        // Formato: nombre: min, max, paso, decimales
        var partes = cuerpo.split(':');
        if (partes.length === 2) {
          var vNombre = partes[0].trim();
          var vNums = partes[1].split(',').map(function(s) { return Number(s.trim()); });
          q.variables.push({
            nombre: vNombre,
            min: vNums[0] !== undefined ? vNums[0] : 1,
            max: vNums[1] !== undefined ? vNums[1] : 10,
            paso: vNums[2] !== undefined ? vNums[2] : 1,
            decimales: vNums[3] !== undefined ? vNums[3] : 0
          });
        }
        campo = 'var';
        continue;
      }
      if (nombre === 'FORMULA') {
        q.formula = cuerpo;
        campo = 'formula';
        continue;
      }
      if (nombre === 'DISTRACTOR') {
        // Formato: formula | clase. (Los archivos anteriores traian una tercera
        // parte, una nota; ya no se usa y se ignora.)
        var dPartes = cuerpo.split('|').map(function(s) { return s.trim(); });
        q.distractores.push({
          formula: dPartes[0] || '',
          clase: dPartes[1] || 'concepto'
        });
        campo = 'distractor';
        continue;
      }
      if (nombre === 'PASO') {
        // [PASO] ya no existe: la explicacion de una dinamica (formula, formula con
        // numeros y resultado) se arma sola. Los archivos anteriores que lo traen
        // se siguen importando, ignorando estas lineas sin avisar.
        campo = 'paso';
        continue;
      }
    }
    cerrarTest();
    if (!tests.length && !problemas.length) error(1, 'El archivo está vacío. Tiene que empezar con [N1] y el título del test.');

    return { tests: tests, problemas: problemas, resumen: resumir(tests, problemas) };
  }

  function resumir(tests, problemas) {
    var preguntas = 0, validas = 0;
    tests.forEach(function (t) {
      preguntas += t.preguntas.length;
      t.preguntas.forEach(function (p) { if (p.valida) validas++; });
    });
    return {
      tests: tests.length,
      preguntas: preguntas,
      validas: validas,
      errores: problemas.filter(function (p) { return p.tipo === 'error'; }).length,
      avisos: problemas.filter(function (p) { return p.tipo === 'aviso'; }).length
    };
  }

  /* Los tests listos para el banco, en el formato interno. `soloValidas` deja
     afuera las preguntas con error (y los tests que se quedan sin preguntas).
     `hoy` es la fecha de modificacion (ISO) y `base` un texto para los ids. */
  function aTests(resultado, opciones) {
    opciones = opciones || {};
    var hoy = opciones.hoy || new Date().toISOString().slice(0, 10);
    var base = opciones.base || ('imp-' + Date.now().toString(36));
    var salida = [];
    resultado.tests.forEach(function (t, ti) {
      var qs = t.preguntas.filter(function (p) { return !opciones.soloValidas || p.valida; });
      if (!qs.length) return;
      salida.push({
        id: 't-' + base + '-' + (ti + 1),
        titulo: t.titulo,
        materia: t.materia || t.titulo,
        descripcion: t.descripcion || '',
        modificado: hoy,
        preguntas: qs.map(function (p, pi) {
          if (p.tipo === 'dinamica') {
            var salidaQD = {
              id: 'q-' + base + '-' + (ti + 1) + '-' + (pi + 1),
              tipo: 'dinamica',
              enunciado: p.enunciado,
              variables: p.variables,
              formula: p.formula,
              decimales: p.decimales,
              distractores: p.distractores,
              opcionesAMostrar: 4
            };
            if (ruta(p.tema).length) salidaQD.tema = copiarTema(p.tema);
            return salidaQD;
          }
          var ops = p.opciones.map(function (o, k) { return { id: LETRAS[k], texto: o.texto }; });
          var idx = p.opciones.findIndex(function (o) { return o.correcta; });
          var salidaQ = {
            id: 'q-' + base + '-' + (ti + 1) + '-' + (pi + 1),
            tipo: 'estatica',
            enunciado: p.enunciado,
            opciones: ops,
            correcta: idx >= 0 ? LETRAS[idx] : null,
            contexto: p.contexto || ''
          };
          if (p.pasaje) salidaQ.pasaje = p.pasaje;
          if (p.frase) salidaQ.fraseClave = p.frase;
          if (ruta(p.tema).length) salidaQ.tema = copiarTema(p.tema);
          return salidaQ;
        })
      });
    });
    return salida;
  }

  var API = { parsear: parsear, aTests: aTests, plantilla: PLANTILLA, ruta: ruta };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.RetoTestsImportar = API;
})(typeof window !== 'undefined' ? window : this);
