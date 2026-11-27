/* =========================================================================
   R.E.T.O. - Prueba de conexión por wifi local (Fase 0 del multijugador)
   -------------------------------------------------------------------------
   Vista simplificada "semáforo": ambos dispositivos abren esta página,
   se detectan solos y el semáforo se pone verde si están en la misma subred.
   Botones a Duelo/Ding solo se habilitan en verde.
   ========================================================================= */
(function () {
  'use strict';

  var ultimo = 0;
  var cid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
  var tuIp = '';
  var local = false;
  var fallos = 0;
  var miSubred = null;
  var otroDispositivo = null; // { nombre, tipo, ip, subred, ultimaVez }

  // Elementos del semáforo
  var semaforoEsteNombre, semaforoEsteTipo, semaforoEsteIp, semaforoEsteSubred, semaforoEsteLed;
  var semaforoOtroNombre, semaforoOtroTipo, semaforoOtroIp, semaforoOtroSubred, semaforoOtroLed;
  var semaforoResultado, semaforoEstadoTexto, semaforoEstadoDetalle;
  var semaforoAcciones, semaforoBtnDuelo, semaforoBtnDing, semaforoAyuda;
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

  function ipASubred(ip) {
    if (!ip || ip === 'local') return null;
    var partes = ip.split('.');
    if (partes.length !== 4) return null;
    return partes[0] + '.' + partes[1] + '.' + partes[2] + '.0/24';
  }

  function actualizarSemaforoEste(ips, infoDispositivo) {
    if (!semaforoEsteNombre) return;
    semaforoEsteNombre.textContent = infoDispositivo.nombre + ' · ' + infoDispositivo.tipoConexion;
    semaforoEsteTipo.textContent = infoDispositivo.tipoConexion;
    if (ips && ips.length) {
      semaforoEsteIp.textContent = ips.join(', ');
      miSubred = ipASubred(ips[0]);
      semaforoEsteSubred.textContent = miSubred || '—';
      semaforoEsteLed.style.background = '#4caf50'; // verde: tengo IP local
    } else {
      semaforoEsteIp.textContent = '—';
      semaforoEsteSubred.textContent = '—';
      miSubred = null;
      semaforoEsteLed.style.background = '#ff9800'; // naranja: sin IP local
    }
    evaluarSemáforo();
  }

  function actualizarSemaforoOtro(disp) {
    if (!semaforoOtroNombre) return;
    if (!disp) {
      semaforoOtroNombre.textContent = 'Esperando…';
      semaforoOtroTipo.textContent = '—';
      semaforoOtroIp.textContent = '—';
      semaforoOtroSubred.textContent = '—';
      semaforoOtroLed.style.background = '#ccc';
      document.getElementById('semaforo-otro').style.opacity = '0.6';
      otroDispositivo = null;
      evaluarSemáforo();
      return;
    }
    semaforoOtroNombre.textContent = disp.nombre;
    semaforoOtroTipo.textContent = disp.tipo;
    semaforoOtroIp.textContent = disp.ip;
    semaforoOtroSubred.textContent = disp.subred || '—';
    semaforoOtroLed.style.background = '#4caf50';
    document.getElementById('semaforo-otro').style.opacity = '1';
    evaluarSemáforo();
  }

  function evaluarSemáforo() {
    if (!semaforoResultado) return;
    var hayOtro = !!otroDispositivo;
    var mismaSubred = hayOtro && miSubred && otroDispositivo.subred && miSubred === otroDispositivo.subred;

    semaforoResultado.style.display = 'block';
    semaforoAcciones.style.display = mismaSubred ? 'flex' : 'none';
    semaforoAyuda.style.display = mismaSubred ? 'none' : 'block';

    if (!miSubred) {
      semaforoEstadoTexto.textContent = '🟡 Detectando tu red…';
      semaforoEstadoDetalle.textContent = 'Recopilando IPs locales via WebRTC…';
      semaforoResultado.style.background = '#fff3e0';
      semaforoResultado.style.borderColor = '#ff9800';
    } else if (!hayOtro) {
      semaforoEstadoTexto.textContent = '🟡 Solo tú en la red';
      semaforoEstadoDetalle.textContent = 'Abre esta página en el otro dispositivo. Se detectará solo.';
      semaforoResultado.style.background = '#fff3e0';
      semaforoResultado.style.borderColor = '#ff9800';
    } else if (mismaSubred) {
      semaforoEstadoTexto.textContent = '🟢 ¡Misma subred detectada!';
      semaforoEstadoDetalle.textContent = 'Ambos en ' + miSubred + '. Listo para jugar.';
      semaforoResultado.style.background = '#e8f5e9';
      semaforoResultado.style.borderColor = '#4caf50';
    } else {
      var tuSub = miSubred || 'desconocida';
      var otroSub = (otroDispositivo && otroDispositivo.subred) ? otroDispositivo.subred : 'desconocida';
      semaforoEstadoTexto.textContent = '🔴 Subredes distintas';
      semaforoEstadoDetalle.textContent = 'Tú: ' + tuSub + ' · Otro: ' + otroSub + '. Conecta ambos a la misma WiFi/red.';
      semaforoResultado.style.background = '#fdecea';
      semaforoResultado.style.borderColor = '#e53935';
    }

    // Habilitar/deshabilitar botones
    [semaforoBtnDuelo, semaforoBtnDing].forEach(function (btn) {
      if (mismaSubred) {
        btn.removeAttribute('aria-disabled');
        btn.removeAttribute('tabindex');
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
      } else {
        btn.setAttribute('aria-disabled', 'true');
        btn.setAttribute('tabindex', '-1');
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.5';
      }
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
        actualizarSemaforoEste(ips, infoDisp);
        return ips;
      }
    } catch (e) {
      ipsLocalesEl.innerHTML = '<li class="red-direccion" style="color:#c62828">Error: ' + e.message + '</li>';
      actualizarSemaforoEste([], infoDisp);
    }
    return [];
  }

  function pintarDiagnostico(ips, infoDispositivo) {
    if (!ipsLocalesEl) return;
    ipsLocalesEl.innerHTML = '';
    if (!ips || !ips.length) {
      ipsLocalesEl.appendChild(el('li', 'red-direccion', 'No se detectaron IPs locales (recopilando candidatos ICE…)'));
      return;
    }
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
    var subredes = {};
    ips.forEach(function (ip) {
      var base = ipASubred(ip);
      subredes[base] = (subredes[base] || 0) + 1;
    });
    Object.keys(subredes).forEach(function (sub) {
      var li = el('li', 'red-direccion');
      li.style.opacity = '0.7';
      li.appendChild(document.createTextNode('Subred detectada: ' + sub + ' (' + subredes[sub] + ' IP' + (subredes[sub] > 1 ? 's' : '') + ')'));
      ipsLocalesEl.appendChild(li);
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

      // Detectar otro dispositivo desde los mensajes recibidos
      var mensajes = d.mensajes || [];
      var ahora = Date.now();
      mensajes.forEach(function (m) {
        var esMio = m.cid ? m.cid === cid : m.ip === tuIp;
        if (!esMio && m.ip && m.nombre) {
          var subred = ipASubred(m.ip);
          if (!otroDispositivo || otroDispositivo.ip !== m.ip) {
            otroDispositivo = {
              nombre: m.nombre,
              tipo: 'Detectado via chat',
              ip: m.ip,
              subred: subred,
              ultimaVez: ahora
            };
          } else {
            otroDispositivo.ultimaVez = ahora;
          }
          actualizarSemaforoOtro(otroDispositivo);
        }
      });

      // Limpiar si no se ve hace 10s
      if (otroDispositivo && (ahora - otroDispositivo.ultimaVez > 10000)) {
        otroDispositivo = null;
        actualizarSemaforoOtro(null);
      }

      dispositivosEl.textContent = d.dispositivos > 1
        ? 'Ya se ven ' + d.dispositivos + ' dispositivos en la red.'
        : 'Por ahora solo te veo a ti. Abre esta página en el otro dispositivo.';
    }).catch(function () {
      fallos++;
      if (fallos >= 3) dispositivosEl.textContent = 'Perdí la conexión con el servidor. ¿Sigue abierta la página?';
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

  function poblarAvanzado() {
    var cont = document.getElementById('red-avanzado');
    if (!cont) return;
    cont.innerHTML = '';
    // Mover el diagnóstico original aquí
    var diag = document.createElement('div');
    diag.innerHTML = '<h3 style="margin:0 0 .5rem 0;font-size:1em">🔍 IPs locales detectadas (WebRTC ICE host candidates)</h3>' +
      '<p class="ayuda" style="margin:.5rem 0">Si tu PC está por Ethernet y el móvil por WiFi, ambos deben mostrar IPs en la <strong>misma subred</strong> (ej: 192.168.1.x).</p>' +
      '<button type="button" class="boton" id="red-btn-diagnostico" style="margin-bottom:.75rem">🔄 Recopilar IPs locales (3s)</button>' +
      '<ul class="red-direcciones" id="red-ips-locales" style="list-style:none;padding:0;margin:0"></ul>';
    cont.appendChild(diag);
    ipsLocalesEl = document.getElementById('red-ips-locales');
    diagnosticoBtn = document.getElementById('red-btn-diagnostico');
    if (diagnosticoBtn) diagnosticoBtn.addEventListener('click', recopilarIPsLocales);

    // Signaling worker section
    var sig = document.createElement('div');
    sig.style.marginTop = '1.5rem';
    sig.innerHTML = '<h3>2. Conexión automática con código de 4 letras (signaling worker)</h3>' +
      '<p class="ayuda">Si ya tienes el código de 4 letras (ej: <code>ZCZN</code>) de quien creó la sala en Duelo/Ding, ingrésalo aquí.</p>' +
      '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem;align-items:center">' +
      '<input type="text" id="red-codigo-4" class="editor-campo" maxlength="4" placeholder="Código 4 letras" style="text-transform:uppercase;width:100px;font-size:1.2em;letter-spacing:.2em">' +
      '<button type="button" class="boton boton--principal" id="red-btn-auto-conectar">🚀 Conectar automáticamente</button>' +
      '</div>' +
      '<p class="ayuda" id="red-auto-estado" role="status"></p>';
    cont.appendChild(sig);
    var autoBtn = document.getElementById('red-btn-auto-conectar');
    var codigoInput = document.getElementById('red-codigo-4');
    var autoEstado = document.getElementById('red-auto-estado');
    if (autoBtn && codigoInput && autoEstado) {
      autoBtn.addEventListener('click', conectarAuto);
      codigoInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); conectarAuto(); } });
    }

    // Manual WebRTC section
    var man = document.createElement('div');
    man.style.marginTop = '1.5rem';
    man.innerHTML = '<h3>3. Conexión WebRTC manual (código largo <code>RETO-LINK.</code>)</h3>' +
      '<p class="ayuda">Para crear la conexión directa sin signaling worker.</p>' +
      '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem">' +
      '<button type="button" class="boton boton--principal" id="red-btn-invitar">📡 Invitar a otro dispositivo (crear oferta)</button>' +
      '<button type="button" class="boton" id="red-btn-unirse">🔗 Unirse a invitación (pegar oferta)</button>' +
      '</div>' +
      '<div id="red-invitar-seccion" style="display:none;margin-top:1rem;padding:1rem;background:var(--surface);border:2px solid var(--borde);border-radius:var(--radius)">' +
      '<h3 style="margin:0 0 .5rem 0">Invitación generada</h3>' +
      '<p class="ayuda" id="red-invitar-estado" role="status"></p>' +
      '<label for="red-invitar-oferta" style="display:block;margin-bottom:.25rem;font-weight:600">Copia este código y envíalo al otro dispositivo:</label>' +
      '<textarea id="red-invitar-oferta" class="editor-campo" rows="4" readonly style="font-family:monospace;font-size:.85em"></textarea>' +
      '<div style="margin-top:.5rem;display:flex;gap:.5rem;flex-wrap:wrap">' +
      '<button type="button" class="boton" id="red-invitar-btn-resp">✅ Ya se lo mandé, esperar su respuesta</button>' +
      '<button type="button" class="boton" id="red-invitar-btn-copiar" style="display:none">📋 Copiar mi respuesta</button>' +
      '<button type="button" class="boton" id="red-invitar-btn-cancelar" style="background:#fff;border-color:#c62828;color:#c62828">Cancelar</button>' +
      '</div>' +
      '</div>' +
      '<div id="red-unirse-seccion" style="display:none;margin-top:1rem;padding:1rem;background:var(--surface);border:2px solid var(--borde);border-radius:var(--radius)">' +
      '<h3 style="margin:0 0 .5rem 0">Unirse a invitación</h3>' +
      '<p class="ayuda" id="red-unirse-estado" role="status"></p>' +
      '<p class="ayuda">El otro dispositivo te habrá mandado un código largo que empieza por <code>RETO-LINK.</code>. Pégalo aquí al pulsar el botón.</p>' +
      '</div>';
    cont.appendChild(man);

    // Wire up manual WebRTC buttons (reusing existing functions from global scope)
    var invitarBtn = document.getElementById('red-btn-invitar');
    var unirseBtn = document.getElementById('red-btn-unirse');
    if (invitarBtn && window.invitarDesdePrueba) invitarBtn.addEventListener('click', window.invitarDesdePrueba);
    if (unirseBtn && window.unirseDesdePrueba) unirseBtn.addEventListener('click', window.unirseDesdePrueba);

    // Chat section
    var chat = document.createElement('div');
    chat.style.marginTop = '1.5rem';
    chat.innerHTML = '<div class="ajustes-campo"><label for="red-nombre">Tu nombre</label><input id="red-nombre" class="editor-campo" type="text" maxlength="16" autocomplete="nickname"></div>' +
      '<div class="ajustes-campo"><label for="red-texto">Mensaje</label><input id="red-texto" class="editor-campo" type="text" maxlength="120" autocomplete="off"></div>' +
      '<button type="button" class="boton boton--principal" id="red-enviar">Enviar</button>' +
      '<p class="ayuda" id="red-latencia" role="status"></p>' +
      '<ul class="red-mensajes" id="red-mensajes" aria-live="polite" aria-label="Mensajes recibidos"></ul>' +
      '<p class="ayuda" id="red-dispositivos"></p>';
    cont.appendChild(chat);

    nombreEl = document.getElementById('red-nombre');
    textoEl = document.getElementById('red-texto');
    enviarEl = document.getElementById('red-enviar');
    latenciaEl = document.getElementById('red-latencia');
    mensajesEl = document.getElementById('red-mensajes');
    dispositivosEl = document.getElementById('red-dispositivos');
    nombreEl.value = ls('red_nombre') || '';
    enviarEl.addEventListener('click', enviar);
    textoEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });
  }

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

  // Funciones para WebRTC manual (expuestas globalmente para el HTML avanzado)
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

  function iniciar() {
    // Semáforo elements
    semaforoEsteNombre = document.getElementById('semaforo-este-nombre');
    semaforoEsteTipo = document.getElementById('semaforo-este-tipo');
    semaforoEsteIp = document.getElementById('semaforo-este-ip');
    semaforoEsteSubred = document.getElementById('semaforo-este-subred');
    semaforoEsteLed = document.getElementById('semaforo-este-led');
    semaforoOtroNombre = document.getElementById('semaforo-otro-nombre');
    semaforoOtroTipo = document.getElementById('semaforo-otro-tipo');
    semaforoOtroIp = document.getElementById('semaforo-otro-ip');
    semaforoOtroSubred = document.getElementById('semaforo-otro-subred');
    semaforoOtroLed = document.getElementById('semaforo-otro-led');
    semaforoResultado = document.getElementById('semaforo-resultado');
    semaforoEstadoTexto = document.getElementById('semaforo-estado-texto');
    semaforoEstadoDetalle = document.getElementById('semaforo-estado-detalle');
    semaforoAcciones = document.getElementById('semaforo-acciones');
    semaforoBtnDuelo = document.getElementById('semaforo-btn-duelo');
    semaforoBtnDing = document.getElementById('semaforo-btn-ding');
    semaforoAyuda = document.getElementById('semaforo-ayuda');

    // Legacy elements (for advanced sections)
    avisoEl = document.getElementById('red-aviso');
    direccionesEl = document.getElementById('red-direcciones');

    if (!semaforoEsteNombre) return;

    // Poblar secciones avanzadas dentro de <details>
    poblarAvanzado();

    // Exponer funciones manuales globalmente para que las use el HTML avanzado
    window.invitarDesdePrueba = invitarDesdePrueba;
    window.unirseDesdePrueba = unirseDesdePrueba;

    // Auto-recopilar IPs al cargar
    recopilarIPsLocales();

    fetch('/api/red/info').then(function (r) { return r.json(); }).then(function (info) {
      local = !!info.local;
      tuIp = info.tu_ip || '';
      if (!local) {
        semaforoEstadoTexto.textContent = '🔴 Modo no local';
        semaforoEstadoDetalle.textContent = 'Esta prueba solo funciona en red local (localhost o LAN).';
        semaforoResultado.style.background = '#fdecea';
        semaforoResultado.style.borderColor = '#e53935';
        semaforoResultado.style.display = 'block';
        return;
      }
      preguntar();
      window.setInterval(preguntar, 1000);
    }).catch(function () {
      semaforoEstadoTexto.textContent = '🔴 Error';
      semaforoEstadoDetalle.textContent = 'No pude preparar la prueba. Recarga la página.';
      semaforoResultado.style.background = '#fdecea';
      semaforoResultado.style.borderColor = '#e53935';
      semaforoResultado.style.display = 'block';
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();