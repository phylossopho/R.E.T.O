/* =========================================================================
   R.E.T.O. - Aventura Gráfica (Modo RPG / Overworld Canvas Pixel Art / Batalla)
   -------------------------------------------------------------------------
   Gestiona la configuración inicial, el mapa overworld en Pixel Art real (Canvas)
   y el motor de batalla RPG.
   ========================================================================= */
(function () {
  'use strict';

  var Banco = window.RetoTestsBanco;
  var Sonido = window.RetoSonido;
  var Eval = window.RetoTestsEval;

  var estadoAventura = {
    avatar: 'mago',
    interfaz: 'rpg01',
    powerUps: { pocion: 2, pista: 2, reloj: 1 },
    testSeleccionado: null,
    preguntas: [],
    indicePregunta: 0,
    hpJugador: 9000,
    hpRival: 9000,
    tiempoRestante: 30,
    temporizador: null
  };

  function iniciar() {
    var raiz = document.getElementById('vistas');
    if (!raiz) return;

    var btnIniciar = document.getElementById('btn-iniciar-aventura');
    if (btnIniciar) {
      btnIniciar.addEventListener('click', function () {
        if (Sonido && Sonido.reproducir) Sonido.reproducir('acierto');
        renderConfiguracion(raiz);
      });
    } else {
      renderConfiguracion(raiz);
    }
  }

  /* -------------------------------------------------------------------------
     1. PANTALLA DE CONFIGURACIÓN PREVIA (Avatar, Interfaz y Power-Ups)
     ------------------------------------------------------------------------- */
  function renderConfiguracion(contenedor) {
    contenedor.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-md); max-width: 600px; margin: 0 auto; text-align: left;';

    wrapper.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 50px; margin-bottom: var(--space-xs);">⚔️🛡️✨</div>
        <h2>Preparación de Aventura</h2>
        <p style="color: var(--muted);">Configura tu personaje y tu estrategia antes de pisar el mapa.</p>
      </div>

      <fieldset style="border: 2px solid var(--borde-fuerte); border-radius: var(--radius); padding: var(--space-md); background: var(--surface);">
        <legend style="font-weight: bold; padding: 0 var(--space-xs); color: var(--accent);">1. Elige tu Avatar</legend>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: var(--space-sm); margin-top: var(--space-sm);">
          <label class="marca-opcion" style="justify-content: center; flex-direction: column; padding: var(--space-xs); cursor: pointer; text-align: center;">
            <img src="../../../imagenes/mago.webp" alt="Mago" style="width: 36px; height: 36px; object-fit: contain; margin: 0 auto 4px;">
            <input type="radio" name="avatar" value="mago" checked style="margin-bottom: 2px;"> Mago
          </label>
          <label class="marca-opcion" style="justify-content: center; flex-direction: column; padding: var(--space-xs); cursor: pointer; text-align: center;">
            <img src="../../../imagenes/maga.webp" alt="Maga" style="width: 36px; height: 36px; object-fit: contain; margin: 0 auto 4px;">
            <input type="radio" name="avatar" value="maga" style="margin-bottom: 2px;"> Maga
          </label>
          <label class="marca-opcion" style="justify-content: center; flex-direction: column; padding: var(--space-xs); cursor: pointer; text-align: center;">
            <img src="../../../imagenes/caballero.webp" alt="Caballero" style="width: 36px; height: 36px; object-fit: contain; margin: 0 auto 4px;">
            <input type="radio" name="avatar" value="caballero" style="margin-bottom: 2px;"> Caballero
          </label>
          <label class="marca-opcion" style="justify-content: center; flex-direction: column; padding: var(--space-xs); cursor: pointer; text-align: center;">
            <img src="../../../imagenes/caballera.webp" alt="Caballera" style="width: 36px; height: 36px; object-fit: contain; margin: 0 auto 4px;">
            <input type="radio" name="avatar" value="caballera" style="margin-bottom: 2px;"> Caballera
          </label>
          <label class="marca-opcion" style="justify-content: center; flex-direction: column; padding: var(--space-xs); cursor: pointer; text-align: center;">
            <img src="../../../imagenes/arquero.webp" alt="Arquero" style="width: 36px; height: 36px; object-fit: contain; margin: 0 auto 4px;">
            <input type="radio" name="avatar" value="arquero" style="margin-bottom: 2px;"> Arquero
          </label>
          <label class="marca-opcion" style="justify-content: center; flex-direction: column; padding: var(--space-xs); cursor: pointer; text-align: center;">
            <img src="../../../imagenes/arquera.webp" alt="Arquera" style="width: 36px; height: 36px; object-fit: contain; margin: 0 auto 4px;">
            <input type="radio" name="avatar" value="arquera" style="margin-bottom: 2px;"> Arquera
          </label>
          <label class="marca-opcion" style="justify-content: center; flex-direction: column; padding: var(--space-xs); cursor: pointer; text-align: center;">
            <img src="../../../imagenes/guerrero.webp" alt="Guerrero" style="width: 36px; height: 36px; object-fit: contain; margin: 0 auto 4px;">
            <input type="radio" name="avatar" value="guerrero" style="margin-bottom: 2px;"> Guerrero
          </label>
          <label class="marca-opcion" style="justify-content: center; flex-direction: column; padding: var(--space-xs); cursor: pointer; text-align: center;">
            <img src="../../../imagenes/guerrera.webp" alt="Guerrera" style="width: 36px; height: 36px; object-fit: contain; margin: 0 auto 4px;">
            <input type="radio" name="avatar" value="guerrera" style="margin-bottom: 2px;"> Guerrera
          </label>
        </div>
      </fieldset>

      <fieldset style="border: 2px solid var(--borde-fuerte); border-radius: var(--radius); padding: var(--space-md); background: var(--surface);">
        <legend style="font-weight: bold; padding: 0 var(--space-xs); color: var(--accent);">2. Interfaz de Batalla RPG</legend>
        <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-sm); margin-top: var(--space-sm);">
          <label style="display: flex; align-items: center; gap: var(--space-sm); cursor: pointer;">
            <input type="radio" name="interfaz" value="rpg01" checked> 
            <div><strong>Modelo 1: Clásico Dividido</strong> <span style="color: var(--muted); display: block; font-size: 0.9em;">Pregunta arriba, opciones 2x2 y power-ups laterales.</span></div>
          </label>
          <label style="display: flex; align-items: center; gap: var(--space-sm); cursor: pointer;">
            <input type="radio" name="interfaz" value="rpg02"> 
            <div><strong>Modelo 2: Jefe Frontal</strong> <span style="color: var(--muted); display: block; font-size: 0.9em;">Enemigo animado arriba, lista vertical de opciones e inventario.</span></div>
          </label>
          <label style="display: flex; align-items: center; gap: var(--space-sm); cursor: pointer;">
            <input type="radio" name="interfaz" value="rpg03"> 
            <div><strong>Modelo 3: Minimalista B&N</strong> <span style="color: var(--muted); display: block; font-size: 0.9em;">Estilo terminal arcade clásica retro en blanco y negro.</span></div>
          </label>
        </div>
      </fieldset>

      <fieldset style="border: 2px solid var(--borde-fuerte); border-radius: var(--radius); padding: var(--space-md); background: var(--surface);">
        <legend style="font-weight: bold; padding: 0 var(--space-xs); color: var(--accent);">3. Inventario de Power-Ups (Mazo Estratégico)</legend>
        <p style="font-size: 0.9em; color: var(--muted); margin-bottom: var(--space-sm);">Elige cuántos recursos llevarás a la batalla (estilo Yu-Gi-Oh):</p>
        <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: var(--space-sm);">
          <div style="text-align: center;">
            <span>❤️ Poción (+30 HP)</span><br>
            <input type="number" id="pw-pocion" value="2" min="0" max="5" style="width: 60px; text-align: center; margin-top: 4px; padding: 4px;">
          </div>
          <div style="text-align: center;">
            <span>👁️ Pista (Eliminar mala)</span><br>
            <input type="number" id="pw-pista" value="2" min="0" max="5" style="width: 60px; text-align: center; margin-top: 4px; padding: 4px;">
          </div>
          <div style="text-align: center;">
            <span>⏳ Reloj (+15s tiempo)</span><br>
            <input type="number" id="pw-reloj" value="1" min="0" max="3" style="width: 60px; text-align: center; margin-top: 4px; padding: 4px;">
          </div>
        </div>
      </fieldset>

      <button type="button" class="panel-opcion boton" id="btn-ir-mapa" style="padding: var(--space-md); font-weight: bold; font-size: 1.1em; cursor: pointer; background: var(--accent); color: var(--bg); border-radius: var(--radius); text-align: center;">
        ⚔️ Seleccionar Test y Combatir
      </button>
    `;

    contenedor.appendChild(wrapper);

    var btn = wrapper.querySelector('#btn-ir-mapa');
    btn.addEventListener('click', function () {
      var avEl = wrapper.querySelector('input[name="avatar"]:checked');
      var infEl = wrapper.querySelector('input[name="interfaz"]:checked');
      if (avEl) estadoAventura.avatar = avEl.value;
      if (infEl) estadoAventura.interfaz = infEl.value;
      
      estadoAventura.powerUps.pocion = parseInt(wrapper.querySelector('#pw-pocion').value) || 0;
      estadoAventura.powerUps.pista = parseInt(wrapper.querySelector('#pw-pista').value) || 0;
      estadoAventura.powerUps.reloj = parseInt(wrapper.querySelector('#pw-reloj').value) || 0;

      if (Sonido && Sonido.reproducir) Sonido.reproducir('acierto');
      renderSeleccionTest(contenedor);
    });
  }

  /* -------------------------------------------------------------------------
     2. SELECCIÓN DE TEST PARA LA BATALLA RPG
     ------------------------------------------------------------------------- */
  function renderSeleccionTest(contenedor) {
    contenedor.innerHTML = '<p style="text-align: center; padding: var(--space-lg);">Cargando tests disponibles...</p>';

    if (!Banco) {
      contenedor.innerHTML = '<p style="text-align: center; color: var(--aviso);">Error: Banco de tests no disponible.</p>';
      return;
    }

    Banco.cargar().then(function (tests) {
      if ((!tests || tests.length === 0) && window.RetoTestsMuestra && window.RetoTestsMuestra.copiar) {
        var muestra = window.RetoTestsMuestra.copiar();
        return Banco.guardarVarios(muestra).then(function () {
          return Banco.cargar();
        });
      }
      return tests;
    }).then(function (tests) {
      if (!tests || tests.length === 0) {
        contenedor.innerHTML = `
          <div style="text-align: center; padding: var(--space-lg);">
            <h3>No hay tests en el banco</h3>
            <p>Necesitas crear o cargar tests de ejemplo en el banco para iniciar la aventura.</p>
            <a href="../crud-tests/crud-tests.html" class="boton" style="display: inline-block; margin-top: var(--space-md);">Gestionar banco de tests</a>
          </div>
        `;
        return;
      }

      contenedor.innerHTML = '';
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-md); max-width: 600px; margin: 0 auto;';

      wrapper.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--surface); padding: var(--space-sm) var(--space-md); border: 2px solid var(--borde-fuerte); border-radius: var(--radius);">
          <div>
            <strong>Héroe:</strong> <span style="text-transform: capitalize;">${estadoAventura.avatar}</span> | 
            <strong>Interfaz:</strong> ${estadoAventura.interfaz.toUpperCase()}
          </div>
          <button type="button" id="btn-volver-config" class="boton boton--chico" style="padding: 4px 8px; cursor: pointer;">⚙️ Reconfigurar</button>
        </div>

        <div style="text-align: center;">
          <h3>Elige tu Rival (Test de Conocimientos)</h3>
          <p style="color: var(--muted); font-size: 0.9em;">Selecciona el test contra el que librarás tu batalla RPG:</p>
        </div>

        <div id="lista-tests-aventura" style="display: flex; flex-direction: column; gap: var(--space-sm);"></div>
      `;

      contenedor.appendChild(wrapper);

      wrapper.querySelector('#btn-volver-config').addEventListener('click', function () {
        renderConfiguracion(contenedor);
      });

      var listaEl = wrapper.querySelector('#lista-tests-aventura');
      tests.forEach(function (test) {
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'boton';
        card.style.cssText = 'display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: var(--space-md); text-align: left; cursor: pointer; background: var(--surface); border: 2px solid var(--borde-fuerte); color: var(--text); border-radius: var(--radius);';
        card.innerHTML = `
          <strong style="font-size: 1.1em; color: var(--accent);">👾 ${test.titulo || 'Test sin título'}</strong>
          <span style="font-size: 0.9em; color: var(--muted);">${(test.preguntas || []).length} preguntas disponibles</span>
        `;
        card.addEventListener('click', function () {
          seleccionarTestYCombate(test, contenedor);
        });
        listaEl.appendChild(card);
      });

    }).catch(function (err) {
      contenedor.innerHTML = '<p style="text-align: center; color: var(--aviso);">Error al cargar tests: ' + err.message + '</p>';
    });
  }

  function seleccionarTestYCombate(test, contenedor) {
    if (Sonido && Sonido.reproducir) Sonido.reproducir('acierto');
    
    contenedor.style.transition = 'opacity 0.4s ease';
    contenedor.style.opacity = '0';

    setTimeout(function () {
      try {
        var candidatas = test.preguntas || [];
        var mazo = RetoTestsInstancia.armarMazo(candidatas, 15, { evaluador: Eval });
        
        if (!mazo || mazo.length === 0) {
          alert('Este test no tiene preguntas jugables.');
          contenedor.style.opacity = '1';
          return;
        }

        // Asegurar exactamente 1 correcta y hasta 3 distractores (4 opciones en total), barajadas al azar
        mazo.forEach(function (q) {
          if (q.opciones && q.opciones.length > 0) {
            var correcta = null;
            var distractores = [];
            q.opciones.forEach(function (op) {
              if (op.correcta && !correcta) {
                correcta = op;
              } else if (!op.correcta) {
                distractores.push(op);
              }
            });
            if (!correcta) {
              correcta = q.opciones[0];
              correcta.correcta = true;
            }
            // Barajar distractores y tomar máximo 3
            distractores = barajarOpciones(distractores).slice(0, 3);
            var seleccionadas = [correcta].concat(distractores);
            q.opciones = barajarOpciones(seleccionadas);
          }
        });

        estadoAventura.testSeleccionado = test;
        estadoAventura.preguntas = mazo;
        estadoAventura.indicePregunta = 0;
        estadoAventura.hpJugador = 9000;
        estadoAventura.hpRival = 9000;

        contenedor.style.opacity = '1';
        renderBatalla(contenedor);
      } catch (e) {
        alert('Error al iniciar batalla: ' + e.message);
        contenedor.style.opacity = '1';
      }
    }, 400);
  }

  function barajarOpciones(lista) {
    var s = lista.slice();
    for (var i = s.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = s[i]; s[i] = s[j]; s[j] = t;
    }
    return s;
  }

  /* -------------------------------------------------------------------------
     3. PANTALLA DE BATALLA RPG (Interfaz rpg01, rpg02 o rpg03)
     ------------------------------------------------------------------------- */
  function renderBatalla(contenedor) {
    contenedor.innerHTML = '';

    var pActual = estadoAventura.preguntas[estadoAventura.indicePregunta];
    if (!pActual) {
      renderVictoriaDerrota(contenedor);
      return;
    }

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'max-width: 900px; margin: 0 auto;';

    if (estadoAventura.interfaz === 'rpg01') {
      wrapper.innerHTML = renderInterfazRPG01(pActual);
    } else if (estadoAventura.interfaz === 'rpg02') {
      wrapper.innerHTML = renderInterfazRPG02(pActual);
    } else {
      wrapper.innerHTML = renderInterfazRPG03(pActual);
    }

    contenedor.appendChild(wrapper);
    iniciarTemporizadorPregunta(wrapper, contenedor);
    conectarEventosBatalla(wrapper, contenedor, pActual);
  }

  function renderInterfazRPG01(p) {
    var avatarImg = (estadoAventura.avatar || 'caballero') + '.webp';
    return `
      <style>
        .game-container-rpg1 {
          width: 100%;
          max-width: 900px;
          height: 550px;
          border: 4px solid var(--borde-fuerte);
          background-color: var(--bg);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: var(--sombra, 0 10px 30px rgba(0,0,0,0.7));
          margin: 0 auto;
          font-family: inherit;
          color: var(--text);
          box-sizing: border-box;
        }
        .game-container-rpg1 *, .game-container-rpg1 *::before, .game-container-rpg1 *::after {
          box-sizing: border-box;
        }
        .battle-screen-rpg1 {
          flex: 1;
          position: relative;
          padding: 20px;
          overflow: hidden;
        }
        .hud-box-rpg1 {
          background-color: var(--surface);
          border: 2px solid var(--borde-fuerte);
          border-radius: var(--radius, 8px);
          padding: 8px 12px;
          width: 320px;
          position: absolute;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: var(--sombra);
        }
        .hud-header-rpg1 {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .hud-name-rpg1 {
          font-size: 11px;
          font-weight: bold;
          color: var(--text);
          text-transform: uppercase;
          white-space: nowrap;
        }
        .health-bar-bg-rpg1 {
          background-color: var(--bg);
          height: 16px;
          border-radius: 4px;
          flex: 1;
          overflow: hidden;
          position: relative;
          border: 1px solid var(--borde);
        }
        .health-bar-fill-rpg1 {
          height: 100%;
          transition: width 0.3s ease;
        }
        .hud-mago-rpg1 { top: 20px; left: 20px; }
        .hud-mago-rpg1 .health-bar-fill-rpg1 { background-color: var(--accent); width: ${(estadoAventura.hpRival / 9000) * 100}%; opacity: 0.85; }
        .hud-caballero-rpg1 { bottom: 20px; right: 20px; }
        .hud-caballero-rpg1 .health-bar-fill-rpg1 { background-color: var(--accent); width: ${(estadoAventura.hpJugador / 9000) * 100}%; }
        .hud-hp-text-rpg1 {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: bold;
          color: var(--text);
          text-shadow: 0 1px 2px var(--bg);
        }
        .sprite-rpg1 {
          position: absolute;
          text-align: center;
          z-index: 2;
        }
        /* Avatar del rival y del usuario escalados a 540% (324px), usuario inclinado hacia el frente y arriba */
        .sprite-mago-rpg1 { top: -40px; right: 40px; opacity: 0.9; pointer-events: none; }
        .sprite-caballero-rpg1 { bottom: -60px; left: 30px; opacity: 0.9; pointer-events: none; }
        .sprite-rpg1 img { width: 324px; height: 324px; object-fit: contain; filter: drop-shadow(0 8px 20px rgba(0,0,0,0.5)); }
        .sprite-mago-rpg1 img { transform: scaleX(-1); }
        .sprite-caballero-rpg1 img { transform: rotate(-10deg) translateY(10px); transform-origin: bottom center; }
        .question-box-rpg1 {
          background-color: var(--surface);
          border-top: 4px solid var(--borde-fuerte);
          border-bottom: 2px solid var(--borde-fuerte);
          padding: 15px;
          min-height: 75px;
          font-size: 15px;
          color: var(--text);
          line-height: 1.4;
          z-index: 12;
          position: relative;
        }
        .control-panel-rpg1 {
          height: 160px;
          display: grid;
          grid-template-columns: 2fr 1fr;
          background-color: var(--surface);
          border-top: 2px solid var(--borde-fuerte);
          z-index: 12;
          position: relative;
        }
        .answers-grid-rpg1 {
          background-color: var(--surface);
          border-right: 2px solid var(--borde);
          padding: 15px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .btn-answer-rpg1 {
          background-color: var(--bg);
          border: 2px solid var(--borde-fuerte);
          color: var(--text);
          border-radius: var(--radius, 6px);
          font-size: 14px;
          text-align: left;
          padding: 10px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .btn-answer-rpg1:hover {
          background-color: var(--accent);
          border-color: var(--accent);
          color: var(--bg);
        }
        .powerups-panel-rpg1 {
          background-color: var(--bg);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .powerups-title-rpg1 {
          font-size: 12px;
          color: var(--accent);
          font-weight: bold;
          text-align: center;
          margin-bottom: 2px;
          text-transform: uppercase;
        }
        .btn-powerup-rpg1 {
          background-color: var(--surface);
          border: 2px solid var(--borde-fuerte);
          color: var(--text);
          border-radius: 4px;
          font-size: 12px;
          padding: 6px 10px;
          cursor: pointer;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          font-family: inherit;
        }
        .btn-powerup-rpg1:hover {
          background-color: var(--accent);
          border-color: var(--accent);
          color: var(--bg);
          box-shadow: var(--sombra);
        }
      </style>

      <div class="game-container-rpg1">
        <!-- 1. ESCENARIO DE BATALLA -->
        <div class="battle-screen-rpg1">
          <!-- HUD Mago -->
          <div class="hud-box-rpg1 hud-mago-rpg1">
            <div class="hud-header-rpg1">
              <div class="hud-name-rpg1">MAGO DE FÍSICA</div>
            </div>
            <div class="health-bar-bg-rpg1">
              <div class="health-bar-fill-rpg1" id="bar-rival"></div>
              <div class="hud-hp-text-rpg1"><span id="hp-rival">${estadoAventura.hpRival}</span> / 9000 HP</div>
            </div>
          </div>

          <!-- Sprite Mago (Espejo horizontal) -->
          <div class="sprite-rpg1 sprite-mago-rpg1">
            <img src="../../../imagenes/mago.webp" alt="Mago">
          </div>

          <!-- Sprite Jugador (Inclinado hacia el frente y arriba) -->
          <div class="sprite-rpg1 sprite-caballero-rpg1">
            <img src="../../../imagenes/${avatarImg}" alt="Jugador">
          </div>

          <!-- HUD Jugador -->
          <div class="hud-box-rpg1 hud-caballero-rpg1">
            <div class="hud-header-rpg1">
              <div class="hud-name-rpg1">${estadoAventura.avatar.toUpperCase()}</div>
            </div>
            <div class="health-bar-bg-rpg1">
              <div class="health-bar-fill-rpg1" id="bar-jugador"></div>
              <div class="hud-hp-text-rpg1"><span id="hp-jugador">${estadoAventura.hpJugador}</span> / 9000 HP</div>
            </div>
          </div>
        </div>

        <!-- 2. CAJA DE LA PREGUNTA -->
        <div class="question-box-rpg1">
          [TURNO DEL ENEMIGO] El Mago te lanza un conjuro...<br>
          <strong>${p.enunciado}</strong>
        </div>

        <!-- 3. PANEL DE COMANDOS INFERIOR -->
        <div class="control-panel-rpg1">
          <!-- Opciones 2x2 -->
          <div class="answers-grid-rpg1" id="opciones-batalla">
            ${(p.opciones || []).map(function(op, idx) {
              return '<button type="button" class="btn-answer-rpg1 btn-opcion-rpg" data-idx="' + idx + '">' + String.fromCharCode(65 + idx) + ') ' + op.texto + '</button>';
            }).join('')}
          </div>

          <!-- Power-Ups y Tiempo -->
          <div class="powerups-panel-rpg1">
            <div class="powerups-title-rpg1">✨ Objetos / Ventajas</div>
            <button type="button" id="btn-pw-pocion" class="btn-powerup-rpg1"><span>❤️</span> Poción (${estadoAventura.powerUps.pocion})</button>
            <button type="button" id="btn-pw-pista" class="btn-powerup-rpg1"><span>👁️</span> Pista (${estadoAventura.powerUps.pista})</button>
            <button type="button" id="btn-pw-reloj" class="btn-powerup-rpg1"><span>⏳</span> Reloj (+15s) (${estadoAventura.powerUps.reloj})</button>
            <div style="font-size: 11px; color: #ffaa34; text-align: center; margin-top: auto;">⏳ Tiempo: <span id="span-tiempo">30</span>s</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderInterfazRPG02(p) {
    return `
      <style>
        .btn-opcion-rpg {
          transition: background 150ms ease, border-color 150ms ease;
        }
        .btn-opcion-rpg:hover {
          background-color: var(--accent) !important;
          color: var(--bg) !important;
          border-color: var(--accent) !important;
        }
      </style>
      <div style="max-width: 650px; margin: 0 auto; background: var(--surface); color: var(--text); border: 2px solid var(--borde-fuerte); border-radius: var(--radius, 12px); padding: 14px; box-shadow: var(--sombra); display: flex; flex-direction: column; gap: 10px;">
        <!-- HUD Superior -->
        <div style="display: flex; justify-content: space-between; background: var(--bg); padding: 8px 14px; border-radius: 8px; border: 1px solid var(--borde); font-size: 0.9em;">
          <div>🛡️ ${estadoAventura.avatar.toUpperCase()}: HP <span id="hp-jugador">${estadoAventura.hpJugador}</span>/9000</div>
          <div>⏳ TIEMPO: <span id="span-tiempo" style="color: var(--accent); font-weight: bold;">30</span>s</div>
          <div>👾 RIVAL: HP <span id="hp-rival">${estadoAventura.hpRival}</span>/9000</div>
        </div>

        <!-- Pantalla de Combate Central -->
        <div style="background: var(--bg); border: 1px solid var(--borde); border-radius: 10px; padding: 20px; text-align: center;">
          <div style="font-size: 50px;">🧙‍♂️</div>
          <div style="font-size: 0.9rem; color: var(--accent); font-weight: bold; margin-top: 4px;">Mago Jefe de Conocimiento</div>
        </div>

        <!-- Panel Inferior Dividido: Pregunta/Opciones vs Inventario -->
        <div style="display: grid; grid-template-columns: 1fr 180px; gap: 10px; background: var(--bg); border: 1px solid var(--borde); padding: 12px; border-radius: 10px;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="font-size: 0.95rem; font-weight: bold; color: var(--text);">${p.enunciado}</div>
            <div style="display: flex; flex-direction: column; gap: 6px;" id="opciones-batalla">
              ${(p.opciones || []).map(function(op, idx) {
                return '<button type="button" class="btn-opcion-rpg" data-idx="' + idx + '" style="background: var(--surface); border: 1px solid var(--borde-fuerte); color: var(--text); padding: 8px 10px; text-align: left; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em;">' + (idx + 1) + ') ' + op.texto + '</button>';
              }).join('')}
            </div>
          </div>

          <div style="background: var(--surface); border: 1px solid var(--borde-fuerte); padding: 8px; border-radius: 6px; display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 0.8rem; color: var(--accent); font-weight: bold; text-align: center;">🎒 INVENTARIO</div>
            <button type="button" id="btn-pw-pocion" class="btn-power" style="background: var(--bg); color: var(--text); border: 1px solid var(--borde); padding: 6px; font-size: 0.85em; border-radius: 4px; cursor: pointer;">❤️ Poción (${estadoAventura.powerUps.pocion})</button>
            <button type="button" id="btn-pw-pista" class="btn-power" style="background: var(--bg); color: var(--text); border: 1px solid var(--borde); padding: 6px; font-size: 0.85em; border-radius: 4px; cursor: pointer;">👁️ Pista (${estadoAventura.powerUps.pista})</button>
            <button type="button" id="btn-pw-reloj" class="btn-power" style="background: var(--bg); color: var(--text); border: 1px solid var(--borde); padding: 6px; font-size: 0.85em; border-radius: 4px; cursor: pointer;">⏳ Reloj (${estadoAventura.powerUps.reloj})</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderInterfazRPG03(p) {
    return `
      <style>
        .btn-opcion-rpg {
          transition: background 150ms ease, color 150ms ease;
        }
        .btn-opcion-rpg:hover {
          background: var(--accent) !important;
          color: var(--bg) !important;
        }
      </style>
      <div style="max-width: 650px; margin: 0 auto; background: var(--surface); color: var(--text); border: 3px solid var(--borde-fuerte); border-radius: 6px; padding: 14px; font-family: inherit;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid var(--borde-fuerte); padding-bottom: 6px; margin-bottom: 10px; font-size: 0.9em;">
          <div>PLAYER: <span id="hp-jugador">${estadoAventura.hpJugador}</span> HP</div>
          <div>TIME: <span id="span-tiempo">30</span>s</div>
          <div>ENEMY: <span id="hp-rival">${estadoAventura.hpRival}</span> HP</div>
        </div>

        <div style="display: flex; justify-content: space-around; align-items: center; border-bottom: 2px dashed var(--borde); padding-bottom: 10px; margin-bottom: 10px;">
          <div style="border: 2px solid var(--borde-fuerte); padding: 8px 16px; text-align: center; font-size: 0.9em;">⚔️ ${estadoAventura.avatar.toUpperCase()}</div>
          <div style="font-weight: bold;">VS</div>
          <div style="border: 2px solid var(--borde-fuerte); padding: 8px 16px; text-align: center; font-size: 0.9em;">🧙‍♂️ MAGO RIVAL</div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg); padding: 6px 10px; border: 1px solid var(--borde); margin-bottom: 10px; font-size: 0.85em;">
          <div>ITEMS:</div>
          <div style="display: flex; gap: 6px;">
            <button type="button" id="btn-pw-pocion" style="background: var(--surface); color: var(--text); border: 1px solid var(--borde-fuerte); padding: 2px 6px; cursor: pointer;">[POT (${estadoAventura.powerUps.pocion})]</button>
            <button type="button" id="btn-pw-pista" style="background: var(--surface); color: var(--text); border: 1px solid var(--borde-fuerte); padding: 2px 6px; cursor: pointer;">[HINT (${estadoAventura.powerUps.pista})]</button>
            <button type="button" id="btn-pw-reloj" style="background: var(--surface); color: var(--text); border: 1px solid var(--borde-fuerte); padding: 2px 6px; cursor: pointer;">[TIME (${estadoAventura.powerUps.reloj})]</button>
          </div>
        </div>

        <div style="border: 2px solid var(--borde-fuerte); background: var(--bg); padding: 12px; margin-bottom: 10px;">
          <p style="margin: 0; font-size: 0.95em; color: var(--text);">* ${p.enunciado}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;" id="opciones-batalla">
          ${(p.opciones || []).map(function(op, idx) {
            return '<button type="button" class="btn-opcion-rpg" data-idx="' + idx + '" style="background: var(--surface); color: var(--text); border: 2px solid var(--borde-fuerte); padding: 8px; cursor: pointer; text-align: left; font-family: inherit; font-size: 0.9em;">> ' + op.texto + '</button>';
          }).join('')}
        </div>
      </div>
    `;
  }

  function iniciarTemporizadorPregunta(wrapper, contenedor) {
    estadoAventura.tiempoRestante = 30;
    var spanTiempo = wrapper.querySelector('#span-tiempo');

    if (estadoAventura.temporizador) clearInterval(estadoAventura.temporizador);

    estadoAventura.temporizador = setInterval(function () {
      estadoAventura.tiempoRestante--;
      if (spanTiempo) spanTiempo.textContent = estadoAventura.tiempoRestante;

      if (estadoAventura.tiempoRestante <= 0) {
        clearInterval(estadoAventura.temporizador);
        aplicarDanoJugador(25);
        siguientePreguntaOVerificar(contenedor);
      }
    }, 1000);
  }

  function conectarEventosBatalla(wrapper, contenedor, p) {
    var botonesOpc = wrapper.querySelectorAll('.btn-opcion-rpg');
    for (var i = 0; i < botonesOpc.length; i++) {
      botonesOpc[i].addEventListener('click', function () {
        clearInterval(estadoAventura.temporizador);
        var idx = parseInt(this.getAttribute('data-idx'));
        var opcionElegida = p.opciones[idx];

        if (opcionElegida && opcionElegida.correcta) {
          if (Sonido && Sonido.reproducir) Sonido.reproducir('acierto');
          estadoAventura.hpRival -= 35;
          if (estadoAventura.hpRival < 0) estadoAventura.hpRival = 0;
          actualizarHPs(wrapper);
          
          if (estadoAventura.hpRival <= 0) {
            setTimeout(function () { renderVictoriaDerrota(contenedor); }, 600);
            return;
          }
        } else {
          aplicarDanoJugador(30);
        }

        siguientePreguntaOVerificar(contenedor);
      });
    }

    function mostrarAvisoPowerUp(textoAviso) {
      var viejo = wrapper.querySelector('#aviso-power-up');
      if (viejo) viejo.remove();

      var aviso = document.createElement('div');
      aviso.id = 'aviso-power-up';
      aviso.style.cssText = 'position: absolute; top: 20px; left: 50%; transform: translateX(-50%); background: var(--accent); color: var(--bg); padding: 8px 16px; border-radius: 999px; font-weight: bold; font-size: 0.95em; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 100; animation: fadeInOut 2s ease forwards;';
      aviso.textContent = textoAviso;
      wrapper.style.position = 'relative';
      wrapper.appendChild(aviso);

      setTimeout(function () {
        if (aviso.parentNode) aviso.remove();
      }, 2000);
    }

    var btnPocion = wrapper.querySelector('#btn-pw-pocion');
    if (btnPocion) {
      btnPocion.addEventListener('click', function () {
        if (estadoAventura.powerUps.pocion > 0) {
          estadoAventura.powerUps.pocion--;
          estadoAventura.hpJugador = Math.min(100, estadoAventura.hpJugador + 30);
          actualizarHPs(wrapper);
          if (Sonido && Sonido.reproducir) Sonido.reproducir('charm');
          this.textContent = this.textContent.replace(/\(\d+\)/, '(' + estadoAventura.powerUps.pocion + ')');
          mostrarAvisoPowerUp('❤️ ¡Poción usada! +30 HP');
        } else {
          alert('No te quedan Pociones.');
        }
      });
    }

    var btnPista = wrapper.querySelector('#btn-pw-pista');
    if (btnPista) {
      btnPista.addEventListener('click', function () {
        if (estadoAventura.powerUps.pista > 0) {
          estadoAventura.powerUps.pista--;
          this.textContent = this.textContent.replace(/\(\d+\)/, '(' + estadoAventura.powerUps.pista + ')');
          if (Sonido && Sonido.reproducir) Sonido.reproducir('ding');
          mostrarAvisoPowerUp('👁️ ¡Puesta en marcha! Opción incorrecta eliminada');
          
          var errOptions = wrapper.querySelectorAll('.btn-opcion-rpg');
          for (var j = 0; j < errOptions.length; j++) {
            var idx = parseInt(errOptions[j].getAttribute('data-idx'));
            if (!p.opciones[idx].correcta && errOptions[j].style.display !== 'none') {
              errOptions[j].style.display = 'none';
              break;
            }
          }
        } else {
          alert('No te quedan Pistas.');
        }
      });
    }

    var btnReloj = wrapper.querySelector('#btn-pw-reloj');
    if (btnReloj) {
      btnReloj.addEventListener('click', function () {
        if (estadoAventura.powerUps.reloj > 0) {
          estadoAventura.powerUps.reloj--;
          estadoAventura.tiempoRestante += 15;
          if (spanTiempo) spanTiempo.textContent = estadoAventura.tiempoRestante;
          this.textContent = this.textContent.replace(/\(\d+\)/, '(' + estadoAventura.powerUps.reloj + ')');
          if (Sonido && Sonido.reproducir) Sonido.reproducir('soft');
          mostrarAvisoPowerUp('⏳ ¡Reloj de Arena usado! +15s');
        } else {
          alert('No te quedan Relojes de Arena.');
        }
      });
    }
  }

  function aplicarDanoJugador(dano) {
    estadoAventura.hpJugador -= dano;
    if (estadoAventura.hpJugador < 0) estadoAventura.hpJugador = 0;
  }

  function actualizarHPs(wrapper) {
    var hpJ = wrapper.querySelector('#hp-jugador');
    var hpR = wrapper.querySelector('#hp-rival');
    if (hpJ) hpJ.textContent = estadoAventura.hpJugador;
    if (hpR) hpR.textContent = estadoAventura.hpRival;
  }

  function siguientePreguntaOVerificar(contenedor) {
    if (estadoAventura.hpJugador <= 0) {
      setTimeout(function () { renderVictoriaDerrota(contenedor); }, 500);
      return;
    }

    estadoAventura.indicePregunta++;
    setTimeout(function () {
      renderBatalla(contenedor);
    }, 800);
  }

  function renderVictoriaDerrota(contenedor) {
    contenedor.innerHTML = '';
    var victoria = estadoAventura.hpJugador > 0;

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'text-align: center; padding: var(--space-xl); background: var(--surface); border: 3px solid var(--borde-fuerte); border-radius: var(--radius); max-width: 500px; margin: 0 auto;';

    wrapper.innerHTML = `
      <div style="font-size: 60px; margin-bottom: var(--space-sm);">${victoria ? '🏆🎉' : '💀💥'}</div>
      <h2>${victoria ? '¡VICTORIA ÉPICA!' : 'HAS SIDO DERROTADO'}</h2>
      <p style="color: var(--muted); margin: var(--space-md) 0;">
        ${victoria ? 'Has demostrado un dominio excepcional del conocimiento. El rival ha caído.' : 'El tiempo y los errores te han superado. ¡Entrena más en el banco de tests e inténtalo de nuevo!'}
      </p>
      <div style="display: flex; gap: var(--space-sm); justify-content: center; margin-top: var(--space-lg);">
        <button type="button" id="btn-reiniciar-aventura" class="boton" style="padding: var(--space-sm) var(--space-lg); cursor: pointer;">⚔️ Elegir Otro Test</button>
        <a href="../test-conocimientos.html" class="boton boton--chico" style="padding: var(--space-sm) var(--space-md);">Salir al Menú</a>
      </div>
    `;

    contenedor.appendChild(wrapper);

    wrapper.querySelector('#btn-reiniciar-aventura').addEventListener('click', function () {
      renderSeleccionTest(contenedor);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  window.RetoAventura = { iniciar: iniciar };

})();
