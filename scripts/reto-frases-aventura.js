/* ==========================================================================
   FRASES DE LOS PERSONAJES DE LA AVENTURA

   Cada personaje (6 arquetipos, en version masculina y femenina: 12 en total)
   presenta la pregunta con una frase propia, para darle variedad a la batalla.
   El enemigo es quien pregunta, asi que la frase sale del avatar del rival.

   - Son 15 por personaje y TODAS terminan en dos puntos: la pregunta va justo despues.
   - Concuerdan con el genero del personaje (el mago / la maga, el clerigo / la sacerdotisa).
   - Se pueden apagar en Configuracion > Textos y Fuentes > "Diálogos de oponentes".
   - Para agregar mas, basta con sumar frases al arreglo del personaje: no hay
     que tocar nada mas (test_frases_aventura.js revisa que sean 15 o mas y que terminen en ":").

   API (window.RetoFrasesAventura):
     FRASES               { id_del_avatar: [frases] }
     elegir(id, evitar)   una frase al azar del avatar; `evitar` es el indice de la ultima
                          para no repetirla dos veces seguidas. Devuelve { texto, indice }.
   ========================================================================== */
(function () {
  'use strict';

  var FRASES = {
    mago: [
      'El mago traza un círculo arcano en el aire y te lanza esta pregunta:',
      'El mago invoca un hechizo y, entre chispas, te pregunta:',
      'El mago abre su grimorio, lee un pasaje en voz baja y te pregunta:',
      'Con un destello azul, el mago conjura una duda para ti:',
      'El mago golpea el suelo con su bastón y pregunta:',
      'El mago convierte la niebla en letras y te muestra esta pregunta:',
      'El mago hace girar una esfera de energía y te desafía:',
      'El mago murmura un conjuro antiguo y te pregunta:',
      'El mago levanta las manos y las estrellas parecen preguntarte:',
      'El mago ajusta su sombrero puntiagudo y te plantea con calma:',
      'El mago chasquea los dedos y una runa brillante te interroga:',
      'El mago eleva su bastón y de la punta sale esta pregunta:',
      'El mago sonríe con picardía y lanza un hechizo de conocimiento:',
      'El mago consulta una bola de cristal y te dice que debes responder:',
      'El mago pronuncia unas palabras mágicas y la pregunta aparece ante ti:'
    ],
    maga: [
      'La maga traza un círculo arcano en el aire y te lanza esta pregunta:',
      'La maga invoca un hechizo y, entre chispas, te pregunta:',
      'La maga abre su grimorio, lee un pasaje en voz baja y te pregunta:',
      'Con un destello violeta, la maga conjura una duda para ti:',
      'La maga golpea el suelo con su bastón y pregunta:',
      'La maga convierte la niebla en letras y te muestra esta pregunta:',
      'La maga hace girar una esfera de energía y te desafía:',
      'La maga murmura un conjuro antiguo y te pregunta:',
      'La maga levanta las manos y las estrellas parecen preguntarte:',
      'La maga acomoda su sombrero puntiagudo y te plantea con calma:',
      'La maga chasquea los dedos y una runa brillante te interroga:',
      'La maga eleva su bastón y de la punta sale esta pregunta:',
      'La maga sonríe con picardía y lanza un hechizo de conocimiento:',
      'La maga consulta una bola de cristal y te dice que debes responder:',
      'La maga pronuncia unas palabras mágicas y la pregunta aparece ante ti:'
    ],
    caballero: [
      'El caballero alza su escudo y te dirige esta pregunta:',
      'El caballero hinca su espada en la tierra y te pregunta con firmeza:',
      'El caballero avanza con paso pesado y te pregunta:',
      'Por el honor de su linaje, el caballero te plantea:',
      'El caballero golpea su coraza y te reta a responder:',
      'El caballero se inclina con cortesía y luego te pregunta:',
      'Desde lo alto de su armadura, el caballero te interroga:',
      'El caballero levanta la visera y te mira fijamente mientras pregunta:',
      'El caballero planta su lanza frente a ti y te dice:',
      'Como manda el código de caballería, el caballero te pregunta:',
      'El caballero desenvaina con solemnidad y pronuncia esta pregunta:',
      'El caballero cierra filas con su escudo y te desafía:',
      'El caballero toca el emblema de su pecho y te pregunta:',
      'Con voz grave que resuena en su yelmo, el caballero te cuestiona:',
      'El caballero te sostiene la mirada y espera tu respuesta a esto:'
    ],
    caballera: [
      'La caballera alza su escudo y te dirige esta pregunta:',
      'La caballera hinca su espada en la tierra y te pregunta con firmeza:',
      'La caballera avanza con paso decidido y te pregunta:',
      'Por el honor de su linaje, la caballera te plantea:',
      'La caballera golpea su coraza y te reta a responder:',
      'La caballera se inclina con cortesía y luego te pregunta:',
      'Desde lo alto de su armadura, la caballera te interroga:',
      'La caballera levanta la visera y te mira fijamente mientras pregunta:',
      'La caballera planta su lanza frente a ti y te dice:',
      'Como manda el código de caballería, la caballera te pregunta:',
      'La caballera desenvaina con solemnidad y pronuncia esta pregunta:',
      'La caballera cierra filas con su escudo y te desafía:',
      'La caballera toca el emblema de su pecho y te pregunta:',
      'Con voz firme que resuena en su yelmo, la caballera te cuestiona:',
      'La caballera te sostiene la mirada y espera tu respuesta a esto:'
    ],
    arquero: [
      'El arquero tensa su arco, apunta con calma y te pregunta:',
      'Una flecha silba junto a tu oreja y el arquero te pregunta:',
      'El arquero entrecierra un ojo, mide la distancia y dispara esta pregunta:',
      'El arquero ata un mensaje a su flecha y te lo lanza:',
      'Desde la copa de un árbol, el arquero te pregunta:',
      'El arquero revisa su carcaj y saca la flecha de esta pregunta:',
      'El arquero no falla un blanco, y tampoco falla al preguntarte:',
      'El arquero contiene la respiración y suelta la cuerda junto con esta pregunta:',
      'El arquero clava una flecha a tus pies con una nota que dice:',
      'El arquero gira sobre sí mismo y dispara su pregunta:',
      'Con la vista fija en ti, el arquero te desafía:',
      'El arquero afina la puntería y te interroga:',
      'El arquero sonríe, pulsa la cuerda de su arco y te dice:',
      'El arquero te sigue con la mirada mientras pregunta:',
      'Una lluvia de flechas cae y, entre ellas, el arquero te pregunta:'
    ],
    arquera: [
      'La arquera tensa su arco, apunta con calma y te pregunta:',
      'Una flecha silba junto a tu oreja y la arquera te pregunta:',
      'La arquera entrecierra un ojo, mide la distancia y dispara esta pregunta:',
      'La arquera ata un mensaje a su flecha y te lo lanza:',
      'Desde la copa de un árbol, la arquera te pregunta:',
      'La arquera revisa su carcaj y saca la flecha de esta pregunta:',
      'La arquera no falla un blanco, y tampoco falla al preguntarte:',
      'La arquera contiene la respiración y suelta la cuerda junto con esta pregunta:',
      'La arquera clava una flecha a tus pies con una nota que dice:',
      'La arquera gira sobre sí misma y dispara su pregunta:',
      'Con la vista fija en ti, la arquera te desafía:',
      'La arquera afina la puntería y te interroga:',
      'La arquera sonríe, pulsa la cuerda de su arco y te dice:',
      'La arquera te sigue con la mirada mientras pregunta:',
      'Una lluvia de flechas cae y, entre ellas, la arquera te pregunta:'
    ],
    guerrero: [
      'El guerrero lanza un rugido de batalla y te grita esta pregunta:',
      'El guerrero golpea su hacha contra el suelo y exige una respuesta a esto:',
      'El guerrero se cruza de brazos y te pregunta con voz de trueno:',
      'Con un grito que sacude el campo, el guerrero te desafía:',
      'El guerrero te señala con su espada y pregunta:',
      'El guerrero se truena los nudillos y te lanza esta pregunta:',
      'Cubierto de cicatrices y de orgullo, el guerrero te pregunta:',
      'El guerrero da un paso al frente, sin miedo, y te cuestiona:',
      'El guerrero levanta su arma al cielo y brama:',
      'El guerrero respira hondo, sonríe de lado y pregunta:',
      'El guerrero golpea su pecho con el puño y te reta:',
      'Entre el polvo del combate, el guerrero te dispara esta pregunta:',
      'El guerrero te mide de arriba abajo y suelta:',
      'El guerrero clava su mirada en la tuya y exige saber:',
      'El guerrero ruge, y el eco de su voz trae esta pregunta:'
    ],
    guerrera: [
      'La guerrera lanza un rugido de batalla y te grita esta pregunta:',
      'La guerrera golpea su hacha contra el suelo y exige una respuesta a esto:',
      'La guerrera se cruza de brazos y te pregunta con voz de trueno:',
      'Con un grito que sacude el campo, la guerrera te desafía:',
      'La guerrera te señala con su espada y pregunta:',
      'La guerrera se truena los nudillos y te lanza esta pregunta:',
      'Cubierta de cicatrices y de orgullo, la guerrera te pregunta:',
      'La guerrera da un paso al frente, sin miedo, y te cuestiona:',
      'La guerrera levanta su arma al cielo y brama:',
      'La guerrera respira hondo, sonríe de lado y pregunta:',
      'La guerrera golpea su pecho con el puño y te reta:',
      'Entre el polvo del combate, la guerrera te dispara esta pregunta:',
      'La guerrera te mide de arriba abajo y suelta:',
      'La guerrera clava su mirada en la tuya y exige saber:',
      'La guerrera ruge, y el eco de su voz trae esta pregunta:'
    ],
    asesino: [
      'El asesino sale de las sombras y te susurra al oído:',
      'El asesino revisa su bolsa, saca una daga y te arroja esta pregunta:',
      'Sin hacer ruido, el asesino aparece a tu espalda y pregunta:',
      'El asesino hace girar un puñal entre los dedos y te pregunta:',
      'Desde un tejado oscuro, el asesino te lanza esta duda:',
      'El asesino te sonríe bajo la capucha y pregunta:',
      'Una daga se clava a tu lado con una nota: el asesino quiere saber:',
      'El asesino se desvanece en una voluta de humo y su voz pregunta:',
      'El asesino te rodea despacio, como un felino, y te interroga:',
      'El asesino limpia su hoja con calma y te plantea:',
      'En el silencio de la noche, el asesino murmura:',
      'El asesino aparece de cabeza en una cuerda y te pregunta:',
      'El asesino afila su cuchillo mientras te pregunta:',
      'El asesino te guiña un ojo y lanza su pregunta como una daga:',
      'Antes de que lo veas, el asesino ya te dejó esta pregunta:'
    ],
    asesina: [
      'La asesina sale de las sombras y te susurra al oído:',
      'La asesina revisa su bolsa, saca una daga y te arroja esta pregunta:',
      'Sin hacer ruido, la asesina aparece a tu espalda y pregunta:',
      'La asesina hace girar un puñal entre los dedos y te pregunta:',
      'Desde un tejado oscuro, la asesina te lanza esta duda:',
      'La asesina te sonríe bajo la capucha y pregunta:',
      'Una daga se clava a tu lado con una nota: la asesina quiere saber:',
      'La asesina se desvanece en una voluta de humo y su voz pregunta:',
      'La asesina te rodea despacio, como una felina, y te interroga:',
      'La asesina limpia su hoja con calma y te plantea:',
      'En el silencio de la noche, la asesina murmura:',
      'La asesina cuelga boca abajo de una cuerda y te pregunta:',
      'La asesina afila su cuchillo mientras te pregunta:',
      'La asesina te guiña un ojo y lanza su pregunta como una daga:',
      'Antes de que la veas, la asesina ya te dejó esta pregunta:'
    ],
    clerigo: [
      'El clérigo alza su símbolo sagrado y te pregunta con serenidad:',
      'El clérigo une las manos, murmura una plegaria y te pregunta:',
      'Una luz cálida envuelve al clérigo, que te plantea:',
      'El clérigo hace sonar su campanilla y te pregunta:',
      'El clérigo bendice el aire y te dirige esta pregunta:',
      'El clérigo abre su libro de oraciones y lee para ti:',
      'Con voz tranquila, el clérigo te invita a reflexionar:',
      'El clérigo cierra los ojos un instante y luego te pregunta:',
      'El clérigo extiende su cayado y de él brota esta pregunta:',
      'El clérigo sonríe con paciencia y te cuestiona:',
      'Bajo un rayo de luz, el clérigo te dice:',
      'El clérigo traza una señal de protección y pregunta:',
      'El clérigo te mira con bondad y te propone esta duda:',
      'El clérigo entona un canto suave que termina en una pregunta:',
      'El clérigo eleva su mano y la luz formula esta pregunta:'
    ],
    sacerdotiza: [
      'La sacerdotisa alza su símbolo sagrado y te pregunta con serenidad:',
      'La sacerdotisa une las manos, murmura una plegaria y te pregunta:',
      'Una luz cálida envuelve a la sacerdotisa, que te plantea:',
      'La sacerdotisa hace sonar su campanilla y te pregunta:',
      'La sacerdotisa bendice el aire y te dirige esta pregunta:',
      'La sacerdotisa abre su libro de oraciones y lee para ti:',
      'Con voz tranquila, la sacerdotisa te invita a reflexionar:',
      'La sacerdotisa cierra los ojos un instante y luego te pregunta:',
      'La sacerdotisa extiende su cayado y de él brota esta pregunta:',
      'La sacerdotisa sonríe con paciencia y te cuestiona:',
      'Bajo un rayo de luz, la sacerdotisa te dice:',
      'La sacerdotisa traza una señal de protección y pregunta:',
      'La sacerdotisa te mira con bondad y te propone esta duda:',
      'La sacerdotisa entona un canto suave que termina en una pregunta:',
      'La sacerdotisa eleva su mano y la luz formula esta pregunta:'
    ]
  };

  /* Una frase al azar del personaje. `evitar` es el indice de la anterior (para no repetirla). */
  function elegir(id, evitar) {
    var lista = FRASES[id];
    if (!lista || !lista.length) return null;
    var i = Math.floor(Math.random() * lista.length);
    if (lista.length > 1 && i === evitar) i = (i + 1) % lista.length;
    return { texto: lista[i], indice: i };
  }

  window.RetoFrasesAventura = { FRASES: FRASES, elegir: elegir };
}());
