/* =========================================================================
   R.E.T.O. - Las preferencias del panel, antes de pintar
   -------------------------------------------------------------------------
   Este archivo va en el <head> de las CINCO paginas que tienen panel
   (revision, edicion, textos, libros y la pantalla de lectura veloz), y SOLO
   de esas. No va en las otras porque alli no hay ningun panel que colocar, y
   meterlo en todas seria el mismo error de copiar codigo por pagina que ya se
   sufrio con el script del tema: veinte y una copias de lo mismo, y cambiar un
   ajuste obliga a editar veinte y una archivos.

   POR QUE ESTA EN EL HEAD Y NO AL FINAL DEL BODY
   Porque el panel esta fijo en una esquina de la pantalla. Si su posicion se
   aplicara despues de pintar, se veria un instante en la posicion vieja y luego
   saltaria a la nueva, y eso se lee como un fallo de la pagina, no como un
   ajuste que se acaba de mover.

   LO QUE HACE
   Lee cuatro cosas del almacenamiento del navegador y las escribe como atributos
   del <html>. El CSS las lee de ahi (posicion, tamano y transparencia), y
   reto-panel.js lee la espera.

   Por que atributos y no estilos en linea: los atributos los puede cambiar
   cualquier hoja de estilos, y se pueden escribir reglas con ellos; un valor
   suelto en el atributo "style" no se puede cambiar desde ninguna otra regla.
   La transparencia si va como variable de CSS, porque es un valor, no un modo.

   SI NO HAY NADA GUARDADO
   Se usan los valores de ahora, que son los que ya se veian antes de que
   existiera esta pagina: abajo, mediano, 9% y 2100 ms. Es decir, quien no ha
   tocado nada no ve ningun cambio. */
(function () {
  'use strict';

  var h = document.documentElement;
  var POR_DEFECTO = {
    pos: 'abajo',
    tam: 'mediano',
    op: 0.09,
    espera: 2100
  };

  var VALORES = {
    pos: ['abajo', 'arriba', 'izquierda', 'derecha'],
    tam: ['pequeno', 'mediano', 'grande'],
    animNivel: ['estandar', 'expresivo'],
    animHover: ['estandar', 'flotacion-3d', 'pulso-ludico'],
    animAccion: ['estandar', 'rebote'],
    animPanel: ['estandar', 'elastico', 'giro'],
    fondoEstilo: ['liso', 'puntos', 'diagonales']
  };

  function leer(clave, defecto) {
    try { return localStorage.getItem(clave); } catch (e) { return null; }
  }

  /* Un valor guardado que no este en la lista NO se aplica. No es desconfianza:
     es que un valor raro (una copia de una version vieja, o alguien que edito el
     almacenamiento a mano) pondria el panel en un sitio que no existe y el
     atributo no coincidiria con ninguna regla, asi que el panel se quedaria sin
     posicion. Con esta comprobacion, un valor desconocido es simplemente el
     de por defecto. */
  function unoDe(clave, lista, defecto) {
    var v = leer(clave);
    return lista.indexOf(v) >= 0 ? v : defecto;
  }

  var pos = unoDe('panel_pos', VALORES.pos, POR_DEFECTO.pos);
  var tam = unoDe('panel_tam', VALORES.tam, POR_DEFECTO.tam);
  var animNivel = unoDe('anim_nivel', VALORES.animNivel, 'estandar');
  var animHover = unoDe('anim_hover', VALORES.animHover, 'estandar');
  var animAccion = unoDe('anim_accion', VALORES.animAccion, 'estandar');
  var animPanel = unoDe('anim_panel', VALORES.animPanel, 'estandar');
  var fondoEstilo = unoDe('fondo_estilo', VALORES.fondoEstilo, 'liso');

  var op = parseFloat(leer('panel_op'));
  if (isNaN(op)) op = POR_DEFECTO.op;
  // Se limita entre 0.05 y 0.40. El minimo es para que el panel nunca llegue a
  // ser invisible del todo: con 0 sigue ahi y se puede tocar, pero quien no sepa
  // que esta ahi no lo encontraria, y en un celular no hay raton que lo despierte.
  op = Math.min(0.4, Math.max(0.05, op));

  var espera = parseInt(leer('panel_espera'), 10);
  if (isNaN(espera)) espera = POR_DEFECTO.espera;
  espera = Math.min(5000, Math.max(500, espera));

  h.setAttribute('data-panel-pos', pos);
  h.setAttribute('data-panel-tam', tam);
  h.setAttribute('data-panel-espera', String(espera));
  h.setAttribute('data-anim-nivel', animNivel);
  h.setAttribute('data-anim-hover', animHover);
  h.setAttribute('data-anim-accion', animAccion);
  h.setAttribute('data-anim-panel', animPanel);
  h.setAttribute('data-fondo', fondoEstilo);
  h.style.setProperty('--panel-op', String(op));
})();
