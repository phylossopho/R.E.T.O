/* =========================================================================
   R.E.T.O. - Aventura Gráfica (Modo RPG / Overworld Canvas Pixel Art / Batalla)
   -------------------------------------------------------------------------
   Gestiona la configuración inicial, el mapa overworld en Pixel Art real (Canvas)
   y el motor de batalla RPG.
   ========================================================================= */
(function () {
  'use strict';

  var lsBase = {
    getItem: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    setItem: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
    removeItem: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
  };

  /* CONFIGURACION POR MODELO DE INTERFAZ. Todo lo que cambia la APARIENCIA de la batalla (fuente, tamaños de texto,
     alto y ancho de la escena, tamaño de los sprites, posiciones y anchos de cada bloque) se guarda aparte para cada
     modelo: aventura_rpg01_<ajuste>, aventura_rpg02_<ajuste>, aventura_rpg03_<ajuste>. Lo que cambia COMO se juega
     (tiempo, daño, dificultad, número grande, sonidos, animaciones, diálogos) es común a los tres. El RPG 01 hereda lo
     que ya tenía guardado (aventura_<ajuste>) hasta que se vuelva a tocar. El layout del editor ya era por modelo. */
  var APARIENCIA = ['fuente', 'size_pregunta', 'size_opciones', 'size_powerups', 'battle_max_width', 'battle_min_height',
    'sprite_size', 'q_min_height', 'q_width', 'q_x', 'q_y', 'ans_min_height', 'ans_width', 'ans_x', 'ans_y',
    'pw_min_height', 'pw_width', 'pw_x', 'pw_y', 'timer_min_height', 'timer_width', 'timer_x', 'timer_y', 'screen_x', 'screen_y'];

  function interfazActual() {
    return (typeof estadoAventura !== 'undefined' && estadoAventura && estadoAventura.interfaz) || 'rpg01';
  }

  function claveAjuste(k) {
    var m = /^aventura_(.+)$/.exec(k);
    return m && APARIENCIA.indexOf(m[1]) >= 0 ? 'aventura_' + interfazActual() + '_' + m[1] : k;
  }

  var lsSeguro = {
    getItem: function (k) {
      var real = claveAjuste(k);
      var v = lsBase.getItem(real);
      if (v === null && real !== k && interfazActual() === 'rpg01') v = lsBase.getItem(k);
      return v;
    },
    setItem: function (k, v) { lsBase.setItem(claveAjuste(k), v); },
    removeItem: function (k) { lsBase.removeItem(claveAjuste(k)); }
  };

  function sonar(nombre) {
    try { if (Sonido && Sonido.reproducir) Sonido.reproducir(nombre); } catch (e) { /* el sonido nunca debe frenar la aventura */ }
  }

  var Banco = window.RetoTestsBanco;
  var Sonido = window.RetoSonido;
  var Eval = window.RetoTestsEval;
  var Instancia = window.RetoTestsInstancia;

  var estadoAventura = {
    avatar: 'mago',
    avatarRival: 'mago',
    interfaz: 'rpg01',
    powerUps: { pocion: 2, pista: 2, reloj: 1 },
    testSeleccionado: null,
    preguntas: [],
    indicePregunta: 0,
    hpJugador: 100,
    hpRival: 100,
    pvMax: 100,
    pvMaxRival: 100,
    tiempoRestante: 30,
    temporizador: null,
    vista: null,
    sesionPve: null,
    procesado: null,
    avisoPendiente: '',
    textosPU: null,
    catalogoPU: null
  };

  function iniciar() {
    var raiz = document.getElementById('vistas');
    if (!raiz) return;

    aplicarAjustesAventura();

    // Cargar perfil local y tarjeta importada (para config v2)
    if (window.RetoPerfil && window.RetoPerfil.obtener) {
      window.RetoPerfil.obtener().then(function (p) {
        if (p) estadoAventura.perfilLocal = p;
      });
    }
    // La tarjeta importada se guarda en sessionStorage 'aventura_tarjeta' (igual que en duelo)
    try {
      var guardada = window.sessionStorage.getItem('aventura_tarjeta');
      if (guardada && window.RetoRpg && window.RetoRpg.leerTarjeta) {
        window.RetoRpg.leerTarjeta(guardada).then(function (t) {
          estadoAventura.perfilTarjeta = t.perfil;
        }).catch(function () {
          window.sessionStorage.removeItem('aventura_tarjeta');
        });
      }
    } catch (e) {}

    var btnConfig = document.querySelector('[data-configurar]');
    if (btnConfig) {
      btnConfig.addEventListener('click', function (e) {
        e.preventDefault();
        abrirConfigAventura();
      });
    }

    var btnIniciar = document.getElementById('btn-iniciar-aventura');
    if (btnIniciar) {
      btnIniciar.addEventListener('click', function () {
        renderConfiguracion(raiz);
      });
    } else {
      renderConfiguracion(raiz);
    }
  }

  var cfgModal = null;

  /* Los 12 personajes (6 hombres y 6 mujeres). */
  var AVATARES_BASE = [
    { id: 'mago', nombre: 'Mago', genero: 'hombre', archivo: 'mago.webp' },
    { id: 'maga', nombre: 'Maga', genero: 'mujer', archivo: 'maga.webp' },
    { id: 'caballero', nombre: 'Caballero', genero: 'hombre', archivo: 'caballero.webp' },
    { id: 'caballera', nombre: 'Caballera', genero: 'mujer', archivo: 'caballera.webp' },
    { id: 'arquero', nombre: 'Arquero', genero: 'hombre', archivo: 'arquero.webp' },
    { id: 'arquera', nombre: 'Arquera', genero: 'mujer', archivo: 'arquera.webp' },
    { id: 'guerrero', nombre: 'Guerrero', genero: 'hombre', archivo: 'guerrero.webp' },
    { id: 'guerrera', nombre: 'Guerrera', genero: 'mujer', archivo: 'guerrera.webp' },
    { id: 'asesino', nombre: 'Asesino', genero: 'hombre', archivo: 'asesino.webp' },
    { id: 'asesina', nombre: 'Asesina', genero: 'mujer', archivo: 'asesina.webp' },
    { id: 'clerigo', nombre: 'Clérigo', genero: 'hombre', archivo: 'clerigo.webp' },
    { id: 'sacerdotiza', nombre: 'Sacerdotisa', genero: 'mujer', archivo: 'sacerdotiza.webp' }
  ];
  /* Las fuentes de pixeles (Press Start 2P, VT323, Handjet) se quitaron: costaban
     leerse y se pedian a Google. Quien las tenia guardadas pasa a Roboto Mono. */
  function fuenteValida(v) {
    return (v === 'roboto-mono' || v === 'nunito' || v === 'interfaz') ? v : 'roboto-mono';
  }

  function leerAjustes() { return {
    dialogosOponente: lsSeguro.getItem('aventura_dialogos') || 'on',
    fuente: fuenteValida(lsSeguro.getItem('aventura_fuente')),
    sizePregunta: lsSeguro.getItem('aventura_size_pregunta') || 'normal',
    sizeOpciones: lsSeguro.getItem('aventura_size_opciones') || 'normal',
    sizePowerups: lsSeguro.getItem('aventura_size_powerups') || 'normal',
    danoTiempo: lsSeguro.getItem('aventura_dano_tiempo') || 'off',
    numerosGrandes: lsSeguro.getItem('aventura_numeros_grandes') || 'on',
    danPorcentaje: parseInt(lsSeguro.getItem('aventura_dan_porcentaje') || '10', 10),
    numPreguntas: parseInt(lsSeguro.getItem('aventura_num_preguntas') || '15', 10),
    dificultad: ['facil', 'normal', 'dificil'].indexOf(lsSeguro.getItem('aventura_dificultad')) >= 0 ? lsSeguro.getItem('aventura_dificultad') : 'normal',
    battleMaxWidth: lsSeguro.getItem('aventura_battle_max_width') || (interfazActual() === 'rpg01' ? '90%' : '60%'),
    battleMinHeight: lsSeguro.getItem('aventura_battle_min_height') || '340px',
    spriteSize: lsSeguro.getItem('aventura_sprite_size') || '230px',
    questionMinHeight: lsSeguro.getItem('aventura_q_min_height') || '85px',
    questionWidth: lsSeguro.getItem('aventura_q_width') || '100%',
    questionX: lsSeguro.getItem('aventura_q_x') || '0px',
    questionY: lsSeguro.getItem('aventura_q_y') || '0px',
    answersMinHeight: lsSeguro.getItem('aventura_ans_min_height') || '120px',
    answersWidth: lsSeguro.getItem('aventura_ans_width') || '100%',
    answersX: lsSeguro.getItem('aventura_ans_x') || '0px',
    answersY: lsSeguro.getItem('aventura_ans_y') || '0px',
    powerupsMinHeight: lsSeguro.getItem('aventura_pw_min_height') || '120px',
    powerupsWidth: lsSeguro.getItem('aventura_pw_width') || '100%',
    powerupsX: lsSeguro.getItem('aventura_pw_x') || '0px',
    powerupsY: lsSeguro.getItem('aventura_pw_y') || '0px',
    timerMinHeight: lsSeguro.getItem('aventura_timer_min_height') || '45px',
    timerWidth: lsSeguro.getItem('aventura_timer_width') || '100%',
    timerX: lsSeguro.getItem('aventura_timer_x') || '0px',
    timerY: lsSeguro.getItem('aventura_timer_y') || '0px',
    screenX: lsSeguro.getItem('aventura_screen_x') || '0px',
    screenY: lsSeguro.getItem('aventura_screen_y') || '0px',
    animaciones: lsSeguro.getItem('aventura_animaciones') || 'on'
  }; }

  var ajustesAventura = leerAjustes();

  function aplicarAjustesAventura() {
    var fontMap = {
      'roboto-mono': '"Roboto Mono", ui-monospace, monospace',
      'nunito': '"Nunito", system-ui, sans-serif',
      'interfaz': 'var(--font)'
    };
    var familia = fontMap[ajustesAventura.fuente] || fontMap['roboto-mono'];
    document.documentElement.style.setProperty('--aventura-font', familia);
    document.documentElement.style.setProperty('--aventura-battle-max-width', ajustesAventura.battleMaxWidth);
    document.documentElement.style.setProperty('--aventura-battle-min-height', ajustesAventura.battleMinHeight);
    document.documentElement.style.setProperty('--aventura-sprite-size', ajustesAventura.spriteSize);
    document.documentElement.style.setProperty('--aventura-question-min-height', ajustesAventura.questionMinHeight);
    document.documentElement.style.setProperty('--aventura-question-width', ajustesAventura.questionWidth);
    document.documentElement.style.setProperty('--aventura-question-x', ajustesAventura.questionX);
    document.documentElement.style.setProperty('--aventura-question-y', ajustesAventura.questionY);
    document.documentElement.style.setProperty('--aventura-answers-min-height', ajustesAventura.answersMinHeight);
    document.documentElement.style.setProperty('--aventura-answers-width', ajustesAventura.answersWidth);
    document.documentElement.style.setProperty('--aventura-answers-x', ajustesAventura.answersX);
    document.documentElement.style.setProperty('--aventura-answers-y', ajustesAventura.answersY);
    document.documentElement.style.setProperty('--aventura-powerups-min-height', ajustesAventura.powerupsMinHeight);
    document.documentElement.style.setProperty('--aventura-powerups-width', ajustesAventura.powerupsWidth);
    document.documentElement.style.setProperty('--aventura-powerups-x', ajustesAventura.powerupsX);
    document.documentElement.style.setProperty('--aventura-powerups-y', ajustesAventura.powerupsY);
    document.documentElement.style.setProperty('--aventura-timer-min-height', ajustesAventura.timerMinHeight);
    document.documentElement.style.setProperty('--aventura-timer-width', ajustesAventura.timerWidth);
    document.documentElement.style.setProperty('--aventura-timer-x', ajustesAventura.timerX);
    document.documentElement.style.setProperty('--aventura-timer-y', ajustesAventura.timerY);
    document.documentElement.style.setProperty('--aventura-screen-x', ajustesAventura.screenX);
    document.documentElement.style.setProperty('--aventura-screen-y', ajustesAventura.screenY);

    var sizeMapPregunta = { 'chico': '0.85rem', 'normal': '1.05rem', 'grande': '1.25rem', 'muy-grande': '1.45rem' };
    var sizeMapOpciones = { 'chico': '0.8rem', 'normal': '0.95rem', 'grande': '1.1rem', 'muy-grande': '1.25rem' };
    var sizeMapPowerups = { 'chico': '0.75rem', 'normal': '0.85rem', 'grande': '0.95rem', 'muy-grande': '1.1rem' };

    document.documentElement.style.setProperty('--aventura-size-pregunta', sizeMapPregunta[ajustesAventura.sizePregunta] || '1.05rem');
    document.documentElement.style.setProperty('--aventura-size-opciones', sizeMapOpciones[ajustesAventura.sizeOpciones] || '0.95rem');
    document.documentElement.style.setProperty('--aventura-size-powerups', sizeMapPowerups[ajustesAventura.sizePowerups] || '0.85rem');

    // Interruptor de animaciones de la batalla (sprites, números, auras y destellos): el CSS lo lee de este atributo.
    document.documentElement.setAttribute('data-batalla-anim', ajustesAventura.animaciones === 'off' ? 'off' : 'on');

    document.body.style.fontFamily = familia;
    var vistasEl = document.getElementById('vistas');
    if (vistasEl) {
      vistasEl.style.fontFamily = familia;
    }
  }

  /* Cambiar de modelo de interfaz: se cargan SUS ajustes de apariencia y el modal se vuelve a armar con ellos. */
  function cambiarInterfaz(id) {
    if (!id || estadoAventura.interfaz === id) return;
    estadoAventura.interfaz = id;
    Object.assign(ajustesAventura, leerAjustes());
    aplicarAjustesAventura();
    if (cfgModal) { try { cfgModal.close(); } catch (e) { /* ya cerrado */ } cfgModal.remove(); cfgModal = null; }
  }

  function armarConfigAventura() {
    if (cfgModal) return;
    cfgModal = document.createElement('dialog');
    cfgModal.className = 'dialogo cfg-aventura';
    cfgModal.style.cssText = 'max-width: 625px; width: 90%; background: var(--surface); color: var(--text); border: 3px solid var(--borde-fuerte); border-radius: var(--radius); padding: 0;';
    
    cfgModal.innerHTML = `
      <div class="cfg-cuerpo">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); margin-bottom: var(--space-md);">
        <h2 class="dialogo-titulo" style="margin: 0; font-size: 1.1em;">⚙️ Configuración de Aventura</h2>
        <button type="button" id="btn-editar-layout" class="boton" aria-label="Editar el layout de la interfaz de batalla" title="Editar layout de la batalla (mover y redimensionar)" style="padding: 8px; line-height: 0; cursor: pointer; background: var(--accent); color: var(--bg); border-radius: var(--radius);">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: var(--space-md);">
        <fieldset style="border: 2px solid var(--borde); border-radius: var(--radius); padding: var(--space-sm) var(--space-md); background: var(--bg);">
          <legend class="cfg-legend" style="font-weight: bold; color: var(--accent); cursor: pointer; user-select: none; display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>Animaciones</span> <span class="cfg-arrow">▼</span>
          </legend>
          <div class="cfg-content" style="margin-top: 8px;">
            <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85em;">
              <span>✨ Animaciones de la batalla (sprites, números, auras y destellos)</span>
              <input type="checkbox" id="cfg-animaciones" ${ajustesAventura.animaciones === 'off' ? '' : 'checked'} style="cursor: pointer; width: 18px; height: 18px;">
            </label>
            <p style="font-size: 0.8em; color: var(--muted); margin: 6px 0 0;">Apagadas, solo cambian las poses y los números aparecen sin moverse. Va aparte del interruptor general de animaciones del sitio, que también se respeta.</p>
          </div>
        </fieldset>

        <fieldset style="border: 2px solid var(--borde); border-radius: var(--radius); padding: var(--space-sm) var(--space-md); background: var(--bg);">
          <legend class="cfg-legend" style="font-weight: bold; color: var(--accent); cursor: pointer; user-select: none; display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>Comportamiento de Batalla</span> <span class="cfg-arrow">▼</span>
          </legend>
          <div class="cfg-content" style="display: flex; flex-direction: column; gap: var(--space-sm); margin-top: 8px;">
            <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85em;">
              <span>⏳ Pérdida de HP por tiempo (0.3%/s)</span>
              <input type="checkbox" id="cfg-dano-tiempo" ${ajustesAventura.danoTiempo === 'on' ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;">
            </label>

            <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85em;">
              <span>🔢 Número grande al acertar (verde) o fallar (naranja) en vez del texto</span>
              <input type="checkbox" id="cfg-numeros-grandes" ${ajustesAventura.numerosGrandes === 'on' ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;">
            </label>

            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                <label for="cfg-dan-porcentaje" style="font-weight: bold;">⚔️ Daño por ataque/error:</label>
                <span id="val-dan-porcentaje" style="font-weight: bold; color: var(--accent);">${ajustesAventura.danPorcentaje}%</span>
              </div>
              <input type="range" id="cfg-dan-porcentaje" min="3" max="10" step="1" value="${ajustesAventura.danPorcentaje}" style="width: 100%; cursor: pointer;">
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                <label for="cfg-num-preguntas" style="font-weight: bold;">📝 Preguntas en batalla:</label>
                <span id="val-num-preguntas" style="font-weight: bold; color: var(--accent);">${ajustesAventura.numPreguntas}</span>
              </div>
              <input type="range" id="cfg-num-preguntas" min="10" max="30" step="1" value="${ajustesAventura.numPreguntas}" style="width: 100%; cursor: pointer;">
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
              <label for="cfg-dificultad" style="font-weight: bold; font-size: 0.85em;">👾 Dificultad del enemigo:</label>
              <select id="cfg-dificultad" style="padding: 4px; cursor: pointer;">
                <option value="facil" ${ajustesAventura.dificultad === 'facil' ? 'selected' : ''}>Fácil (80 de vida)</option>
                <option value="normal" ${ajustesAventura.dificultad === 'normal' ? 'selected' : ''}>Normal (100 de vida)</option>
                <option value="dificil" ${ajustesAventura.dificultad === 'dificil' ? 'selected' : ''}>Difícil (120 de vida)</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset style="border: 2px solid var(--borde); border-radius: var(--radius); padding: var(--space-sm) var(--space-md); background: var(--bg);">
          <legend class="cfg-legend" style="font-weight: bold; color: var(--accent); cursor: pointer; user-select: none; display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>Sonidos</span> <span class="cfg-arrow">▼</span>
          </legend>
          <div class="cfg-content" style="margin-top: 8px;">
            <p style="font-size: 0.85em; color: var(--muted); margin: 0;">En desarrollo (próximamente).</p>
          </div>
        </fieldset>

        <fieldset style="border: 2px solid var(--borde); border-radius: var(--radius); padding: var(--space-sm) var(--space-md); background: var(--bg);">
          <legend class="cfg-legend" style="font-weight: bold; color: var(--accent); cursor: pointer; user-select: none; display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>Textos y Fuentes</span> <span class="cfg-arrow">▼</span>
          </legend>
          <div class="cfg-content" style="display: flex; flex-direction: column; gap: var(--space-sm); margin-top: 8px;">
            <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85em;">
              <span>💬 Diálogos de oponentes</span>
              <input type="checkbox" id="cfg-dialogos" ${ajustesAventura.dialogosOponente === 'on' ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;">
            </label>
            <span style="font-size: 0.75em; color: var(--muted);">Muestra u oculta la frase con la que cada rival (hombre o mujer, de cada clase) te presenta la pregunta.</span>

            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
              <label for="cfg-fuente-select" style="font-size: 0.85em; font-weight: bold;">🔤 Fuente de la Aventura:</label>
              <select id="cfg-fuente-select" style="padding: 8px; border: 2px solid var(--borde-fuerte); border-radius: var(--radius); background: var(--surface); color: var(--text); font-family: inherit; cursor: pointer; font-size: 0.85em;">
                <option value="roboto-mono">Roboto Mono (clara, ancho fijo)</option>
                <option value="nunito">Nunito (la del sitio)</option>
                <option value="interfaz">La que elegí para toda la interfaz</option>
                <option value="nunito">Nunito (Limpia / Estándar)</option>
              </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
              <label for="cfg-size-pregunta" style="font-size: 0.85em; font-weight: bold;">📏 Tamaño de Preguntas:</label>
              <select id="cfg-size-pregunta" style="padding: 6px; border: 2px solid var(--borde-fuerte); border-radius: var(--radius); background: var(--surface); color: var(--text); font-family: inherit; cursor: pointer; font-size: 0.85em;">
                <option value="chico">Chico</option>
                <option value="normal">Normal</option>
                <option value="grande">Grande</option>
                <option value="muy-grande">Muy Grande</option>
              </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
              <label for="cfg-size-opciones" style="font-size: 0.85em; font-weight: bold;">📏 Tamaño de Opciones de Respuesta:</label>
              <select id="cfg-size-opciones" style="padding: 6px; border: 2px solid var(--borde-fuerte); border-radius: var(--radius); background: var(--surface); color: var(--text); font-family: inherit; cursor: pointer; font-size: 0.85em;">
                <option value="chico">Chico</option>
                <option value="normal">Normal</option>
                <option value="grande">Grande</option>
                <option value="muy-grande">Muy Grande</option>
              </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
              <label for="cfg-size-powerups" style="font-size: 0.85em; font-weight: bold;">📏 Tamaño de Power-Ups / Inventario:</label>
              <select id="cfg-size-powerups" style="padding: 6px; border: 2px solid var(--borde-fuerte); border-radius: var(--radius); background: var(--surface); color: var(--text); font-family: inherit; cursor: pointer; font-size: 0.85em;">
                <option value="chico">Chico</option>
                <option value="normal">Normal</option>
                <option value="grande">Grande</option>
                <option value="muy-grande">Muy Grande</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset style="border: 2px solid var(--borde); border-radius: var(--radius); padding: var(--space-sm) var(--space-md); background: var(--bg);">
          <legend class="cfg-legend" style="font-weight: bold; color: var(--accent); cursor: pointer; user-select: none; display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>Interfaz de la Batalla (Personalización) · <span id="cfg-modelo">${{ rpg01: 'Modelo 1', rpg02: 'Modelo 2', rpg03: 'Modelo 3' }[estadoAventura.interfaz] || ''}</span></span> <span class="cfg-arrow">▼</span>
          </legend>
          <div class="cfg-content" style="display: flex; flex-direction: column; gap: var(--space-sm); margin-top: 8px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                <label for="cfg-battle-max-width" style="font-weight: bold;">🖥️ Ancho máximo de batalla (%):</label>
                <span id="val-battle-max-width" style="font-weight: bold; color: var(--accent);">${ajustesAventura.battleMaxWidth}</span>
              </div>
              <input type="range" id="cfg-battle-max-width" min="10" max="100" step="1" value="${parseInt(ajustesAventura.battleMaxWidth) || 90}" style="width: 100%; cursor: pointer;">
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                <label for="cfg-battle-min-height" style="font-weight: bold;">📐 Altura mínima del escenario (px):</label>
                <span id="val-battle-min-height" style="font-weight: bold; color: var(--accent);">${ajustesAventura.battleMinHeight}</span>
              </div>
              <input type="range" id="cfg-battle-min-height" min="100" max="500" step="1" value="${parseInt(ajustesAventura.battleMinHeight) || 220}" style="width: 100%; cursor: pointer;">
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                <label for="cfg-sprite-size" style="font-weight: bold;">👾 Tamaño de Avatares / Sprites (px):</label>
                <span id="val-sprite-size" style="font-weight: bold; color: var(--accent);">${ajustesAventura.spriteSize}</span>
              </div>
              <input type="range" id="cfg-sprite-size" min="100" max="400" step="1" value="${parseInt(ajustesAventura.spriteSize) || 240}" style="width: 100%; cursor: pointer;">
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                <label for="cfg-q-width" style="font-weight: bold;">🖥️ Ancho de Caja de Preguntas (%):</label>
                <span id="val-q-width" style="font-weight: bold; color: var(--accent);">${ajustesAventura.questionWidth}</span>
              </div>
              <input type="range" id="cfg-q-width" min="30" max="100" step="1" value="${parseInt(ajustesAventura.questionWidth) || 100}" style="width: 100%; cursor: pointer;">
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                <label for="cfg-q-min-height" style="font-weight: bold;">📐 Altura de Caja de Preguntas (px):</label>
                <span id="val-q-min-height" style="font-weight: bold; color: var(--accent);">${ajustesAventura.questionMinHeight}</span>
              </div>
              <input type="range" id="cfg-q-min-height" min="40" max="250" step="1" value="${parseInt(ajustesAventura.questionMinHeight) || 85}" style="width: 100%; cursor: pointer;">
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                <label for="cfg-pw-width" style="font-weight: bold;">🖥️ Ancho del Panel Power-Ups (%):</label>
                <span id="val-pw-width" style="font-weight: bold; color: var(--accent);">${ajustesAventura.powerupsWidth}</span>
              </div>
              <input type="range" id="cfg-pw-width" min="30" max="100" step="1" value="${parseInt(ajustesAventura.powerupsWidth) || 100}" style="width: 100%; cursor: pointer;">
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                <label for="cfg-pw-min-height" style="font-weight: bold;">📐 Altura del Panel Power-Ups (px):</label>
                <span id="val-pw-min-height" style="font-weight: bold; color: var(--accent);">${ajustesAventura.powerupsMinHeight}</span>
              </div>
              <input type="range" id="cfg-pw-min-height" min="60" max="300" step="1" value="${parseInt(ajustesAventura.powerupsMinHeight) || 120}" style="width: 100%; cursor: pointer;">
            </div>
          </div>
        </fieldset>
      </div>

      </div>

      <!-- FAB: siempre en la esquina inferior derecha del modal (el cuerpo es lo que se desplaza). Guarda (los cambios
           ya se guardan al moverlos) y cierra. La señal no es solo el color verde: lleva una palomita y nombre accesible. -->
      <button type="button" id="cfg-cerrar" class="cfg-fab" aria-label="Listo: guardar y cerrar la configuración" title="Listo: guardar y cerrar">
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
      </button>
    `;

    document.body.appendChild(cfgModal);

    // Las secciones abren COLAPSADAS: se despliega solo la que se necesita (clic, Enter o espacio).
    var legends = cfgModal.querySelectorAll('.cfg-legend');
    legends.forEach(function (legend) {
      var contenido = legend.nextElementSibling;
      var flecha = legend.querySelector('.cfg-arrow');
      legend.setAttribute('role', 'button');
      legend.setAttribute('tabindex', '0');
      function poner(abierta) {
        if (contenido) contenido.style.display = abierta ? '' : 'none';
        if (flecha) flecha.textContent = abierta ? '▼' : '▶';
        legend.setAttribute('aria-expanded', abierta ? 'true' : 'false');
      }
      poner(false);
      legend.addEventListener('click', function () { poner(legend.getAttribute('aria-expanded') !== 'true'); });
      legend.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); legend.click(); }
      });
    });

    var selectFuente = cfgModal.querySelector('#cfg-fuente-select');
    selectFuente.value = ajustesAventura.fuente;
    selectFuente.addEventListener('change', function () {
      ajustesAventura.fuente = this.value;
      lsSeguro.setItem('aventura_fuente', ajustesAventura.fuente);
      aplicarAjustesAventura();
    });

    var selectSizePregunta = cfgModal.querySelector('#cfg-size-pregunta');
    selectSizePregunta.value = ajustesAventura.sizePregunta;
    selectSizePregunta.addEventListener('change', function () {
      ajustesAventura.sizePregunta = this.value;
      lsSeguro.setItem('aventura_size_pregunta', ajustesAventura.sizePregunta);
      aplicarAjustesAventura();
    });

    var selectSizeOpciones = cfgModal.querySelector('#cfg-size-opciones');
    selectSizeOpciones.value = ajustesAventura.sizeOpciones;
    selectSizeOpciones.addEventListener('change', function () {
      ajustesAventura.sizeOpciones = this.value;
      lsSeguro.setItem('aventura_size_opciones', ajustesAventura.sizeOpciones);
      aplicarAjustesAventura();
    });

    var selectSizePowerups = cfgModal.querySelector('#cfg-size-powerups');
    selectSizePowerups.value = ajustesAventura.sizePowerups;
    selectSizePowerups.addEventListener('change', function () {
      ajustesAventura.sizePowerups = this.value;
      lsSeguro.setItem('aventura_size_powerups', ajustesAventura.sizePowerups);
      aplicarAjustesAventura();
    });

    var rangeMaxWidth = cfgModal.querySelector('#cfg-battle-max-width');
    var valMaxWidth = cfgModal.querySelector('#val-battle-max-width');
    var mockupContainer = cfgModal.querySelector('#mockup-container');
    rangeMaxWidth.addEventListener('input', function () {
      ajustesAventura.battleMaxWidth = this.value + '%';
      valMaxWidth.textContent = ajustesAventura.battleMaxWidth;
      lsSeguro.setItem('aventura_battle_max_width', ajustesAventura.battleMaxWidth);
      aplicarAjustesAventura();
      if (mockupContainer) mockupContainer.style.width = ajustesAventura.battleMaxWidth;
    });

    var rangeMinHeight = cfgModal.querySelector('#cfg-battle-min-height');
    var valMinHeight = cfgModal.querySelector('#val-battle-min-height');
    var mockupScreen = cfgModal.querySelector('#mockup-screen');
    rangeMinHeight.addEventListener('input', function () {
      ajustesAventura.battleMinHeight = this.value + 'px';
      valMinHeight.textContent = ajustesAventura.battleMinHeight;
      lsSeguro.setItem('aventura_battle_min_height', ajustesAventura.battleMinHeight);
      aplicarAjustesAventura();
      if (mockupScreen) mockupScreen.innerHTML = 'Escenario Batalla (Min-H: ' + ajustesAventura.battleMinHeight + ')';
    });

    var rangeSpriteSize = cfgModal.querySelector('#cfg-sprite-size');
    var valSpriteSize = cfgModal.querySelector('#val-sprite-size');
    rangeSpriteSize.addEventListener('input', function () {
      ajustesAventura.spriteSize = this.value + 'px';
      valSpriteSize.textContent = ajustesAventura.spriteSize;
      lsSeguro.setItem('aventura_sprite_size', ajustesAventura.spriteSize);
      aplicarAjustesAventura();
    });

    var rangeQWidth = cfgModal.querySelector('#cfg-q-width');
    var valQWidth = cfgModal.querySelector('#val-q-width');
    var mockupQuestion = cfgModal.querySelector('#mockup-question');
    rangeQWidth.addEventListener('input', function () {
      ajustesAventura.questionWidth = this.value + '%';
      valQWidth.textContent = ajustesAventura.questionWidth;
      lsSeguro.setItem('aventura_q_width', ajustesAventura.questionWidth);
      aplicarAjustesAventura();
      if (mockupQuestion) {
        mockupQuestion.style.width = ajustesAventura.questionWidth;
        mockupQuestion.innerHTML = 'Caja de Preguntas (' + ajustesAventura.questionWidth + ')';
      }
    });

    var rangeQHeight = cfgModal.querySelector('#cfg-q-min-height');
    var valQHeight = cfgModal.querySelector('#val-q-min-height');
    rangeQHeight.addEventListener('input', function () {
      ajustesAventura.questionMinHeight = this.value + 'px';
      valQHeight.textContent = ajustesAventura.questionMinHeight;
      lsSeguro.setItem('aventura_q_min_height', ajustesAventura.questionMinHeight);
      aplicarAjustesAventura();
    });

    var rangePWWidth = cfgModal.querySelector('#cfg-pw-width');
    var valPWWidth = cfgModal.querySelector('#val-pw-width');
    var mockupPowerups = cfgModal.querySelector('#mockup-powerups');
    rangePWWidth.addEventListener('input', function () {
      ajustesAventura.powerupsWidth = this.value + '%';
      valPWWidth.textContent = ajustesAventura.powerupsWidth;
      lsSeguro.setItem('aventura_pw_width', ajustesAventura.powerupsWidth);
      aplicarAjustesAventura();
      if (mockupPowerups) {
        mockupPowerups.style.width = ajustesAventura.powerupsWidth;
        mockupPowerups.innerHTML = 'Power-Ups / Inventario (' + ajustesAventura.powerupsWidth + ')';
      }
    });

    var rangePWHeight = cfgModal.querySelector('#cfg-pw-min-height');
    var valPWHeight = cfgModal.querySelector('#val-pw-min-height');
    rangePWHeight.addEventListener('input', function () {
      ajustesAventura.powerupsMinHeight = this.value + 'px';
      valPWHeight.textContent = ajustesAventura.powerupsMinHeight;
      lsSeguro.setItem('aventura_pw_min_height', ajustesAventura.powerupsMinHeight);
      aplicarAjustesAventura();
    });

    var chkDialogos = cfgModal.querySelector('#cfg-dialogos');
    chkDialogos.addEventListener('change', function () {
      ajustesAventura.dialogosOponente = this.checked ? 'on' : 'off';
      lsSeguro.setItem('aventura_dialogos', ajustesAventura.dialogosOponente);
    });

    var chkDanoTiempo = cfgModal.querySelector('#cfg-dano-tiempo');
    chkDanoTiempo.addEventListener('change', function () {
      ajustesAventura.danoTiempo = this.checked ? 'on' : 'off';
      lsSeguro.setItem('aventura_dano_tiempo', ajustesAventura.danoTiempo);
    });

    cfgModal.querySelector('#cfg-animaciones').addEventListener('change', function () {
      ajustesAventura.animaciones = this.checked ? 'on' : 'off';
      lsSeguro.setItem('aventura_animaciones', ajustesAventura.animaciones);
      document.documentElement.setAttribute('data-batalla-anim', ajustesAventura.animaciones);
    });

    cfgModal.querySelector('#cfg-numeros-grandes').addEventListener('change', function () {
      ajustesAventura.numerosGrandes = this.checked ? 'on' : 'off';
      lsSeguro.setItem('aventura_numeros_grandes', ajustesAventura.numerosGrandes);
    });

    var rangeDan = cfgModal.querySelector('#cfg-dan-porcentaje');
    var valDan = cfgModal.querySelector('#val-dan-porcentaje');
    rangeDan.addEventListener('input', function () {
      ajustesAventura.danPorcentaje = parseInt(this.value, 10);
      valDan.textContent = ajustesAventura.danPorcentaje + '%';
      lsSeguro.setItem('aventura_dan_porcentaje', ajustesAventura.danPorcentaje);
    });

    var rangePreg = cfgModal.querySelector('#cfg-num-preguntas');
    var valPreg = cfgModal.querySelector('#val-num-preguntas');
    rangePreg.addEventListener('input', function () {
      ajustesAventura.numPreguntas = parseInt(this.value, 10);
      valPreg.textContent = ajustesAventura.numPreguntas;
      lsSeguro.setItem('aventura_num_preguntas', ajustesAventura.numPreguntas);
    });

    var selDif = cfgModal.querySelector('#cfg-dificultad');
    selDif.addEventListener('change', function () {
      ajustesAventura.dificultad = this.value;
      lsSeguro.setItem('aventura_dificultad', this.value);
    });

    var btnLapiz = cfgModal.querySelector('#btn-editar-layout');
    if (btnLapiz) {
      btnLapiz.addEventListener('click', function () {
        cfgModal.close();
        // En la pantalla de preparación se edita la interfaz que esté elegida (RPG 01 o RPG 02).
        var elegida = document.querySelector('#vistas input[name="interfaz"]:checked');
        if (elegida) cambiarInterfaz(elegida.value);
        iniciarEditorLayout();
      });
    }

    cfgModal.querySelector('#cfg-cerrar').addEventListener('click', function () {
      cfgModal.close();
    });
  }

  function abrirConfigAventura() {
    if (!cfgModal) armarConfigAventura();
    aplicarAjustesAventura();
    if (!cfgModal.open) cfgModal.showModal();
  }

  /* -------------------------------------------------------------------------
     EDITOR DE LAYOUT DE LA BATALLA (lápiz del modal de configuración)
     Mover y redimensionar cada elemento de la escena con imanes (líneas guía).
     Se guarda en localStorage (aventura_layout_rpg01) como desplazamiento
     x/y y tamaño w/h en px por elemento. Disponible para RPG 01 y RPG 02.

     - Cada interfaz guarda su propio layout (aventura_layout_rpg01, aventura_layout_rpg02).
     - Se puede editar en cualquier pantalla, también en el celular. Como los px de una
       pantalla grande no sirven en una chica, cada interfaz guarda DOS layouts: el de
       pantalla ancha (720 px o más) y el de pantalla chica (clave con sufijo _movil). Se
       edita y se aplica el que corresponde al tamaño de la pantalla en ese momento.
     ------------------------------------------------------------------------- */
  var LAYOUT_INTERFACES = {
    rpg01: { contenedor: '.game-container-rpg1' },
    rpg02: { contenedor: '.rpg2-contenedor' },
    rpg03: { contenedor: '.rpg3-contenedor' }
  };
  var LAYOUT_ANCHO_MIN = 720;

  function pantallaAncha() { return window.innerWidth >= LAYOUT_ANCHO_MIN; }

  function interfazConLayout() {
    return LAYOUT_INTERFACES[estadoAventura.interfaz] ? estadoAventura.interfaz : null;
  }

  function claveLayout(iface) { return 'aventura_layout_' + iface + (pantallaAncha() ? '' : '_movil'); }
  var LAYOUT_NOMBRES = {
    'screen': 'Escenario (fondo)', 'hud-oponente': 'HUD oponente', 'sprite-oponente': 'Sprite oponente',
    'sprite-jugador': 'Sprite jugador', 'hud-jugador': 'HUD jugador', 'question': 'Pregunta',
    'answers': 'Respuestas', 'timer': 'Cronómetro', 'powerups': 'Power-Ups', 'hud-barra': 'Barra de vida y tiempo',
    'nombre-oponente': 'Nombre del rival', 'nombre-jugador': 'Nombre del jugador', 'versus': 'VS'
  };
  var LAYOUT_UMBRAL = 6;
  var LAYOUT_MIN = 30;
  var editorLayoutActivo = false;

  window.addEventListener('resize', function () {
    if (editorLayoutActivo) return;
    var iface = interfazConLayout();
    var r = document.getElementById('vistas');
    if (iface && r && r.querySelector(LAYOUT_INTERFACES[iface].contenedor)) aplicarLayout(r, cargarLayout(iface));
  });

  function cargarLayout(iface) {
    try {
      var o = JSON.parse(lsSeguro.getItem(claveLayout(iface)) || '{}');
      if (!o || typeof o !== 'object') return {};
      if (o['hud-rival']) { o['hud-oponente'] = o['hud-rival']; delete o['hud-rival']; }
      if (o['sprite-rival']) { o['sprite-oponente'] = o['sprite-rival']; delete o['sprite-rival']; }
      return o;
    } catch (e) { return {}; }
  }

  function clonarLayout(o) { return JSON.parse(JSON.stringify(o || {})); }

  /* Cada elemento guarda: x, y (desplazamiento), w, h (tamaño de la caja), s (ESCALA: lo agranda o achica todo,
     texto, botones y animaciones incluidos, sin cambiar la caja), z (capa: quien queda encima de quien) y m (modo de
     las respuestas: 'lista' o 'grid'). */
  function aplicarLayoutEl(el, l) {
    el.style.translate = '';
    el.style.width = '';
    el.style.height = '';
    el.style.minHeight = '';
    el.style.maxWidth = '';
    el.style.scale = '';
    el.style.transformOrigin = '';
    el.style.zIndex = '';
    if (el.hasAttribute('data-lay-pos')) { el.style.position = ''; el.removeAttribute('data-lay-pos'); }
    el.removeAttribute('data-modo');
    el.classList.remove('lay-sized');
    if (!l) return;
    if (l.s && l.s !== 1) { el.style.scale = String(l.s); el.style.transformOrigin = 'top left'; }
    if (typeof l.z === 'number') {
      if (window.getComputedStyle(el).position === 'static') { el.style.position = 'relative'; el.setAttribute('data-lay-pos', '1'); }
      el.style.zIndex = String(l.z);
    }
    if (l.m === 'lista' || l.m === 'grid') el.setAttribute('data-modo', l.m);
    if (l.x || l.y) el.style.translate = (l.x || 0) + 'px ' + (l.y || 0) + 'px';
    if (l.w) { el.style.width = l.w + 'px'; el.style.maxWidth = 'none'; }
    if (l.h) { el.style.height = l.h + 'px'; el.style.minHeight = l.h + 'px'; }
    if (l.w || l.h) el.classList.add('lay-sized');
  }

  function aplicarLayout(raiz, layout) {
    layout = layout || {};
    var els = raiz.querySelectorAll('[data-lay]');
    for (var i = 0; i < els.length; i++) {
      aplicarLayoutEl(els[i], layout[els[i].getAttribute('data-lay')]);
    }
  }

  /* =========================================================================
     APLICAR CONFIGURACIÓN DE TARJETA v2 EN LA AVENTURA
     -------------------------------------------------------------------------
     Si el perfil activo (tarjeta v2 importada o local) tiene `config`, se aplica:
     - animaciones_batalla, fuente_aventura/fuente_global, ajustes_aventura, layout
     ========================================================================= */
  function configTarjetaAventura() {
    // El perfil activo viene de la tarjeta importada o del local
    var perfil = estadoAventura.perfilTarjeta || estadoAventura.perfilLocal || {};
    return (perfil && perfil.config) ? perfil.config : {};
  }

  function aplicarConfigTarjetaAventura(wrapper) {
    var cfg = configTarjetaAventura();
    if (!cfg || !Object.keys(cfg).length) return;

    // Animaciones de batalla (sobrescribe el interruptor general)
    if (cfg.animaciones_batalla) {
      document.documentElement.setAttribute('data-batalla-anim', cfg.animaciones_batalla === 'off' ? 'off' : 'on');
    }

    // Fuente de la aventura/batalla
    if (cfg.fuente_global || cfg.fuente_aventura) {
      var fontMap = {
        'roboto-mono': '"Roboto Mono", ui-monospace, monospace',
        'nunito': '"Nunito", system-ui, sans-serif',
        'interfaz': 'var(--font)'
      };
      var fuente = cfg.fuente_aventura || cfg.fuente_global;
      var familia = fontMap[fuente] || fontMap['roboto-mono'];
      document.documentElement.style.setProperty('--aventura-font', familia);
      var vistasEl = document.getElementById('vistas');
      if (vistasEl) vistasEl.style.fontFamily = familia;
      if (wrapper) wrapper.style.fontFamily = familia;
    }

    // Ajustes de aventura (daño/tiempo, números grandes, diálogos, etc.)
    if (cfg.ajustes_aventura) {
      var av = cfg.ajustes_aventura;
      if (av.danoTiempo !== undefined) estadoAventura.danoTiempo = av.danoTiempo;
      if (av.numerosGrandes !== undefined) estadoAventura.numerosGrandes = av.numerosGrandes;
      if (av.dialogosOponente !== undefined) estadoAventura.dialogosOponente = av.dialogosOponente;
      if (av.animaciones !== undefined) {
        document.documentElement.setAttribute('data-batalla-anim', av.animaciones === 'off' ? 'off' : 'on');
      }
    }

    // Layout de la tarjeta v2 (se aplica DESPUÉS del layout local)
    var layoutKey = pantallaAncha() ? ('layout_' + estadoAventura.interfaz) : ('layout_' + estadoAventura.interfaz + '_movil');
    var layout = cfg[layoutKey];
    if (layout) {
      estadoAventura._layoutTarjeta = layout;
    } else {
      estadoAventura._layoutTarjeta = null;
    }
  }

  function aplicarLayoutTarjetaAventura(wrapper) {
    var layout = estadoAventura._layoutTarjeta;
    if (!layout || !wrapper) return;
    var els = wrapper.querySelectorAll('[data-lay]');
    for (var i = 0; i < els.length; i++) {
      aplicarLayoutEl(els[i], layout[els[i].getAttribute('data-lay')]);
    }
  }

  function inyectarEstilosLayout() {
    if (document.getElementById('lay-estilos')) return;
    var st = document.createElement('style');
    st.id = 'lay-estilos';
    st.textContent = [
      '.lay-sized.sprite-rpg1 img { width: 100% !important; height: 100% !important; }',
      '.lay-edit .game-container-rpg1 *, .lay-edit .rpg2-contenedor *, .lay-edit .rpg3-contenedor * { pointer-events: none !important; }',
      /* En pantalla tactil, un elemento sin seleccionar deja pasar el desplazamiento de la pagina (si no, los
         elementos grandes taparian toda la pantalla y no se podria bajar); el seleccionado se arrastra. */
      '.lay-edit .game-container-rpg1 [data-lay], .lay-edit .rpg2-contenedor [data-lay], .lay-edit .rpg3-contenedor [data-lay] { pointer-events: auto !important; cursor: move; touch-action: pan-x pan-y; user-select: none; outline: 2px dashed var(--accent); outline-offset: -2px; }',
      '.lay-edit [data-lay].lay-activo { touch-action: none !important; outline: 3px solid #ff2d95 !important; }',
      '#lay-overlay { --lay-h: 14px; }',
      '@media (pointer: coarse) { #lay-overlay { --lay-h: 30px; } #lay-toolbar button { min-height: 40px; } #lay-toolbar .lay-grip { padding: 6px 10px; } }',
      '#lay-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 99990; }',
      '#lay-overlay .lay-sel { position: fixed; border: 2px solid #ff2d95; box-sizing: border-box; display: none; }',
      '#lay-overlay .lay-h { position: absolute; width: var(--lay-h); height: var(--lay-h); background: #ff2d95; border: 2px solid #fff; border-radius: 3px; box-sizing: border-box; pointer-events: auto; touch-action: none; }',
      '.lay-h[data-dir="n"] { top: calc(var(--lay-h) / -2); left: calc(50% - var(--lay-h) / 2); cursor: ns-resize; }',
      '.lay-h[data-dir="s"] { bottom: calc(var(--lay-h) / -2); left: calc(50% - var(--lay-h) / 2); cursor: ns-resize; }',
      '.lay-h[data-dir="e"] { right: calc(var(--lay-h) / -2); top: calc(50% - var(--lay-h) / 2); cursor: ew-resize; }',
      '.lay-h[data-dir="w"] { left: calc(var(--lay-h) / -2); top: calc(50% - var(--lay-h) / 2); cursor: ew-resize; }',
      '.lay-h[data-dir="ne"] { top: calc(var(--lay-h) / -2); right: calc(var(--lay-h) / -2); cursor: nesw-resize; }',
      '.lay-h[data-dir="nw"] { top: calc(var(--lay-h) / -2); left: calc(var(--lay-h) / -2); cursor: nwse-resize; }',
      '.lay-h[data-dir="se"] { bottom: calc(var(--lay-h) / -2); right: calc(var(--lay-h) / -2); cursor: nwse-resize; }',
      '.lay-h[data-dir="sw"] { bottom: calc(var(--lay-h) / -2); left: calc(var(--lay-h) / -2); cursor: nesw-resize; }',
      /* El icono de ESCALAR: un circulo morado con flechas en diagonal, debajo del elemento seleccionado (arriba si queda
         pegado al borde inferior de la pantalla, y nunca bajo la barra del editor). Arrastrarlo agranda o achica todo el elemento; doble toque vuelve a 100 %. */
      '#lay-overlay .lay-esc { position: absolute; bottom: calc(var(--lay-h) * -2.7); left: calc(50% - var(--lay-h)); width: calc(var(--lay-h) * 2); height: calc(var(--lay-h) * 2); border-radius: 50%; background: #fff; color: #7b1fa2; border: 3px solid #7b1fa2; box-sizing: border-box; display: flex; align-items: center; justify-content: center; pointer-events: auto; touch-action: none; cursor: nwse-resize; }',
      '#lay-overlay .lay-sel.lay-sel--arriba .lay-esc { bottom: auto; top: calc(var(--lay-h) * -2.7); }',
      '#lay-overlay .lay-esc svg { width: 70%; height: 70%; }',
      '#lay-toolbar #lay-opciones { flex-basis: 100%; display: none; flex-wrap: wrap; align-items: center; gap: 6px; padding-top: 6px; border-top: 1px solid var(--borde); }',
      '#lay-toolbar #lay-opciones.lay-visible { display: flex; }',
      '#lay-toolbar #lay-opciones .lay-grupo { display: inline-flex; align-items: center; gap: 3px; }',
      '#lay-toolbar #lay-opciones [aria-pressed="true"] { background: var(--accent); color: var(--bg); }',
      '#lay-overlay .lay-guia { position: fixed; background: #ff2d95; pointer-events: none; }',
      '#lay-toolbar { position: fixed; top: 8px; left: 50%; transform: translateX(-50%); width: max-content; z-index: 99999; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; max-width: 96vw; padding: 6px 10px; background: var(--surface); color: var(--text); border: 3px solid var(--accent); border-radius: var(--radius); box-shadow: var(--sombra); font-size: 0.8rem; font-family: var(--aventura-font, sans-serif); }',
      '#lay-toolbar button { padding: 4px 10px; min-height: 0; height: auto; line-height: 1.2; font-size: 0.8rem; cursor: pointer; font-family: inherit; }',
      '#lay-toolbar .lay-grip { cursor: grab; touch-action: none; user-select: none; padding: 2px 6px; font-size: 1.1rem; line-height: 1; }',
      '#lay-toolbar.lay-min .lay-resto { display: none; }'
    ].join('\n');
    document.head.appendChild(st);
  }

  function iniciarEditorLayout() {
    if (editorLayoutActivo) return;
    var raiz = document.getElementById('vistas');
    if (!raiz) return;
    var iface = interfazConLayout();
    if (!iface) {
      alert('Elige un modelo de interfaz (RPG 01, 02 o 03) para editar su layout.');
      return;
    }
    var selContenedor = LAYOUT_INTERFACES[iface].contenedor;
    var layoutDeEsteTamano = claveLayout(iface);      // se guarda el de ESTE tamaño de pantalla
    var hayRpg01 = !!raiz.querySelector(selContenedor);   // (nombre viejo) hay una batalla en pantalla

    inyectarEstilosLayout();
    editorLayoutActivo = true;

    var esDemo = !hayRpg01;
    var guardados = null;
    var headerEl = document.querySelector('body > header');
    var headerDisplayPrevio = headerEl ? headerEl.style.display : '';

    if (hayRpg01) {
      if (estadoAventura.temporizador) clearInterval(estadoAventura.temporizador);
    } else {
      guardados = Array.prototype.slice.call(raiz.childNodes);
      raiz.innerHTML = '';
      if (headerEl) headerEl.style.display = 'none';
      var demoP = {
        enunciado: 'Escena de ejemplo: ¿Cuál es la capital de Francia?',
        opciones: [{ texto: 'París', correcta: true }, { texto: 'Roma' }, { texto: 'Madrid' }, { texto: 'Lisboa' }]
      };
      var demoWrap = document.createElement('div');
      demoWrap.className = 'aventura-batalla-wrap';
      demoWrap.style.cssText = 'width: max(var(--aventura-battle-max-width, 100%), min(100%, 340px)); max-width: 100%; margin: 0 auto;';
      demoWrap.innerHTML = iface === 'rpg02' ? renderInterfazRPG02(demoP) : iface === 'rpg03' ? renderInterfazRPG03(demoP) : renderInterfazRPG01(demoP);
      raiz.appendChild(demoWrap);
    }

    var escena = raiz.querySelector(selContenedor);
    var trabajo = clonarLayout(cargarLayout(iface));
    var seleccionado = null;
    var accion = null;
    var snapOn = true;

    aplicarLayout(raiz, trabajo);
    document.body.classList.add('lay-edit');

    /* ---------- Overlay (selección, tiradores y líneas guía) ---------- */
    var overlay = document.createElement('div');
    overlay.id = 'lay-overlay';
    var selBox = document.createElement('div');
    selBox.className = 'lay-sel';
    ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(function (d) {
      var h = document.createElement('div');
      h.className = 'lay-h';
      h.setAttribute('data-dir', d);
      selBox.appendChild(h);
    });
    var iconoEscala = document.createElement('div');
    iconoEscala.className = 'lay-esc';
    iconoEscala.setAttribute('title', 'Escalar: arrastra para agrandar o achicar todo el elemento (doble toque: 100 %)');
    iconoEscala.setAttribute('aria-label', 'Escalar el elemento seleccionado');
    iconoEscala.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 20h6v-2H6v-4H4zM20 4h-6v2h4v4h2z" fill="currentColor"/></svg>';
    selBox.appendChild(iconoEscala);
    overlay.appendChild(selBox);
    document.body.appendChild(overlay);

    /* ---------- Barra de herramientas ---------- */
    var barra = document.createElement('div');
    barra.id = 'lay-toolbar';
    barra.setAttribute('role', 'toolbar');
    barra.setAttribute('aria-label', 'Editor de layout de la batalla');
    barra.innerHTML =
      '<span class="lay-grip" id="lay-grip" title="Arrastra para mover esta barra">⠿</span>' +
      '<strong>✏️ Editando layout</strong>' +
      '<span id="lay-estado" class="lay-resto" style="color: var(--muted);">Toca un elemento para seleccionarlo</span>' +
      '<label class="lay-resto" style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" id="lay-snap" checked> Imanes</label>' +
      '<button type="button" class="boton" id="lay-save" style="background: var(--accent); color: var(--bg); font-weight: bold;">💾 Guardar</button>' +
      '<button type="button" class="boton lay-resto" id="lay-reset">↺ Restablecer</button>' +
      '<button type="button" class="boton lay-resto" id="lay-cancel">Cancelar</button>' +
      '<button type="button" class="boton" id="lay-min" aria-label="Minimizar la barra" title="Minimizar / expandir">▁</button>' +
      '<div id="lay-opciones" class="lay-resto" role="group" aria-label="Opciones del elemento seleccionado">' +
        '<span class="lay-grupo" role="group" aria-label="Capa"><span>Capa</span>' +
          '<button type="button" class="boton" data-capa="fondo" aria-label="Enviar al fondo" title="Al fondo">⏬</button>' +
          '<button type="button" class="boton" data-capa="-1" aria-label="Enviar atrás una capa" title="Atrás">⬇</button>' +
          '<button type="button" class="boton" data-capa="1" aria-label="Traer adelante una capa" title="Adelante">⬆</button>' +
          '<button type="button" class="boton" data-capa="frente" aria-label="Traer al frente" title="Al frente">⏫</button></span>' +
        '<span class="lay-grupo" role="group" aria-label="Escala"><span>Escala</span>' +
          '<button type="button" class="boton" id="lay-esc-menos" aria-label="Achicar 5 %">−</button>' +
          '<button type="button" class="boton" id="lay-esc-valor" title="Volver a 100 %" aria-label="Escala actual; pulsa para volver a 100 %">100 %</button>' +
          '<button type="button" class="boton" id="lay-esc-mas" aria-label="Agrandar 5 %">+</button></span>' +
        '<span class="lay-grupo" id="lay-grupo-modo" role="group" aria-label="Cómo se ven las respuestas" hidden><span>Respuestas</span>' +
          '<button type="button" class="boton" data-modo="lista" aria-pressed="false">☰ Lista</button>' +
          '<button type="button" class="boton" data-modo="grid" aria-pressed="false">▦ Cuadrícula 2×2</button></span>' +
      '</div>';
    document.body.appendChild(barra);

    var estadoEl = barra.querySelector('#lay-estado');

    function layOf(id) {
      if (!trabajo[id]) trabajo[id] = { x: 0, y: 0 };
      return trabajo[id];
    }

    var opcionesEl = barra.querySelector('#lay-opciones');
    var MODO_POR_DEFECTO = { rpg01: 'grid', rpg02: 'lista', rpg03: 'grid' };

    function actualizarOverlay() {
      if (!seleccionado) {
        selBox.style.display = 'none';
        opcionesEl.classList.remove('lay-visible');
        estadoEl.textContent = 'Toca un elemento para seleccionarlo';
        return;
      }
      var r = seleccionado.getBoundingClientRect();
      selBox.classList.toggle('lay-sel--arriba', r.bottom > window.innerHeight - 70);
      selBox.style.display = 'block';
      selBox.style.left = r.left + 'px';
      selBox.style.top = r.top + 'px';
      selBox.style.width = r.width + 'px';
      selBox.style.height = r.height + 'px';
      var id = seleccionado.getAttribute('data-lay');
      var l = trabajo[id] || { x: 0, y: 0 };
      estadoEl.textContent = (LAYOUT_NOMBRES[id] || id) + ' · x ' + Math.round(l.x || 0) + ', y ' + Math.round(l.y || 0) +
        ' · ' + Math.round(r.width) + '×' + Math.round(r.height) + ' · escala ' + Math.round((l.s || 1) * 100) + ' %';
      opcionesEl.classList.add('lay-visible');
      barra.querySelector('#lay-esc-valor').textContent = Math.round((l.s || 1) * 100) + ' %';
      var esRespuestas = id === 'answers';
      barra.querySelector('#lay-grupo-modo').hidden = !esRespuestas;
      if (esRespuestas) {
        var modoActual = l.m || MODO_POR_DEFECTO[iface];
        Array.prototype.forEach.call(barra.querySelectorAll('[data-modo]'), function (b) {
          b.setAttribute('aria-pressed', b.getAttribute('data-modo') === modoActual ? 'true' : 'false');
        });
      }
    }

    /* CAPAS: se ordenan todos los elementos por su capa actual (a igual capa, por su orden en la pagina), se mueve el
       seleccionado y se numeran de 1 en adelante. Asi el escenario puede quedar DETRAS de las barras de vida. */
    function capaEfectiva(el) {
      var z = parseInt(window.getComputedStyle(el).zIndex, 10);
      return isNaN(z) ? 0 : z;
    }

    function moverCapa(donde) {
      if (!seleccionado) return;
      var els = Array.prototype.slice.call(escena.querySelectorAll('[data-lay]'));
      var orden = els.map(function (el, i) { return { el: el, z: capaEfectiva(el), i: i }; })
        .sort(function (a, b) { return a.z - b.z || a.i - b.i; }).map(function (o) { return o.el; });
      var k = orden.indexOf(seleccionado);
      if (k < 0) return;
      orden.splice(k, 1);
      var destino = donde === 'frente' ? orden.length : donde === 'fondo' ? 0 : Math.max(0, Math.min(orden.length, k + donde));
      orden.splice(destino, 0, seleccionado);
      orden.forEach(function (el, i) {
        var lz = layOf(el.getAttribute('data-lay'));
        lz.z = i + 1;
        aplicarLayoutEl(el, lz);
      });
      actualizarOverlay();
    }

    /* ESCALA: de 50 % a 300 %, desde la esquina superior izquierda del elemento. */
    function ponerEscala(valor) {
      if (!seleccionado) return;
      var l = layOf(seleccionado.getAttribute('data-lay'));
      var s = Math.max(0.5, Math.min(3, Math.round(valor * 100) / 100));
      if (Math.abs(s - 1) < 0.015) delete l.s; else l.s = s;
      aplicarLayoutEl(seleccionado, l);
      actualizarOverlay();
    }

    function ponerModo(modo) {
      if (!seleccionado) return;
      var l = layOf(seleccionado.getAttribute('data-lay'));
      l.m = modo;
      aplicarLayoutEl(seleccionado, l);
      actualizarOverlay();
    }

    Array.prototype.forEach.call(barra.querySelectorAll('[data-capa]'), function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-capa');
        moverCapa(v === 'fondo' || v === 'frente' ? v : parseInt(v, 10));
      });
    });
    barra.querySelector('#lay-esc-menos').addEventListener('click', function () { if (seleccionado) ponerEscala((layOf(seleccionado.getAttribute('data-lay')).s || 1) - 0.05); });
    barra.querySelector('#lay-esc-mas').addEventListener('click', function () { if (seleccionado) ponerEscala((layOf(seleccionado.getAttribute('data-lay')).s || 1) + 0.05); });
    barra.querySelector('#lay-esc-valor').addEventListener('click', function () { ponerEscala(1); });
    Array.prototype.forEach.call(barra.querySelectorAll('[data-modo]'), function (b) {
      b.addEventListener('click', function () { ponerModo(b.getAttribute('data-modo')); });
    });

    function seleccionar(el) {
      var antes = escena.querySelectorAll('.lay-activo');
      for (var i = 0; i < antes.length; i++) antes[i].classList.remove('lay-activo');
      seleccionado = el;
      if (el) el.classList.add('lay-activo');
      actualizarOverlay();
    }

    function limpiarGuias() {
      var g = overlay.querySelectorAll('.lay-guia');
      for (var i = 0; i < g.length; i++) g[i].remove();
    }

    function dibujarGuias(lineasX, lineasY, rect) {
      limpiarGuias();
      lineasX.forEach(function (t) {
        var y1 = Math.min(rect.top, t.r ? t.r.top : 0);
        var y2 = Math.max(rect.bottom, t.r ? t.r.bottom : window.innerHeight);
        var d = document.createElement('div');
        d.className = 'lay-guia';
        d.style.cssText = 'left:' + t.v + 'px;top:' + y1 + 'px;width:1px;height:' + (y2 - y1) + 'px;';
        overlay.appendChild(d);
      });
      lineasY.forEach(function (t) {
        var x1 = Math.min(rect.left, t.r ? t.r.left : 0);
        var x2 = Math.max(rect.right, t.r ? t.r.right : window.innerWidth);
        var d = document.createElement('div');
        d.className = 'lay-guia';
        d.style.cssText = 'top:' + t.v + 'px;left:' + x1 + 'px;height:1px;width:' + (x2 - x1) + 'px;';
        overlay.appendChild(d);
      });
    }

    function calcularTargets(sel) {
      var xs = [], ys = [];
      function agregar(r) {
        xs.push({ v: r.left, r: r }, { v: r.left + r.width / 2, r: r }, { v: r.right, r: r });
        ys.push({ v: r.top, r: r }, { v: r.top + r.height / 2, r: r }, { v: r.bottom, r: r });
      }
      var els = escena.querySelectorAll('[data-lay]');
      for (var i = 0; i < els.length; i++) {
        if (els[i] === sel || sel.contains(els[i])) continue;
        agregar(els[i].getBoundingClientRect());
      }
      if (!sel.contains(escena)) agregar(escena.getBoundingClientRect());
      xs.push({ v: 0, r: null }, { v: window.innerWidth / 2, r: null }, { v: window.innerWidth, r: null });
      ys.push({ v: 0, r: null }, { v: window.innerHeight / 2, r: null }, { v: window.innerHeight, r: null });
      return { xs: xs, ys: ys };
    }

    function mejorIman(cands, targets) {
      var best = null;
      for (var i = 0; i < cands.length; i++) {
        for (var j = 0; j < targets.length; j++) {
          var d = targets[j].v - cands[i];
          if (Math.abs(d) <= LAYOUT_UMBRAL && (!best || Math.abs(d) < Math.abs(best))) best = d;
        }
      }
      return best;
    }

    function lineasCoincidentes(cands, targets) {
      var out = [];
      for (var i = 0; i < targets.length; i++) {
        for (var j = 0; j < cands.length; j++) {
          if (Math.abs(targets[i].v - cands[j]) < 0.5) { out.push(targets[i]); break; }
        }
      }
      return out;
    }

    function onPointerDown(e) {
      if (!editorLayoutActivo) return;
      if (e.target.closest && e.target.closest('#lay-toolbar, #lay-fab')) return;
      if (seleccionado && e.target.closest && e.target.closest('.lay-esc')) { iniciarEscala(e); return; }
      var h = e.target.closest ? e.target.closest('.lay-h') : null;
      if (h && seleccionado) {
        iniciarAccion(e, 'resize', h.getAttribute('data-dir'));
        return;
      }
      var el = e.target.closest ? e.target.closest('[data-lay]') : null;
      if (el && escena.contains(el)) {
        seleccionar(el);
        iniciarAccion(e, 'move', null);
      } else {
        seleccionar(null);
      }
    }

    var ultimoToqueEscala = 0;
    function iniciarEscala(e) {
      e.preventDefault();
      var ahora = Date.now();
      if (ahora - ultimoToqueEscala < 350) { ponerEscala(1); ultimoToqueEscala = 0; return; }      // doble toque: 100 %
      ultimoToqueEscala = ahora;
      var l = layOf(seleccionado.getAttribute('data-lay'));
      var r = seleccionado.getBoundingClientRect();
      accion = { tipo: 'scale', s0: l.s || 1, ox: r.left, oy: r.top, d0: Math.max(24, Math.hypot(e.clientX - r.left, e.clientY - r.top)) };
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
    }

    function iniciarAccion(e, tipo, dir) {
      e.preventDefault();
      var id = seleccionado.getAttribute('data-lay');
      var l = layOf(id);
      var r = seleccionado.getBoundingClientRect();
      accion = {
        tipo: tipo, dir: dir, x0: e.clientX, y0: e.clientY,
        rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
        l0: { x: l.x || 0, y: l.y || 0, w: l.w, h: l.h },
        targets: calcularTargets(seleccionado)
      };
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(e) {
      if (!accion || !seleccionado) return;
      var id = seleccionado.getAttribute('data-lay');
      var l = layOf(id);
      if (accion.tipo === 'scale') {                 // lo lejos que esta el puntero de la esquina del elemento
        ponerEscala(accion.s0 * Math.hypot(e.clientX - accion.ox, e.clientY - accion.oy) / accion.d0);
        return;
      }
      var dx = e.clientX - accion.x0;
      var dy = e.clientY - accion.y0;
      var r = accion.rect;
      var usarIman = snapOn && !e.altKey;
      var lx = [], ly = [], rf, objetivo = null;

      if (accion.tipo === 'move') {
        var nl = r.left + dx, nt = r.top + dy;
        if (usarIman) {
          var bx = mejorIman([nl, nl + r.width / 2, nl + r.width], accion.targets.xs);
          if (bx !== null) { dx += bx; nl += bx; }
          var by = mejorIman([nt, nt + r.height / 2, nt + r.height], accion.targets.ys);
          if (by !== null) { dy += by; nt += by; }
        }
        rf = { left: nl, top: nt, right: nl + r.width, bottom: nt + r.height };
        l.x = Math.round(accion.l0.x + dx);
        l.y = Math.round(accion.l0.y + dy);
        if (usarIman) {
          lx = lineasCoincidentes([rf.left, rf.left + r.width / 2, rf.right], accion.targets.xs);
          ly = lineasCoincidentes([rf.top, rf.top + r.height / 2, rf.bottom], accion.targets.ys);
        }
      } else {
        var L = r.left, T = r.top, R = r.right, B = r.bottom, d = accion.dir;
        if (d.indexOf('e') >= 0) R += dx;
        if (d.indexOf('w') >= 0) L += dx;
        if (d.indexOf('s') >= 0) B += dy;
        if (d.indexOf('n') >= 0) T += dy;
        if (usarIman) {
          var s;
          if (d.indexOf('e') >= 0 && (s = mejorIman([R], accion.targets.xs)) !== null) R += s;
          if (d.indexOf('w') >= 0 && (s = mejorIman([L], accion.targets.xs)) !== null) L += s;
          if (d.indexOf('s') >= 0 && (s = mejorIman([B], accion.targets.ys)) !== null) B += s;
          if (d.indexOf('n') >= 0 && (s = mejorIman([T], accion.targets.ys)) !== null) T += s;
        }
        if (R - L < LAYOUT_MIN) { if (d.indexOf('w') >= 0) L = R - LAYOUT_MIN; else R = L + LAYOUT_MIN; }
        if (B - T < LAYOUT_MIN) { if (d.indexOf('n') >= 0) T = B - LAYOUT_MIN; else B = T + LAYOUT_MIN; }
        var escL = l.s || 1;                            // el tamaño que se guarda es el de la caja SIN escalar
        l.x = Math.round(accion.l0.x + (L - r.left));
        l.y = Math.round(accion.l0.y + (T - r.top));
        if (d.indexOf('e') >= 0 || d.indexOf('w') >= 0) l.w = Math.round((R - L) / escL);
        if (d.indexOf('n') >= 0 || d.indexOf('s') >= 0) l.h = Math.round((B - T) / escL);
        rf = { left: L, top: T, right: R, bottom: B };
        objetivo = { L: L, T: T, R: R, B: B };
        if (usarIman) {
          var cx = [], cy = [];
          if (d.indexOf('e') >= 0) cx.push(R);
          if (d.indexOf('w') >= 0) cx.push(L);
          if (d.indexOf('s') >= 0) cy.push(B);
          if (d.indexOf('n') >= 0) cy.push(T);
          lx = lineasCoincidentes(cx, accion.targets.xs);
          ly = lineasCoincidentes(cy, accion.targets.ys);
        }
      }
      aplicarLayoutEl(seleccionado, l);
      if (objetivo) ajustarAlObjetivo(seleccionado, l, objetivo, accion.dir);
      actualizarOverlay();
      dibujarGuias(lx, ly, rf);
    }

    /* Al redimensionar, el lado contrario al que se arrastra se queda EXACTAMENTE donde estaba.
       No se puede calcular de antemano porque cada elemento esta anclado distinto (a su izquierda,
       a su derecha, centrado...) y cambiarle el ancho lo mueve de otra forma: por eso se aplica el
       tamaño, se MIDE donde quedo y se corrige el desplazamiento con lo medido. */
    function ajustarAlObjetivo(el, l, o, d) {
      var r = el.getBoundingClientRect();
      var cambioTamano = false;
      var anchoDeseado = o.R - o.L, altoDeseado = o.B - o.T;
      var escA = l.s || 1;
      if ((d.indexOf('e') >= 0 || d.indexOf('w') >= 0) && Math.abs(r.width - anchoDeseado) > 0.5) {
        l.w = Math.max(LAYOUT_MIN, Math.round((l.w || r.width / escA) + (anchoDeseado - r.width) / escA));     // relleno, borde o minimos del elemento
        cambioTamano = true;
      }
      if ((d.indexOf('n') >= 0 || d.indexOf('s') >= 0) && Math.abs(r.height - altoDeseado) > 0.5) {
        l.h = Math.max(LAYOUT_MIN, Math.round((l.h || r.height / escA) + (altoDeseado - r.height) / escA));
        cambioTamano = true;
      }
      if (cambioTamano) { aplicarLayoutEl(el, l); r = el.getBoundingClientRect(); }
      var tx = d.indexOf('w') >= 0 ? o.R - r.right : o.L - r.left;      // arrastras la izquierda: la derecha se queda
      var ty = d.indexOf('n') >= 0 ? o.B - r.bottom : o.T - r.top;      // arrastras arriba: abajo se queda
      if (Math.abs(tx) > 0.5 || Math.abs(ty) > 0.5) {
        l.x = Math.round((l.x || 0) + tx);
        l.y = Math.round((l.y || 0) + ty);
        aplicarLayoutEl(el, l);
      }
    }

    function onPointerUp() {
      accion = null;
      limpiarGuias();
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      actualizarOverlay();
    }

    function onKeyDown(e) {
      if (!editorLayoutActivo) return;
      if (e.key === 'Escape') { salir(false); return; }
      if (!seleccionado) return;
      var paso = e.shiftKey ? 10 : 1, dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -paso;
      else if (e.key === 'ArrowRight') dx = paso;
      else if (e.key === 'ArrowUp') dy = -paso;
      else if (e.key === 'ArrowDown') dy = paso;
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); ponerEscala((layOf(seleccionado.getAttribute('data-lay')).s || 1) + 0.05); return; }
      else if (e.key === '-') { e.preventDefault(); ponerEscala((layOf(seleccionado.getAttribute('data-lay')).s || 1) - 0.05); return; }
      else return;
      e.preventDefault();
      var l = layOf(seleccionado.getAttribute('data-lay'));
      l.x = (l.x || 0) + dx;
      l.y = (l.y || 0) + dy;
      aplicarLayoutEl(seleccionado, l);
      actualizarOverlay();
    }

    function onReflow() { actualizarOverlay(); }

    function salir(guardar) {
      if (!editorLayoutActivo) return;
      editorLayoutActivo = false;
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
      overlay.remove();
      barra.remove();
      document.body.classList.remove('lay-edit');

      if (guardar) {
        try {
          if (Object.keys(trabajo).length) lsSeguro.setItem(layoutDeEsteTamano, JSON.stringify(trabajo));
          else lsSeguro.removeItem(layoutDeEsteTamano);
        } catch (err) { /* sin almacenamiento disponible */ }
      }

      if (esDemo) {
        raiz.innerHTML = '';
        guardados.forEach(function (n) { raiz.appendChild(n); });
        if (headerEl) headerEl.style.display = headerDisplayPrevio;
      } else {
        renderBatalla(raiz);
      }
    }

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);

    var grip = barra.querySelector('#lay-grip');
    var arrastreBarra = null;
    grip.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var r = barra.getBoundingClientRect();
      barra.style.transform = 'none';
      barra.style.left = r.left + 'px';
      barra.style.top = r.top + 'px';
      arrastreBarra = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener('pointermove', function (e) {
      if (!arrastreBarra) return;
      var w = barra.offsetWidth, h = barra.offsetHeight;
      var x = Math.max(0, Math.min(window.innerWidth - w, e.clientX - arrastreBarra.dx));
      var y = Math.max(0, Math.min(window.innerHeight - h, e.clientY - arrastreBarra.dy));
      barra.style.left = x + 'px';
      barra.style.top = y + 'px';
    });
    grip.addEventListener('pointerup', function () { arrastreBarra = null; });
    grip.addEventListener('pointercancel', function () { arrastreBarra = null; });
    barra.querySelector('#lay-min').addEventListener('click', function () {
      barra.classList.toggle('lay-min');
    });

    barra.querySelector('#lay-snap').addEventListener('change', function () { snapOn = this.checked; });
    barra.querySelector('#lay-reset').addEventListener('click', function () {
      trabajo = {};
      aplicarLayout(raiz, trabajo);
      actualizarOverlay();
    });
    barra.querySelector('#lay-cancel').addEventListener('click', function () { salir(false); });
    barra.querySelector('#lay-save').addEventListener('click', function () { salir(true); });
  }

  /* -------------------------------------------------------------------------
     1. PANTALLA DE CONFIGURACIÓN PREVIA (Avatar, Interfaz y Power-Ups)
     ------------------------------------------------------------------------- */
  function renderConfiguracion(contenedor) {
    contenedor.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-md); width: 95%; max-width: 75%; margin: 0 auto; text-align: left;';
    // Responsive: 95% móvil, 85% tablet, 75% desktop
    var style = document.createElement('style');
    style.textContent = '@media (min-width: 600px) { .config-wrapper { width: 85%; max-width: 85%; } } @media (min-width: 1024px) { .config-wrapper { width: 75%; max-width: 75%; } }';
    document.head.appendChild(style);
    wrapper.className = 'config-wrapper';

    wrapper.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 50px; margin-bottom: var(--space-xs);">⚔️🛡️✨</div>
        <h2>Preparación de Aventura</h2>
        <p style="color: var(--muted);">Configura tu personaje y tu estrategia antes de pisar el mapa.</p>
      </div>

      <fieldset style="min-width: 0; border: 2px solid var(--borde-fuerte); border-radius: var(--radius); padding: var(--space-md); background: var(--surface);">
        <legend style="font-weight: bold; padding: 0 var(--space-xs); color: var(--accent);">1. Elige tu Avatar</legend>
        
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; justify-content: center; align-items: center;" id="filtro-genero-container">
          <span style="font-size: 0.85em; font-weight: bold;">Filtrar:</span>
          <button type="button" class="boton boton--chico filtro-genero-btn active" data-genero="todos" style="cursor: pointer; padding: 4px 10px; font-size: 0.8em; background: var(--accent); color: var(--bg);">Todos</button>
          <button type="button" class="boton boton--chico filtro-genero-btn" data-genero="hombre" style="cursor: pointer; padding: 4px 10px; font-size: 0.8em;">Hombre</button>
          <button type="button" class="boton boton--chico filtro-genero-btn" data-genero="mujer" style="cursor: pointer; padding: 4px 10px; font-size: 0.8em;">Mujer</button>
          <button type="button" id="btn-incognito" class="boton boton--chico" aria-pressed="false" style="cursor: pointer; padding: 4px 10px; font-size: 0.8em;">❓ Incógnito</button>
        </div>
        <p id="incognito-ayuda" class="ayuda" role="status" style="margin: 0 0 8px; text-align: center; font-size: 0.85em; color: var(--muted);"></p>

        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; position: relative; margin: 10px 0; min-width: 0;">
          <button type="button" id="carrusel-prev" class="carrusel-btn" aria-label="Personaje anterior" style="position: absolute; left: -6px; top: 50%; transform: translateY(-50%); z-index: 3; width: 44px; height: 44px; display: flex !important; align-items: center; justify-content: center;">‹</button>
          <div id="carrusel-3items-viewport" style="display: flex; gap: 8px; align-items: center; justify-content: center; overflow: hidden; width: 100%; min-width: 0; padding: 14px 0; touch-action: pan-y; user-select: none; cursor: grab;">
            <!-- Renderizado de 3 tarjetas -->
          </div>
          <button type="button" id="carrusel-next" class="carrusel-btn" aria-label="Personaje siguiente" style="position: absolute; right: -6px; top: 50%; transform: translateY(-50%); z-index: 3; width: 44px; height: 44px; display: flex !important; align-items: center; justify-content: center;">›</button>
        </div>
      </fieldset>

      <fieldset style="min-width: 0; border: 2px solid var(--borde-fuerte); border-radius: var(--radius); padding: var(--space-md); background: var(--surface);">
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

      <fieldset style="min-width: 0; border: 2px solid var(--borde-fuerte); border-radius: var(--radius); padding: var(--space-md); background: var(--surface);">
        <legend style="font-weight: bold; padding: 0 var(--space-xs); color: var(--accent);">3. Tu equipo de Power-Ups</legend>
        <p style="font-size: 0.9em; color: var(--muted); margin-bottom: var(--space-sm);">Los power ups se ganan acertando en estas batallas y en los tests (cada 10 aciertos; máximo 10 al día). Usarlos gasta una copia, así que vale la pena practicar.</p>
        <p id="resumen-equipo" role="status" style="margin: 0 0 var(--space-sm);">Cargando tu equipo…</p>
        <a href="equipo.html" class="boton boton--chico" style="padding: var(--space-xs) var(--space-md);">🎒 Inventario y equipo</a>
      </fieldset>

      <button type="button" class="panel-opcion boton" id="btn-ir-mapa" style="padding: var(--space-md); font-weight: bold; font-size: 1.1em; cursor: pointer; background: var(--accent); color: var(--bg); border-radius: var(--radius); text-align: center;">
        ⚔️ Seleccionar Test y Combatir
      </button>
    `;

    contenedor.appendChild(wrapper);

    var avataresBase = AVATARES_BASE;

    var filtroActual = lsSeguro.getItem('aventura_filtro_genero') || 'todos';
    var avataresFiltrados = avataresBase;
    estadoAventura.incognito = lsSeguro.getItem('aventura_incognito') === 'on';
    var imagenIncognito = null;                    // imagenes/incognito/: si hay una imagen se usa; si no, un «?» grande
    fetch('/datos/incognito.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (d) {
      imagenIncognito = d.imagen || null;
      actualizarCarrusel();
    }).catch(function () {});

    var currentIndex = avataresBase.findIndex(function(a) { return a.id === estadoAventura.avatar; });
    if (currentIndex === -1) currentIndex = 0;

    var viewport = wrapper.querySelector('#carrusel-3items-viewport');
    var btnIncognito = wrapper.querySelector('#btn-incognito');
    var ayudaIncognito = wrapper.querySelector('#incognito-ayuda');

    function listaFiltrada() {
      var l = avataresBase.filter(function (av) { return filtroActual === 'todos' || av.genero === filtroActual; });
      return l.length ? l : avataresBase;
    }

    /* Con el modo incógnito el carrusel solo muestra un «?»: al empezar la batalla el sistema elige al azar
       uno de los personajes del filtro (6 hombres, 6 mujeres o los 12) y se descubre en ese momento. */
    function pintarIncognito() {
      var n = listaFiltrada().length;
      var nombreFiltro = filtroActual === 'hombre' ? 'los ' + n + ' hombres' : filtroActual === 'mujer' ? 'las ' + n + ' mujeres' : 'los ' + n + ' personajes';
      ayudaIncognito.textContent = 'Incógnito: se elegirá al azar entre ' + nombreFiltro + ' y lo descubrirás al empezar la batalla.';
      viewport.innerHTML = '';
      var card = document.createElement('div');
      card.style.cssText = 'flex: 0 1 220px; min-width: 0; text-align: center; background: var(--surface); border: 3px solid var(--accent); border-radius: var(--radius); padding: 12px; box-shadow: var(--sombra);';
      card.innerHTML = imagenIncognito
        ? '<img src="' + imagenIncognito + '" alt="Personaje incógnito" style="width: 100%; max-width: 75px; height: 75px; object-fit: contain;">'
        : '<div aria-hidden="true" style="font-size: clamp(2.5rem, 11vw, 4rem); line-height: 1; font-weight: 800; color: var(--accent);">?</div>';
      var et = document.createElement('div');
      et.style.cssText = 'font-size: 1.05em; font-weight: bold; color: var(--text); margin-top: 4px;';
      et.textContent = 'Incógnito';
      card.appendChild(et);
      viewport.appendChild(card);
    }

    function actualizarCarrusel() {
      avataresFiltrados = listaFiltrada();
      btnIncognito.setAttribute('aria-pressed', estadoAventura.incognito ? 'true' : 'false');
      btnIncognito.style.background = estadoAventura.incognito ? 'var(--accent)' : 'var(--surface)';
      btnIncognito.style.color = estadoAventura.incognito ? 'var(--bg)' : 'var(--text)';
      wrapper.querySelector('#carrusel-prev').disabled = wrapper.querySelector('#carrusel-next').disabled = estadoAventura.incognito;
      if (estadoAventura.incognito) { pintarIncognito(); return; }
      ayudaIncognito.textContent = '';

      if (currentIndex >= avataresFiltrados.length) currentIndex = 0;
      var currentAv = avataresFiltrados[currentIndex] || avataresFiltrados[0];
      estadoAventura.avatar = currentAv.id;

      viewport.innerHTML = '';
      var len = avataresFiltrados.length;
      var esMovil = viewport.clientWidth < 600;
      var radio = esMovil ? 1 : 2;  // 1 = 3 tarjetas (centro + 1 cada lado), 2 = 5 tarjetas (centro + 2 cada lado)
      var indices = [];
      for (var i = -radio; i <= radio; i++) {
        indices.push((currentIndex + i + len) % len);
      }

      indices.forEach(function (idx, pos) {
        var av = avataresFiltrados[idx];
        var isCenter = (pos === radio);
        var isSide = !esMovil && (pos === radio - 1 || pos === radio + 1);
        var card = document.createElement('div');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', av.nombre + (isCenter ? ' (elegido)' : ''));
        // En móvil: 3 tarjetas (centro 50%, lados 25%). En desktop: 5 tarjetas (centro 32%, lados 19%, extremos 12%).
        var flex, scale, opacity, borderWidth, shadow, imgMax, fontSize;
        if (esMovil) {
          flex = isCenter ? '50%' : '25%';
          scale = isCenter ? '1' : '0.9';
          opacity = isCenter ? '1' : '0.75';
          borderWidth = isCenter ? '4px' : '2px';
          shadow = isCenter ? 'var(--sombra)' : 'none';
          imgMax = isCenter ? '100px' : '65px';
          fontSize = isCenter ? '1em' : '0.85em';
        } else {
          flex = isCenter ? '32%' : isSide ? '19%' : '12%';
          scale = isCenter ? '1' : isSide ? '0.9' : '0.8';
          opacity = isCenter ? '1' : isSide ? '0.85' : '0.65';
          borderWidth = isCenter ? '4px' : isSide ? '3px' : '2px';
          shadow = isCenter ? 'var(--sombra)' : isSide ? '0 2px 8px rgba(0,0,0,0.1)' : 'none';
          imgMax = isCenter ? '95px' : isSide ? '70px' : '50px';
          fontSize = isCenter ? '1em' : isSide ? '0.9em' : '0.75em';
        }
        card.style.cssText = 'flex: 0 0 ' + flex + '; min-width: 0; ' +
          'transform: scale(' + scale + '); ' +
          'opacity: ' + opacity + '; ' +
          'transition: all 0.3s ease; text-align: center; cursor: pointer; background: var(--surface); ' +
          'border: ' + borderWidth + ' solid ' + (isCenter ? 'var(--accent)' : 'var(--borde-fuerte)') + '; ' +
          'border-radius: var(--radius); padding: 10px; ' +
          'box-shadow: ' + shadow + ';';
        card.innerHTML = `
          <img src="../../../imagenes/${av.archivo}" alt="" draggable="false" style="width: 100%; max-width: ${imgMax}; aspect-ratio: 1; object-fit: contain; margin: 0 auto 6px; display: block; pointer-events: none;">
          <div style="font-size: ${fontSize}; font-weight: bold; color: var(--text); overflow-wrap: break-word; hyphens: none;">${av.nombre}</div>
        `;
        card.addEventListener('click', function () {
          currentIndex = idx;
          estadoAventura.avatar = av.id;
          actualizarCarrusel();
        });
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
        });
        viewport.appendChild(card);
      });
    }

    function moverCarrusel(pasos) {
      if (estadoAventura.incognito || !pasos) return;
      var len = avataresFiltrados.length;
      currentIndex = ((currentIndex + pasos) % len + len) % len;
      actualizarCarrusel();
    }

    // Re-render carrusel al cambiar tamaño de pantalla (móvil <-> desktop)
    window.addEventListener('resize', function () {
      var vp = document.getElementById('carrusel-3items-viewport');
      if (vp && vp.children.length > 0) actualizarCarrusel();
    });

    actualizarCarrusel();

    // Swipe simple: detecta arrastre horizontal y llama a moverCarrusel(-1/1)
    var swipe = { activo: false, x0: 0, dx: 0, id: null, umbral: 50 };
    viewport.addEventListener('pointerdown', function (e) {
      if (estadoAventura.incognito || (e.pointerType === 'mouse' && e.button !== 0)) return;
      swipe = { activo: true, x0: e.clientX, dx: 0, id: e.pointerId, umbral: 50 };
      try { viewport.setPointerCapture(e.pointerId); } catch (err) {}
    });
    viewport.addEventListener('pointermove', function (e) {
      if (!swipe.activo || e.pointerId !== swipe.id) return;
      swipe.dx = e.clientX - swipe.x0;
      // Feedback visual ligero: mover viewport ligeramente
      viewport.style.transform = 'translateX(' + Math.max(-40, Math.min(40, swipe.dx * 0.15)) + 'px)';
    });
    function finSwipe(e) {
      if (!swipe.activo || (e && e.pointerId !== swipe.id)) return;
      var dir = swipe.dx < -swipe.umbral ? 1 : swipe.dx > swipe.umbral ? -1 : 0;
      swipe.activo = false;
      viewport.style.transform = '';
      viewport.style.transition = 'transform 0.2s ease';
      setTimeout(function () { viewport.style.transition = ''; }, 220);
      if (dir !== 0) moverCarrusel(dir);
    }
    viewport.addEventListener('pointerup', finSwipe);
    viewport.addEventListener('pointercancel', finSwipe);
    viewport.addEventListener('pointerleave', function (e) {
      if (swipe.activo && e.pointerId === swipe.id) finSwipe(e);
    });

    wrapper.querySelector('#carrusel-prev').addEventListener('click', function () { moverCarrusel(-1); });
    wrapper.querySelector('#carrusel-next').addEventListener('click', function () { moverCarrusel(1); });

    var botonesFiltro = wrapper.querySelectorAll('.filtro-genero-btn');
    function marcarFiltros() {
      botonesFiltro.forEach(function (b) {
        var on = b.getAttribute('data-genero') === filtroActual;
        b.style.background = on ? 'var(--accent)' : 'var(--surface)';
        b.style.color = on ? 'var(--bg)' : 'var(--text)';
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    botonesFiltro.forEach(function (btnF) {
      btnF.addEventListener('click', function () {
        filtroActual = this.getAttribute('data-genero');
        lsSeguro.setItem('aventura_filtro_genero', filtroActual);
        currentIndex = 0;
        marcarFiltros();
        actualizarCarrusel();
      });
    });
    marcarFiltros();
    // El modelo de interfaz elegido decide QUE configuracion de apariencia se ve y se edita.
    var radioModelo = wrapper.querySelector('input[name="interfaz"][value="' + estadoAventura.interfaz + '"]');
    if (radioModelo) radioModelo.checked = true;
    wrapper.querySelectorAll('input[name="interfaz"]').forEach(function (r) {
      r.addEventListener('change', function () { if (r.checked) cambiarInterfaz(r.value); });
    });
    btnIncognito.addEventListener('click', function () {
      estadoAventura.incognito = !estadoAventura.incognito;
      lsSeguro.setItem('aventura_incognito', estadoAventura.incognito ? 'on' : 'off');
      actualizarCarrusel();
    });

    if (window.RetoRpg) {
      Promise.all([window.RetoRpg.catalogo(), window.RetoRpg.equipo(), window.RetoRpg.inventario(), window.RetoRpg.aciertos()]).then(function (r) {
        var cat = r[0], eq = r[1], inv = r[2], aci = r[3];
        estadoAventura.textosPU = cat.textos;
        estadoAventura.catalogoPU = cat;
        var el = wrapper.querySelector('#resumen-equipo');
        if (!el) return;
        var nombres = eq.map(function (id) { return cat.textos[id] ? cat.textos[id].nombre : id; });
        el.textContent = (nombres.length ? 'Llevas: ' + nombres.join(', ') + '. ' : 'No llevas ningún power up. ') +
          'En tu inventario hay ' + inv.length + ' de ' + window.RetoRpg.INVENTARIO_MAX + '. Aciertos acumulados: ' + aci + '.';
      });
    }

    var btn = wrapper.querySelector('#btn-ir-mapa');
    btn.addEventListener('click', function () {
      var infEl = wrapper.querySelector('input[name="interfaz"]:checked');
      if (infEl) cambiarInterfaz(infEl.value);
      

      renderSeleccionTest(contenedor);
    });
  }

/* -------------------------------------------------------------------------
      2. SELECCIÓN DE TEST PARA LA BATALLA RPG
      ------------------------------------------------------------------------- */
  // Alias para compatibilidad
  var Banco = window.RetoTestsBanco;

function renderSeleccionTest(contenedor) {
    contenedor.innerHTML = '<p style="text-align: center; padding: var(--space-lg);">Cargando tests disponibles...</p>';

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
      wrapper.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-md); width: 95%; max-width: 75%; margin: 0 auto;';
      // Responsive: 95% móvil, 85% tablet, 75% desktop
      var style = document.createElement('style');
      style.textContent = '@media (min-width: 600px) { .test-select-wrapper { width: 85%; max-width: 85%; } } @media (min-width: 1024px) { .test-select-wrapper { width: 75%; max-width: 75%; } }';
      document.head.appendChild(style);
      wrapper.className = 'test-select-wrapper';

      wrapper.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; align-items: center; background: var(--surface); padding: var(--space-sm) var(--space-md); border: 2px solid var(--borde-fuerte); border-radius: var(--radius);">
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

        <!-- Barra de herramientas: búsqueda, vista, tamaño -->
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-sm); align-items: center; background: var(--surface); padding: var(--space-sm) var(--space-md); border: 2px solid var(--borde-fuerte); border-radius: var(--radius);">
          <div style="flex: 1; min-width: 200px; position: relative;">
            <svg viewBox="0 0 24 24" width="20" height="20" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none;" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input type="search" id="buscar-tests" placeholder="Buscar test por título..." style="width: 100%; padding: 8px 12px 8px 40px; border: 2px solid var(--borde); border-radius: var(--radius); background: var(--bg); color: var(--text); font-family: inherit; font-size: 0.9em;">
          </div>
          <div style="display: flex; gap: 4px; background: var(--bg); padding: 4px; border-radius: var(--radius);">
            <button type="button" id="vista-lista" class="vista-btn" aria-label="Vista lista" aria-pressed="true" style="padding: 8px 12px; background: var(--accent); color: var(--bg); border: none; border-radius: var(--radius); cursor: pointer;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <button type="button" id="vista-cuadricula" class="vista-btn" aria-label="Vista cuadrícula" aria-pressed="false" style="padding: 8px 12px; background: transparent; color: var(--text); border: none; border-radius: var(--radius); cursor: pointer;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin-left: auto;">
            <span style="font-size: 0.8em; color: var(--muted);">Tamaño:</span>
            <input type="range" id="slider-tamano" min="0.8" max="1.5" step="0.05" value="1" style="width: 120px; cursor: pointer;">
            <span id="valor-tamano" style="font-size: 0.8em; color: var(--accent); font-weight: bold; min-width: 3ch;">100%</span>
          </div>
        </div>

        <div id="lista-tests-aventura" style="display: flex; flex-direction: column; gap: var(--space-sm);"></div>
      `;

      contenedor.appendChild(wrapper);

      wrapper.querySelector('#btn-volver-config').addEventListener('click', function () {
        renderConfiguracion(contenedor);
      });

      var listaEl = wrapper.querySelector('#lista-tests-aventura');
      var buscador = wrapper.querySelector('#buscar-tests');
      var btnLista = wrapper.querySelector('#vista-lista');
      var btnCuadricula = wrapper.querySelector('#vista-cuadricula');
      var sliderTamano = wrapper.querySelector('#slider-tamano');
      var valorTamano = wrapper.querySelector('#valor-tamano');
      var modoVista = 'lista'; // 'lista' | 'cuadricula'
      var tamanoActual = 1; // factor 0.8 - 1.5

      // Aplicar variables CSS al contenedor para layout real
      function aplicarTamano(factor) {
        var p = Math.max(0.8, Math.min(1.5, factor));
        // Variables que usan las tarjetas y el contenedor
        listaEl.style.setProperty('--card-padding', (12 * p) + 'px');
        listaEl.style.setProperty('--card-gap', (8 * p) + 'px');
        listaEl.style.setProperty('--card-font-title', (1.1 * p) + 'em');
        listaEl.style.setProperty('--card-font-sub', (0.9 * p) + 'em');
        listaEl.style.setProperty('--card-min-height', Math.round(100 * p) + 'px');
        // Grid: minmax responsive al factor
        if (modoVista === 'cuadricula') {
          var minW = Math.round(280 * p);
          listaEl.style.gridTemplateColumns = 'repeat(auto-fill, minmax(' + minW + 'px, 1fr))';
          listaEl.style.gap = (8 * p) + 'px';
        } else {
          listaEl.style.gap = (8 * p) + 'px';
        }
        valorTamano.textContent = Math.round(p * 100) + '%';
      }

      function filtrarYRenderizar() {
        var termino = (buscador.value || '').toLowerCase().trim();
        var filtrados = tests.filter(function (test) {
          return !termino || (test.titulo || '').toLowerCase().includes(termino);
        });
        renderizarLista(filtrados);
      }

      function renderizarLista(lista) {
        listaEl.innerHTML = '';
        if (lista.length === 0) {
          listaEl.innerHTML = '<p style="text-align: center; color: var(--muted); padding: var(--space-lg);">No hay tests que coincidan con la búsqueda.</p>';
          return;
        }
        if (modoVista === 'cuadricula') {
          listaEl.style.display = 'grid';
          var minW = Math.round(280 * tamanoActual);
          listaEl.style.gridTemplateColumns = 'repeat(auto-fill, minmax(' + minW + 'px, 1fr))';
          listaEl.style.flexDirection = 'row';
          listaEl.style.flexWrap = 'wrap';
          listaEl.style.gap = (8 * tamanoActual) + 'px';
        } else {
          listaEl.style.display = 'flex';
          listaEl.style.flexDirection = 'column';
          listaEl.style.gridTemplateColumns = 'none';
          listaEl.style.gap = (8 * tamanoActual) + 'px';
        }
        lista.forEach(function (test) {
          var card = document.createElement('button');
          card.type = 'button';
          card.className = 'boton test-card';
          // Usar variables CSS para layout real (no transform)
          card.style.cssText = 'display: flex; flex-direction: column; align-items: flex-start; gap: var(--card-gap, 8px); padding: var(--card-padding, 12px); text-align: left; cursor: pointer; background: var(--surface); border: 2px solid var(--borde-fuerte); color: var(--text); border-radius: var(--radius); transition: box-shadow 0.15s ease, border-color 0.15s ease; min-height: var(--card-min-height, 100px);';
          card.innerHTML = `
            <strong style="font-size: var(--card-font-title, 1.1em); color: var(--accent);">👾 ${test.titulo || 'Test sin título'}</strong>
            <span style="font-size: var(--card-font-sub, 0.9em); color: var(--muted);">${(test.preguntas || []).length} preguntas disponibles</span>
          `;
          card.addEventListener('click', function () {
            seleccionarTestYCombate(test, contenedor);
          });
          card.addEventListener('mouseenter', function () {
            card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
            card.style.borderColor = 'var(--accent)';
          });
          card.addEventListener('mouseleave', function () {
            card.style.boxShadow = 'none';
            card.style.borderColor = 'var(--borde-fuerte)';
          });
          listaEl.appendChild(card);
        });
      }

      buscador.addEventListener('input', filtrarYRenderizar);

      btnLista.addEventListener('click', function () {
        if (modoVista === 'lista') return;
        modoVista = 'lista';
        btnLista.style.background = 'var(--accent)';
        btnLista.style.color = 'var(--bg)';
        btnLista.setAttribute('aria-pressed', 'true');
        btnCuadricula.style.background = 'transparent';
        btnCuadricula.style.color = 'var(--text)';
        btnCuadricula.setAttribute('aria-pressed', 'false');
        filtrarYRenderizar();
      });

      btnCuadricula.addEventListener('click', function () {
        if (modoVista === 'cuadricula') return;
        modoVista = 'cuadricula';
        btnCuadricula.style.background = 'var(--accent)';
        btnCuadricula.style.color = 'var(--bg)';
        btnCuadricula.setAttribute('aria-pressed', 'true');
        btnLista.style.background = 'transparent';
        btnLista.style.color = 'var(--text)';
        btnLista.setAttribute('aria-pressed', 'false');
        filtrarYRenderizar();
      });

      sliderTamano.addEventListener('input', function () {
        tamanoActual = parseFloat(this.value);
        aplicarTamano(tamanoActual);
      });

      // Render inicial
      aplicarTamano(1);
      filtrarYRenderizar();

    }).catch(function (err) {
      contenedor.innerHTML = '<p style="text-align: center; color: var(--aviso);">Error al cargar tests: ' + err.message + '</p>';
    });
  }

  function seleccionarTestYCombate(test, contenedor) {
    estadoAventura.fondo = undefined;           // cada batalla elige su propio fondo al azar
    
    contenedor.style.transition = 'opacity 0.4s ease';
    contenedor.style.opacity = '0';

    setTimeout(function () {
      try {
        var candidatas = test.preguntas || [];
        // Barajar el orden de las preguntas candidatas antes de armar el mazo
        var candidatasBarajadas = Instancia ? Instancia.barajar(candidatas) : candidatas;
        var mazo = Instancia ? Instancia.armarMazo(candidatasBarajadas, ajustesAventura.numPreguntas, { evaluador: Eval }) : candidatasBarajadas;
        
        if (!mazo || mazo.length === 0) {
          alert('Este test no tiene preguntas jugables.');
          contenedor.style.opacity = '1';
          return;
        }

        // Asegurar exactamente 1 correcta y hasta 3 distractores (4 opciones en total), barajadas al azar usando Instancia.barajar
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
            // Barajar distractores usando el motor oficial y tomar máximo 3
            var distractoresBarajados = Instancia ? Instancia.barajar(distractores) : distractores;
            distractoresBarajados = distractoresBarajados.slice(0, 3);
            var seleccionadas = [correcta].concat(distractoresBarajados);
            q.opciones = Instancia ? Instancia.barajar(seleccionadas) : seleccionadas;
          }
        });

        estadoAventura.testSeleccionado = test;
        estadoAventura.preguntas = mazo;
        estadoAventura.indicePregunta = 0;
        estadoAventura.procesado = null;
        if (estadoAventura.incognito) {              // modo incógnito: el sistema elige entre los del filtro y se descubre ahora
          var filtroInc = lsSeguro.getItem('aventura_filtro_genero') || 'todos';
          var candidatos = AVATARES_BASE.filter(function (a) { return filtroInc === 'todos' || a.genero === filtroInc; });
          estadoAventura.avatar = candidatos[Math.floor(Math.random() * candidatos.length)].id;
          estadoAventura.revelarIncognito = true;
        }
        var todosAvatares = ['mago', 'maga', 'caballero', 'caballera', 'arquero', 'arquera', 'guerrero', 'guerrera', 'asesino', 'asesina', 'clerigo', 'sacerdotiza'];
        estadoAventura.avatarRival = todosAvatares[Math.floor(Math.random() * todosAvatares.length)];

        var R = window.RetoRpg;
        var cargas = R ? [R.catalogo(), R.equipo(), R.aciertos(), R.entregados(), R.entregadosHoy()] : [Promise.resolve({ powerups: {}, textos: {} }), Promise.resolve([]), Promise.resolve(0), Promise.resolve(0), Promise.resolve(0)];
        Promise.all(cargas).then(function (r) {
          var cat = r[0], aciertosAntes = r[2];
          estadoAventura.textosPU = cat.textos;
          estadoAventura.catalogoPU = cat;
          var conTiempo = ajustesAventura.danoTiempo === 'on';
          // Sin tiempo no se llevan los power ups que lo necesitan.
          var equipo = r[1].filter(function (id) {
            return !(cat.powerups[id] && cat.powerups[id].requiere_tiempo && !conTiempo);
          });
          return llamarPve('POST', '/iniciar', {
            nombre: nombreDeAvatar(estadoAventura.avatar), clase: claseDeAvatar(estadoAventura.avatar),
            enemigo: { nombre: nombreDeAvatar(estadoAventura.avatarRival), clase: claseDeAvatar(estadoAventura.avatarRival) },
            preguntas: preguntasParaServidor(mazo), equipo: equipo, dano_base: ajustesAventura.danPorcentaje,
            ventaja: 3, dificultad: ajustesAventura.dificultad, con_tiempo: conTiempo, segundos: 30,
            aciertos_antes: aciertosAntes, entregados_antes: r[3], entregados_hoy: r[4]
          });
        }).then(function (v) {
          estadoAventura.sesionPve = v.token;
          aplicarVista(v);
          contenedor.style.opacity = '1';
          renderBatalla(contenedor);
        }).catch(function (e) {
          alert('No se pudo empezar la batalla: ' + e.message);
          contenedor.style.opacity = '1';
          renderSeleccionTest(contenedor);
        });
      } catch (e) {
        alert('Error al iniciar batalla: ' + e.message);
        contenedor.style.opacity = '1';
      }
    }, 400);
  }

  /* -------------------------------------------------------------------------
     3. PANTALLA DE BATALLA RPG (Interfaz rpg01, rpg02 o rpg03)
     ------------------------------------------------------------------------- */
  /* El contador de segundos: mas del DOBLE que el texto que lo acompaña, con borde y color de alto
     contraste. Se muestra solo el número; si hay sangrado activo, se muestra 🩸 antes del número.
     Los primeros 3 segundos son de gracia (no pierden vida). En los ultimos 5 segundos se
     invierte (fondo de acento) para que se sienta la presion. Nada parpadea ni se mueve. */
  function inyectarEstilosTiempo() {
    if (document.getElementById('tiempo-estilos')) return;
    var st = document.createElement('style');
    st.id = 'tiempo-estilos';
    st.textContent = [
      '.tiempo-segundos { display: inline-block; min-width: 2.2ch; padding: 0 0.3em; margin: 0 0.1em; border: 3px solid var(--text);',
      '  border-radius: 10px; font-size: 2.4em; font-weight: 800; line-height: 1.15; text-align: center; vertical-align: middle;',
      '  font-variant-numeric: tabular-nums; color: var(--text); background: var(--bg); }',
      '.tiempo-segundos.urgente { background: var(--accent); color: var(--bg); border-color: var(--accent); }'
    ].join('\n');
    document.head.appendChild(st);
  }

  function renderBatalla(contenedor) {
    contenedor.innerHTML = '';
    inyectarEstilosTiempo();

    var headerEl = document.querySelector('body > header');
    if (headerEl) headerEl.style.display = 'none';

    if (estadoAventura.vista && estadoAventura.vista.batalla.ganador !== null) {
      renderVictoriaDerrota(contenedor);
      return;
    }
    var pActual = preguntaActual();
    estadoAventura.turnoPintado = estadoAventura.vista ? estadoAventura.vista.batalla.turno : null;
    if (!pActual) {
      renderVictoriaDerrota(contenedor);
      return;
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'aventura-batalla-wrap';
    wrapper.style.cssText = 'width: max(var(--aventura-battle-max-width, 100%), min(100%, 340px)); max-width: 100%; margin: 0 auto;';

    if (estadoAventura.interfaz === 'rpg01') {
      wrapper.innerHTML = renderInterfazRPG01(pActual);
    } else if (estadoAventura.interfaz === 'rpg02') {
      wrapper.innerHTML = renderInterfazRPG02(pActual);
    } else {
      wrapper.innerHTML = renderInterfazRPG03(pActual);
    }

    contenedor.appendChild(wrapper);
    
    // Aplicar configuración de la tarjeta v2 (animaciones, fuente, ajustes, layout)
    aplicarConfigTarjetaAventura(wrapper);
    
    ponerFondo(wrapper);
    pintarEstados(wrapper);
    if (estadoAventura.revelarIncognito) {         // el personaje incógnito se descubre al empezar la batalla
      estadoAventura.revelarIncognito = false;
      var nombreInc = (AVATARES_BASE.filter(function (a) { return a.id === estadoAventura.avatar; })[0] || {}).nombre || estadoAventura.avatar;
      mostrarAviso(wrapper, '🎭 ¡Tu personaje incógnito es: ' + nombreInc + '!');
    }
    if (window.RetoSprites) {                       // poses de espera y el rival ataca al llegar la pregunta
      window.RetoSprites.preparar(wrapper, { rival: estadoAventura.avatarRival, jugador: estadoAventura.avatar });
      window.RetoSprites.intro(wrapper);
    }
    if (interfazConLayout()) aplicarLayout(wrapper, cargarLayout(estadoAventura.interfaz));
    // Aplicar layout de la tarjeta v2 SOBRE el layout local (sobrescribe posiciones/escalas)
    aplicarLayoutTarjetaAventura(wrapper);
    iniciarTemporizadorPregunta(wrapper, contenedor);
    conectarEventosBatalla(wrapper, contenedor, pActual);
  }

  /* El fondo de la batalla: se elige UNO al azar por batalla (imagenes/fondos/) y se queda aunque
     la pantalla se vuelva a pintar. Si aun no llega la lista, se pone en cuanto llegue. */
  function ponerFondo(wrapper) {
    if (estadoAventura.fondo) wrapper.style.setProperty('--escena-fondo', 'url("' + estadoAventura.fondo + '")');
    if (estadoAventura.fondo !== undefined || !window.RetoFondos) return;
    estadoAventura.fondo = null;
    window.RetoFondos.elegir().then(function (u) {
      estadoAventura.fondo = u;
      if (u && wrapper.isConnected) wrapper.style.setProperty('--escena-fondo', 'url("' + u + '")');
    });
  }

  function renderInterfazRPG01(p) {
    var avatarImg = (estadoAventura.avatar || 'caballero') + '.webp';
    var rivalImg = (estadoAventura.avatarRival || 'mago') + '.webp';
    return `
      <style>
        .game-container-rpg1 {
          --rpg-borde: color-mix(in srgb, var(--borde-fuerte) 45%, transparent);
          --rpg-radio: var(--radius, 12px);
          width: 100%;
          max-width: 100%;
          border: 2px solid var(--borde-fuerte);
          background-color: var(--bg);
          display: block;
          overflow: hidden;
          box-shadow: var(--sombra);
          border-radius: calc(var(--rpg-radio) * 1.5);
          margin: 0 auto;
          font-family: var(--aventura-font, 'Roboto Mono', ui-monospace, monospace);
          color: var(--text);
          box-sizing: border-box;
        }
        .game-container-rpg1 *, .game-container-rpg1 *::before, .game-container-rpg1 *::after {
          box-sizing: border-box;
        }

        /* ---------- Escenario ---------- */
        .battle-screen-rpg1 {
          position: relative;
          transform: translate(var(--aventura-screen-x, 0px), var(--aventura-screen-y, 0px));
          padding: 24px;
          min-height: var(--aventura-battle-min-height, 220px);
          overflow: hidden;
          background: radial-gradient(120% 100% at 50% 0%, var(--surface) 0%, var(--bg) 100%);
          border: 1px solid var(--rpg-borde);
          border-radius: var(--rpg-radio);
          isolation: isolate;
        }
        /* El fondo de la batalla (imagenes/fondos/, uno al azar) va detras de todo y algo
           transparente para que las barras de vida y los personajes sigan leyendose. */
        .battle-screen-rpg1::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          background-image: var(--escena-fondo, none);
          background-size: cover;
          background-position: center;
          image-rendering: pixelated;
          opacity: 0.6;
          pointer-events: none;
        }

        /* HUD (nombre + barra de vida) de oponente y jugador */
        .hud-box-rpg1 {
          position: absolute;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 12px;
          width: min(330px, 62%);
          padding: 10px 14px;
          background-color: color-mix(in srgb, var(--surface) 88%, transparent);
          backdrop-filter: blur(6px);
          border: 1px solid var(--rpg-borde);
          border-radius: var(--rpg-radio);
          box-shadow: var(--sombra);
        }
        .hud-oponente-rpg1 { top: 20px; left: 20px; }
        .hud-jugador-rpg1 { bottom: 20px; right: 20px; }
        .hud-header-rpg1 { display: flex; align-items: center; flex-shrink: 0; }
        .hud-name-rpg1 {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: var(--text);
          text-transform: uppercase;
          white-space: nowrap;
        }
        .health-bar-bg-rpg1 {
          position: relative;
          flex: 1;
          min-width: 0;
          height: 18px;
          overflow: hidden;
          background-color: var(--bg);
          border: 1px solid var(--rpg-borde);
          border-radius: 999px;
        }
        .health-bar-fill-rpg1 {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), var(--borde-fuerte));
          border-radius: inherit;
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        /* La vida: barra y, DEBAJO, el numero grande (antes iba dentro de la barra, en 11 px,
           y apenas se notaba). */
        .hud-vida-rpg1 { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .hud-hp-num-rpg1 {
          display: flex;
          justify-content: flex-end;
          align-items: baseline;
          gap: 4px;
          font-size: clamp(26px, 5vw, 38px);
          font-weight: 800;
          line-height: 1;
          text-align: right;
          color: var(--text);
          white-space: nowrap;
        }
        .hud-hp-num-rpg1 small { font-size: 0.4em; font-weight: 700; letter-spacing: 0.04em; margin-left: 4px; color: var(--muted); }

        /* Sprites: el contenedor manda el tamaño; la imagen lo rellena, sea cual sea el avatar */
        .sprite-rpg1 {
          position: absolute;
          z-index: 2;
          width: var(--aventura-sprite-size, 240px);
          height: var(--aventura-sprite-size, 240px);
          max-width: 60%;
          opacity: 0.97;
          pointer-events: none;
        }
        .sprite-rpg1 img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center bottom;
          image-rendering: pixelated;
          filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.28));
        }
        .sprite-oponente-rpg1 { top: 10px; right: 40px; }
        /* Los sprites nuevos del adversario ya vienen reflejados; solo la imagen de siempre se refleja aqui. */
        .sprite-legacy-volteado { transform: scaleX(-1); }
        .sprite-jugador-rpg1 { bottom: 6px; left: 30px; }

        /* ---------- Pregunta, respuestas y tiempo: sin fondo propio ---------- */
        .question-box-rpg1,
        .answers-container-rpg1,
        .timer-container-rpg1 {
          position: relative;
          background: transparent;
          border: 1px solid var(--rpg-borde);
          border-radius: var(--rpg-radio);
          max-width: 100%;
          overflow-x: auto;
          margin: 6px auto;
          z-index: 12;
        }
        .question-box-rpg1 {
          transform: translate(var(--aventura-question-x, 0px), var(--aventura-question-y, 0px));
          padding: 18px 24px;
          min-height: var(--aventura-question-min-height, 85px);
          width: var(--aventura-question-width, 100%);
          font-size: var(--aventura-size-pregunta, 1.05rem);
          font-weight: 600;
          line-height: 1.5;
          color: var(--text);
        }
        .answers-container-rpg1 {
          transform: translate(var(--aventura-answers-x, 0px), var(--aventura-answers-y, 0px));
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          align-content: center;
          padding: 18px;
          width: var(--aventura-answers-width, 100%);
          min-height: var(--aventura-answers-min-height, 120px);
        }
        .timer-container-rpg1 {
          transform: translate(var(--aventura-timer-x, 0px), var(--aventura-timer-y, 0px));
          padding: 10px 16px;
          width: var(--aventura-timer-width, 100%);
          min-height: var(--aventura-timer-min-height, 45px);
          font-size: 12px;
          font-weight: 700;
          text-align: center;
          color: var(--text);
        }

        .btn-answer-rpg1 {
          padding: 14px 16px;
          background-color: var(--surface);
          border: 1px solid var(--borde-fuerte);
          border-radius: var(--rpg-radio);
          color: var(--text);
          font-family: inherit;
          font-size: var(--aventura-size-opciones, 0.95rem);
          font-weight: 600;
          text-align: left;
          line-height: 1.35;
          overflow-wrap: anywhere;
          cursor: pointer;
          transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
        }
        .btn-answer-rpg1:hover {
          background-color: var(--accent);
          border-color: var(--accent);
          color: var(--bg);
          transform: translateY(-2px);
          box-shadow: var(--sombra);
        }
        .btn-answer-rpg1:active { transform: translateY(0); }

        /* ---------- Inventario ---------- */
        .powerups-panel-rpg1 {
          position: relative;
          transform: translate(var(--aventura-powerups-x, 0px), var(--aventura-powerups-y, 0px));
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          width: var(--aventura-powerups-width, 100%);
          max-width: 100%;
          min-height: var(--aventura-powerups-min-height, 120px);
          margin: 6px auto;
          padding: 16px;
          overflow-x: auto;
          background-color: var(--bg);
          border: 1px solid var(--rpg-borde);
          border-radius: var(--rpg-radio);
          z-index: 12;
        }
        .powerups-title-rpg1 {
          margin-bottom: 2px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-align: center;
          text-transform: uppercase;
          color: var(--accent);
        }
        .btn-powerup-rpg1 {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background-color: var(--surface);
          border: 1px solid var(--borde-fuerte);
          border-radius: var(--rpg-radio);
          color: var(--text);
          font-family: inherit;
          font-size: var(--aventura-size-powerups, 0.85rem);
          font-weight: 700;
          text-align: left;
          cursor: pointer;
          transition: background-color 150ms ease, color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
        }
        .btn-powerup-rpg1:hover {
          background-color: var(--accent);
          border-color: var(--accent);
          color: var(--bg);
          transform: translateY(-1px);
          box-shadow: var(--sombra);
        }
        .btn-powerup-rpg1:active { transform: translateY(0); }

        .btn-answer-rpg1:focus-visible,
        .btn-powerup-rpg1:focus-visible {
          outline: 3px solid var(--focus, var(--accent));
          outline-offset: 2px;
        }

        /* ---------- Responsive: tablet y celular ---------- */
        @media (max-width: 900px) {
          .battle-screen-rpg1 { padding: 16px; min-height: max(var(--aventura-battle-min-height, 220px), 300px); }
          .sprite-rpg1 { width: min(var(--aventura-sprite-size, 240px), 34vw); height: min(var(--aventura-sprite-size, 240px), 34vw); }
          .sprite-oponente-rpg1 { right: 16px; }
          .sprite-jugador-rpg1 { left: 12px; }
        }
        @media (max-width: 640px) {
          .aventura-batalla-wrap { max-width: 100% !important; }
          .game-container-rpg1 { max-width: 100%; }
          .hud-box-rpg1 { width: 62%; padding: 8px 10px; gap: 8px; }
          .hud-oponente-rpg1 { top: 10px; left: 10px; }
          .hud-jugador-rpg1 { bottom: 10px; right: 10px; }
          .hud-name-rpg1 { font-size: 10px; }
          .hud-hp-text-rpg1 { font-size: 9px; }
          .question-box-rpg1 { padding: 14px 16px; }
          .answers-container-rpg1 { grid-template-columns: minmax(0, 1fr); padding: 12px; gap: 10px; }
          .powerups-panel-rpg1 { flex-direction: row; flex-wrap: wrap; justify-content: center; }
          .powerups-title-rpg1 { flex: 1 0 100%; }
          .btn-powerup-rpg1 { flex: 1 1 140px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .btn-answer-rpg1, .btn-powerup-rpg1, .health-bar-fill-rpg1 { transition: none; }
          .btn-answer-rpg1:hover, .btn-powerup-rpg1:hover { transform: none; }
        }
      </style>

      <div class="game-container-rpg1">
        <!-- 1. ESCENARIO DE BATALLA -->
        <div class="battle-screen-rpg1" data-lay="screen">
          <!-- HUD Rival -->
          <div class="hud-box-rpg1 hud-oponente-rpg1" data-lay="hud-oponente">
            <div class="hud-header-rpg1">
              <div class="hud-name-rpg1">${estadoAventura.avatarRival.toUpperCase()}</div>
            </div>
            <div class="hud-vida-rpg1">
              <div class="health-bar-bg-rpg1">
                <div class="health-bar-fill-rpg1" id="bar-rival" style="width: ${(estadoAventura.hpRival / estadoAventura.pvMaxRival) * 100}%;"></div>
              </div>
              <div class="hud-hp-num-rpg1"><span id="hp-rival">${Math.ceil(estadoAventura.hpRival)}</span><small>/ ${estadoAventura.pvMaxRival} HP</small></div>
            </div>
          </div>

          <!-- Sprite Rival -->
          <div class="sprite-rpg1 sprite-oponente-rpg1" data-lay="sprite-oponente">
            <img src="../../../imagenes/${rivalImg}" alt="Rival" data-sprite="rival" data-personaje="${estadoAventura.avatarRival}" data-legacy="../../../imagenes/${rivalImg}">
          </div>

          <!-- Sprite Jugador -->
          <div class="sprite-rpg1 sprite-jugador-rpg1" data-lay="sprite-jugador">
            <img src="../../../imagenes/${avatarImg}" alt="Jugador" data-sprite="jugador" data-personaje="${estadoAventura.avatar}" data-legacy="../../../imagenes/${avatarImg}">
          </div>

          <!-- HUD Jugador -->
          <div class="hud-box-rpg1 hud-jugador-rpg1" data-lay="hud-jugador">
            <div class="hud-header-rpg1">
              <div class="hud-name-rpg1">${estadoAventura.avatar.toUpperCase()}</div>
            </div>
            <div class="hud-vida-rpg1">
              <div class="health-bar-bg-rpg1">
                <div class="health-bar-fill-rpg1" id="bar-jugador" style="width: ${(estadoAventura.hpJugador / estadoAventura.pvMax) * 100}%;"></div>
              </div>
              <div class="hud-hp-num-rpg1"><span id="hp-jugador">${Math.ceil(estadoAventura.hpJugador)}</span><small>/ ${estadoAventura.pvMax} HP</small></div>
            </div>
          </div>
        </div>

        <!-- 2. CAJA DE LA PREGUNTA (Independiente con Scroll Horizontal) -->
        <div class="question-box-rpg1" data-lay="question">
          ${fraseHtml(p)}<strong>${p.enunciado}</strong>
        </div>

        <!-- 3. CONTENEDOR DE RESPUESTAS (Independiente con Scroll Horizontal) -->
        <div class="answers-container-rpg1" id="opciones-batalla" data-lay="answers">
          ${(p.opciones || []).map(function(op, idx) {
            return '<button type="button" class="btn-answer-rpg1 btn-opcion-rpg" data-idx="' + idx + '">' + String.fromCharCode(65 + idx) + ') ' + op.texto + '</button>';
          }).join('')}
        </div>

        <!-- 4. CRONÓMETRO / TIEMPO (Independiente con Scroll Horizontal) -->
        <div class="timer-container-rpg1" data-lay="timer">
          <span id="span-tiempo" class="tiempo-segundos">30</span>
        </div>

        <!-- 5. PANEL DE POWER-UPS (Independiente con Scroll Horizontal) -->
        <div class="powerups-panel-rpg1" data-lay="powerups">
          <div class="powerups-title-rpg1">✨ Inventario</div>
          <span data-pw-lista style="display: contents;"></span>
        </div>
      </div>
    `;
  }

  function renderInterfazRPG02(p) {
    var rivalImg = (estadoAventura.avatarRival || 'mago') + '.webp';
    return `
      <style>
        .btn-opcion-rpg {
          transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
          font-size: var(--aventura-size-opciones, 0.9em);
          box-shadow: 0 3px 8px rgba(0,0,0,0.1);
        }
        .btn-opcion-rpg:hover {
          background-color: var(--accent) !important;
          color: var(--bg) !important;
          border-color: var(--accent) !important;
          box-shadow: 0 6px 16px rgba(0,0,0,0.25);
        }
        .btn-power {
          font-size: var(--aventura-size-powerups, 0.85em);
          box-shadow: 0 3px 8px rgba(0,0,0,0.1);
        }
        .btn-power:hover {
          box-shadow: 0 5px 12px rgba(0,0,0,0.2);
        }
        /* La pantalla de combate: el mismo fondo de batalla que RPG01 (imagenes/fondos/, uno al azar) y el enemigo
           grande, de frente al jugador, con su nombre. El FONDO, el enemigo y su nombre son piezas independientes
           (se editan por separado en el editor de layout): el fondo es una capa que cubre el escenario y el enemigo y
           su nombre van encima. No usan la propiedad translate para centrarse: esa la usa el editor para mover. */
        .rpg2-stage { position: relative; min-height: 240px; }
        .rpg2-escena {
          position: absolute;
          inset: 0;
          isolation: isolate;
          overflow: hidden;
          background: radial-gradient(120% 100% at 50% 0%, var(--surface) 0%, var(--bg) 100%);
          border: 1px solid var(--borde);
          border-radius: 10px;
          box-shadow: inset 0 6px 16px rgba(0,0,0,0.15);
        }
        .rpg2-escena::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          background-image: var(--escena-fondo, none);
          background-size: cover;
          background-position: center;
          image-rendering: pixelated;
          opacity: 0.6;
          pointer-events: none;
        }
        .rpg2-enemigo-caja {
          --rpg2-w: clamp(130px, 34vw, 190px);
          position: absolute;
          z-index: 2;
          left: calc(50% - var(--rpg2-w) / 2);
          bottom: 40px;
          width: var(--rpg2-w);
          height: var(--rpg2-w);
        }
        .rpg2-enemigo { width: 100%; height: 100%; object-fit: contain; object-position: center bottom; image-rendering: pixelated; filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.35)); }
        .rpg2-nombre {
          position: absolute;
          z-index: 3;
          left: 0;
          right: 0;
          bottom: 10px;
          margin-inline: auto;
          width: max-content;
          padding: 3px 12px;
          border: 1px solid var(--borde);
          border-radius: 999px;
          background-color: color-mix(in srgb, var(--surface) 88%, transparent);
          font-size: 0.9rem;
          font-weight: 800;
          color: var(--text);
        }
        .rpg2-hud { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
        .rpg2-chip { flex: 1 1 auto; background: var(--bg); padding: 8px 14px; border-radius: 8px; border: 1px solid var(--borde); font-size: 0.9em; box-shadow: inset 0 2px 6px rgba(0,0,0,0.1); }
        .rpg2-hp { font-size: 1.5em; font-weight: 800; line-height: 1; }
        /* En celular el inventario va debajo de la pregunta (antes se salia de la pantalla). */
        @media (max-width: 560px) { .rpg2-panel { grid-template-columns: 1fr !important; } }
      </style>
      <div class="rpg2-contenedor" style="max-width: 100%; margin: 0 auto; background: var(--surface); color: var(--text); border: 2px solid var(--borde-fuerte); border-radius: var(--radius, 12px); padding: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.35); display: flex; flex-direction: column; gap: 10px; font-family: var(--aventura-font, 'Roboto Mono', ui-monospace, monospace);">
        <!-- HUD Superior: tres piezas independientes -->
        <div class="rpg2-hud">
          <div class="rpg2-chip" data-lay="hud-jugador">🛡️ ${estadoAventura.avatar.toUpperCase()}: HP <span class="rpg2-hp" id="hp-jugador">${Math.ceil(estadoAventura.hpJugador)}</span>/${estadoAventura.pvMax}<div data-estados="jugador"></div></div>
          <div class="rpg2-chip" data-lay="timer"><span id="span-tiempo" class="tiempo-segundos">30</span></div>
          <div class="rpg2-chip" data-lay="hud-oponente">👾 RIVAL: HP <span class="rpg2-hp" id="hp-rival">${Math.ceil(estadoAventura.hpRival)}</span>/${estadoAventura.pvMaxRival}</div>
        </div>

        <!-- Pantalla de Combate Central: fondo, enemigo y nombre -->
        <div class="rpg2-stage">
          <div class="rpg2-escena" data-lay="screen"></div>
          <div class="rpg2-enemigo-caja" data-lay="sprite-oponente" data-sprite-caja><img class="rpg2-enemigo" src="../../../imagenes/${rivalImg}" alt="Rival: ${nombreDeAvatar(estadoAventura.avatarRival)}" data-sprite="rival" data-personaje="${estadoAventura.avatarRival}" data-legacy="../../../imagenes/${rivalImg}"></div>
          <div class="rpg2-nombre" data-lay="nombre-oponente">Rival: ${estadoAventura.avatarRival.toUpperCase()}</div>
        </div>

        <!-- Panel Inferior Dividido: Pregunta/Opciones vs Inventario -->
        <div class="rpg2-panel" style="display: grid; grid-template-columns: 1fr 180px; gap: 10px; background: var(--bg); border: 1px solid var(--borde); padding: 12px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div data-lay="question" style="font-size: var(--aventura-size-pregunta, 0.95rem); font-weight: bold; color: var(--text);">${fraseHtml(p)}${p.enunciado}</div>
            <div data-lay="answers" style="display: flex; flex-direction: column; gap: 6px;" id="opciones-batalla">
              ${(p.opciones || []).map(function(op, idx) {
                return '<button type="button" class="btn-opcion-rpg" data-idx="' + idx + '" style="background: var(--surface); border: 1px solid var(--borde-fuerte); color: var(--text); padding: 8px 10px; text-align: left; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: var(--aventura-size-opciones, 0.9em);">' + (idx + 1) + ') ' + op.texto + '</button>';
              }).join('')}
            </div>
          </div>

          <div data-lay="powerups" style="background: var(--surface); border: 1px solid var(--borde-fuerte); padding: 8px; border-radius: 6px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <div style="font-size: 0.8rem; color: var(--accent); font-weight: bold; text-align: center;">🎒 INVENTARIO</div>
          <span data-pw-lista style="display: contents;"></span>
          </div>
        </div>
      </div>
    `;
  }

  function renderInterfazRPG03(p) {
    return `
      <style>
        .btn-opcion-rpg {
          transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
          font-size: var(--aventura-size-opciones, 0.9em);
          box-shadow: 0 3px 8px rgba(0,0,0,0.15);
        }
        .btn-opcion-rpg:hover {
          background: var(--accent) !important;
          color: var(--bg) !important;
          box-shadow: 0 6px 16px rgba(0,0,0,0.3);
        }
        .btn-powerup-rpg3 {
          font-size: var(--aventura-size-powerups, 0.8em);
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        .btn-powerup-rpg3:hover {
          box-shadow: 0 4px 10px rgba(0,0,0,0.25);
        }
      </style>
      <div class="rpg3-contenedor" style="max-width: 100%; margin: 0 auto; background: var(--surface); color: var(--text); border: 3px solid var(--borde-fuerte); border-radius: 6px; padding: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); font-family: var(--aventura-font, 'Roboto Mono', ui-monospace, monospace);">
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; border-bottom: 2px solid var(--borde-fuerte); padding-bottom: 6px; margin-bottom: 10px; font-size: 0.9em; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
          <div data-lay="hud-jugador">PLAYER: <span id="hp-jugador">${Math.ceil(estadoAventura.hpJugador)}</span> HP<div data-estados="jugador"></div></div>
          <div data-lay="timer"><span id="span-tiempo" class="tiempo-segundos">30</span></div>
          <div data-lay="hud-oponente">ENEMY: <span id="hp-rival">${Math.ceil(estadoAventura.hpRival)}</span> HP<div data-estados="rival"></div></div>
        </div>

        <div style="display: flex; justify-content: space-around; align-items: center; border-bottom: 2px dashed var(--borde); padding-bottom: 10px; margin-bottom: 10px;">
          <div data-lay="nombre-jugador" style="border: 2px solid var(--borde-fuerte); padding: 8px 16px; text-align: center; font-size: 0.9em; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">⚔️ ${estadoAventura.avatar.toUpperCase()}</div>
          <div data-lay="versus" style="font-weight: bold;">VS</div>
          <div data-lay="nombre-oponente" style="border: 2px solid var(--borde-fuerte); padding: 8px 16px; text-align: center; font-size: 0.9em; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">👾 ${estadoAventura.avatarRival.toUpperCase()}</div>
        </div>

        <div data-lay="powerups" style="display: flex; justify-content: space-between; align-items: center; background: var(--bg); padding: 6px 10px; border: 1px solid var(--borde); margin-bottom: 10px; font-size: 0.85em; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
          <div>ITEMS:</div>
          <div style="display: flex; gap: 6px;">
          <span data-pw-lista style="display: contents;"></span>
          </div>
        </div>

        <div data-lay="question" style="border: 2px solid var(--borde-fuerte); background: var(--bg); padding: 12px; margin-bottom: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <p style="margin: 0; font-size: var(--aventura-size-pregunta, 0.95em); color: var(--text);">${fraseHtml(p)}* ${p.enunciado}</p>
        </div>

        <div data-lay="answers" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;" id="opciones-batalla">
          ${(p.opciones || []).map(function(op, idx) {
            return '<button type="button" class="btn-opcion-rpg" data-idx="' + idx + '" style="background: var(--surface); color: var(--text); border: 2px solid var(--borde-fuerte); padding: 8px; cursor: pointer; text-align: left; font-family: inherit; font-size: var(--aventura-size-opciones, 0.9em);">> ' + op.texto + '</button>';
          }).join('')}
        </div>
      </div>
    `;
  }

  /* =========================================================================
     LA BATALLA LA LLEVA EL SERVIDOR (logica/pve.py + logica/rpg.py)
     -------------------------------------------------------------------------
     Esta pantalla solo muestra la batalla y manda lo que haces (contestar, usar
     un power up). El dano, los turnos, la vida y los premios los calcula el
     servidor con las MISMAS reglas del duelo por wifi, y nunca manda la
     respuesta correcta. Los power ups que llevas salen de tu inventario
     (scripts/reto-rpg.js). Se ganan aqui y en los tests, acertando.
     ========================================================================= */
  var PVE = '/api/pve';
  var cuentaAtras = null;      // { desde, valor }: lo que queda para responder (solo con tiempo)

  function llamarPve(metodo, ruta, cuerpo) {
    var opts = { method: metodo, headers: { 'Content-Type': 'application/json' } };
    if (cuerpo) opts.body = JSON.stringify(cuerpo);
    return fetch(PVE + ruta, opts).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error((d && d.error) || 'No se pudo.');
        return d;
      });
    }, function () { throw new Error('No se pudo seguir con la batalla. Recarga la página.'); });
  }

  function claseDeAvatar(av) {
    return window.RetoRpg ? window.RetoRpg.claseDeAvatar(av) : 'guerrero';
  }

  function nombreDeAvatar(av) {
    return String(av || 'Jugador').charAt(0).toUpperCase() + String(av || 'jugador').slice(1);
  }

  /* El mazo del test al formato del servidor: ids propios y la correcta marcada por id. */
  function preguntasParaServidor(mazo) {
    return mazo.map(function (q, i) {
      var ops = (q.opciones || []).map(function (op, k) { return { id: 'o' + k, texto: String(op.texto) }; });
      var c = 0;
      (q.opciones || []).forEach(function (op, k) { if (op.correcta) c = k; });
      return { id: 'q' + i, enunciado: String(q.enunciado || q.texto || ''), tema: '', opciones: ops, correcta: 'o' + c };
    });
  }

  function aplicarVista(v) {
    estadoAventura.vista = v;
    var b = v.batalla;
    estadoAventura.hpJugador = b.yo_estado.pv;
    estadoAventura.pvMax = b.yo_estado.pv_max;
    estadoAventura.hpRival = b.rival.pv;
    estadoAventura.pvMaxRival = b.rival.pv_max;
    cuentaAtras = v.restante === null || v.restante === undefined ? null : { desde: Date.now(), valor: v.restante };
  }

  /* La frase con la que el rival presenta la pregunta (vacio si se apagó en Configuración).
     Cambia solo cuando cambia la pregunta, no cada vez que se vuelve a pintar la pantalla. */
  function fraseHtml(p) {
    var F = window.RetoFrasesAventura;
    if (!F || ajustesAventura.dialogosOponente !== 'on' || !p) return '';
    var clave = estadoAventura.avatarRival + '|' + p.enunciado;
    if (estadoAventura.fraseClave !== clave) {
      var r = F.elegir(estadoAventura.avatarRival, estadoAventura.fraseIndice);
      estadoAventura.fraseClave = clave;
      estadoAventura.fraseTexto = r ? r.texto : '';
      estadoAventura.fraseIndice = r ? r.indice : -1;
    }
    return estadoAventura.fraseTexto
      ? '<em class="frase-rival" style="display: block; font-size: 0.85em; color: var(--muted); margin-bottom: 4px;">' + estadoAventura.fraseTexto + '</em>'
      : '';
  }

  /* La pregunta en la forma que pintan las tres interfaces: { enunciado, opciones: [{ texto, id }] }. */
  function preguntaActual() {
    var v = estadoAventura.vista;
    if (!v || !v.batalla.pregunta) return null;
    return { enunciado: v.batalla.pregunta.enunciado, opciones: v.batalla.pregunta.opciones.map(function (o) {
      return { texto: o.texto, id: o.id };
    }) };
  }

  function actualizarHPs(wrapper) {
    var hpJ = wrapper.querySelector('#hp-jugador');
    var hpR = wrapper.querySelector('#hp-rival');
    if (hpJ) hpJ.textContent = Math.ceil(estadoAventura.hpJugador);
    if (hpR) hpR.textContent = Math.ceil(estadoAventura.hpRival);
    var bJ = wrapper.querySelector('#bar-jugador');
    var bR = wrapper.querySelector('#bar-rival');
    if (bJ) bJ.style.width = Math.max(0, (estadoAventura.hpJugador / estadoAventura.pvMax) * 100) + '%';
    if (bR) bR.style.width = Math.max(0, (estadoAventura.hpRival / estadoAventura.pvMaxRival) * 100) + '%';
  }

  function mostrarAviso(wrapper, texto) {
    var viejo = wrapper.querySelector('#aviso-power-up');
    if (viejo) viejo.remove();
    var aviso = document.createElement('div');
    aviso.id = 'aviso-power-up';
    aviso.setAttribute('role', 'status');
    aviso.style.cssText = 'position: absolute; top: 20px; left: 50%; transform: translateX(-50%); background: var(--accent); color: var(--bg); padding: 8px 16px; border-radius: 999px; font-weight: bold; z-index: 50; box-shadow: var(--sombra); max-width: 90%; text-align: center;';
    aviso.textContent = texto;
    wrapper.style.position = 'relative';
    wrapper.appendChild(aviso);
    setTimeout(function () { if (aviso.parentNode) aviso.remove(); }, 2600);
  }

  /* El resultado de una respuesta: un NUMERO junto al HP de quien recibe el golpe (naranja; el verde queda solo para
     cuando se GANA vida con un power up), o el texto de siempre si se apaga en la configuracion. El numero lleva el mismo
     tamaño de letra que el HP. El texto completo se anuncia igual a los lectores de pantalla en una region oculta, y el
     color no es la unica señal: el numero lleva signo y sale junto al HP de quien lo recibe. */
  function mostrarResultado(wrapper, acierto, dano, texto, prefijo) {
    if (ajustesAventura.numerosGrandes !== 'on' || dano === undefined || dano === null || !window.RetoEstados) { mostrarAviso(wrapper, texto); return; }
    anunciarSR(wrapper, texto);
    var hp = wrapper.querySelector(acierto ? '#hp-rival' : '#hp-jugador');
    window.RetoEstados.numeroJunto(hp, (dano ? (prefijo || '') + '−' + dano : (prefijo || '') + '🛡️ 0'), 'dano');   // 0: el escudo o la reduccion absorbieron todo
  }

  function anunciarSR(wrapper, texto) {
    var vivo = wrapper.querySelector('#aviso-resultado-sr');
    if (!vivo) {
      vivo = document.createElement('div');
      vivo.id = 'aviso-resultado-sr';
      vivo.setAttribute('role', 'status');
      vivo.style.cssText = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;';
      wrapper.appendChild(vivo);
    }
    vivo.textContent = texto;
  }

  /* Los efectos de power ups que siguen activos (los tuyos y los del rival), como aura y etiquetas. Si acabas de usar
     un power up, ademas su destello. */
  function pintarEstados(wrapper) {
    if (!window.RetoEstados || !estadoAventura.vista) return;
    var bb = estadoAventura.vista.batalla;
    window.RetoEstados.pintar(wrapper, bb.yo_estado.efectos, bb.rival.efectos);
    if (estadoAventura.burstPendiente) {
      window.RetoEstados.activar(wrapper, estadoAventura.burstPendiente, estadoAventura.catalogoPU);
      estadoAventura.burstPendiente = null;
    }
    var ch = estadoAventura.cambiosHP;
    estadoAventura.cambiosHP = null;
    if (ch && ajustesAventura.numerosGrandes === 'on') {
      [['jugador', '#hp-jugador'], ['rival', '#hp-rival']].forEach(function (par) {
        var d = Math.round(ch[par[0]]);
        if (!d) return;
        window.RetoEstados.numeroJunto(wrapper.querySelector(par[1]), d > 0 ? '+' + d : '−' + (-d), d > 0 ? 'cura' : 'dano');
      });
    }
  }

  function nombrePowerUp(id) {
    var t = estadoAventura.textosPU && estadoAventura.textosPU[id];
    return t ? t.nombre : id;
  }

  /* Se acabo el tiempo: el servidor ya conto la pregunta como fallo (recibes el golpe del enemigo) y
     puso otra con el reloj de nuevo completo. Aqui se avisa y se pinta la pregunta nueva. */
  function tiempoAgotado(wrapper, contenedor, v) {
    if (estadoAventura.temporizador) clearInterval(estadoAventura.temporizador);
    var u = v.batalla.ultimo;
    if (u && u.tiempo_agotado) {
      mostrarResultado(wrapper, false, u.dano, '⏰ ¡Se acabó el tiempo! Recibes -' + u.dano, '⏰ ');
      if (window.RetoSprites) window.RetoSprites.resultado(wrapper, false);
    }
    if (terminarSiHaceFalta(wrapper, contenedor)) return;
    setTimeout(function () { renderBatalla(contenedor); }, 1100);
  }

  /* Si la respuesta llego justo cuando se acababa el tiempo, el servidor la rechaza (era de la pregunta
     anterior): se pide el estado y se pinta la pregunta nueva. */
  function recargarPorTiempo(wrapper, contenedor) {
    llamarPve('GET', '/' + estadoAventura.sesionPve + '/estado').then(function (v) {
      aplicarVista(v);
      actualizarHPs(wrapper);
      tiempoAgotado(wrapper, contenedor, v);
    }).catch(function () {});
  }

  function terminarSiHaceFalta(wrapper, contenedor) {
    if (estadoAventura.vista.batalla.ganador !== null) {
      clearInterval(estadoAventura.temporizador);
      setTimeout(function () { renderVictoriaDerrota(contenedor); }, 700);
      return true;
    }
    return false;
  }

  /* Con tiempo: la cuenta es solo para mirar; el servidor es quien quita vida (0,3 % de
     la vida maxima por cada segundo desde que aparece la pregunta) y aqui se le
     pregunta cada segundo para dibujar la barra. */
  function iniciarTemporizadorPregunta(wrapper, contenedor) {
    if (estadoAventura.temporizador) clearInterval(estadoAventura.temporizador);
    var spanTiempo = wrapper.querySelector('#span-tiempo');
    var vista = estadoAventura.vista;
    if (!vista.batalla.config.con_tiempo) {
      if (spanTiempo && spanTiempo.parentNode) spanTiempo.parentNode.style.display = 'none';
      return;
    }
    var ultimoRefresco = 0;
    estadoAventura.temporizador = setInterval(function () {
      if (!cuentaAtras) return;
      var s = Math.max(0, Math.ceil(cuentaAtras.valor - (Date.now() - cuentaAtras.desde) / 1000));
      if (spanTiempo) {
        // Mostrar gotita de sangre si el jugador tiene efecto sangrado
        var efectos = estadoAventura.vista && estadoAventura.vista.batalla && estadoAventura.vista.batalla.yo_estado && estadoAventura.vista.batalla.yo_estado.efectos;
        var tieneSangrado = Array.isArray(efectos) && efectos.some(function(e) { return e.tipo === 'sangrado'; });
        spanTiempo.textContent = (tieneSangrado ? '🩸 ' : '') + s;
        spanTiempo.classList.toggle('urgente', s <= 5);
      }
      // Cada segundo se le pregunta al servidor; al llegar a 0 se le pregunta ya (cada 300 ms) para ver cuanto antes la pregunta nueva.
      if (Date.now() - ultimoRefresco >= (s <= 0 ? 300 : 1000)) {
        ultimoRefresco = Date.now();
        llamarPve('GET', '/' + estadoAventura.sesionPve + '/estado').then(function (v) {
          var restante = cuentaAtras;
          var cambioDeTurno = v.batalla.turno !== estadoAventura.turnoPintado;
          aplicarVista(v);
          if (!cambioDeTurno) cuentaAtras = restante;
          actualizarHPs(wrapper);
          pintarEstados(wrapper);
          if (cambioDeTurno) { tiempoAgotado(wrapper, contenedor, v); return; }
          terminarSiHaceFalta(wrapper, contenedor);
        }).catch(function () {});
      }
    }, 250);
  }

  function estiloPowerUp() {
    if (estadoAventura.interfaz === 'rpg01') return { clase: 'btn-powerup-rpg1', estilo: '' };
    if (estadoAventura.interfaz === 'rpg02') {
      return { clase: 'btn-power', estilo: 'background: var(--bg); color: var(--text); border: 1px solid var(--borde); padding: 6px; cursor: pointer;' };
    }
    return { clase: 'btn-powerup-rpg3', estilo: 'background: var(--surface); color: var(--text); border: 1px solid var(--borde-fuerte); padding: 2px 6px; cursor: pointer;' };
  }

  function pintarPowerUps(wrapper, contenedor) {
    var cont = wrapper.querySelector('[data-pw-lista]');
    if (!cont) return;
    var equipo = estadoAventura.vista.batalla.yo_estado.equipo || {};
    var ids = Object.keys(equipo);
    var st = estiloPowerUp();
    if (!ids.length) {
      var vacio = document.createElement('a');
      vacio.href = 'equipo.html';
      vacio.textContent = 'Sin power ups. Se ganan acertando en la aventura y en los tests: ver mi equipo';
      vacio.style.cssText = 'font-size: 0.8em; color: var(--text); text-decoration: underline;';
      cont.appendChild(vacio);
      return;
    }
    ids.forEach(function (id) {
      var usos = equipo[id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = st.clase;
      if (st.estilo) b.style.cssText = st.estilo;
      b.textContent = nombrePowerUp(id) + ' (' + usos + ')';
      var t = estadoAventura.textosPU && estadoAventura.textosPU[id];
      if (t) b.title = t.descripcion;
      b.disabled = usos <= 0;
      b.addEventListener('click', function () {
        var hpAntes = { jugador: estadoAventura.hpJugador, rival: estadoAventura.hpRival };
        llamarPve('POST', '/' + estadoAventura.sesionPve + '/accion', { tipo: 'power_up', id: id, turno: estadoAventura.turnoPintado }).then(function (v) {
          aplicarVista(v);
          // Lo que cambio de vida por el power up: se muestra junto al HP (verde si GANAS vida, naranja si alguien la pierde).
          estadoAventura.cambiosHP = { jugador: estadoAventura.hpJugador - hpAntes.jugador, rival: estadoAventura.hpRival - hpAntes.rival };
          estadoAventura.avisoPendiente = '¡' + nombrePowerUp(id) + '! ' + (t ? t.descripcion : '');
          estadoAventura.burstPendiente = id;
          renderBatalla(contenedor);
        }).catch(function (e) { mostrarAviso(wrapper, e.message); });
      });
      cont.appendChild(b);
    });
  }

  function conectarEventosBatalla(wrapper, contenedor, p) {
    var botonesOpc = wrapper.querySelectorAll('.btn-opcion-rpg');
    Array.prototype.forEach.call(botonesOpc, function (boton) {
      boton.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        var opcion = p.opciones[idx];
        if (!opcion) return;
        Array.prototype.forEach.call(botonesOpc, function (b) { b.disabled = true; });
        llamarPve('POST', '/' + estadoAventura.sesionPve + '/accion', { tipo: 'responder', opcion: opcion.id, turno: estadoAventura.turnoPintado }).then(function (v) {
          var u = v.batalla.ultimo;
          aplicarVista(v);
          if (u && u.reintento) {
            estadoAventura.avisoPendiente = 'Segunda oportunidad: elige otra respuesta.';
            renderBatalla(contenedor);
            return;
          }
          if (estadoAventura.temporizador) clearInterval(estadoAventura.temporizador);
          if (u && window.RetoSprites) window.RetoSprites.resultado(wrapper, !!u.acierto);
          if (u && u.acierto) {
            sonar('acierto');                       // el UNICO sonido de la batalla: contestar bien
            mostrarResultado(wrapper, true, u.dano, '¡Acertaste! Contraataque: -' + u.dano);
          } else if (u) {
            mostrarResultado(wrapper, false, u.dano, 'Fallaste: recibes -' + u.dano);
          }
          actualizarHPs(wrapper);
          if (terminarSiHaceFalta(wrapper, contenedor)) return;
          setTimeout(function () { renderBatalla(contenedor); }, 1100);
        }).catch(function (e) {
          mostrarAviso(wrapper, e.message);
          if (/tiempo/i.test(e.message || '')) { recargarPorTiempo(wrapper, contenedor); return; }
          Array.prototype.forEach.call(botonesOpc, function (b) { b.disabled = false; });
        });
      });
    });
    pintarPowerUps(wrapper, contenedor);
    if (estadoAventura.avisoPendiente) {
      mostrarAviso(wrapper, estadoAventura.avisoPendiente);
      estadoAventura.avisoPendiente = '';
    }
  }

  /* Lo que se hace UNA vez al terminar la batalla: sumar los aciertos, guardar los
     premios, gastar los power ups usados y anotar la sesion para el nivel. */
  function procesarFin(v) {
    var R = window.RetoRpg;
    if (!R) return Promise.resolve(null);
    var j1 = v.resumen.jugadores.j1;
    var resultado = { premios: v.premios || [], perdidos: [], acumulados: 0, nivel: null,
                      bloqueados: v.premios_bloqueados || 0, topeDia: !!v.tope_premios_dia,
                      contados: v.aciertos_contados === undefined ? j1.aciertos : v.aciertos_contados };
    // Con el tope de power ups del dia alcanzado, el servidor dice que estos aciertos no cuentan.
    return R.sumarAciertos(resultado.contados).then(function (total) {
      resultado.acumulados = total;
      return R.agregar(v.premios || []);
    }).then(function (r) {
      resultado.perdidos = r.perdidos;
      return R.registrarEntrega((v.premios || []).length);
    }).then(function () {
      return R.consumir(j1.usados || []);
    }).then(function () {
      if (window.RetoProgreso && v.sesion) return window.RetoProgreso.registrarSesion(v.sesion);
    }).then(function () {
      return R.nivel();
    }).then(function (n) {
      resultado.nivel = n;
      if (window.RetoPerfil && window.RetoPerfil.actualizarPowerups) {
        window.RetoPerfil.actualizarPowerups({});
      }
      if (window.RetoPerfil && window.RetoPerfil.actualizarPuntos && n) {
        window.RetoPerfil.actualizarPuntos(n.puntos || 0, n.nivel || 0);
      }
      return resultado;
    });
  }

  function renderVictoriaDerrota(contenedor) {
    contenedor.innerHTML = '';
    if (estadoAventura.temporizador) clearInterval(estadoAventura.temporizador);
    var v = estadoAventura.vista;
    var victoria = !!v.gano;
    var j1 = v.resumen.jugadores.j1;

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'text-align: center; padding: var(--space-xl); background: var(--surface); border: 3px solid var(--borde-fuerte); border-radius: var(--radius); width: 95%; max-width: 75%; margin: 0 auto; box-shadow: var(--sombra);';
    // Responsive: 95% móvil, 85% tablet, 75% desktop
    var style = document.createElement('style');
    style.textContent = '@media (min-width: 600px) { .resultado-wrapper { width: 85%; max-width: 85%; } } @media (min-width: 1024px) { .resultado-wrapper { width: 75%; max-width: 75%; } }';
    document.head.appendChild(style);
    wrapper.className = 'resultado-wrapper';
    var avatar = estadoAventura.avatar || 'mago';
    var resultadoImg = RetoApi.url('imagenes/sprites/') + avatar + '/' + (victoria ? 'victoria' : 'derrota') + '.webp';
    wrapper.innerHTML = `
      <img src="${resultadoImg}" alt="${victoria ? 'Victoria' : 'Derrota'}" style="max-width: 100px; height: auto; margin-bottom: var(--space-sm);">
      <h2>${victoria ? '¡VICTORIA ÉPICA!' : 'HAS SIDO DERROTADO'}</h2>
      <p style="color: var(--muted); margin: var(--space-md) 0;">
        ${victoria ? 'Has demostrado un dominio excepcional del conocimiento. El rival ha caído.' : 'Esta vez ganó el rival. Cada acierto cuenta para tus premios: ¡inténtalo de nuevo!'}
      </p>
      <p>Aciertos: <strong>${j1.aciertos}</strong> · Fallos: <strong>${j1.fallos}</strong></p>
      <div id="resultado-premios" role="status" aria-live="polite" style="margin: var(--space-md) 0; text-align: left;">Guardando tu progreso…</div>
      <div style="display: flex; gap: var(--space-sm); justify-content: center; flex-wrap: wrap; margin-top: var(--space-lg);">
        <button type="button" id="btn-reiniciar-aventura" class="boton" style="padding: var(--space-sm) var(--space-lg); cursor: pointer;">⚔️ Elegir Otro Test</button>
        <a href="equipo.html" class="boton boton--chico" style="padding: var(--space-sm) var(--space-md);">🎒 Mi equipo</a>
        <a href="../test-conocimientos.html" class="boton boton--chico" style="padding: var(--space-sm) var(--space-md);">Salir al Menú</a>
      </div>
    `;
    contenedor.appendChild(wrapper);
    wrapper.querySelector('#btn-reiniciar-aventura').addEventListener('click', function () {
      renderSeleccionTest(contenedor);
    });

    var caja = wrapper.querySelector('#resultado-premios');
    var hecho = estadoAventura.procesado ? estadoAventura.procesado : (estadoAventura.procesado = procesarFin(v));
    Promise.resolve(hecho).then(function (r) {
      caja.textContent = '';
      if (!r) return;
      var cat = estadoAventura.catalogoPU;
      if (r.premios.length) {
        var t = document.createElement('p');
        t.style.fontWeight = 'bold';
        t.textContent = '🎁 Ganaste ' + r.premios.length + (r.premios.length === 1 ? ' power up:' : ' power ups:');
        caja.appendChild(t);
        var ul = document.createElement('ul');
        r.premios.forEach(function (id) {
          var li = document.createElement('li');
          var p = cat && cat.powerups[id];
          li.textContent = nombrePowerUp(id) + (p ? ' (' + window.RetoRpg.NOMBRES_RAREZA[p.rareza].toLowerCase() + ')' : '');
          ul.appendChild(li);
        });
        caja.appendChild(ul);
        if (r.perdidos.length) {
          var l = document.createElement('p');
          l.textContent = 'Tu inventario está lleno (' + window.RetoRpg.INVENTARIO_MAX + '): ' + r.perdidos.length + ' no cupieron. Descarta alguno en Mi equipo.';
          caja.appendChild(l);
        }
      } else if (r.topeDia && !r.contados && j1.aciertos) {
        var tp = document.createElement('p');
        tp.textContent = 'Hoy ya llegaste al tope de power ups (10 al día). Puedes seguir practicando: estos aciertos no cuentan para el premio, así no pierdes progreso.';
        caja.appendChild(tp);
      } else {
        var faltan = 10 - (r.acumulados % 10);
        var f = document.createElement('p');
        f.textContent = 'Te faltan ' + faltan + (faltan === 1 ? ' acierto' : ' aciertos') + ' para tu próximo premio (llevas ' + r.acumulados + ' en total).';
        caja.appendChild(f);
      }
      if (r.bloqueados) {
        var bl = document.createElement('p');
        bl.textContent = 'Se llegó al tope de 10 power ups por día: ' + r.bloqueados + (r.bloqueados === 1 ? ' premio no se pudo dar' : ' premios no se pudieron dar') + '.';
        caja.appendChild(bl);
      }
      if (r.nivel) {
        var n = document.createElement('p');
        n.textContent = 'Nivel de práctica: ' + r.nivel.nivel + ' (' + Math.round(r.nivel.fraccion * 100) + ' % hacia el siguiente).';
        caja.appendChild(n);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  window.RetoAventura = { iniciar: iniciar };

})();
