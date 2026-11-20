/* =========================================================================
   R.E.T.O. - Mi tarjeta completa (Configuración General)
   -------------------------------------------------------------------------
   Muestra: perfil, nivel, tiempo por módulo, y permite exportar/importar.
   ========================================================================= */
(function (window) {
  'use strict';

  var R, Progreso, Perfil;
  var raiz, vivo;

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function vaciar(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function decir(t) {
    if (vivo) { vivo.textContent = ''; window.setTimeout(function () { vivo.textContent = t; }, 30); }
  }

  function formatearTiempo(minutos) {
    if (!minutos || minutos < 1) return '< 1 min';
    var h = Math.floor(minutos / 60);
    var m = Math.round(minutos % 60);
    return h ? h + 'h ' + m + 'm' : m + ' min';
  }

  function formatearFecha(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return iso; }
  }

  function renderPerfil(p, contenedor) {
    var caja = el('section', 'red-caja');
    caja.appendChild(el('h2', '', 'Perfil'));
    var grid = el('div', 'tarjeta-grid');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-md);';
    
    var nombreRow = el('p', '');
    nombreRow.innerHTML = '👤 <strong>Nombre:</strong> ' + (p.nombre || 'Jugador');
    grid.appendChild(nombreRow);
    
    var idRow = el('p', '');
    idRow.innerHTML = '🆔 <strong>Usuario ID:</strong> <code style="font-size:0.85em;">' + (p.usuario_id || '—') + '</code>';
    grid.appendChild(idRow);
    
    var creadoRow = el('p', '');
    creadoRow.innerHTML = '📅 <strong>Creado:</strong> ' + formatearFecha(p.creado);
    grid.appendChild(creadoRow);
    
    caja.appendChild(grid);
    contenedor.appendChild(caja);
  }

  function renderNivel(p, nivel, contenedor) {
    var caja = el('section', 'red-caja');
    caja.appendChild(el('h2', '', 'Nivel de práctica'));
    var fila = el('div', 'nivel-header');
    fila.style.cssText = 'display:flex;align-items:center;gap:var(--space-md);flex-wrap:wrap;margin-bottom:var(--space-sm);';
    var nivelNum = nivel && nivel.nivel !== undefined ? nivel.nivel : 0;
    var fraccion = nivel && nivel.fraccion !== undefined ? nivel.fraccion : 0;
    var pts = p.puntos || 0;
    fila.innerHTML = '\
      <span style="font-size:2.5rem;font-weight:bold;color:var(--accent);">Nivel ' + nivelNum + '</span>\
      <span style="color:var(--muted);">(' + Math.round(fraccion * 100) + '% hacia el siguiente)</span>\
      <span style="margin-left:auto;color:var(--muted);font-size:0.9rem;">Puntos totales: <strong>' + Math.round(pts * 10) / 10 + '</strong></span>\
    ';
    caja.appendChild(fila);
    var barra = el('div', 'duelo-barra');
    barra.style.cssText = 'height:16px;';
    barra.setAttribute('role', 'progressbar');
    barra.setAttribute('aria-valuemin', '0'); barra.setAttribute('aria-valuemax', '100');
    barra.setAttribute('aria-valuenow', String(Math.round(fraccion * 100)));
    barra.setAttribute('aria-label', 'Avance hacia el siguiente nivel');
    var r = el('span', 'duelo-barra-relleno');
    r.style.width = Math.round(fraccion * 100) + '%';
    barra.appendChild(r);
    caja.appendChild(barra);
    contenedor.appendChild(caja);
  }

  function renderTiempoModulo(titulo, obj, contenedor) {
    if (!obj || !Object.keys(obj).length) return;
    var det = el('details');
    det.appendChild(el('summary', '', titulo + ' (' + formatearTiempo(Object.values(obj).reduce((a,b)=>a+b,0)) + ')'));
    var ul = el('ul', 'equipo-lista');
    ul.style.cssText = 'list-style:none;padding:0;margin:var(--space-sm) 0;';
    Object.entries(obj).sort(function(a,b){ return b[1]-a[1]; }).forEach(function (kv) {
      var li = el('li');
      li.style.cssText = 'padding:4px 0;border-bottom:1px solid var(--borde);display:flex;justify-content:space-between;';
      li.innerHTML = '<span>' + kv[0] + '</span><strong>' + formatearTiempo(kv[1]) + '</strong>';
      ul.appendChild(li);
    });
    det.appendChild(ul);
    contenedor.appendChild(det);
  }

  function renderTiempo(tiempo, contenedor) {
    var caja = el('section', 'red-caja');
    caja.appendChild(el('h2', '', 'Tiempo invertido por módulo'));
    var total = 0;
    var modulos = [
      { key: 'lectura', label: '📚 Lectura veloz', obj: tiempo.lectura },
      { key: 'vision', label: '👁️ Visión', obj: tiempo.vision },
      { key: 'rpg', label: '⚔️ RPG', obj: tiempo.rpg },
      { key: 'duelo', label: '🤺 Duelo PvP', obj: tiempo.duelo ? { total: tiempo.duelo } : {} },
      { key: 'minijuegos', label: '🎮 Mini-juegos', obj: tiempo.minijuegos }
    ];
    var resumen = el('div', 'tiempo-resumen');
    resumen.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-sm);margin-bottom:var(--space-md);';
    modulos.forEach(function (m) {
      var mins = m.obj ? Object.values(m.obj).reduce(function(a,b){return a+b;},0) : 0;
      total += mins;
      var item = el('div', 'tiempo-item');
      item.style.cssText = 'background:var(--bg);border:1px solid var(--borde);border-radius:var(--radius);padding:var(--space-sm);text-align:center;';
      item.innerHTML = '<div style="font-size:0.85rem;color:var(--muted);">' + m.label + '</div><div style="font-size:1.2rem;font-weight:bold;">' + formatearTiempo(mins) + '</div>';
      resumen.appendChild(item);
    });
    caja.appendChild(resumen);
    var totalEl = el('p', 'red-estado');
    totalEl.style.cssText = 'text-align:right;font-size:1.1rem;margin-top:var(--space-sm);';
    totalEl.innerHTML = '📊 <strong>TOTAL: ' + formatearTiempo(total) + '</strong>';
    caja.appendChild(totalEl);
    modulos.forEach(function (m) { renderTiempoModulo(m.label, m.obj, caja); });
    contenedor.appendChild(caja);
  }

  function renderAcciones(p, cfg, contenedor) {
    var caja = el('section', 'red-caja');
    caja.appendChild(el('h2', '', 'Acciones'));
    var fila = el('div', 'duelo-power-ups');
    fila.style.cssText = 'display:flex;flex-wrap:wrap;gap:var(--space-sm);';

    // Exportar tarjeta (copiar código + descargar archivo)
    var exportar = el('button', 'boton boton--principal', '📤 Exportar tarjeta (v2)');
    exportar.type = 'button';
    exportar.addEventListener('click', function () {
      if (!R || !R.crearTarjeta || !R.aTexto) { decir('RetoRpg no disponible'); return; }
      var perfilCompleto = Object.assign({}, p, { config: cfg, tiempo_por_modulo: p.tiempo_por_modulo || {} });
      // Preservar fecha de creación original
      if (p.creado) perfilCompleto.creado = p.creado;
      R.crearTarjeta(perfilCompleto, p.creado || new Date().toISOString().slice(0,10)).then(function (t) {
        var codigo = R.aTexto(t);
        // Mostrar modal con ambas opciones
        var modal = document.createElement('dialog');
        modal.className = 'dialogo';
        modal.style.cssText = 'max-width:480px;width:90%;background:var(--surface);color:var(--text);border:3px solid var(--borde-fuerte);border-radius:var(--radius);padding:0;';
        modal.innerHTML = '\
          <div style="padding:var(--space-lg);">\
            <h2 style="margin-top:0;">📤 Exportar tarjeta v2</h2>\
            <p style="color:var(--muted);font-size:0.9rem;">Elige cómo guardar tu tarjeta:</p>\
            <div style="display:flex;flex-direction:column;gap:var(--space-sm);margin-top:var(--space-md);">\
              <button type="button" class="boton boton--principal" id="exp-copiar">📋 Copiar código al portapapeles</button>\
              <button type="button" class="boton" id="exp-descargar">💾 Descargar archivo .json</button>\
            </div>\
            <p id="exp-error" class="red-error" role="alert" style="min-height:1.2em;"></p>\
            <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-lg);">\
              <button type="button" class="boton" id="exp-cerrar">Cerrar</button>\
            </div>\
          </div>';
        document.body.appendChild(modal);
        modal.showModal();
        modal.querySelector('#exp-cerrar').addEventListener('click', function () { modal.close(); modal.remove(); });
        modal.querySelector('#exp-copiar').addEventListener('click', function () {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(codigo).then(function () { decir('Código v2 copiado al portapapeles'); modal.close(); modal.remove(); });
          } else {
            window.prompt('Copia este código:', codigo);
          }
        });
        modal.querySelector('#exp-descargar').addEventListener('click', function () {
          var blob = new Blob([JSON.stringify(t, null, 1)], { type: 'application/json' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'tarjeta-reto-' + (t.perfil.nombre || 'jugador').replace(/[^A-Za-z0-9_-]+/g, '_') + '.json';
          document.body.appendChild(a); a.click(); a.remove();
          decir('Archivo v2 descargado');
          modal.close(); modal.remove();
        });
      }).catch(function (e) { decir(e.message); });
    });

    var importar = el('button', 'boton', '📥 Importar tarjeta');
    importar.type = 'button';
    importar.addEventListener('click', function () { abrirModalImportar(); });

    var cambiar = el('button', 'boton', '🔄 Cambiar de perfil');
    cambiar.type = 'button';
    cambiar.addEventListener('click', function () { abrirModalPerfiles(); });

    var restablecer = el('button', 'boton', '🔧 Restablecer configs');
    restablecer.type = 'button';
    restablecer.addEventListener('click', function () {
      if (confirm('¿Restablecer tema, fuente, animaciones, sonidos, layouts a valores por defecto? NO se borran power-ups, nivel ni progreso.')) {
        var defaults = {
          tema: 'papel', fuente_global: 'nunito', animaciones_sitio: 'on',
          animaciones_batalla: 'on', sonidos: { activado: true, volumen: 0.7 },
          layout_rpg01: {}, layout_rpg01_movil: {}, layout_rpg02: {}, layout_rpg02_movil: {},
          layout_rpg03: {}, layout_rpg03_movil: {}, ajustes_aventura: {}, ajustes_duelo: { tam_preguntas: 'peq' }
        };
        if (window.RetoPerfil && window.RetoPerfil.actualizarConfig) {
          window.RetoPerfil.actualizarConfig(defaults).then(function () { decir('Configs restablecidas'); setTimeout(renderTodo, 300); });
        } else { decir('RetoPerfil no disponible'); }
      }
    });

    fila.appendChild(exportar); fila.appendChild(importar); fila.appendChild(cambiar); fila.appendChild(restablecer);
    caja.appendChild(fila);
    contenedor.appendChild(caja);
  }

  function abrirModalImportar() {
    var modal = document.createElement('dialog');
    modal.className = 'dialogo';
    modal.style.cssText = 'max-width:480px;width:90%;background:var(--surface);color:var(--text);border:3px solid var(--borde-fuerte);border-radius:var(--radius);padding:0;';
    modal.innerHTML = '\
      <div style="padding:var(--space-lg);">\
        <h2 style="margin-top:0;">📥 Importar tarjeta</h2>\
        <p style="color:var(--muted);font-size:0.9rem;">Pega el código <code>RETO1.</code> o <code>RETO2.</code> o elige un archivo <code>.json</code>.</p>\
        <div class="ajustes-campo" style="margin-top:var(--space-md);">\
          <label for="importar-texto" style="display:block;margin-bottom:4px;font-weight:bold;">Código de la tarjeta</label>\
          <textarea id="importar-texto" class="editor-campo" rows="4" style="width:100%;font-family:monospace;font-size:0.85rem;" placeholder="RETO2.eyJ0aXBvIjoi..."></textarea>\
        </div>\
        <div class="ajustes-campo" style="margin-top:var(--space-md);">\
          <label for="importar-archivo" style="display:block;margin-bottom:4px;font-weight:bold;">O elige archivo .json</label>\
          <input type="file" id="importar-archivo" accept=".json,application/json" style="width:100%;display:block;padding:var(--space-sm);border:2px dashed var(--borde);border-radius:var(--radius);background:var(--bg);cursor:pointer;">\
        </div>\
        <p id="importar-error" class="red-error" role="alert" style="min-height:1.2em;"></p>\
        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-lg);">\
          <button type="button" class="boton" id="importar-cancelar">Cancelar</button>\
          <button type="button" class="boton boton--principal" id="importar-ok">Importar</button>\
        </div>\
      </div>';
    document.body.appendChild(modal);
    modal.showModal();
    modal.querySelector('#importar-cancelar').addEventListener('click', function () { modal.close(); modal.remove(); });
    modal.querySelector('#importar-ok').addEventListener('click', function () {
      var texto = modal.querySelector('#importar-texto').value.trim();
      var archivo = modal.querySelector('#importar-archivo').files[0];
      if (!texto && !archivo) { modal.querySelector('#importar-error').textContent = 'Pega el código o elige un archivo'; return; }
      var procesar = function (t) {
        if (!R || !R.leerTarjeta) { modal.querySelector('#importar-error').textContent = 'RetoRpg no disponible'; return; }
R.leerTarjeta(t).then(function (res) {
            modal.close(); modal.remove();
            // res puede ser { perfil, tarjeta } o directamente el perfil (compatibilidad)
            var perfilImportado = (res && res.perfil) ? res.perfil : res;
            var tarjetaFecha = (res && res.tarjeta && res.tarjeta.fecha) || (res && res.fecha) || null;
            var nombreImportado = (perfilImportado && perfilImportado.nombre) ? perfilImportado.nombre : 'Jugador';
            if (window.RetoPerfil && window.RetoPerfil.obtener) {
              window.RetoPerfil.obtener().then(function (perfilActual) {
                var nuevoPerfil = Object.assign({}, perfilActual, perfilImportado, { 
                  usuario_id: (perfilImportado && perfilImportado.usuario_id) || perfilActual.usuario_id || 'importado',
                  creado: tarjetaFecha || perfilActual.creado || new Date().toISOString().slice(0, 10)
                });
                window.RetoDatos && window.RetoDatos.poner('reto-perfil-usuario', nuevoPerfil).then(function () {
                  decir('Tarjeta importada: ' + nombreImportado);
                  setTimeout(renderTodo, 300);
                });
              });
            }
          }).catch(function (e) { 
            modal.querySelector('#importar-error').textContent = e.message; 
            console.error('[Importar] Error:', e, 'res:', res);
          });
      };
      if (archivo) {
        var rd = new FileReader();
        rd.onload = function () { procesar(String(rd.result)); };
        rd.readAsText(archivo);
      } else {
        procesar(texto);
      }
    });
  }

  function abrirModalPerfiles() {
    var modal = document.createElement('dialog');
    modal.className = 'dialogo';
    modal.style.cssText = 'max-width:480px;width:90%;background:var(--surface);color:var(--text);border:3px solid var(--borde-fuerte);border-radius:var(--radius);padding:0;';
    modal.innerHTML = '\
      <div style="padding:var(--space-lg);">\
        <h2 style="margin-top:0;">🔄 Cambiar de perfil</h2>\
        <p style="color:var(--muted);font-size:0.9rem;">Esta función permite tener varios perfiles en este navegador. Próximamente.</p>\
        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-lg);">\
          <button type="button" class="boton boton--principal" id="perfiles-ok">Entendido</button>\
        </div>\
      </div>';
    document.body.appendChild(modal);
    modal.showModal();
    modal.querySelector('#perfiles-ok').addEventListener('click', function () { modal.close(); modal.remove(); });
  }

  function renderTodo() {
    if (!raiz) return;
    vaciar(raiz);
    Promise.all([
      window.RetoPerfil ? window.RetoPerfil.obtener() : Promise.resolve(null),
      window.RetoProgreso ? window.RetoProgreso.sesiones() : Promise.resolve([]),
      R ? R.inventario() : Promise.resolve([]),
      R ? R.equipo() : Promise.resolve([]),
      R ? R.aciertos() : Promise.resolve(0),
      R ? R.entregados() : Promise.resolve(0),
      R ? R.entregadosHoy() : Promise.resolve(0),
      R ? R.catalogo() : Promise.resolve({ powerups: {}, textos: {} }),
      R ? R.nivel() : Promise.resolve(null)
    ]).then(function (r) {
      var perfil = r[0];
      var sesiones = r[1];
      var inventario = r[2];
      var equipo = r[3];
      var aciertos = r[4];
      var entregados = r[5];
      var hoy = r[6];
      var catalogo = r[7];
      var nivel = r[8];
      if (!perfil) {
        raiz.innerHTML = '<div class="red-caja" style="text-align:center;padding:var(--space-xl);"><p>No hay perfil. Ve a la portada para crear uno.</p><a href="index.html" class="boton boton--principal" style="margin-top:var(--space-md);">Ir a portada</a></div>';
        return;
      }
      R.catalogoPU = catalogo;
      var tiempo = { lectura: {}, vision: {}, rpg: { pve: 0, pvp: 0 }, duelo: 0, minijuegos: {}, total: 0 };
      sesiones.forEach(function (s) {
        var mins = Number(s.minutos) || 0;
        if (!mins) return;
        if (s.tipo === 'lectura' && s.motor) tiempo.lectura[s.motor] = (tiempo.lectura[s.motor] || 0) + mins;
        else if (s.tipo === 'vision' && s.ejercicio) tiempo.vision[s.ejercicio] = (tiempo.vision[s.ejercicio] || 0) + mins;
        else if (s.tipo === 'rpg') {
          if (s.ejercicio === 'duelo' || s.ejercicio === 'pvp') tiempo.rpg.pvp += mins;
          else tiempo.rpg.pve += mins;
        } else if (s.tipo === 'duelo') tiempo.duelo += mins;
        else if (s.tipo === 'minijuegos' && s.ejercicio) tiempo.minijuegos[s.ejercicio] = (tiempo.minijuegos[s.ejercicio] || 0) + mins;
        tiempo.total += mins;
      });
      var cfg = perfil.config || {};
      renderPerfil(perfil, raiz);
      renderNivel(perfil, nivel, raiz);
      renderTiempo(tiempo, raiz);
      renderAcciones(perfil, cfg, raiz);
    });
  }

  function iniciar() {
    raiz = document.getElementById('tarjeta-contenido');
    vivo = document.getElementById('tarjeta-vivo');
    R = window.RetoRpg;
    Progreso = window.RetoProgreso;
    Perfil = window.RetoPerfil;
    if (!raiz) return;
    renderTodo();
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})(window);