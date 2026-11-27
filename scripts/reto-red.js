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
  var diagnosticoEl, ipsLocalesEl, diagnosticoBtn;

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

  function extraerIPsDeCandidatos(candidatos) {
    var ips = new Set();
    (candidatos || []).forEach(function (c) {
      if (c && c.candidate && c.candidate.indexOf(' typ host ') >= 0) {
        var m = c.candidate.match(/ (\d+\.\d+\.\d+\.\d+) /);
        if (m) ips.add(m[1]);
      }
    });
    return Array.from(ips);
  }

  function detectarTipoConexion() {
    var ua = navigator.userAgent.toLowerCase();
    var esMovil = /android|iphone|ipad|mobile/.test(ua);
    var tipo = 'Desconocido';
    if (navigator.connection) {
      var eff = navigator.connection.effectiveType;
      var rtt = navigator.connection.rtt;
      if (eff) tipo = eff.charAt(0).toUpperCase() + eff.slice(1);
      if (rtt) tipo += ' (' + rtt + 'ms)';
    }
    if (esMovil) tipo = 'Móvil · ' + tipo;
    return tipo;
  }

  function obtenerInfoDispositivo() {
    var ua = navigator.userAgent;
    var nombre = 'Dispositivo';
    if (/android/i.test(ua)) nombre = 'Android';
    else if (/iphone|ipad/i.test(ua)) nombre = 'iOS';
    else if (/windows/i.test(ua)) nombre = 'Windows';
    else if (/macintosh/i.test(ua)) nombre = 'Mac';
    else if (/linux/i.test(ua)) nombre = 'Linux';
    return { nombre: nombre, ua: ua, tipoConexion: detectarTipoConexion() };
  }

  function pintarDiagnostico(ips, infoDispositivo) {
    if (!ipsLocalesEl) return;
    ipsLocalesEl.innerHTML = '';
    if (!ips || !ips.length) {
      ipsLocalesEl.appendChild(el('li', 'red-direccion', 'No se detectaron IPs locales (recopilando candidatos ICE…)'));
      return;
    }
    // Info del dispositivo actual
    if (infoDispositivo) {
      var liDev = el('li', 'red-direccion');
      liDev.style.fontWeight = '600';
      liDev.style.background = 'var(--accent-bg, #fff3e0)';
      liDev.style.padding = '8px';
      liDev.style.borderRadius = '6px';
      liDev.style.marginBottom = '8px';
      liDev.appendChild(document.createTextNode('📱 Este dispositivo: ' + infoDispositivo.nombre + ' · ' + infoDispositivo.tipoConexion));
      ipsLocalesEl.appendChild(liDev);
    }
    ips.forEach(function (ip) {
      var li = el('li', 'red-direccion');
      var badge = el('span', 'red-ip-badge', 'host');
      badge.style.cssText = 'background:#e8f5e9;color:#2e7d32;padding:2px 6px;border-radius:4px;font-size:0.75em;margin-right:8px;font-weight:600';
      li.appendChild(badge);
      li.appendChild(document.createTextNode('IP local: ' + ip));
      ipsLocalesEl.appendChild(li);
    });
    // Detectar subred común (/24)
    var subredes = {};
    ips.forEach(function (ip) {
      var partes = ip.split('.');
      var base = partes[0] + '.' + partes[1] + '.' + partes[2] + '.0/24';
      subredes[base] = (subredes[base] || 0) + 1;
    });
    Object.keys(subredes).forEach(function (sub) {
      var li = el('li', 'red-direccion');
      li.style.opacity = '0.7';
      li.appendChild(document.createTextNode('Subred detectada: ' + sub + ' (' + subredes[sub] + ' IP' + (subredes[sub] > 1 ? 's' : '') + ')'));
      ipsLocalesEl.appendChild(li);
    });
  }

  async function recopilarIPsLocales() {
    if (!ipsLocalesEl) return;
    var infoDisp = obtenerInfoDispositivo();
    ipsLocalesEl.innerHTML = '<li class="red-direccion">Recopilando candidatos ICE (3s)…</li>';
    try {
      if (window.RetoConexion && window.RetoConexion.obtenerIPsLocales) {
        var pc = new RTCPeerConnection({ iceServers: window.RetoConexion.ICE || [] });
        var ips = await window.RetoConexion.obtenerIPsLocales(pc);
        try { pc.close(); } catch (e) {}
        pintarDiagnostico(ips, infoDisp);
        return ips;
      }
    } catch (e) {
      ipsLocalesEl.innerHTML = '<li class="red-direccion" style="color:#c62828">Error: ' + e.message + '</li>';
    }
    return [];
  }

  // Invitar a otro dispositivo desde la propia prueba de conexión
  function invitarDesdePrueba() {
    if (!window.RetoConexion || !window.RetoConexion.invitarDispositivo) {
      alert('La conexión WebRTC no está disponible. Abre el Duelo o Ding! primero para activarla.');
      return;
    }
    var estado = document.getElementById('red-invitar-estado');
    var cajaOferta = document.getElementById('red-invitar-oferta');
    var cajaResp = document.getElementById('red-invitar-respuesta');
    var btnResp = document.getElementById('red-invitar-btn-resp');
    var btnCopiar = document.getElementById('red-invitar-btn-copiar');
    var btnCancelar = document.getElementById('red-invitar-btn-cancelar');
    var seccion = document.getElementById('red-invitar-seccion');
    if (seccion) seccion.style.display = 'block';
    if (estado) estado.textContent = 'Generando invitación…';
    if (cajaOferta) cajaOferta.value = '';
    if (cajaResp) { cajaResp.value = ''; cajaResp.style.display = 'none'; }
    if (btnResp) btnResp.style.display = 'inline-block';
    if (btnCopiar) { btnCopiar.style.display = 'none'; btnCopiar.onclick = function () { copiar(cajaResp.value, btnCopiar); }; }
    if (btnCancelar) btnCancelar.onclick = function () { if (seccion) seccion.style.display = 'none'; };
    window.RetoConexion.invitarDispositivo().then(function (s) {
      if (cajaOferta) cajaOferta.value = s.codigo;
      if (estado) estado.textContent = 'Copia este código y pégalo en el otro dispositivo (en esta misma página, botón "Unirse a invitación")';
      if (btnResp) btnResp.onclick = function () {
        if (estado) estado.textContent = 'Preparando respuesta…';
        var p;
        try { p = window.RetoConexion.asistenteUnirse(); } catch (e) { if (estado) estado.textContent = e.message; return; }
        // asistenteUnirse espera a que el usuario pegue la respuesta en el otro dispositivo
        // Aquí solo mostramos que esperamos la conexión
        if (estado) estado.textContent = 'Esperando que el otro dispositivo pegue tu invitación y genere su respuesta…';
        s.abierto.then(function () {
          if (estado) estado.textContent = '✔ Conectado. Ya pueden usar la prueba de conexión.';
          if (seccion) setTimeout(function () { seccion.style.display = 'none'; }, 3000);
        });
      };
    }, function (e) {
      if (estado) estado.textContent = 'No se pudo: ' + e.message;
    });
  }

  // Unirse a invitación desde la propia prueba de conexión
  function unirseDesdePrueba() {
    if (!window.RetoConexion || !window.RetoConexion.asistenteUnirse) {
      alert('La conexión WebRTC no está disponible. Abre el Duelo o Ding! primero para activarla.');
      return;
    }
    var codigo = prompt('Pega aquí el código de invitación (empieza por RETO-LINK.):');
    if (!codigo) return;
    var estado = document.getElementById('red-unirse-estado');
    var seccion = document.getElementById('red-unirse-seccion');
    if (seccion) seccion.style.display = 'block';
    if (estado) estado.textContent = 'Conectando…';
    window.RetoConexion.asistenteUnirse().then(function (ok) {
      if (ok) {
        if (estado) estado.textContent = '✔ Conectado. Ya pueden usar la prueba de conexión.';
        if (seccion) setTimeout(function () { seccion.style.display = 'none'; }, 3000);
      } else {
        if (estado) estado.textContent = 'El usuario canceló o no se pudo conectar.';
      }
    }, function (e) {
      if (estado) estado.textContent = 'Error: ' + e.message;
    });
  }

  function pintarDirecciones(info) {
    direccionesEl.textContent = '';
    if (info.estatico) {
      avisoEl.textContent = 'Este sitio es una página web: todos los dispositivos abren esta misma dirección. ' +
        'Para jugar juntos, quien crea la sala pulsa «Invitar a otro dispositivo» y el otro pega su código al unirse.';
      var enlace = window.location.href.split('#')[0];
      var fila = el('li', 'red-direccion');
      fila.appendChild(el('code', '', enlace));
      direccionesEl.appendChild(fila);
      return;
    }
    if (!info.local) {
      avisoEl.textContent = 'Este modo es solo para la red wifi local.';
      return;
    }
    var puerto = window.location.port ? ':' + window.location.port : '';
    var ruta = '/categorias/multijugador/prueba-red/prueba-red.html';
    var direcciones = info.direcciones && info.direcciones.length ? info.direcciones : [];
    if (!direcciones.length) {
      avisoEl.textContent = 'No encontré una dirección para compartir.';
      return;
    }
    avisoEl.textContent = 'Abre una de estas direcciones en el otro dispositivo:';
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
        : 'Por ahora solo te veo a ti. Conecta el otro dispositivo (botón «Invitar a otro dispositivo») y manda un saludo.';
    }).catch(function () {
      fallos++;
      if (fallos >= 3) dispositivosEl.textContent = 'Perdí la conexión con el dispositivo anfitrión. ¿Sigue abierta su página?';
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
    diagnosticoEl = document.getElementById('red-diagnostico');
    ipsLocalesEl = document.getElementById('red-ips-locales');
    diagnosticoBtn = document.getElementById('red-btn-diagnostico');
    var invitarBtn = document.getElementById('red-btn-invitar');
    var unirseBtn = document.getElementById('red-btn-unirse');
    if (!avisoEl) return;
    nombreEl.value = ls('red_nombre') || '';
    enviarEl.addEventListener('click', enviar);
    textoEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });
    if (diagnosticoBtn) diagnosticoBtn.addEventListener('click', recopilarIPsLocales);
    if (invitarBtn) invitarBtn.addEventListener('click', invitarDesdePrueba);
    if (unirseBtn) unirseBtn.addEventListener('click', unirseDesdePrueba);
    var autoBtn = document.getElementById('red-btn-auto-conectar');
    var codigoInput = document.getElementById('red-codigo-4');
    var autoEstado = document.getElementById('red-auto-estado');
    if (autoBtn && codigoInput && autoEstado) {
      autoBtn.addEventListener('click', conectarAuto);
      codigoInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); conectarAuto(); } });
    }
    // Auto-recopilar IPs al cargar
    recopilarIPsLocales();

  async function conectarAuto() {
    var codigo = codigoInput.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(codigo)) { autoEstado.textContent = 'Código inválido: 4 letras/números.'; return; }
    autoEstado.textContent = 'Conectando automáticamente (código: ' + codigo + ')…';
    autoBtn.disabled = true;
    if (!window.RetoConexion || !window.RetoConexion.responderViaWorker) { autoEstado.textContent = 'Worker no disponible. Recarga.'; autoBtn.disabled = false; return; }
    try { sessionStorage.setItem('duelo_sala_codigo', codigo); sessionStorage.setItem('ding_sala_codigo', codigo); } catch (e) {}
    var conexion = window.RetoConexion.conexion;
    autoEstado.textContent = 'Conectando automáticamente (código: ' + codigo + ')… [1/3: obteniendo oferta]';
    try {
      var p = window.RetoConexion.responderViaWorker(conexion, codigo);
      autoEstado.textContent = 'Conectando automáticamente (código: ' + codigo + ')… [2/3: enviando respuesta]';
      var s = await p;
      autoEstado.textContent = 'Conectando automáticamente (código: ' + codigo + ')… [3/3: canal abierto]';
      await s.abierto;
      autoEstado.textContent = '✔ ¡Conectado automáticamente!';
      autoBtn.disabled = false;
    } catch (e) {
      autoEstado.textContent = 'Fallo: ' + e.message + '. Intenta manual (sección 3). [Ver consola F12]';
      console.error('Auto-conexión falló:', e);
      autoBtn.disabled = false;
    }
  }

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
      avisoEl.textContent = 'No pude preparar la prueba. Recarga la página.';
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
