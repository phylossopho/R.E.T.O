/* =========================================================================
   R.E.T.O. - Datos de muestra para la maqueta de los tests

   ESTO ES TEMPORAL, Y ESTÁ AQUÍ A PROPÓSITO
   La interfaz de "Gestionar banco de tests" y de "Resolver test" se está
   diseñando antes que el motor. Para poder tocarla y juzgarla hace falta que
   tenga algo que enseñar, y eso es este archivo: cuatro tests inventados.

   Cada pregunta trae `tema`: { n2, n3, n4 }, los niveles 2 a 4 del marcado
   [N1]..[N4] (el nivel 1 es el título del test). Cada nivel es opcional y los
   que faltan NO se concatenan: ver rutaDeTema() en reto-tests-lista.js.

   Los tests traen `modificado` (una fecha ISO) para poder ordenarlos "por fecha
   de modificación". El "último test realizado" NO está aquí: se guarda de verdad
   con RetoDatos cuando se termina un test (clave "tests-hecho-<id>"), porque es
   un dato de la persona y no de la muestra.

   Cuando exista el banco de verdad (IndexedDB, ver PROPUESTA 6) y el motor de
   Python, este archivo se borra y las dos pantallas leen de ahí. Por eso:
   - las pantallas piden los datos con `RetoTestsMuestra.copiar()`, una copia
     que se puede cambiar sin tocar el original, y nunca los leen sueltos;
   - nada de lo que haga la maqueta se guarda: al recargar, todo vuelve.

   LA FORMA DE UNA PREGUNTA (propuesta, falta decidirla: PROPUESTA 9)
   Lo que sigue es lo que la interfaz necesita para funcionar, y por lo tanto
   una propuesta de formato, no un formato cerrado. Hay dos tipos:

   Fija ("estatica"): respuestas escritas, que no cambian.
     { id, tipo: 'estatica', enunciado, pasaje?, fraseClave?,
       opciones: [{ id, texto }], correcta: id, contexto }

   Con números que cambian ("dinamica"): fórmulas y variables.
     { id, tipo: 'dinamica', enunciado: 'Un tren recorre {d} km en {t} h…',
       variables: [{ nombre, min, max, paso, decimales }],
       formula: 'd / t', decimales: 2,
       distractores: [{ formula, clase: 'concepto'|'calculo' }],
       opcionesAMostrar: 4 }

   La explicación de una pregunta dinámica NO se escribe: la arma sola el
   evaluador (scripts/reto-tests-eval.js) con los números de cada vez. Son tres
   líneas, que explicacion() de este archivo dibuja:
       Fórmula                         round(dividendo ÷ divisor, 2)
       Con los números de esta pregunta round(4358.2 ÷ 37.5, 2)
       Resultado                       116.22
   ========================================================================= */
(function () {
  'use strict';

  /* LOS ICONOS. Todos de línea, en un cuadro de 24 x 24, que hereda el color
     del texto. Siempre acompañan a una palabra: un icono solo no dice nada a
     quien no lo reconoce, y un lector de pantalla lo ignora. */
  var ICONOS = {
    estatica: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    dinamica: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
    mixto: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>',
    visto: '<path d="m5 12 5 5 9-10"/>',
    cruz: '<path d="M6 6l12 12M18 6 6 18"/>',
    aviso: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>',
    pregunta: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
    borrar: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    subir: '<path d="m6 15 6-6 6 6"/>',
    bajar: '<path d="m6 9 6 6 6-6"/>',
    volver: '<path d="m12 19-7-7 7-7M19 12H5"/>',
    sonido: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    libro: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>',
    lista: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    historia: '<path d="M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M3 10l9-6 9 6z"/>',
    mate: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
    lectura: '<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>',
    ciencias: '<path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-10V3"/>',
    idiomas: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    foco: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>'
  };

  function icono(id) {
    return '<svg class="tst-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
           (ICONOS[id] || '') + '</svg>';
  }

  /* Las dos preguntas con números que cambian. Se usan en más de un test. Los
     números salen del evaluador cada vez que se contestan. */
  var VELOCIDAD = {
    id: 'q-velocidad',
    tipo: 'dinamica',
    tema: { n2: 'Bloque II', n3: 'Velocidad' },
    enunciado: 'Un tren recorre {d} km en {t} horas. ¿Cuál es su velocidad, en km/h?',
    variables: [
      { nombre: 'd', min: 120, max: 480, paso: 10, decimales: 0 },
      { nombre: 't', min: 2, max: 7, paso: 1, decimales: 0 }
    ],
    formula: 'round(d / t, 2)',
    decimales: 2,
    distractores: [
      { formula: 'round(d * t, 2)', clase: 'concepto' },
      { formula: 'round(t / d, 2)', clase: 'concepto' },
      { formula: 'floor(d / t * 100) / 100', clase: 'calculo' }
    ],
    opcionesAMostrar: 4
  };

  var REBAJA = {
    id: 'q-rebaja',
    tipo: 'dinamica',
    tema: { n2: 'Bloque III', n3: 'Porcentajes' },
    enunciado: 'Un artículo cuesta {c} pesos y tiene una rebaja de {p} %. ¿Cuánto se paga con la rebaja?',
    variables: [
      { nombre: 'p', min: 10, max: 50, paso: 5, decimales: 0 },
      { nombre: 'c', min: 200, max: 1000, paso: 50, decimales: 0 }
    ],
    formula: 'round(c - c * p / 100, 2)',
    decimales: 2,
    distractores: [
      { formula: 'round(c * p / 100, 2)', clase: 'concepto' },
      { formula: 'c - p', clase: 'concepto' },
      { formula: 'floor(c - c * p / 100)', clase: 'calculo' }
    ],
    opcionesAMostrar: 4
  };

  var TESTS = [
    {
      id: 't-francia',
      titulo: 'La Revolución Francesa',
      materia: 'Historia',
      modificado: '2026-09-28',
      descripcion: 'Fechas y causas, con respuestas escritas.',
      preguntas: [
        {
          id: 'q-f1', tipo: 'estatica',
        tema: { n2: 'El comienzo' },
          enunciado: '¿En qué año empezó la Revolución Francesa?',
          opciones: [{ id: 'a', texto: '1789' }, { id: 'b', texto: '1804' }, { id: 'c', texto: '1750' }, { id: 'd', texto: '1815' }],
          correcta: 'a',
          contexto: 'La Revolución empezó en el siglo XVIII, cuando el rey Luis XVI tuvo que reunir a los Estados Generales porque faltaba dinero.\nLa toma de la Bastilla, el 14 de julio, es el hecho que se recuerda como el comienzo.'
        },
        {
          id: 'q-f2', tipo: 'estatica',
        tema: { n2: 'El comienzo', n3: 'La Bastilla' },
          enunciado: '¿Qué era la Bastilla?',
          opciones: [{ id: 'a', texto: 'Un palacio' }, { id: 'b', texto: 'Una prisión' }, { id: 'c', texto: 'Un mercado' }, { id: 'd', texto: 'Una iglesia' }],
          correcta: 'b',
          contexto: 'La Bastilla era una fortaleza de París. Se usaba para guardar presos, y por eso la gente la veía como un símbolo del poder del rey.'
        },
        {
          id: 'q-f3', tipo: 'estatica',
        tema: { n2: 'La sociedad de la época' },
          enunciado: '¿Qué grupo de la sociedad pagaba la mayor parte de los impuestos?',
          opciones: [{ id: 'a', texto: 'La nobleza' }, { id: 'b', texto: 'El clero' }, { id: 'c', texto: 'El Tercer Estado' }],
          correcta: 'c',
          contexto: 'La sociedad estaba dividida en tres grupos. Los dos primeros, la nobleza y el clero, casi no pagaban impuestos.\nEl tercer grupo era el más grande: campesinos, artesanos y comerciantes.'
        }
      ]
    },
    {
      id: 't-velocidad',
      titulo: 'Velocidad y rebajas',
      materia: 'Matemáticas',
      modificado: '2026-10-03',
      descripcion: 'Problemas donde los números cambian cada vez.',
      preguntas: [VELOCIDAD, REBAJA]
    },
    {
      id: 't-zorro',
      titulo: 'Lectura: el zorro y las uvas',
      materia: 'Lectura',
      modificado: '2026-09-15',
      descripcion: 'Un texto corto y dos preguntas sobre él.',
      preguntas: [
        {
          id: 'q-z1', tipo: 'estatica',
        tema: { n2: 'Comprensión lectora', n3: 'Causas' },
          pasaje: 'Un zorro hambriento vio unas uvas maduras colgando de una parra alta. Saltó una y otra vez, pero no logró alcanzarlas. Cansado, se alejó diciendo que seguro estaban verdes.',
          fraseClave: 'Saltó una y otra vez, pero no logró alcanzarlas.',
          enunciado: '¿Por qué el zorro se fue sin las uvas?',
          opciones: [{ id: 'a', texto: 'Eran de otro dueño' }, { id: 'b', texto: 'No pudo alcanzarlas' }, { id: 'c', texto: 'Estaban podridas' }, { id: 'd', texto: 'Llegó un perro' }],
          correcta: 'b',
          contexto: 'La respuesta está en el texto. Fíjate en lo que hizo el zorro con las uvas y en cómo terminó.'
        },
        {
          id: 'q-z2', tipo: 'estatica',
        tema: { n2: 'Comprensión lectora', n3: 'Datos del texto' },
          pasaje: 'Un zorro hambriento vio unas uvas maduras colgando de una parra alta. Saltó una y otra vez, pero no logró alcanzarlas. Cansado, se alejó diciendo que seguro estaban verdes.',
          fraseClave: 'Cansado, se alejó diciendo que seguro estaban verdes.',
          enunciado: '¿Qué dijo el zorro al irse?',
          opciones: [{ id: 'a', texto: 'Que estaban verdes' }, { id: 'b', texto: 'Que volvería mañana' }, { id: 'c', texto: 'Que tenía sueño' }],
          correcta: 'a',
          contexto: 'Lo que dijo está en la última frase del texto.'
        }
      ]
    },
    {
      id: 't-mezcla',
      titulo: 'Práctica mezclada',
      materia: 'Matemáticas',
      modificado: '2026-09-20',
      descripcion: 'Una pregunta de idea y una con números que cambian.',
      preguntas: [
        {
          id: 'q-m1', tipo: 'estatica',
        tema: { n2: 'Bloque II', n3: 'Velocidad' },
          enunciado: '¿Qué operación se usa para hallar una velocidad?',
          opciones: [{ id: 'a', texto: 'Dividir la distancia entre el tiempo' }, { id: 'b', texto: 'Multiplicar la distancia por el tiempo' }, { id: 'c', texto: 'Restar el tiempo a la distancia' }],
          correcta: 'a',
          contexto: 'La velocidad dice cuánta distancia se recorre en cada unidad de tiempo, por ejemplo en cada hora.\nPiensa en "kilómetros por hora": kilómetros entre horas.'
        },
        VELOCIDAD
      ]
    }
  ];

  var INDEPENDENCIA = {
    id: 't-independencia',
    titulo: 'La Independencia de México',
    materia: 'Historia',
    modificado: '2026-10-01',
    descripcion: 'El inicio del movimiento, con respuestas escritas.',
    preguntas: [
      {
        id: 'q-i1', tipo: 'estatica',
        tema: { n2: 'El inicio del movimiento' },
        enunciado: '¿En qué año empezó la guerra de Independencia de México?',
        opciones: [{ id: 'a', texto: '1810' }, { id: 'b', texto: '1821' }, { id: 'c', texto: '1857' }, { id: 'd', texto: '1910' }],
        correcta: 'a',
        contexto: 'La guerra empezó en el siglo XIX, con el llamado de Miguel Hidalgo en el pueblo de Dolores.\nMuchos años después, en 1821, se consumó la independencia: fíjate en cuánto tiempo pasó entre un hecho y otro.'
      },
      {
        id: 'q-i2', tipo: 'estatica',
        tema: { n2: 'El inicio del movimiento', n3: 'Los personajes' },
        enunciado: '¿Quién llamó a la lucha en el pueblo de Dolores?',
        opciones: [{ id: 'a', texto: 'Benito Juárez' }, { id: 'b', texto: 'Miguel Hidalgo' }, { id: 'c', texto: 'Porfirio Díaz' }, { id: 'd', texto: 'Emiliano Zapata' }],
        correcta: 'b',
        contexto: 'Era un sacerdote del pueblo de Dolores. Su llamado se recuerda como "el Grito".\nLos otros nombres de la lista pertenecen a épocas posteriores.'
      },
      {
        id: 'q-i3', tipo: 'estatica',
        tema: { n2: 'El inicio del movimiento', n3: 'Las fechas' },
        enunciado: '¿Qué día se recuerda el Grito de Dolores?',
        opciones: [{ id: 'a', texto: '5 de febrero' }, { id: 'b', texto: '16 de septiembre' }, { id: 'c', texto: '20 de noviembre' }, { id: 'd', texto: '1 de mayo' }],
        correcta: 'b',
        contexto: 'La fecha cae en septiembre, el mes en que cada año se celebra la fiesta nacional.'
      }
    ]
  };

  var AGUA = {
    id: 't-agua',
    titulo: 'El ciclo del agua',
    materia: 'Ciencias',
    modificado: '2026-09-10',
    descripcion: 'Las etapas del ciclo, con respuestas escritas.',
    preguntas: [
      {
        id: 'q-a1', tipo: 'estatica',
        tema: { n2: 'Etapas del ciclo', n3: 'Evaporación' },
        enunciado: '¿Cómo se llama el paso en que el agua líquida se convierte en vapor?',
        opciones: [{ id: 'a', texto: 'Evaporación' }, { id: 'b', texto: 'Condensación' }, { id: 'c', texto: 'Precipitación' }, { id: 'd', texto: 'Filtración' }],
        correcta: 'a',
        contexto: 'El calor del sol calienta el agua de mares, ríos y lagos, y una parte sube al aire en forma de vapor.'
      },
      {
        id: 'q-a2', tipo: 'estatica',
        tema: { n2: 'Etapas del ciclo', n3: 'Condensación' },
        enunciado: '¿Qué pasa en la condensación?',
        opciones: [{ id: 'a', texto: 'El vapor se enfría y forma gotitas' }, { id: 'b', texto: 'El agua se congela en el suelo' }, { id: 'c', texto: 'El agua se filtra bajo la tierra' }, { id: 'd', texto: 'El agua hierve' }],
        correcta: 'a',
        contexto: 'Arriba, en el aire, hace más frío. Allí el vapor pierde calor y se junta en gotitas muy pequeñas que forman las nubes.'
      },
      {
        id: 'q-a3', tipo: 'estatica',
        tema: { n2: 'Etapas del ciclo', n3: 'Precipitación' },
        enunciado: '¿Cómo se llama el agua que cae de las nubes?',
        opciones: [{ id: 'a', texto: 'Escorrentía' }, { id: 'b', texto: 'Evaporación' }, { id: 'c', texto: 'Precipitación' }, { id: 'd', texto: 'Respiración' }],
        correcta: 'c',
        contexto: 'Cuando las gotitas de una nube se juntan y pesan demasiado, caen: puede ser lluvia, granizo o nieve.'
      }
    ]
  };

  /* UN EXAMEN GLOBAL: el nivel 1 es el titulo del test y los niveles 2 a 4 dicen
     de que tema es cada pregunta. Si falla una pregunta de "Las fracciones", el
     resultado dice "Matemáticas, Bloque I, Las fracciones" (el nivel 1 no se
     repite: ya se sabe que es este examen). */
  var GLOBAL = {
    id: 't-global',
    titulo: 'Examen global de sexto grado',
    materia: 'Examen global',
    modificado: '2026-10-04',
    descripcion: 'Un poco de todo lo aprendido, con los temas a repasar.',
    preguntas: [
      {
        id: 'q-g1', tipo: 'estatica',
        tema: { n2: 'Matemáticas', n3: 'Bloque I', n4: 'Las fracciones' },
        enunciado: '¿Cuánto es 1/2 + 1/4?',
        opciones: [{ id: 'a', texto: '3/4' }, { id: 'b', texto: '2/6' }, { id: 'c', texto: '1/6' }, { id: 'd', texto: '2/4' }],
        correcta: 'a',
        contexto: 'Para sumar fracciones con distinto denominador, primero busca un denominador común: 1/2 es lo mismo que 2/4.\nDespués se suman solo los numeradores y el denominador se queda igual.'
      },
      {
        id: 'q-g2', tipo: 'estatica',
        tema: { n2: 'Matemáticas', n3: 'Bloque I', n4: 'Las fracciones' },
        enunciado: '¿Cuál de estas fracciones vale lo mismo que 2/4?',
        opciones: [{ id: 'a', texto: '1/4' }, { id: 'b', texto: '1/2' }, { id: 'c', texto: '2/8' }, { id: 'd', texto: '4/2' }],
        correcta: 'b',
        contexto: 'Dos fracciones son equivalentes cuando valen lo mismo. Se consigue multiplicando o dividiendo el numerador y el denominador por el mismo número.'
      },
      {
        id: 'q-g3', tipo: 'estatica',
        tema: { n2: 'Matemáticas', n3: 'Bloque II', n4: 'Las medidas' },
        enunciado: '¿Cuántos centímetros hay en un metro?',
        opciones: [{ id: 'a', texto: '10' }, { id: 'b', texto: '100' }, { id: 'c', texto: '1000' }, { id: 'd', texto: '60' }],
        correcta: 'b',
        contexto: 'El prefijo "centi" significa centésima parte: un centímetro es la centésima parte de un metro.'
      },
      {
        id: 'q-g4', tipo: 'estatica',
        tema: { n2: 'Ciencias', n3: 'El ciclo del agua' },
        enunciado: '¿Cómo se llama el agua que cae de las nubes?',
        opciones: [{ id: 'a', texto: 'Evaporación' }, { id: 'b', texto: 'Condensación' }, { id: 'c', texto: 'Precipitación' }, { id: 'd', texto: 'Filtración' }],
        correcta: 'c',
        contexto: 'Cuando las gotitas de una nube se juntan y pesan demasiado, caen: puede ser lluvia, granizo o nieve.'
      },
      {
        id: 'q-g5', tipo: 'estatica',
        tema: { n2: 'Historia', n3: 'La Independencia de México' },
        enunciado: '¿En qué año empezó la guerra de Independencia de México?',
        opciones: [{ id: 'a', texto: '1810' }, { id: 'b', texto: '1821' }, { id: 'c', texto: '1857' }, { id: 'd', texto: '1910' }],
        correcta: 'a',
        contexto: 'La guerra empezó con el llamado de Miguel Hidalgo en el pueblo de Dolores, en el siglo XIX.'
      },
      {
        id: 'q-g6', tipo: 'estatica',
        tema: { n2: 'Historia', n3: 'La Revolución Francesa' },
        enunciado: '¿Qué era la Bastilla?',
        opciones: [{ id: 'a', texto: 'Un palacio' }, { id: 'b', texto: 'Una prisión' }, { id: 'c', texto: 'Un mercado' }, { id: 'd', texto: 'Una iglesia' }],
        correcta: 'b',
        contexto: 'Era una fortaleza de París que se usaba para guardar presos, y por eso la gente la veía como un símbolo del poder del rey.'
      }
    ]
  };

  var MATERIAS = ['Historia', 'Matemáticas', 'Lectura', 'Ciencias', 'Idiomas'];

  /* El icono de la tarjeta de un test, con el mismo marcado que las demas
     tarjetas de la plataforma: el dibujo y, escondido, su emoji de reserva (que
     solo se ve si el dibujo no carga). Cada materia tiene el suyo; una materia
     que no esta en la lista usa el de "test" generico. */
  var POR_MATERIA = {
    'Historia': ['historia', '\uD83C\uDFDB\uFE0F'],
    'Matemáticas': ['mate', '\u2795'],
    'Lectura': ['lectura', '\uD83D\uDCD6'],
    'Ciencias': ['ciencias', '\uD83E\uDDEA'],
    'Idiomas': ['idiomas', '\uD83C\uDF0E']
  };

  function iconoTarjeta(materia) {
    var d = POR_MATERIA[materia] || ['lista', '\uD83D\uDCDD'];
    return '<span class="tarjeta-icono"><span class="reserva" aria-hidden="true">' + d[1] + '</span>' +
           '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" ' +
           'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONOS[d[0]] + '</svg></span>';
  }

  function copiar() {
    return JSON.parse(JSON.stringify(TESTS.concat([INDEPENDENCIA, AGUA, GLOBAL])));
  }

  /* LA EXPLICACIÓN DE UNA PREGUNTA DINÁMICA, dibujada. Recibe lo que arma el
     evaluador ({ formula, sustitucion, resultado }) y devuelve una lista de tres
     filas. La usan todas las pantallas que enseñan el error, para que se vea
     igual en "Resolver", "Escribir", "Asociar" y "Tarjetas". */
  function explicacion(e) {
    var dl = document.createElement('dl');
    dl.className = 'tst-explica';
    [['Fórmula', e.formula], ['Con los números de esta pregunta', e.sustitucion], ['Resultado', e.resultado]].forEach(function (par, i) {
      var fila = document.createElement('div');
      fila.className = 'tst-explica-fila';
      if (i === 2) fila.setAttribute('data-final', '1');
      var dt = document.createElement('dt');
      dt.textContent = par[0];
      var dd = document.createElement('dd');
      dd.textContent = par[1];
      fila.appendChild(dt);
      fila.appendChild(dd);
      dl.appendChild(fila);
    });
    return dl;
  }

  window.RetoTestsMuestra = { copiar: copiar, icono: icono, iconoTarjeta: iconoTarjeta, materias: MATERIAS, explicacion: explicacion };
})();
