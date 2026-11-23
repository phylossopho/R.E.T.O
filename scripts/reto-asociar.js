/* =========================================================================
   R.E.T.O. - Asociar (la pantalla)

   QUÉ ES
   Otra manera de contestar un test: en vez de responder pregunta por pregunta,
   se UNEN con líneas las preguntas con sus respuestas. Lee los mismos tests
   del banco que "Resolver test" (no crea nada nuevo en el gestor) y lo que se
   contesta entra al mismo registro de repaso.

   EL RECORRIDO
     Elegir un test  →  Unir (con las líneas)  →  Resultado

   DECISIONES DE DISEÑO (y por qué)
   - SIN RELOJ, igual que "Resolver" (PROPUESTA 5.2, WCAG 2.2.1).
   - CADA UNIÓN TIENE SU LÍNEA, y la línea no depende solo del color: lleva un
     PATRÓN (continua, rayada, punteada…) y una LETRA en sus dos extremos. Así
     se siguen aunque no se distingan los colores. Hay una paleta pensada para
     daltonismo y otra de un solo color, que se distingue solo por patrón y letra.
   - SE UNE CON UN TOQUE: tocar una ficha y luego su pareja (en cualquier orden).
     Con mouse también se arrastra. Con teclado: Tab para moverse, Enter o
     espacio para elegir, Supr o Retroceso para quitar una línea, Escape para
     soltar la elección. Arrastrar nunca es la única manera: hace falta
     destreza que no todas las personas tienen (WCAG 2.5.7).
   - EL ERROR NO ENSEÑA LA RESPUESTA (PROPUESTA 4.4), como en "Resolver": al
     fallar se abre "Mira esto" con el contexto o, en las dinámicas, la fórmula con
     los números de esa pregunta y su resultado. Al cerrarlo se sigue.
   - DOS MANERAS DE REVISAR (se elige en los ajustes):
       al unir     cada unión se califica en el momento. Una buena se queda y
                   se bloquea; una mala abre "Mira esto" y la línea se quita
                   (esa pregunta cuenta como fallada, aunque luego se acierte).
       al final    las líneas se mueven libremente y se califica todo junto con
                   el botón "Revisar", que se activa cuando todas están unidas.
   - LAS VARIANTES SE CAMBIAN EN SUS AJUSTES (el botón del panel): qué se asocia
     (pregunta con respuesta, o pregunta con tema), por dónde empezar, los
     distractores, cuántas parejas y cuándo se revisa. Valen desde la ronda
     siguiente: no se puede cambiar el juego con la ronda a medias.
   - TODO LO QUE SE VE LLEVA UN TEXTO. Ningún estado depende del color: un
     acierto lleva "Bien" y un visto; un fallo, "Falló" y una cruz.
   ========================================================================= */
(function () {
  'use strict';

  var Muestra = window.RetoTestsMuestra;
  var icono = Muestra.icono;
  var Aj = window.RetoTestsAjustes;
  var Lista = window.RetoTestsLista;
  var Banco = window.RetoTestsBanco;
  var Logica = window.RetoAsociarLogica;
  var Datos = window.RetoDatos;

  var PREFIJO = 'asociar-';

  var FABRICA = {
    variante: 'clasica',     // clasica | tema
    sentido: 'pq',           // pq (empezar por las preguntas) | rp (por las respuestas)
    distractores: 'off',
    extras: '2',
    parejas: '5',
    cuales: 'prioridad',     // prioridad | azar | orden (como en "Resolver")
    revision: 'unir',        // unir | final
    paleta: 'vivos',
    patrones: 'on',
    letras: 'on'
  };

  /* Los colores de las líneas. Van sobre el fondo del tema (claro u oscuro), así
     que son tonos medios que se ven en los dos, y cada línea se dibuja con un
     contorno del color del fondo para que dos que se cruzan no se confundan.

     "vivos": colores claramente distintos entre sí.
     "daltonismo": parte de la paleta Okabe-Ito, pensada para distinguirse con
       las formas más comunes de daltonismo.
     "uno": sin colores: todas del color del texto. Se distinguen solo por
       patrón y letra. Para quien los colores distraen más de lo que ayudan. */
  var PALETAS = {
    vivos: {
      nombre: 'Colores vivos',
      colores: ['#e4572e', '#2e86de', '#2fb36d', '#b04fd3', '#f2a900', '#e0408a', '#16a8b8', '#8a6d3b']
    },
    daltonismo: {
      nombre: 'Para daltonismo',
      colores: ['#d55e00', '#0072b2', '#009e73', '#cc79a7', '#e69f00', '#56b4e9', '#8f8f00', '#5c5c5c']
    },
    uno: { nombre: 'Un solo color', colores: null }
  };

  /* El patrón de cada línea (stroke-dasharray). La primera es continua. */
  var PATRONES = ['', '12 7', '2 7', '14 6 3 6', '7 4', '1 6', '18 7 4 7', '4 4 14 4'];

  var LETRAS_LINEA = 'ABCDEFGH';

  var CUALES = [
    ['prioridad', 'Las que más me conviene repasar'],
    ['azar', 'Al azar'],
    ['orden', 'En el orden del test']
  ];

  var ajustes = {};
  var tests = [];
  var resumenes = {};
  var test = null;
  var ronda = null;            // lo que arma la lógica
  var modo = 'unir';           // cómo se revisa ESTA ronda (los ajustes valen para la siguiente)
  var enlaces = {};            // { claveDePregunta: claveDeRespuesta }
  var fijados = {};            // (al unir) preguntas ya acertadas y bloqueadas
  var fallas = {};             // (al unir) { qid: { rKey, texto } } primer fallo de cada pregunta
  var seleccion = null;        // { lado, key } ficha elegida, esperando su pareja
  var estadosPrevios = {};
  var pendientes = [];
  var resultados = [];
  var estado = 'elegir';       // elegir | jugando | resultado
  var tablero = null;          // el tablero que se está dibujando
  var modalAbierto = null;
  var listaCtl = null;
  var dlgAjustes = null;

  var raiz, estadoEl, cabEl, cabOriginal;

  /* ---------------------------------------------------------- utilidades */

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function limpiar(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function decir(t) { if (estadoEl) estadoEl.textContent = t || ''; }
  function norma(t) { return String(t || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  function boton(texto, iconoId, clase, alClick) {
    var b = el('button', 'boton ' + (clase || ''));
    b.type = 'button';
    if (iconoId) b.insertAdjacentHTML('afterbegin', icono(iconoId));
    b.appendChild(document.createTextNode(texto));
    if (alClick) b.addEventListener('click', alClick);
    return b;
  }

  function parrafos(contenedor, texto) {
    String(texto || '').split(/\n+/).forEach(function (linea) {
      if (linea.trim()) contenedor.appendChild(el('p', null, linea));
    });
  }

  function barajar(lista) {
    var s = lista.slice();
    for (var i = s.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = s[i]; s[i] = s[j]; s[j] = t;
    }
    return s;
  }

  function ajustesTests() { return Aj ? Aj.valores() : {}; }

  /* Un texto legible (negro o blanco) sobre un color de fondo, por luminancia
     relativa: la misma cuenta que usan las pautas de contraste. */
  function textoSobre(hex) {
    var n = parseInt(hex.slice(1), 16);
    function canal(c) {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    var l = 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
    return l > 0.4 ? '#14151d' : '#ffffff';
  }

  function colorLinea(idx) {
    var p = PALETAS[ajustes.paleta] || PALETAS.vivos;
    return p.colores ? p.colores[idx % p.colores.length] : null;
  }

  function patronLinea(idx) {
    return ajustes.patrones === 'on' ? PATRONES[idx % PATRONES.length] : '';
  }

  function cancelarVoz() { if (Aj) Aj.callar(); }

  /* LA CABECERA dice qué test es, como en "Resolver". */
  function titularCabecera(prefijo, titulo) {
    if (!cabEl) return;
    limpiar(cabEl);
    if (!prefijo) {
      cabEl.textContent = cabOriginal;
      cabEl.removeAttribute('title');
      document.title = cabOriginal;
      return;
    }
    cabEl.appendChild(el('span', 'tst-cab-pre', prefijo));
    cabEl.appendChild(document.createTextNode('\u00AB' + titulo + '\u00BB'));
    cabEl.setAttribute('title', prefijo + '\u00AB' + titulo + '\u00BB');
    document.title = prefijo + '\u00AB' + titulo + '\u00BB';
  }

  function mostrar(cual, titulo) {
    estado = cual;
    cancelarVoz();
    /* Mientras se une se usa la misma cabecera compacta que la pantalla de la
       pregunta en "Resolver" (70_tests.css la reconoce por este valor). */
    document.documentElement.setAttribute('data-tst-vista', cual === 'jugando' ? 'pregunta' : cual);
    limpiar(raiz);
    var sec = el('section', 'tst-vista');
    sec.id = 'v-' + cual;
    var h = el('h2', cual === 'jugando' ? 'oculto-a-la-vista' : null, titulo);
    h.tabIndex = -1;
    sec.appendChild(h);
    raiz.appendChild(sec);
    tablero = null;
    return { sec: sec, h: h };
  }

  function enfocar(v) {
    v.h.focus();
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------- ajustes */

  function cargarAjustes() {
    return Promise.all(Object.keys(FABRICA).map(function (clave) {
      return Datos.obtener(PREFIJO + clave).then(function (v) {
        ajustes[clave] = (v === null || v === undefined) ? FABRICA[clave] : String(v);
      });
    }));
  }

  function guardarAjuste(clave, valor) {
    ajustes[clave] = valor;
    return Datos.poner(PREFIJO + clave, valor);
  }

  function config(sobre) {
    var c = {
      parejas: Number(ajustes.parejas),
      variante: ajustes.variante === 'tema' ? 'tema' : 'clasica',
      sentido: ajustes.sentido === 'rp' ? 'rp' : 'pq',
      distractores: ajustes.distractores === 'on',
      extras: Number(ajustes.extras)
    };
    if (sobre) Object.keys(sobre).forEach(function (k) { c[k] = sobre[k]; });
    return c;
  }

  /* ============================================================ EL TABLERO

     Dos columnas de fichas y, entre ellas, un SVG donde se dibujan las líneas.
     Es una sola pieza que sirve para el juego y para el cuadrito de muestra del
     modal de ajustes: lo que se ve en el cuadrito es lo que se ve jugando.

     `d` trae todo lo que cambia entre uno y otro, como funciones, para que el
     tablero no sepa nada del juego:
       izq, der        las fichas de cada columna: { key, texto, pregunta, idx }
       enlaces()       [{ p, r, idx }]: las uniones de ahora
       etiqueta(key)   { texto, tipo } o null: "Bien", "Falló"…
       bloqueada(key)  ¿ya no se puede tocar?
       seleccion()     { lado, key } o null
       interactivo     false en el cuadrito de muestra
       alTocar(lado, key), alQuitar(lado, key), alUnir(lado1, key1, lado2, key2)
     Devuelve { pintar, lineas }. */
  function montarTablero(cont, d) {
    var NS = 'http://www.w3.org/2000/svg';
    limpiar(cont);
    cont.classList.add('aso-tablero');

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'aso-lineas');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    cont.appendChild(svg);

    var colIzq = el('ul', 'aso-col');
    colIzq.setAttribute('data-lado', 'izq');
    var medio = el('div', 'aso-medio');
    medio.setAttribute('aria-hidden', 'true');
    var colDer = el('ul', 'aso-col');
    colDer.setAttribute('data-lado', 'der');
    cont.appendChild(colIzq);
    cont.appendChild(medio);
    cont.appendChild(colDer);

    var arrastre = null;
    var lineaTemp = null;
    var ignorarClic = false;

    function ficha(lado, it) {
      return cont.querySelector('.aso-item[data-key="' + it.key + '"]');
    }

    function letraDe(idx) { return LETRAS_LINEA.charAt(idx % LETRAS_LINEA.length); }

    function marca(idx) {
      var m = el('span', 'aso-letra', ajustes.letras === 'on' ? letraDe(idx) : '');
      var c = colorLinea(idx);
      if (c) { m.style.background = c; m.style.color = textoSobre(c); m.style.borderColor = textoSobre(c); }
      m.setAttribute('data-patron', ajustes.patrones === 'on' ? String(idx % PATRONES.length) : '');
      return m;
    }

    function pintarFicha(lado, it, uniones) {
      var li = el('li', 'aso-fila');
      li.setAttribute('data-lado', lado);
      var b = el('button', 'aso-item');
      b.type = 'button';
      b.setAttribute('data-lado', lado);
      b.setAttribute('data-key', it.key);

      var etiqueta = d.etiqueta ? d.etiqueta(it.key) : null;
      var sel = d.seleccion ? d.seleccion() : null;
      var bloqueada = d.bloqueada ? d.bloqueada(it.key) : false;
      var unidas = [];

      var marcas = el('span', 'aso-marcas');
      marcas.setAttribute('aria-hidden', 'true');
      if (it.pregunta) {
        marcas.appendChild(marca(it.idx));
        unidas = uniones.filter(function (u) { return u.p === it.key; });
      } else {
        uniones.filter(function (u) { return u.r === it.key; }).forEach(function (u) {
          unidas.push(u);
          marcas.appendChild(marca(u.idx));
        });
      }

      var texto = el('span', 'aso-texto', it.texto);
      b.appendChild(texto);
      b.appendChild(marcas);
      if (etiqueta) {
        var tag = el('span', 'aso-etiqueta');
        tag.setAttribute('data-tipo', etiqueta.tipo);
        tag.insertAdjacentHTML('afterbegin', icono(etiqueta.tipo === 'bien' ? 'visto' : 'cruz'));
        tag.appendChild(document.createTextNode(etiqueta.texto));
        b.appendChild(tag);
      }

      /* Lo que oye quien no ve: qué es la ficha, con qué está unida. */
      var nombre = it.pregunta ? ('Pregunta ' + letraDe(it.idx) + ': ') : 'Respuesta: ';
      var dicho = nombre + it.texto + '.';
      if (it.pregunta) {
        if (unidas.length) {
          var otra = d.textoDe ? d.textoDe(unidas[0].r) : '';
          dicho += ' Unida con: ' + otra + '.';
        } else dicho += ' Sin unir.';
      } else if (unidas.length) {
        dicho += ' Unida con ' + unidas.map(function (u) { return 'la pregunta ' + letraDe(u.idx); }).join(' y ') + '.';
      }
      if (etiqueta) dicho += ' ' + etiqueta.texto + '.';
      b.setAttribute('aria-label', dicho);

      var elegida = !!sel && sel.key === it.key;
      b.setAttribute('aria-pressed', elegida ? 'true' : 'false');
      if (elegida) b.classList.add('aso-item--elegida');
      if (unidas.length) b.classList.add('aso-item--unida');
      if (bloqueada) { b.setAttribute('aria-disabled', 'true'); b.classList.add('aso-item--bloqueada'); }
      if (!d.interactivo) b.tabIndex = -1;

      /* El icono de escuchar va por fuera de la ficha, del lado de afuera: así
         no se mete entre la ficha y su línea. */
      var oir = null;
      if (d.interactivo && ajustesTests().escuchar === 'on') {
        oir = el('button', 'boton tst-escuchar-opcion aso-escuchar');
        oir.type = 'button';
        oir.insertAdjacentHTML('afterbegin', icono('sonido'));
        oir.setAttribute('aria-label', 'Escuchar: ' + it.texto);
        oir.addEventListener('click', function () {
          if (!Aj.hablar(it.texto)) decir('Este aparato no tiene voz para leer en voz alta.');
        });
      }
      if (oir && lado === 'izq') li.appendChild(oir);
      li.appendChild(b);
      if (oir && lado === 'der') li.appendChild(oir);
      return li;
    }

    function pintar() {
      var activo = document.activeElement;
      var recordar = activo && cont.contains(activo) && activo.getAttribute ? activo.getAttribute('data-key') : null;
      var uniones = d.enlaces();
      limpiar(colIzq);
      limpiar(colDer);
      d.izq.forEach(function (it) { colIzq.appendChild(pintarFicha('izq', it, uniones)); });
      d.der.forEach(function (it) { colDer.appendChild(pintarFicha('der', it, uniones)); });
      if (recordar) {
        var b = cont.querySelector('.aso-item[data-key="' + recordar + '"]');
        if (b) b.focus();
      }
      lineas();
    }

    /* Las líneas: una curva de la ficha de un lado a la del otro. Cada una se
       dibuja dos veces: primero una más gruesa del color del fondo (el
       contorno) y encima la de color, con su patrón. En cada extremo, un punto. */
    function anclas(ficha1, ficha2, caja) {
      var a = ficha1.getBoundingClientRect();
      var b = ficha2.getBoundingClientRect();
      var izq = a.left < b.left ? a : b;
      var der = a.left < b.left ? b : a;
      return {
        x1: izq.right - caja.left, y1: izq.top + izq.height / 2 - caja.top,
        x2: der.left - caja.left, y2: der.top + der.height / 2 - caja.top
      };
    }

    function curva(x1, y1, x2, y2) {
      var dx = Math.max(24, (x2 - x1) * 0.5);
      return 'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ' ' + (x2 - dx) + ' ' + y2 + ' ' + x2 + ' ' + y2;
    }

    function dibujarLinea(p, idx) {
      var color = colorLinea(idx) || 'currentColor';
      var fondo = document.createElementNS(NS, 'path');
      fondo.setAttribute('d', p);
      fondo.setAttribute('class', 'aso-linea-fondo');
      var linea = document.createElementNS(NS, 'path');
      linea.setAttribute('d', p);
      linea.setAttribute('class', 'aso-linea');
      linea.setAttribute('stroke', color);
      var patron = patronLinea(idx);
      if (patron) linea.setAttribute('stroke-dasharray', patron);
      svg.appendChild(fondo);
      svg.appendChild(linea);
      return color;
    }

    function punto(x, y, color) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x);
      c.setAttribute('cy', y);
      c.setAttribute('r', 5);
      c.setAttribute('class', 'aso-punto');
      c.setAttribute('fill', color);
      svg.appendChild(c);
    }

    function lineas() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var caja = cont.getBoundingClientRect();
      svg.setAttribute('viewBox', '0 0 ' + Math.max(1, caja.width) + ' ' + Math.max(1, caja.height));
      d.enlaces().forEach(function (u) {
        var f1 = cont.querySelector('.aso-item[data-key="' + u.p + '"]');
        var f2 = cont.querySelector('.aso-item[data-key="' + u.r + '"]');
        if (!f1 || !f2) return;
        var a = anclas(f1, f2, caja);
        var color = dibujarLinea(curva(a.x1, a.y1, a.x2, a.y2), u.idx);
        punto(a.x1, a.y1, color);
        punto(a.x2, a.y2, color);
      });
    }

    /* ------------------------------------------------ teclado y toques */

    function columnaDe(lado) { return lado === 'izq' ? colIzq : colDer; }

    function moverFoco(b, dir) {
      var lado = b.getAttribute('data-lado');
      var propios = Array.prototype.slice.call(columnaDe(lado).querySelectorAll('.aso-item'));
      var i = propios.indexOf(b);
      var destino = null;
      if (dir === 'abajo') destino = propios[i + 1];
      else if (dir === 'arriba') destino = propios[i - 1];
      else {
        var otros = Array.prototype.slice.call(columnaDe(lado === 'izq' ? 'der' : 'izq').querySelectorAll('.aso-item'));
        if ((dir === 'derecha' && lado === 'izq') || (dir === 'izquierda' && lado === 'der')) {
          destino = otros[Math.min(i, otros.length - 1)];
        }
      }
      if (destino) destino.focus();
    }

    if (d.interactivo) {
      cont.addEventListener('click', function (ev) {
        if (ignorarClic) { ignorarClic = false; return; }
        var b = ev.target.closest ? ev.target.closest('.aso-item') : null;
        if (!b || !cont.contains(b)) return;
        d.alTocar(b.getAttribute('data-lado'), b.getAttribute('data-key'));
      });

      cont.addEventListener('keydown', function (ev) {
        var b = ev.target.closest ? ev.target.closest('.aso-item') : null;
        if (!b) return;
        var tecla = ev.key;
        if (tecla === 'Delete' || tecla === 'Backspace') {
          ev.preventDefault();
          d.alQuitar(b.getAttribute('data-lado'), b.getAttribute('data-key'));
        } else if (tecla === 'Escape') {
          if (d.seleccion && d.seleccion()) { ev.preventDefault(); d.alSoltar(); }
        } else if (tecla === 'ArrowDown') { ev.preventDefault(); moverFoco(b, 'abajo'); }
        else if (tecla === 'ArrowUp') { ev.preventDefault(); moverFoco(b, 'arriba'); }
        else if (tecla === 'ArrowRight') { ev.preventDefault(); moverFoco(b, 'derecha'); }
        else if (tecla === 'ArrowLeft') { ev.preventDefault(); moverFoco(b, 'izquierda'); }
      });

      /* ARRASTRAR, solo con mouse o lápiz. Con el dedo, arrastrar sobre las
         fichas movería la página, y quien usa el dedo ya tiene "tocar y tocar".
         Pasa de arrastre solo después de moverse unos píxeles: un clic normal
         sigue siendo un clic. */
      cont.addEventListener('pointerdown', function (ev) {
        if (ev.pointerType === 'touch' || ev.button !== 0) return;
        var b = ev.target.closest ? ev.target.closest('.aso-item') : null;
        if (!b || b.getAttribute('aria-disabled') === 'true') return;
        arrastre = { lado: b.getAttribute('data-lado'), key: b.getAttribute('data-key'), x: ev.clientX, y: ev.clientY, activo: false, ficha: b };
      });

      document.addEventListener('pointermove', function (ev) {
        if (!arrastre) return;
        if (!arrastre.activo) {
          if (Math.abs(ev.clientX - arrastre.x) + Math.abs(ev.clientY - arrastre.y) < 8) return;
          arrastre.activo = true;
          cont.classList.add('aso-arrastrando');
          lineaTemp = document.createElementNS(NS, 'path');
          lineaTemp.setAttribute('class', 'aso-linea-temp');
          svg.appendChild(lineaTemp);
        }
        var caja = cont.getBoundingClientRect();
        var r = arrastre.ficha.getBoundingClientRect();
        var x1 = (arrastre.lado === 'izq' ? r.right : r.left) - caja.left;
        var y1 = r.top + r.height / 2 - caja.top;
        var x2 = ev.clientX - caja.left;
        var y2 = ev.clientY - caja.top;
        lineaTemp.setAttribute('d', x1 <= x2 ? curva(x1, y1, x2, y2) : curva(x2, y2, x1, y1));
      });

      document.addEventListener('pointerup', function (ev) {
        if (!arrastre) return;
        var a = arrastre;
        arrastre = null;
        cont.classList.remove('aso-arrastrando');
        if (lineaTemp && lineaTemp.parentNode) lineaTemp.parentNode.removeChild(lineaTemp);
        lineaTemp = null;
        if (!a.activo) return;
        ignorarClic = true;             // el clic que sigue al soltar no cuenta
        window.setTimeout(function () { ignorarClic = false; }, 0);
        var sobre = document.elementFromPoint(ev.clientX, ev.clientY);
        var b = sobre && sobre.closest ? sobre.closest('.aso-item') : null;
        if (b && cont.contains(b) && b.getAttribute('data-lado') !== a.lado) {
          d.alUnir(a.lado, a.key, b.getAttribute('data-lado'), b.getAttribute('data-key'));
        }
      });
    }

    /* Las líneas dependen de dónde quedó cada ficha: se vuelven a calcular
       cuando cambia el tamaño del tablero (la ventana, la letra, la fuente). */
    if (window.ResizeObserver) {
      var obs = new window.ResizeObserver(function () { lineas(); });
      obs.observe(cont);
    } else {
      window.addEventListener('resize', lineas);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { lineas(); });

    return { pintar: pintar, lineas: lineas };
  }

  /* ========================================================= ELEGIR TEST */

  function tarjetaAsociar(t, ctx) {
    var a = el('a', 'tarjeta tarjeta-nav tst-tarjeta');
    a.href = '#' + t.id;
    a.insertAdjacentHTML('afterbegin', Muestra.iconoTarjeta(t.materia));
    a.appendChild(el('strong', 'tarjeta-titulo', t.titulo));
    if (t.descripcion) a.appendChild(el('span', 'tarjeta-texto', t.descripcion));
    var meta = el('span', 'tst-tarjeta-meta');
    meta.appendChild(document.createTextNode(
      (ctx.plano ? t.materia + ' · ' : '') +
      (t.preguntas.length === 1 ? '1 pregunta' : t.preguntas.length + ' preguntas')));
    meta.appendChild(Lista.etiquetaTipo(Lista.tipoDeTest(t)));
    a.appendChild(meta);
    a.appendChild(el('span', 'tst-tarjeta-hecho', ctx.hace));
    var repasar = ctx.resumen && ctx.resumen.por_repasar > 0 ? ctx.resumen.por_repasar : 0;
    if (repasar) {
      var rr = el('span', 'tst-tarjeta-repasar');
      rr.insertAdjacentHTML('afterbegin', icono('dinamica'));
      rr.appendChild(document.createTextNode(repasar + ' por repasar'));
      a.appendChild(rr);
    }
    var go = el('span', 'tst-empezar', 'Empezar');
    go.insertAdjacentHTML('beforeend', icono('flecha'));
    a.appendChild(go);
    a.setAttribute('aria-label', 'Asociar el test ' + t.titulo + '. ' +
      (t.preguntas.length === 1 ? '1 pregunta' : t.preguntas.length + ' preguntas') + '. ' + ctx.hace + '.' +
      (repasar ? ' ' + repasar + ' por repasar.' : ''));
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      empezar(t, null, null);
    });
    return a;
  }

  function bancoVacio() {
    var c = el('div');
    c.appendChild(el('p', null, 'Todavía no hay tests. Créalos en "Gestionar banco de tests", o carga unos de ejemplo para probar.'));
    var fila = el('div', 'tst-acciones');
    fila.appendChild(boton('Cargar tests de ejemplo', 'mas', 'boton--chico', function () {
      Banco.ejemplos().then(function () { pantallaElegir(); }, function (e) { decir(e.message); });
    }));
    var a = el('a', 'boton boton--chico', 'Ir a Gestionar banco de tests');
    a.href = '../crud-tests/crud-tests.html';
    fila.appendChild(a);
    c.appendChild(fila);
    return c;
  }

  function pantallaElegir() {
    cancelarVoz();
    titularCabecera(null);
    var v = mostrar('elegir', 'Elige un test');
    decir('');
    v.sec.appendChild(el('p', null, 'Une cada pregunta con su pareja. Sin reloj y sin prisa: elige un tema y hazlo a tu ritmo.'));
    var cont = el('div');
    v.sec.appendChild(cont);
    enfocar(v);
    Banco.cargar().then(function (lista) {
      tests = lista;
      listaCtl = Lista.montar({
        contenedor: cont,
        prefijo: 'aso',
        tests: function () { return tests; },
        tarjeta: tarjetaAsociar,
        resumenes: function () { return resumenes; },
        vacio: bancoVacio
      });
      return Banco.resumenes(tests).then(function (r) {
        resumenes = r || {};
        if (estado === 'elegir' && listaCtl) listaCtl.repintar();
      }).catch(function () {
        resumenes = {};
        if (estado === 'elegir' && listaCtl) listaCtl.repintar();
      });
    }).catch(function (e) { decir(e.message); });
  }

  /* ======================================================== ARMAR LA RONDA */

  /* `ids` (opcional) limita a esas preguntas (para "repetir las que fallé").
     Las preguntas las ordena el servidor por prioridad de repaso, como en
     "Resolver"; si no contesta, se usa un orden al azar y se juega igual. */
  function empezar(t, ids) {
    var porId = {};
    t.preguntas.forEach(function (p) { porId[p.id] = p; });
    var jugables = t.preguntas.filter(function (p) {
      return Banco.jugable(p) && (!ids || ids.indexOf(p.id) >= 0);
    });
    if (jugables.length < 2) {
      decir('Para asociar hacen falta al menos 2 preguntas en el test.');
      return;
    }
    var cuantas = ids ? Math.max(2, Math.min(8, ids.length)) : Number(ajustes.parejas);
    var pedir = Math.min(jugables.length, cuantas + 4);   // de sobra: algunas se descartan
    Promise.all([
      Banco.ronda(t, ids, pedir, ids ? 'azar' : ajustes.cuales).catch(function () { return null; }),
      Banco.estados(t.id).catch(function () { return {}; })
    ]).then(function (g) {
      var r = g[0];
      var cands = r && r.preguntas
        ? r.preguntas.map(function (it) { return porId[it.id]; }).filter(Boolean)
        : barajar(jugables);
      if (cands.length < 2) cands = barajar(jugables);
      var armada = Logica.armarRonda(cands, config({ parejas: cuantas }), { evaluador: window.RetoTestsEval });
      if (!armada) {
        decir('No se pudo armar una ronda con las preguntas de este test.');
        return;
      }
      test = t;
      ronda = armada;
      modo = ajustes.revision === 'final' ? 'final' : 'unir';
      enlaces = {};
      fijados = {};
      fallas = {};
      seleccion = null;
      estadosPrevios = g[1] || {};
      pendientes = [];
      resultados = [];
      titularCabecera('Asociando el test ', t.titulo);
      pantallaJuego();
    }).catch(function (e) { decir(e.message); });
  }

  /* =========================================================== EL JUEGO */

  function unoAUno() { return ronda.variante !== 'tema'; }

  function preguntaPorKey(key) {
    for (var i = 0; i < ronda.preguntas.length; i++) if (ronda.preguntas[i].key === key) return ronda.preguntas[i];
    return null;
  }

  function textoDeRespuesta(key) {
    var r = Logica.respuestaPorKey(ronda, key);
    return r ? r.texto : '';
  }

  function listaEnlaces() {
    return Object.keys(enlaces).map(function (pKey) {
      var pg = preguntaPorKey(pKey);
      return { p: pKey, r: enlaces[pKey], idx: pg ? pg.idx : 0 };
    });
  }

  function esDePregunta(key) { return key.charAt(0) === 'p'; }

  /* Las fichas de cada columna, según por dónde se empieza. */
  function columnas() {
    var preg = ronda.preguntas.map(function (pg) {
      return { key: pg.key, texto: pg.q.enunciado, pregunta: true, idx: pg.idx };
    });
    var resp = ronda.respuestas.map(function (r) {
      return { key: r.key, texto: r.texto, pregunta: false, idx: 0 };
    });
    return ronda.sentido === 'rp' ? { izq: resp, der: preg } : { izq: preg, der: resp };
  }

  function instruccion() {
    var t;
    if (ronda.variante === 'tema') {
      t = 'Une cada pregunta con el tema al que pertenece. Varias preguntas pueden ir al mismo tema.';
    } else if (ronda.sentido === 'rp') {
      t = 'Une cada respuesta con la pregunta a la que responde.';
    } else {
      t = 'Une cada pregunta con su respuesta.';
    }
    if (ronda.respuestas.some(function (r) { return r.tipo === 'extra'; })) {
      t += ' Algunas respuestas sobran: no todas tienen pareja.';
    }
    return t + ' Toca una ficha y luego su pareja' +
      (modo === 'final' ? '. Cuando todas estén unidas, revisa.' : '. Si aciertas, la unión se queda.');
  }

  function unidas() {
    return modo === 'unir' ? Object.keys(fijados).length : Object.keys(enlaces).length;
  }

  function pintarContador() {
    var c = document.getElementById('aso-contador');
    if (!c) return;
    var n = ronda.preguntas.length;
    var u = modo === 'unir' ? Object.keys(fijados).length : Object.keys(enlaces).length;
    c.textContent = (modo === 'unir' ? 'Acertadas: ' : 'Unidas: ') + u + ' de ' + n + '.';
    var rev = document.getElementById('aso-revisar');
    if (rev) rev.disabled = !Logica.completa(ronda, enlaces);
  }

  function pantallaJuego() {
    var v = mostrar('jugando', 'Une las parejas');
    decir('');
    var col = el('div', 'aso-juego');
    v.sec.appendChild(col);
    col.appendChild(el('p', 'aso-instruccion', instruccion()));

    var cont = el('div');
    cont.id = 'aso-tablero';
    col.appendChild(cont);

    var c = el('p', 'aso-contador');
    c.id = 'aso-contador';
    col.appendChild(c);

    var acc = el('div', 'tst-acciones');
    if (modo === 'final') {
      var rev = boton('Revisar', 'flecha', 'boton--principal', finalizar);
      rev.id = 'aso-revisar';
      rev.disabled = true;
      acc.appendChild(rev);
      acc.appendChild(boton('Quitar todas las líneas', 'dinamica', '', function () {
        enlaces = {};
        seleccion = null;
        refrescar();
        decir('Se quitaron todas las líneas.');
      }));
    } else {
      acc.appendChild(boton('Terminar y ver el resultado', 'flecha', '', finalizar));
    }
    col.appendChild(acc);

    var cols = columnas();
    tablero = montarTablero(cont, {
      izq: cols.izq,
      der: cols.der,
      interactivo: true,
      enlaces: listaEnlaces,
      textoDe: textoDeRespuesta,
      seleccion: function () { return seleccion; },
      bloqueada: bloqueada,
      etiqueta: function (key) {
        if (!esDePregunta(key)) return null;
        var pg = preguntaPorKey(key);
        if (modo === 'unir' && fijados[key] && !fallas[pg.qid]) return { texto: 'Bien', tipo: 'bien' };
        if (modo === 'unir' && fallas[pg.qid] && !fijados[key]) return { texto: 'Falló, intenta otra vez', tipo: 'mal' };
        if (modo === 'unir' && fijados[key]) return { texto: 'Unida (había fallado antes)', tipo: 'bien' };
        return null;
      },
      alTocar: tocar,
      alQuitar: quitarFicha,
      alSoltar: function () { seleccion = null; refrescar(); decir('Se soltó la ficha.'); },
      alUnir: function (l1, k1, l2, k2) {
        seleccion = null;
        unirPar(esDePregunta(k1) ? k1 : k2, esDePregunta(k1) ? k2 : k1);
      }
    });
    tablero.pintar();
    pintarContador();
    enfocar(v);
    window.requestAnimationFrame(function () { if (tablero) tablero.lineas(); });
  }

  function refrescar() {
    if (tablero) tablero.pintar();
    pintarContador();
  }

  function fichaPorKey(key) {
    var cols = columnas();
    var todas = cols.izq.concat(cols.der);
    for (var i = 0; i < todas.length; i++) if (todas[i].key === key) return todas[i];
    return null;
  }

  function bloqueada(key) {
    if (modo !== 'unir') return false;
    if (esDePregunta(key)) return !!fijados[key];
    return unoAUno() && Object.keys(enlaces).some(function (k) { return enlaces[k] === key; });
  }

  function leerFicha(it) {
    if (ajustesTests().leerSola === 'on' && it) Aj.hablar(it.texto);
  }

  /* Tocar una ficha. Con una ya elegida del OTRO lado, se unen; con una del
     mismo lado, se cambia la elección; tocar la misma la suelta. */
  function tocar(lado, key) {
    if (estado !== 'jugando' || modalAbierto) return;
    if (bloqueada(key)) { decir('Esa ya está unida y no se mueve.'); return; }
    var it = fichaPorKey(key);
    if (!seleccion) {
      seleccion = { lado: lado, key: key };
      refrescar();
      decir('Elegiste: ' + it.texto + '. Ahora toca su pareja.');
      leerFicha(it);
      return;
    }
    if (seleccion.key === key) {
      seleccion = null;
      refrescar();
      decir('Se soltó la ficha.');
      return;
    }
    if (seleccion.lado === lado) {
      seleccion = { lado: lado, key: key };
      refrescar();
      decir('Elegiste: ' + it.texto + '. Ahora toca su pareja.');
      leerFicha(it);
      return;
    }
    var otra = seleccion.key;
    seleccion = null;
    unirPar(esDePregunta(key) ? key : otra, esDePregunta(key) ? otra : key);
  }

  function quitarFicha(lado, key) {
    if (estado !== 'jugando' || modalAbierto) return;
    if (modo === 'unir') { decir('En este modo las uniones correctas se quedan.'); return; }
    if (!Object.keys(enlaces).some(function (k) { return k === key || enlaces[k] === key; })) return;
    enlaces = Logica.quitar(enlaces, key);
    refrescar();
    decir('Se quitó la línea.');
  }

  function unirPar(pKey, rKey) {
    if (bloqueada(pKey) || bloqueada(rKey)) return;
    var pg = preguntaPorKey(pKey);
    if (modo === 'final') {
      enlaces = Logica.enlazar(enlaces, pKey, rKey, unoAUno());
      refrescar();
      decir('Uniste la pregunta ' + LETRAS_LINEA.charAt(pg.idx) + ' con: ' + textoDeRespuesta(rKey) + '.');
      return;
    }
    /* Se califica al instante. */
    if (rKey === pg.correctaKey) {
      enlaces = Logica.enlazar(enlaces, pKey, rKey, unoAUno());
      fijados[pKey] = true;
      if (Aj) Aj.sonarAcierto();
      refrescar();
      decir('Bien: la pregunta ' + LETRAS_LINEA.charAt(pg.idx) + ' quedó unida.');
      if (Object.keys(fijados).length === ronda.preguntas.length) {
        window.setTimeout(finalizar, 700);
      }
      return;
    }
    if (!fallas[pg.qid]) fallas[pg.qid] = { rKey: rKey, texto: textoDeRespuesta(rKey) };
    refrescar();
    decir('Esa unión no es. Mira esto antes de seguir.');
    abrirMira(pg, textoDeRespuesta(rKey), function () { refrescar(); });
  }

  /* ----------------------------------------------------- "Mira esto" */

  /* Lo mismo que en "Resolver": no se dice cuál era la pareja; se enseña qué
     mirar. Con números que cambian, la fórmula, la fórmula con los números de esa
     pregunta y el resultado. */
  function contenidoMira(pg, eleccion) {
    var q = pg.q;
    var caja = document.createDocumentFragment();
    caja.appendChild(el('p', 'tst-enunciado', q.enunciado));
    var opcion = null;
    q.opciones.forEach(function (o) {
      if (!o.correcta && eleccion && norma(o.texto) === norma(eleccion)) opcion = o;
    });
    if (q.tipo === 'dinamica' && q.explicacion) {
      caja.appendChild(el('p', null, 'Aquí está la fórmula, con los números de esta pregunta.'));
      caja.appendChild(Muestra.explicacion(q.explicacion));
    } else if (q.contexto) {
      caja.appendChild(el('p', null, 'Esto te puede ayudar a recordar. Léelo con calma.'));
      var tmp = el('div');
      parrafos(tmp, q.contexto);
      while (tmp.firstChild) caja.appendChild(tmp.firstChild);
    } else {
      caja.appendChild(el('p', null, 'Piensa otra vez en esta pregunta y en lo que ya sabes de ella.'));
    }
    return caja;
  }

  function abrirMira(pg, eleccion, alCerrar) {
    var d = document.createElement('dialog');
    d.className = 'dialogo tst-modal';
    d.setAttribute('aria-labelledby', 'aso-mira-titulo');
    var h = el('h2', 'dialogo-titulo', 'Mira esto antes de seguir');
    h.id = 'aso-mira-titulo';
    h.tabIndex = -1;
    d.appendChild(h);
    d.appendChild(contenidoMira(pg, eleccion));
    var acc = el('div', 'dialogo-acciones');
    acc.appendChild(boton('Entendido, seguir', 'flecha', 'boton--principal', function () { d.close(); }));
    d.appendChild(acc);
    d.addEventListener('close', function () {
      if (d.parentNode) d.parentNode.removeChild(d);
      modalAbierto = null;
      if (alCerrar) alCerrar();
    });
    document.body.appendChild(d);
    modalAbierto = d;
    d.showModal();
    h.focus();
  }

  /* ============================================================ EL FINAL */

  function anotar(f) {
    var id = test.id;
    pendientes.push(Banco.registrarIntento(id, {
      ts: Date.now(), qid: f.pg.qid, acierto: f.acierto, seguridad: null,
      clase: f.clase, eleccion: f.eleccion
    }).catch(function () {}));
    pendientes.push(Banco.registrarRespuesta(id, f.pg.qid, estadosPrevios[f.pg.qid], f.acierto, null).catch(function (e) {
      decir('No se pudo anotar una respuesta: ' + e.message);
    }));
  }

  function finalizar() {
    if (estado !== 'jugando') return;
    var filas;
    if (modo === 'unir') {
      filas = ronda.preguntas.map(function (pg) {
        var f = fallas[pg.qid];
        if (fijados[pg.key] && !f) {
          return { pg: pg, acierto: true, eleccion: textoDeRespuesta(pg.correctaKey), clase: 'dominada' };
        }
        return {
          pg: pg, acierto: false, eleccion: f ? f.texto : '',
          clase: f ? Logica.clasificar(ronda, pg.key, f.rKey) : 'repasar'
        };
      });
    } else {
      filas = Logica.calificar(ronda, enlaces).map(function (c) {
        return { pg: preguntaPorKey(c.key), acierto: c.acierto, eleccion: c.eleccion, clase: c.clase };
      });
    }
    resultados = filas;
    filas.forEach(anotar);
    pantallaResultado();
  }

  function temasParaRepasar() {
    var cuenta = {};
    var orden = [];
    resultados.filter(function (r) { return !r.acierto; }).forEach(function (r) {
      var k = Lista.rutaDeTema(r.pg.q.tema).join(', ');
      if (!k) return;
      if (!cuenta[k]) { cuenta[k] = 0; orden.push(k); }
      cuenta[k]++;
    });
    return orden.map(function (k) { return { ruta: k, n: cuenta[k] }; });
  }

  function pantallaResultado() {
    var v = mostrar('resultado', 'Terminaste');
    titularCabecera('Resultado de asociar ', test.titulo);
    Datos.poner('tests-hecho-' + test.id, Date.now());
    decir('');
    var aciertos = resultados.filter(function (r) { return r.acierto; }).length;
    var total = resultados.length;

    var col = el('div', 'tst-columna aso-resultado');
    v.sec.appendChild(col);
    col.appendChild(el('p', 'tst-enunciado', 'Acertaste ' + aciertos + ' de ' + total + ' parejas.'));
    col.appendChild(el('p', null, aciertos === total
      ? 'Las uniste todas bien. Para fijarlo, vuelve a intentarlo otro día.'
      : 'Lo que falló te dice qué mirar. No es una nota: es un mapa de lo que conviene repasar.'));

    /* Los tests tambien dan power ups (cada 10 aciertos acumulados, maximo 10 al dia). Una sola vez por ronda. */
    if (window.RetoRpg && !resultados._premiado) {
      resultados._premiado = true;
      window.RetoRpg.mostrarPremiosDeTest(col, aciertos);
    }

    var ol = el('ol', 'aso-resumen');
    resultados.forEach(function (r) {
      var li = el('li', 'aso-resumen-fila');
      li.setAttribute('data-acierto', r.acierto ? 'si' : 'no');
      var cab = el('p', 'aso-resumen-cab');
      cab.appendChild(el('strong', null, LETRAS_LINEA.charAt(r.pg.idx) + '. '));
      cab.appendChild(document.createTextNode(r.pg.q.enunciado));
      li.appendChild(cab);
      var est = el('p', 'aso-resumen-estado');
      est.insertAdjacentHTML('afterbegin', icono(r.acierto ? 'visto' : 'cruz'));
      est.appendChild(document.createTextNode(r.acierto
        ? 'Bien'
        : (r.eleccion ? 'Falló. La uniste con: \u00AB' + r.eleccion + '\u00BB' : 'Falló: no quedó unida')));
      li.appendChild(est);
      if (!r.acierto) {
        var det = el('details', 'aso-detalle');
        det.appendChild(el('summary', null, 'Mira esto'));
        det.appendChild(contenidoMira(r.pg, r.eleccion));
        li.appendChild(det);
      }
      ol.appendChild(li);
    });
    col.appendChild(ol);

    var repasar = temasParaRepasar();
    if (repasar.length) {
      col.appendChild(el('p', 'tst-prep-sub', 'Temas que conviene repasar:'));
      var ul = el('ul', 'tst-prep-temas');
      repasar.forEach(function (x) {
        ul.appendChild(el('li', null, x.ruta + ' (' + x.n + (x.n === 1 ? ' pregunta)' : ' preguntas)')));
      });
      col.appendChild(ul);
    }
    col.appendChild(el('p', 'ayuda', 'Tus respuestas se guardaron: lo que fallaste vuelve pronto y lo que dominas se va espaciando.'));

    var acc = el('div', 'tst-acciones');
    var fallos = resultados.filter(function (r) { return !r.acierto; });
    if (fallos.length) {
      acc.appendChild(boton('Repetir solo las que fallé', 'dinamica', 'boton--principal', function () {
        var ids = fallos.map(function (r) { return r.pg.qid; });
        var t = test;
        Promise.all(pendientes).then(function () { empezar(t, ids); }, function () { empezar(t, ids); });
      }));
    }
    acc.appendChild(boton('Hacer otra ronda', 'dinamica', fallos.length ? '' : 'boton--principal', function () {
      var t = test;
      Promise.all(pendientes).then(function () { return Banco.resumenes([t]); }).then(function (r) {
        resumenes[t.id] = r[t.id] || resumenes[t.id];
        empezar(t, null);
      }, function () { empezar(t, null); });
    }));
    acc.appendChild(boton('Elegir otro test', 'lista', '', pantallaElegir));
    col.appendChild(acc);
    enfocar(v);
  }

  /* ==================================================== MODAL DE AJUSTES

     El del botón del panel. Trae sus propios ajustes (la variante, las
     parejas, la revisión y las líneas) y, abajo, los atajos a los ajustes de
     lectura y sonido que ya comparten todos los tests, para no tener dos
     lugares donde cambiar lo mismo.

     Se arma de nuevo cada vez que se abre, para que sus controles reflejen
     siempre lo que está guardado. */

  function grupo(dlg, legenda, ayuda) {
    var fs = document.createElement('fieldset');
    fs.appendChild(el('legend', null, legenda));
    if (ayuda) fs.appendChild(el('p', 'ayuda', ayuda));
    dlg.appendChild(fs);
    return fs;
  }

  function opcionRadio(nombre, valor, texto, elegido, alCambiar) {
    var op = el('label', 'opcion');
    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = nombre;
    radio.value = valor;
    if (valor === elegido) radio.checked = true;
    radio.addEventListener('change', function () { if (this.checked) alCambiar(valor); });
    op.appendChild(radio);
    op.appendChild(el('span', null, texto));
    return op;
  }

  function grupoRadios(nombre, lista, elegido, alCambiar) {
    var caja = el('div', 'opciones');
    caja.setAttribute('role', 'radiogroup');
    lista.forEach(function (par) { caja.appendChild(opcionRadio(nombre, par[0], par[1], elegido, alCambiar)); });
    return caja;
  }

  function interruptor(clave, texto, explicacion, alCambiar) {
    var label = el('label', 'interruptor');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = ajustes[clave] === 'on';
    var caja = el('span', 'interruptor-caja');
    caja.setAttribute('aria-hidden', 'true');
    var rotulo = el('span', 'interruptor-texto', texto);
    rotulo.appendChild(el('span', 'ayuda', explicacion));
    input.addEventListener('change', function () {
      var v = this.checked ? 'on' : 'off';
      guardarAjuste(clave, v).then(function () { if (alCambiar) alCambiar(v); });
    });
    label.appendChild(input);
    label.appendChild(caja);
    label.appendChild(rotulo);
    return label;
  }

  /* El cuadrito de muestra: tres preguntas y tres respuestas con sus líneas, con
     la paleta, los patrones y las letras que haya elegidos. */
  var MUESTRA_PREG = ['7 × 8', '9 × 6', '5 × 5'];
  var MUESTRA_RESP = ['54', '25', '56'];
  var MUESTRA_UNION = [['p0', 'r2', 0], ['p1', 'r0', 1], ['p2', 'r1', 2]];

  function pintarMuestra() {
    if (!dlgAjustes) return;
    var caja = dlgAjustes.querySelector('.aso-muestra');
    if (!caja) return;
    var cont = el('div');
    caja.appendChild(cont);
    while (caja.firstChild !== cont) caja.removeChild(caja.firstChild);
    var preg = MUESTRA_PREG.map(function (t, i) { return { key: 'p' + i, texto: t, pregunta: true, idx: i }; });
    var resp = MUESTRA_RESP.map(function (t, i) { return { key: 'r' + i, texto: t, pregunta: false, idx: 0 }; });
    dlgAjustes.__muestra = montarTablero(cont, {
      izq: preg,
      der: resp,
      interactivo: false,
      enlaces: function () { return MUESTRA_UNION.map(function (u) { return { p: u[0], r: u[1], idx: u[2] }; }); },
      textoDe: function (key) { return MUESTRA_RESP[Number(key.slice(1))]; }
    });
    dlgAjustes.__muestra.pintar();
    window.requestAnimationFrame(function () { if (dlgAjustes && dlgAjustes.__muestra) dlgAjustes.__muestra.lineas(); });
  }

  function alCambiarLineas() {
    pintarMuestra();
    if (estado === 'jugando' && tablero) refrescar();
  }

  function visibilidad() {
    if (!dlgAjustes) return;
    var tema = ajustes.variante === 'tema';
    Array.prototype.forEach.call(dlgAjustes.querySelectorAll('[data-solo-clasica]'), function (g) { g.hidden = tema; });
    var ex = dlgAjustes.querySelector('[data-extras]');
    if (ex) ex.hidden = tema || ajustes.distractores !== 'on';
  }

  function abrirAjustes() {
    if (dlgAjustes) return;
    cancelarVoz();
    var dlg = document.createElement('dialog');
    dlg.className = 'dialogo aso-config';
    dlg.setAttribute('aria-labelledby', 'aso-cfg-titulo');
    dlgAjustes = dlg;

    var titulo = el('h2', 'dialogo-titulo', 'Ajustes de Asociar');
    titulo.id = 'aso-cfg-titulo';
    dlg.appendChild(titulo);
    var muestra = el('div', 'aso-muestra');
    muestra.setAttribute('role', 'img');
    muestra.setAttribute('aria-label', 'Muestra: tres preguntas unidas con tres respuestas por líneas de distinto color y patrón.');
    dlg.appendChild(muestra);

    /* --- qué se asocia */
    var gVar = grupo(dlg, 'Qué se asocia',
      'Pregunta con respuesta, o pregunta con el tema al que pertenece. Los temas salen de los niveles del test; si un test no los tiene, se juega pregunta con respuesta.');
    gVar.appendChild(grupoRadios('aso-variante', [
      ['clasica', 'Pregunta con su respuesta'],
      ['tema', 'Pregunta con su tema']
    ], ajustes.variante, function (v) { guardarAjuste('variante', v).then(visibilidad); }));

    var gSent = grupo(dlg, 'Por dónde empezar',
      'Con las preguntas a la izquierda, se busca su respuesta. Con las respuestas a la izquierda, se busca a qué pregunta responde cada una.');
    gSent.setAttribute('data-solo-clasica', '1');
    gSent.appendChild(grupoRadios('aso-sentido', [
      ['pq', 'Las preguntas'],
      ['rp', 'Las respuestas']
    ], ajustes.sentido, function (v) { guardarAjuste('sentido', v); }));

    var gDis = grupo(dlg, 'Respuestas de más',
      'Entran respuestas incorrectas que no tienen pareja. En las preguntas con números que cambian son los errores típicos de la cuenta.');
    gDis.setAttribute('data-solo-clasica', '1');
    gDis.appendChild(interruptor('distractores', 'Agregar respuestas que sobran',
      'Para no unir por descarte.', visibilidad));
    var ex = grupoRadios('aso-extras', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], ajustes.extras,
      function (v) { guardarAjuste('extras', v); });
    ex.setAttribute('data-extras', '1');
    gDis.appendChild(el('p', 'editor-label', 'Cuántas sobran'));
    gDis.appendChild(ex);

    /* --- cuántas */
    var gPar = grupo(dlg, 'Cuántas parejas',
      'Por ronda. Con más parejas hay más líneas que seguir.');
    gPar.appendChild(grupoRadios('aso-parejas',
      ['3', '4', '5', '6', '7', '8'].map(function (n) { return [n, n]; }),
      ajustes.parejas, function (v) { guardarAjuste('parejas', v); }));

    var gCual = grupo(dlg, 'Cuáles preguntas', 'De las del test.');
    gCual.appendChild(grupoRadios('aso-cuales', CUALES, ajustes.cuales, function (v) { guardarAjuste('cuales', v); }));

    /* --- cuándo se revisa */
    var gRev = grupo(dlg, 'Cuándo se revisa',
      'Al unir: cada unión se califica en el momento, y si aciertas se queda. Al final: mueves las líneas cuanto quieras y se califica todo junto con "Revisar".');
    gRev.appendChild(grupoRadios('aso-revision', [
      ['unir', 'Al unir cada pareja'],
      ['final', 'Al final, todas juntas']
    ], ajustes.revision, function (v) { guardarAjuste('revision', v); }));
    gRev.appendChild(el('p', 'ayuda', 'Estos cambios valen desde la siguiente ronda.'));

    /* --- las líneas */
    var gLin = grupo(dlg, 'Las líneas',
      'Cada pareja tiene su línea. Para que el color no sea la única pista, cada una lleva su patrón y su letra.');
    gLin.appendChild(grupoRadios('aso-paleta',
      Object.keys(PALETAS).map(function (k) { return [k, PALETAS[k].nombre]; }),
      ajustes.paleta, function (v) { guardarAjuste('paleta', v).then(alCambiarLineas); }));
    gLin.appendChild(interruptor('patrones', 'Patrón en cada línea',
      'Continua, rayada, punteada… Una línea se reconoce aunque no se distinga su color.', alCambiarLineas));
    gLin.appendChild(interruptor('letras', 'Letra en cada pregunta y su pareja',
      'A, B, C… en los dos extremos de la línea.', alCambiarLineas));

    /* --- lo compartido con los demás tests */
    var gMas = grupo(dlg, 'Letra, voz y sonido',
      'Son los mismos ajustes de todos los tests: el tamaño y la fuente de la letra, escuchar en voz alta y el sonido.');
    var filaMas = el('div', 'tst-acciones');
    filaMas.appendChild(boton('Ajustes de lectura y de sonido', 'lista', 'boton--chico', function () {
      dlg.close();
      if (Aj) Aj.abrir('general');
    }));
    filaMas.appendChild(boton('Cómo se ve la lista de tests', 'lista', 'boton--chico', function () {
      dlg.close();
      if (Aj) Aj.abrir('lista');
    }));
    gMas.appendChild(filaMas);

    var acciones = el('div', 'dialogo-acciones');
    var listo = el('button', 'boton boton--principal', 'Listo');
    listo.type = 'button';
    listo.addEventListener('click', function () { dlg.close(); });
    acciones.appendChild(listo);
    dlg.appendChild(acciones);

    dlg.addEventListener('close', function () {
      if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
      dlgAjustes = null;
      if (estado === 'jugando' && tablero) refrescar();
    });
    document.body.appendChild(dlg);
    visibilidad();
    dlg.showModal();
    pintarMuestra();
    var primero = dlg.querySelector('input, button');
    if (primero) primero.focus();
  }

  /* ================================================================ ARRANQUE */

  function iniciar() {
    raiz = document.getElementById('vistas');
    estadoEl = document.getElementById('estado');
    cabEl = document.querySelector('header h1');
    cabOriginal = cabEl ? cabEl.textContent : '';
    if (!raiz || !window.RetoDialogo || !Muestra || !Lista || !Banco || !Logica || !Datos) return;

    var listos = [cargarAjustes()];
    if (Aj) {
      listos.push(Aj.iniciar({
        resolver: false,
        alCambiar: function (clave) {
          if (estado === 'elegir') { if (listaCtl) listaCtl.repintar(); }
          else if (estado === 'jugando' && tablero) refrescar();
        }
      }));
    }
    var cfg = document.querySelector('[data-configurar]');
    if (cfg) cfg.addEventListener('click', abrirAjustes);

    var ayuda = document.querySelector('[data-ayuda]');
    if (ayuda) {
      ayuda.addEventListener('click', function () {
        window.RetoDialogo.informar({
          titulo: 'Cómo se asocia',
          texto: 'Elige un test. Verás preguntas de un lado y respuestas del otro: une cada pregunta con su pareja. ' +
            'No hay reloj.\n\n' +
            'Toca una ficha y luego su pareja, en cualquier orden. Con mouse también puedes arrastrar de una a otra. ' +
            'Con el teclado: Tab para moverte, Enter o espacio para elegir, Supr o Retroceso para quitar una línea y ' +
            'Escape para soltar la ficha.\n\n' +
            'Cada pareja tiene su línea, de otro color, con su patrón y su letra para reconocerla aunque no distingas los colores.\n\n' +
            'Si fallas, no se te dice cuál era: se te enseña qué mirar. Tus respuestas se guardan, y lo que fallas vuelve pronto.\n\n' +
            'En los ajustes (la rueda) eliges qué se asocia, cuántas parejas hay, si sobran respuestas, cuándo se revisa y cómo se ven las líneas.'
        });
      });
    }
    Promise.all(listos).then(function () {
      if (window.RetoSonido && window.RetoSonido.precargar) window.RetoSonido.precargar();
      pantallaElegir();
    }).catch(function (e) { decir(e.message); });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
