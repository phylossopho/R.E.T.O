/* =========================================================================
   R.E.T.O. - Duelo por wifi local (pantalla)
   -------------------------------------------------------------------------
   Esta pagina SOLO muestra y manda: crear una sala o unirse con un codigo,
   elegir clase, armar el mazo con tus propios tests y combatir por turnos. Las
   reglas, el dano, los turnos y las respuestas correctas viven en el servidor
   (logica/rpg.py y logica/sala.py); aqui nunca se calcula ni se ve nada de eso.

   COMO SE HABLAN LOS DISPOSITIVOS: se manda con POST y se pregunta cada segundo
   (sondeo). El servidor devuelve la vista de ESTE jugador, y solo cuando algo
   cambio (la "firma"). Al recargar la pagina se vuelve a entrar con el mismo
   token (sessionStorage).

   ACCESIBILIDAD: todo es texto y botones de verdad; los avisos de turno y de
   resultado van en una region aria-live="polite"; las opciones se contestan con
   los botones o con las teclas 1 a 4; la vida es un progressbar con su texto.
   ========================================================================= */
(function () {
  'use strict';

  var API = '/api/sala';
  var CLASES = [
    ['guerrero', 'Guerrero', 'Cuerpo a cuerpo'], ['caballero', 'Caballero', 'Cuerpo a cuerpo'],
    ['mago', 'Mago', 'Magia'], ['clerigo', 'Clérigo', 'Magia'],
    ['asesino', 'Asesino', 'Sigilo'], ['arquero', 'Arquero', 'Sigilo']
  ];
  var NOMBRE_CLASE = {};
  CLASES.forEach(function (c) { NOMBRE_CLASE[c[0]] = c[1]; });
  var MAZO_MIN = 24;
  var MAZO_MAX = 30;

  var raiz, vivoEl, errorEl;
  var sesion = null;           // { codigo, token }
  var vista = null;
  var firma = null;
  var sondeo = null;
  var cuenta = null;           // { desde, valor } para la cuenta regresiva
  var local = {
    clase: null, tests: [], elegidos: {}, mazo: null, aviso: '', subiendo: false,
    nombres: null, confirmaRendir: false, textos: null, ultimoAviso: '',
    equipo: [], catalogo: null, consumido: false, inicioDuelo: null,
    perfil: null,        // lo que se sabe de ti en ESTE dispositivo
    tarjeta: null,       // { perfil, tarjeta } si cargaste la de otro servidor
    abrirTarjeta: false, errorTarjeta: '',
    fondo: undefined,    // el fondo de ESTE duelo (uno al azar de imagenes/fondos/)
    turnoSprites: undefined,
    pvPrevio: null,
    numeroVida: null,
    tam: null            // tamaño del texto de las preguntas: peq | med | gra
  };

  /* ------------------------------------------------------------ utilidades */
  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function vaciar(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function almacen(clave, valor, sesionTipo) {
    try {
      var s = sesionTipo ? window.sessionStorage : window.localStorage;
      if (valor === undefined) return s.getItem(clave);
      if (valor === null) s.removeItem(clave); else s.setItem(clave, valor);
    } catch (e) { /* sin almacenamiento */ }
    return null;
  }

  function decir(t) {
    if (t === local.ultimoAviso) return;
    local.ultimoAviso = t;
    vivoEl.textContent = '';
    window.setTimeout(function () { vivoEl.textContent = t; }, 30);
  }

  function falla(msg) { errorEl.textContent = msg || ''; }

  function llamar(metodo, ruta, cuerpo) {
    var opts = { method: metodo, headers: { 'Content-Type': 'application/json' } };
    if (cuerpo) opts.body = JSON.stringify(cuerpo);
    return fetch(API + ruta, opts).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) { var e = new Error((d && d.error) || 'No se pudo.'); e.http = r.status; throw e; }
        return d;
      });
    }, function () { throw new Error('No hay conexión con la computadora anfitriona.'); });
  }

  function barajar(lista) {
    var a = lista.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function yo() { return vista.jugadores.filter(function (j) { return j.id === vista.yo; })[0]; }
  function rival() { return vista.jugadores.filter(function (j) { return j.id !== vista.yo; })[0]; }

  function nombrePU(id) {
    var t = local.textos && local.textos[id];
    return t ? t.nombre : id;
  }

  /* El equipo que se lleva: el guardado, sin los que necesitan tiempo si no hay tiempo. */
  function perfilActivo() { return local.tarjeta ? local.tarjeta.perfil : local.perfil; }

  function configTarjetaActiva() {
    var activo = perfilActivo();
    return (activo && activo.config) ? activo.config : {};
  }

  function aplicarConfigTarjeta() {
    var cfg = configTarjetaActiva();
    if (!cfg || !Object.keys(cfg).length) return;

    // Animaciones de batalla (ya se lee de localStorage en iniciar(), pero la tarjeta puede sobrescribir)
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
    }

    // Tamaño del texto de las preguntas en duelo (ajustes_duelo.tam_preguntas)
    if (cfg.ajustes_duelo && cfg.ajustes_duelo.tam_preguntas) {
      local.tam = cfg.ajustes_duelo.tam_preguntas;
      try { window.sessionStorage.setItem('duelo_tam_preguntas', local.tam); } catch (e) {}
    }

    // Layout de batalla (si la tarjeta trae layout para el modelo de duelo)
    // El duelo usa una estructura similar a RPG01, así que intentamos aplicar layout_rpg01
    var layoutKey = window.innerWidth >= 720 ? 'layout_rpg01' : 'layout_rpg01_movil';
    var layout = cfg[layoutKey];
    if (layout && window.RetoSprites) {
      // El layout se aplica después de crear la escena, en aplicarLayoutDuelo
      local._layoutTarjeta = layout;
    } else {
      local._layoutTarjeta = null;
    }
  }

  function aplicarLayoutDuelo(escena) {
    var layout = local._layoutTarjeta;
    if (!layout) return;
    var els = escena.querySelectorAll('[data-lay]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-lay');
      var l = layout[key];
      if (!l) continue;
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
  }

  function equipoParaSubir() {
    var cat = local.catalogo;
    var conTiempo = vista && vista.config && vista.config.con_tiempo;
    var base = local.tarjeta ? local.tarjeta.perfil.equipo : local.equipo;
    return base.filter(function (id) {
      return !(cat && cat.powerups[id] && cat.powerups[id].requiere_tiempo && !conTiempo);
    });
  }

  /* ------------------------------------------------------------- entrada */
  function pantallaEntrada(mensaje) {
    vaciar(raiz);
    var caja = el('section', 'red-caja');
    caja.appendChild(el('h2', '', 'Duelo entre dos jugadores'));
    caja.appendChild(el('p', 'ayuda',
      'Uno crea la sala y le dice el código al otro. Cada quien usa sus propios tests para armar su mazo. ' +
      'Si juegan en dispositivos distintos, quien crea la sala pulsa «Invitar a otro dispositivo» y el otro pega ahí su código al unirse.'));
    if (mensaje) caja.appendChild(el('p', 'red-estado', mensaje));
    var c1 = el('div', 'ajustes-campo');
    var l1 = el('label', '', 'Tu nombre');
    l1.setAttribute('for', 'duelo-nombre');
    var nombre = el('input', 'editor-campo');
    nombre.id = 'duelo-nombre'; nombre.type = 'text'; nombre.maxLength = 16; nombre.autocomplete = 'nickname';
    nombre.value = almacen('red_nombre') || '';
    c1.appendChild(l1); c1.appendChild(nombre);
    caja.appendChild(c1);

    var crear = el('button', 'boton boton--principal', 'Crear una sala');
    crear.type = 'button';
    crear.addEventListener('click', function () {
      almacen('red_nombre', nombre.value.trim());
      llamar('POST', '/crear', { nombre: nombre.value }).then(entrar).catch(function (e) { falla(e.message); });
    });
    caja.appendChild(crear);

    var c2 = el('div', 'ajustes-campo');
    var l2 = el('label', '', 'O únete con el código de tu amigo');
    l2.setAttribute('for', 'duelo-codigo');
    var codigo = el('input', 'editor-campo duelo-codigo');
    codigo.id = 'duelo-codigo'; codigo.type = 'text'; codigo.maxLength = 4; codigo.autocomplete = 'off';
    codigo.setAttribute('autocapitalize', 'characters');
    c2.appendChild(l2); c2.appendChild(codigo);
    caja.appendChild(c2);
    var unir = el('button', 'boton', 'Unirme');
    unir.type = 'button';
    unir.addEventListener('click', function () {
      almacen('red_nombre', nombre.value.trim());
      llamar('POST', '/unirse', { codigo: codigo.value, nombre: nombre.value }).then(entrar)
        .catch(function (e) { falla(e.message); });
    });
    caja.appendChild(unir);
    raiz.appendChild(caja);
  }

  function entrar(d) {
    falla('');
    sesion = { codigo: d.codigo, token: d.token };
    almacen('duelo_sesion', JSON.stringify(sesion), true);
    try { sessionStorage.setItem('duelo_sala_codigo', d.codigo); } catch (e) {}
    vista = null; firma = null;
    local.clase = null; local.mazo = null; local.elegidos = {}; local.consumido = false; local.inicioDuelo = null;
    empezarSondeo();
    preguntar();
  }

  function salir() {
    sesion = null; vista = null; firma = null;
    almacen('duelo_sesion', null, true);
    try { sessionStorage.removeItem('duelo_sala_codigo'); } catch (e) {}
    local.fondo = undefined;
    local.turnoSprites = undefined;
    local.pvPrevio = null;
    local.numeroVida = null;
    if (sondeo) { window.clearInterval(sondeo); sondeo = null; }
    pantallaEntrada();
  }

  /* -------------------------------------------------------------- sondeo */
  function empezarSondeo() {
    if (sondeo) window.clearInterval(sondeo);
    sondeo = window.setInterval(preguntar, 900);
  }

  function preguntar() {
    if (!sesion || document.hidden) return;
    var ruta = '/' + sesion.codigo + '/estado?token=' + encodeURIComponent(sesion.token) +
               (firma ? '&firma=' + encodeURIComponent(firma) : '');
    llamar('GET', ruta).then(function (d) {
      if (!d.cambio) return;
      firma = d.firma;
      vista = d;
      cuenta = d.restante === null ? null : { desde: Date.now(), valor: d.restante };
      render();
    }).catch(function (e) {
      if (e.http === 404 || e.http === 403) { salir(); falla('La sala se cerró o ya no eres parte de ella.'); return; }
      falla(e.message);
    });
  }

  function jugar(cuerpo) {
    falla('');
    return llamar('POST', '/' + sesion.codigo + '/accion', Object.assign({ token: sesion.token }, cuerpo))
      .then(function (d) { firma = d.firma; vista = d; cuenta = d.restante === null ? null : { desde: Date.now(), valor: d.restante }; render(); })
      .catch(function (e) { falla(e.message); });
  }

  function render() {
    if (!vista) return;
    if (vista.fase === 'espera') pantallaPreparacion();
    else if (vista.fase === 'duelo') pantallaDuelo();
    else pantallaFin();
  }

  /* ----------------------------------------------------------- preparacion */
  function etiquetaConfig(c) {
    return 'Daño base ' + c.dano_base + ' · ventaja de clase ' + c.ventaja + ' puntos · ' +
           (c.con_tiempo ? 'con tiempo (' + c.segundos_pregunta + ' s)' : 'sin tiempo');
  }

  function campoSelect(etiqueta, id, opciones, valor, alCambiar) {
    var c = el('div', 'ajustes-campo');
    var l = el('label', '', etiqueta);
    l.setAttribute('for', id);
    var s = el('select', 'editor-campo');
    s.id = id;
    opciones.forEach(function (o) {
      var op = el('option', '', o[1]);
      op.value = String(o[0]);
      s.appendChild(op);
    });
    s.value = String(valor);
    s.addEventListener('change', function () { alCambiar(s.value); });
    c.appendChild(l); c.appendChild(s);
    return c;
  }

  function preguntasDe(test) {
    return (test.preguntas || []).filter(function (p) {
      return p && p.tipo === 'estatica' && p.opciones && p.opciones.length >= 2 && p.correcta !== undefined && p.correcta !== null;
    });
  }

  function temaTexto(t) {
    if (!t || typeof t !== 'object') return '';
    return [t.n2, t.n3, t.n4].filter(Boolean).join(' › ');
  }

  function disponibles() {
    var total = 0;
    local.tests.forEach(function (t) { if (local.elegidos[t.id]) total += preguntasDe(t).length; });
    return total;
  }

  function armarMazo() {
    var pool = [];
    local.tests.forEach(function (t) {
      if (!local.elegidos[t.id]) return;
      preguntasDe(t).forEach(function (p) {
        pool.push({
          id: t.id + ':' + p.id, enunciado: p.enunciado, tema: temaTexto(p.tema) || (t.titulo || t.nombre || ''),
          opciones: p.opciones.map(function (o) { return { id: String(o.id), texto: String(o.texto) }; }),
          correcta: String(p.correcta)
        });
      });
    });
    if (pool.length < MAZO_MIN) { local.mazo = null; return; }
    local.mazo = barajar(pool).slice(0, Math.min(MAZO_MAX, pool.length));
  }

  function subirPreparacion() {
    if (!local.clase || !local.mazo) return;
    local.subiendo = true;
    llamar('POST', '/' + sesion.codigo + '/preparar', { token: sesion.token, clase: local.clase, mazo: local.mazo, equipo: equipoParaSubir(),
      perfil: perfilActivo() ? Object.assign({}, perfilActivo(), { nombre: yo() ? yo().nombre : 'Jugador' }) : undefined,
      origen: local.tarjeta ? 'tarjeta' : 'local' })
      .then(function (d) { falla(''); local.aviso = 'Tu mazo y tu clase están listos.'; local.subiendo = false; firma = d.firma; vista = d; render(); })
      .catch(function (e) { local.subiendo = false; falla(e.message); });
  }

  function pantallaPreparacion() {
    local.inicioDuelo = null;
    var yoJ = yo();
    var soyAnfitrion = vista.yo === 'j1';
    var rivalJ = rival();
    vaciar(raiz);

    // --- la sala
    var sala = el('section', 'red-caja');
    sala.appendChild(el('h2', '', 'Sala'));
    var cod = el('p', 'duelo-codigo-grande');
    cod.appendChild(document.createTextNode('Código: '));
    cod.appendChild(el('strong', '', vista.codigo));
    sala.appendChild(cod);
    var lista = el('ul', 'red-mensajes');
    vista.jugadores.forEach(function (j) {
      var li = el('li', 'red-mensaje' + (j.id === vista.yo ? ' red-mensaje--mio' : ''));
      li.appendChild(el('strong', '', j.nombre + (j.id === vista.yo ? ' (tú)' : '')));
      li.appendChild(document.createTextNode(' · nivel ' + j.nivel + (j.origen === 'tarjeta' ? ' (tarjeta)' : '') +
        ' · ' + (j.id === vista.yo ? (j.clase ? NOMBRE_CLASE[j.clase] : 'sin clase') : (j.tiene_clase ? 'ya eligió clase (es secreta)' : 'sin clase')) +
        ' · ' + (j.equipo ? j.equipo + ' power up' + (j.equipo === 1 ? '' : 's') : 'sin power ups') +
        ' · ' + (j.mazo ? 'mazo de ' + j.mazo : 'sin mazo') + ' · ' + (j.listo ? 'listo ✓' : 'preparándose') +
        (j.conectado ? '' : ' · sin conexión')));
      lista.appendChild(li);
    });
    sala.appendChild(lista);
    if (!rivalJ) sala.appendChild(el('p', 'red-estado', 'Esperando a que alguien se una con el código ' + vista.codigo + '…'));
    if (vista.aviso) sala.appendChild(el('p', 'red-estado', vista.aviso));
    raiz.appendChild(sala);

    // --- la configuracion (la cambia quien creo la sala; todos la ven)
    var cfg = el('section', 'red-caja');
    cfg.appendChild(el('h2', '', 'Reglas de esta partida'));
    if (soyAnfitrion) {
      var c = vista.config;
      var danos = [[3, '3'], [5, '5'], [6, '6'], [8, '8'], [10, '10'], [12, '12'], [15, '15'], [20, '20']];
      if (!danos.some(function (d) { return d[0] === c.dano_base; })) danos.push([c.dano_base, String(c.dano_base)]);
      cfg.appendChild(campoSelect('Daño base (puntos de 100 por golpe)', 'duelo-dano', danos, c.dano_base, function (v) {
        llamar('POST', '/' + sesion.codigo + '/configurar', { token: sesion.token, config: { dano_base: parseInt(v, 10) } })
          .then(function (d) { firma = d.firma; vista = d; render(); }).catch(function (e) { falla(e.message); });
      }));
      cfg.appendChild(campoSelect('Ventaja de clase (puntos que suma o resta)', 'duelo-ventaja',
        [[0, 'Ninguna'], [3, '3 puntos'], [5, '5 puntos']], c.ventaja, function (v) {
          llamar('POST', '/' + sesion.codigo + '/configurar', { token: sesion.token, config: { ventaja: parseInt(v, 10) } })
            .then(function (d) { firma = d.firma; vista = d; render(); }).catch(function (e) { falla(e.message); });
        }));
      cfg.appendChild(campoSelect('Tiempo para responder', 'duelo-tiempo',
        [['no', 'Sin tiempo'], ['30', '30 segundos'], ['45', '45 segundos']], c.con_tiempo ? c.segundos_pregunta : 'no', function (v) {
          var cambios = v === 'no' ? { con_tiempo: false } : { con_tiempo: true, segundos_pregunta: parseInt(v, 10) };
          llamar('POST', '/' + sesion.codigo + '/configurar', { token: sesion.token, config: cambios })
            .then(function (d) { firma = d.firma; vista = d; render(); }).catch(function (e) { falla(e.message); });
        }));
    } else {
      cfg.appendChild(el('p', '', etiquetaConfig(vista.config)));
      cfg.appendChild(el('p', 'ayuda', 'Las cambia quien creó la sala. Si cambian, tendrás que marcarte listo otra vez.'));
    }
    cfg.appendChild(el('p', 'ayuda', 'El que acierta contraataca. Cada turno alguien pierde vida: se llega a 0 pronto.'));
    cfg.appendChild(el('p', 'ayuda', 'Cada quien juega con lo suyo: su nivel y sus power ups, sin ajustes.'));
    raiz.appendChild(cfg);

    // --- tu perfil: los datos de este dispositivo o la tarjeta de otro servidor
    var pf = el('section', 'red-caja');
    pf.appendChild(el('h2', '', 'Tu perfil'));
    var activo = perfilActivo();
    if (local.tarjeta) {
      pf.appendChild(el('p', '', 'Usas la tarjeta de ' + activo.nombre + ': nivel ' + activo.nivel + ' y ' + activo.inventario.length +
        ' power ups. Aquí se usan sin gastarse (se gastan solo en tu servidor).'));
      var quitar = el('button', 'boton', 'Usar los datos de este dispositivo');
      quitar.type = 'button';
      quitar.addEventListener('click', function () { local.tarjeta = null; almacen('duelo_tarjeta', null, true); subirPreparacion(); render(); });
      pf.appendChild(quitar);
    } else {
      pf.appendChild(el('p', '', 'Usas los datos de este dispositivo: nivel ' + (activo ? activo.nivel : 0) + ' y ' +
        (activo ? activo.inventario.length : 0) + ' power ups.'));
      pf.appendChild(el('p', 'ayuda', '¿Tus power ups y tu nivel están en otro servidor (el de tu casa, por ejemplo)? Lleva tu tarjeta de jugador desde Inventario y equipo y cárgala aquí.'));
      var abrir = el('button', 'boton', local.abrirTarjeta ? 'Cerrar' : 'Cargar mi tarjeta de jugador');
      abrir.type = 'button';
      abrir.addEventListener('click', function () { local.abrirTarjeta = !local.abrirTarjeta; local.errorTarjeta = ''; render(); });
      pf.appendChild(abrir);
      if (local.abrirTarjeta) {
        var ca = el('div', 'ajustes-campo');
        var la = el('label', '', 'Pega aquí tu código');
        la.setAttribute('for', 'duelo-tarjeta-texto');
        var ta = el('textarea', 'editor-campo');
        ta.id = 'duelo-tarjeta-texto'; ta.rows = 3;
        ca.appendChild(la); ca.appendChild(ta);
        pf.appendChild(ca);
        var cf = el('div', 'ajustes-campo');
        var lf = el('label', '', 'o elige el archivo de tu tarjeta');
        lf.setAttribute('for', 'duelo-tarjeta-archivo');
        var inf = el('input');
        inf.id = 'duelo-tarjeta-archivo'; inf.type = 'file'; inf.accept = '.json,application/json';
        cf.appendChild(lf); cf.appendChild(inf);
        pf.appendChild(cf);
        function usar(texto) {
          window.RetoRpg.leerTarjeta(texto).then(function (t) {
            local.tarjeta = t; local.abrirTarjeta = false; local.errorTarjeta = '';
            almacen('duelo_tarjeta', texto, true);
            subirPreparacion(); render();
          }).catch(function (e) { local.errorTarjeta = e.message; falla(e.message); });
        }
        inf.addEventListener('change', function () {
          var f = inf.files && inf.files[0];
          if (!f) return;
          var rd = new FileReader();
          rd.onload = function () { usar(String(rd.result)); };
          rd.readAsText(f);
        });
        var ok = el('button', 'boton boton--principal', 'Usar esta tarjeta');
        ok.type = 'button';
        ok.addEventListener('click', function () { usar(ta.value); });
        pf.appendChild(ok);
      }
    }
    raiz.appendChild(pf);

    // --- mi clase
    var cls = el('section', 'red-caja');
    cls.appendChild(el('h2', '', 'Tu clase'));
    var grupo = el('div', 'opciones');
    grupo.setAttribute('role', 'radiogroup');
    grupo.setAttribute('aria-label', 'Tu clase');
    var actual = local.clase || yoJ.clase;
    CLASES.forEach(function (c) {
      var lab = el('label', 'opcion');
      var inp = el('input');
      inp.type = 'radio'; inp.name = 'duelo-clase'; inp.value = c[0];
      inp.checked = actual === c[0];
      inp.addEventListener('change', function () { local.clase = c[0]; subirPreparacion(); });
      lab.appendChild(inp);
      lab.appendChild(el('span', '', c[1] + ' (' + c[2] + ')'));
      grupo.appendChild(lab);
    });
    cls.appendChild(grupo);
    cls.appendChild(el('p', 'ayuda', 'Cuerpo a cuerpo gana a Magia, Magia gana a Sigilo y Sigilo gana a Cuerpo a cuerpo. Dentro de la misma pareja no hay ventaja.'));
    raiz.appendChild(cls);

    // --- mi mazo
    var mz = el('section', 'red-caja');
    mz.appendChild(el('h2', '', 'Tu mazo de preguntas'));
    mz.appendChild(el('p', 'ayuda',
      'Elige uno o más de tus tests. Se arma un mazo de ' + MAZO_MIN + ' a ' + MAZO_MAX + ' preguntas con respuestas fijas. ' +
      'Tu rival no ve tus preguntas hasta que te las manda.'));
    if (!local.tests.length) {
      mz.appendChild(el('p', 'red-estado', 'No encontré tests con preguntas fijas en este dispositivo. Impórtalos o créalos en Test de conocimientos.'));
    }
    var tl = el('div', 'opciones');
    local.tests.forEach(function (t) {
      var n = preguntasDe(t).length;
      var lab = el('label', 'opcion');
      var inp = el('input');
      inp.type = 'checkbox';
      inp.checked = !!local.elegidos[t.id];
      inp.addEventListener('change', function () {
        local.elegidos[t.id] = inp.checked;
        armarMazo();
        subirPreparacion();
        render();
      });
      lab.appendChild(inp);
      lab.appendChild(el('span', '', (t.titulo || t.nombre || t.id) + ' (' + n + ' preguntas)'));
      tl.appendChild(lab);
    });
    mz.appendChild(tl);
    var disp = disponibles();
    var estadoMazo = yoJ.mazo ? 'Tu mazo está subido: ' + yoJ.mazo + ' preguntas.'
      : (disp ? 'Con lo elegido hay ' + disp + ' preguntas' + (disp < MAZO_MIN ? '; faltan ' + (MAZO_MIN - disp) + ' (elige otro test).' : '.') : 'Aún no elegiste ningún test.');
    mz.appendChild(el('p', 'red-estado', estadoMazo));
    var otro = el('button', 'boton', 'Armar otro mazo al azar');
    otro.type = 'button';
    otro.addEventListener('click', function () { armarMazo(); subirPreparacion(); });
    if (disp >= MAZO_MIN) mz.appendChild(otro);
    var eqTxt = equipoParaSubir().map(nombrePU);
    mz.appendChild(el('p', 'ayuda', eqTxt.length
      ? 'Tu equipo de power ups: ' + eqTxt.join(', ') + '. Usar uno gasta una copia.'
      : 'Power ups: no llevas ninguno. Se ganan acertando en la aventura y en los tests.'));
    var verEq = el('a', 'boton', 'Inventario y equipo');
    verEq.href = '../../test-conocimientos/aventura/equipo.html';
    mz.appendChild(verEq);
    raiz.appendChild(mz);

    // --- listo
    var fin = el('section', 'red-caja');
    var puedo = !!(yoJ.clase && yoJ.mazo) && vista.jugadores.length === 2;
    var btn = el('button', 'boton boton--principal duelo-grande', yoJ.listo ? 'Ya no estoy listo' : 'Estoy listo');
    btn.type = 'button';
    btn.disabled = !puedo && !yoJ.listo;
    btn.addEventListener('click', function () {
      llamar('POST', '/' + sesion.codigo + '/listo', { token: sesion.token, listo: !yoJ.listo })
        .then(function (d) { falla(''); firma = d.firma; vista = d; render(); }).catch(function (e) { falla(e.message); });
    });
    fin.appendChild(btn);
    fin.appendChild(el('p', 'ayuda', puedo ? 'Cuando los dos estén listos, empieza el duelo.'
      : 'Para estar listo necesitas un rival en la sala, tu clase y tu mazo.'));
    var salirB = el('button', 'boton', soyAnfitrion ? 'Cerrar la sala' : 'Salir de la sala');
    salirB.type = 'button';
    salirB.addEventListener('click', function () {
      if (soyAnfitrion) llamar('POST', '/' + sesion.codigo + '/cerrar', { token: sesion.token }).then(salir).catch(salir);
      else salir();
    });
    fin.appendChild(salirB);
    raiz.appendChild(fin);

    decir(rivalJ ? (rivalJ.nombre + ' está en la sala.') : 'Esperando a un rival.');
  }

  /* ----------------------------------------------------------------- duelo */
  /* Tamaño del texto de las preguntas que se ofrecen. Por defecto el MAS PEQUEÑO que deja
     WCAG: la norma no fija un minimo en pixeles, asi que se usa 0,875 rem (14 px con la
     letra normal del navegador) que crece con el zoom y la letra de la persona (1.4.4),
     con botones de al menos 44 px de alto (2.5.8) y contraste del tema (1.4.3). */
  var TAMANOS = [['peq', 'Pequeño (por defecto)'], ['med', 'Mediano'], ['gra', 'Grande']];

  function tamPreguntas() {
    if (!local.tam) local.tam = almacen('duelo_tam_preguntas') || 'peq';
    return local.tam;
  }

  /* El HUD de un jugador: su nombre (con nivel), la barra y, DEBAJO, la vida en numeros grandes.
     En sala de espera: del rival solo se ve su nombre (clase y avatar secretos).
     En combate: se muestra el avatar y clase de ambos. */
  function hud(nombre, j, ataca, clase) {
    var c = el('div', 'escena-hud ' + clase + (ataca ? ' escena-hud--ataca' : ''));
    var cab = el('p', 'escena-nombre');
    cab.appendChild(el('strong', '', nombre + ' Nvl. ' + (j.nivel || 0)));
    if (ataca) cab.appendChild(el('span', 'duelo-etiqueta', ' ⚔ ataca'));
    c.appendChild(cab);
    var pv = Math.ceil(j.pv);                       // la vida baja con decimales (0,3 % por segundo con tiempo)
    var pct = Math.max(0, Math.round(j.pv / j.pv_max * 100));
    var b = el('div', 'duelo-barra');
    b.setAttribute('role', 'progressbar');
    b.setAttribute('aria-valuemin', '0'); b.setAttribute('aria-valuemax', String(j.pv_max)); b.setAttribute('aria-valuenow', String(pv));
    b.setAttribute('aria-label', 'Vida de ' + nombre);
    var r = el('span', 'duelo-barra-relleno');
    r.style.width = pct + '%';
    b.appendChild(r);
    c.appendChild(b);
    var num = el('p', 'escena-hp');
    num.appendChild(el('span', 'escena-hp-valor', String(pv)));
    num.appendChild(el('small', '', ' / ' + j.pv_max + ' HP'));
    c.appendChild(num);
    return c;
  }

  function ultimoTexto(b) {
    var u = b.ultimo;
    if (!u || u.reintento) return u && u.reintento ? 'Segunda oportunidad: elige otra respuesta.' : '';
    var nombres = {};
    vista.jugadores.forEach(function (j) { nombres[j.id] = j.nombre; });
    var golpea = nombres[u.golpea], recibe = nombres[u.recibe];
    return u.acierto
      ? golpea + ' acertó y contraatacó: ' + recibe + ' pierde ' + u.dano + '.'
      : nombres[u.recibe] + ' falló: ' + golpea + ' le quita ' + u.dano + '.';
  }

  /* El numero junto al HP, igual que en la aventura: naranja cuando alguien pierde vida y verde SOLO cuando la gana
     (una curacion). La vida baja de a poquito con el tiempo (0,3 % por segundo): eso no cuenta, solo los cambios de
     1 punto o mas. El numero se sigue pintando aunque la pantalla se vuelva a armar mientras dura su animacion. */
  function cambiosDeVida(escena, miInfo, rivInfo) {
    var ahora = Date.now();
    var previo = local.pvPrevio;
    local.pvPrevio = { yo: miInfo.pv, rival: rivInfo.pv };
    if (previo) {
      [['yo', miInfo, '.escena-hud--yo'], ['rival', rivInfo, '.escena-hud--rival']].forEach(function (par) {
        var d = Math.round(par[1].pv - previo[par[0]]);
        if (Math.abs(d) >= 1) local.numeroVida = { quien: par[2], texto: d > 0 ? '+' + d : '−' + (-d), tipo: d > 0 ? 'cura' : 'dano', desde: ahora };
      });
    }
    var n = local.numeroVida;
    if (!n || !window.RetoEstados) return;
    var hpEl = escena.querySelector(n.quien + ' .escena-hp-valor');
    var r = window.RetoEstados.numeroJunto(hpEl, n.texto, n.tipo, ahora - n.desde);
    if (!r) local.numeroVida = null;
  }

  function pantallaDuelo() {
    if (!local.inicioDuelo) local.inicioDuelo = Date.now();
    local.consumido = false;
    var b = vista.batalla;
    var rivalJ = rival();
    var miInfo = b.yo_estado, rivInfo = b.rival;
    var soyAtacante = b.atacante === vista.yo;
    vaciar(raiz);

    // Aplicar configuración de la tarjeta v2 (tema, fuente, animaciones, layout, etc.)
    aplicarConfigTarjeta();

    var escena = el('section', 'escena-duelo escena--tam-' + tamPreguntas());
    if (local.fondo) escena.style.setProperty('--escena-fondo', 'url("' + local.fondo + '")');
    else if (local.fondo === undefined && window.RetoFondos) {
      local.fondo = null;
      window.RetoFondos.elegir().then(function (u) {
        local.fondo = u;
        if (u && escena.isConnected) escena.style.setProperty('--escena-fondo', 'url("' + u + '")');
      });
    }

    // --- el escenario: tu HUD y tu personaje; del rival, su avatar y clase (ya no es secreto en combate)
    var pant = el('div', 'escena-pantalla');
    pant.setAttribute('data-lay', 'screen');
    var hudRival = hud(rivInfo.nombre, rivInfo, !soyAtacante, 'escena-hud--rival');
    hudRival.setAttribute('data-lay', 'hud-oponente');
    pant.appendChild(hudRival);
    var sr = el('div', 'escena-sprite escena-sprite--rival');
    sr.setAttribute('data-lay', 'sprite-oponente');
    sr.setAttribute('data-estados', 'rival');
    sr.setAttribute('data-estados-flotante', '');
    var imgRival = document.createElement('img');
    imgRival.src = '../../../imagenes/' + rivInfo.clase + '.webp';
    imgRival.alt = 'Rival: ' + NOMBRE_CLASE[rivInfo.clase];
    imgRival.setAttribute('data-sprite', 'jugador');
    imgRival.setAttribute('data-personaje', rivInfo.clase);
    imgRival.setAttribute('data-legacy', imgRival.getAttribute('src'));
    sr.appendChild(imgRival);
    pant.appendChild(sr);
    var sy = el('div', 'escena-sprite escena-sprite--yo');
    sy.setAttribute('data-lay', 'sprite-jugador');
    var img = document.createElement('img');
    img.src = '../../../imagenes/' + miInfo.clase + '.webp';
    img.alt = 'Tu personaje: ' + NOMBRE_CLASE[miInfo.clase];
    img.setAttribute('data-sprite', 'jugador');
    img.setAttribute('data-personaje', miInfo.clase);
    img.setAttribute('data-legacy', img.getAttribute('src'));
    sy.appendChild(img);
    pant.appendChild(sy);
    var hudYo = hud(miInfo.nombre + ' (tú)', miInfo, soyAtacante, 'escena-hud--yo');
    hudYo.setAttribute('data-lay', 'hud-jugador');
    pant.appendChild(hudYo);
    escena.appendChild(pant);

// --- que toca hacer
    var caja = el('div', 'escena-caja');
    caja.setAttribute('data-lay', 'hud-barra');
    caja.appendChild(el('p', 'duelo-turno', 'Turno ' + b.turno));
    var estadoTxt;
    if (b.fase === 'elegir') {
      estadoTxt = soyAtacante ? 'Te toca atacar: elige una pregunta para mandársela a ' + rivInfo.nombre + '.'
                                : rivInfo.nombre + ' está eligiendo una pregunta…';
    } else {
      estadoTxt = soyAtacante ? rivInfo.nombre + ' está contestando…' : rivInfo.nombre + ' te mandó una pregunta. ¡Contesta!';
    }
    caja.appendChild(el('p', 'red-estado', estadoTxt));
    var timerEl = null;
    if (vista.config.con_tiempo && b.fase === 'responder') {
      var t = el('p', 'duelo-tiempo', '');
      t.id = 'duelo-tiempo-txt';
      t.setAttribute('aria-hidden', 'true');
      t.setAttribute('data-lay', 'timer');
      timerEl = t;
      caja.appendChild(t);
      pintarCuenta();
    }

    // en la fase de responder, la pregunta va arriba y las respuestas en el lugar de siempre
    if (b.fase === 'responder' && b.pregunta) {
      var q = el('div', 'escena-pregunta');
      q.setAttribute('data-lay', 'question');
      q.appendChild(el('p', 'duelo-enunciado', b.pregunta.enunciado));
      if (b.pregunta.tema) q.appendChild(el('p', 'ayuda', 'Tema: ' + b.pregunta.tema));
      caja.appendChild(q);
    }
    escena.appendChild(caja);

    // --- el lugar de las respuestas: aqui se ELIGE LA PREGUNTA que se le manda al rival
    var zona = el('div', 'escena-opciones');
    zona.setAttribute('data-lay', 'answers');
    if (b.fase === 'elegir' && soyAtacante) {
      zona.setAttribute('role', 'group');
      zona.setAttribute('aria-label', 'Preguntas que puedes mandarle a ' + rivInfo.nombre);
      b.oferta.forEach(function (p, i) {
        var bt = el('button', 'boton duelo-opcion escena-opcion', (i + 1) + '. ' + p.enunciado);
        bt.type = 'button';
        bt.setAttribute('data-n', String(i + 1));
        if (p.tema) bt.appendChild(el('small', 'duelo-tema', ' (' + p.tema + ')'));
        bt.addEventListener('click', function () { jugar({ tipo: 'elegir', pregunta: p.id }); });
        zona.appendChild(bt);
      });
    } else if (b.fase === 'responder' && b.pregunta && !soyAtacante) {
      zona.setAttribute('role', 'group');
      zona.setAttribute('aria-label', 'Respuestas');
      b.pregunta.opciones.forEach(function (o, i) {
        var bt = el('button', 'boton duelo-opcion escena-opcion escena-opcion--respuesta', String.fromCharCode(65 + i) + '. ' + o.texto);
        bt.type = 'button';
        bt.setAttribute('data-n', String(i + 1));
        bt.addEventListener('click', function () {
          Array.prototype.forEach.call(zona.querySelectorAll('button'), function (x) { x.disabled = true; });
          jugar({ tipo: 'responder', opcion: o.id });
        });
        zona.appendChild(bt);
      });
    }
    if (zona.firstChild) escena.appendChild(zona);

    var extra = el('div', 'escena-caja');
    var u = ultimoTexto(b);
    if (u) extra.appendChild(el('p', 'duelo-ultimo', 'Último turno: ' + u));
    if (rivalJ && !rivalJ.conectado) {
      extra.appendChild(el('p', 'red-estado', rivInfo.nombre + ' no responde. Si no vuelve pronto, ganas por abandono.'));
    }

    // power ups (los del equipo: se ganan en la aventura y en los tests)
    var ids = Object.keys(miInfo.equipo || {}).filter(function (k) { return miInfo.equipo[k] > 0; });
    if (ids.length) {
      var pu = el('div', 'duelo-power-ups');
      pu.setAttribute('data-lay', 'powerups');
      pu.appendChild(el('p', 'duelo-turno', 'Tus power ups'));
      ids.forEach(function (id) {
        var bt = el('button', 'boton', nombrePU(id) + ' (' + miInfo.equipo[id] + ')');
        bt.type = 'button';
        bt.addEventListener('click', function () { jugar({ tipo: 'power_up', id: id }); });
        pu.appendChild(bt);
      });
      extra.appendChild(pu);
    }

    // el tamaño del texto de las preguntas
    var fila = el('p', 'escena-tam');
    var etq = el('label', '', 'Tamaño del texto de las preguntas: ');
    etq.setAttribute('for', 'duelo-tam');
    var sel = el('select', '');
    sel.id = 'duelo-tam';
    TAMANOS.forEach(function (x) { var o = el('option', '', x[1]); o.value = x[0]; sel.appendChild(o); });
    sel.value = tamPreguntas();
    sel.addEventListener('change', function () { local.tam = sel.value; almacen('duelo_tam_preguntas', sel.value); render(); });
    fila.appendChild(etq); fila.appendChild(sel);
    extra.appendChild(fila);

    var rendir = el('button', 'boton duelo-rendirse', local.confirmaRendir ? '¿Seguro? Rendirme' : 'Rendirme');
    rendir.type = 'button';
    rendir.addEventListener('click', function () {
      if (!local.confirmaRendir) {
        local.confirmaRendir = true;
        render();
        window.setTimeout(function () { local.confirmaRendir = false; if (vista && vista.fase === 'duelo') render(); }, 5000);
        return;
      }
      local.confirmaRendir = false;
      jugar({ tipo: 'abandonar' });
    });
    extra.appendChild(rendir);
    escena.appendChild(extra);
    raiz.appendChild(escena);

    // Aplicar layout de la tarjeta v2 (posiciones, escalas, capas, modo respuestas)
    aplicarLayoutDuelo(escena);

    // Tu personaje: su sprite de espalda (o la imagen de siempre) y sus poses al ser golpeado o al atacar.
    if (window.RetoEstados) window.RetoEstados.pintar(escena, miInfo.efectos, rivInfo.efectos);   // auras y etiquetas de los efectos activos
    cambiosDeVida(escena, miInfo, rivInfo);
    if (window.RetoSprites) {
      window.RetoSprites.preparar(escena, { jugador: miInfo.clase });
      if (b.ultimo && local.turnoSprites !== undefined && b.turno !== local.turnoSprites) {
        if (b.ultimo.recibe === vista.yo) window.RetoSprites.estado(escena, 'jugador', 'herido', 900);
        else if (b.ultimo.dano) window.RetoSprites.estado(escena, 'jugador', 'ataque', 900);
      }
      local.turnoSprites = b.turno;
    }

    decir((u ? u + ' ' : '') + estadoTxt);
  }

  function pintarCuenta() {
    var t = document.getElementById('duelo-tiempo-txt');
    if (!t || !cuenta) return;
    var s = Math.max(0, Math.ceil(cuenta.valor - (Date.now() - cuenta.desde) / 1000));
    t.textContent = 'Tiempo: ' + s + ' s';
  }

  function teclas(e) {
    if (!vista || vista.fase !== 'duelo' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    var n = parseInt(e.key, 10);
    if (!(n >= 1 && n <= 6)) return;
    var bt = raiz.querySelector('button.duelo-opcion[data-n="' + n + '"]');
    if (bt && !bt.disabled) bt.click();
  }

  /* ------------------------------------------------------------------- fin */
  function pantallaFin() {
    var r = vista.resultado || {};
    var yoJ = yo(), rivalJ = rival();
    if (!local.consumido && r.jugadores && r.jugadores[vista.yo]) {
      local.consumido = true;
      var mio = r.jugadores[vista.yo];
      if (!local.tarjeta && window.RetoRpg && mio.usados && mio.usados.length) window.RetoRpg.consumir(mio.usados).then(function (x) { local.equipo = x.equipo; });
      if (!local.tarjeta && window.RetoProgreso && local.inicioDuelo) {
        window.RetoProgreso.registrarSesion({ tipo: 'rpg', ejercicio: 'duelo', minutos: (Date.now() - local.inicioDuelo) / 60000,
          rondas: r.motivo === 'abandono' ? 0 : 1, preguntas: mio.aciertos + mio.fallos });
      }
      if (!local.tarjeta && window.RetoRpg) {
        window.RetoRpg.nivel().then(function (n) {
          if (n && window.RetoPerfil && window.RetoPerfil.actualizarPuntos) {
            window.RetoPerfil.actualizarPuntos(n.puntos || 0, n.nivel || 0);
          }
        });
        Promise.all([window.RetoRpg.inventario(), window.RetoRpg.equipo(), window.RetoRpg.aciertos(), window.RetoRpg.entregados()]).then(function (rp) {
          if (window.RetoPerfil && window.RetoPerfil.actualizarPowerups) {
            window.RetoPerfil.actualizarPowerups({ inventario: rp[0], equipo: rp[1], aciertos: rp[2], entregados: rp[3] });
          }
        });
      }
    }
    vaciar(raiz);
    var caja = el('section', 'red-caja');
    var gane = r.ganador === vista.yo;
    caja.appendChild(el('h2', '', gane ? '¡Ganaste!' : (r.ganador === 'empate' ? 'Empate' : 'Perdiste esta vez')));
    var motivo = r.motivo === 'abandono' ? 'Por abandono.' : (r.motivo === 'turnos' ? 'Se acabaron los turnos: ganó quien tenía más vida.' : '');
    if (motivo) caja.appendChild(el('p', '', motivo));
    if (vista.aviso) caja.appendChild(el('p', '', vista.aviso));
    if (r.jugadores) {
      var ul = el('ul', 'red-mensajes');
      vista.jugadores.forEach(function (j) {
        var d = r.jugadores[j.id];
        if (!d) return;
        var li = el('li', 'red-mensaje');
        li.appendChild(el('strong', '', j.nombre + (j.id === vista.yo ? ' (tú)' : '')));
        li.appendChild(document.createTextNode(': ' + d.aciertos + ' aciertos, ' + d.fallos + ' fallos, vida ' + Math.ceil(d.pv)));
        ul.appendChild(li);
      });
      caja.appendChild(ul);
    }
    if (local.tarjeta) caja.appendChild(el('p', 'ayuda', 'Jugaste con una tarjeta de otro servidor: tus power ups no se gastaron.'));
    var rev = el('button', 'boton boton--principal duelo-grande', 'Revancha');
    rev.type = 'button';
    rev.addEventListener('click', function () { jugar({ tipo: 'revancha' }); });
    var sal = el('button', 'boton', 'Salir');
    sal.type = 'button';
    sal.addEventListener('click', salir);
    caja.appendChild(rev);
    caja.appendChild(sal);
    raiz.appendChild(caja);
    decir(gane ? '¡Ganaste!' : 'El duelo terminó.');
  }

  /* -------------------------------------------------------------- arranque */
  function cargarTests() {
    if (!window.RetoTestsBanco) return Promise.resolve();
    return window.RetoTestsBanco.cargar().then(function (lista) {
      local.tests = (lista || []).filter(function (t) { return preguntasDe(t).length > 0; });
    }).catch(function () { local.tests = []; });
  }

  function cargarTextosPU() {
    return fetch('/datos/powerups_textos.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (t) { local.textos = t; }).catch(function () {});
  }

  function cargarPerfil() {
    var perfilLocal = null;
    if (window.RetoPerfil && window.RetoPerfil.obtener) {
      perfilLocal = window.RetoPerfil.obtener().then(function (p) {
        if (p) local.perfilLocal = p;
      }).catch(function () {});
    }
    if (!window.RetoRpg) return Promise.resolve();
    var guardada = almacen('duelo_tarjeta', undefined, true);
    return Promise.all([
      perfilLocal || Promise.resolve(),
      window.RetoRpg.perfil(almacen('red_nombre') || 'Jugador')
    ]).then(function (r) {
      var p = r[1];
      local.perfil = p;
      if (guardada) return window.RetoRpg.leerTarjeta(guardada).then(function (t) { local.tarjeta = t; }).catch(function () { almacen('duelo_tarjeta', null, true); });
    }).catch(function () {});
  }

  function cargarEquipo() {
    if (!window.RetoRpg) return Promise.resolve();
    return Promise.all([window.RetoRpg.catalogo(), window.RetoRpg.equipo()]).then(function (r) {
      local.catalogo = r[0]; local.equipo = r[1];
      if (!local.textos) local.textos = r[0].textos;
    }).catch(function () {});
  }

  function iniciar() {
    raiz = document.getElementById('duelo');
    try {   // el interruptor de animaciones de la batalla es el mismo de la aventura
      document.documentElement.setAttribute('data-batalla-anim', window.localStorage.getItem('aventura_animaciones') === 'off' ? 'off' : 'on');
    } catch (e) { /* sin almacenamiento */ }
    vivoEl = document.getElementById('duelo-vivo');
    errorEl = document.getElementById('duelo-error');
    if (!raiz) return;
    document.addEventListener('keydown', teclas);
    window.setInterval(pintarCuenta, 250);
    Promise.all([cargarTests(), cargarTextosPU(), cargarEquipo(), cargarPerfil()]).then(function () {
      var guardada = null;
      try { guardada = JSON.parse(almacen('duelo_sesion', undefined, true) || 'null'); } catch (e) {}
      if (guardada && guardada.codigo && guardada.token) {
        sesion = guardada;
        empezarSondeo();
        preguntar();
        window.setTimeout(function () { if (!vista) salir(); }, 4000);
      } else {
        pantallaEntrada();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
