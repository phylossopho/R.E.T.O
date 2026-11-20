/* =========================================================================
   R.E.T.O. - El inventario, el equipo y los aciertos del RPG (navegador)
   -------------------------------------------------------------------------
   Los POWER UPS SE GANAN en la aventura contra el enemigo y en los tests de
   Test de conocimientos (asociar, escribir y resolver; NO las tarjetas de
   estudio). No se ganan en mini juegos ni en el duelo. Aqui se guarda lo que la
   persona ya gano; las reglas (que sale, cuanto cura, quien gana, el tope de 10
   al dia y el raro cada 50 entregados) viven en el servidor (logica/rpg.py) y
   este archivo no las repite.

   QUE SE GUARDA (en RetoDatos, asi entra en el respaldo de Configuracion):
     rpg-inventario   lista de ids; un id repetido son copias. Hasta 12.
     rpg-aciertos     aciertos ACUMULADOS en la aventura y en los tests (de ahi
                      salen los premios: cada 10, 1 o 2 power ups)
     rpg-entregados   power ups ENTREGADOS en total (el 50, el 100... es un raro
                      o muy raro garantizado)
     rpg-premios-dia  { fecha, n }: los power ups entregados HOY (tope de 10)
     rpg-equipo       los ids que se llevan a la batalla (3 comunes, 2
                      especiales y 1 raro o muy raro como maximo)

   USARLOS CUESTA: al terminar una batalla (PvE o duelo), por cada power up que
   SI se uso se gasta UNA copia del inventario. Por eso vale la pena practicar.

   TODAS LAS ESCRITURAS VAN EN FILA (leer, cambiar y escribir sin que otra
   escritura se cuele en medio), como en reto-progreso.js.
   ========================================================================= */
(function (window) {
  'use strict';

  var CLAVES = { inventario: 'rpg-inventario', aciertos: 'rpg-aciertos', equipo: 'rpg-equipo',
                 entregados: 'rpg-entregados', premiosDia: 'rpg-premios-dia' };
  var INVENTARIO_MAX = 99;
  var EQUIPO_MAX = { comun: 3, especial: 2, raro_o_muy_raro: 1 };
  var USOS = { comun: 3, especial: 2, raro: 1, muy_raro: 1 };
  var RAREZAS = ['comun', 'especial', 'raro', 'muy_raro'];
  var NOMBRES_RAREZA = { comun: 'Común', especial: 'Especial', raro: 'Raro', muy_raro: 'Muy raro' };
  var CLASE_DE_AVATAR = {
    mago: 'mago', maga: 'mago', caballero: 'caballero', caballera: 'caballero',
    arquero: 'arquero', arquera: 'arquero', guerrero: 'guerrero', guerrera: 'guerrero',
    asesino: 'asesino', asesina: 'asesino', clerigo: 'clerigo', sacerdotiza: 'clerigo'
  };
  var NOMBRES_CLASE = { guerrero: 'Guerrero', caballero: 'Caballero', mago: 'Mago', clerigo: 'Clérigo', asesino: 'Asesino', arquero: 'Arquero' };

  var fila = Promise.resolve();
  var cache = null;
  var _cachePU = {};
  var _cacheTXT = {};

  function encolar(fn) {
    var p = fila.then(fn, fn);
    fila = p.catch(function () {});
    return p;
  }

  function datos() { return window.RetoDatos || null; }

  function leer(clave, defecto) {
    if (!datos()) return Promise.resolve(defecto);
    return datos().obtener(clave).then(function (v) { return v === undefined || v === null ? defecto : v; })
      .catch(function () { return defecto; });
  }

  function escribir(clave, valor) {
    return datos() ? datos().poner(clave, valor) : Promise.resolve();
  }

  /* El catalogo: los 27 power ups con su rareza, sus clases con sinergia y sus textos. */
  function catalogo() {
    if (cache) return cache;
    cache = Promise.all([
      fetch('/datos/powerups.json').then(function (r) { return r.json(); }),
      fetch('/datos/powerups_textos.json').then(function (r) { return r.json(); })
    ]).then(function (r) {
      _cachePU = r[0].powerups;
      _cacheTXT = r[1];
      return { powerups: _cachePU, textos: _cacheTXT };
    }).catch(function () { 
      _cachePU = {}; 
      _cacheTXT = {}; 
      cache = null; 
      return { powerups: {}, textos: {} }; 
    });
    return cache;
  }

  function inventario() {
    return leer(CLAVES.inventario, []).then(function (l) { return Array.isArray(l) ? l : []; });
  }

  /* Agrega los premios. Devuelve { agregados, perdidos }: lo que no cupo (12 max) se pierde. */
  function agregar(ids) {
    return encolar(function () {
      return inventario().then(function (inv) {
        var agregados = [], perdidos = [];
        (ids || []).forEach(function (id) {
          if (inv.length < INVENTARIO_MAX) { inv.push(id); agregados.push(id); } else perdidos.push(id);
        });
        return escribir(CLAVES.inventario, inv).then(function () { return { agregados: agregados, perdidos: perdidos }; });
      });
    });
  }

  /* Gasta una copia de cada id (los que se usaron en la batalla). Si ya no queda
     ninguna copia de uno, tambien se quita del equipo. */
  function consumir(ids) {
    return encolar(function () {
      return Promise.all([inventario(), leer(CLAVES.equipo, [])]).then(function (r) {
        var inv = r[0].slice(), equipo = Array.isArray(r[1]) ? r[1].slice() : [];
        (ids || []).forEach(function (id) {
          var i = inv.indexOf(id);
          if (i >= 0) inv.splice(i, 1);
        });
        equipo = equipo.filter(function (id) { return inv.indexOf(id) >= 0; });
        return escribir(CLAVES.inventario, inv).then(function () { return escribir(CLAVES.equipo, equipo); })
          .then(function () {
            var resultado = { inventario: inv, equipo: equipo };
            if (window.RetoPerfil && window.RetoPerfil.actualizarPowerups) {
              window.RetoPerfil.actualizarPowerups({ inventario: inv, equipo: equipo });
            }
            return resultado;
          });
      });
    });
  }

  function descartar(id) {
    return consumir([id]);
  }

  function aciertos() {
    return leer(CLAVES.aciertos, 0).then(function (n) { return typeof n === 'number' && n >= 0 ? n : 0; });
  }

  function sumarAciertos(n) {
    return encolar(function () {
      return aciertos().then(function (a) {
        var nuevo = a + Math.max(0, Math.floor(n || 0));
        return escribir(CLAVES.aciertos, nuevo).then(function () { return nuevo; });
      });
    });
  }

  /* ---- Los power ups ENTREGADOS: el total (para el raro garantizado cada 50) y los de
     hoy (para el tope de 10 al dia). Las reglas las aplica el servidor; aqui solo se
     cuenta y se guarda. Cuentan los que se ENTREGAN, quepan o no en el inventario. */
  function hoy() {
    var d = new Date();
    function dos(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  }

  function entregados() {
    return leer(CLAVES.entregados, 0).then(function (n) { return typeof n === 'number' && n >= 0 ? Math.floor(n) : 0; });
  }

  /* Los entregados hoy (si el dia guardado es otro, hoy van 0). */
  function entregadosHoy() {
    return leer(CLAVES.premiosDia, null).then(function (d) {
      return d && d.fecha === hoy() && typeof d.n === 'number' && d.n >= 0 ? Math.floor(d.n) : 0;
    });
  }

  function registrarEntrega(n) {
    n = Math.max(0, Math.floor(n || 0));
    if (!n) return Promise.resolve();
    return encolar(function () {
      return Promise.all([entregados(), entregadosHoy()]).then(function (r) {
        return escribir(CLAVES.entregados, r[0] + n).then(function () {
          return escribir(CLAVES.premiosDia, { fecha: hoy(), n: r[1] + n });
        });
      });
    });
  }

  /* ---- Los tests tambien dan power ups. Se llama UNA vez al terminar una ronda de
     asociar, escribir o resolver (no tarjetas de estudio) con los aciertos de la ronda.
     El servidor decide los premios; aqui se suman los aciertos, se guardan los power
     ups y se cuentan los entregados. Devuelve { premios, perdidos, bloqueados, acumulados,
     contados, topeDia } o null si no se pudo (no pasa nada: el test ya termino). */
  function premiarTest(aciertosDeLaRonda) {
    var nuevos = Math.max(0, Math.floor(aciertosDeLaRonda || 0));
    if (!nuevos) return Promise.resolve(null);
    return Promise.all([aciertos(), entregados(), entregadosHoy()]).then(function (r) {
      return post('/api/rpg/premios', { aciertos_antes: r[0], aciertos: nuevos, entregados_antes: r[1], entregados_hoy: r[2] })
        .then(function (d) {
          var res = { premios: d.premios || [], perdidos: [], bloqueados: d.bloqueados || 0, acumulados: r[0],
                      contados: d.aciertos_contados || 0, topeDia: !!(d.tope_dia && d.cupo === 0) };
          return sumarAciertos(res.contados).then(function (total) {
            res.acumulados = total;
            return agregar(res.premios);
          }).then(function (a) {
            res.perdidos = a.perdidos;
            return registrarEntrega(res.premios.length);
          }).then(function () {
            if (window.RetoPerfil && window.RetoPerfil.actualizarPowerups) {
              window.RetoPerfil.actualizarPowerups({
                aciertos: res.contados,
                entregados: res.premios.length,
                inventario: a.agregados,
                equipo: a.equipo || []
              });
            }
            return res;
          });
        });
    }).catch(function () { return null; });
  }

  /* Pinta en `contenedor` lo que dio la ronda (un parrafo con aviso para lectores de
     pantalla). Llama a premiarTest. `nombres` sale del catalogo del sitio. */
  function mostrarPremiosDeTest(contenedor, aciertosDeLaRonda) {
    if (!contenedor || !aciertosDeLaRonda) return Promise.resolve(null);
    var caja = document.createElement('div');
    caja.className = 'tst-premios';
    caja.setAttribute('role', 'status');
    caja.setAttribute('aria-live', 'polite');
    contenedor.appendChild(caja);
    return Promise.all([premiarTest(aciertosDeLaRonda), catalogo()]).then(function (r) {
      var res = r[0], cat = r[1];
      if (!res) { caja.remove(); return null; }
      function nombre(id) { return cat.textos[id] ? cat.textos[id].nombre : id; }
      function parrafo(txt, fuerte) {
        var p = document.createElement('p');
        if (fuerte) p.style.fontWeight = 'bold';
        p.textContent = txt;
        caja.appendChild(p);
      }
      if (res.premios.length) {
        parrafo('🎁 Ganaste ' + res.premios.length + (res.premios.length === 1 ? ' power up: ' : ' power ups: ') +
          res.premios.map(function (id) {
            var p = cat.powerups[id];
            return nombre(id) + (p ? ' (' + NOMBRES_RAREZA[p.rareza].toLowerCase() + ')' : '');
          }).join(', ') + '.', true);
        if (res.perdidos.length) parrafo('Tu inventario está lleno (' + INVENTARIO_MAX + '): ' + res.perdidos.length + ' no cupieron. Descarta alguno en Mi equipo.');
      } else if (res.topeDia && !res.contados) {
        parrafo('Hoy ya llegaste al tope de power ups (10 al día). Puedes seguir practicando: estos aciertos no cuentan para el premio, así no pierdes progreso.');
      } else {
        var faltan = 10 - (res.acumulados % 10);
        parrafo('Te faltan ' + faltan + (faltan === 1 ? ' acierto' : ' aciertos') + ' para tu próximo premio (llevas ' + res.acumulados + ' en total).');
      }
      if (res.bloqueados) parrafo('Se llegó al tope de 10 power ups por día: ' + res.bloqueados + (res.bloqueados === 1 ? ' premio no se pudo dar' : ' premios no se pudieron dar') + '.');
      return res;
    });
  }

  /* El equipo guardado, sin los que ya no se tienen. */
  function equipo() {
    return Promise.all([inventario(), leer(CLAVES.equipo, [])]).then(function (r) {
      var inv = r[0];
      var vistos = {};
      return (Array.isArray(r[1]) ? r[1] : []).filter(function (id) {
        if (vistos[id] || inv.indexOf(id) < 0) return false;
        vistos[id] = true;
        return true;
      });
    });
  }

  function guardarEquipo(ids) {
    return encolar(function () { return escribir(CLAVES.equipo, ids || []); });
  }

  function claseDeAvatar(avatar) { return CLASE_DE_AVATAR[avatar] || 'guerrero'; }

  /* Cuantos hay de cada tipo en un equipo, para los contadores "2 de 3". */
  function contar(ids, cat) {
    var c = { comun: 0, especial: 0, raro_o_muy_raro: 0 };
    (ids || []).forEach(function (id) {
      var p = cat.powerups[id];
      if (!p) return;
      c[p.rareza === 'raro' || p.rareza === 'muy_raro' ? 'raro_o_muy_raro' : p.rareza]++;
    });
    return c;
  }

  /* El nivel de practica: el navegador manda sus sesiones y Python calcula. */
  function nivel() {
    if (!window.RetoProgreso) return Promise.resolve(null);
    return window.RetoProgreso.sesiones().then(function (ses) {
      // Cálculo local del nivel (sin servidor)
      var total = 0;
      (ses || []).forEach(function(s) {
        if (!s || typeof s !== 'object') return;
        var tipo = s.tipo;
        if (['lectura', 'vision', 'test', 'rpg'].indexOf(tipo) < 0) return;
        try {
          var pts = puntosSesion(tipo, parseFloat(s.minutos) || 0, parseInt(s.rondas) || 0, parseInt(s.preguntas) || 0);
        } catch (e) { return; }
        var dia = String(s.fecha || '').slice(0, 10);
        // Acumular por día (tope diario 120)
        if (!porDia[dia]) porDia[dia] = 0;
        porDia[dia] = Math.min(120, porDia[dia] + Math.max(0, pts));
      });
      var total = Object.keys(porDia).reduce(function(a, d) { return a + porDia[d]; }, 0);
      return Promise.resolve({ puntos: Math.round(total * 10) / 10, nivel: nivelDePuntos(total) });
    }).catch(function () { return null; });
  }

  /* ---- La tarjeta de jugador: tu nivel y tus power ups para llevarlos a OTRO servidor.
     Cada direccion es un almacen distinto, asi que en el servidor de un amigo no estan
     tus datos: la tarjeta es un resumen con una huella (la hace y la revisa
     logica/rpg.py). Un servidor ajeno la lee para mostrar tu nivel y dejarte usar tus power ups. */
  function post(ruta, cuerpo) {
    return fetch(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error((d && d.error) || 'No se pudo.');
          return d;
        });
      }, function () { throw new Error('No hay conexión con el servidor.'); });
  }

  /* Lo que se sabe de ti en este dispositivo. */
  function perfil(nombre) {
    return Promise.all([inventario(), equipo(), aciertos(), nivel(), window.RetoPerfil ? window.RetoPerfil.obtener() : Promise.resolve(null)]).then(function (r) {
      var perfilBase = { nombre: nombre || 'Jugador', puntos: r[3] ? r[3].puntos : 0, inventario: r[0], equipo: r[1], aciertos: r[2] };
      if (r[4]) {
        perfilBase.config = r[4].config || {};
        perfilBase.tiempo_por_modulo = r[4].tiempo_por_modulo || {};
      }
      return perfilBase;
    });
  }

  function crearTarjeta(nombre) {
    return perfil(nombre).then(function (p) { return post('/api/rpg/tarjeta', { perfil: p }); });
  }

  function aTexto(t) {
    var prefijo = t.v === 2 ? 'RETO2.' : 'RETO1.';
    return prefijo + window.btoa(unescape(encodeURIComponent(JSON.stringify(t))));
  }

  /* Acepta el codigo "RETO1.…" / "RETO2.…" o el JSON del archivo. Devuelve { perfil, tarjeta }. */
  function leerTarjeta(texto) {
    var t = String(texto || '').trim();
    var tarjeta;
    try {
      if (t.indexOf('RETO1.') === 0) t = decodeURIComponent(escape(window.atob(t.slice(6).replace(/\s+/g, ''))));
      else if (t.indexOf('RETO2.') === 0) t = decodeURIComponent(escape(window.atob(t.slice(6).replace(/\s+/g, ''))));
      tarjeta = JSON.parse(t);
    } catch (e) {
      return Promise.reject(new Error('No pude leer la tarjeta. Copia el código completo o elige el archivo.'));
    }
    // Asegurar que el catálogo de powerups esté cargado antes de validar
    return window.RetoRpg.catalogo().then(function () {
      // Validación local (sin servidor) usando la lógica de reto-rpg-logica.js
      if (window.RetoRpg && window.RetoRpg.validarTarjeta) {
        try {
          var perfil = window.RetoRpg.validarTarjeta(tarjeta);
          return Promise.resolve({ perfil: perfil, tarjeta: tarjeta });
        } catch (e) {
          return Promise.reject(new Error(e.message || 'Tarjeta inválida.'));
        }
      }
      // Fallback: si no hay validación local, intentar con servidor (modo wifi local)
      return post('/api/rpg/tarjeta/validar', { tarjeta: tarjeta }).then(function (p) { return { perfil: p, tarjeta: tarjeta }; });
    });
  }

  // Merge with existing RetoRpg (from reto-rpg-logica.js) instead of overwriting
  window.RetoRpg = Object.assign(window.RetoRpg || {}, {
    perfil: perfil, crearTarjeta: crearTarjeta, aTexto: aTexto, leerTarjeta: leerTarjeta,
    INVENTARIO_MAX: INVENTARIO_MAX, EQUIPO_MAX: EQUIPO_MAX, USOS: USOS, RAREZAS: RAREZAS,
    NOMBRES_RAREZA: NOMBRES_RAREZA, NOMBRES_CLASE: NOMBRES_CLASE,
    catalogo: catalogo, inventario: inventario, agregar: agregar, consumir: consumir, descartar: descartar,
    aciertos: aciertos, sumarAciertos: sumarAciertos, equipo: equipo, guardarEquipo: guardarEquipo,
    entregados: entregados, entregadosHoy: entregadosHoy, registrarEntrega: registrarEntrega,
    premiarTest: premiarTest, mostrarPremiosDeTest: mostrarPremiosDeTest,
    claseDeAvatar: claseDeAvatar, contar: contar, nivel: nivel
  });
})(window);
