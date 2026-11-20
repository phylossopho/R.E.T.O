/* =========================================================================
   R.E.T.O. - Prueba de conexion por wifi local (Fase 0 del multijugador)
   -------------------------------------------------------------------------
   Dos dispositivos en la misma red abren esta pagina, se mandan un saludo y se
   ven. Sirve para saber, ANTES de armar salas y duelos, si tu red deja que los
   dispositivos hablen entre si (muchas redes de escuela o de invitados los
   aislan) y cuanto tarda un mensaje.

   COMO FUNCIONA: se MANDA con un POST (llega al instante) y se PREGUNTA cada
   segundo por lo nuevo (sondeo). No usa WebSocket: ver logica/red.py.
   ========================================================================= */
(function () {
  'use strict';

  var ultimo = 0;
  // Cada pagina abierta tiene su propio identificador (dos pestanas de la misma
  // computadora comparten IP y no se podrian distinguir de otra forma).
  var cid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
  var tuIp = '';
  var local = false;
  var fallos = 0;
  var avisoEl, direccionesEl, mensajesEl, dispositivosEl, latenciaEl, nombreEl, textoEl, enviarEl;

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function ls(clave, valor) {
    try {
      if (valor === undefined) return window.localStorage.getItem(clave);
      window.localStorage.setItem(clave, valor);
    } catch (e) { /* sin almacenamiento */ }
    return null;
  }

  function copiar(texto, boton) {
    var ok = function () {
      var antes = boton.textContent;
      boton.textContent = 'Copiada';
      window.setTimeout(function () { boton.textContent = antes; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(ok).catch(function () {});
    }
  }

  function pintarDirecciones(info) {
    direccionesEl.textContent = '';
    if (!info.local) {
      avisoEl.textContent = 'Este modo es solo para la red wifi local. Abre el sitio con servidor.cmd en una computadora de tu red.';
      return;
    }
    var puerto = window.location.port ? ':' + window.location.port : '';
    var ruta = '/categorias/multijugador/prueba-red/prueba-red.html';
    var direcciones = info.direcciones && info.direcciones.length ? info.direcciones : [];
    if (!direcciones.length) {
      avisoEl.textContent = 'No encontré la dirección de esta computadora en la red. ¿Está conectada al wifi?';
      return;
    }
    avisoEl.textContent = 'Abre una de estas direcciones en el otro dispositivo (misma red wifi):';
    direcciones.forEach(function (ip) {
      var url = window.location.protocol + '//' + ip + puerto + ruta;
      var li = el('li', 'red-direccion');
      li.appendChild(el('code', '', url));
      var b = el('button', 'boton', 'Copiar');
      b.type = 'button';
      b.setAttribute('aria-label', 'Copiar la dirección ' + url);
      b.addEventListener('click', function () { copiar(url, b); });
      li.appendChild(b);
      direccionesEl.appendChild(li);
    });
  }

  function agregarMensajes(lista) {
    lista.forEach(function (m) {
      var mio = m.cid ? m.cid === cid : m.ip === tuIp;
      var li = el('li', 'red-mensaje' + (mio ? ' red-mensaje--mio' : ''));
      li.appendChild(el('strong', '', m.nombre + (mio ? ' (tú)' : '')));
      li.appendChild(document.createTextNode(': ' + m.texto));
      li.appendChild(el('small', 'red-ip', ' · ' + m.ip));
      mensajesEl.appendChild(li);
      ultimo = Math.max(ultimo, m.n);
    });
    while (mensajesEl.children.length > 50) mensajesEl.removeChild(mensajesEl.firstChild);
  }

  function preguntar() {
    if (!local || document.hidden) return;
    fetch('/api/red/eco?desde=' + ultimo + '&cid=' + encodeURIComponent(cid)).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (d) {
      fallos = 0;
      agregarMensajes(d.mensajes || []);
      ultimo = Math.max(ultimo, d.ultimo || 0);
      dispositivosEl.textContent = d.dispositivos > 1
        ? 'Ya se ven ' + d.dispositivos + ' dispositivos en la red.'
        : 'Por ahora solo te veo a ti. Abre la dirección en el otro dispositivo y manda un saludo.';
    }).catch(function () {
      fallos++;
      if (fallos >= 3) dispositivosEl.textContent = 'Perdí la conexión con la computadora anfitriona. ¿Sigue abierto servidor.cmd?';
    });
  }

  function enviar() {
    var nombre = nombreEl.value.trim();
    var texto = textoEl.value.trim();
    if (!texto) { latenciaEl.textContent = 'Escribe algo para mandar.'; textoEl.focus(); return; }
    ls('red_nombre', nombre);
    var t0 = performance.now();
    enviarEl.disabled = true;
    fetch('/api/red/eco', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre, mensaje: texto, cid: cid })
    }).then(function (r) {
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'No se pudo mandar.'); return d; });
    }).then(function () {
      latenciaEl.textContent = 'Tu mensaje llegó al servidor en ' + Math.round(performance.now() - t0) + ' ms.';
      textoEl.value = '';
      preguntar();
    }).catch(function (e) {
      latenciaEl.textContent = e.message || 'No se pudo mandar.';
    }).then(function () {
      window.setTimeout(function () { enviarEl.disabled = false; }, 500);
    });
  }

  function iniciar() {
    avisoEl = document.getElementById('red-aviso');
    direccionesEl = document.getElementById('red-direcciones');
    mensajesEl = document.getElementById('red-mensajes');
    dispositivosEl = document.getElementById('red-dispositivos');
    latenciaEl = document.getElementById('red-latencia');
    nombreEl = document.getElementById('red-nombre');
    textoEl = document.getElementById('red-texto');
    enviarEl = document.getElementById('red-enviar');
    if (!avisoEl) return;
    nombreEl.value = ls('red_nombre') || '';
    enviarEl.addEventListener('click', enviar);
    textoEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });

    fetch('/api/red/info').then(function (r) { return r.json(); }).then(function (info) {
      local = !!info.local;
      tuIp = info.tu_ip || '';
      pintarDirecciones(info);
      if (!local) {
        enviarEl.disabled = true;
        textoEl.disabled = true;
        nombreEl.disabled = true;
        return;
      }
      preguntar();
      window.setInterval(preguntar, 1000);
    }).catch(function () {
      avisoEl.textContent = 'No pude hablar con el servidor. Abre el sitio con servidor.cmd.';
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
