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
    hpJugador: 100,
    hpRival: 100,
    tiempoRestante: 30,
    temporizador: null
  };

  function iniciar() {
    var raiz = document.getElementById('vistas');
    if (!raiz) return;
    renderConfiguracion(raiz);
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
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: var(--space-sm); margin-top: var(--space-sm);">
          <label class="marca-opcion" style="justify-content: center; flex-direction: column; padding: var(--space-sm); cursor: pointer;">
            <input type="radio" name="avatar" value="mago" checked style="margin-bottom: 4px;"> 🧙‍♂️ Mago
          </label>
          <label class="marca-opcion" style="justify-content: center; flex-direction: column; padding: var(--space-sm); cursor: pointer;">
            <input type="radio" name="avatar" value="caballero" style="margin-bottom: 4px;"> 🛡️ Caballero
          </label>
          <label class="marca-opcion" style="justify-content: center; flex-direction: column; padding: var(--space-sm); cursor: pointer;">
            <input type="radio" name="avatar" value="arquero" style="margin-bottom: 4px;"> 🏹 Arquero
          </label>
          <label class="marca-opcion" style="justify-content: center; flex-direction: column; padding: var(--space-sm); cursor: pointer;">
            <input type="radio" name="avatar" value="erudito" style="margin-bottom: 4px;"> 📜 Erudito
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

        // Barajar opciones de cada pregunta como en los demás módulos
        mazo.forEach(function (q) {
          if (q.opciones && q.opciones.length > 0) {
            q.opciones = barajarOpciones(q.opciones);
          }
        });

        estadoAventura.testSeleccionado = test;
        estadoAventura.preguntas = mazo;
        estadoAventura.indicePregunta = 0;
        estadoAventura.hpJugador = 100;
        estadoAventura.hpRival = 100;

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
    return `
      <div style="background: #111116; color: #00ffcc; border: 3px solid #33ff33; border-radius: 8px; padding: var(--space-md); font-family: 'Courier New', monospace; box-shadow: 0 4px 20px rgba(0,255,204,0.2);">
        <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-md); border-bottom: 2px dashed #33ff33; padding-bottom: var(--space-xs);">
          <div>🧙‍♂️ <strong>Héroe (${estadoAventura.avatar.toUpperCase()})</strong><br>HP: <span id="hp-jugador">${estadoAventura.hpJugador}</span>/100</div>
          <div style="text-align: center;">⏳ TIEMPO: <span id="span-tiempo" style="color: #ffeb3b; font-size: 1.2em;">30</span>s</div>
          <div style="text-align: right;">👾 <strong>Rival de Turno</strong><br>HP: <span id="hp-rival">${estadoAventura.hpRival}</span>/100</div>
        </div>

        <div style="background: #1a1a24; border: 2px solid #00ffcc; padding: var(--space-md); border-radius: 6px; margin-bottom: var(--space-md); min-height: 90px; display: flex; align-items: center; justify-content: center; text-align: center;">
          <p style="margin: 0; font-size: 1.1em; color: #fff;">${p.enunciado}</p>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-md);">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-xs);" id="opciones-batalla">
            ${(p.opciones || []).map(function(op, idx) {
              return '<button type="button" class="btn-opcion-rpg" data-idx="' + idx + '" style="background: #1d213a; border: 2px solid #00ffcc; color: #00ffcc; padding: var(--space-sm); border-radius: 4px; cursor: pointer; text-align: left; font-family: inherit; font-weight: bold;">[' + (idx + 1) + '] ' + op.texto + '</button>';
            }).join('')}
          </div>

          <div style="background: #1d213a; border: 2px solid #ffeb3b; padding: var(--space-sm); border-radius: 6px; display: flex; flex-direction: column; gap: 8px;">
            <strong style="color: #ffeb3b; font-size: 0.9em; text-align: center;">INVENTARIO (Power-Ups)</strong>
            <button type="button" id="btn-pw-pocion" class="btn-power" style="background: #333; color: #ff3366; border: 1px solid #ff3366; padding: 6px; cursor: pointer; border-radius: 4px;">❤️ Poción (${estadoAventura.powerUps.pocion})</button>
            <button type="button" id="btn-pw-pista" class="btn-power" style="background: #333; color: #00ffcc; border: 1px solid #00ffcc; padding: 6px; cursor: pointer; border-radius: 4px;">👁️ Pista (${estadoAventura.powerUps.pista})</button>
            <button type="button" id="btn-pw-reloj" class="btn-power" style="background: #333; color: #ffeb3b; border: 1px solid #ffeb3b; padding: 6px; cursor: pointer; border-radius: 4px;">⏳ Reloj (${estadoAventura.powerUps.reloj})</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderInterfazRPG02(p) {
    return `
      <div style="background: radial-gradient(circle, #2d1b4e 0%, #11071f 100%); color: #e2e8f0; border: 3px solid #9333ea; border-radius: 12px; padding: var(--space-md); box-shadow: 0 4px 25px rgba(147,51,234,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md); border-bottom: 1px solid #4c1d95; padding-bottom: var(--space-xs);">
          <div>🧙‍♂️ <strong>Jugador:</strong> HP <span id="hp-jugador">${estadoAventura.hpJugador}</span>/100</div>
          <div style="background: #4c1d95; padding: 4px 12px; border-radius: 999px; font-weight: bold;">⏳ <span id="span-tiempo">30</span>s</div>
          <div>👾 <strong>Jefe Rival:</strong> HP <span id="hp-rival">${estadoAventura.hpRival}</span>/100</div>
        </div>

        <div style="text-align: center; margin-bottom: var(--space-md);">
          <div style="font-size: 50px; animation: float 3s ease-in-out infinite;">🦹‍♂️</div>
          <p style="background: rgba(0,0,0,0.4); border: 2px solid #7c3aed; padding: var(--space-md); border-radius: 8px; font-size: 1.1em; margin-top: 8px;">${p.enunciado}</p>
        </div>

        <div style="display: flex; gap: var(--space-md);">
          <div style="flex: 2; display: flex; flex-direction: column; gap: var(--space-xs);" id="opciones-batalla">
            ${(p.opciones || []).map(function(op, idx) {
              return '<button type="button" class="btn-opcion-rpg" data-idx="' + idx + '" style="background: #251738; border: 2px solid #7c3aed; color: #e2e8f0; padding: var(--space-sm); border-radius: 8px; cursor: pointer; text-align: left; font-weight: bold;">▪️ ' + op.texto + '</button>';
            }).join('')}
          </div>
          <div style="flex: 1; background: #1a0b2e; border: 2px solid #581c87; padding: var(--space-sm); border-radius: 8px; display: flex; flex-direction: column; gap: 8px;">
            <span style="font-weight: bold; color: #c084fc; text-align: center;">🎒 INVENTARIO</span>
            <button type="button" id="btn-pw-pocion" style="background: #3b0764; color: #f472b6; border: 1px solid #f472b6; padding: 8px; border-radius: 6px; cursor: pointer;">❤️ Poción (${estadoAventura.powerUps.pocion})</button>
            <button type="button" id="btn-pw-pista" style="background: #3b0764; color: #38bdf8; border: 1px solid #38bdf8; padding: 8px; border-radius: 6px; cursor: pointer;">👁️ Pista (${estadoAventura.powerUps.pista})</button>
            <button type="button" id="btn-pw-reloj" style="background: #3b0764; color: #facc15; border: 1px solid #facc15; padding: 8px; border-radius: 6px; cursor: pointer;">⏳ Reloj (${estadoAventura.powerUps.reloj})</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderInterfazRPG03(p) {
    return `
      <div style="background: #000; color: #fff; border: 3px solid #fff; border-radius: 4px; padding: var(--space-md); font-family: 'Courier New', Courier, monospace;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #fff; padding-bottom: 8px; margin-bottom: var(--space-md);">
          <div>PLAYER: <span id="hp-jugador">${estadoAventura.hpJugador}</span> HP</div>
          <div>TIME: <span id="span-tiempo">30</span>s</div>
          <div>ENEMY: <span id="hp-rival">${estadoAventura.hpRival}</span> HP</div>
        </div>

        <div style="border: 2px solid #fff; padding: var(--space-md); margin-bottom: var(--space-md); min-height: 80px;">
          <p style="margin: 0; font-size: 1.1em;">* ${p.enunciado}</p>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-sm);" id="opciones-batalla">
          ${(p.opciones || []).map(function(op, idx) {
            return '<button type="button" class="btn-opcion-rpg" data-idx="' + idx + '" style="background: #000; color: #fff; border: 2px solid #fff; padding: var(--space-sm); cursor: pointer; text-align: left; font-family: inherit;">> ' + op.texto + '</button>';
          }).join('')}
        </div>

        <div style="display: flex; gap: var(--space-sm); margin-top: var(--space-md); justify-content: center;">
          <button type="button" id="btn-pw-pocion" style="background: #000; color: #fff; border: 1px solid #fff; padding: 4px 8px; cursor: pointer;">[❤️ POT (${estadoAventura.powerUps.pocion})]</button>
          <button type="button" id="btn-pw-pista" style="background: #000; color: #fff; border: 1px solid #fff; padding: 4px 8px; cursor: pointer;">[👁️ HINT (${estadoAventura.powerUps.pista})]</button>
          <button type="button" id="btn-pw-reloj" style="background: #000; color: #fff; border: 1px solid #fff; padding: 4px 8px; cursor: pointer;">[⏳ TIME (${estadoAventura.powerUps.reloj})]</button>
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
          if (Sonido && Sonido.reproducir) Sonido.reproducir('error');
          aplicarDanoJugador(30);
        }

        siguientePreguntaOVerificar(contenedor);
      });
    }

    var btnPocion = wrapper.querySelector('#btn-pw-pocion');
    if (btnPocion) {
      btnPocion.addEventListener('click', function () {
        if (estadoAventura.powerUps.pocion > 0) {
          estadoAventura.powerUps.pocion--;
          estadoAventura.hpJugador = Math.min(100, estadoAventura.hpJugador + 30);
          actualizarHPs(wrapper);
          if (Sonido && Sonido.reproducir) Sonido.reproducir('acierto');
          this.textContent = this.textContent.replace(/\(\d+\)/, '(' + estadoAventura.powerUps.pocion + ')');
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
          this.textContent = this.textContent.replace(/\(\d+\)/, '(' + estadoAventura.powerUps.reloj + ')');
          if (Sonido && Sonido.reproducir) Sonido.reproducir('acierto');
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
