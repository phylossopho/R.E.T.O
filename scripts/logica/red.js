/* R.E.T.O. - Prueba de red / eco (puerto de logica/red.py)
   En el sitio estático ya no hay un servidor que reciba los mensajes: el eco
   corre en el propio navegador y, entre dispositivos, viaja por la conexión
   directa (ver scripts/reto-api.js). Las reglas de limpieza son las mismas. */
(function (raiz, fabrica) {
  'use strict';
  var nodo = typeof module === 'object' && module.exports;
  var B = nodo ? require('./_base.js') : raiz.RetoLogica._base;
  var m = fabrica(B);
  if (nodo) module.exports = m; else B.registrar(raiz, 'red', m);
})(typeof self !== 'undefined' ? self : this, function (B) {
  'use strict';
  var ValueError = B.ValueError;
  var MAX_MENSAJES = 50, MAX_NOMBRE = 16, MAX_TEXTO = 120;
  var ESPERA_ENTRE_MENSAJES_S = 0.5, VENTANA_DISPOSITIVOS_S = 8;

  function esDireccionLocal(host) {
    var h = String(host || '').trim().toLowerCase();
    if (h.charAt(0) === '[') h = h.indexOf(']') >= 0 ? h.slice(1, h.indexOf(']')) : h.slice(1);
    else if ((h.match(/:/g) || []).length === 1) h = h.split(':')[0];
    if (h === 'localhost' || h === '::1' || /\.local$/.test(h)) return true;
    if (/^(fe80:|fc|fd)/.test(h) && h.indexOf(':') >= 0) return true;
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (!m) return false;
    var a = +m[1], b = +m[2], c = +m[3], d = +m[4];
    if (Math.max(a, b, c, d) > 255) return false;
    return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  function limpiarNombre(texto) {
    var t = String(texto || '').replace(/[\x00-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE);
    return t || 'Dispositivo';
  }
  function limpiarCid(cid) {
    var t = String(cid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
    return t || null;
  }
  function limpiarMensaje(texto) {
    var t = String(texto || '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTO);
    if (!t) throw new ValueError('Escribe algo para mandar.');
    return t;
  }

  function Eco() { this.vaciar(); }
  Eco.prototype.vaciar = function () {
    this._mensajes = []; this._seq = 0; this._ultimoPorIp = {}; this._vistos = {};
  };
  Eco.prototype.agregar = function (nombre, mensaje, ip, ahora, cid) {
    ahora = ahora === undefined || ahora === null ? Date.now() / 1000 : ahora;
    nombre = limpiarNombre(nombre);
    var texto = limpiarMensaje(mensaje), clave = limpiarCid(cid) || ip;
    var previo = this._ultimoPorIp[clave];
    if (previo !== undefined && ahora - previo < ESPERA_ENTRE_MENSAJES_S) throw new ValueError('Espera un momento antes de mandar otro.');
    this._ultimoPorIp[clave] = ahora;
    this._vistos[clave] = ahora;
    this._seq += 1;
    var item = { n: this._seq, nombre: nombre, texto: texto, ip: ip, cid: limpiarCid(cid), hora: B.pyRound(ahora, 3) };
    this._mensajes.push(item);
    if (this._mensajes.length > MAX_MENSAJES) this._mensajes.shift();
    return Object.assign({}, item);
  };
  Eco.prototype.desde = function (n, ip, ahora, cid) {
    ahora = ahora === undefined || ahora === null ? Date.now() / 1000 : ahora;
    var clave = limpiarCid(cid) || ip;
    if (clave !== undefined && clave !== null) this._vistos[clave] = ahora;
    var nuevos = this._mensajes.filter(function (m) { return m.n > n; }).map(function (m) { return Object.assign({}, m); });
    var vistos = this._vistos;
    var activos = Object.keys(vistos).filter(function (k) { return ahora - vistos[k] <= VENTANA_DISPOSITIVOS_S; }).length;
    return { mensajes: nuevos, ultimo: this._seq, dispositivos: activos };
  };

  return { es_direccion_local: esDireccionLocal, limpiar_nombre: limpiarNombre, limpiar_cid: limpiarCid,
           limpiar_mensaje: limpiarMensaje, Eco: Eco };
});
