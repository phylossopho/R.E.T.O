/* =========================================================================
   R.E.T.O. - Conexión entre dispositivos (reto-conexion.js)
   -------------------------------------------------------------------------
   El duelo y Ding! necesitaban un servidor que guardara las salas. En un sitio
   estático la sala vive en el dispositivo que la crea (el "anfitrión") y los
   demás le mandan sus peticiones por una conexión directa. Quien contesta es el
   mismo código de siempre (scripts/logica/sala.js y ding.js), así que las
   reglas y las respuestas no cambian.

   DOS CAMINOS
   1. Misma computadora o celular, otra pestaña/ventana: BroadcastChannel.
      No hay que hacer nada: si la sala está en otra pestaña, se encuentra sola.
   2. Otro dispositivo: WebRTC (conexión directa). Para empezar se intercambian
      dos códigos de texto, uno de ida y otro de vuelta (copiar y pegar, por
      WhatsApp, etc.). No hace falta ningún servidor ni cuenta. Funciona en la
      misma red wifi sin internet; con internet usa un servidor STUN público
      solo para encontrar la ruta.

   MENSAJES (JSON)
     { t: 'req', id, p: { metodo, ruta, consulta, cuerpo } }
     { t: 'res', id, status, body }
   ========================================================================= */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var m = fabrica(raiz);
  if (nodo) module.exports = m;
  else m.arrancar(raiz);
})(typeof self !== 'undefined' ? self : this, function (raiz) {
  'use strict';

  var TIEMPO_RESPUESTA_MS = 12000;
  var TIEMPO_CANAL_MS = 700;
  var NOMBRE_CANAL = 'reto-rpc-v1';
  var PREFIJO = 'RETO-LINK.';
  // URL del Worker de señalización (cámbiala al deployar el tuyo)
  var SIGNALING_URL = 'https://reto-signaling.reto-phylossopho.workers.dev';
  // Más servidores STUN públicos para mejor conectividad en redes locales (Ethernet + WiFi bridge)
  var ICE = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.miwifi.com:3478' }
  ];

  function idCorto() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function sinConexion(msg) { return { status: 503, body: { error: msg || 'No hay conexión con el dispositivo anfitrión.' } }; }

  /* ------------------------------------------------------------------
     El núcleo: enlaces, peticiones y respuestas. No toca el navegador.
     ------------------------------------------------------------------ */
  function crearConexion(api, entorno) {
    entorno = entorno || {};
    var enlaces = {};              // id -> { enviar(msg), cerrar(), rol: 'anfitrion'|'cliente' }
    var enlaceCliente = null;      // el que me lleva al anfitrión
    var pendientes = {};           // id de petición -> { resolver, timer }
    var oyentes = [];
    var miId = idCorto();
    var canal = null;

    function avisar() { oyentes.forEach(function (f) { try { f(); } catch (e) { /* nada */ } }); }

    function esperar(id, ms, alVencer) {
      return new Promise(function (resolver) {
        var timer = setTimeout(function () { delete pendientes[id]; resolver(alVencer); }, ms);
        pendientes[id] = { resolver: resolver, timer: timer };
      });
    }
    function resolverPendiente(id, valor) {
      var p = pendientes[id];
      if (!p) return;
      clearTimeout(p.timer); delete pendientes[id]; p.resolver(valor);
    }

    /* ---- enlaces ---- */
    function agregarEnlace(id, enlace) {
      enlace.id = id;
      enlaces[id] = enlace;
      if (enlace.rol === 'cliente') enlaceCliente = enlace;
      avisar();
      return enlace;
    }
    function quitarEnlace(id) {
      var e = enlaces[id];
      if (!e) return;
      delete enlaces[id];
      if (enlaceCliente === e) {
        enlaceCliente = null;
        Object.keys(pendientes).forEach(function (k) { resolverPendiente(k, sinConexion('Se perdió la conexión con el anfitrión.')); });
      }
      avisar();
    }

    /* Llega un mensaje por un enlace. */
    function recibir(idEnlace, msg) {
      if (!msg || typeof msg !== 'object') return;
      var enlace = enlaces[idEnlace];
      if (msg.t === 'res') { resolverPendiente(msg.id, { status: msg.status, body: msg.body }); return; }
      if (msg.t === 'req' && enlace && enlace.rol === 'anfitrion') {
        api.ejecutarRemota(msg.p, 'enlace:' + idEnlace).then(function (r) {
          enlace.enviar({ t: 'res', id: msg.id, status: r.status, body: r.body });
        }, function () { enlace.enviar({ t: 'res', id: msg.id, status: 500, body: { error: 'Algo falló en el anfitrión.' } }); });
      }
    }

    /* ---- entre pestañas ---- */
    function abrirCanal() {
      var BC = entorno.BroadcastChannel || (typeof BroadcastChannel !== 'undefined' ? BroadcastChannel : null);
      if (canal || !BC) return canal;
      canal = new BC(NOMBRE_CANAL);
      canal.onmessage = function (ev) {
        var msg = ev.data;
        if (!msg || msg.de === miId) return;
        if (msg.t === 'req' && msg.para === undefined) {
          // ¿esta pestaña tiene la sala? Si sí, contesta; si no, se calla.
          if (!api.tieneSala(msg.p)) return;
          api.ejecutarRemota(msg.p, 'pestana:' + msg.de).then(function (r) {
            canal.postMessage({ t: 'res', id: msg.id, para: msg.de, de: miId, status: r.status, body: r.body });
          });
        } else if (msg.t === 'res' && msg.para === miId) resolverPendiente(msg.id, { status: msg.status, body: msg.body });
      };
      return canal;
    }
    function pedirPorCanal(peticion) {
      var c = abrirCanal();
      if (!c) return Promise.resolve(null);
      var id = idCorto();
      var espera = esperar(id, TIEMPO_CANAL_MS, null);
      c.postMessage({ t: 'req', id: id, de: miId, p: { metodo: peticion.metodo, ruta: peticion.ruta, consulta: peticion.consulta, cuerpo: peticion.cuerpo } });
      return espera;
    }

    /* ---- pedir algo al anfitrión ---- */
    // Devuelve { status, body }, o null si nadie tiene esa sala (para que el router decida).
    function pedir(peticion) {
      if (enlaceCliente) {
        var id = idCorto();
        var espera = esperar(id, TIEMPO_RESPUESTA_MS, sinConexion());
        enlaceCliente.enviar({ t: 'req', id: id, p: { metodo: peticion.metodo, ruta: peticion.ruta, consulta: peticion.consulta, cuerpo: peticion.cuerpo } });
        return espera;
      }
      return pedirPorCanal(peticion);
    }

    var conexion = {
      id: miId, agregarEnlace: agregarEnlace, quitarEnlace: quitarEnlace, recibir: recibir, pedir: pedir,
      hayEnlace: function () { return !!enlaceCliente; },
      cuantos: function () { return Object.keys(enlaces).length; },
      anfitriones: function () { return Object.keys(enlaces).filter(function (k) { return enlaces[k].rol === 'anfitrion'; }).length; },
      alCambiar: function (f) { oyentes.push(f); },
      abrirCanal: abrirCanal,
      cerrarTodo: function () {
        Object.keys(enlaces).forEach(function (k) { try { enlaces[k].cerrar && enlaces[k].cerrar(); } catch (e) { /* nada */ } quitarEnlace(k); });
        if (canal) { canal.close(); canal = null; }
      },
      asistenteUnirse: function () { return entorno.asistenteUnirse ? entorno.asistenteUnirse(conexion) : Promise.resolve(false); },
      TIEMPO_RESPUESTA_MS: TIEMPO_RESPUESTA_MS
    };
    api.registrarConexion(conexion);
    abrirCanal();
    return conexion;
  }

  /* ------------------------------------------------------------------
     WebRTC con códigos de texto (solo navegador)
     ------------------------------------------------------------------ */
  function codificar(obj) { return PREFIJO + btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
  function decodificar(texto) {
    var t = String(texto || '').trim().replace(/\s+/g, '');
    if (t.indexOf(PREFIJO) !== 0) throw new Error('Ese no parece un código de conexión de R.E.T.O.');
    try { return JSON.parse(decodeURIComponent(escape(atob(t.slice(PREFIJO.length))))); }
    catch (e) { throw new Error('El código está incompleto o dañado. Cópialo otra vez completo.'); }
  }
  function esperarIce(pc) {
    return new Promise(function (resolver) {
      if (pc.iceGatheringState === 'complete') return resolver();
      var fin = setTimeout(resolver, 5000);
      pc.addEventListener('icegatheringstatechange', function () {
        if (pc.iceGatheringState === 'complete') { clearTimeout(fin); resolver(); }
      });
    });
  }

  // Extraer IPs locales (host candidates) de un PeerConnection para diagnóstico de red
  function obtenerIPsLocales(pc) {
    return new Promise(function (resolver) {
      var ips = new Set();
      var handler = function (ev) {
        if (ev.candidate && ev.candidate.candidate) {
          var c = ev.candidate.candidate;
          // Solo candidatos 'host' (IPs locales reales, no STUN/TURN)
          if (c.indexOf(' typ host ') >= 0) {
            var m = c.match(/ (\d+\.\d+\.\d+\.\d+) /);
            if (m) ips.add(m[1]);
          }
        }
      };
      pc.addEventListener('icecandidate', handler);
      // Esperar a que termine el gathering o timeout
      var fin = setTimeout(function () {
        pc.removeEventListener('icecandidate', handler);
        resolver(Array.from(ips));
      }, 3000);
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(fin);
        pc.removeEventListener('icecandidate', handler);
        resolver(Array.from(ips));
      }
    });
  }

  // ===== Signaling Worker client (auto SDP exchange via 4-letter code) =====
  function signalingFetch(path, options) {
    var url = SIGNALING_URL + path;
    var opts = Object.assign({ headers: { 'Content-Type': 'application/json' } }, options);
    return fetch(url, opts).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error('signaling ' + r.status + ': ' + (e.error || r.statusText)); });
      return r.json();
    }).catch(function (e) {
      console.error('[signalingFetch] Error calling', url, ':', e);
      throw e;
    });
  }

  // Host: create offer, send to worker, wait for answer
  function invitarViaWorker(conexion, codigo) {
    var pc = new RTCPeerConnection({ iceServers: ICE }), idEnlace = 'rtc-' + idCorto();
    var dc = pc.createDataChannel('reto', { ordered: true });
    var abierto = new Promise(function (resolver) { enlazarCanal(conexion, dc, 'anfitrion', idEnlace, resolver); });
    return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
      .then(function () { return esperarIce(pc); })
      .then(function () {
        return signalingFetch('/offer/' + codigo, { method: 'POST', body: JSON.stringify({ sdp: pc.localDescription.sdp }) });
      })
      .then(function () {
        return esperarRespuesta(codigo, pc);
      })
      .then(function () {
        return {
          codigo: null,
          aceptar: function () { return Promise.resolve(); },
          abierto: abierto,
          cancelar: function () { try { pc.close(); } catch (e) {} }
        };
      })
      .catch(function (e) {
        console.error('[invitarViaWorker] Error:', e);
        throw new Error('Fallo en worker: ' + e.message);
      });
  }

  // Guest: get offer from worker, create answer, send to worker
  function responderViaWorker(conexion, codigo) {
    var pc = new RTCPeerConnection({ iceServers: ICE }), idEnlace = 'rtc-' + idCorto();
    var abierto = new Promise(function (resolver) {
      pc.ondatachannel = function (ev) { enlazarCanal(conexion, ev.channel, 'cliente', idEnlace, resolver); };
    });
    return signalingFetch('/offer/' + codigo)
      .then(function (data) { 
        console.log('[responderViaWorker] Got offer for', codigo);
        return pc.setRemoteDescription({ type: 'offer', sdp: data.sdp }); 
      })
      .then(function () { return pc.createAnswer(); })
      .then(function (a) { return pc.setLocalDescription(a); })
      .then(function () { return esperarIce(pc); })
      .then(function () {
        return signalingFetch('/answer/' + codigo, { method: 'POST', body: JSON.stringify({ sdp: pc.localDescription.sdp }) });
      })
      .then(function () {
        return { codigo: null, abierto: abierto, cancelar: function () { try { pc.close(); } catch (e) {} } };
      })
      .catch(function (e) {
        console.error('[responderViaWorker] Error:', e);
        throw new Error('Fallo en worker: ' + e.message);
      });
  }

  function esperarRespuesta(codigo, pc) {
    return new Promise(function (resolver, rechazar) {
      var intentos = 0;
      function probar() {
        signalingFetch('/answer/' + codigo)
          .then(function (data) {
            return pc.setRemoteDescription({ type: 'answer', sdp: data.sdp }).then(resolver);
          })
          .catch(function (e) {
            intentos++;
            console.log('[esperarRespuesta] Intento', intentos, 'para', codigo, ':', e.message);
            if (intentos >= 60) { rechazar(new Error('Timeout esperando respuesta (60s)')); return; }
            setTimeout(probar, 1000);
          });
      }
      probar();
    });
  }


  function enlazarCanal(conexion, dc, rol, idEnlace, alAbrir) {
    var enlace = {
      rol: rol, enviar: function (msg) { if (dc.readyState === 'open') dc.send(JSON.stringify(msg)); },
      cerrar: function () { try { dc.close(); } catch (e) { /* nada */ } }
    };
    dc.onopen = function () { conexion.agregarEnlace(idEnlace, enlace); if (alAbrir) alAbrir(); };
    dc.onclose = function () { conexion.quitarEnlace(idEnlace); };
    dc.onmessage = function (ev) { var msg; try { msg = JSON.parse(ev.data); } catch (e) { return; } conexion.recibir(idEnlace, msg); };
  }

  // Anfitrión: genera la invitación. Cuando pegue la respuesta, el canal se abre solo.
  function invitar(conexion) {
    var pc = new RTCPeerConnection({ iceServers: ICE }), idEnlace = 'rtc-' + idCorto();
    var dc = pc.createDataChannel('reto', { ordered: true });
    var abierto = new Promise(function (resolver) { enlazarCanal(conexion, dc, 'anfitrion', idEnlace, resolver); });
    return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () { return esperarIce(pc); }).then(function () {
      return {
        codigo: codificar({ t: 'oferta', sdp: pc.localDescription.sdp }),
        aceptar: function (textoRespuesta) {
          var r = decodificar(textoRespuesta);
          if (r.t !== 'respuesta') throw new Error('Ese código no es una respuesta. Pega el que te devolvió el otro dispositivo.');
          return pc.setRemoteDescription({ type: 'answer', sdp: r.sdp });
        },
        abierto: abierto, cancelar: function () { try { pc.close(); } catch (e) { /* nada */ } }
      };
    });
  }

  // Invitado: recibe la invitación y devuelve su respuesta.
  function responder(conexion, textoOferta) {
    var o = decodificar(textoOferta);
    if (o.t !== 'oferta') throw new Error('Ese código no es una invitación. Pega el que te mandó el anfitrión.');
    var pc = new RTCPeerConnection({ iceServers: ICE }), idEnlace = 'rtc-' + idCorto();
    var abierto = new Promise(function (resolver) {
      pc.ondatachannel = function (ev) { enlazarCanal(conexion, ev.channel, 'cliente', idEnlace, resolver); };
    });
    return pc.setRemoteDescription({ type: 'offer', sdp: o.sdp }).then(function () { return pc.createAnswer(); })
      .then(function (a) { return pc.setLocalDescription(a); }).then(function () { return esperarIce(pc); }).then(function () {
        return { codigo: codificar({ t: 'respuesta', sdp: pc.localDescription.sdp }), abierto: abierto, cancelar: function () { try { pc.close(); } catch (e) { /* nada */ } } };
      });
  }

  /* ------------------------------------------------------------------
     La pantallita para hacerlo (solo navegador)
     ------------------------------------------------------------------ */
  function interfaz(w, conexion, api) {
    var doc = w.document, capa = null;

    function el(tag, props, hijos) {
      var e = doc.createElement(tag);
      Object.keys(props || {}).forEach(function (k) {
        if (k === 'style') e.style.cssText = props[k]; else if (k === 'texto') e.textContent = props[k]; else if (k.indexOf('on') === 0) e[k] = props[k]; else e.setAttribute(k, props[k]);
      });
      (hijos || []).forEach(function (h) { e.appendChild(typeof h === 'string' ? doc.createTextNode(h) : h); });
      return e;
    }
    var BOTON = 'font:inherit;font-weight:700;padding:.7em 1.1em;margin:.3em .3em .3em 0;border-radius:.6em;border:2px solid #1b1b1b;background:#ffe14d;color:#1b1b1b;cursor:pointer;min-height:44px';
    var BOTON2 = BOTON.replace('#ffe14d', '#fff');
    var AREA = 'width:100%;box-sizing:border-box;min-height:6.5em;font:14px/1.3 monospace;padding:.5em;border:2px solid #1b1b1b;border-radius:.5em;background:#fff;color:#1b1b1b';

    function cerrar() { if (capa && capa.parentNode) capa.parentNode.removeChild(capa); capa = null; }
    function abrir(titulo, contenido, alCerrar) {
      cerrar();
      var tarjeta = el('div', { role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo,
        style: 'background:#fffdf5;color:#1b1b1b;max-width:34rem;width:calc(100% - 2rem);max-height:90vh;overflow:auto;border:3px solid #1b1b1b;border-radius:1rem;padding:1.2rem;font:16px/1.45 system-ui,sans-serif;box-shadow:0 .5rem 2rem rgba(0,0,0,.4)' },
        [el('h2', { texto: titulo, style: 'margin:.1em 0 .5em;font-size:1.3em' })].concat(contenido));
      capa = el('div', { style: 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center' }, [tarjeta]);
      capa._alCerrar = alCerrar;
      doc.body.appendChild(capa);
      return tarjeta;
    }
    function copiar(texto, boton) {
      var listo = function () { boton.textContent = '✔ Copiado'; };
      if (w.navigator.clipboard && w.navigator.clipboard.writeText) w.navigator.clipboard.writeText(texto).then(listo, function () { boton.textContent = 'Selecciona y copia'; });
      else boton.textContent = 'Selecciona y copia';
    }
    function aviso(msg) { return el('p', { texto: msg, role: 'status', style: 'margin:.5em 0;font-weight:700' }); }

    /* --- anfitrión --- */
    function invitarDispositivo() {
      return new Promise(function (resolver) {
        var hecho = false;
        function fin(v) { if (hecho) return; hecho = true; cerrar(); resolver(v); }
        var estado = el('p', { texto: 'Preparando la invitación…', role: 'status', style: 'font-weight:700' });
        var tarjeta = abrir('Invitar a otro dispositivo', [estado]);
        
        // Check for 4-letter room code (from duelo/ding)
        var codigoSala = null;
        try { codigoSala = sessionStorage.getItem('duelo_sala_codigo') || sessionStorage.getItem('ding_sala_codigo'); } catch (e) {}
        
        if (codigoSala && /^[A-Z0-9]{4}$/.test(codigoSala)) {
          // Automatic via signaling worker
          estado.textContent = 'Creando invitación automática (código: ' + codigoSala + ')…';
          var p = invitarViaWorker(conexion, codigoSala);
          p.then(function (s) {
            estado.textContent = 'Esperando que el otro dispositivo se una…';
            s.abierto.then(function () { 
              estado.textContent = '✔ ¡Conectado automáticamente!'; 
              setTimeout(function () { fin(true); }, 500); 
            });
          }).catch(function (e) { 
            estado.textContent = 'Fallo automático: ' + e.message + '. Intenta manual.'; 
            mostrarManual();
          });
        } else {
          mostrarManual();
        }
        
        function mostrarManual() {
          var cajaOferta = el('textarea', { readonly: 'readonly', style: AREA, 'aria-label': 'Código de invitación' });
          var cajaResp = el('textarea', { style: AREA, 'aria-label': 'Código de respuesta', placeholder: 'Pega aquí la respuesta' });
          var btnCopiar = el('button', { type: 'button', texto: 'Copiar invitación', style: BOTON });
          var btnConectar = el('button', { type: 'button', texto: 'Conectar', style: BOTON });
          var btnCerrar = el('button', { type: 'button', texto: 'Cerrar', style: BOTON2 });
          var sesion = null;
          var tarjeta2 = abrir('Invitar a otro dispositivo (manual)', [
            el('p', { texto: '1. Copia esta invitación y mándasela al otro dispositivo (WhatsApp, mensaje, lo que prefieras).' }), cajaOferta, btnCopiar,
            el('p', { texto: '2. Cuando te devuelva su respuesta, pégala aquí y pulsa «Conectar».' }), cajaResp, btnConectar, estado, btnCerrar
          ], function () { if (sesion) sesion.cancelar(); });
          btnCerrar.onclick = cerrar;
          btnCopiar.onclick = function () { copiar(cajaOferta.value, btnCopiar); };
          invitar(conexion).then(function (s) {
            sesion = s; cajaOferta.value = s.codigo; estado.textContent = 'Invitación lista.';
            btnConectar.onclick = function () {
              try { var p = s.aceptar(cajaResp.value); p.then(function () { estado.textContent = 'Conectando…'; }, function (e) { estado.textContent = 'No se pudo: ' + e.message; }); }
              catch (e) { estado.textContent = e.message; }
            };
            s.abierto.then(function () { estado.textContent = '✔ ¡Conectado! Ya puedes cerrar esta ventana. Para invitar a otro, ábrela de nuevo.'; });
          }).catch(function (e) { estado.textContent = 'No se pudo crear la invitación: ' + e.message; });
        }
        
        tarjeta.querySelector('button').onclick = fin;
      });
    }

    /* --- invitado --- */
    function asistenteUnirse() {
      return new Promise(function (resolver) {
        var hecho = false;
        function fin(v) { if (hecho) return; hecho = true; cerrar(); resolver(v); }
        var estado = el('p', { texto: '', role: 'status', style: 'font-weight:700' });
        
        // Check for 4-letter room code (from duelo/ding)
        var codigoSala = null;
        try { codigoSala = sessionStorage.getItem('duelo_sala_codigo') || sessionStorage.getItem('ding_sala_codigo'); } catch (e) {}
        
        if (codigoSala && /^[A-Z0-9]{4}$/.test(codigoSala)) {
          // Automatic via signaling worker
          estado.textContent = 'Uniéndose automáticamente (código: ' + codigoSala + ')…';
          var p = responderViaWorker(conexion, codigoSala);
          p.then(function (s) {
            estado.textContent = '✔ ¡Conectado automáticamente!';
            setTimeout(function () { fin(true); }, 400);
          }).catch(function (e) { 
            estado.textContent = 'Fallo automático: ' + e.message + '. Intenta manual.'; 
            mostrarManual();
          });
        } else {
          mostrarManual();
        }
        
        function mostrarManual() {
          var cajaOferta = el('textarea', { style: AREA, 'aria-label': 'Código de invitación', placeholder: 'Pega aquí la invitación del anfitrión' });
          var cajaResp = el('textarea', { readonly: 'readonly', style: AREA + ';display:none', 'aria-label': 'Tu código de respuesta' });
          var btnResp = el('button', { type: 'button', texto: 'Crear mi respuesta', style: BOTON });
          var btnCopiar = el('button', { type: 'button', texto: 'Copiar mi respuesta', style: BOTON + ';display:none' });
          var btnCancelar = el('button', { type: 'button', texto: 'Cancelar', style: BOTON2 });
          abrir('Conectar con la sala de otro dispositivo', [
            el('p', { texto: 'Esa sala no está en este dispositivo. Pídele al anfitrión su invitación (en su pantalla, botón «Invitar a otro dispositivo») y pégala aquí.' }),
            cajaOferta, btnResp, cajaResp, btnCopiar, estado, btnCancelar
          ], function () { fin(false); });
          btnCancelar.onclick = function () { fin(false); };
          btnCopiar.onclick = function () { copiar(cajaResp.value, btnCopiar); };
          btnResp.onclick = function () {
            estado.textContent = 'Preparando tu respuesta…';
            var p;
            try { p = responder(conexion, cajaOferta.value); } catch (e) { estado.textContent = e.message; return; }
            p.then(function (s) {
              cajaResp.value = s.codigo; cajaResp.style.display = 'block'; btnCopiar.style.display = 'inline-block'; btnResp.style.display = 'none';
              estado.textContent = 'Mándale este código al anfitrión. Cuando él lo pegue, aquí se conecta solo.';
              s.abierto.then(function () { estado.textContent = '✔ Conectado.'; setTimeout(function () { fin(true); }, 400); });
            }, function (e) { estado.textContent = 'No se pudo: ' + e.message; });
          };
        }
        
        mostrarManual();
      });
    }

    /* --- el botón del anfitrión --- */
    var boton = null;
    function mostrarBoton() {
      if (boton) return;
      boton = el('button', { type: 'button', style: 'position:fixed;left:1rem;bottom:1rem;z-index:9999;' + BOTON + ';box-shadow:0 .3rem 1rem rgba(0,0,0,.35)' });
      boton.onclick = invitarDispositivo;
      doc.body.appendChild(boton);
      pintarBoton();
    }
    function pintarBoton() { if (boton) boton.textContent = '📡 Invitar a otro dispositivo (' + conexion.anfitriones() + ' conectado' + (conexion.anfitriones() === 1 ? '' : 's') + ')'; }
    conexion.alCambiar(pintarBoton);
    api.alCrearSala(function () { if (typeof RTCPeerConnection !== 'undefined') mostrarBoton(); });

    return { invitarDispositivo: invitarDispositivo, asistenteUnirse: asistenteUnirse };
  }

  function arrancar(w) {
    if (w.RetoConexion) return;
    if (!w.RetoApi) { console.warn('[RetoConexion] Falta reto-api.js'); return; }
    var entorno = {};
    var conexion = crearConexion(w.RetoApi, entorno);
    var ui = interfaz(w, conexion, w.RetoApi);
    entorno.asistenteUnirse = function () {
      if (typeof RTCPeerConnection === 'undefined') return Promise.resolve(false);
      return ui.asistenteUnirse();
    };
    w.RetoConexion = { conexion: conexion, invitarDispositivo: ui.invitarDispositivo, asistenteUnirse: ui.asistenteUnirse };
  }

  return { crearConexion: crearConexion, arrancar: arrancar, codificar: codificar, decodificar: decodificar, PREFIJO: PREFIJO, obtenerIPsLocales: obtenerIPsLocales, ICE: ICE, invitarViaWorker: invitarViaWorker, responderViaWorker: responderViaWorker, SIGNALING_URL: SIGNALING_URL };
});
