/* =========================================================================
   R.E.T.O. - Inventario y equipo de power ups (pantalla)
   -------------------------------------------------------------------------
   Muestra lo que ya ganaste (se gana acertando en la aventura contra el
   enemigo y en los tests: asociar, escribir y resolver), te deja elegir el equipo que llevas a una batalla o a un duelo
   (3 comunes, 2 especiales y 1 raro o muy raro como maximo) y te cuenta cuanto
   falta para el proximo premio. Los datos los guarda scripts/reto-rpg.js; las
   reglas de lo que hace cada power up estan en logica/rpg.py.
   ========================================================================= */
(function () {
  'use strict';

  var R, cat, raiz, vivo;
  var estado = { inventario: [], equipo: [], aciertos: 0, entregados: 0, hoy: 0, nivel: null, confirmar: null, perfilCompleto: null };

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function decir(t) {
    vivo.textContent = '';
    window.setTimeout(function () { vivo.textContent = t; }, 30);
  }

  function nombre(id) { return cat.textos[id] ? cat.textos[id].nombre : id; }
  function descripcion(id) { return cat.textos[id] ? cat.textos[id].descripcion : ''; }
  function rareza(id) { return cat.powerups[id].rareza; }
  function categoria(id) { var r = rareza(id); return r === 'raro' || r === 'muy_raro' ? 'raro_o_muy_raro' : r; }

  function clasesDe(id) {
    return cat.powerups[id].sinergia.clases.map(function (c) { return R.NOMBRES_CLASE[c]; }).join(' y ');
  }

  function cuentas() {
    var c = {};
    estado.inventario.forEach(function (id) { c[id] = (c[id] || 0) + 1; });
    return c;
  }

  function tarjeta(id, opciones) {
    var li = el('li', 'equipo-item');
    var cab = el('p', 'equipo-nombre');
    cab.appendChild(el('strong', '', nombre(id)));
    cab.appendChild(document.createTextNode(' · ' + R.NOMBRES_RAREZA[rareza(id)] +
      (opciones.copias > 1 ? ' · ' + opciones.copias + ' copias' : '')));
    li.appendChild(cab);
    li.appendChild(el('p', 'equipo-texto', descripcion(id)));
    var extra = 'Mejor con: ' + clasesDe(id) + '. Usos por batalla: ' + R.USOS[rareza(id)] + '.' +
      (cat.powerups[id].requiere_tiempo ? ' Solo con tiempo.' : '');
    li.appendChild(el('p', 'ayuda', extra));
    return li;
  }

  function formatearTiempo(minutos) {
    if (!minutos || minutos < 1) return '< 1 min';
    var h = Math.floor(minutos / 60);
    var m = Math.round(minutos % 60);
    return h ? h + 'h ' + m + 'm' : m + ' min';
  }

  function renderTiempoModulo(titulo, obj, contenedor) {
    if (!obj || !Object.keys(obj).length) return;
    var det = el('details');
    det.appendChild(el('summary', '', titulo));
    var ul = el('ul', 'equipo-lista');
    Object.entries(obj).forEach(function (kv) {
      var li = el('li');
      li.textContent = kv[0] + ': ' + formatearTiempo(kv[1]);
      ul.appendChild(li);
    });
    det.appendChild(ul);
    contenedor.appendChild(det);
  }

  function pintar() {
    raiz.textContent = '';
    var cuenta = cuentas();
    var unicos = Object.keys(cuenta);

    // --- progreso
    var prog = el('section', 'red-caja');
    prog.appendChild(el('h2', '', 'Tu progreso'));
    var faltan = 10 - (estado.aciertos % 10);
    prog.appendChild(el('p', '', 'Aciertos acumulados en la aventura y en los tests: ' + estado.aciertos + '. Te faltan ' + faltan +
      (faltan === 1 ? ' acierto' : ' aciertos') + ' para tu próximo premio.'));
    var paraRaro = 50 - (estado.entregados % 50);
    prog.appendChild(el('p', '', 'Power ups entregados hoy: ' + Math.min(10, estado.hoy) + ' de 10. Llevas ' + estado.entregados +
      ' en total: el power up ' + (estado.entregados + paraRaro) + ' es un raro o muy raro asegurado (' +
      (paraRaro === 1 ? 'el próximo' : 'faltan ' + paraRaro) + ').'));
    if (estado.hoy >= 10) prog.appendChild(el('p', 'ayuda', 'Hoy ya llegaste al tope. Sigue practicando: hasta mañana los aciertos no cuentan para el premio, así no pierdes progreso.'));
    if (estado.nivel) {
      prog.appendChild(el('p', '', 'Nivel de práctica: ' + estado.nivel.nivel + ' (' + Math.round(estado.nivel.fraccion * 100) +
        ' % hacia el siguiente).'));
      var barra = el('div', 'duelo-barra');
      barra.setAttribute('role', 'progressbar');
      barra.setAttribute('aria-valuemin', '0'); barra.setAttribute('aria-valuemax', '100');
      barra.setAttribute('aria-valuenow', String(Math.round(estado.nivel.fraccion * 100)));
      barra.setAttribute('aria-label', 'Avance hacia el siguiente nivel');
      var r = el('span', 'duelo-barra-relleno');
      r.style.width = Math.round(estado.nivel.fraccion * 100) + '%';
      barra.appendChild(r);
      prog.appendChild(barra);
      prog.appendChild(el('p', 'ayuda', 'Leer, hacer ejercicios de visión y practicar en la aventura suman al nivel. Los mini juegos no.'));
    }
    raiz.appendChild(prog);

    // --- Mi tarjeta completa (v2)
    if (estado.perfilCompleto) {
      var tc = el('section', 'red-caja');
      tc.appendChild(el('h2', '', 'Mi tarjeta completa (v2)'));
      tc.appendChild(el('p', 'ayuda', 'Esta tarjeta incluye tu configuración visual (tema, fuente, layouts, sonidos) y tiempo por módulo. Al importarla en otro servidor, verás la batalla con TU configuración.'));

      var tiempo = estado.perfilCompleto.tiempo_por_modulo || {};
      if (Object.keys(tiempo).length) {
        var tsec = el('section', 'red-caja');
        tsec.appendChild(el('h3', '', 'Tiempo invertido por módulo'));
        renderTiempoModulo('Lectura veloz', tiempo.lectura || {}, tsec);
        renderTiempoModulo('Visión', tiempo.vision || {}, tsec);
        renderTiempoModulo('RPG (PvE)', { pve: (tiempo.rpg && tiempo.rpg.pve) || 0 }, tsec);
        renderTiempoModulo('Duelo PvP', { pvp: (tiempo.rpg && tiempo.rpg.pvp) || 0 }, tsec);
        renderTiempoModulo('Mini juegos', tiempo.minijuegos || {}, tsec);
        if (tiempo.duelo) renderTiempoModulo('Duelo (legacy)', { total: tiempo.duelo }, tsec);
        if (tiempo.total) {
          var p = el('p', 'red-estado');
          p.innerHTML = '<strong>Total: ' + formatearTiempo(tiempo.total) + '</strong>';
          tsec.appendChild(p);
        }
        tc.appendChild(tsec);
      }

      var cfg = estado.perfilCompleto.config || {};
      if (Object.keys(cfg).length) {
        var csec = el('section', 'red-caja');
        csec.appendChild(el('h3', '', 'Configuración visual'));
        var ul = el('ul', 'equipo-lista');
        if (cfg.tema) ul.appendChild(el('li', '', 'Tema: ' + cfg.tema));
        if (cfg.fuente_global) ul.appendChild(el('li', '', 'Fuente global: ' + cfg.fuente_global));
        if (cfg.animaciones_sitio) ul.appendChild(el('li', '', 'Animaciones sitio: ' + cfg.animaciones_sitio));
        if (cfg.animaciones_batalla) ul.appendChild(el('li', '', 'Animaciones batalla: ' + cfg.animaciones_batalla));
        if (cfg.sonidos) ul.appendChild(el('li', '', 'Sonidos: ' + (cfg.sonidos.activado ? 'activado' : 'desactivado') + (cfg.sonidos.volumen ? ' · vol ' + Math.round(cfg.sonidos.volumen * 100) + '%' : '')));
        if (cfg.layout_rpg01) ul.appendChild(el('li', '', 'Layout RPG01: guardado'));
        if (cfg.layout_rpg01_movil) ul.appendChild(el('li', '', 'Layout RPG01 móvil: guardado'));
        if (cfg.layout_rpg02) ul.appendChild(el('li', '', 'Layout RPG02: guardado'));
        if (cfg.layout_rpg02_movil) ul.appendChild(el('li', '', 'Layout RPG02 móvil: guardado'));
        if (cfg.layout_rpg03) ul.appendChild(el('li', '', 'Layout RPG03: guardado'));
        if (cfg.layout_rpg03_movil) ul.appendChild(el('li', '', 'Layout RPG03 móvil: guardado'));
        if (cfg.ajustes_aventura) ul.appendChild(el('li', '', 'Ajustes aventura: guardados'));
        if (cfg.ajustes_duelo) ul.appendChild(el('li', '', 'Ajustes duelo: guardados'));
        csec.appendChild(ul);
        tc.appendChild(csec);
      }
      raiz.appendChild(tc);
    }

    // --- tarjeta de jugador (v1 compatible)
    var tj = el('section', 'red-caja');
    tj.appendChild(el('h2', '', 'Mi tarjeta de jugador (v1 compatible)'));
    tj.appendChild(el('p', '', 'Tu nivel y tus power ups viven en este navegador. Si juegas en el servidor de otra persona, ahí no están: lleva tu tarjeta y el duelo la leerá para mostrar tu nivel y dejarte usar tus power ups. Allá tus power ups se usan sin gastarse.'));
    var cn = el('div', 'ajustes-campo');
    var ln = el('label', '', 'Nombre en la tarjeta');
    ln.setAttribute('for', 'tarjeta-nombre');
    var nombreIn = el('input', 'editor-campo');
    nombreIn.id = 'tarjeta-nombre'; nombreIn.type = 'text'; nombreIn.maxLength = 16; nombreIn.autocomplete = 'nickname';
    try { nombreIn.value = window.localStorage.getItem('red_nombre') || ''; } catch (e) {}
    cn.appendChild(ln); cn.appendChild(nombreIn);
    tj.appendChild(cn);
    var fila = el('div', 'duelo-power-ups');
    var copiar = el('button', 'boton boton--principal', 'Copiar mi código (v2)');
    copiar.type = 'button';
    var bajar = el('button', 'boton', 'Descargar el archivo (v2)');
    bajar.type = 'button';
    function generar() {
      try { window.localStorage.setItem('red_nombre', nombreIn.value.trim()); } catch (e) {}
      return R.crearTarjeta(nombreIn.value.trim() || 'Jugador');
    }
    copiar.addEventListener('click', function () {
      generar().then(function (t) {
        var codigo = R.aTexto(t);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(codigo).then(function () { decir('Código v2 copiado. Pégalo en el otro servidor.'); copiar.textContent = 'Código copiado'; });
        } else {
          window.prompt('Copia este código:', codigo);
        }
      }).catch(function (e) { decir(e.message); });
    });
    bajar.addEventListener('click', function () {
      generar().then(function (t) {
        var blob = new Blob([JSON.stringify(t, null, 1)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'tarjeta-reto-' + (t.perfil.nombre || 'jugador').replace(/[^A-Za-z0-9_-]+/g, '_') + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        decir('Archivo v2 descargado.');
      }).catch(function (e) { decir(e.message); });
    });
    fila.appendChild(copiar); fila.appendChild(bajar);
    tj.appendChild(fila);
    tj.appendChild(el('p', 'ayuda', 'La tarjeta v2 lleva tu nivel, power ups, equipo, configuración visual (tema, fuente, layouts, sonidos) y tiempo por módulo, con una huella que avisa si la editan a mano. No la cambies: no sirve para hacer trampa entre amigos, y el duelo la revisa con las reglas.'));
    raiz.appendChild(tj);

    // --- equipo
    var eq = el('section', 'red-caja');
    eq.appendChild(el('h2', '', 'Tu equipo'));
    var c = R.contar(estado.equipo, cat);
    eq.appendChild(el('p', 'red-estado', 'Comunes ' + c.comun + ' de ' + R.EQUIPO_MAX.comun + ' · Especiales ' + c.especial + ' de ' +
      R.EQUIPO_MAX.especial + ' · Raro o muy raro ' + c.raro_o_muy_raro + ' de ' + R.EQUIPO_MAX.raro_o_muy_raro));
    eq.appendChild(el('p', 'ayuda', estado.equipo.length
      ? 'Llevas: ' + estado.equipo.map(nombre).join(', ') + '. Se usa en la aventura y en los duelos.'
      : 'No llevas ninguno. Elígelos abajo, entre los que tienes.'));
    raiz.appendChild(eq);

    // --- inventario
    var inv = el('section', 'red-caja');
    inv.appendChild(el('h2', '', 'Tu inventario (' + estado.inventario.length + ' de ' + R.INVENTARIO_MAX + ')'));
    if (!unicos.length) {
      inv.appendChild(el('p', '', 'Todavía no tienes power ups. Se ganan acertando en la aventura contra el enemigo y en los tests (asociar, escribir y resolver): cada 10 aciertos, 1 o 2, con un máximo de 10 al día.'));
      var ir = el('a', 'boton boton--principal', 'Ir a la aventura');
      ir.href = 'aventura.html';
      inv.appendChild(ir);
    }
    var lista = el('ul', 'equipo-lista');
    unicos.sort(function (a, b) {
      return R.RAREZAS.indexOf(rareza(b)) - R.RAREZAS.indexOf(rareza(a)) || nombre(a).localeCompare(nombre(b));
    }).forEach(function (id) {
      var li = tarjeta(id, { copias: cuenta[id] });
      var llevado = estado.equipo.indexOf(id) >= 0;
      var cat1 = categoria(id);
      var lleno = !llevado && R.contar(estado.equipo, cat)[cat1] >= R.EQUIPO_MAX[cat1];
      var lab = el('label', 'opcion');
      var chk = el('input');
      chk.type = 'checkbox';
      chk.checked = llevado;
      chk.disabled = lleno;
      chk.addEventListener('change', function () {
        var nuevo = estado.equipo.filter(function (x) { return x !== id; });
        if (chk.checked) nuevo.push(id);
        estado.equipo = nuevo;
        R.guardarEquipo(nuevo).then(function () {
          decir(chk.checked ? nombre(id) + ' está en tu equipo.' : nombre(id) + ' salió de tu equipo.');
        });
        pintar();
      });
      lab.appendChild(chk);
      lab.appendChild(el('span', '', lleno ? 'Llevar (ya llevas el máximo de este tipo)' : 'Llevar en mi equipo'));
      li.appendChild(lab);
      var d = el('button', 'boton equipo-descartar', estado.confirmar === id ? '¿Seguro? Descartar una copia' : 'Descartar una copia');
      d.type = 'button';
      d.addEventListener('click', function () {
        if (estado.confirmar !== id) {
          estado.confirmar = id;
          pintar();
          window.setTimeout(function () { if (estado.confirmar === id) { estado.confirmar = null; pintar(); } }, 5000);
          return;
        }
        estado.confirmar = null;
        R.descartar(id).then(function (r) {
          estado.inventario = r.inventario;
          estado.equipo = r.equipo;
          decir('Descartaste una copia de ' + nombre(id) + '.');
          pintar();
        });
      });
      li.appendChild(d);
      lista.appendChild(li);
    });
    inv.appendChild(lista);
    raiz.appendChild(inv);

    // --- coleccion
    var col = el('section', 'red-caja');
    col.appendChild(el('h2', '', 'Todos los power ups (' + Object.keys(cat.powerups).length + ')'));
    col.appendChild(el('p', 'ayuda', 'Cada clase se lleva especialmente bien con 6 de ellos: ganan alrededor de un 25 % más de efecto, y nunca pierden nada.'));
    R.RAREZAS.forEach(function (rz) {
      var ids = Object.keys(cat.powerups).filter(function (id) { return rareza(id) === rz; });
      var det = el('details');
      det.appendChild(el('summary', '', R.NOMBRES_RAREZA[rz] + ' (' + ids.length + ')'));
      var ul = el('ul', 'equipo-lista');
      ids.forEach(function (id) {
        var li = tarjeta(id, { copias: 0 });
        li.appendChild(el('p', 'red-estado', cuenta[id] ? 'Lo tienes' + (cuenta[id] > 1 ? ' (' + cuenta[id] + ' copias)' : '') : 'Aún no lo tienes'));
        ul.appendChild(li);
      });
      det.appendChild(ul);
      col.appendChild(det);
    });
    raiz.appendChild(col);
  }

  function iniciar() {
    raiz = document.getElementById('equipo');
    vivo = document.getElementById('equipo-vivo');
    R = window.RetoRpg;
    if (!raiz || !R) return;
    Promise.all([R.catalogo(), R.inventario(), R.equipo(), R.aciertos(), R.nivel(), R.entregados(), R.entregadosHoy(), window.RetoPerfil ? window.RetoPerfil.obtener() : Promise.resolve(null)]).then(function (r) {
      cat = r[0];
      if (!Object.keys(cat.powerups).length) { 
        raiz.textContent = 'No pude cargar los power ups. Recarga la página.';
        return; 
      }
      estado.inventario = r[1]; estado.equipo = r[2]; estado.aciertos = r[3]; estado.nivel = r[4]; estado.entregados = r[5]; estado.hoy = r[6];
      estado.perfilCompleto = r[7];
      pintar();
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
