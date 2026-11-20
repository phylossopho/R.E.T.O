/* =========================================================================
   R.E.T.O. - API Local (fallback para GitHub Pages)
   =========================================================================
   Implementa localmente todos los endpoints /api/* que requieren servidor Python.
   Se carga antes que los módulos que usan fetch('/api/...') y los intercepta.
   ========================================================================= */
(function () {
  'use strict';

  function esGitHubPages() {
    var h = location.hostname;
    return h.includes('github.io') || h.includes('github.dev');
  }

  if (!esGitHubPages()) return; // Solo en GitHub Pages

  /* Utilidad: respuesta local simulada */
  function respuestaLocal(data) {
    return Promise.resolve({
      ok: true,
      json: function () { return Promise.resolve(data); }
    });
  }

  function errorLocal(msg, status) {
    return Promise.resolve({
      ok: false,
      status: status || 400,
      json: function () { return Promise.resolve({ error: msg }); }
    });
  }

  /* Intercepta fetch para /api/* */
  var originalFetch = window.fetch;
  window.fetch = function (url, options) {
    var urlStr = typeof url === 'string' ? url : url.url;
    if (!urlStr.startsWith('/api/')) return originalFetch.apply(this, arguments);

    var method = (options && options.method) || 'GET';
    var body = options && options.body ? JSON.parse(options.body) : {};

    // /api/rpg/premios - premios de tests
    if (urlStr === '/api/rpg/premios' && method === 'POST') {
      return premiarTestLocal(body.aciertos_antes, body.aciertos, body.entregados_antes, body.entregados_hoy);
    }

    // /api/rpg/tarjeta - crear tarjeta (ya no se usa, pero por compatibilidad)
    if (urlStr === '/api/rpg/tarjeta' && method === 'POST') {
      return respuestaLocal({ ok: true, tarjeta: body.perfil });
    }

    // /api/rpg/tarjeta/validar - validar tarjeta (ya no se usa)
    if (urlStr === '/api/rpg/tarjeta/validar' && method === 'POST') {
      return respuestaLocal(body.tarjeta);
    }

    // /api/tests/* - banco de tests
    if (urlStr.startsWith('/api/tests/')) {
      return apiTestsLocal(urlStr, method, body);
    }

    // /api/lectura/plan - plan de lectura veloz
    if (urlStr === '/api/lectura/plan' && method === 'POST') {
      return lecturaPlanLocal(body);
    }

    // /api/lectura/velocidad - calcular velocidad
    if (urlStr === '/api/lectura/velocidad' && method === 'POST') {
      return lecturaVelocidadLocal(body);
    }

    // /api/vision/* - ejercicios de visión
    if (urlStr.startsWith('/api/vision/')) {
      return respuestaLocal({ ok: true, data: 'vision local' });
    }

    // /api/secuencia, /api/schulte, /api/mahjong, /api/memorama, /api/ding, /api/pve, /api/sala
    if (urlStr.match(/^\/(api\/(secuencia|schulte|mahjong|memorama|ding|pve|sala))/)) {
      return respuestaLocal({ ok: true, data: 'local fallback' });
    }

    // /api/red/* - red local
    if (urlStr.startsWith('/api/red/')) {
      return respuestaLocal({ ok: true, data: 'red local' });
    }

    // /api/ejemplos
    if (urlStr === '/api/ejemplos') {
      return respuestaLocal({ ejemplos: [] });
    }

    return errorLocal('Endpoint no disponible en GitHub Pages: ' + urlStr, 405);
  };

  /* ---------- Implementaciones locales ---------- */

  function premiarTestLocal(aciertosAntes, aciertos, entregadosAntes, entregadosHoy) {
    var total = aciertosAntes + aciertos;
    var premiados = Math.floor(total / 10) - Math.floor(aciertosAntes / 10);
    var topeDia = entregadosHoy >= 10;
    var cupo = topeDia ? 0 : 10 - entregadosHoy;
    var premios = [];
    var powerups = [/* lista simplificada */'pocion_menor', 'reloj_de_arena', 'filo_afilado'];
    for (var i = 0; i < Math.min(premiados, cupo); i++) {
      premios.push(powerups[Math.floor(Math.random() * powerups.length)]);
    }
    return respuestaLocal({
      premios: premios,
      bloqueados: premiados - premios.length,
      aciertos_contados: aciertos,
      tope_dia: topeDia,
      cupo: cupo
    });
  }

  function apiTestsLocal(url, method, body) {
    if (url === '/api/tests/ronda' && method === 'POST') {
      // Ronda local ya implementada en reto-tests-banco.js
      return respuestaLocal({
        preguntas: body.preguntas.slice(0, body.cantidad).map(function (p, i) { return { id: p.id, orden: i }; }),
        resumen: {},
        semilla: Date.now().toString(36)
      });
    }
    if (url === '/api/tests/resumen' && method === 'POST') {
      // Resumen local ya implementado en reto-tests-banco.js
      var res = {};
      body.tests.forEach(function (t) {
        res[t.id] = { total: t.preguntas.length, nuevas: t.preguntas.length, por_repasar: 0, dominadas: 0, temas_debiles: [] };
      });
      return respuestaLocal(res);
    }
    if (url === '/api/tests/registrar' && method === 'POST') {
      // Registrar respuesta local
      var estado = body.estado || 0;
      estado = body.acierto ? Math.min(3, estado + 1) : Math.max(0, estado - 1);
      return respuestaLocal({ estado: estado });
    }
    return errorLocal('Tests endpoint no implementado localmente', 405);
  }

  function lecturaPlanLocal(body) {
    // Genera plan simple local
    var parrafos = body.parrafos || [];
    var ejercicios = parrafos.map(function (p, i) {
      return { texto: p.texto || p, orden: i, tipo: 'palabra' };
    });
    return respuestaLocal({ ejercicios: ejercicios });
  }

  function lecturaVelocidadLocal(body) {
    // Calcula WPM simple
    var palabras = (body.texto || '').split(/\s+/).length;
    var tiempo = body.tiempo || 60;
    var wpm = Math.round(palabras / (tiempo / 60));
    return respuestaLocal({ wpm: wpm, palabras: palabras, tiempo: tiempo });
  }

  /* Exponer para pruebas */
  window.RetoApiLocal = {
    premiarTestLocal: premiarTestLocal,
    apiTestsLocal: apiTestsLocal,
    lecturaPlanLocal: lecturaPlanLocal,
    lecturaVelocidadLocal: lecturaVelocidadLocal
  };

})();