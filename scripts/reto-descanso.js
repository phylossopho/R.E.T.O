/* =========================================================================
   R.E.T.O. - El aviso de la pausa 20-20-20
   -------------------------------------------------------------------------
   Cada 20 minutos de uso continuo de pantalla, mirar a unos 6 metros durante 20
   segundos. Este archivo va en las pantallas de lectura y de ejercicios para la
   vision y hace UNA cosa: cuando se junta el tiempo, muestra un banner discreto
   con dos botones, "Descansar ahora" y "Más tarde".

   LO QUE NUNCA HACE (WCAG 2.2.1, 3.2.x)
   - No bloquea la pantalla ni quita el foco de donde esta: es un aviso en una
     region aria-live="polite", no un dialogo.
   - No cambia de pagina ni de contexto sin que la persona lo pida.
   - "Más tarde" lo pospone 5 minutos; "No recordarme" lo apaga (se vuelve a
     encender en Visión > Pausa 20-20-20, donde tambien se cambia el intervalo).

   COMO CUENTA EL "USO CONTINUO"
   Suma los segundos con la pestana visible y lo guarda en sessionStorage, para
   que cambiar de pagina no reinicie la cuenta; si pasan mas de 5 minutos sin
   abrir nada (o la pestana se cierra), la cuenta vuelve a cero. La preferencia
   (activa o no, y el intervalo) vive en vision-ajustes-descanso (RetoDatos), el
   mismo sitio donde la guarda el ejercicio, asi hay una sola fuente.
   ========================================================================= */
(function (window) {
  'use strict';

  var document = window.document;
  var CLAVE_SESION = 'reto-descanso';
  var CLAVE_DATOS = 'vision-ajustes-descanso';
  var VACIO_MS = 5 * 60 * 1000;       // si pasa mas de esto sin usar, se reinicia
  var POSPONER_MS = 5 * 60 * 1000;
  var DESCANSO_SEG = 20;
  var DISTANCIA_M = 6;

  var prefs = { recordar: true, intervalo: 20 };
  var acum = 0;                        // ms de uso continuo
  var posponerHasta = 0;
  var banner = null;
  var enDescanso = false;

  function leerSesion() {
    try {
      var o = JSON.parse(window.sessionStorage.getItem(CLAVE_SESION) || 'null');
      if (o && typeof o.acum === 'number' && Date.now() - o.ultimo < VACIO_MS) {
        acum = o.acum;
        posponerHasta = o.posponer || 0;
      }
    } catch (e) {}
  }

  function guardarSesion() {
    try {
      window.sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ acum: acum, ultimo: Date.now(), posponer: posponerHasta }));
    } catch (e) {}
  }

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function quitar() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  function crearBanner() {
    if (banner) return banner;
    banner = el('div', 'descanso-banner');
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    document.body.appendChild(banner);
    return banner;
  }

  function mostrarAviso() {
    var b = crearBanner();
    while (b.firstChild) b.removeChild(b.firstChild);
    b.appendChild(el('p', 'descanso-texto', 'Llevas ' + prefs.intervalo + ' minutos con la pantalla. Mira un objeto a unos ' +
      DISTANCIA_M + ' metros durante ' + DESCANSO_SEG + ' segundos.'));
    var fila = el('div', 'descanso-acciones');
    var ahora = el('button', 'boton boton--principal', 'Descansar ahora');
    ahora.type = 'button';
    ahora.addEventListener('click', descansar);
    var luego = el('button', 'boton', 'Más tarde');
    luego.type = 'button';
    luego.addEventListener('click', function () {
      posponerHasta = Date.now() + POSPONER_MS;
      quitar();
      guardarSesion();
    });
    var no = el('button', 'boton descanso-no', 'No recordarme');
    no.type = 'button';
    no.addEventListener('click', function () {
      prefs.recordar = false;
      quitar();
      if (window.RetoDatos) {
        window.RetoDatos.obtener(CLAVE_DATOS).then(function (g) {
          var o = (g && typeof g === 'object') ? g : {};
          o.recordar = false;
          return window.RetoDatos.poner(CLAVE_DATOS, o);
        }).catch(function () {});
      }
    });
    fila.appendChild(ahora);
    fila.appendChild(luego);
    fila.appendChild(no);
    b.appendChild(fila);
  }

  function descansar() {
    enDescanso = true;
    var b = crearBanner();
    while (b.firstChild) b.removeChild(b.firstChild);
    var texto = el('p', 'descanso-texto', 'Mira un objeto a unos ' + DISTANCIA_M + ' metros.');
    var n = el('p', 'descanso-cuenta', String(DESCANSO_SEG));
    n.setAttribute('aria-hidden', 'true');
    b.appendChild(texto);
    b.appendChild(n);
    var restante = DESCANSO_SEG;
    var id = window.setInterval(function () {
      restante -= 1;
      n.textContent = String(Math.max(0, restante));
      if (restante > 0 && restante % 5 === 0) texto.textContent = 'Quedan ' + restante + ' segundos. Sigue mirando lejos.';
      if (restante <= 0) {
        window.clearInterval(id);
        acum = 0;
        posponerHasta = 0;
        enDescanso = false;
        texto.textContent = 'Listo. Ya puedes volver.';
        n.textContent = '';
        window.setTimeout(quitar, 3000);
        guardarSesion();
      }
    }, 1000);
  }

  function tick() {
    if (document.hidden || enDescanso || !prefs.recordar) return;
    acum += 1000;
    if (acum % 10000 === 0) guardarSesion();
    if (!banner && acum >= prefs.intervalo * 60000 && Date.now() >= posponerHasta) mostrarAviso();
  }

  function iniciar() {
    leerSesion();
    if (window.RetoDatos) {
      window.RetoDatos.obtener(CLAVE_DATOS).then(function (g) {
        if (g && typeof g === 'object') {
          if (typeof g.recordar === 'boolean') prefs.recordar = g.recordar;
          if (typeof g.intervalo === 'number') prefs.intervalo = g.intervalo;
        }
      }).catch(function () {});
    }
    window.setInterval(tick, 1000);
    window.addEventListener('pagehide', guardarSesion);
  }

  window.RetoDescanso = {
    /* Para las pruebas: adelanta la cuenta. */
    sumar: function (ms) { acum += ms; if (acum >= prefs.intervalo * 60000 && prefs.recordar && !banner) mostrarAviso(); },
    estado: function () { return { acum: acum, prefs: prefs }; }
  };
  document.addEventListener('DOMContentLoaded', iniciar);
})(window);
