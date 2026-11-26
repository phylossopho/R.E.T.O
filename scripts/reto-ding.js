/* =========================================================================
   R.E.T.O. - Ding! (quiz bowl por wifi local) - pantalla
   -------------------------------------------------------------------------
   Esta pagina SOLO muestra y manda. Las reglas (quien contesto primero, los puntos, la respuesta correcta, las
   preguntas dinamicas, cuando se abren las opciones) viven en el servidor (logica/ding.py).

   DOS PANTALLAS EN UNA PAGINA
     - PRESENTADOR (computadora o laptop, proyectada): sube SU test y lo CONFIGURA antes de empezar (boton de
       configuracion > modal). Durante la partida muestra la pregunta a PANTALLA COMPLETA, con una animacion (maquina
       de escribir, letras que caen, giran o aparecen), y al cerrarse la pregunta, la respuesta correcta. No tiene
       botones de "siguiente" ni de "saltar": la siguiente pregunta carga sola (si no se apaga en la configuracion).
     - JUGADOR (2 a 4, desde su celular): NO ve la pregunta. Ve "mira la pantalla" y, cuando termina la animacion,
       las opciones de respuesta como botones grandes. El primero en elegir la correcta gana: ve «Ding!» (sin puntos).
       Quien falla no ve nada: se bloquean sus botones hasta la siguiente pregunta.

   NADIE SABE QUIEN VA GANANDO: ni el presentador ni los jugadores ven puntos ajenos ni quien acerto cada pregunta.
   Cada jugador ve solo sus propios puntos. Al terminar se dice quien gano (solo el nombre).

   COMO SE HABLAN: se manda con POST y se pregunta unas 3 veces por segundo. El servidor pone la hora de cada respuesta.

   ACCESIBILIDAD: botones de verdad, avisos en una region aria-live, nada parpadea, el color nunca es la unica señal
   (las opciones llevan letra), y las animaciones se apagan con el interruptor del sitio o prefers-reduced-motion.
   ========================================================================= */
(function () {
  'use strict';

  var API = '/api/ding';
  var SONDEO_MS = 350;

  var raiz, vivoEl, errorEl, dialogoConfig;
  var sesion = null;            // { codigo, token, rol }
  var vista = null;
  var firma = null;
  var sondeo = null;
  var enVuelo = false;
  var local = {
    tests: [], elegidos: {}, subiendo: false, aviso: '', ultimoAviso: '', foco: null,
    inicio: null, registrado: false, clave: null, enviado: false, cuenta: null, confirmaTerminar: false
  };

  var EFECTOS = [['maquina', 'Máquina de escribir'], ['caen', 'Letras que caen'], ['giran', 'Letras que giran'],
    ['aparecen', 'Letras que aparecen'], ['ninguno', 'Sin animación']];
  var VELOCIDADES = [['lenta', 'Lenta'], ['normal', 'Normal'], ['rapida', 'Rápida']];

  /* ------------------------------------------------------------ utilidades */
  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function vaciar(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function almacen(clave, valor, deSesion) {
    try {
      var s = deSesion ? window.sessionStorage : window.localStorage;
      if (valor === undefined) return s.getItem(clave);
      if (valor === null) s.removeItem(clave); else s.setItem(clave, valor);
    } catch (e) { /* sin almacenamiento */ }
    return null;
  }

  function decir(t) {
    if (!t || t === local.ultimoAviso) return;
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

  function boton(texto, clase, alClick, id) {
    var b = el('button', 'boton ' + (clase || ''), texto);
    b.type = 'button';
    if (id) b.id = id;
    b.addEventListener('click', alClick);
    return b;
  }

  function esPresentador() { return vista && vista.rol === 'presentador'; }

  function nombresGanadores(g) { return g.length > 1 ? 'Empate: ' + g.join(' y ') : '¡Ganó ' + g[0] + '!'; }

  /* ----------------------------------------------------- sondeo y estado */
  function guardarSesion() { almacen('ding_sesion', sesion ? JSON.stringify(sesion) : null, true); }

  function aplicar(v) {
    if (!v || v.cambio === false) return;
    var antes = vista;
    vista = v;
    firma = v.firma;
    // El presentador no vuelve a armar la pantalla (y reiniciar la animacion) por cambios que no le tocan.
    var clave = v.rol + '|' + v.fase + '|' + v.numero;
    var repintar = !(v.rol === 'presentador' && (v.fase === 'abierta' || v.fase === 'resuelta') && clave === local.clave);
    local.clave = clave;
    if (!antes || antes.fase !== v.fase || antes.numero !== v.numero) { local.enviado = false; local.confirmaTerminar = false; }
    if (repintar) render();
    anunciar(antes);
  }

  function preguntar() {
    if (!sesion || enVuelo) return;
    enVuelo = true;
    var q = '?token=' + encodeURIComponent(sesion.token) + (firma ? '&firma=' + encodeURIComponent(firma) : '');
    llamar('GET', '/' + sesion.codigo + '/estado' + q).then(function (v) {
      enVuelo = false; falla(''); aplicar(v);
    }, function (e) {
      enVuelo = false;
      if (e.http === 404 || e.http === 403) { salir(e.http === 404 ? 'La sala se cerró.' : ''); return; }
      falla(e.message);
    });
  }

  function empezarSondeo() {
    if (sondeo) window.clearInterval(sondeo);
    sondeo = window.setInterval(preguntar, SONDEO_MS);
  }

  function salir(mensaje) {
    if (sondeo) window.clearInterval(sondeo);
    sondeo = null; sesion = null; vista = null; firma = null; guardarSesion();
    try { sessionStorage.removeItem('ding_sala_codigo'); } catch (e) {}
    local.registrado = false; local.inicio = null; local.clave = null;
    document.body.classList.remove('ding-en-juego');
    pantallaEntrada(mensaje);
  }

  function mandar(accion) {
    accion.token = sesion.token;
    return llamar('POST', '/' + sesion.codigo + '/accion', accion).then(function (v) {
      falla(''); aplicar(v);
    }, function (e) { falla(e.message); });
  }

  /* Avisos para lectores de pantalla (la pregunta la lee quien presenta o la proyeccion). */
  function anunciar(antes) {
    if (!vista) return;
    if (vista.rol === 'jugador') {
      if (vista.fase === 'abierta' && !vista.mirar_pantalla && (!antes || antes.mirar_pantalla)) decir('Elige tu respuesta.');
      else if (vista.fase === 'resuelta' && vista.ding && (!antes || !antes.ding)) decir('¡Ding!');
    }
    if (vista.fase === 'fin' && (!antes || antes.fase !== 'fin')) decir(nombresGanadores(vista.final.ganadores));
  }

  /* ------------------------------------------------------------- entrada */
  function pantallaEntrada(mensaje) {
    vaciar(raiz);
    var caja = el('section', 'red-caja');
    caja.appendChild(el('h2', '', 'Ding!'));
    caja.appendChild(el('p', 'ayuda',
      'Un quiz bowl por wifi: una persona presenta la pregunta en una pantalla grande y de 2 a 4 compiten desde sus ' +
      'dispositivos. Gana el punto quien elige primero la respuesta correcta.'));
    if (mensaje) caja.appendChild(el('p', 'red-error', mensaje));

    var nombre = el('input', 'red-campo');
    nombre.type = 'text'; nombre.id = 'ding-nombre'; nombre.maxLength = 20;
    nombre.value = almacen('red_nombre') || '';
    var etN = el('label', '', 'Tu nombre'); etN.setAttribute('for', 'ding-nombre');
    caja.appendChild(etN); caja.appendChild(nombre);

    var pres = el('section', 'ding-opcion');
    pres.appendChild(el('h3', '', 'Voy a presentar'));
    pres.appendChild(el('p', 'ayuda', 'Desde una computadora o laptop: eliges y configuras tu test, la pregunta se ve en grande y los demás contestan con sus dispositivos.'));
    pres.appendChild(boton('Crear sala y presentar', 'boton--principal duelo-grande', function () {
      almacen('red_nombre', nombre.value.trim());
      llamar('POST', '/crear', { nombre: nombre.value }).then(function (d) {
        sesion = { codigo: d.codigo, token: d.token, rol: 'presentador' };
        entrar();
      }, function (e) { falla(e.message); });
    }));
    caja.appendChild(pres);

    var jug = el('section', 'ding-opcion');
    jug.appendChild(el('h3', '', 'Voy a jugar'));
    var cod = el('input', 'red-campo');
    cod.type = 'text'; cod.id = 'ding-codigo'; cod.maxLength = 4; cod.autocapitalize = 'characters'; cod.autocomplete = 'off';
    var etC = el('label', '', 'Código de la sala (4 letras)'); etC.setAttribute('for', 'ding-codigo');
    jug.appendChild(etC); jug.appendChild(cod);
    jug.appendChild(boton('Entrar a jugar', 'boton--principal duelo-grande', function () {
      almacen('red_nombre', nombre.value.trim());
      llamar('POST', '/unirse', { codigo: cod.value.trim().toUpperCase(), nombre: nombre.value }).then(function (d) {
        sesion = { codigo: d.codigo, token: d.token, rol: 'jugador' };
        entrar();
      }, function (e) { falla(e.message); });
    }));
    caja.appendChild(jug);
    raiz.appendChild(caja);
    falla('');
  }

  function entrar() {
    guardarSesion();
    try { sessionStorage.setItem('ding_sala_codigo', sesion.codigo); } catch (e) {}
    local.inicio = Date.now(); local.registrado = false;
    raiz.setAttribute('data-rol', sesion.rol);
    empezarSondeo();
    preguntar();
  }

  /* ---------------------------------------------------- el test del presentador */
  function temaTexto(t) {
    if (!t || typeof t !== 'object') return '';
    return [t.n2, t.n3, t.n4].filter(Boolean).join(' › ');
  }

  function contar(test) {
    var fijas = 0, dinamicas = 0;
    (test.preguntas || []).forEach(function (p) {
      if (p && p.tipo === 'estatica' && p.opciones && p.opciones.length >= 2 && p.correcta !== undefined && p.correcta !== null) fijas++;
      else if (p && p.tipo === 'dinamica' && p.formula) dinamicas++;
    });
    return { fijas: fijas, dinamicas: dinamicas };
  }

  /* Las preguntas de los tests elegidos, en el formato del servidor: las fijas con su correcta y las dinamicas como
     "receta" (el servidor las genera de nuevo cada vez). */
  function preguntasDeLosElegidos() {
    var out = [];
    local.tests.forEach(function (t) {
      if (!local.elegidos[t.id]) return;
      (t.preguntas || []).forEach(function (p) {
        var tema = temaTexto(p.tema) || (t.titulo || t.nombre || '');
        if (p.tipo === 'estatica' && p.opciones && p.opciones.length >= 2 && p.correcta !== undefined && p.correcta !== null) {
          out.push({ id: t.id + ':' + p.id, enunciado: p.enunciado, tema: tema, correcta: String(p.correcta),
            opciones: p.opciones.map(function (o) { return { id: String(o.id), texto: String(o.texto) }; }) });
        } else if (p.tipo === 'dinamica' && p.formula) {
          out.push({ id: t.id + ':' + p.id, tema: tema, dinamica: {
            enunciado: p.enunciado, variables: p.variables || [], formula: p.formula, decimales: p.decimales,
            distractores: p.distractores || [], opcionesAMostrar: p.opcionesAMostrar } });
        }
      });
    });
    return out;
  }

  function subirTest() {
    var pregs = preguntasDeLosElegidos();
    if (!pregs.length) { local.aviso = 'Elige al menos un test con preguntas.'; render(); return; }
    var titulos = local.tests.filter(function (t) { return local.elegidos[t.id]; })
      .map(function (t) { return t.titulo || t.nombre || 'Test'; }).join(' + ');
    local.subiendo = true; render();
    llamar('POST', '/' + sesion.codigo + '/test', { token: sesion.token, titulo: titulos, preguntas: pregs }).then(function (v) {
      local.subiendo = false; local.aviso = 'Test subido: ' + v.preguntas_en_test + ' preguntas.'; falla(''); aplicar(v);
    }, function (e) { local.subiendo = false; local.aviso = ''; falla(e.message); render(); });
  }

  function cambiarConfig(cambios) {
    return llamar('POST', '/' + sesion.codigo + '/configurar', { token: sesion.token, config: cambios }).then(function (v) {
      falla(''); aplicar(v); return v;
    }, function (e) { falla(e.message); });
  }

  /* ----------------------------------------------- configuracion (modal, antes de empezar) */
  function campoNumero(id, etiqueta, valor, min, max, alCambiar, ayuda) {
    var c = el('div', 'ding-campo');
    var lab = el('label', '', etiqueta); lab.setAttribute('for', id);
    var inp = document.createElement('input');
    inp.type = 'number'; inp.id = id; inp.min = String(min); inp.max = String(max); inp.value = String(valor); inp.inputMode = 'numeric';
    inp.addEventListener('change', function () {
      var n = Math.max(min, Math.min(max, parseInt(inp.value, 10) || min));
      inp.value = String(n);
      alCambiar(n);
    });
    c.appendChild(lab); c.appendChild(inp);
    if (ayuda) c.appendChild(el('p', 'ayuda', ayuda));
    return { caja: c, input: inp };
  }

  function campoSelect(id, etiqueta, opciones, valor, alCambiar) {
    var c = el('div', 'ding-campo');
    var lab = el('label', '', etiqueta); lab.setAttribute('for', id);
    var sel = document.createElement('select'); sel.id = id;
    opciones.forEach(function (o) { var op = el('option', '', o[1]); op.value = String(o[0]); sel.appendChild(op); });
    sel.value = String(valor);
    sel.addEventListener('change', function () { alCambiar(sel.value); });
    c.appendChild(lab); c.appendChild(sel);
    return c;
  }

  function campoCheck(id, etiqueta, valor, alCambiar) {
    var c = el('div', 'ding-interruptor');
    var lab = el('label', '');
    var chk = document.createElement('input');
    chk.type = 'checkbox'; chk.id = id; chk.checked = !!valor;
    chk.addEventListener('change', function () { alCambiar(chk.checked); });
    lab.appendChild(chk); lab.appendChild(document.createTextNode(' ' + etiqueta));
    c.appendChild(lab);
    return { caja: c, input: chk };
  }

  /* El modal se crea una sola vez (fuera de la pantalla que se vuelve a pintar) y se llena con lo que hay al abrirlo. */
  function abrirConfig() {
    if (!dialogoConfig) {
      dialogoConfig = document.createElement('dialog');
      dialogoConfig.className = 'dialogo ding-config';
      dialogoConfig.setAttribute('aria-labelledby', 'ding-config-titulo');
      document.body.appendChild(dialogoConfig);
    }
    var d = dialogoConfig, cfg = vista.config;
    vaciar(d);
    var cuerpo = el('div', 'ding-config-cuerpo');
    var t = el('h2', '', '⚙️ Configuración de la partida'); t.id = 'ding-config-titulo';
    cuerpo.appendChild(t);
    cuerpo.appendChild(el('p', 'ayuda', 'La configuración se hace antes de empezar: una vez que empieza la partida ya no se puede cambiar.'));

    var secP = el('fieldset', 'ding-grupo'); secP.appendChild(el('legend', '', 'Preguntas'));
    secP.appendChild(campoNumero('dc-num', 'Número de preguntas (0 = todas)', cfg.num_preguntas, 0, 60,
      function (n) { cambiarConfig({ num_preguntas: n }); }, 'Tu test tiene ' + vista.preguntas_en_test + ' preguntas; una pregunta dinámica cuenta tantas veces como salga.').caja);
    secP.appendChild(campoCheck('dc-mezclar', 'Mezclar el orden de las preguntas', cfg.mezclar, function (v) { cambiarConfig({ mezclar: v }); }).caja);
    secP.appendChild(campoSelect('dc-rep', 'Veces que sale cada pregunta dinámica',
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return [n, String(n)]; }), cfg.repeticiones_dinamicas,
      function (v) { cambiarConfig({ repeticiones_dinamicas: parseInt(v, 10) }); }));
    cuerpo.appendChild(secP);

    var secA = el('fieldset', 'ding-grupo'); secA.appendChild(el('legend', '', 'Cómo aparece la pregunta'));
    secA.appendChild(campoSelect('dc-efecto', 'Animación', EFECTOS, cfg.efecto, function (v) { cambiarConfig({ efecto: v }); }));
    secA.appendChild(campoSelect('dc-vel', 'Velocidad', VELOCIDADES, cfg.velocidad, function (v) { cambiarConfig({ velocidad: v }); }));
    secA.appendChild(el('p', 'ayuda', 'Las opciones aparecen en los celulares cuando termina de escribirse la pregunta. Con «Sin animación» aparecen al instante.'));
    cuerpo.appendChild(secA);

    var secS = el('fieldset', 'ding-grupo'); secS.appendChild(el('legend', '', 'Entre pregunta y pregunta'));
    var auto = campoCheck('dc-auto', 'Cargar sola la siguiente pregunta', cfg.auto_avance, function (v) { cambiarConfig({ auto_avance: v }); espera.input.disabled = !v; });
    var espera = campoNumero('dc-espera', 'Segundos de espera antes de cargarla', cfg.espera_s, 1, 30, function (n) { cambiarConfig({ espera_s: n }); },
      'Es el tiempo que se ve la respuesta correcta. Si lo apagas, tendrás un botón «Siguiente».');
    espera.input.disabled = !cfg.auto_avance;
    secS.appendChild(auto.caja); secS.appendChild(espera.caja);
    cuerpo.appendChild(secS);

    var secPt = el('fieldset', 'ding-grupo'); secPt.appendChild(el('legend', '', 'Puntos'));
    secPt.appendChild(campoNumero('dc-pa', 'Puntos por acertar', cfg.puntos_acierto, 1, 100, function (n) { cambiarConfig({ puntos_acierto: n }); }).caja);
    var restar = campoCheck('dc-restar', 'Restar puntos al fallar', cfg.restar_puntos, function (v) { cambiarConfig({ restar_puntos: v }); pf.input.disabled = !v; });
    var pf = campoNumero('dc-pf', 'Puntos que se restan', cfg.puntos_fallo, 1, 100, function (n) { cambiarConfig({ puntos_fallo: n }); },
      'Los puntos nunca bajan de 0. Quien falla se bloquea en esa pregunta, reste o no.');
    pf.input.disabled = !cfg.restar_puntos;
    secPt.appendChild(restar.caja); secPt.appendChild(pf.caja);
    cuerpo.appendChild(secPt);

    var secL = el('fieldset', 'ding-grupo'); secL.appendChild(el('legend', '', 'Tiempo para contestar'));
    var lim = campoCheck('dc-limite', 'Poner un límite de tiempo por pregunta', cfg.limite_activo, function (v) { cambiarConfig({ limite_activo: v }); ls.input.disabled = !v; });
    var ls = campoNumero('dc-ls', 'Segundos (desde que aparecen las opciones)', cfg.limite_s, 5, 120, function (n) { cambiarConfig({ limite_s: n }); },
      'Sin límite, la partida espera a que todos contesten, adivinen o fallen. Con límite, si nadie acierta a tiempo la pregunta queda nula.');
    ls.input.disabled = !cfg.limite_activo;
    secL.appendChild(lim.caja); secL.appendChild(ls.caja);
    cuerpo.appendChild(secL);
    d.appendChild(cuerpo);

    var listo = el('button', 'ding-fab', '');
    listo.type = 'button';
    listo.setAttribute('aria-label', 'Listo: cerrar la configuración');
    listo.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    listo.addEventListener('click', function () { d.close(); });
    d.appendChild(listo);
    if (!d.open) d.showModal();
  }

  /* ------------------------------------------------------------- presentador */
  function vistaPresentador() {
    vaciar(raiz);
    document.body.classList.toggle('ding-en-juego', vista.fase !== 'espera');
    if (vista.fase === 'espera') return presentadorEspera();
    if (vista.fase === 'fin') return presentadorFin();
    presentadorPantalla();
  }

  function presentadorEspera() {
    var caja = el('section', 'red-caja');
    caja.appendChild(el('h2', '', 'Sala de Ding!'));
    caja.appendChild(el('p', '', 'Los jugadores entran a esta misma página, eligen «Voy a jugar» y escriben el código:'));
    var codigo = el('p', 'ding-codigo', vista.codigo);
    codigo.setAttribute('aria-label', 'Código de la sala: ' + vista.codigo.split('').join(' '));
    caja.appendChild(codigo);
    caja.appendChild(el('p', 'red-estado', 'Jugadores (' + vista.jugadores.length + ' de ' + vista.maximo + '): ' +
      (vista.jugadores.length ? vista.jugadores.map(function (j) { return j.nombre + (j.conectado ? '' : ' (sin conexión)'); }).join(', ') : 'todavía nadie')));

    var tb = el('section', 'ding-opcion');
    tb.appendChild(el('h3', '', 'Tu test'));
    tb.appendChild(el('p', 'ayuda', 'Elige uno o más de tus tests. Los jugadores no lo conocen. Una pregunta dinámica sale varias veces, con números y respuestas distintos cada vez.'));
    if (!local.tests.length) tb.appendChild(el('p', '', 'No hay tests con preguntas en este dispositivo. Créalos o impórtalos en Test de conocimientos.'));
    local.tests.forEach(function (t) {
      var n = contar(t);
      var lab = el('label', 'ding-test');
      var chk = document.createElement('input');
      chk.type = 'checkbox'; chk.id = 'ding-t-' + t.id; chk.checked = !!local.elegidos[t.id];
      chk.addEventListener('change', function () { local.elegidos[t.id] = chk.checked; local.foco = chk.id; render(); });
      lab.appendChild(chk);
      lab.appendChild(document.createTextNode(' ' + (t.titulo || t.nombre || 'Test') + ' — ' + n.fijas + ' fijas, ' + n.dinamicas + ' dinámicas'));
      tb.appendChild(lab);
    });
    var hay = preguntasDeLosElegidos().length;
    var sub = boton(local.subiendo ? 'Subiendo…' : 'Usar estos tests', '', subirTest, 'ding-subir');
    sub.disabled = !hay || local.subiendo;
    tb.appendChild(sub);
    tb.appendChild(el('p', 'red-estado', vista.tiene_test ? 'Listo: «' + vista.titulo + '», ' + vista.preguntas_en_test + ' preguntas.' : 'Todavía no hay test.'));
    if (local.aviso) tb.appendChild(el('p', '', local.aviso));
    caja.appendChild(tb);

    caja.appendChild(boton('⚙️ Configuración', '', abrirConfig, 'ding-config-boton'));

    var puedo = vista.jugadores.length >= vista.minimo && vista.tiene_test;
    var ini = boton('¡Empezar!', 'boton--principal duelo-grande', function () { mandar({ tipo: 'empezar' }); }, 'ding-empezar');
    ini.disabled = !puedo;
    caja.appendChild(ini);
    if (!puedo) caja.appendChild(el('p', 'ayuda', 'Para empezar hacen falta ' + vista.minimo + ' a ' + vista.maximo + ' jugadores y un test. Revisa la configuración antes: ya no se podrá cambiar.'));
    caja.appendChild(boton('Cerrar la sala', '', function () {
      llamar('POST', '/' + sesion.codigo + '/cerrar', { token: sesion.token }).then(function () { salir(); }, function (e) { falla(e.message); });
    }));
    raiz.appendChild(caja);
  }

  /* El texto de la pregunta, letra por letra (cada letra con su retraso) para la animacion. Los espacios separan palabras
     que no se parten. `transcurrido` ya paso desde que aparecio la pregunta: la animacion sigue desde ahi. */
  function construirTexto(destino, texto, efecto, cps, transcurrido) {
    var paso = 1000 / (cps || 30), i = 0;
    texto.split(/(\s+)/).forEach(function (trozo) {
      if (!trozo) return;
      if (/^\s+$/.test(trozo)) { destino.appendChild(document.createTextNode(' ')); return; }
      var pal = el('span', 'ding-palabra');
      Array.prototype.forEach.call(trozo, function (ch) {
        var l = el('span', 'ding-letra', ch);
        if (efecto && efecto !== 'ninguno') {
          l.classList.add('ding-ef-' + efecto);
          l.style.animationDelay = Math.round(i * paso - (transcurrido || 0)) + 'ms';
        }
        i++;
        pal.appendChild(l);
      });
      destino.appendChild(pal);
    });
  }

  /* El texto ocupa TODA la caja: se busca el tamaño de letra mas grande que cabe (con todas las letras ya puestas, asi
     no se mueve nada mientras se anima). */
  function ajustarTexto(caja, texto) {
    var lo = 14, hi = 600;
    function cabe() { return texto.scrollHeight <= caja.clientHeight + 1 && texto.scrollWidth <= caja.clientWidth + 1; }
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      texto.style.fontSize = mid + 'px';
      if (cabe()) lo = mid; else hi = mid;
    }
    texto.style.fontSize = lo + 'px';
  }

  function presentadorPantalla() {
    var v = vista;
    var pant = el('section', 'ding-pantalla');
    var cajaP = el('div', 'ding-pregunta-caja');
    cajaP.setAttribute('aria-live', 'off');
    var texto = el('div', 'ding-pregunta-texto');
    cajaP.appendChild(texto);
    if (v.fase === 'abierta') construirTexto(texto, v.enunciado, v.efecto, v.cps, v.transcurrido_ms);
    else texto.textContent = v.enunciado;
    pant.appendChild(cajaP);

    if (v.fase === 'resuelta') {
      var r = v.revelada;
      var ul = el('ul', 'ding-opciones-reveladas');
      r.opciones.forEach(function (o, i) {
        var ok = o.id === r.correcta;
        ul.appendChild(el('li', ok ? 'ding-correcta' : '', String.fromCharCode(65 + i) + '. ' + o.texto + (ok ? '  ✓' : '')));
      });
      pant.appendChild(ul);
      if (r.explicacion) {
        var ex = el('div', 'ding-explicacion');
        ex.appendChild(el('p', '', r.explicacion.formula));
        ex.appendChild(el('p', '', r.explicacion.sustitucion + ' = ' + r.explicacion.resultado));
        pant.appendChild(ex);
      }
      var pie = el('p', 'ding-siguiente', '');
      if (r.auto) {
        var hasta = Date.now() + r.espera_s * 1000;
        function cuenta() {
          var s = Math.max(0, Math.ceil((hasta - Date.now()) / 1000));
          pie.textContent = (r.ultima ? 'Resultados' : 'Siguiente pregunta') + ' en ' + s + ' s';
          if (!s) return;
        }
        cuenta();
        if (local.cuenta) window.clearInterval(local.cuenta);
        local.cuenta = window.setInterval(function () { if (!pie.isConnected) { window.clearInterval(local.cuenta); return; } cuenta(); }, 250);
      } else {
        pie = boton(r.ultima ? 'Ver resultados' : 'Siguiente pregunta', 'boton--principal duelo-grande', function () { mandar({ tipo: 'siguiente' }); }, 'ding-siguiente');
      }
      pant.appendChild(pie);
    }

    // Lo unico que hay para el presentador, discreto: terminar la partida (con confirmacion). No hay "siguiente" ni "saltar".
    var fin = boton(local.confirmaTerminar ? '¿Seguro? Terminar' : 'Terminar partida', 'ding-terminar', function () {
      if (!local.confirmaTerminar) {
        local.confirmaTerminar = true; render();
        window.setTimeout(function () { local.confirmaTerminar = false; if (vista && vista.fase !== 'fin') render(); }, 4000);
        return;
      }
      mandar({ tipo: 'terminar' });
    });
    var base = el('div', 'ding-base');
    base.appendChild(el('span', 'ding-progreso', v.numero + ' / ' + v.total));
    base.appendChild(fin);
    pant.appendChild(base);
    raiz.appendChild(pant);

    var ajustar = function () { ajustarTexto(cajaP, texto); };
    window.requestAnimationFrame(ajustar);
    if (!local.alRedimensionar) {
      local.alRedimensionar = function () {
        var c = document.querySelector('.ding-pregunta-caja'), t = document.querySelector('.ding-pregunta-texto');
        if (c && t) ajustarTexto(c, t);
      };
      window.addEventListener('resize', local.alRedimensionar);
    }
  }

  function presentadorFin() {
    var f = vista.final;
    var caja = el('section', 'red-caja ding-escena');
    caja.appendChild(el('h2', 'ding-ganador', nombresGanadores(f.ganadores)));
    caja.appendChild(el('p', '', f.preguntas + ' preguntas · ' + f.minutos + ' min'));
    caja.appendChild(boton('Cerrar la sala', 'boton--principal duelo-grande', function () {
      llamar('POST', '/' + sesion.codigo + '/cerrar', { token: sesion.token }).then(function () { salir(); }, function () { salir(); });
    }));
    raiz.appendChild(caja);
  }

  /* --------------------------------------------------------------- jugador */
  function vistaJugador() {
    vaciar(raiz);
    document.body.classList.remove('ding-en-juego');
    var f = vista.fase;
    var caja = el('section', 'red-caja ding-celu');
    if (f === 'espera') {
      caja.appendChild(el('h2', '', 'Sala ' + vista.codigo));
      caja.appendChild(el('p', 'red-estado', 'Esperando a que quien presenta empiece la partida…'));
      caja.appendChild(el('p', '', 'Jugadores: ' + vista.jugadores.map(function (j) { return j.nombre; }).join(', ')));
      caja.appendChild(boton('Salir', '', function () { salir(); }));
    } else if (f === 'fin') {
      return jugadorFin(caja);
    } else {
      document.body.classList.add('ding-en-juego');
      // Los puntos propios se ven con cada pregunta nueva; en la pantalla de «Ding!» no, para no decir cuantos se ganaron.
      if (f === 'abierta') caja.appendChild(el('p', 'ding-mis-puntos', 'Tus puntos: ' + vista.mis_puntos));
      if (f === 'abierta') jugadorOpciones(caja);
      else if (f === 'resuelta') jugadorResuelta(caja);
    }
    raiz.appendChild(caja);
  }

  function jugadorOpciones(caja) {
    if (vista.mirar_pantalla) {
      caja.appendChild(el('p', 'ding-mira', '👀 Mira la pantalla'));
      return;
    }
    var rej = el('div', 'ding-opciones-celu');
    rej.setAttribute('role', 'group');
    rej.setAttribute('aria-label', 'Respuestas');
    var bloqueado = vista.bloqueado || local.enviado;      // quien ya contesto (bien o mal) no vuelve a contestar
    vista.opciones.forEach(function (o, i) {
      var b = el('button', 'ding-op');
      b.type = 'button';
      b.appendChild(el('span', 'ding-op-letra', String.fromCharCode(65 + i)));
      b.appendChild(el('span', 'ding-op-texto', o.texto));
      b.disabled = bloqueado;
      b.addEventListener('click', function () { responder(o.id); });
      rej.appendChild(b);
    });
    caja.appendChild(rej);
  }

  function responder(id) {
    if (local.enviado) return;
    local.enviado = true;                                   // se bloquea al instante, antes de que conteste el servidor
    var botones = raiz.querySelectorAll('.ding-op');
    for (var i = 0; i < botones.length; i++) botones[i].disabled = true;
    mandar({ tipo: 'responder', opcion: id });
  }

  /* Quien acerto ve «Ding!» (en verde y negritas, con una animacion divertida), sin decir cuantos puntos gano. Los demas
     no ven nada especial: una pantalla tranquila hasta la siguiente pregunta. */
  function jugadorResuelta(caja) {
    if (vista.ding) {
      var d = el('div', 'ding-gana');
      d.setAttribute('role', 'status');
      Array.prototype.forEach.call('Ding!', function (ch, i) {
        var l = el('span', '', ch);
        l.style.setProperty('--i', String(i));
        d.appendChild(l);
      });
      caja.appendChild(d);
    } else {
      caja.appendChild(el('p', 'ding-mira', '…'));
    }
  }

  function jugadorFin(caja) {
    var f = vista.final;
    caja.appendChild(el('h2', 'ding-ganador', nombresGanadores(f.ganadores)));
    caja.appendChild(el('p', '', 'Tus puntos: ' + vista.mis.puntos));
    registrarSesion();
    caja.appendChild(boton('Salir', 'boton--principal duelo-grande', function () { salir(); }));
    raiz.appendChild(caja);
  }

  /* Ding! suma al nivel de practica como el duelo (y no da power ups). Una sola vez. */
  function registrarSesion() {
    if (local.registrado || !window.RetoProgreso || !vista.mis) return;
    local.registrado = true;
    window.RetoProgreso.registrarSesion({ tipo: 'rpg', ejercicio: 'ding',
      minutos: (Date.now() - (local.inicio || Date.now())) / 60000, rondas: 1, preguntas: vista.mis.aciertos + vista.mis.fallos });
  }

  /* ----------------------------------------------------------------- render */
  function render() {
    if (!vista) return;
    if (local.cuenta) { window.clearInterval(local.cuenta); local.cuenta = null; }
    if (esPresentador()) vistaPresentador(); else vistaJugador();
    if (local.foco) {
      var x = document.getElementById(local.foco);
      if (x) x.focus();
      local.foco = null;
    }
  }

  /* Las opciones tambien con el teclado (1 a 6) en un dispositivo con teclado. */
  function teclas(e) {
    if (!vista || esPresentador() || vista.fase !== 'abierta' || vista.mirar_pantalla || vista.bloqueado || local.enviado) return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && vista.opciones && n <= vista.opciones.length) { e.preventDefault(); responder(vista.opciones[n - 1].id); }
  }

  /* -------------------------------------------------------------- arranque */
  function cargarTests() {
    if (!window.RetoTestsBanco) return Promise.resolve();
    return window.RetoTestsBanco.cargar().then(function (lista) {
      local.tests = (lista || []).filter(function (t) { var n = contar(t); return n.fijas + n.dinamicas > 0; });
    }).catch(function () { local.tests = []; });
  }

  function iniciar() {
    raiz = document.getElementById('ding');
    vivoEl = document.getElementById('ding-vivo');
    errorEl = document.getElementById('ding-error');
    if (!raiz) return;
    document.addEventListener('keydown', teclas);
    cargarTests().then(function () {
      var guardada = null;
      try { guardada = JSON.parse(almacen('ding_sesion', undefined, true) || 'null'); } catch (e) { /* sin sesion */ }
      if (guardada && guardada.codigo && guardada.token) {
        sesion = guardada;
        raiz.setAttribute('data-rol', sesion.rol);
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
