/* =========================================================================
   R.E.T.O. - La "API" que corre en el navegador (reto-api.js)
   -------------------------------------------------------------------------
   Antes, server.py (Flask) respondía las llamadas fetch('/api/...'). Ahora el
   sitio es estático (GitHub Pages) y esas mismas rutas las responde ESTE
   archivo, con las reglas de scripts/logica/*.js (portadas de Python y
   verificadas contra el original: ver tests/paridad_*.test.js).

   Las páginas NO cambian: siguen llamando fetch('/api/lectura/plan', ...) y
   reciben la misma respuesta (mismo JSON, mismos códigos 400/404/403).

   TAMBIÉN ARREGLA LAS RUTAS DEL SITIO
   GitHub Pages sirve un proyecto en https://usuario.github.io/REPO/, así que
   fetch('/datos/x.json') (raíz) caería fuera del sitio. Aquí se reescribe a la
   carpeta del sitio, que se deduce de dónde se cargó este mismo script.

   MULTIJUGADOR (duelo, Ding!, prueba de red)
   Las salas viven en el dispositivo que las crea ("anfitrión"). Los demás le
   hablan por una conexión directa (scripts/reto-conexion.js) y reciben las
   mismas respuestas que daba el servidor.
   ========================================================================= */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var api = fabrica(nodo);
  if (nodo) module.exports = api;
  else api.arrancar(raiz);
})(typeof self !== 'undefined' ? self : this, function (nodo) {
  'use strict';

  var VERSION = 'estatico-1';
  var MAX_CUERPO = 300 * 1024;
  var MAX_PARTIDAS = 60;
  var RUTAS_PUBLICAS = /^\/(datos|imagenes|sonidos|styles|scripts|categorias|pwa|ejemplos)\//;

  // Qué scripts de scripts/logica/ necesita cada familia de rutas (en orden de dependencia).
  var DEPENDENCIAS = {
    lectura: ['lectura_veloz'], vision: ['lectura_veloz', 'vision'], schulte: ['schulte'], secuencia: ['secuencia'],
    mahjong: ['secuencia', 'mahjong'], memorama: ['memorama'], tests: ['rondas', 'dinamicas'], rpg: ['rpg'],
    pve: ['red', 'rpg', 'pve'], sala: ['red', 'rpg', 'sala'], ding: ['red', 'dinamicas', 'sala', 'ding'], red: ['red']
  };

  function respuestaJson(estado, cuerpo) {
    return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }

  /* ------------------------------------------------------------------
     crearApi: toda la lógica del enrutador, sin tocar el navegador.
     entorno = {
       base:          URL de la carpeta del sitio (termina en "/"),
       cargarLogica:  function(nombre) -> Promise<módulo>   (scripts/logica/<nombre>.js)
       leerJson:      function(rutaRelativa) -> Promise<objeto>   (datos/...)
       ahora:         function() -> segundos (opcional)
     }
     ------------------------------------------------------------------ */
  function crearApi(entorno) {
    var base = entorno.base;
    var memoria = {};            // módulos ya cargados
    var estado = { salas: null, dings: null, aventuras: null, eco: null, partidas: {}, contador: 0 };
    var conexion = null;         // se registra desde reto-conexion.js
    var alCrearSala = [];

    function url(p) { return base + String(p).replace(/^\/+/, ''); }

    function modulo(nombre) {
      if (memoria[nombre]) return Promise.resolve(memoria[nombre]);
      return Promise.resolve(entorno.cargarLogica(nombre)).then(function (m) { memoria[nombre] = m; return m; });
    }
    function cargar(familia) {
      var lista = DEPENDENCIAS[familia] || [], salida = {}, p = Promise.resolve();
      lista.forEach(function (n) { p = p.then(function () { return modulo(n); }).then(function (m) { salida[n] = m; }); });
      return p.then(function () {
        if (lista.indexOf('rpg') < 0) return salida;
        return Promise.all([entorno.leerJson('datos/powerups.json'), entorno.leerJson('datos/powerups_textos.json')]).then(function (d) {
          salida.rpg.cargarDatos(d[0], d[1]);
          return salida;
        });
      });
    }
    function ahoraS() { return entorno.ahora ? entorno.ahora() : Date.now() / 1000; }

    // Las salas, aventuras y el eco existen una sola vez por pestaña.
    function instancia(clave, familia, crear) {
      if (estado[clave]) return Promise.resolve(estado[clave]);
      return cargar(familia).then(function (m) { estado[clave] = crear(m); return estado[clave]; });
    }
    function salas() { return instancia('salas', 'sala', function (m) { return new m.sala.Salas({ reloj: ahoraS }); }); }
    function dings() { return instancia('dings', 'ding', function (m) { return new m.ding.Dings({ reloj: ahoraS }); }); }
    function aventuras() { return instancia('aventuras', 'pve', function (m) { return new m.pve.Aventuras({ reloj: ahoraS }); }); }
    function eco() { return instancia('eco', 'red', function (m) { return new m.red.Eco(); }); }

    /* ---------------- respuestas de error como las de Flask ---------------- */
    function aError(e, familia) {
      if (e && e.name === 'ErrorSala' || e && e.name === 'ErrorPve') return { status: e.http || 400, body: { error: e.message } };
      if (e && e.name === 'ValueError') return { status: 400, body: { error: e.message } };
      if (typeof console !== 'undefined') console.error('[RetoApi] error interno en ' + familia + ':', e);
      return { status: 500, body: { error: 'Algo falló dentro del sitio. Recarga la página.' } };
    }
    function ok(cuerpo) { return { status: 200, body: cuerpo }; }
    function malo(msg, status) { return { status: status || 400, body: { error: msg } }; }
    function v(d, k, def) { return d[k] === undefined ? def : d[k]; }
    function cuerpoObj(c) { return c && typeof c === 'object' && !Array.isArray(c) ? c : {}; }
    function enteroDe(x) { return Math.trunc(x); }
    function hoy() { var d = new Date(); function z(n) { return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }

    /* ---------------- rutas de archivos de índice ---------------- */
    function prefijar(u) { return typeof u === 'string' && !/^([a-z]+:|\/)/i.test(u) ? url(u) : (typeof u === 'string' && u.charAt(0) === '/' ? url(u) : u); }

    /* ---------------- el despachador ---------------- */
    // peticion = { metodo: 'GET'|'POST', ruta: '/api/...', consulta: {k:v}, cuerpo: {...}, origen: 'local'|id de enlace }
    function manejar(peticion) {
      var metodo = peticion.metodo, ruta = peticion.ruta, q = peticion.consulta || {}, d = cuerpoObj(peticion.cuerpo), m;

      if (metodo === 'GET' && ruta === '/api/ejemplos') {
        return entorno.leerJson('datos/ejemplos.json').then(ok, function () { return ok({ ejemplos: [] }); });
      }

      /* ---- rpg ---- */
      if (ruta.indexOf('/api/rpg/') === 0) {
        if (metodo === 'GET' && ruta === '/api/rpg/fondos')
          return entorno.leerJson('datos/fondos.json').then(function (j) { return ok({ fondos: (j.fondos || []).map(prefijar) }); }, function () { return ok({ fondos: [] }); });
        if (metodo === 'GET' && ruta === '/api/rpg/sprites')
          return entorno.leerJson('datos/sprites.json').then(function (j) {
            var mapa = {}, s = j.sprites || {};
            Object.keys(s).forEach(function (p) { mapa[p] = {}; Object.keys(s[p]).forEach(function (vista) { mapa[p][vista] = {};
              Object.keys(s[p][vista]).forEach(function (e) { mapa[p][vista][e] = s[p][vista][e].map(prefijar); }); }); });
            return ok({ sprites: mapa });
          }, function () { return ok({ sprites: {} }); });
        if (metodo === 'GET' && ruta === '/api/rpg/incognito')
          return entorno.leerJson('datos/incognito.json').then(function (j) { return ok({ imagen: j.imagen ? prefijar(j.imagen) : null }); }, function () { return ok({ imagen: null }); });
        return cargar('rpg').then(function (mm) {
          var rpg = mm.rpg;
          if (metodo === 'POST' && ruta === '/api/rpg/tarjeta') return ok(rpg.crear_tarjeta(d.perfil, hoy()));
          if (metodo === 'POST' && ruta === '/api/rpg/tarjeta/validar') return ok(rpg.validar_tarjeta(d.tarjeta));
          if (metodo === 'POST' && ruta === '/api/rpg/nivel') {
            if (!Array.isArray(d.sesiones) || d.sesiones.length > 2000) return malo('Faltan las sesiones.');
            return ok(rpg.progreso_de_nivel(rpg.puntos_de_sesiones(d.sesiones)));
          }
          if (metodo === 'POST' && ruta === '/api/rpg/premios') {
            return modulo('_base').then(function (Bm) {
              var antes, nuevos, entregados, hoyN;
              try {
                antes = Math.max(0, Bm.aInt(Bm.pyBool(d.aciertos_antes) ? d.aciertos_antes : 0));
                nuevos = Math.max(0, Math.min(200, Bm.aInt(Bm.pyBool(d.aciertos) ? d.aciertos : 0)));
                entregados = Math.max(0, Bm.aInt(Bm.pyBool(d.entregados_antes) ? d.entregados_antes : 0));
                hoyN = Math.max(0, Bm.aInt(Bm.pyBool(d.entregados_hoy) ? d.entregados_hoy : 0));
              } catch (e) { return malo('Los números no se entienden.'); }
              if (rpg.TOPE_PREMIOS_DIA - hoyN <= 0) return ok({ premios: [], bloqueados: 0, cupo: 0, aciertos_contados: 0, tope_dia: rpg.TOPE_PREMIOS_DIA });
              var PyRandom = (typeof RetoAzar !== 'undefined' ? RetoAzar : require('./reto-azar.js')).PyRandom;
              var r = rpg.sortear_premios(antes, antes + nuevos, new PyRandom(), true, entregados, hoyN);
              r.aciertos_contados = nuevos; r.tope_dia = rpg.TOPE_PREMIOS_DIA;
              return ok(r);
            });
          }
          return malo('No existe esa ruta.', 404);
        }).catch(function (e) { return aError(e, 'rpg'); });
      }

      /* ---- visión ---- */
      if (ruta === '/api/vision/plan' || ruta === '/api/vision/ajustar') {
        return cargar('vision').then(function (mm) {
          return ok(ruta === '/api/vision/plan' ? mm.vision.plan_para(d.ejercicio, d) : mm.vision.ajustar_para(d.ejercicio, d));
        }).catch(function (e) { return aError(e, 'vision'); });
      }

      /* ---- lectura ---- */
      if (ruta === '/api/lectura/plan' || ruta === '/api/lectura/velocidad') {
        return cargar('lectura').then(function (mm) {
          var lv = mm.lectura_veloz;
          if (ruta === '/api/lectura/velocidad') return ok(lv.calcular_velocidad(d.palabras, d.segundos, d.aciertos, d.preguntas));
          var motor = d.motor;
          var PLANES = { galactico: lv.plan_galactico, palabra: lv.plan_palabra, grupo: lv.plan_grupo, frases: lv.plan_frases,
            prueba: lv.plan_prueba, pacer: lv.plan_pacer, columnas: lv.plan_pacer, skimming: lv.plan_skimming };
          if (typeof motor !== 'string' || !Object.prototype.hasOwnProperty.call(PLANES, motor)) return malo('ese motor todavía no está listo');
          if (motor === 'grupo') return ok(lv.plan_grupo(d.parrafos, (d.tamano_grupo === 3 || d.tamano_grupo === 4) ? d.tamano_grupo : undefined));
          if (motor === 'pacer' || motor === 'columnas') return ok(lv.plan_pacer(d.parrafos, lv.TRAMOS_PACER.indexOf(d.palabras_por_tramo) >= 0 ? d.palabras_por_tramo : undefined));
          return ok(PLANES[motor](d.parrafos));
        }).catch(function (e) { return aError(e, 'lectura'); });
      }

      /* ---- schulte, secuencia, mahjong ---- */
      if (ruta === '/api/schulte/catalogos') return cargar('schulte').then(function (mm) { return ok(mm.schulte.catalogos()); });
      if (ruta === '/api/schulte/nueva') return cargar('schulte').then(function (mm) {
        return ok(mm.schulte.nueva_tabla(v(d, 'tamano', '3x3'), v(d, 'contenido', 'numeros'), d.semilla === null ? undefined : d.semilla));
      }).catch(function (e) { return aError(e, 'schulte'); });
      if (ruta === '/api/secuencia/catalogos') return cargar('secuencia').then(function (mm) { return ok(mm.secuencia.catalogos()); });
      if (ruta === '/api/secuencia/nueva') return cargar('secuencia').then(function (mm) {
        return ok(mm.secuencia.nueva_secuencia(v(d, 'botones', '4'), v(d, 'largo', 8), d.semilla));
      }).catch(function (e) { return aError(e, 'secuencia'); });
      if (ruta === '/api/mahjong/catalogos') return cargar('mahjong').then(function (mm) { return ok(mm.mahjong.catalogos()); });
      if (ruta === '/api/mahjong/nueva') return cargar('mahjong').then(function (mm) {
        return ok(mm.mahjong.nueva_partida(v(d, 'nivel', 'facil'), d.semilla));
      }).catch(function (e) { return aError(e, 'mahjong'); });
      if (ruta === '/api/mahjong/revolver') return cargar('mahjong').then(function (mm) {
        return ok({ fichas: mm.mahjong.revolver(d.fichas, d.semilla) });
      }).catch(function (e) { return aError(e, 'mahjong'); });

      /* ---- tests ---- */
      if (ruta.indexOf('/api/tests/') === 0) {
        return Promise.all([cargar('tests'), modulo('_base')]).then(function (xx) {
          var mm = xx[0], rondas = mm.rondas, dinamicas = mm.dinamicas, ValueErr = xx[1].ValueError;
          if (ruta === '/api/tests/ronda') {
            var ronda = rondas.armar_ronda(d.preguntas, d.estados, d.cantidad, v(d, 'modo', 'prioridad'), undefined, d.semilla);
            ronda.resumen = rondas.resumen_test(d.preguntas, d.estados, ronda.ahora);
            return ok(ronda);
          }
          if (ruta === '/api/tests/dinamica') return ok(dinamicas.generar_instancia(d.pregunta, d.semilla));
          if (ruta === '/api/tests/registrar') return ok({ estado: rondas.registrar(d.estado, d.acierto, d.seguridad) });
          if (ruta === '/api/tests/resumen') {
            if (!Array.isArray(d.tests) || d.tests.length > 200) return malo('faltan los tests (o son demasiados)');
            var salida = {};
            d.tests.forEach(function (t) {
              if (!t || typeof t !== 'object' || typeof t.id !== 'string') throw new ValueErr('un test no es valido');
              salida[t.id] = rondas.resumen_test(t.preguntas, t.estados);
            });
            return ok(salida);
          }
          return malo('No existe esa ruta.', 404);
        }).catch(function (e) { return aError(e, 'tests'); });
      }

      /* ---- memorama (las partidas viven aquí, con las cartas tapadas) ---- */
      if (ruta.indexOf('/api/memorama/') === 0) {
        return cargar('memorama').then(function (mm) {
          var mem = mm.memorama;
          if (ruta === '/api/memorama/catalogos') return ok(mem.catalogos());
          if (ruta === '/api/memorama/nueva') {
            var partida = mem.nueva_partida(v(d, 'tamano', '4x4'), v(d, 'catalogo', 'formas'), d.semilla);
            var claves = Object.keys(estado.partidas);
            while (claves.length > MAX_PARTIDAS) { delete estado.partidas[claves.shift()]; }
            estado.contador += 1;
            var llave = 'p' + estado.contador;
            estado.partidas[llave] = partida;
            var vista = mem.estado_para_la_pagina(partida); vista.partida = llave;
            return ok(vista);
          }
          var p = estado.partidas[d.partida === undefined ? '' : d.partida];
          if (!p) return malo('esa partida no existe o la página se recargó', 404);
          if (ruta === '/api/memorama/voltear') {
            if (typeof d.carta !== 'number' || Math.floor(d.carta) !== d.carta) return malo('falta la carta');
            var r = mem.voltear(p, d.carta), vv = mem.estado_para_la_pagina(r[0]);
            vv.partida = d.partida; vv.resultado = r[1];
            return ok(vv);
          }
          if (ruta === '/api/memorama/ocultar') { var vo = mem.estado_para_la_pagina(mem.ocultar(p)); vo.partida = d.partida; return ok(vo); }
          return malo('No existe esa ruta.', 404);
        }).catch(function (e) { return aError(e, 'memorama'); });
      }

      /* ---- aventura contra la computadora ---- */
      if (ruta.indexOf('/api/pve/') === 0) {
        if (JSON.stringify(peticion.cuerpo || {}).length > MAX_CUERPO) return Promise.resolve(malo('Lo que mandaste es demasiado grande.', 413));
        return aventuras().then(function (av) {
          if (metodo === 'POST' && ruta === '/api/pve/iniciar') return ok(av.iniciar(d));
          if (m = /^\/api\/pve\/([^/]+)\/accion$/.exec(ruta)) return ok(av.accion(decodeURIComponent(m[1]), d));
          if (m = /^\/api\/pve\/([^/]+)\/estado$/.exec(ruta)) return ok(av.estado(decodeURIComponent(m[1])));
          return malo('No existe esa ruta.', 404);
        }).catch(function (e) { return aError(e, 'pve'); });
      }

      /* ---- multijugador ---- */
      if (/^\/api\/(sala|ding|red)(\/|$)/.test(ruta)) return multijugador(peticion);

      return Promise.resolve(malo('no existe', 404));
    }

    /* ------------------------------------------------------------------
       MULTIJUGADOR: ¿lo resuelvo yo (anfitrión) o se lo pido al anfitrión?
       ------------------------------------------------------------------ */
    function codigoDe(ruta) { var mm = /^\/api\/(?:sala|ding)\/([^/]+)\//.exec(ruta); return mm ? decodeURIComponent(mm[1]) : null; }
    function limpiarCodigo(c) { return String(c === undefined || c === null ? '' : c).trim().toUpperCase(); }
    function salaLocal(familia, codigo) {
      var inst = familia === 'sala' ? estado.salas : estado.dings;
      return !!(inst && inst._salas && Object.prototype.hasOwnProperty.call(inst._salas, limpiarCodigo(codigo)));
    }

    function multijugador(peticion) {
      var ruta = peticion.ruta, familia = /^\/api\/(sala|ding|red)/.exec(ruta)[1];
      var esCrear = /^\/api\/(sala|ding)\/crear$/.test(ruta);
      var codigo = codigoDe(ruta) || ((/\/unirse$/.test(ruta)) ? (cuerpoObj(peticion.cuerpo).codigo) : null);
      var mensajeNoExiste = 'No existe esa sala. Revisa el código.';

      if (peticion.origen !== undefined && peticion.origen !== 'local') return ejecutarMulti(peticion, false);   // viene de otro dispositivo: la resuelvo yo
      if (familia === 'red' && ruta === '/api/red/info') return Promise.resolve(infoRed());
      if (esCrear) return cargarConexion().then(function () { return ejecutarMulti(peticion, true); }, function () { return ejecutarMulti(peticion, true); });
      if (familia !== 'red' && codigo !== null && salaLocal(familia, codigo)) return ejecutarMulti(peticion, true);

      // La sala no está aquí: puede estar en otra pestaña o en otro dispositivo.
      return cargarConexion().then(function (c) {
        if (!c || (familia === 'red' && !c.hayEnlace())) return ejecutarMulti(peticion, true);
        return c.pedir(peticion).then(function (r) {
          if (r) return r;
          if (/\/unirse$/.test(ruta)) {
            return c.asistenteUnirse().then(function (conectado) {
              if (!conectado) return malo(mensajeNoExiste, 404);
              return c.pedir(peticion).then(function (r2) { return r2 || malo(mensajeNoExiste, 404); });
            });
          }
          return ejecutarMulti(peticion, true);            // mismo "no existe esa sala" que daba el servidor
        });
      }, function () { return ejecutarMulti(peticion, true); });
    }

    function infoRed() {
      return { status: 200, body: { local: true, host: entorno.host || 'sitio', tu_ip: 'este dispositivo', direcciones: [],
        https: !!entorno.https, estatico: true, enlaces: conexion ? conexion.cuantos() : 0, hospedando: !!(estado.salas && estado.salas.cuantas()) || !!(estado.dings && estado.dings.cuantas()) } };
    }

    function ejecutarMulti(peticion, esLocal) {
      var ruta = peticion.ruta, metodo = peticion.metodo, q = peticion.consulta || {}, d = cuerpoObj(peticion.cuerpo), m;
      if (JSON.stringify(peticion.cuerpo || {}).length > MAX_CUERPO) return Promise.resolve(malo('Lo que mandaste es demasiado grande.', 413));
      var origen = peticion.origen && peticion.origen !== 'local' ? String(peticion.origen) : 'local';
      var q_ = function (k) { return q[k] === undefined ? null : q[k]; };

      if (m = /^\/api\/sala\/(crear|unirse)$/.exec(ruta)) {
        return salas().then(function (s) {
          var r = ok(m[1] === 'crear' ? s.crear(d.nombre) : s.unirse(d.codigo, d.nombre));
          if (m[1] === 'crear' && esLocal) alCrearSala.forEach(function (f) { try { f('sala', r.body.codigo); } catch (e) { /* nada */ } });
          return r;
        }).catch(function (e) { return aError(e, 'sala'); });
      }
      if (m = /^\/api\/sala\/([^/]+)\/(configurar|preparar|listo|accion|cerrar|estado)$/.exec(ruta)) {
        var cod = decodeURIComponent(m[1]), acc = m[2];
        return Promise.all([salas(), modulo('_base')]).then(function (x) {
          var s = x[0], Bm = x[1], tk = acc === 'estado' ? q_('token') : d.token;
          if (acc === 'configurar') return ok(s.configurar(cod, tk, d.config));
          if (acc === 'preparar') return ok(s.preparar(cod, tk, d.clase, d.mazo, d.equipo, d.perfil, v(d, 'origen', 'local')));
          if (acc === 'listo') return ok(s.listo(cod, tk, Bm.pyBool(v(d, 'listo', true))));
          if (acc === 'accion') return ok(s.accion(cod, tk, d));
          if (acc === 'cerrar') return ok(s.cerrar(cod, tk));
          return ok(s.estado(cod, tk, q_('firma')));
        }).catch(function (e) { return aError(e, 'sala'); });
      }
      if (m = /^\/api\/ding\/(crear|unirse)$/.exec(ruta)) {
        return dings().then(function (s) {
          var r = ok(m[1] === 'crear' ? s.crear(d.nombre) : s.unirse(d.codigo, d.nombre));
          if (m[1] === 'crear' && esLocal) alCrearSala.forEach(function (f) { try { f('ding', r.body.codigo); } catch (e) { /* nada */ } });
          return r;
        }).catch(function (e) { return aError(e, 'ding'); });
      }
      if (m = /^\/api\/ding\/([^/]+)\/(configurar|test|accion|cerrar|estado)$/.exec(ruta)) {
        var cod2 = decodeURIComponent(m[1]), acc2 = m[2];
        return dings().then(function (s) {
          var tk = acc2 === 'estado' ? q_('token') : d.token;
          if (acc2 === 'configurar') return ok(s.configurar(cod2, tk, d.config));
          if (acc2 === 'test') return ok(s.cargar_test(cod2, tk, d.titulo, d.preguntas));
          if (acc2 === 'accion') return ok(s.accion(cod2, tk, d));
          if (acc2 === 'cerrar') return ok(s.cerrar(cod2, tk));
          return ok(s.estado(cod2, tk, q_('firma')));
        }).catch(function (e) { return aError(e, 'ding'); });
      }
      if (ruta === '/api/red/eco') {
        return eco().then(function (e) {
          var ip = origen, t = ahoraS();
          if (metodo === 'POST') return ok(e.agregar(d.nombre, d.mensaje, ip, t, d.cid));
          var desde = parseInt(q_('desde') === null ? 0 : q_('desde'), 10); if (isNaN(desde)) desde = 0;
          return ok(e.desde(desde, ip, t, q_('cid')));
        }).catch(function (e) { return aError(e, 'red'); });
      }
      return Promise.resolve(malo('no existe', 404));
    }

    function cargarConexion() {
      if (conexion) return Promise.resolve(conexion);
      if (!entorno.cargarConexion) return Promise.resolve(null);
      return Promise.resolve(entorno.cargarConexion(api)).then(function () { return conexion; });
    }

    var api = {
      VERSION: VERSION, base: base, url: url, manejar: manejar, cargar: cargar, modulo: modulo,
      registrarConexion: function (c) { conexion = c; },
      alCrearSala: function (f) { alCrearSala.push(f); },
      conexion: function () { return conexion; },
      estado: estado,
      /* ¿Esta pestaña tiene la sala a la que se refiere la petición? (para contestar a otras pestañas) */
      tieneSala: function (p) {
        var f = /^\/api\/(sala|ding)\//.exec((p && p.ruta) || '');
        if (!f) return false;
        var cod = codigoDe(p.ruta) || (/\/unirse$/.test(p.ruta) ? cuerpoObj(p.cuerpo).codigo : null);
        return cod !== null && cod !== undefined && !/\/crear$/.test(p.ruta) && salaLocal(f[1], cod);
      },
      /* Lo que el anfitrión ejecuta cuando le llega una petición de otro dispositivo. Solo multijugador. */
      ejecutarRemota: function (peticion, idEnlace) {
        if (!/^\/api\/(sala|ding)\/|^\/api\/red\/eco$/.test(peticion.ruta || '')) return Promise.resolve(malo('no permitido', 403));
        if (/\/crear$/.test(peticion.ruta)) return Promise.resolve(malo('Las salas se crean en el dispositivo anfitrión.', 403));
        return ejecutarMulti(Object.assign({}, peticion, { origen: idEnlace || 'remoto' }), false);
      }
    };
    return api;
  }

  /* ------------------------------------------------------------------
     arrancar: lo que pasa cuando el archivo se carga en una página.
     ------------------------------------------------------------------ */
  function arrancar(w) {
    if (w.RetoApi && w.RetoApi.manejar) return;            // ya está cargado (la página lo incluyó dos veces)
    var script = document.currentScript, base;
    try { base = new URL('..', script.src).href; } catch (e) { base = new URL('./', location.href).href; }
    var fetchOriginal = w.fetch.bind(w);
    var rutaBase = new URL(base).pathname;                  // "/" o "/REPO/"
    var cargados = {};
    var cacheJson = {};

    function cargarScript(rel) {
      if (cargados[rel]) return cargados[rel];
      cargados[rel] = new Promise(function (resolver, rechazar) {
        var s = document.createElement('script');
        s.src = base + rel + '?v=' + VERSION;
        s.async = false;
        s.onload = function () { resolver(); };
        s.onerror = function () { delete cargados[rel]; rechazar(new Error('No se pudo cargar ' + rel)); };
        document.head.appendChild(s);
      });
      return cargados[rel];
    }

    function leerJson(rel) {
      if (!cacheJson[rel]) {
        cacheJson[rel] = fetchOriginal(base + rel).then(function (r) {
          if (!r.ok) throw new Error('No se pudo leer ' + rel);
          return r.json();
        }).catch(function (e) { delete cacheJson[rel]; throw e; });
      }
      return cacheJson[rel];
    }

    var api = crearApi({
      base: base,
      host: location.host,
      https: location.protocol === 'https:',
      cargarLogica: function (nombre) {
        var p = cargarScript('scripts/reto-azar.js');
        if (nombre !== '_base') p = p.then(function () { return cargarScript('scripts/logica/_base.js'); });
        return p.then(function () { return cargarScript('scripts/logica/' + nombre + '.js'); }).then(function () {
          return nombre === '_base' ? w.RetoLogica._base : w.RetoLogica[nombre];
        });
      },
      leerJson: leerJson,
      cargarConexion: function (api) { return cargarScript('scripts/reto-conexion.js'); }
    });

    function url(p) { return api.url(p); }

    /* Convierte una dirección de índice ("imagenes/...") en una que funcione dentro del sitio. */
    function reescribirIndice(texto) {
      try {
        var j = JSON.parse(texto);
        (function rec(x) {
          if (Array.isArray(x)) x.forEach(function (e, i) { if (typeof e === 'string') x[i] = fix(e); else rec(e); });
          else if (x && typeof x === 'object') Object.keys(x).forEach(function (k) { if (typeof x[k] === 'string') x[k] = fix(x[k]); else rec(x[k]); });
        })(j);
        return JSON.stringify(j);
      } catch (e) { return texto; }
      function fix(s) { return /^\/?imagenes\//.test(s) ? url(s) : s; }
    }

    function aPeticion(entrada, init) {
      var abs = new URL(typeof entrada === 'string' ? entrada : (entrada && entrada.url) || String(entrada), location.href);
      var metodo = ((init && init.method) || (entrada && entrada.method) || 'GET').toUpperCase();
      var cuerpoTexto = init && init.body !== undefined ? Promise.resolve(init.body) :
        (entrada && typeof entrada === 'object' && entrada.clone && metodo !== 'GET' ? entrada.clone().text() : Promise.resolve(null));
      return { abs: abs, metodo: metodo, cuerpoTexto: cuerpoTexto };
    }

    w.fetch = function (entrada, init) {
      var p;
      try { p = aPeticion(entrada, init); } catch (e) { return fetchOriginal(entrada, init); }
      var abs = p.abs;
      if (abs.origin !== location.origin) return fetchOriginal(entrada, init);
      var ruta = abs.pathname, rel = ruta;
      if (rutaBase !== '/' && ruta.indexOf(rutaBase) === 0) rel = '/' + ruta.slice(rutaBase.length);

      if (rel.indexOf('/api/') === 0) {
        return p.cuerpoTexto.then(function (texto) {
          var cuerpo = {};
          if (typeof texto === 'string' && texto) { try { cuerpo = JSON.parse(texto); } catch (e) { cuerpo = {}; } }
          var consulta = {};
          abs.searchParams.forEach(function (val, k) { consulta[k] = val; });
          if (texto && texto.length > MAX_CUERPO) return respuestaJson(413, { error: 'Lo que mandaste es demasiado grande.' });
          return api.manejar({ metodo: p.metodo, ruta: rel, consulta: consulta, cuerpo: cuerpo, origen: 'local' }).then(function (r) {
            return respuestaJson(r.status, r.body);
          });
        });
      }

      // Archivos del sitio pedidos desde la raíz ("/datos/x.json"): se buscan dentro de la carpeta del sitio.
      var destino = abs.href;
      if (rutaBase !== '/' && ruta.indexOf(rutaBase) !== 0 && RUTAS_PUBLICAS.test(ruta)) destino = base + ruta.slice(1) + abs.search;
      if (/\/datos\/(fondos|sprites|incognito)\.json$/.test(rel)) {
        return fetchOriginal(destino).then(function (r) {
          if (!r.ok) return r;
          return r.text().then(function (t) { return new Response(reescribirIndice(t), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }); });
        });
      }
      return destino === abs.href ? fetchOriginal(entrada, init) : fetchOriginal(destino, init);
    };

    w.RetoApi = api;
    w.RetoBasePath = { base: base, url: url, ruta: rutaBase };
    // Para quien necesite saber si hay conexión "de verdad": las reglas ya no dependen del servidor.
    w.RetoOfflineCache = { isOffline: function () { return false; }, installFetchInterceptor: function () {} };
  }

  return { crearApi: crearApi, arrancar: arrancar, VERSION: VERSION, DEPENDENCIAS: DEPENDENCIAS };
});
