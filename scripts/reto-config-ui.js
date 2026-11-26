/* =========================================================================
   R.E.T.O. - UI de la página de Configuración unificada
   -------------------------------------------------------------------------
   Maneja: búsqueda, perfiles rápidos, pestañas de módulos, preview en vivo,
   instalación de fuentes, prueba de sonidos/voz, importar/exportar tarjeta.
   ========================================================================= */
(function () {
  'use strict';

  var refs = {};
  var previewTimer = null;
  var fuenteInstalando = false;

  /* ------------------------------------------------------------ Utilidades */
  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function porId(id) { return document.getElementById(id); }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function decir(texto, error) {
    var el = $('#config-estado') || $('#config-preview-estado');
    if (el) {
      el.textContent = texto || '';
      el.className = 'config-estado' + (error ? ' es-error' : '');
    }
  }

  function formatearTiempo(min) {
    if (!min || min < 1) return '< 1 min';
    var h = Math.floor(min / 60);
    var m = Math.round(min % 60);
    return h ? h + 'h ' + m + 'm' : m + ' min';
  }

  /* ------------------------------------------------------------ Inicialización */
  function init() {
    cacheRefs();
    wireBusqueda();
    wirePerfilesRapidos();
    wirePerfilesDetalle();
    wireTabsModulos();
    wireFormularios();
    wireFuentes();
    wireSonidos();
    wireVoz();
    wireAcciones();
    wirePreview();
    cargarFuentesEnSelect();
    cargarVocesEnSelect();
    actualizarPreview();
    window.addEventListener('reto-config-cambio', function () {
      actualizarPreview();
      recargarUI();
    });
  }

  function cacheRefs() {
    refs = {
      buscar: $('#config-buscar'),
      secciones: $$('.config-seccion'),
      perfilesGrid: $('#config-perfiles-grid'),
      perfilesDetalle: $('#config-perfiles-detalle'),
      tabs: $$('.config-modulos-tabs [role="tab"]'),
      paneles: $$('.config-modulos-paneles [role="tabpanel"]'),
      preview: $('#config-preview-contenido'),
      previewEstado: $('#config-preview-estado'),
      // Fuentes
      selectFuente: $('#fuenteSistema'),
      btnInstalarFuente: $('#btnInstalarFuente'),
      archivoFuente: $('#archivoFuente'),
      // Sonidos
      probarSonidos: $$('[data-probar-sonido]'),
      // Voz
      selectVoz: $('#vozPreferida'),
      btnProbarVoz: $('#probarVoz'),
      // Acciones
      btnExpCopiar: $('#exp-copiar'),
      btnExpDescargar: $('#exp-descargar'),
      btnExpImportar: $('#exp-importar'),
      btnRestablecerConfigs: $('#btn-restablecer-configs'),
      btnRestablecerTodo: $('#btn-restablecer-todo'),
      // Preview
      previewContenido: $('#config-preview-contenido'),
    };
  }

  /* ------------------------------------------------------------ Búsqueda en tiempo real */
  function wireBusqueda() {
    var input = refs.buscar;
    if (!input) return;
    input.addEventListener('input', function () {
      var termino = this.value.trim().toLowerCase();
      refs.secciones.forEach(function (sec) {
        var texto = sec.textContent.toLowerCase();
        var coincide = !termino || texto.indexOf(termino) >= 0;
        sec.hidden = !coincide;
        if (coincide) {
          sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  }

  /* ------------------------------------------------------------ Perfiles rápidos (botones) */
  function wirePerfilesRapidos() {
    var grid = refs.perfilesGrid;
    if (!grid) return;
    var perfiles = window.RetoConfigGlobal.obtenerPerfiles();
    var cfg = window.RetoConfigGlobal.obtener();
    var activo = cfg.perfilActivo;

    // Limpiar antes de renderizar
    grid.innerHTML = '';

    Object.keys(perfiles).forEach(function (id) {
      var p = perfiles[id];
      var esActivo = activo === id;
      var btn = el('button', 'boton ' + (esActivo ? 'boton--principal' : ''), esActivo ? '✓ ' + p.nombre : p.nombre);
      btn.type = 'button';
      btn.title = p.ayuda;
      btn.setAttribute('aria-pressed', esActivo);
      btn.addEventListener('click', function () {
        window.RetoConfigGlobal.aplicarPerfil(id);
        // No re-render aquí; recargarUI() se encarga via evento
      });
      grid.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------ Perfiles detalle (cards) */
  function wirePerfilesDetalle() {
    var grid = refs.perfilesDetalle;
    if (!grid) return;
    var perfiles = window.RetoConfigGlobal.obtenerPerfiles();
    var cfg = window.RetoConfigGlobal.obtener();
    var activo = cfg.perfilActivo;

    // Limpiar antes de renderizar
    grid.innerHTML = '';

    Object.keys(perfiles).forEach(function (id) {
      var p = perfiles[id];
      var esActivo = activo === id;
      var card = el('article', 'config-perfil-card' + (esActivo ? ' activo' : ''));
      card.innerHTML = '\
        <h4>' + p.nombre + '</h4>\
        <p class="config-ayuda">' + p.ayuda + '</p>\
        <button type="button" class="boton ' + (esActivo ? 'boton--principal' : '') + '" data-perfil="' + id + '">\
          ' + (esActivo ? '✓ Activo' : 'Aplicar') + '\
        </button>';
      card.querySelector('button').addEventListener('click', function () {
        window.RetoConfigGlobal.aplicarPerfil(id);
        // No re-render aquí; el evento 'reto-config-cambio' disparará recargarUI
      });
      grid.appendChild(card);
    });
  }

  /* ------------------------------------------------------------ Pestañas de módulos */
  function wireTabsModulos() {
    var tabs = refs.tabs;
    var paneles = refs.paneles;

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var modulo = this.dataset.modulo;
        tabs.forEach(function (t) {
          t.setAttribute('aria-selected', t === tab);
        });
        paneles.forEach(function (p) {
          p.hidden = p.id !== 'panel-' + modulo;
        });
        // Renderizar el panel si no está renderizado
        renderPanelModulo(modulo);
      });
    });
  }

  function renderPanelModulo(modulo) {
    var panel = $('#panel-' + modulo);
    if (!panel || panel.dataset.rendered) return;
    panel.dataset.rendered = 'true';

    var cfg = window.RetoConfigGlobal.obtener();
    var override = cfg.overrides[modulo] || {};

    // Generar controles según el módulo
    var html = '';
    switch (modulo) {
      case 'lectura':
        html = renderOverrideLectura(override);
        break;
      case 'tests':
        html = renderOverrideTests(override);
        break;
      case 'minijuegos':
        html = renderOverrideMinijuegos(override);
        break;
      case 'vision':
        html = renderOverrideVision(override);
        break;
      case 'rpg':
        html = renderOverrideRPG(override);
        break;
      case 'duelo':
        html = renderOverrideDuelo(override);
        break;
      case 'panel':
        html = renderOverridePanel(override);
        break;
      default:
        html = '<p class="config-ayuda">Sin overrides específicos para este módulo.</p>';
    }
    $('#panel-' + modulo).innerHTML = html;
    wirePanelModulo(modulo);
  }

  function wirePanelModulo(modulo) {
    var panel = $('#panel-' + modulo);
    if (!panel) return;
    $$('input, select', panel).forEach(function (ctrl) {
      ctrl.addEventListener('change', function () {
        var override = {};
        override[this.dataset.overrideKey] = this.type === 'checkbox' ? this.checked : this.value;
        window.RetoConfigGlobal.guardarOverride(modulo, override);
      });
    });
  }

  /* --- Renderers de overrides por módulo --- */
  function renderOverrideLectura(o) {
    return '\
      <fieldset class="config-grupo">\
        <legend>Color del foco (solo lectura)</legend>\
        <input type="color" data-overrideKey="colorFoco" value="' + (o.colorFoco || '#ff6b00') + '" aria-label="Color del foco">\
      </fieldset>\
      <fieldset class="config-grupo">\
        <legend>Interlineado (solo lectura)</legend>\
        <div class="config-opciones" role="radiogroup">\
          <label><input type="radio" name="lectura-interlineado" value="normal" data-overrideKey="interlineado" ' + (o.interlineado !== 'amplio' ? 'checked' : '') + '> Normal</label>\
          <label><input type="radio" name="lectura-interlineado" value="amplio" data-overrideKey="interlineado" ' + (o.interlineado === 'amplio' ? 'checked' : '') + '> Amplio</label>\
        </div>\
      </fieldset>';
  }

  function renderOverrideTests(o) {
    return '\
      <fieldset class="config-grupo">\
        <legend>Confirmar respuesta antes de enviar</legend>\
        <label><input type="checkbox" data-overrideKey="confirmar" ' + (o.confirmar ? 'checked' : '') + '> Confirmar</label>\
      </fieldset>\
      <fieldset class="config-grupo">\n        <legend>Ancho de línea en tests</legend>\n        <div class="config-opciones" role="radiogroup">\n          <label><input type="radio" name="tests-columna" value="estrecha" data-overrideKey="columna" ' + (o.columna === 'estrecha' ? 'checked' : '') + '> Estrecha</label>\n          <label><input type="radio" name="tests-columna" value="normal" data-overrideKey="columna" ' + (!o.columna || o.columna === 'normal' ? 'checked' : '') + '> Normal</label>\n          <label><input type="radio" name="tests-columna" value="completa" data-overrideKey="columna" ' + (o.columna === 'completa' ? 'checked' : '') + '> Completa</label>\n        </div>\n      </fieldset>';
  }

  function renderOverrideMinijuegos(o) {
    return '\
      <fieldset class="config-grupo">\
        <legend>Sonido en mini-juegos</legend>\
        <label><input type="checkbox" data-overrideKey="sonido" ' + (o.sonido !== false ? 'checked' : '') + '> Activar (hereda del global si on)</label>\
      </fieldset>';
  }

  function renderOverrideVision(o) {
    return '\
      <fieldset class="config-grupo">\
        <legend>Velocidad por defecto</legend>\
        <div class="config-opciones" role="radiogroup">\
          <label><input type="radio" name="vision-velocidad" value="lenta" data-overrideKey="velocidad" ' + (o.velocidad === 'lenta' ? 'checked' : '') + '> Lenta</label>\
          <label><input type="radio" name="vision-velocidad" value="normal" data-overrideKey="velocidad" ' + (!o.velocidad || o.velocidad === 'normal' ? 'checked' : '') + '> Normal</label>\
          <label><input type="radio" name="vision-velocidad" value="rapida" data-overrideKey="velocidad" ' + (o.velocidad === 'rapida' ? 'checked' : '') + '> Rápida</label>\
        </div>\
      </fieldset>';
  }

  function renderOverrideRPG(o) {
    return '\
      <fieldset class="config-grupo">\
        <legend>Layout de batalla</legend>\
        <div class="config-opciones" role="radiogroup">\
          <label><input type="radio" name="rpg-layout" value="clasico" data-overrideKey="layout" ' + (!o.layout || o.layout === 'clasico' ? 'checked' : '') + '> Clásico (dividido)</label>\
          <label><input type="radio" name="rpg-layout" value="integrado" data-overrideKey="layout" ' + (o.layout === 'integrado' ? 'checked' : '') + '> Integrado</label>\
          <label><input type="radio" name="rpg-layout" value="editor" data-overrideKey="layout" ' + (o.layout === 'editor' ? 'checked' : '') + '> Editor</label>\
        </div>\
      </fieldset>';
  }

  function renderOverrideDuelo(o) {
    return '\
      <fieldset class="config-grupo">\
        <legend>Tamaño de preguntas</legend>\
        <div class="config-opciones" role="radiogroup">\
          <label><input type="radio" name="duelo-tam" value="peq" data-overrideKey="tamPreguntas" ' + (!o.tamPreguntas || o.tamPreguntas === 'peq' ? 'checked' : '') + '> Pequeño</label>\
          <label><input type="radio" name="duelo-tam" value="med" data-overrideKey="tamPreguntas" ' + (o.tamPreguntas === 'med' ? 'checked' : '') + '> Mediano</label>\
          <label><input type="radio" name="duelo-tam" value="grande" data-overrideKey="tamPreguntas" ' + (o.tamPreguntas === 'grande' ? 'checked' : '') + '> Grande</label>\
        </div>\
      </fieldset>';
  }

  function renderOverridePanel(o) {
    return '\
      <fieldset class="config-grupo">\
        <legend>Posición del panel flotante</legend>\
        <div class="config-opciones" role="radiogroup">\
          <label><input type="radio" name="panel-pos" value="abajo" data-overrideKey="pos" ' + (!o.pos || o.pos === 'abajo' ? 'checked' : '') + '> Abajo</label>\
          <label><input type="radio" name="panel-pos" value="arriba" data-overrideKey="pos" ' + (o.pos === 'arriba' ? 'checked' : '') + '> Arriba</label>\
          <label><input type="radio" name="panel-pos" value="izquierda" data-overrideKey="pos" ' + (o.pos === 'izquierda' ? 'checked' : '') + '> Izquierda</label>\
          <label><input type="radio" name="panel-pos" value="derecha" data-overrideKey="pos" ' + (o.pos === 'derecha' ? 'checked' : '') + '> Derecha</label>\
        </div>\
      </fieldset>\
      <fieldset class="config-grupo">\
        <legend>Tamaño</legend>\
        <div class="config-opciones" role="radiogroup">\
          <label><input type="radio" name="panel-tam" value="pequeno" data-overrideKey="tam" ' + (o.tam === 'pequeno' ? 'checked' : '') + '> Pequeño</label>\
          <label><input type="radio" name="panel-tam" value="mediano" data-overrideKey="tam" ' + (!o.tam || o.tam === 'mediano' ? 'checked' : '') + '> Mediano</label>\
          <label><input type="radio" name="panel-tam" value="grande" data-overrideKey="tam" ' + (o.tam === 'grande' ? 'checked' : '') + '> Grande</label>\
        </div>\
      </fieldset>';
  }

  /* ------------------------------------------------------------ Formularios globales (radios, checkboxes, ranges, colors) */
  function wireFormularios() {
    var cfg = window.RetoConfigGlobal.obtener();

    // Radios con data-key (guardan en config global)
    $$('input[type="radio"][data-key]').forEach(function (radio) {
      if (cfg[radio.dataset.key] === radio.value) radio.checked = true;
      radio.addEventListener('change', function () {
        if (this.checked) {
          var obj = {}; obj[this.dataset.key] = this.value;
          window.RetoConfigGlobal.guardar(obj);
        }
      });
    });

    // Checkboxes con data-key
    $$('input[type="checkbox"][data-key]').forEach(function (chk) {
      chk.checked = !!cfg[chk.dataset.key];
      chk.addEventListener('change', function () {
        var obj = {}; obj[this.dataset.key] = this.checked;
        window.RetoConfigGlobal.guardar(obj);
      });
    });

    // Ranges con data-key
    $$('input[type="range"][data-key]').forEach(function (range) {
      var output = $('#' + range.id + 'Valor') || $('#' + range.id + '-valor');
      if (output) output.textContent = range.value + (range.dataset.sufijo || '');
      range.addEventListener('input', function () {
        if (output) output.textContent = this.value + (this.dataset.sufijo || '');
      });
      range.addEventListener('change', function () {
        var obj = {}; obj[this.dataset.key] = parseInt(this.value, 10);
        window.RetoConfigGlobal.guardar(obj);
      });
    });

    // Color pickers con data-key
    $$('input[type="color"][data-key]').forEach(function (cp) {
      if (cfg[cp.dataset.key]) cp.value = cfg[cp.dataset.key];
      cp.addEventListener('input', function () {
        var obj = {}; obj[this.dataset.key] = this.value;
        window.RetoConfigGlobal.guardar(obj);
      });
    });

    // Selects con data-key
    $$('select[data-key]').forEach(function (sel) {
      if (cfg[sel.dataset.key]) sel.value = cfg[sel.dataset.key];
      sel.addEventListener('change', function () {
        var obj = {}; obj[this.dataset.key] = this.value;
        window.RetoConfigGlobal.guardar(obj);
      });
    });
  }

  /* ------------------------------------------------------------ Fuentes */
  function cargarFuentesEnSelect() {
    var select = refs.selectFuente;
    if (!select || !window.RetoFuentes) return;
    window.RetoFuentes.lista().then(function (todas) {
      var cfg = window.RetoConfigGlobal.obtener();
      var actual = cfg.fuenteSistema;
      select.innerHTML = '';
      todas.forEach(function (f) {
        var op = el('option', '', f.nombre);
        op.value = f.id;
        if (f.id === actual) op.selected = true;
        select.appendChild(op);
      });
    });
  }

  function wireFuentes() {
    var btn = refs.btnInstalarFuente;
    var archivo = refs.archivoFuente;
    if (!btn || !archivo) return;

    btn.addEventListener('click', function () { archivo.click(); });

    archivo.addEventListener('change', function () {
      var f = archivo.files && archivo.files[0];
      archivo.value = '';
      if (!f) return;
      instalarFuente(f);
    });

    refs.selectFuente.addEventListener('change', function () {
      window.RetoConfigGlobal.guardar({ fuenteSistema: this.value });
    });
  }

  function instalarFuente(archivo) {
    if (fuenteInstalando) return;
    fuenteInstalando = true;
    var btn = refs.btnInstalarFuente;
    btn.disabled = true;
    btn.textContent = 'Instalando…';

    window.RetoFuentes.instalar(archivo).then(function (nueva) {
      return window.RetoConfigGlobal.guardar({ fuenteSistema: nueva.id }).then(function () {
        return cargarFuentesEnSelect();
      }).then(function () {
        decir('Fuente "' + nueva.nombre + '" instalada y seleccionada');
      });
    }).catch(function (e) {
      decir(e && e.message ? e.message : 'No se pudo instalar la fuente', true);
    }).then(function () {
      fuenteInstalando = false;
      btn.disabled = false;
      btn.textContent = 'Instalar fuente…';
    });
  }

  /* ------------------------------------------------------------ Sonidos */
  function wireSonidos() {
    refs.probarSonidos.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (window.RetoSonido && window.RetoSonido.reproducir) {
          window.RetoSonido.reproducir(this.dataset.probarSonido);
        }
      });
    });
  }

  /* ------------------------------------------------------------ Voz TTS */
  function cargarVocesEnSelect() {
    var select = refs.selectVoz;
    if (!select || !window.speechSynthesis) return;

    function cargar() {
      var voices = window.speechSynthesis.getVoices() || [];
      var vocesES = voices.filter(function (v) {
        return v.lang && (v.lang.toLowerCase().indexOf('es') === 0 || v.lang.toLowerCase().indexOf('spanish') >= 0);
      });
      var actual = select.value;
      select.innerHTML = '<option value="">Voz del sistema</option>';
      vocesES.forEach(function (v) {
        var opt = el('option', '', v.name + ' (' + v.lang + ')');
        opt.value = v.name;
        select.appendChild(opt);
      });
      if (actual) select.value = actual;
    }

    cargar();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = cargar;
    }
  }

  function wireVoz() {
    var btn = refs.btnProbarVoz;
    var select = refs.selectVoz;
    if (!btn || !select || !window.speechSynthesis) return;

    btn.addEventListener('click', function () {
      window.speechSynthesis.cancel();
      var dicho = new window.SpeechSynthesisUtterance('Esta es una prueba de la voz seleccionada en español.');
      dicho.lang = 'es';
      var vozElegida = select.value;
      if (vozElegida) {
        var voices = window.speechSynthesis.getVoices() || [];
        var v = voices.find(function (voice) { return voice.name === vozElegida || voice.voiceURI === vozElegida; });
        if (v) dicho.voice = v;
      }
      window.speechSynthesis.speak(dicho);
    });

    select.addEventListener('change', function () {
      localStorage.setItem('voz_preferida', this.value);
    });
  }

  /* ------------------------------------------------------------ Acciones (exportar/importar/restablecer) */
  function wireAcciones() {
    // Exportar copiar
    if (refs.btnExpCopiar) {
      refs.btnExpCopiar.addEventListener('click', exportarCopiar);
    }
    // Exportar descargar
    if (refs.btnExpDescargar) {
      refs.btnExpDescargar.addEventListener('click', exportarDescargar);
    }
    // Importar
    if (refs.btnExpImportar) {
      refs.btnExpImportar.addEventListener('click', abrirModalImportar);
    }
    // Restablecer configs
    if (refs.btnRestablecerConfigs) {
      refs.btnRestablecerConfigs.addEventListener('click', function () {
        if (confirm('¿Restablecer tema, fuente, animaciones, sonidos, layouts a valores por defecto? NO se borran power-ups, nivel ni progreso.')) {
          window.RetoConfigGlobal.restablecer();
          recargarUI();
        }
      });
    }
    // Restablecer TODO
    if (refs.btnRestablecerTodo) {
      refs.btnRestablecerTodo.addEventListener('click', function () {
        if (confirm('⚠️ Esto borra TODO: perfil, power-ups, nivel, tests, progreso, configs. No se puede deshacer. ¿Seguro?')) {
          localStorage.clear();
          indexedDB.deleteDatabase('reto');
          location.reload();
        }
      });
    }
  }

  function exportarCopiar() {
    if (!window.RetoRpg || !window.RetoRpg.crearTarjeta) { decir('RetoRpg no disponible', true); return; }
    window.RetoPerfil.obtener().then(function (perfil) {
      return window.RetoRpg.crearTarjeta(perfil);
    }).then(function (tarjeta) {
      var codigo = window.RetoRpg.aTexto(tarjeta);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(codigo).then(function () { decir('Código v2 copiado al portapapeles'); });
      } else {
        window.prompt('Copia este código:', codigo);
      }
    }).catch(function (e) { decir(e.message, true); });
  }

  function exportarDescargar() {
    if (!window.RetoRpg || !window.RetoRpg.crearTarjeta) { decir('RetoRpg no disponible', true); return; }
    window.RetoPerfil.obtener().then(function (perfil) {
      return window.RetoRpg.crearTarjeta(perfil);
    }).then(function (tarjeta) {
      var blob = new Blob([JSON.stringify(tarjeta, null, 1)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tarjeta-reto-' + (tarjeta.perfil.nombre || 'jugador').replace(/[^A-Za-z0-9_-]+/g, '_') + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      decir('Archivo v2 descargado');
    }).catch(function (e) { decir(e.message, true); });
  }

  function abrirModalImportar() {
    var modal = document.createElement('dialog');
    modal.className = 'dialogo';
    modal.style.cssText = 'max-width:480px;width:90%;background:var(--surface);color:var(--text);border:3px solid var(--borde-fuerte);border-radius:var(--radius);padding:0;';
    modal.innerHTML = '\
      <div style="padding:var(--space-lg);">\
        <h2 style="margin-top:0;">📥 Importar tarjeta</h2>\
        <p style="color:var(--muted);font-size:0.9rem;">Pega el código <code>RETO1.</code> o <code>RETO2.</code> o elige un archivo <code>.json</code>.</p>\
        <div class="ajustes-campo" style="margin-top:var(--space-md);">\
          <label for="importar-texto" style="display:block;margin-bottom:4px;font-weight:bold;">Código de la tarjeta</label>\
          <textarea id="importar-texto" class="editor-campo" rows="4" style="width:100%;font-family:monospace;font-size:0.85rem;" placeholder="RETO2.eyJ0aXBvIjoi..."></textarea>\
        </div>\
        <div class="ajustes-campo" style="margin-top:var(--space-md);">\
          <label for="importar-archivo" style="display:block;margin-bottom:4px;font-weight:bold;">O elige archivo .json</label>\
          <input type="file" id="importar-archivo" accept=".json,application/json" style="width:100%;display:block;padding:var(--space-sm);border:2px dashed var(--borde);border-radius:var(--radius);background:var(--bg);cursor:pointer;">\
        </div>\
        <p id="importar-error" class="config-estado es-error" role="alert" style="min-height:1.2em;"></p>\
        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-lg);">\
          <button type="button" class="boton" id="importar-cancelar">Cancelar</button>\
          <button type="button" class="boton boton--principal" id="importar-ok">Importar</button>\
        </div>\
      </div>';
    document.body.appendChild(modal);
    modal.showModal();
    modal.querySelector('#importar-cancelar').addEventListener('click', function () { modal.close(); modal.remove(); });
    modal.querySelector('#importar-ok').addEventListener('click', function () {
      var texto = modal.querySelector('#importar-texto').value.trim();
      var archivo = modal.querySelector('#importar-archivo').files[0];
      if (!texto && !archivo) { modal.querySelector('#importar-error').textContent = 'Pega el código o elige un archivo'; return; }
      var procesar = function (t) {
        if (!window.RetoRpg || !window.RetoRpg.leerTarjeta) { modal.querySelector('#importar-error').textContent = 'RetoRpg no disponible'; return; }
        window.RetoRpg.leerTarjeta(t).then(function (res) {
          modal.close(); modal.remove();
          var perfilImportado = (res && res.perfil) ? res.perfil : res;
          var tarjetaFecha = (res && res.tarjeta && res.tarjeta.fecha) || (res && res.fecha) || null;
          var nombreImportado = (perfilImportado && perfilImportado.nombre) ? perfilImportado.nombre : 'Jugador';
          if (window.RetoPerfil && window.RetoPerfil.obtener) {
            window.RetoPerfil.obtener().then(function (perfilActual) {
              var nuevoPerfil = Object.assign({}, perfilActual, perfilImportado, {
                usuario_id: (perfilImportado && perfilImportado.usuario_id) || perfilActual.usuario_id || 'importado',
                creado: tarjetaFecha || perfilActual.creado || new Date().toISOString().slice(0, 10)
              });
              window.RetoDatos && window.RetoDatos.poner('reto-perfil-usuario', nuevoPerfil).then(function () {
                decir('Tarjeta importada: ' + nombreImportado);
                setTimeout(recargarUI, 300);
              });
            });
          }
        }).catch(function (e) { modal.querySelector('#importar-error').textContent = e.message; });
      };
      if (archivo) {
        var rd = new FileReader();
        rd.onload = function () { procesar(String(rd.result)); };
        rd.readAsText(archivo);
      } else {
        procesar(texto);
      }
    });
  }

  /* ------------------------------------------------------------ Preview en vivo */
  function wirePreview() {
    // El preview se actualiza via evento 'reto-config-cambio'
  }

  function actualizarPreview() {
    var preview = refs.previewContenido;
    if (!preview) return;

    // Forzar repintado de los componentes de preview
    var botones = preview.querySelectorAll('.boton');
    botones.forEach(function (b) { b.style.display = 'none'; b.offsetHeight; b.style.display = ''; });

    var barras = preview.querySelectorAll('.duelo-barra-relleno');
    barras.forEach(function (b) { b.style.width = '0%'; b.offsetHeight; b.style.width = '60%'; });

    // Actualizar textos de estado
    var cfg = window.RetoConfigGlobal.obtener();
    var estado = preview.querySelector('.config-estado') || preview.querySelector('#config-preview-estado');
    if (estado) {
      estado.textContent = 'Preview: ' + cfg.tamanoBase + ', ' + cfg.fuenteSistema + ', anim: ' + cfg.animaciones + ', sonido: ' + (cfg.sonidoActivado ? cfg.sonidoVolumen + '%' : 'off');
    }
  }

  /* ------------------------------------------------------------ Recargar UI completa */
  function recargarUI() {
    wirePerfilesRapidos();
    wirePerfilesDetalle();
    wireFormularios();
    cargarFuentesEnSelect();
    actualizarPreview();
  }

  function decir(texto, error) {
    var el = $('#config-estado') || $('#config-preview-estado');
    if (el) {
      el.textContent = texto || '';
      el.className = 'config-estado' + (error ? ' es-error' : '');
    }
  }

  /* ------------------------------------------------------------ Arranque */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();