/* =========================================================================
   R.E.T.O. - Los sonidos del sitio

   -------------------------------------------------------------------------
   QUÉ ES
   El módulo que sabe hacer sonar los avisos del sitio. Antes esto vivía
   escrito dentro de configuracion-sonido.html, y por eso no lo usaba nadie
   más: una función que está pegada en el HTML de una página solo existe en esa
   página. Aquí vive en un archivo y lo carga quien lo necesite.

   -------------------------------------------------------------------------
   POR QUE ESTA RUTA DE LOS ARCHIVOS SE CALCULA Y NO SE ESCRIBE
   Este archivo está en /scripts/, y cada sonido en /sonidos/. La distancia
   entre las dos carpetas cambia según la página: desde la portada es
   "sonidos/...", y desde categorias/mini-juegos/schulte/ tendría que ser
   "../../../sonidos/...".

   La versión que estaba dentro de la página de configuración usaba
   "sonidos/ding-sound-effect_1.mp3", y funcionaba SOLO en esa página, porque
   está en la raíz. Cualquier otra página habría buscado los sonidos en una
   carpeta que no existe y no habría sonado nada. Es la razón real de que el
   sonido no se compartiera.

   Aquí la ruta sale del propio archivo: se toma la dirección de este script y
   se le quita "scripts/reto-sonido.js". Con eso da igual desde qué página se
   llame, y si el sitio se mueve de carpeta, sigue bien.

   -------------------------------------------------------------------------
   QUIÉN MANDA: EL SONIDO GENERAL DEL SITIO
   Estos sonidos NUNCA suenan si en Configuración → Sonido está apagado. No hay
   forma de saltarse esa preferencia desde un juego, y a propósito: si cada
   página pudiera sonar por su cuenta, el interruptor general sería mentira.

   Un juego puede tener SU interruptor (porque sus sonidos son distintos), pero
   ese interruptor solo decide si este juego quiere sonar, no si puede. Con el
   sonido general apagado, el juego se calla igual.
   ========================================================================= */
(function () {
  'use strict';

  /* ------------------------------------------------------- dónde estamos */

  /* La raíz del sitio, deducida de la dirección de ESTE archivo. Es la misma
     variable en todas las páginas, y no hay que mantener una lista de
     "../" según la profundidad. */
  var raiz = (function () {
    var aqui = document.currentScript && document.currentScript.src;
    if (!aqui) return '';
    /* "http://sitio/scripts/reto-sonido.js" -> "http://sitio/"
       Se quita el archivo y la carpeta. Se hace con cadena y no con URL para
       que funcione igual en navegadores viejos, y porque el resultado es
       exactamente lo que queremos: un prefijo de texto. */
    return aqui.replace(/\/scripts\/[^/]*$/, '/');
  })();

  /* Los tres sonidos que hay. Los mismos archivos, y los mismos nombres, que
     usaba la página de configuración: no se agrega ninguno nuevo. */
  var TIPOS = {
    ding: 'sonidos/ding-sound-effect_1.mp3',
    charm: 'sonidos/Charm.mp3',
    soft: 'sonidos/better_soft_notificati.mp3'
  };

  var CLAVES = { sonidoActivado: 'sonido_activado',
                 sonidoVolumen: 'sonido_volumen',
                 sonidoTipo: 'sonido_tipo' };

  /* El sonido ya creado, para no crear uno nuevo en cada aviso. Un <audio>
     que se crea y se tira necesita descargar el archivo antes de sonar, y en
     una red lenta eso se nota: el primer aviso tarda y los siguientes no. */
  var cache = {};

  function audioDe(clave) {
    var tipo = TIPOS[clave] ? clave : 'ding';
    if (!cache[tipo]) {
      cache[tipo] = new Audio(raiz + TIPOS[tipo]);
      cache[tipo].preload = 'auto';
    }
    return cache[tipo];
  }

  /* ------------------------------------------------------- las preferencias */

  /* Lo que la persona eligió, leído del almacenamiento. Se lee cada vez, y no
     se guarda en una variable, porque el sonido puede cambiarse en otra
     pestaña: si esta guardara el valor, seguiría sonando después de que la
     otra apagara el sonido general. */
  function preferencias() {
    var volumen = parseInt(localStorage.getItem(CLAVES.sonidoVolumen) || '50', 10);
    if (isNaN(volumen)) volumen = 50;
    return {
      activado: localStorage.getItem(CLAVES.sonidoActivado) !== 'off',
      volumen: Math.min(100, Math.max(0, volumen)) / 100,
      tipo: localStorage.getItem(CLAVES.sonidoTipo) || 'ding'
    };
  }

  /* --------------------------------------------------------------- sonar */

  /* Reproduce un sonido.
     Devuelve si sonó o no, para que quien llama pueda enterarse sin tener que
     adivinarlo.

     `volumen` es opcional y va de 0 a 1. Si un juego tiene su propio volumen
     (como la tabla de Schulte, que ofrece cuatro pasos), lo pasa aquí y ESTE
     valor manda sobre el del sitio. **No se multiplican**: multiplicar el
     volumen del juego por el general da números que nadie entiende (la mitad
     de la mitad es un doce por ciento, y no hay forma de pedirlo). Lo que SÍ
     manda del sitio es el interruptor general, porque un volumen del sitio
     apagado tiene que callar todo.

     Nunca lanza. Un sonido que falla (el navegador lo bloquea porque no hubo
     interacción, el archivo no cargó) no puede romper lo que estaba pasando:
     como mucho no se oye. */
  function reproducir(clave, volumenElegido) {
    var prefs = preferencias();
    if (!prefs.activado) return false;
    var volumen = (volumenElegido === undefined || volumenElegido === null)
      ? prefs.volumen
      : volumenElegido;
    if (volumen <= 0) return false;
    try {
      var audio = audioDe(clave);
      audio.volume = Math.min(1, volumen);
      /* Volver al principio: si el mismo aviso se repite rápido, sin esto se
         oye a media reproducción y parece que no sonó. */
      audio.currentTime = 0;
      var promesa = audio.play();
      if (promesa && promesa.catch) {
        promesa.catch(function () { /* el navegador lo bloqueó: no es un fallo */ });
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /* --------------------------------------- la página de configuración

     Todo lo que la página de Configuración → Sonido hacía con sus controles
     estaba escrito dentro de su HTML. Eso son dos problemas: el HTML mezcla
     contenido con comportamiento, y esta lógica no se puede probar ni reusar.
     Aquí queda, y la página solo llama.

     Se devuelve lo que ya se estaba guardando en el navegador, sin cambiar ni
     una clave: los que ya eligieron algo antes lo siguen teniendo. */
  function conectarConfiguracion() {
    var casilla = document.getElementById('sonido-activado');
    var rango = document.getElementById('sonido-volumen');
    var valor = document.getElementById('sonido-volumen-valor');
    var casillas = document.querySelectorAll('input[name="sonido-tipo"]');
    var botones = document.querySelectorAll('[data-probar-sonido]');
    if (!casilla || !rango) return;

    /* Lo guardado manda sobre lo que trae el HTML. */
    if (localStorage.getItem(CLAVES.sonidoActivado) !== null) {
      casilla.checked = preferencias().activado;
    }
    if (localStorage.getItem(CLAVES.sonidoVolumen) !== null) {
      rango.value = String(Math.round(preferencias().volumen * 100));
      if (valor) valor.textContent = rango.value + '%';
    }
    var guardadoTipo = localStorage.getItem(CLAVES.sonidoTipo);
    if (guardadoTipo) {
      for (var i = 0; i < casillas.length; i++) {
        if (casillas[i].value === guardadoTipo) casillas[i].checked = true;
      }
    }

    casilla.addEventListener('change', function () {
      localStorage.setItem(CLAVES.sonidoActivado, this.checked ? 'on' : 'off');
    });

    /* El volumen se guarda mientras se arrastra y también al soltar. Antes
       solo se guardaba al soltar, y si la persona cierra la pestaña a media
       arrastre se perdía lo que había ajustado. */
    function guardarVolumen() {
      var v = parseInt(rango.value, 10);
      if (valor) valor.textContent = v + '%';
      localStorage.setItem(CLAVES.sonidoVolumen, String(v));
    }
    rango.addEventListener('input', guardarVolumen);
    rango.addEventListener('change', guardarVolumen);

    for (var j = 0; j < casillas.length; j++) {
      casillas[j].addEventListener('change', function () {
        localStorage.setItem(CLAVES.sonidoTipo, this.value);
      });
    }

    /* Los botones de "Probar" solo suenan si el interruptor está prendido, que
       es lo que hacía la página. */
    for (var k = 0; k < botones.length; k++) {
      botones[k].addEventListener('click', function () {
        if (casilla.checked) reproducir(this.getAttribute('data-probar-sonido'));
      });
    }

    /* Selector de voz en español */
    var selectVoz = document.getElementById('sonido-voz');
    var btnProbarVoz = document.getElementById('probar-voz');
    if (selectVoz && window.speechSynthesis) {
      function cargarVoces() {
        var voices = window.speechSynthesis.getVoices() || [];
        var vocesEspanol = voices.filter(function (v) {
          return v.lang && (v.lang.toLowerCase().indexOf('es') === 0 || v.lang.toLowerCase().indexOf('spanish') >= 0);
        });
        while (selectVoz.options.length > 1) {
          selectVoz.remove(1);
        }
        vocesEspanol.forEach(function (v) {
          var opt = document.createElement('option');
          opt.value = v.name;
          opt.textContent = v.name + ' (' + v.lang + ')';
          selectVoz.appendChild(opt);
        });
        var guardada = localStorage.getItem('voz_preferida');
        if (guardada) {
          selectVoz.value = guardada;
        }
      }
      cargarVoces();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = cargarVoces;
      }

      selectVoz.addEventListener('change', function () {
        localStorage.setItem('voz_preferida', this.value);
      });

      if (btnProbarVoz) {
        btnProbarVoz.addEventListener('click', function () {
          if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
          window.speechSynthesis.cancel();
          var dicho = new window.SpeechSynthesisUtterance('Esta es una prueba de la voz seleccionada en español.');
          dicho.lang = 'es';
          var vozElegida = selectVoz.value;
          if (vozElegida) {
            var voices = window.speechSynthesis.getVoices() || [];
            var v = voices.find(function (voice) { return voice.name === vozElegida || voice.voiceURI === vozElegida; });
            if (v) dicho.voice = v;
          }
          window.speechSynthesis.speak(dicho);
        });
      }
    }
  }

  window.RetoSonido = {
    tipos: TIPOS,
    reproducir: reproducir,
    preferencias: preferencias,
    conectarConfiguracion: conectarConfiguracion,
    /* Para una página que quiera que el primer aviso suene sin esperar la
       descarga. No se llama solo en todas las páginas a propósito: son tres
       archivos y no todas las necesitan. */
    precargar: function () { Object.keys(TIPOS).forEach(audioDe); }
  };

})(window);