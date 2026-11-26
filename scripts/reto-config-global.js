/* =========================================================================
   R.E.T.O. - Configuración Global Unificada
   -------------------------------------------------------------------------
   Única fuente de verdad para: tema, tipografía, tamaño base, animaciones,
   sonido, perfiles de accesibilidad y overrides por módulo.
   Todos los módulos importan esto y heredan por defecto.
   ========================================================================= */
(function (window) {
  'use strict';

  var CLAVE = 'reto-config-global';
  var CLAVE_PERFIL = 'reto-perfil-usuario';

  /* ------------------------------------------------------------ Valores por defecto */
  var POR_DEFECTO = {
    // Tema y colores
    tema: 'sistema',              // 'claro' | 'oscuro' | 'sistema'
    colorPrimario: '#16445a',     // Color principal (botones, enlaces, acentos)
    colorAcento: '#e8a838',       // Color de acento (progreso, highlights)
    fondoEstilo: 'liso',          // 'liso' | 'puntos' | 'diagonales'

    // Tipografía
    fuenteSistema: 'nunito',      // 'nunito' | 'atkinson' | 'lexend' | 'opendyslexic' | 'merriweather' | 'roboto-mono' | 'orbitron' | usuario
    tamanoBase: 'mediano',        // 'pequeno' | 'mediano' | 'grande' | 'xl'
    interlineadoBase: 'normal',   // 'normal' | 'amplio'
    anchoLinea: 'normal',         // 'estrecha' | 'normal' | 'completa'
    espaciadoLetras: 'normal',    // 'normal' | 'amplio'

    // Animaciones (respeta prefers-reduced-motion del sistema)
    animaciones: 'estandar',      // 'off' | 'reducido' | 'estandar' | 'expresivo'

    // Sonido
    sonidoActivado: true,
    sonidoVolumen: 50,            // 0-100
    sonidoTipo: 'ding',           // 'ding' | 'charm' | 'soft' | 'ninguno'
    vozPreferida: '',             // nombre de voz TTS

    // Perfiles de accesibilidad (aplican todo lo de arriba en 1 clic)
    perfilActivo: '',             // '' | 'calma' | 'vista' | 'lectura' | 'atencion' | 'escuchar' | 'sinsonido'

    // Overrides por módulo (solo lo que difiere del global)
    overrides: {
      lectura: {},                // ej: { colorFoco: '#ff0000', interlineado: 'amplio' }
      tests: {},                  // ej: { confirmar: 'on', columna: 'estrecha' }
      minijuegos: {},             // ej: { sonido: false }
      vision: {},                 // ej: { velocidad: 'lenta' }
      rpg: {},                    // ej: { layout: 'clasico' }
      duelo: {},                  // ej: { tamPreguntas: 'peq' }
      panel: {}                   // ej: { pos: 'arriba', tam: 'grande' }
    }
  };

  var PERFILES = {
    calma: {
      nombre: 'Tranquilo',
      ayuda: 'Sin movimiento ni racha, sonido bajito, líneas cortas y confirmando cada respuesta.',
      config: {
        animaciones: 'off',
        sonidoActivado: true,
        sonidoVolumen: 25,
        sonidoTipo: 'soft',
        anchoLinea: 'estrecha',
        // tests overrides
        overrides: {
          tests: { confirmar: 'on', racha: 'off', siguiente: 'yo', espera: '1500' }
        }
      }
    },
    vista: {
      nombre: 'Ver mejor',
      ayuda: 'Letra muy grande, contornos gruesos y una fuente clara.',
      config: {
        fuenteSistema: 'atkinson',
        tamanoBase: 'xl',
        interlineadoBase: 'amplio',
        espaciadoLetras: 'amplio',
        // CSS adicional se aplica via clase en html
      }
    },
    lectura: {
      nombre: 'Lectura',
      ayuda: 'Fuente abierta, más espacio entre letras y líneas cortas.',
      config: {
        fuenteSistema: 'lexend',
        tamanoBase: 'grande',
        espaciadoLetras: 'amplio',
        anchoLinea: 'estrecha',
        interlineadoBase: 'amplio',
      }
    },
    atencion: {
      nombre: 'Atención',
      ayuda: 'Refuerzo al acertar (verde y racha), la siguiente pregunta sola y el avance a la vista.',
      config: {
        animaciones: 'estandar',
        sonidoActivado: true,
        sonidoVolumen: 50,
        anchoLinea: 'estrecha',
        overrides: {
          tests: { columna: 'estrecha', movimiento: 'on', avance: 'on', acierto: 'on', racha: 'on', siguiente: 'sola', confirmar: 'off', espera: '800' }
        }
      }
    },
    escuchar: {
      nombre: 'Escuchar',
      ayuda: 'Cada pregunta se lee sola, se confirma la respuesta y nada avanza solo.',
      config: {
        overrides: {
          tests: { escuchar: 'on', leerSola: 'on', confirmar: 'on', siguiente: 'yo', sonidoActivado: true, sonidoVolumen: 75 }
        }
      }
    },
    sinsonido: {
      nombre: 'Sin sonido',
      ayuda: 'Nada suena, ni siquiera al acertar.',
      config: {
        sonidoActivado: false,
        overrides: { tests: { sonidoActivado: false } }
      }
    }
  };

  /* ------------------------------------------------------------ Utilidades de almacenamiento */
  function leer(clave, defecto) {
    try {
      var v = localStorage.getItem(clave);
      return v === null ? defecto : JSON.parse(v);
    } catch (e) {
      return defecto;
    }
  }

  function escribir(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (e) {
      return false;
    }
  }

  function deepMerge(target, source) {
    var out = Object.assign({}, target);
    Object.keys(source).forEach(function (k) {
      if (source[k] !== null && typeof source[k] === 'object' && !Array.isArray(source[k])) {
        out[k] = deepMerge(target[k] || {}, source[k]);
      } else if (source[k] !== undefined) {
        out[k] = source[k];
      }
    });
    return out;
  }

  /* ------------------------------------------------------------ Aplicar al DOM (CSS variables + data-attrs) */
  function aplicarAlDOM(cfg) {
    var h = document.documentElement;

    // Tema
    var tema = cfg.tema;
    if (tema === 'sistema') {
      tema = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
    }
    h.setAttribute('data-theme', tema);
    h.setAttribute('data-fondo', cfg.fondoEstilo);

    // Colores
    h.style.setProperty('--color-primario', cfg.colorPrimario);
    h.style.setProperty('--color-acento', cfg.colorAcento);

    // Tipografía
    h.style.setProperty('--fuente-sistema', '"' + cfg.fuenteSistema + '", system-ui, sans-serif');
    var tamanos = { pequen: '0.85', mediano: '1', grande: '1.25', xl: '1.5' };
    h.style.setProperty('--tamano-base', tamanos[cfg.tamanoBase] || '1');
    h.style.setProperty('--interlineado-base', cfg.interlineadoBase === 'amplio' ? '1.7' : '1.5');
    h.style.setProperty('--ancho-linea', cfg.anchoLinea === 'estrecha' ? '55ch' : (cfg.anchoLinea === 'completa' ? '100%' : '75ch'));
    h.style.setProperty('--espaciado-letras', cfg.espaciadoLetras === 'amplio' ? '0.05em' : '0');

    // Animaciones
    var animMap = {
      off: 'off',
      reducido: 'reducido',
      estandar: 'estandar',
      expresivo: 'expresivo'
    };
    h.setAttribute('data-anim', animMap[cfg.animaciones] || 'estandar');
    h.setAttribute('data-anim-nivel', animMap[cfg.animaciones] || 'estandar');
    h.setAttribute('data-anim-hover', animMap[cfg.animaciones] || 'estandar');
    h.setAttribute('data-anim-accion', animMap[cfg.animaciones] || 'estandar');
    h.setAttribute('data-anim-panel', animMap[cfg.animaciones] || 'estandar');

    // Respeta prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      h.setAttribute('data-anim', 'off');
      h.setAttribute('data-anim-nivel', 'off');
      h.setAttribute('data-anim-hover', 'off');
      h.setAttribute('data-anim-accion', 'off');
      h.setAttribute('data-anim-panel', 'off');
    }

    // Sonido (guarda en localStorage para reto-sonido.js)
    localStorage.setItem('sonido_activado', cfg.sonidoActivado ? 'on' : 'off');
    localStorage.setItem('sonido_volumen', String(cfg.sonidoVolumen));
    localStorage.setItem('sonido_tipo', cfg.sonidoTipo);
    if (cfg.vozPreferida) localStorage.setItem('voz_preferida', cfg.vozPreferida);

    // Perfil activo (para UI)
    h.setAttribute('data-perfil-activo', cfg.perfilActivo || '');

    // Clases de accesibilidad
    if (cfg.tamanoBase === 'xl' || cfg.espaciadoLetras === 'amplio') {
      h.classList.add('accesibilidad-alta');
    } else {
      h.classList.remove('accesibilidad-alta');
    }
    if (cfg.animaciones === 'off') {
      h.classList.add('sin-animaciones');
    } else {
      h.classList.remove('sin-animaciones');
    }
  }

  /* ------------------------------------------------------------ API Pública */
  function obtener() {
    var guardado = leer(CLAVE, {});
    return deepMerge(POR_DEFECTO, guardado);
  }

  function obtenerPerfiles() {
    return PERFILES;
  }

  function guardar(parcial) {
    var actual = obtener();
    var nuevo = deepMerge(actual, parcial);
    escribir(CLAVE, nuevo);
    aplicarAlDOM(nuevo);
    window.dispatchEvent(new CustomEvent('reto-config-cambio', { detail: nuevo }));
    return nuevo;
  }

  function aplicarPerfil(id) {
    var perfil = PERFILES[id];
    if (!perfil) return false;
    var cfg = deepMerge(POR_DEFECTO, perfil.config);
    cfg.perfilActivo = id;
    guardar(cfg);
    return true;
  }

  function obtenerOverride(modulo) {
    var cfg = obtener();
    return cfg.overrides[modulo] || {};
  }

  function guardarOverride(modulo, override) {
    var cfg = obtener();
    cfg.overrides[modulo] = Object.assign({}, cfg.overrides[modulo], override);
    guardar(cfg);
  }

  function restablecer() {
    localStorage.removeItem(CLAVE);
    var cfg = POR_DEFECTO;
    aplicarAlDOM(cfg);
    window.dispatchEvent(new CustomEvent('reto-config-cambio', { detail: cfg }));
    return cfg;
  }

  // Inicialización automática al cargar
  document.addEventListener('DOMContentLoaded', function () {
    var cfg = obtener();
    aplicarAlDOM(cfg);

    // Escucha cambios en otras pestañas
    window.addEventListener('storage', function (e) {
      if (e.key === CLAVE) {
        var cfg = obtener();
        aplicarAlDOM(cfg);
      }
    });

    // Respeta prefers-reduced-motion dinámico
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq.addEventListener) {
        mq.addEventListener('change', function () {
          var cfg = obtener();
          aplicarAlDOM(cfg);
        });
      }
    }
  });

  window.RetoConfigGlobal = {
    obtener: obtener,
    obtenerPerfiles: obtenerPerfiles,
    guardar: guardar,
    aplicarPerfil: aplicarPerfil,
    obtenerOverride: obtenerOverride,
    guardarOverride: guardarOverride,
    restablecer: restablecer,
    POR_DEFECTO: POR_DEFECTO,
    PERFILES: PERFILES
  };
})(window);