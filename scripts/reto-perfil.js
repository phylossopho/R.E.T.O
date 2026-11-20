/* =========================================================================
   R.E.T.O. - Perfil de usuario (identidad + tiempo + configuración)
   -------------------------------------------------------------------------
   Un perfil por origen (cada URL = IndexedDB distinto). Se crea en la
   primera visita y se actualiza al terminar cada tarea.
   ========================================================================= */
(function (window) {
  'use strict';

  var CLAVE_PERFIL = 'reto-perfil-usuario';
  var CLAVE_TARJETA_DUELO = 'duelo_tarjeta';

  function datos() { return window.RetoDatos || null; }

  function leer(clave, defecto) {
    if (!datos()) return Promise.resolve(defecto);
    return datos().obtener(clave).then(function (v) {
      return v === undefined || v === null ? defecto : v;
    }).catch(function () { return defecto; });
  }

  function escribir(clave, valor) {
    return datos() ? datos().poner(clave, valor) : Promise.resolve();
  }

  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function perfilPorDefecto(nombre) {
    return {
      usuario_id: uuidv4(),
      nombre: String(nombre || 'Jugador').slice(0, 24),
      creado: new Date().toISOString(),
      tiempo_por_modulo: {
        lectura: {},
        vision: {},
        rpg: { pve: 0, pvp: 0 },
        duelo: 0,
        minijuegos: {},
        total: 0
      },
      nivel: 0,
      puntos: 0,
      powerups: {
        inventario: [],
        equipo: [],
        aciertos: 0,
        entregados: 0,
        premios_dia: {}
      },
      config: {}
    };
  }

  function formatearTiempo(minutos) {
    if (!minutos || minutos < 1) return '< 1 min';
    var h = Math.floor(minutos / 60);
    var m = Math.round(minutos % 60);
    return h ? h + 'h ' + m + 'm' : m + ' min';
  }

  function recalcularTotal(tpm) {
    var total = 0;
    Object.keys(tpm).forEach(function (k) {
      var v = tpm[k];
      if (typeof v === 'number') total += v;
      else if (v && typeof v === 'object') Object.keys(v).forEach(function (sk) { total += v[sk] || 0; });
    });
    return Math.round(total * 10) / 10;
  }

  function sumarTiempoModulo(modulo, submodulo, minutos) {
    return leer(CLAVE_PERFIL, null).then(function (perfil) {
      if (!perfil) return;
      var m = perfil.tiempo_por_modulo;
      // Asegurar que los contenedores existan (perfiles antiguos)
      if (modulo === 'lectura' || modulo === 'vision' || modulo === 'minijuegos') {
        if (!m[modulo] || typeof m[modulo] !== 'object') m[modulo] = {};
        m[modulo][submodulo] = Math.round((m[modulo][submodulo] || 0) + minutos * 10) / 10;
      } else if (modulo === 'rpg') {
        if (!m.rpg || typeof m.rpg !== 'object') m.rpg = { pve: 0, pvp: 0 };
        m.rpg[submodulo] = Math.round((m.rpg[submodulo] || 0) + minutos * 10) / 10;
      } else if (modulo === 'duelo') {
        if (typeof m.duelo !== 'number') m.duelo = 0;
        m.duelo = Math.round((m.duelo || 0) + minutos * 10) / 10;
      }
      if (typeof m.total !== 'number') m.total = 0;
      m.total = recalcularTotal(m);
      return escribir(CLAVE_PERFIL, perfil);
    });
  }

  function actualizarPuntosYPuntos(puntos, nivel) {
    return leer(CLAVE_PERFIL, null).then(function (perfil) {
      if (!perfil) return;
      perfil.puntos = Math.round(puntos * 10) / 10;
      perfil.nivel = Math.max(0, Math.floor(nivel));
      return escribir(CLAVE_PERFIL, perfil);
    });
  }

  function actualizarPowerups(cambios) {
    return leer(CLAVE_PERFIL, null).then(function (perfil) {
      if (!perfil) return;
      var p = perfil.powerups;
      if (typeof cambios.aciertos === 'number') p.aciertos = Math.max(0, p.aciertos + cambios.aciertos);
      if (typeof cambios.entregados === 'number') p.entregados = Math.max(0, p.entregados + cambios.entregados);
      if (Array.isArray(cambios.inventario)) p.inventario = cambios.inventario.slice(0, 12);
      if (Array.isArray(cambios.equipo)) p.equipo = cambios.equipo.slice(0, 6);
      if (cambios.premios_dia) p.premios_dia = cambios.premios_dia;
      return escribir(CLAVE_PERFIL, perfil);
    });
  }

  function actualizarConfig(config) {
    return leer(CLAVE_PERFIL, null).then(function (perfil) {
      if (!perfil) return;
      perfil.config = Object.assign({}, perfil.config, config);
      return escribir(CLAVE_PERFIL, perfil);
    });
  }

  function obtenerPerfil() {
    return leer(CLAVE_PERFIL, null);
  }

  function hayPerfil() {
    return leer(CLAVE_PERFIL, null).then(function (p) { return !!p; });
  }

  function crearPerfil(nombre) {
    var perfil = perfilPorDefecto(nombre);
    return escribir(CLAVE_PERFIL, perfil).then(function () { return perfil; });
  }

  function mostrarToastBienvenida(nombre) {
    var contenedor = document.createElement('div');
    contenedor.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:10000;pointer-events:none;';
    contenedor.innerHTML = '<div style="background:var(--surface);color:var(--text);border:3px solid var(--accent);border-radius:var(--radius);padding:12px 24px;box-shadow:var(--sombra);font-family:var(--font);font-size:1rem;display:flex;align-items:center;gap:8px;">' +
      '<span aria-hidden="true">👋</span>' +
      '<span>¡Bienvenid' + (nombre && nombre.slice(-1).toLowerCase() === 'a' ? 'a' : 'o') + ', ' + (nombre || 'Jugador') + '!</span>' +
      '</div>';
    document.body.appendChild(contenedor);
    setTimeout(function () {
      contenedor.style.opacity = '0';
      contenedor.style.transition = 'opacity 0.3s';
      setTimeout(function () { contenedor.remove(); }, 300);
    }, 1000);
  }

  function initGate(contenedorRaiz) {
    return hayPerfil().then(function (existe) {
      if (existe) return { existe: true };
      return { existe: false };
    });
  }

  function renderBienvenida(contenedor, onListo) {
    vaciar(contenedor);
    var caja = document.createElement('section');
    caja.className = 'bienvenida-caja';
    caja.style.cssText = 'max-width:420px;margin:0 auto;padding:var(--space-xl);text-align:center;';
    caja.innerHTML = '\
      <div style="font-size:4rem;margin-bottom:var(--space-md);">🎓</div>\
      <h1 style="margin-bottom:var(--space-xs);">Bienvenido a R.E.T.O.</h1>\
      <p style="color:var(--muted);margin-bottom:var(--space-lg);line-height:1.6;">\
        Refuerzo · Estudio · Test · Organización\
      </p>\
      <p style="color:var(--muted);margin-bottom:var(--space-lg);font-size:0.9rem;">\
        Escribe tu nombre para empezar. Tu progreso, configuración y power-ups se guardan en este navegador.\
      </p>\
      <div class="ajustes-campo" style="max-width:300px;margin:0 auto;">\
        <label for="bienvenida-nombre" style="display:block;text-align:left;margin-bottom:4px;font-weight:bold;">Tu nombre</label>\
        <input type="text" id="bienvenida-nombre" class="editor-campo" maxlength="24" autocomplete="nickname" placeholder="Ej: Ana" style="width:100%;padding:12px;border:2px solid var(--borde-fuerte);border-radius:var(--radius);font-family:inherit;font-size:1rem;">\
      </div>\
      <p id="bienvenida-error" class="red-error" role="alert" style="min-height:1.2em;margin-top:var(--space-sm);"></p>\
      <button type="button" id="btn-entrar" class="boton boton--principal" style="margin-top:var(--space-lg);padding:14px 32px;font-size:1.1rem;width:100%;max-width:300px;">Entrar</button>\
    ';
    contenedor.appendChild(caja);

    var input = caja.querySelector('#bienvenida-nombre');
    var errorEl = caja.querySelector('#bienvenida-error');
    var btn = caja.querySelector('#btn-entrar');

    input.focus();
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });

    btn.addEventListener('click', function () {
      var nombre = input.value.trim();
      if (!nombre) { errorEl.textContent = 'Escribe tu nombre'; return; }
      if (nombre.length > 24) { errorEl.textContent = 'Máximo 24 caracteres'; return; }
      errorEl.textContent = '';
      btn.disabled = true; btn.textContent = 'Entrando...';
      crearPerfil(nombre).then(function (perfil) {
        mostrarToastBienvenida(perfil.nombre);
        if (onListo) onListo(perfil);
      }).catch(function (e) {
        errorEl.textContent = e.message || 'No se pudo crear el perfil';
        btn.disabled = false; btn.textContent = 'Entrar';
      });
    });
  }

  function vaciar(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  window.RetoPerfil = {
    obtener: obtenerPerfil,
    hayPerfil: hayPerfil,
    crear: crearPerfil,
    sumarTiempo: sumarTiempoModulo,
    actualizarPuntos: actualizarPuntosYPuntos,
    actualizarPowerups: actualizarPowerups,
    actualizarConfig: actualizarConfig,
    initGate: initGate,
    renderBienvenida: renderBienvenida,
    formatearTiempo: formatearTiempo,
    recalcularTotalTiempo: function () {
      return leer(CLAVE_PERFIL, null).then(function (perfil) {
        if (!perfil) return;
        perfil.tiempo_por_modulo.total = recalcularTotal(perfil.tiempo_por_modulo);
        return escribir(CLAVE_PERFIL, perfil);
      });
    },
    // Migración: arregla perfiles antiguos que no tienen estructura completa
    migrarPerfil: function () {
      return leer(CLAVE_PERFIL, null).then(function (perfil) {
        if (!perfil) return { migrated: false, reason: 'no profile' };
        var m = perfil.tiempo_por_modulo || {};
        var changed = false;
        ['lectura', 'vision', 'minijuegos'].forEach(function (k) {
          if (!m[k] || typeof m[k] !== 'object') { m[k] = {}; changed = true; }
        });
        if (!m.rpg || typeof m.rpg !== 'object') { m.rpg = { pve: 0, pvp: 0 }; changed = true; }
        if (typeof m.duelo !== 'number') { m.duelo = 0; changed = true; }
        if (typeof m.total !== 'number') { m.total = 0; changed = true; }
        if (changed) {
          m.total = recalcularTotal(m);
          perfil.tiempo_por_modulo = m;
          return escribir(CLAVE_PERFIL, perfil).then(function () ({ migrated: true }));
        }
        return { migrated: false, reason: 'already ok' };
      });
    },
    CLAVE_PERFIL: CLAVE_PERFIL,
    CLAVE_TARJETA_DUELO: CLAVE_TARJETA_DUELO
  };
})(window);