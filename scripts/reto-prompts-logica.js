/* =========================================================================
   R.E.T.O. - Generador de prompts (la parte que no depende de la pantalla)

   QUÉ ES
   Crear contenido para R.E.T.O. (libros, textos y tests) es más rápido si se lo
   pides a un asistente de IA, pero solo sirve si lo devuelve YA en el formato
   de marcado que los importadores leen. Este archivo redacta ese pedido: toma
   lo que la persona escribió en los campos (tema, materia, unidad, capítulo,
   saga, arco, fórmulas, público…) y lo convierte en un prompt completo, con las
   reglas exactas del formato y un ejemplo, listo para copiar y pegar.

   QUÉ PROMPTS ARMA
     libro          [N1] a [N4] con lecturas                (Biblioteca)
     texto          párrafos sin niveles                    (Biblioteca)
     test-fijo      [P] [R] [OK] [EXPLICA]                  (Test de conocimientos)
     test-dinamico  [DINAMICA] [VAR] [FORMULA] [DISTRACTOR] (Tests)

   POR QUÉ ESTÁ APARTE
   Redactar y validar son decisiones sin pantalla: qué se le pide a la IA, qué
   reglas del importador hay que repetirle, qué campos son obligatorios, si una
   fórmula usa algo que el evaluador no entiende. Son funciones puras (reciben
   datos y devuelven texto), así que se cargan igual en el navegador y en Node, y
   test_prompts.js las prueba, incluido lo más importante: que los EJEMPLOS que
   van dentro de cada prompt se importen sin errores con los importadores de
   verdad. Si el formato cambia y el ejemplo deja de importarse, la prueba
   avisa antes de que un prompt desactualizado le enseñe a la IA algo roto.

   DECISIONES DE REDACCIÓN (y por qué)
   - EL TONO ES UNO SOLO: neutro de aprendizaje. Lo que cambia es el PÚBLICO:
     el vocabulario, los ejemplos y la profundidad se adaptan, el tono no. Un
     niño de primaria no necesita diminutivos ni exclamaciones: necesita
     frases claras. Por eso el prompt lo dice con todas sus letras.
   - NO INVENTAR: se le pide omitir lo que no sepa en vez de rellenar. En
     material de estudio, un dato inventado enseñado como cierto es peor que un
     hueco.
   - SOLO EL FORMATO: se pide que responda únicamente con el contenido en un
     bloque de texto. Un saludo o un "aquí tienes" antes de la primera marca
     haría fallar el importador.
   - LOS TESTS PIDEN LO QUE LOS OTROS MODOS NECESITAN: respuestas cortas (para
     "Escribir") y respuestas correctas que no se repitan (para "Asociar") son
     interruptores que vienen encendidos.
   - LA EXPLICACIÓN NUNCA REGALA LA RESPUESTA (como en "Resolver"): ayuda a
     rehacerla.
   ========================================================================= */
(function (raiz) {
  'use strict';

  /* ------------------------------------------------ lo que NO se inventa aquí
     Estos números son los del importador y del evaluador. Si cambian allá, la
     prueba de este módulo lo nota (ver test_prompts.js). */
  var MIN_RESPUESTAS = 2;
  var MAX_RESPUESTAS = 6;
  var MAX_CARACTERES_CORTA = 40;       // lo mismo que RetoEscribirLogica.MAX_CARACTERES
  var FUNCIONES = ['round', 'floor', 'ceil', 'abs', 'min', 'max'];
  var RESERVADAS = FUNCIONES.concat(['Math']);
  var MAX_FILAS = { variables: 6, distractores: 6 };

  /* ---------------------------------------------------------- tipos de obra
     Cada tipo dice QUÉ significa cada nivel en ese caso. Es lo que hace que el
     mismo formato sirva para un tema de matemáticas y para la saga de un
     manga: [N2] puede ser una unidad o una saga, [N3] un capítulo o un arco. */
  var TIPOS = {
    estudio: {
      nombre: 'Tema de estudio (materia escolar o universitaria)',
      n1: 'Libro, curso o tema general', n2: 'Unidad o bloque', n3: 'Capítulo o tema', n4: 'Lectura o subtema',
      ej: ['Matemáticas de sexto grado', 'Fracciones', 'Suma de fracciones', 'Con distinto denominador'], ficcion: false
    },
    noficcion: {
      nombre: 'Libro o divulgación (no ficción)',
      n1: 'Título del libro', n2: 'Parte', n3: 'Capítulo', n4: 'Sección',
      ej: ['Breve historia del tiempo', 'El universo en expansión', 'El Big Bang', 'La radiación de fondo'], ficcion: false
    },
    serie: {
      nombre: 'Serie, anime o programa',
      n1: 'Serie', n2: 'Temporada o saga', n3: 'Arco', n4: 'Episodio o tema',
      ej: ['Dragon Ball Z', 'Saga de Freezer', 'Arco de Namek', 'La llegada de Freezer'], ficcion: true
    },
    comic: {
      nombre: 'Cómic o manga',
      n1: 'Obra', n2: 'Saga', n3: 'Arco', n4: 'Capítulo o tomo',
      ej: ['One Piece', 'Saga de Alabasta', 'Arco de Little Garden', 'El duelo en la isla'], ficcion: true
    },
    pelicula: {
      nombre: 'Película o saga de películas',
      n1: 'Título o saga', n2: 'Película o entrega', n3: 'Parte de la historia', n4: 'Escena o personaje',
      ej: ['El Señor de los Anillos', 'La comunidad del anillo', 'La travesía', 'Las minas de Moria'], ficcion: true
    },
    videojuego: {
      nombre: 'Videojuego',
      n1: 'Juego o saga', n2: 'Entrega', n3: 'Región o arco de la historia', n4: 'Misión o tema',
      ej: ['The Legend of Zelda', 'Breath of the Wild', 'Meseta de los Albores', 'El despertar de Link'], ficcion: true
    },
    novela: {
      nombre: 'Novela o ficción',
      n1: 'Título', n2: 'Parte', n3: 'Capítulo', n4: 'Escena',
      ej: ['Cien años de soledad', 'Primera parte', 'El origen de Macondo', 'La peste del insomnio'], ficcion: true
    },
    otro: {
      nombre: 'Otro',
      n1: 'Título', n2: 'Nivel 2', n3: 'Nivel 3', n4: 'Nivel 4',
      ej: ['', '', '', ''], ficcion: false
    }
  };

  /* --------------------------------------------------------------- públicos
     Ejemplos que rellenan el campo con un clic. El campo es de texto libre:
     esto solo evita empezar de cero. Ninguno es cursi a propósito: lo que se le
     pide a la IA es claridad, no ternura. */
  var PUBLICOS = [
    { id: 'primaria', nombre: 'Niño o niña de primaria',
      texto: 'Niño o niña de primaria (de 6 a 11 años): frases cortas, palabras de uso diario y ejemplos de su vida cotidiana, sin tono infantiloide ni cursi' },
    { id: 'secundaria', nombre: 'Adolescente',
      texto: 'Adolescente de secundaria o preparatoria: lenguaje directo y ejemplos cercanos a su mundo, sin condescendencia' },
    { id: 'joven-poco', nombre: 'Adulto joven que sabe poco del tema',
      texto: 'Adulto joven con poco conocimiento del tema: sin dar nada por sabido, explicando los términos la primera vez que aparecen' },
    { id: 'adulto-poco', nombre: 'Adulto sin conocimientos previos',
      texto: 'Adulto sin conocimientos previos del tema: explicación paciente y ordenada, de lo simple a lo complejo' },
    { id: 'fan', nombre: 'Adulto fan de la serie o saga',
      texto: 'Adulto fan de la serie o saga, que ya conoce la historia y los personajes: puede ir al detalle y a los matices, sin explicar lo básico' },
    { id: 'universidad', nombre: 'Estudiante universitario',
      texto: 'Estudiante universitario: precisión terminológica y mayor profundidad conceptual' },
    { id: 'lectura-dificil', nombre: 'Persona que lee con dificultad',
      texto: 'Persona a quien le cuesta leer textos largos (por ejemplo, con dislexia o TDAH): frases cortas, una idea por oración, párrafos breves y vocabulario sencillo, sin infantilizar' },
    { id: 'profesional', nombre: 'Adulto que repasa',
      texto: 'Adulto que quiere repasar algo que ya vio: ir al grano, con precisión y sin rodeos' }
  ];

  var DIFICULTADES = [
    ['facil', 'Fácil'], ['media', 'Media'], ['dificil', 'Difícil'], ['mezcla', 'Mezcla creciente, de fácil a difícil']
  ];
  var ENFOQUES = [
    ['mezcla', 'Mezcla'], ['recuerdo', 'Recordar datos'], ['comprension', 'Comprender y explicar'], ['aplicacion', 'Aplicar a casos']
  ];
  var LONGITUDES = [
    ['breve', 'Breve (150 a 250 palabras, cerca de 1 minuto)'],
    ['media', 'Media (250 a 400 palabras, de 2 a 3 minutos)'],
    ['larga', 'Larga (400 a 600 palabras, de 3 a 4 minutos)']
  ];
  var TEXTO_LONGITUD = {
    breve: 'de 150 a 250 palabras', media: 'de 250 a 400 palabras', larga: 'de 400 a 600 palabras'
  };
  var SITUACIONES = [
    ['mezcla', 'Mezcla de ambas'], ['directa', 'Operación directa'], ['problema', 'Problema con una situación cotidiana']
  ];

  /* ============================================================ utilidades */

  function limpio(v) { return String(v === undefined || v === null ? '' : v).trim(); }

  function entero(v, min, max, defecto) {
    var n = Number(v);
    if (!isFinite(n)) return defecto;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  /* Una lista escrita en un campo: una por línea, o separada por punto y coma.
     Las comas NO separan: un título puede tenerlas ("Hamlet, príncipe de
     Dinamarca"). */
  function lista(v) {
    return limpio(v).split(/[\n;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function filas(v) { return Array.isArray(v) ? v : []; }

  function tipoDe(id) { return TIPOS[id] || TIPOS.estudio; }

  function publicoTexto(v) {
    var t = limpio(v.publico);
    return t;
  }

  /* ============================================================ los campos

     `campos(tipo, valores)` devuelve la lista de campos de ese prompt, con sus
     etiquetas YA adaptadas al tipo de obra elegido (cambia lo que dice [N2]
     según sea una unidad, una saga o una parte). La pantalla la dibuja tal cual.

       { id, etiqueta, ayuda, control: 'texto'|'area'|'numero'|'select'|'switch'|'filas',
         requerido, ejemplo, opciones, min, max, columnas, grupo }

     `grupo` solo ordena las secciones. */
  function campos(tipo, valores) {
    valores = valores || {};
    var t = tipoDe(valores.obra);
    var ficcion = t.ficcion;
    var C = [];
    var esLibro = tipo === 'libro';
    var esTexto = tipo === 'texto';
    var esFijo = tipo === 'test-fijo';
    var esDin = tipo === 'test-dinamico';
    var esTest = esFijo || esDin;

    C.push({
      id: 'obra', grupo: 'De qué trata', control: 'select',
      etiqueta: 'Qué tipo de contenido es',
      ayuda: 'Cambia lo que significa cada nivel [N] más abajo: una unidad en un tema de estudio, una saga o un arco en un manga o una serie.',
      opciones: Object.keys(TIPOS).map(function (k) { return [k, TIPOS[k].nombre]; })
    });

    if (esLibro || esTest) {
      C.push({
        id: 'titulo', grupo: 'De qué trata', control: 'texto', requerido: true, nombre: 'el título',
        etiqueta: (esTest ? 'Título del test' : t.n1) + ' [N1]',
        ayuda: esTest ? 'Es el título con el que aparecerá el test.' : 'Es el título del libro. Va en [N1].',
        ejemplo: t.ej[0]
      });
    } else {
      C.push({
        id: 'titulo', grupo: 'De qué trata', control: 'texto', requerido: true, nombre: 'el tema del texto',
        etiqueta: 'Tema del texto',
        ayuda: 'De qué trata el texto, en una frase.',
        ejemplo: t.ej[2] || t.ej[0]
      });
    }

    if (esTest) {
      C.push({
        id: 'materia', grupo: 'De qué trata', control: 'texto',
        etiqueta: 'Materia [MATERIA]',
        ayuda: 'Con qué se agrupa el test en las tarjetas. Si lo dejas vacío, se usa el título.',
        ejemplo: t.nombre === TIPOS.estudio.nombre ? 'Matemáticas' : ''
      });
    }

    if (esLibro || esTest) {
      C.push({
        id: 'n2', grupo: 'La estructura', control: 'texto',
        etiqueta: t.n2 + ' [N2]',
        ayuda: esLibro
          ? 'Si son varios, escríbelos separados por punto y coma o uno por línea: se crea un bloque por cada uno, en ese orden.'
          : 'El tema de las preguntas. Si son varios (punto y coma o uno por línea), se reparten las preguntas entre ellos.',
        ejemplo: t.ej[1]
      });
      C.push({
        id: 'n3', grupo: 'La estructura', control: 'texto',
        etiqueta: t.n3 + ' [N3]',
        ayuda: 'Opcional. Igual que el anterior: varios con punto y coma o uno por línea.',
        ejemplo: t.ej[2]
      });
      C.push({
        id: 'n4', grupo: 'La estructura', control: 'texto',
        etiqueta: t.n4 + ' [N4]',
        ayuda: esLibro
          ? 'Opcional. Cada [N4] es una lectura de ' + TEXTO_LONGITUD.media + '. Si lo dejas vacío, la IA propone los títulos.'
          : 'Opcional.',
        ejemplo: t.ej[3]
      });
    }

    if (esLibro) {
      C.push({
        id: 'lecturas', grupo: 'La estructura', control: 'numero', min: 1, max: 40,
        etiqueta: 'Cuántas lecturas [N4] en total',
        ayuda: 'Cada lectura es un texto corto con su título en [N4]. Un libro necesita al menos una para poder practicarse.'
      });
    }

    if (esLibro || esTexto) {
      C.push({
        id: 'longitud', grupo: 'La estructura', control: 'select',
        etiqueta: esLibro ? 'Longitud de cada lectura' : 'Longitud del texto',
        opciones: LONGITUDES
      });
    }

    if (esFijo) {
      C.push({
        id: 'cuantas', grupo: 'Las preguntas', control: 'numero', min: 3, max: 40,
        etiqueta: 'Cuántas preguntas'
      });
      C.push({
        id: 'opciones', grupo: 'Las preguntas', control: 'numero', min: MIN_RESPUESTAS, max: MAX_RESPUESTAS,
        etiqueta: 'Respuestas por pregunta',
        ayuda: 'Cuenta la correcta: con 4 hay una correcta y tres incorrectas. De ' + MIN_RESPUESTAS + ' a ' + MAX_RESPUESTAS + '.'
      });
      C.push({
        id: 'dificultad', grupo: 'Las preguntas', control: 'select',
        etiqueta: 'Dificultad', opciones: DIFICULTADES
      });
      C.push({
        id: 'enfoque', grupo: 'Las preguntas', control: 'select',
        etiqueta: 'Qué miden las preguntas', opciones: ENFOQUES
      });
      C.push({
        id: 'cortas', grupo: 'Las preguntas', control: 'switch',
        etiqueta: 'Respuestas correctas cortas',
        ayuda: 'Hasta ' + MAX_CARACTERES_CORTA + ' caracteres, para poder practicar el test escribiendo la respuesta ("Escribir").'
      });
      C.push({
        id: 'distintas', grupo: 'Las preguntas', control: 'switch',
        etiqueta: 'Que la respuesta correcta no se repita entre preguntas',
        ayuda: 'Para poder practicar el test uniendo con líneas ("Asociar"): si dos respuestas fueran iguales, la unión sería ambigua.'
      });
    }

    if (esDin) {
      C.push({
        id: 'cuantas', grupo: 'Las preguntas', control: 'numero', min: 1, max: 10,
        etiqueta: 'Cuántas preguntas dinámicas',
        ayuda: 'Cada una genera números nuevos cada vez que sale.'
      });
      C.push({
        id: 'practica', grupo: 'Las preguntas', control: 'area', requerido: true, nombre: 'qué se practica',
        etiqueta: 'Qué se practica',
        ayuda: 'La habilidad o la operación, con el tipo de números que quieres.',
        ejemplo: 'Divisiones de un número de 4 cifras con decimales entre uno de 2 cifras'
      });
      C.push({
        id: 'situacion', grupo: 'Las preguntas', control: 'select',
        etiqueta: 'Cómo se presenta', opciones: SITUACIONES
      });
      C.push({
        id: 'redondeo', grupo: 'La matemática', control: 'numero', min: 0, max: 4,
        etiqueta: 'Decimales del resultado',
        ayuda: 'El resultado se redondea con round(..., n). 0 es un entero.'
      });
      C.push({
        id: 'variables', grupo: 'La matemática', control: 'filas', max: MAX_FILAS.variables,
        etiqueta: 'Variables (los números que cambian)',
        ayuda: 'Opcional. Si las dejas vacías, la IA elige nombres y rangos. Cada una se escribe en el enunciado entre llaves, por ejemplo {dividendo}. El paso es de cuánto en cuánto puede variar.',
        columnas: [
          { id: 'nombre', etiqueta: 'Nombre', ejemplo: 'dividendo' },
          { id: 'min', etiqueta: 'Mínimo', ejemplo: '1000', numero: true },
          { id: 'max', etiqueta: 'Máximo', ejemplo: '9999.99', numero: true },
          { id: 'paso', etiqueta: 'Paso', ejemplo: '0.5', numero: true },
          { id: 'decimales', etiqueta: 'Decimales', ejemplo: '2', numero: true }
        ]
      });
      C.push({
        id: 'formula', grupo: 'La matemática', control: 'texto',
        etiqueta: 'Fórmula [FORMULA]',
        ayuda: 'Opcional. Solo con las variables de arriba y estas funciones: ' + FUNCIONES.join(', ') + '. Operadores + - * / % ** y paréntesis.',
        ejemplo: 'round(dividendo / divisor, 2)'
      });
      C.push({
        id: 'distractores', grupo: 'La matemática', control: 'filas', max: MAX_FILAS.distractores,
        etiqueta: 'Errores típicos [DISTRACTOR]',
        ayuda: 'Opcional. Cada uno es una fórmula que da un resultado equivocado, y es la respuesta incorrecta que se le muestra a quien se equivoca así. La clase es "calculo" (error de operación) o "concepto" (error de idea). Se necesitan al menos 2; si pones menos, la IA completa hasta 3.',
        columnas: [
          { id: 'formula', etiqueta: 'Fórmula del error', ejemplo: 'round(dividendo / divisor * 10, 2)' },
          { id: 'clase', etiqueta: 'Clase', opciones: [['calculo', 'calculo'], ['concepto', 'concepto']] }
        ]
      });
    }

    /* Para quién y con qué cuidado: común a los cuatro. */
    C.push({
      id: 'publico', grupo: 'Para quién', control: 'area', requerido: true, nombre: 'el público al que va dirigido',
      etiqueta: 'Público al que va dirigido',
      ayuda: 'Define el vocabulario, los ejemplos y la profundidad. El tono siempre es neutro de aprendizaje; lo que cambia es el nivel. Elige un ejemplo o escríbelo con tus palabras.',
      ejemplo: 'Adulto joven con poco conocimiento del tema'
    });

    if ((esLibro || esTexto || esTest) && ficcion) {
      C.push({
        id: 'spoilers', grupo: 'Para quién', control: 'switch',
        etiqueta: 'Puede contener spoilers',
        ayuda: 'Apagado, la IA evita revelar giros y finales de lo que no se haya cubierto.'
      });
    }

    C.push({
      id: 'alcance', grupo: 'Más detalles', control: 'area',
      etiqueta: 'Puntos que sí deben aparecer (y lo que debe quedar fuera)',
      ayuda: 'Opcional. Una indicación por línea. Por ejemplo: "incluye el arco de Namek" o "nada de la segunda temporada".'
    });

    return C;
  }

  /* Los valores con que arranca cada pantalla. */
  function valoresIniciales(tipo) {
    var v = {
      obra: 'estudio', titulo: '', materia: '', n2: '', n3: '', n4: '',
      publico: '', alcance: '', spoilers: 'off'
    };
    if (tipo === 'libro') { v.lecturas = '6'; v.longitud = 'media'; }
    if (tipo === 'texto') { v.longitud = 'media'; }
    if (tipo === 'test-fijo') {
      v.cuantas = '8'; v.opciones = '4'; v.dificultad = 'mezcla'; v.enfoque = 'mezcla';
      v.cortas = 'on'; v.distintas = 'on';
    }
    if (tipo === 'test-dinamico') {
      v.cuantas = '3'; v.practica = ''; v.situacion = 'mezcla'; v.redondeo = '2';
      v.variables = []; v.formula = ''; v.distractores = [];
    }
    return v;
  }

  /* ========================================================== la validación

     Lo que se valida es lo que la persona ESCRIBE en los campos, antes de armar
     el prompt: que no falte lo obligatorio y que las fórmulas y variables que
     escribió se puedan usar. (No se revisa lo que conteste la IA: de eso se
     encarga el importador.)

     Devuelve [{ campo, tipo: 'error'|'aviso', texto }]. Un 'error' bloquea el
     copiado (el prompt saldría roto); un 'aviso' solo se muestra. */

  function identificadores(formula) {
    var s = String(formula).replace(/\d+(\.\d+)?/g, ' ');
    return (s.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []);
  }

  function revisarFormula(formula, nombres) {
    var f = limpio(formula);
    var p = [];
    if (!f) return p;
    if (f.indexOf('|') >= 0) p.push('La fórmula no puede llevar el carácter | (separa los datos de la línea).');
    if (f.indexOf('^') >= 0) p.push('Para elevar a una potencia usa ** (por ejemplo x ** 2), no ^.');
    if (/[^A-Za-z0-9_ .,+\-*\/%()]/.test(f.replace(/\*\*/g, ''))) {
      p.push('La fórmula tiene caracteres que el evaluador no entiende. Solo se admiten letras, números, + - * / % **, paréntesis y comas.');
    }
    var abre = (f.match(/\(/g) || []).length, cierra = (f.match(/\)/g) || []).length;
    if (abre !== cierra) p.push('Los paréntesis de la fórmula no cierran (' + abre + ' que abren y ' + cierra + ' que cierran).');
    var desconocidos = [];
    identificadores(f).forEach(function (id) {
      if (nombres.indexOf(id) < 0 && FUNCIONES.indexOf(id) < 0 && desconocidos.indexOf(id) < 0) desconocidos.push(id);
    });
    if (desconocidos.length) {
      p.push('La fórmula usa ' + desconocidos.join(', ') + ', que no es una variable declarada ni una función permitida (' + FUNCIONES.join(', ') + ').');
    }
    return p;
  }

  function nombreValido(n) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(n) && RESERVADAS.indexOf(n) < 0;
  }

  function validar(tipo, v) {
    v = v || {};
    var P = [];
    function error(campo, texto) { P.push({ campo: campo, tipo: 'error', texto: texto }); }
    function aviso(campo, texto) { P.push({ campo: campo, tipo: 'aviso', texto: texto }); }

    campos(tipo, v).forEach(function (c) {
      if (c.requerido && !limpio(v[c.id])) error(c.id, 'Falta ' + (c.nombre || c.etiqueta.replace(/\s*\[.*?\]\s*$/, '')) + '.');
    });

    if (tipo === 'test-fijo') {
      var op = Number(v.opciones);
      if (!(op >= MIN_RESPUESTAS && op <= MAX_RESPUESTAS)) error('opciones', 'Las respuestas por pregunta van de ' + MIN_RESPUESTAS + ' a ' + MAX_RESPUESTAS + '.');
      if (v.cortas === 'on' && op === MIN_RESPUESTAS) aviso('opciones', 'Con solo 2 respuestas se acierta por azar la mitad de las veces. Considera 3 o más.');
    }

    if (tipo === 'libro' && limpio(v.n4) === '' && Number(v.lecturas) < 1) {
      error('lecturas', 'Un libro necesita al menos una lectura [N4].');
    }
    if ((tipo === 'libro' || tipo === 'test-fijo' || tipo === 'test-dinamico')) {
      if (limpio(v.n3) && !limpio(v.n2)) aviso('n3', 'Escribiste [N3] sin [N2]: los niveles no se saltan, y la IA pondrá uno intermedio por ti.');
      if (limpio(v.n4) && !limpio(v.n3)) aviso('n4', 'Escribiste [N4] sin [N3]: los niveles no se saltan, y la IA pondrá uno intermedio por ti.');
    }

    if (tipo === 'test-dinamico') {
      var vars = filas(v.variables).filter(function (r) { return limpio(r.nombre) || limpio(r.min) || limpio(r.max); });
      var nombres = [];
      vars.forEach(function (r, i) {
        var n = limpio(r.nombre), cual = 'Variable ' + (i + 1) + (n ? ' (' + n + ')' : '') + ': ';
        if (!n) error('variables', cual + 'falta el nombre.');
        else if (!nombreValido(n)) error('variables', cual + 'el nombre solo puede llevar letras, números y guion bajo, sin acentos ni espacios, y no puede ser una función (' + FUNCIONES.join(', ') + ').');
        else if (nombres.indexOf(n) >= 0) error('variables', cual + 'el nombre está repetido.');
        else nombres.push(n);
        var mn = Number(r.min), mx = Number(r.max), ps = Number(r.paso), dc = Number(r.decimales);
        if (limpio(r.min) === '' || limpio(r.max) === '' || !isFinite(mn) || !isFinite(mx)) error('variables', cual + 'el mínimo y el máximo tienen que ser números.');
        else if (mn > mx) error('variables', cual + 'el mínimo es mayor que el máximo.');
        if (limpio(r.paso) !== '' && !(ps > 0)) error('variables', cual + 'el paso tiene que ser mayor que 0.');
        if (limpio(r.decimales) !== '' && !(isFinite(dc) && dc >= 0 && dc <= 6 && Math.round(dc) === dc)) error('variables', cual + 'los decimales son un entero de 0 a 6.');
      });
      revisarFormula(v.formula, nombres).forEach(function (t) { error('formula', t); });
      if (limpio(v.formula) && !vars.length) aviso('formula', 'Escribiste una fórmula pero ninguna variable: la IA tendrá que inventar los nombres y puede no coincidir con tu fórmula.');
      filas(v.distractores).filter(function (r) { return limpio(r.formula); }).forEach(function (r, i) {
        revisarFormula(r.formula, nombres).forEach(function (t) { error('distractores', 'Error típico ' + (i + 1) + ': ' + t); });
      });
      /* Si el enunciado va a contar personas u objetos, sus variables no pueden
         tener decimales: no se reparten 52.3 libros entre 6.13 salones. */
      if (v.situacion !== 'directa') {
        var conDecimales = vars.filter(function (r) { return Number(r.decimales) > 0; })
          .map(function (r) { return limpio(r.nombre); });
        if (conDecimales.length) {
          aviso('variables', 'Con una situación cotidiana, lo que se cuenta (personas, libros, salones, animales) tiene que ser entero: pon 0 decimales a esas variables. Ahora tienen decimales: ' + conDecimales.join(', ') + '. Solo lo que se mide (dinero, litros, kilos, metros, tiempo) puede llevarlos.');
        }
      }
    }
    return P;
  }

  /* ============================================================ el prompt */

  var ROL = 'Actúa como un especialista en diseño instruccional y redacción educativa.';

  var TONO = 'Escribe en español, con un tono neutro de aprendizaje: claro, directo y respetuoso. ' +
    'Evita el tono cursi, los diminutivos, las exclamaciones y los sermones, y no trates al lector como a un niño aunque sea joven. ' +
    'Explica sin simplificar de más.';

  var NO_INVENTAR = 'No inventes datos. Si no estás seguro de un dato, omítelo o exprésalo de forma general. ' +
    'Prefiero un hueco a una afirmación dudosa presentada como cierta.';

  var SALIDA = 'Responde ÚNICAMENTE con el contenido en el formato indicado, dentro de un solo bloque de código de texto. ' +
    'No escribas saludos, títulos extra ni comentarios antes ni después del bloque.';

  /* Los ejemplos de cada formato. Se prueban con los importadores reales en
     test_prompts.js: si dejan de importarse sin errores, la prueba falla. */
  var EJEMPLO_LIBRO = [
    '[N1] Los números que usamos',
    '',
    '[N2] La suma',
    '',
    '[N3] Sumar sin llevar',
    '',
    '[N4] Sumar unidades y decenas',
    '',
    'Para sumar dos números se alinean por columnas, empezando por las unidades. Cada columna se suma por separado y su resultado se escribe debajo.',
    '',
    'Cuando la suma de una columna no llega a diez, no hay nada que llevar.'
  ].join('\n');

  var EJEMPLO_TEXTO = [
    'El agua cambia de estado según la temperatura. Por debajo de 0 grados se congela y por encima de 100 hierve al nivel del mar.',
    '',
    'En ese cambio de estado no se crea ni se pierde agua: solo cambia la forma en que se agrupan sus partículas.'
  ].join('\n');

  var EJEMPLO_FIJO = [
    '[N1] Test de fracciones',
    '[MATERIA] Matemáticas',
    '[DESCRIPCION] Evalúa la suma y la comparación de fracciones sencillas.',
    '',
    '[N2] Fracciones',
    '[N3] Suma de fracciones',
    '[P] ¿Cuánto es 1/2 + 1/4?',
    '[R] 2/6',
    '[OK] 3/4',
    '[R] 1/6',
    '[R] 2/4',
    '[EXPLICA] Para sumar fracciones con distinto denominador, primero hay que buscar un denominador común. Piensa en cuántos cuartos hay en un medio.',
    '',
    '[P] ¿Qué fracción es mayor, 2/3 o 3/5?',
    '[R] 3/5',
    '[OK] 2/3',
    '[R] Son iguales',
    '[R] No se pueden comparar',
    '[EXPLICA] Escribe las dos fracciones con el mismo denominador y compara los numeradores.'
  ].join('\n');

  var EJEMPLO_DINAMICO = [
    '[N1] Test de divisiones con decimales',
    '[MATERIA] Matemáticas',
    '[DESCRIPCION] Práctica de divisiones con números que cambian cada vez.',
    '',
    '[N2] Aritmética',
    '[N3] División con decimales',
    '',
    '[DINAMICA] Resuelve la división de {dividendo} entre {divisor}. Redondea el resultado a dos decimales.',
    '[VAR] dividendo: 1000.00, 9999.99, 0.50, 2',
    '[VAR] divisor: 10.00, 99.99, 0.25, 2',
    '[FORMULA] round(dividendo / divisor, 2)',
    '[DISTRACTOR] round(dividendo / divisor + 0.1, 2) | calculo',
    '[DISTRACTOR] round(dividendo / divisor * 10, 2) | calculo',
    '[DISTRACTOR] round(dividendo / divisor / 10, 2) | concepto',
    '[EXPLICA] Iguala los decimales del divisor convirtiéndolo en entero y divide paso a paso.',
    '',
    '[DINAMICA] Una pizzería reparte {pizzas} pizzas enteras en partes iguales entre {mesas} mesas. ¿Cuántas pizzas completas recibe cada mesa?',
    '[VAR] pizzas: 20, 90, 1, 0',
    '[VAR] mesas: 3, 9, 1, 0',
    '[FORMULA] floor(pizzas / mesas)',
    '[DISTRACTOR] floor(pizzas / mesas) + 1 | calculo',
    '[DISTRACTOR] floor(pizzas / mesas) - 1 | calculo',
    '[DISTRACTOR] floor(mesas / pizzas) | concepto',
    '[EXPLICA] Se pide cuántas pizzas COMPLETAS le tocan a cada mesa: no se parten. Piensa cuántas veces cabe el número de mesas en el de pizzas.'
  ].join('\n');

  function fenced(texto) { return '```text\n' + texto + '\n```'; }

  /* Una línea "Etiqueta: valor" solo si hay valor. */
  function dato(etiqueta, valor) {
    var t = limpio(valor);
    return t ? '- ' + etiqueta + ': ' + t : '';
  }

  function datoLista(etiqueta, valor) {
    var l = lista(valor);
    if (!l.length) return '';
    return l.length === 1 ? '- ' + etiqueta + ': ' + l[0] : '- ' + etiqueta + ' (uno por bloque, en este orden): ' + l.join('; ');
  }

  function juntar(partes) {
    return partes.filter(function (p) { return p !== '' && p !== null && p !== undefined; }).join('\n');
  }

  function bloque(titulo, cuerpo) {
    return '## ' + titulo + '\n' + cuerpo;
  }

  function contexto(tipo, v) {
    var t = tipoDe(v.obra);
    var esTest = tipo === 'test-fijo' || tipo === 'test-dinamico';
    var base = [
      dato('Tipo de contenido', t.nombre),
      dato(tipo === 'texto' ? 'Tema' : 'Título', v.titulo),
      esTest ? dato('Materia', v.materia) : ''
    ];
    if (tipo === 'libro' || esTest) {
      base.push(datoLista(t.n2 + ' [N2]', v.n2));
      base.push(datoLista(t.n3 + ' [N3]', v.n3));
      base.push(datoLista(t.n4 + ' [N4]', v.n4));
    }
    return juntar(base);
  }

  function paraQuien(v) {
    var l = ['Público al que va dirigido: ' + publicoTexto(v) + '.',
      'Adapta el vocabulario, los ejemplos y la profundidad a ese público; el tono sigue siendo el neutro de aprendizaje indicado arriba.'];
    if (tipoDe(v.obra).ficcion) {
      l.push(v.spoilers === 'on'
        ? 'Puedes revelar giros y finales de lo que se cubra.'
        : 'Evita spoilers: no reveles giros ni finales de lo que no se haya cubierto.');
    }
    return l.join('\n');
  }

  /* Lo único libre que se pide: qué debe aparecer y qué debe quedar fuera. */
  function extras(v) {
    var al = lista(v.alcance);
    if (!al.length) return '';
    return 'Sigue todas estas indicaciones sobre el contenido:\n' + al.map(function (x) { return '- ' + x; }).join('\n');
  }

  /* ----------------------------------------------------------------- libro */
  function promptLibro(v, o) {
    var t = tipoDe(v.obra);
    var n = entero(v.lecturas, 1, 40, 6);
    var longitud = TEXTO_LONGITUD[v.longitud] || TEXTO_LONGITUD.media;

    var reglas = [
      'El archivo empieza con [N1] pegado al margen izquierdo, seguido del título del libro. Sin líneas vacías ni texto antes.',
      'Las marcas [N1], [N2], [N3] y [N4] van al principio de la línea, SIN espacios antes, seguidas de un espacio y su título. Los niveles llegan hasta [N4].',
      'Los niveles NO se saltan: después de [N1] viene [N2], después de [N2] viene [N3] y después de [N3] viene [N4]. Nunca abras un nivel sin haber abierto el anterior.',
      'Cada [N4] es una LECTURA: un texto corto de ' + longitud + ' en párrafos. El libro necesita al menos una. Debe haber ' + n + ' lecturas [N4] en total.',
      'Los párrafos se separan con una línea en blanco. No uses viñetas, tablas ni encabezados de otro tipo, ni ninguna otra marca entre corchetes.',
      'Cada lectura tiene que poder leerse sola, sin depender de la anterior.'
    ];

    var partes = [
      ROL + ' Necesito que redactes un LIBRO para estudiar y leer, listo para importar en R.E.T.O.',
      bloque('Tono', TONO),
      bloque('Veracidad', NO_INVENTAR),
      bloque('Para quién', paraQuien(v)),
      bloque('De qué trata', contexto('libro', v)),
      bloque('Estructura (en qué consiste cada nivel)',
        '- [N1] ' + t.n1 + '\n- [N2] ' + t.n2 + '\n- [N3] ' + t.n3 + '\n- [N4] ' + t.n4 + ' (aquí va el texto de lectura)' +
        '\nSi un nivel trae varios valores, crea un bloque por cada uno, en el orden dado. Si un nivel no trae valores, propón tú los títulos de forma coherente.'),
      extras(v) ? bloque('Detalles', extras(v)) : '',
      bloque('Reglas estrictas del formato', reglas.map(function (r, i) { return (i + 1) + '. ' + r; }).join('\n'))
    ];
    if (o.ejemplo) {
      partes.push(bloque('Ejemplo del formato',
        'Solo muestra la forma de las marcas; no copies su contenido.\n\n' + fenced(EJEMPLO_LIBRO)));
    }
    partes.push(bloque('Antes de responder', 'Revisa que todas las marcas estén bien escritas, que no se salte ningún nivel y que haya ' + n + ' lecturas [N4].\n\n' + SALIDA));
    return partes.filter(Boolean).join('\n\n');
  }

  /* ----------------------------------------------------------------- texto */
  function promptTexto(v, o) {
    var longitud = TEXTO_LONGITUD[v.longitud] || TEXTO_LONGITUD.media;
    var reglas = [
      'Es UN solo texto de ' + longitud + ', escrito en párrafos.',
      'No lleva título, encabezados, viñetas, tablas ni ninguna marca entre corchetes, como [N1], [N2], [N3] o [N4].',
      'Los párrafos se separan con una línea en blanco.',
      'El texto tiene que entenderse solo, sin conocer nada más.'
    ];
    var partes = [
      ROL + ' Necesito que redactes un TEXTO CORTO para leer y estudiar, listo para importar en R.E.T.O.',
      bloque('Tono', TONO),
      bloque('Veracidad', NO_INVENTAR),
      bloque('Para quién', paraQuien(v)),
      bloque('De qué trata', contexto('texto', v)),
      extras(v) ? bloque('Detalles', extras(v)) : '',
      bloque('Reglas estrictas del formato', reglas.map(function (r, i) { return (i + 1) + '. ' + r; }).join('\n'))
    ];
    if (o.ejemplo) {
      partes.push(bloque('Ejemplo del formato',
        'Solo muestra la forma; no copies su contenido.\n\n' + fenced(EJEMPLO_TEXTO)));
    }
    partes.push(bloque('Antes de responder', 'Revisa que el texto no lleve marcas de nivel ni encabezados.\n\n' + SALIDA));
    return partes.filter(Boolean).join('\n\n');
  }

  /* ------------------------------------------------------------- test fijo */
  function promptFijo(v, o) {
    var n = entero(v.cuantas, 3, 40, 8);
    var op = entero(v.opciones, MIN_RESPUESTAS, MAX_RESPUESTAS, 4);
    var dif = { facil: 'fácil', media: 'media', dificil: 'difícil', mezcla: 'creciente: empieza fácil y termina difícil' }[v.dificultad] || 'media';
    var enf = {
      mezcla: 'una mezcla de recordar datos, comprender y aplicar',
      recuerdo: 'recordar datos',
      comprension: 'comprender y explicar con palabras propias',
      aplicacion: 'aplicar lo aprendido a casos concretos'
    }[v.enfoque] || 'una mezcla de recordar datos, comprender y aplicar';

    var reglas = [
      'El archivo empieza con [N1] pegado al margen izquierdo, seguido del título del test. Sin líneas vacías ni texto antes.',
      'Después de [N1] van las líneas [MATERIA] y [DESCRIPCION]. ' +
        (limpio(v.materia) ? 'Usa [MATERIA] ' + limpio(v.materia) + '.' : 'Si no hay materia, no escribas [MATERIA].') +
        ' Escribe tú una [DESCRIPCION] de una línea sobre lo que evalúa el test.',
      'Los temas se indican con [N2], [N3] y [N4] (los niveles que haya), ANTES de las preguntas que cubren. No se saltan niveles: un [N3] solo va después de un [N2]. Un [N2] nuevo cierra los [N3] y [N4] anteriores.',
      'Cada pregunta empieza con [P] y su enunciado.',
      'Cada pregunta tiene EXACTAMENTE ' + op + ' respuestas en total: UNA correcta con [OK] y ' + (op - 1) + ' incorrectas con [R]. (El importador acepta de ' + MIN_RESPUESTAS + ' a ' + MAX_RESPUESTAS + ' respuestas.)',
      'Cambia de lugar la respuesta [OK] de una pregunta a otra: no la pongas siempre en la misma posición.',
      'Las respuestas incorrectas deben ser PLAUSIBLES: errores que de verdad cometería quien no domina el tema. Nada de opciones absurdas ni de relleno como "todas las anteriores" o "ninguna de las anteriores".',
      'Cada pregunta termina con [EXPLICA]: una explicación pedagógica de por qué es así. NO debe contener la respuesta correcta tal cual: tiene que ayudar a quien falló a rehacer el razonamiento.',
      'Cada marca va al principio de la línea, sin espacios antes. Un texto largo puede seguir en las líneas de abajo, pero cada marca nueva empieza su propia línea.'
    ];
    if (v.cortas === 'on') {
      reglas.push('Cada respuesta correcta [OK] tiene que ser CORTA: un término, un nombre, un número o una frase breve de hasta ' + MAX_CARACTERES_CORTA + ' caracteres. Los enunciados deben poder contestarse sin ver las opciones.');
    }
    if (v.distintas === 'on') {
      reglas.push('Ninguna respuesta correcta [OK] se repite entre dos preguntas del test (ni "Verdadero" ni "Falso" repetidos): cada pregunta tiene una respuesta correcta distinta.');
    }

    var partes = [
      ROL + ' Necesito que redactes un TEST de evaluación de ' + n + ' preguntas, listo para importar en R.E.T.O.',
      bloque('Tono', TONO),
      bloque('Veracidad', NO_INVENTAR),
      bloque('Para quién', paraQuien(v)),
      bloque('De qué trata', contexto('test-fijo', v)),
      bloque('Las preguntas',
        '- Cantidad: ' + n + '\n- Dificultad: ' + dif + '\n- Qué miden: ' + enf),
      extras(v) ? bloque('Detalles', extras(v)) : '',
      bloque('Reglas estrictas del formato', reglas.map(function (r, i) { return (i + 1) + '. ' + r; }).join('\n'))
    ];
    if (o.ejemplo) {
      partes.push(bloque('Ejemplo del formato',
        'Solo muestra la forma de las marcas (aquí con 4 respuestas por pregunta); no copies su contenido.\n\n' + fenced(EJEMPLO_FIJO)));
    }
    partes.push(bloque('Antes de responder',
      'Revisa que cada pregunta tenga exactamente una [OK] y ' + (op - 1) + ' [R], que cada una tenga su [EXPLICA] sin regalar la respuesta, y que haya ' + n + ' preguntas.\n\n' + SALIDA));
    return partes.filter(Boolean).join('\n\n');
  }

  /* --------------------------------------------------------- test dinámico */
  function lineaVar(r) {
    var dec = limpio(r.decimales) === '' ? '0' : String(Number(r.decimales));
    var paso = limpio(r.paso) === '' ? '1' : String(Number(r.paso));
    return '[VAR] ' + limpio(r.nombre) + ': ' + Number(r.min) + ', ' + Number(r.max) + ', ' + paso + ', ' + dec;
  }

  function lineaDistractor(r) {
    return '[DISTRACTOR] ' + limpio(r.formula) + ' | ' + (limpio(r.clase) === 'concepto' ? 'concepto' : 'calculo');
  }

  /* LA COHERENCIA DEL CONTEXTO. El motor sortea cada variable por separado y no
     sabe qué significa cada una: si el enunciado dice "52.3 libros entre 6.13
     salones", sale tal cual. Por eso las reglas de sentido se le piden a la IA, y
     el motor solo recibe lo que ya las cumple: variables enteras para lo que se
     cuenta, y floor(a / b) o a % b cuando hay que repartir objetos enteros. */
  var REGLAS_CONTEXTO = [
    'Lo que se CUENTA (personas, libros, salones, animales, pizzas, cajas…) es siempre un número entero: esas variables llevan 0 decimales. Solo lo que se MIDE (dinero, litros, kilos, metros, tiempo) puede llevar decimales.',
    'No pongas decimales en algo que no se puede partir. Nunca: "reparte 52.3 libros entre 6.13 salones".',
    'Para repartir objetos enteros entre grupos, no pidas una división con decimales. Pide con floor(a / b) cuántos le tocan a cada grupo, o con a % b cuántos sobran. También puedes dar los factores y preguntar por el total: "5 cajas con 12 libros cada una, ¿cuántos libros hay?".',
    'Si la operación pide números con decimales, usa una situación de cosas que se miden (precios, longitudes, capacidades), no de cosas que se cuentan.',
    'Antes de escribir cada enunciado, pruébalo mentalmente con el valor mínimo y con el máximo de cada variable: ¿la situación sigue teniendo sentido? Si no, cambia el contexto o los rangos.',
    'El resultado también debe tener sentido en la situación: sin negativos donde sea imposible y sin cantidades absurdas.',
    'Si ninguna situación cotidiana encaja bien con la operación, usa una operación directa ("Calcula 25 × 51"): es mejor que un contexto forzado.'
  ];

  function promptDinamico(v, o) {
    var n = entero(v.cuantas, 1, 10, 3);
    var red = entero(v.redondeo, 0, 4, 2);
    var sit = {
      mezcla: 'mezcla de operaciones directas y problemas con una situación cotidiana',
      directa: 'operaciones directas',
      problema: 'problemas con una situación cotidiana, cada uno con un contexto distinto'
    }[v.situacion] || 'mezcla de operaciones directas y problemas con una situación cotidiana';

    var vars = filas(v.variables).filter(function (r) { return limpio(r.nombre); });
    var dist = filas(v.distractores).filter(function (r) { return limpio(r.formula); });
    var tieneModelo = vars.length || limpio(v.formula) || dist.length;

    var modelo = '';
    if (tieneModelo) {
      var lineas = [];
      vars.forEach(function (r) { lineas.push(lineaVar(r)); });
      if (limpio(v.formula)) lineas.push('[FORMULA] ' + limpio(v.formula));
      dist.forEach(function (r) { lineas.push(lineaDistractor(r)); });
      modelo = bloque('Datos de la pregunta modelo',
        'Estas líneas describen la PRIMERA pregunta. Úsalas tal cual, sin cambiarlas, y completa lo que falte (por ejemplo el enunciado, y los distractores que falten).' +
        (n > 1 ? ' Las otras ' + (n - 1) + ' preguntas son variaciones que propones tú: otra situación u operación relacionada, con sus propias variables y su propia fórmula.' : '') +
        '\n\n' + fenced(lineas.join('\n')));
    }

    var reglas = [
      'El archivo empieza con [N1] pegado al margen izquierdo, seguido del título del test. Sin líneas vacías ni texto antes. Después, [MATERIA] y [DESCRIPCION] como en el ejemplo (escribe tú la descripción, de una línea).',
      'Los temas se indican con [N2], [N3] y [N4] ANTES de las preguntas que cubren, sin saltar niveles.',
      'Cada pregunta dinámica empieza con [DINAMICA] y su enunciado. Los números que cambian se escriben en el enunciado entre llaves, por ejemplo {dividendo}, y deben coincidir EXACTAMENTE con el nombre de una variable.',
      'Cada variable va en una línea [VAR] con este formato: [VAR] nombre: mínimo, máximo, paso, decimales (cuatro números). Los nombres solo llevan letras, números y guion bajo, sin acentos ni espacios. Una variable con 0 decimales da siempre enteros.',
      'Cada pregunta tiene UNA línea [FORMULA] que calcula la respuesta correcta con las variables. Solo puede usar: ' + FUNCIONES.join(', ') + ' (por ejemplo round(x, 2)), los operadores + - * / % ** y paréntesis. Nada más: ninguna otra función ni librería. El resultado se redondea con round(..., ' + red + ') cuando lleva decimales. Esta fórmula se le muestra a quien falla, con los números de la pregunta puestos, así que escríbela clara y directa.',
      'Cada pregunta tiene de 3 a 4 líneas [DISTRACTOR] con este formato: [DISTRACTOR] fórmula | clase. Cada fórmula calcula un resultado EQUIVOCADO que cometería quien se equivoca de una manera típica y distinta (punto decimal mal puesto, operación invertida, olvidar un paso…). La clase es "calculo" si el error es de operación o "concepto" si es de idea. Ningún distractor puede dar el mismo valor que la fórmula correcta. No uses el carácter | dentro de las fórmulas.',
      'Cada pregunta termina con [EXPLICA]: una explicación breve de la idea, sin la respuesta numérica. No escribas pasos numerados: la fórmula y su resultado se muestran solos.',
      'Cada marca va al principio de la línea, sin espacios antes, y cada marca nueva empieza su propia línea.',
      'Elige rangos que den resultados razonables: sin divisiones entre cero, sin números negativos si no corresponde y sin resultados con demasiados decimales.'
    ];

    var partes = [
      ROL + ' Necesito que redactes un TEST DINÁMICO de ' + n + (n === 1 ? ' pregunta' : ' preguntas') + ' donde los números cambian cada vez que sale la pregunta, listo para importar en R.E.T.O.',
      bloque('Tono', TONO),
      bloque('Veracidad', NO_INVENTAR + ' Comprueba que las fórmulas den resultados correctos con valores de prueba.'),
      bloque('Para quién', paraQuien(v)),
      bloque('De qué trata', contexto('test-dinamico', v)),
      bloque('Qué se practica', limpio(v.practica) + '\n- Presentación: ' + sit + '\n- Decimales del resultado: ' + red),
      bloque('Coherencia entre la situación y los números (muy importante)',
        'Las variables se sortean al azar dentro de sus rangos, sin saber qué significan. Por eso tú tienes que garantizar que CUALQUIER valor posible tenga sentido en la situación:\n' +
        REGLAS_CONTEXTO.map(function (r, i) { return (i + 1) + '. ' + r; }).join('\n')),
      modelo,
      extras(v) ? bloque('Detalles', extras(v)) : '',
      bloque('Reglas estrictas del formato', reglas.map(function (r, i) { return (i + 1) + '. ' + r; }).join('\n'))
    ];
    if (o.ejemplo) {
      partes.push(bloque('Ejemplo del formato',
        'Solo muestra la forma de las marcas (la segunda pregunta muestra cómo repartir objetos enteros); no copies su contenido.\n\n' + fenced(EJEMPLO_DINAMICO)));
    }
    partes.push(bloque('Antes de responder',
      'Revisa que cada {variable} del enunciado exista como [VAR], que cada fórmula use solo funciones permitidas, que cada pregunta tenga al menos 3 [DISTRACTOR] con resultados distintos al correcto, que lo que se cuenta sea entero en TODOS los valores posibles y que haya ' + n + ' preguntas.\n\n' + SALIDA));
    return partes.filter(Boolean).join('\n\n');
  }

  /* El prompt completo. `opciones.ejemplo` (por omisión, sí): incluir el ejemplo
     del formato. Sin él, el prompt es más corto pero la IA tiene menos para
     imitar. */
  function armarPrompt(tipo, valores, opciones) {
    var v = valores || {};
    var o = { ejemplo: !(opciones && opciones.ejemplo === false) };
    if (tipo === 'libro') return promptLibro(v, o);
    if (tipo === 'texto') return promptTexto(v, o);
    if (tipo === 'test-fijo') return promptFijo(v, o);
    if (tipo === 'test-dinamico') return promptDinamico(v, o);
    return '';
  }

  var API = {
    MIN_RESPUESTAS: MIN_RESPUESTAS,
    MAX_RESPUESTAS: MAX_RESPUESTAS,
    MAX_CARACTERES_CORTA: MAX_CARACTERES_CORTA,
    FUNCIONES: FUNCIONES,
    MAX_FILAS: MAX_FILAS,
    TIPOS: TIPOS,
    PUBLICOS: PUBLICOS,
    EJEMPLOS: { libro: EJEMPLO_LIBRO, texto: EJEMPLO_TEXTO, 'test-fijo': EJEMPLO_FIJO, 'test-dinamico': EJEMPLO_DINAMICO },
    campos: campos,
    valoresIniciales: valoresIniciales,
    validar: validar,
    revisarFormula: revisarFormula,
    armarPrompt: armarPrompt,
    lista: lista
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.RetoPromptsLogica = API;
})(typeof window !== 'undefined' ? window : this);
