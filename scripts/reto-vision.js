/* =========================================================================
   R.E.T.O. - El motor comun de los ejercicios para la vision
   -------------------------------------------------------------------------
   Cada ejercicio es una pagina (categorias/vision/<ejercicio>/<ejercicio>.html)
   con un <body data-ejercicio="..."> y su propio script (reto-vision-<x>.js)
   que se anota aqui con RetoVision.registrar(id, definicion). Este archivo pone
   LO QUE TIENEN EN COMUN:

     - la pantalla de entrada: el aviso (no es tratamiento medico), y que mirar,
       que hacer y cuanto dura, ANTES de empezar;
     - el bucle de animacion (requestAnimationFrame con tiempo delta: igual de
       rapido a 60 Hz que a 144 Hz), la pausa, y la pausa AUTOMATICA si la
       pestana pierde el foco;
     - la unidad "u" = min(ancho, alto) / 100 del marco, recalculada con un
       ResizeObserver: nada se mide en pixeles fijos;
     - los ajustes comunes (velocidad, duracion, tamano, sonido, movimiento,
       tiempo y puntos visibles) en un modal propio, y los de cada ejercicio;
     - el final de cada sesion ("terminaste, descansa 20 segundos") y el progreso
       (RetoProgreso: { tipo: 'vision', ejercicio, minutos }, minimo 1 minuto).

   LA DEFINICION DE UN EJERCICIO
     titulo, intro: { mirar, hacer, dura(ajustes) }, rapido (true si hay
     estimulos rapidos: se avisa antes), sensible (true si usa luz: ofrece el
     ajuste de sensibilidad), ajustes: [ { clave, tipo: 'select'|'check',
     etiqueta, opciones, ayuda, defecto } ],
     crear(ctx) -> { montar(escena), actualizar(dt, t), recalcular(), pausar(),
     reanudar(), alAjustar(clave), resumen(), limpiar() }  (todo opcional salvo montar)

   QUE SE GARANTIZA (WCAG 2.2)
     - 2.2.2: la pausa esta siempre en el panel, y con la barra espaciadora
       (se puede apagar en los ajustes: 2.1.4).
     - 2.2.1: la velocidad es un ajuste; nada castiga por ir lento.
     - 2.3.1 / 2.3.3: nada parpadea; con movimiento reducido cada ejercicio
       cambia a su version por pasos. Nunca se fuerza el movimiento continuo.
     - 4.1.3: los avisos de estado van en una region aria-live="polite".
     - 2.4.3: al cerrar el modal, el foco vuelve al boton que lo abrio.
   ========================================================================= */
(function (window) {
  'use strict';

  var document = window.document;
  var V = window.RetoVision = window.RetoVision || { defs: {} };
  V.registrar = function (id, def) { V.defs[id] = def; };

  var AVISO_MEDICO = 'Son ejercicios de práctica y descanso visual, no un tratamiento médico. ' +
    'Si sientes mareo, dolor de cabeza, dolor en los ojos o molestias que no se van, ' +
    'para y consulta a un optometrista u oftalmólogo. Haz sesiones cortas, con descanso.';
  V.AVISO_MEDICO = AVISO_MEDICO;

  var NOMBRES_NIVEL = { 1: 'Muy lenta', 2: 'Lenta', 3: 'Normal', 4: 'Rápida', 5: 'Muy rápida' };
  var FACTOR_TAMANO = { 1: 1, 2: 1.4, 3: 1.9 };
  var DESCANSO_SEG = 20;
  var MINUTOS_MINIMOS = 1;

  var COMUNES = {
    nivel: 2, duracion: 2, tam: 2, letra: 1, sonido: false, mostrar: false,
    movimiento: 'sistema', atajos: true, sensible: false
  };

  // Estado offline
  var modoOffline = false;
  function actualizarModoOffline() {
    var offline = false;   // las reglas corren en la propia página: funciona también sin internet
    if (offline !== modoOffline) {
      modoOffline = offline;
      document.documentElement.setAttribute('data-modo-offline', modoOffline ? '1' : '0');
    }
    ctx.offline = modoOffline;
    return modoOffline;
  }

  var id, def, ajustes, marco, escena, estadoEl, instancia, plan;
  var estado = 'intro';         // intro | corre | pausa | fin
  var raf = null, ultimoT = null, transcurrido = 0;
  var sesionMs = 0;
  var contado = 0;              // segundos de esta sesion ya sumados al progreso
  var ro = null, unidad = 1;
  var dlg = null, abridor = null, estabaCorriendo = false;
  var campos = {};

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function vaciar(nodo) { while (nodo.firstChild) nodo.removeChild(nodo.firstChild); }

  /* ------------------------------------------------------------ utilidades */
  function reducidoDelSistema() {
    var a = document.documentElement.getAttribute('data-anim');
    if (a === 'off') return true;
    if (a === 'on') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function pedir(ruta, cuerpo) {
    // MODO OFFLINE: ajustar localmente
    if (modoOffline && ruta === 'ajustar' && window.RetoVision) {
      return Promise.resolve(window.RetoVision.ajustarPara(cuerpo.ejercicio, cuerpo));
    }

    // MODO ONLINE
    return fetch('/api/vision/' + ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error((d && d.error) || 'No se pudo preparar el ejercicio.');
        return d;
      });
    }).catch(function (e) {
      if (e instanceof TypeError) throw new Error('No se pudo preparar el ejercicio. Recarga la página.');
      throw e;
    });
  }

  function anunciar(texto) {
    if (!estadoEl) return;
    estadoEl.textContent = '';
    window.setTimeout(function () { estadoEl.textContent = texto; }, 30);
  }

  /* ---------------------------------------------------------------- ajustes */
  function claveDatos() { return 'vision-ajustes-' + id; }

  function valoresPorDefecto() {
    var a = {};
    Object.keys(COMUNES).forEach(function (k) { a[k] = COMUNES[k]; });
    (def.ajustes || []).forEach(function (c) { a[c.clave] = c.defecto; });
    if (def.defectos) Object.keys(def.defectos).forEach(function (k) { a[k] = def.defectos[k]; });
    return a;
  }

  function cargarAjustes() {
    var a = valoresPorDefecto();
    if (!window.RetoDatos) return Promise.resolve(a);
    return window.RetoDatos.obtener(claveDatos()).then(function (g) {
      if (g && typeof g === 'object') {
        Object.keys(a).forEach(function (k) {
          if (g[k] !== undefined && typeof g[k] === typeof a[k]) a[k] = g[k];
        });
      }
      return a;
    }).catch(function () { return a; });
  }

  function guardarAjustes() {
    if (window.RetoDatos) window.RetoDatos.poner(claveDatos(), ajustes).catch(function () {});
  }

  function poner(clave, valor) {
    ajustes[clave] = valor;
    guardarAjustes();
    if (clave === 'letra' || clave === 'tam') aplicarVariables();
    if (instancia && instancia.alAjustar) instancia.alAjustar(clave);
    pintarNivel();
  }

  /* --------------------------------------------------- unidad y variables */
  function medir() {
    if (!marco) return;
    var r = marco.getBoundingClientRect();
    unidad = Math.max(1, Math.min(r.width, r.height) / 100);
    aplicarVariables();
    if (instancia && instancia.recalcular) instancia.recalcular();
  }

  function aplicarVariables() {
    if (!marco) return;
    marco.style.setProperty('--u', unidad + 'px');
    // El objetivo mide como minimo 6u (WCAG: se ve en cualquier pantalla).
    marco.style.setProperty('--objetivo', (6 * unidad * FACTOR_TAMANO[ajustes.tam || 2]) + 'px');
    marco.style.setProperty('--letra-vision', String([1, 1.3, 1.7][(ajustes.letra || 1) - 1]));
  }

  /* ------------------------------------------------------------- contexto */
  var ctx = {
    get ajustes() { return ajustes; },
    get marco() { return marco; },
    get escena() { return escena; },
    u: function () { return unidad; },
    ancho: function () { return marco.clientWidth; },
    alto: function () { return marco.clientHeight; },
    reducido: function () { return ajustes.movimiento === 'pasos' || reducidoDelSistema(); },
    objetivo: function () { return 6 * unidad * FACTOR_TAMANO[ajustes.tam || 2]; },
    anunciar: anunciar,
    el: el,
    vaciar: vaciar,
    plan: function (ejercicio, params) {
      var cuerpo = { ejercicio: ejercicio };
      Object.keys(params || {}).forEach(function (k) { cuerpo[k] = params[k]; });

      // MODO OFFLINE: usar RetoVision.planPara local
      if (ctx.offline && window.RetoVision) {
        return Promise.resolve(window.RetoVision.planPara(ejercicio, cuerpo));
      }

      // MODO ONLINE
      return pedir('plan', cuerpo);
    },
    ajustar: function (ejercicio, params) {
      var cuerpo = { ejercicio: ejercicio };
      Object.keys(params || {}).forEach(function (k) { cuerpo[k] = params[k]; });
      return pedir('ajustar', cuerpo);
    },
    /* El ejercicio avisa que se acabo por si solo (sin esperar el reloj). */
    terminar: function () { terminar(); },
    tiempo: function () { return transcurrido; },
    /* Para quien guarda mejores marcas: RetoDatos (entran en el respaldo). */
    guardarDato: function (clave, valor) {
      return window.RetoDatos ? window.RetoDatos.poner('vision-' + id + '-' + clave, valor) : Promise.resolve();
    },
    leerDato: function (clave) {
      return window.RetoDatos ? window.RetoDatos.obtener('vision-' + id + '-' + clave) : Promise.resolve(null);
    }
  };

  /* ---------------------------------------------------------------- pantallas */
  function limpiarEscena() {
    if (instancia && instancia.limpiar) instancia.limpiar();
    instancia = null;
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    vaciar(marco);
    marco.appendChild(estadoEl);
    escena = null;
  }

  function mostrarIntro() {
    limpiarEscena();
    estado = 'intro';
    ponerBotonJugar();
    var caja = el('div', 'vision-pantalla');
    caja.appendChild(el('h2', 'vision-titulo', def.titulo));
    var aviso = el('p', 'vision-aviso-medico', AVISO_MEDICO);
    aviso.setAttribute('role', 'note');
    caja.appendChild(aviso);
    var lista = el('dl', 'vision-instrucciones');
    function fila(t, d) { lista.appendChild(el('dt', '', t)); lista.appendChild(el('dd', '', d)); }
    fila('Qué mirar', def.intro.mirar);
    fila('Qué hacer', def.intro.hacer);
    fila('Cuánto dura', def.intro.dura(ajustes));
    caja.appendChild(lista);
    if (def.rapido) {
      var r = el('p', 'vision-aviso-rapido',
        'Aviso: este ejercicio muestra imágenes rápidas. Nada parpadea ni alterna con blanco, ' +
        'pero si sientes molestia, párate. Puedes alargar el tiempo en los ajustes.');
      r.setAttribute('role', 'note');
      caja.appendChild(r);
    }
    var acciones = el('div', 'vision-acciones');
    var empezarBtn = el('button', 'boton boton--principal vision-grande', 'Empezar');
    empezarBtn.type = 'button';
    empezarBtn.addEventListener('click', empezar);
    var ajustesBtn = el('button', 'boton', 'Ajustes');
    ajustesBtn.type = 'button';
    ajustesBtn.addEventListener('click', function () { abrirAjustes(ajustesBtn); });
    acciones.appendChild(empezarBtn);
    acciones.appendChild(ajustesBtn);
    caja.appendChild(acciones);
    marco.appendChild(caja);
    empezarBtn.focus({ preventScroll: true });
  }

  function empezar() {
    limpiarEscena();
    estado = 'corre';
    transcurrido = 0;
    contado = 0;
    ultimoT = null;
    escena = el('div', 'vision-escena');
    marco.appendChild(escena);
    medir();
    instancia = def.crear(ctx);
    var listo = instancia.montar ? instancia.montar(escena) : null;
    ponerBotonJugar();
    anunciar('Ejercicio iniciado');
    Promise.resolve(listo).then(function () {
      if (estado === 'corre') arrancarReloj();
    }).catch(function (e) {
      anunciar((e && e.message) || 'No se pudo empezar.');
      escena.appendChild(el('p', 'vision-error', (e && e.message) || 'No se pudo empezar.'));
      estado = 'pausa';
      ponerBotonJugar();
    });
  }

  function arrancarReloj() {
    if (raf !== null) return;
    ultimoT = null;
    raf = requestAnimationFrame(cuadro);
  }

  function cuadro(t) {
    raf = null;
    if (estado !== 'corre') return;
    var dt = ultimoT === null ? 0 : Math.min((t - ultimoT) / 1000, 0.1);
    ultimoT = t;
    transcurrido += dt;
    if (instancia && instancia.actualizar) instancia.actualizar(dt, transcurrido);
    if (estado !== 'corre') return;
    if (transcurrido >= ajustes.duracion * 60) { terminar(); return; }
    raf = requestAnimationFrame(cuadro);
  }

  function pausar(motivo) {
    if (estado !== 'corre') return;
    estado = 'pausa';
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    if (instancia && instancia.pausar) instancia.pausar();
    ponerBotonJugar();
    anunciar(motivo || 'Pausa');
  }

  function reanudar() {
    if (estado !== 'pausa') return;
    estado = 'corre';
    if (instancia && instancia.reanudar) instancia.reanudar();
    ponerBotonJugar();
    anunciar('Ejercicio reanudado');
    arrancarReloj();
  }

  function alternar() {
    if (estado === 'intro') empezar();
    else if (estado === 'corre') pausar();
    else if (estado === 'pausa') reanudar();
    else if (estado === 'fin') empezar();
  }

  /* ------------------------------------------------------------------ final */
  function volcarSesion() {
    var minutos = sesionMs / 60000;
    if (minutos < MINUTOS_MINIMOS || !window.RetoProgreso) return;
    sesionMs = 0;
    try {
      window.RetoProgreso.registrarSesion({ tipo: 'vision', ejercicio: id, minutos: minutos });
    } catch (e) {}
  }

  function terminar() {
    if (estado === 'fin') return;
    var resumen = instancia && instancia.resumen ? instancia.resumen() : [];
    sesionMs += (transcurrido - contado) * 1000;
    contado = transcurrido;
    volcarSesion();
    estado = 'fin';
    limpiarEscena();
    ponerBotonJugar();
    var caja = el('div', 'vision-pantalla');
    caja.appendChild(el('h2', 'vision-titulo', 'Terminaste'));
    if (resumen && resumen.length) {
      var ul = el('ul', 'vision-resumen');
      resumen.forEach(function (t) { ul.appendChild(el('li', '', t)); });
      caja.appendChild(ul);
    }
    caja.appendChild(el('p', 'vision-descanso-texto',
      'Descansa unos segundos: mira algo lejano, a unos 6 metros, durante ' + DESCANSO_SEG + ' segundos.'));
    var contador = el('p', 'vision-contador', '');
    contador.setAttribute('aria-hidden', 'true');
    caja.appendChild(contador);
    var acciones = el('div', 'vision-acciones');
    var otra = el('button', 'boton boton--principal vision-grande', 'Otra vez');
    otra.type = 'button';
    otra.addEventListener('click', function () { cancelarDescanso(); empezar(); });
    var volver = el('a', 'boton', 'Volver a Visión');
    volver.href = '../vision.html';
    acciones.appendChild(otra);
    acciones.appendChild(volver);
    caja.appendChild(acciones);
    marco.appendChild(caja);
    otra.focus({ preventScroll: true });
    anunciar('Terminaste. Descansa ' + DESCANSO_SEG + ' segundos.');
    iniciarDescanso(contador);
  }

  var descansoId = null;
  function iniciarDescanso(contador) {
    cancelarDescanso();
    var restante = DESCANSO_SEG;
    function pintar() { contador.textContent = restante + ' s'; }
    pintar();
    descansoId = window.setInterval(function () {
      restante -= 1;
      if (restante <= 0) {
        cancelarDescanso();
        contador.textContent = '';
        anunciar('Descanso terminado.');
        return;
      }
      pintar();
      // Solo se anuncia cada 5 s: cada segundo seria ruido (4.1.3).
      if (restante % 5 === 0) anunciar('Quedan ' + restante + ' segundos de descanso.');
    }, 1000);
  }

  function cancelarDescanso() {
    if (descansoId !== null) { window.clearInterval(descansoId); descansoId = null; }
  }

  /* ------------------------------------------------------------- el panel */
  function ponerBotonJugar() {
    var b = document.querySelector('[data-vis-jugar]');
    if (!b) return;
    var corre = estado === 'corre';
    var etiqueta = corre ? 'Pausar' : (estado === 'pausa' ? 'Seguir' : 'Empezar');
    b.setAttribute('aria-label', etiqueta);
    b.setAttribute('title', etiqueta + ' (barra espaciadora)');
    b.setAttribute('data-estado', corre ? 'corre' : 'parado');
    var play = b.querySelector('[data-dibujo="play"]');
    var pausa = b.querySelector('[data-dibujo="pausa"]');
    if (play) play.hidden = corre;
    if (pausa) pausa.hidden = !corre;
  }

  function pintarNivel() {
    var o = document.querySelector('[data-vis-nivel]');
    if (o) o.textContent = NOMBRES_NIVEL[ajustes.nivel] || String(ajustes.nivel);
  }

  function cambiarNivel(delta) {
    var n = Math.max(1, Math.min(5, (ajustes.nivel || 2) + delta));
    if (n === ajustes.nivel) { anunciar('Ya está en ' + NOMBRES_NIVEL[n].toLowerCase() + '.'); return; }
    poner('nivel', n);
    anunciar('Velocidad: ' + NOMBRES_NIVEL[n].toLowerCase());
  }

  /* ---------------------------------------------------------- el modal */
  function armarAjustes() {
    var R = window.RetoLecturaMotores;
    var m = R.dialogo('vision-ajustes', 'Ajustes: ' + def.titulo);
    dlg = m.dlg;
    var c = m.cuerpo;
    campos = {};
    function num(clave) { return function (v) { poner(clave, parseInt(v, 10)); }; }
    campos.nivel = R.campoSelect(c, 'vis-nivel', 'Velocidad',
      [[1, 'Muy lenta'], [2, 'Lenta (por defecto)'], [3, 'Normal'], [4, 'Rápida'], [5, 'Muy rápida']],
      'Empieza lenta. Nada castiga por ir despacio.', num('nivel'));
    campos.duracion = R.campoSelect(c, 'vis-duracion', 'Duración de la sesión',
      [[1, '1 minuto'], [2, '2 minutos (por defecto)'], [3, '3 minutos'], [5, '5 minutos']],
      'Sesiones cortas y con descanso.', num('duracion'));
    campos.tam = R.campoSelect(c, 'vis-tam', 'Tamaño del objetivo',
      [[1, 'Normal'], [2, 'Grande'], [3, 'Muy grande']], null, num('tam'));
    campos.letra = R.campoSelect(c, 'vis-letra', 'Tamaño de la letra',
      [[1, 'Normal'], [2, 'Grande'], [3, 'Muy grande']], null, num('letra'));
    (def.ajustes || []).forEach(function (a) {
      if (a.tipo === 'check') {
        campos[a.clave] = R.campoCasilla(c, 'vis-' + a.clave, a.etiqueta, a.ayuda,
          function (v) { poner(a.clave, v); });
      } else {
        var porDefecto = typeof a.defecto === 'number';
        campos[a.clave] = R.campoSelect(c, 'vis-' + a.clave, a.etiqueta, a.opciones, a.ayuda,
          function (v) { poner(a.clave, porDefecto ? parseInt(v, 10) : v); });
      }
    });
    if (def.sensible) {
      campos.sensible = R.campoCasilla(c, 'vis-sensible', 'Soy sensible a la luz',
        'Los estímulos se ven más tiempo (mínimo 800 ms) y los cambios son más suaves.',
        function (v) { poner('sensible', v); });
    }
    campos.movimiento = R.campoSelect(c, 'vis-movimiento', 'Movimiento',
      [['sistema', 'Seguir lo que pide mi sistema'], ['pasos', 'Por pasos: el objetivo salta, sin movimiento continuo']],
      'Con "movimiento reducido" activado en tu sistema se usa siempre la versión por pasos.',
      function (v) { poner('movimiento', v); });
    campos.mostrar = R.campoCasilla(c, 'vis-mostrar', 'Mostrar tiempo y puntos',
      'Apagado por defecto: si te pone nervioso medirte, no lo ves.', function (v) { poner('mostrar', v); });
    campos.sonido = R.campoCasilla(c, 'vis-sonido', 'Sonido',
      'Señales suaves, siempre con su equivalente visual. Apagado por defecto.', function (v) { poner('sonido', v); });
    campos.atajos = R.campoCasilla(c, 'vis-atajos', 'Atajos de teclado (barra espaciadora, + y -)',
      'Si los apagas, solo se maneja con los botones.', function (v) { poner('atajos', v); });

    dlg.addEventListener('close', function () {
      if (abridor && abridor.focus) abridor.focus();
      abridor = null;
      if (estabaCorriendo) { estabaCorriendo = false; reanudar(); }
    });
  }

  function sincronizarAjustes() {
    Object.keys(campos).forEach(function (k) {
      var c = campos[k];
      if (!c) return;
      if (c.type === 'checkbox') c.checked = !!ajustes[k];
      else if (c.value !== undefined) c.value = String(ajustes[k]);
    });
  }

  function abrirAjustes(boton) {
    if (!dlg) armarAjustes();
    sincronizarAjustes();
    abridor = boton || document.activeElement;
    estabaCorriendo = estado === 'corre';
    if (estabaCorriendo) pausar('Pausa mientras cambias los ajustes');
    dlg.showModal();
  }

  /* -------------------------------------------------------------- arranque */
  function iniciar() {
    id = document.body.getAttribute('data-ejercicio');
    def = V.defs[id];
    marco = document.getElementById('marco');
    if (!def || !marco) return;

    // Detectar modo offline
    actualizarModoOffline();
    window.addEventListener('online', actualizarModoOffline);
    window.addEventListener('offline', actualizarModoOffline);

    estadoEl = el('p', 'oculto-a-la-vista');
    estadoEl.setAttribute('role', 'status');
    estadoEl.setAttribute('aria-live', 'polite');

    cargarAjustes().then(function (a) {
      ajustes = a;
      pintarNivel();
      if (window.ResizeObserver) {
        ro = new ResizeObserver(function () { medir(); });
        ro.observe(marco);
      } else {
        window.addEventListener('resize', medir);
      }
      medir();
      mostrarIntro();
    });

    var jugar = document.querySelector('[data-vis-jugar]');
    if (jugar) jugar.addEventListener('click', alternar);
    var rein = document.querySelector('[data-vis-reiniciar]');
    if (rein) rein.addEventListener('click', function () { cancelarDescanso(); mostrarIntro(); });
    var menos = document.querySelector('[data-vis-menos]');
    var mas = document.querySelector('[data-vis-mas]');
    if (menos) menos.addEventListener('click', function () { cambiarNivel(-1); });
    if (mas) mas.addEventListener('click', function () { cambiarNivel(1); });
    var cfgBtn = document.querySelector('[data-configurar]');
    if (cfgBtn) cfgBtn.addEventListener('click', function () { abrirAjustes(cfgBtn); });
    var ayuda = document.querySelector('[data-ayuda]');
    if (ayuda) {
      ayuda.addEventListener('click', function () {
        if (!window.RetoDialogo) return;
        window.RetoDialogo.informar({
          titulo: def.titulo,
          texto: 'Qué mirar: ' + def.intro.mirar + '\n\nQué hacer: ' + def.intro.hacer +
                 '\n\nCuánto dura: ' + def.intro.dura(ajustes) + '\n\n' + AVISO_MEDICO
        });
      });
    }

    /* Pausa automatica si la pestana pierde el foco (document.hidden). */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (estado === 'corre') pausar('Pausa: saliste de la pestaña');
        volcarSesionParcial();
      }
    });
    window.addEventListener('pagehide', volcarSesionParcial);

    document.addEventListener('keydown', function (e) {
      if (!ajustes || !ajustes.atajos) return;
      var t = e.target;
      var tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A') return;
      if (document.querySelector('dialog[open]')) return;
      if (e.key === ' ' && (estado === 'corre' || estado === 'pausa')) { e.preventDefault(); alternar(); }
      else if (e.key === '+' || e.key === '=') cambiarNivel(1);
      else if (e.key === '-') cambiarNivel(-1);
    });
  }

  function volcarSesionParcial() {
    if (estado === 'corre' || estado === 'pausa') {
      sesionMs += (transcurrido - contado) * 1000;
      contado = transcurrido;
    }
    volcarSesion();
  }

  V.ctx = ctx;
  document.addEventListener('DOMContentLoaded', iniciar);
})(window);
