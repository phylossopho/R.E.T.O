/* ==========================================================================
   R.E.T.O. - Estados de los power ups en la batalla

   Mientras un power up sigue haciendo efecto, SE NOTA en el personaje que lo tiene:
     - un AURA suave detras del sprite (azul = escudo, naranja = daño extra, etc.)
     - una ETIQUETA con lo que hace y lo que le queda ("Escudo 30", "Daño ×1,5 · 2 golpes",
       "Sangrado −8 · 2 turnos")
   y se queda ahi hasta que el efecto pasa (se acaban los golpes o los turnos). Lo manda el
   servidor (yo_estado.efectos y rival.efectos); aqui solo se pinta, tras cada cambio.

   Tambien se ven los efectos que el RIVAL te puso (sangrado, menos tiempo, pierdes el ataque) y los
   suyos (su escudo, su reduccion de daño).

   Al USAR un power up sale ademas un destello con su icono sobre quien recibe el efecto.

   ACCESIBILIDAD: el color nunca es la unica señal. Cada etiqueta lleva un símbolo (▲ a favor, ▼ en
   contra) y texto, y un nombre accesible («A tu favor: Escudo 30»). El aura se queda fija (sin
   movimiento) con el interruptor de animaciones apagado o prefers-reduced-motion: sigue viéndose.

   API: window.RetoEstados
     pintar(raiz, efectosJugador, efectosRival)
     activar(raiz, powerUpId, catalogo)             destello del power up sobre quien recibe el efecto (lo decide
                                                    el propio power up: curar es para ti, el daño directo para el rival)
   En raiz: <img data-sprite="jugador|rival"> (las etiquetas y el aura van en su caja) o un contenedor
   <div data-estados="jugador|rival"> (solo etiquetas; con data-estados-flotante tambien aura).
   ========================================================================== */
(function () {
  'use strict';

  var TIPOS = {
    escudo:            { icono: '🛡️', buff: true,  aura: '#2f80ed', texto: function (e) { return 'Escudo ' + e.pv + golpes(e); } },
    reduccion:         { icono: '🔰', buff: true,  aura: '#7e57c2', texto: function (e) { return 'Daño −' + e.pct + ' %' + golpes(e); } },
    mult_dano:         { icono: '⚔️', buff: true,  aura: '#ff6d00', texto: function (e) { return 'Daño ×' + String(e.valor).replace('.', ',') + golpes(e); } },
    segunda:           { icono: '♻️', buff: true,  aura: '#fbc02d', texto: function (e) { return '2ª oportunidad'; } },
    inmune_tiempo:     { icono: '🧘', buff: true,  aura: '#00acc1', texto: function (e) { return 'Sin reloj' + turnos(e); } },
    anular_desventaja: { icono: '⚖️', buff: true,  aura: '#7cb342', texto: function (e) { return 'Sin desventaja' + turnos(e); } },
    tiempo_mas:        { icono: '⏱️', buff: true,  aura: '#00acc1', texto: function (e) { return '+' + e.seg + ' s'; } },
    sangrado:          { icono: '🩸', buff: false, aura: '#d50000', texto: function (e) { return 'Sangrado −' + e.pv + turnos(e); } },
    tiempo_menos:      { icono: '⌛', buff: false, aura: '#ff8f00', texto: function (e) { return '−' + e.seg + ' s'; } },
    perder_ataque:     { icono: '🚫', buff: false, aura: '#616161', texto: function (e) { return 'Pierde el ataque'; } }
  };

  function golpes(e) { return e.golpes ? ' · ' + e.golpes + (e.golpes === 1 ? ' golpe' : ' golpes') : ''; }
  function turnos(e) { return e.turnos ? ' · ' + e.turnos + (e.turnos === 1 ? ' turno' : ' turnos') : ''; }

  function anfitrion(raiz, quien) {
    var img = raiz.querySelector('[data-sprite="' + quien + '"]');
    if (img) return { caja: img.closest('[data-sprite-caja]') || img.parentNode, conSprite: true };
    var h = raiz.querySelector('[data-estados="' + quien + '"]');
    return h ? { caja: h, conSprite: h.hasAttribute('data-estados-flotante') } : null;
  }

  function pintarLado(raiz, quien, efectos) {
    var a = anfitrion(raiz, quien);
    if (!a) return;
    var caja = a.caja;
    var fila = caja.querySelector(':scope > .est-fila');
    if (!fila) {
      fila = document.createElement('div');
      fila.className = 'est-fila' + (a.conSprite ? '' : ' est-fila--texto');
      fila.setAttribute('role', 'list');
      caja.appendChild(fila);
    }
    fila.textContent = '';
    var conocidos = (efectos || []).filter(function (e) { return TIPOS[e.tipo]; });
    var buffs = [], debuffs = [];
    conocidos.forEach(function (e) {
      var d = TIPOS[e.tipo];
      var chip = document.createElement('span');
      chip.className = 'est-chip ' + (d.buff ? 'est-chip--favor' : 'est-chip--contra');
      chip.setAttribute('role', 'listitem');
      var texto = d.texto(e);
      var propio = quien === 'jugador';
      chip.setAttribute('aria-label', (d.buff ? (propio ? 'A tu favor: ' : 'A favor del rival: ') : (propio ? 'En tu contra: ' : 'En contra del rival: ')) + texto);
      var sim = document.createElement('span');
      sim.setAttribute('aria-hidden', 'true');
      sim.textContent = (d.buff ? '▲ ' : '▼ ') + d.icono + ' ';
      chip.appendChild(sim);
      chip.appendChild(document.createTextNode(texto));
      fila.appendChild(chip);
      (d.buff ? buffs : debuffs).push(d.aura);
    });
    // El aura: un halo detras del sprite con el color del primer efecto a favor y otro del primer efecto en contra.
    if (a.conSprite) {
      caja.classList.add('est-caja');
      caja.classList.toggle('est-con-favor', buffs.length > 0);
      caja.classList.toggle('est-con-contra', debuffs.length > 0);
      if (buffs.length) caja.style.setProperty('--aura-favor', buffs[0]); else caja.style.removeProperty('--aura-favor');
      if (debuffs.length) caja.style.setProperty('--aura-contra', debuffs[0]); else caja.style.removeProperty('--aura-contra');
    }
    fila.hidden = conocidos.length === 0;
  }

  function pintar(raiz, efectosJugador, efectosRival) {
    if (!raiz) return;
    pintarLado(raiz, 'jugador', efectosJugador);
    pintarLado(raiz, 'rival', efectosRival);
  }

  /* Destello al usar un power up: su icono sobre quien lo recibe. */
  var DESTELLOS = {
    cura: function () { return ['💚', '']; },                          // el numero verde sale junto al HP
    purificar: function () { return ['✨', '']; },
    dano_directo: function () { return ['💥', '']; },                  // el numero naranja sale junto al HP del rival
    tiempo: function (v) { return ['⏱️', '+' + v + ' s']; },
    tiempo_rival: function (v) { return ['⌛', '−' + v + ' s']; },
    escudo: function () { return ['🛡️', '']; },
    reduccion: function () { return ['🔰', '']; },
    mult_dano: function () { return ['⚔️', '']; },
    mult_dano_rapido: function () { return ['⚔️', '']; },
    sangrado: function () { return ['🩸', '']; },
    inmune_tiempo: function () { return ['🧘', '']; },
    anular_desventaja: function () { return ['⚖️', '']; },
    segunda_oportunidad: function () { return ['♻️', '']; },
    descartar: function () { return ['✂️', '']; },
    mostrar_tema: function () { return ['🦅', '']; },
    cambiar_pregunta: function () { return ['🔄', '']; },
    perder_ataque_rival: function () { return ['🚫', '']; }
  };
  var AL_RIVAL = { dano_directo: 1, tiempo_rival: 1, sangrado: 1, perder_ataque_rival: 1 };

  function activar(raiz, powerUpId, catalogo) {
    if (!raiz || !catalogo || !catalogo.powerups || !catalogo.powerups[powerUpId]) return;
    var efecto = catalogo.powerups[powerUpId].efecto || {};
    var claves = Object.keys(efecto);
    var principal = claves.filter(function (k) { return DESTELLOS[k]; })[0];
    if (!principal) return;
    var v = efecto[principal];
    var quien = AL_RIVAL[principal] ? 'rival' : 'jugador';
    var a = anfitrion(raiz, quien);
    if (!a) return;
    var d = DESTELLOS[principal](typeof v === 'object' ? '' : v);
    var n = document.createElement('div');
    n.className = 'est-destello';
    n.setAttribute('aria-hidden', 'true');
    n.textContent = d[0] + (d[1] ? ' ' + d[1] : '');
    a.caja.appendChild(n);
    setTimeout(function () { if (n.parentNode) n.remove(); }, 1500);
    if (principal === 'dano_directo' && window.RetoSprites) window.RetoSprites.estado(raiz, 'rival', 'herido', 900);
  }

  /* El NUMERO que sale JUNTO AL HP de quien cambia de vida: naranja si pierde vida (cualquier jugador, en la aventura o en
     un duelo) y verde SOLO si la gana (curacion de un power up). Mismo tamaño de letra que el HP (se copia de el) y va
     dentro del mismo bloque, asi que hereda su escala si el HP se escala en el editor de layout.
     tipo: 'dano' | 'cura'.  transcurrido: ms ya pasados (para seguir la animacion tras volver a pintar la pantalla). */
  var DURACION_NUM = 1500;
  function numeroJunto(hpEl, texto, tipo, transcurrido) {
    if (!hpEl || !hpEl.parentNode) return null;
    transcurrido = transcurrido || 0;
    if (transcurrido >= DURACION_NUM) return null;
    var padre = hpEl.parentNode;
    var viejos = padre.querySelectorAll(':scope > .num-hp');
    for (var k = 0; k < viejos.length; k++) viejos[k].remove();
    var n = document.createElement('span');
    n.className = 'num-hp num-hp--' + (tipo === 'cura' ? 'cura' : 'dano');
    n.setAttribute('aria-hidden', 'true');
    n.textContent = texto;
    n.style.fontSize = window.getComputedStyle(hpEl).fontSize;                // IGUAL que el HP
    if (transcurrido) n.style.animationDelay = '-' + transcurrido + 'ms';
    // En una fila de vida (flex) va antes del numero del HP; en una linea de texto, al final (antes de las etiquetas de estados).
    if (padre.classList.contains('hud-hp-num-rpg1') || padre.classList.contains('escena-hp')) padre.insertBefore(n, padre.firstChild);
    else {
      var host = padre.querySelector(':scope > [data-estados]');
      if (host) padre.insertBefore(n, host); else padre.appendChild(n);
    }
    setTimeout(function () { if (n.parentNode) n.remove(); }, DURACION_NUM - transcurrido);
    return n;
  }

  window.RetoEstados = { pintar: pintar, activar: activar, numeroJunto: numeroJunto, DURACION_NUM: DURACION_NUM, TIPOS: TIPOS };
}());
