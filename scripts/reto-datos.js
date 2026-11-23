/* =========================================================================
   R.E.T.O. - Almacenamiento y respaldo
   -------------------------------------------------------------------------
   Donde viven los datos y por que:

   El sitio es estatico, sin servidor. Eso significa que los datos NO estan en
   Python ni en PythonAnywhere: estan dentro del navegador, en este
   computadora. Por eso la exportacion tiene que hacerse aqui, con JavaScript:
   es el unico sitio donde existe la informacion.

   Almost TODO va a IndexedDB: banco de tests, historial de respuestas, mapas,
   notas y el calendario de repasos. Soporta estructuras, es asincrono y su
   limite esta muy por encima de los ~5 MB de localStorage, que se quedarian
   cortos con los mapas mentales.

   LA EXCEPCION es el tema, que sigue en localStorage a proposito. El script que
   restaura el tema va en el <head> de cada pagina para que no haya destello
   entre que se carga el tema correcto y el que trae por defecto el HTML.
   localStorage es sincrono, asi que puede leerse ANTES de pintar; IndexedDB no,
   porque es asincrono. Un unico dato de arranque, el mas visible, y todo lo
   demas en IndexedDB.

   Si IndexedDB no esta disponible (por ejemplo abriendo el sitio con doble
   clic y el navegador lo bloquea en file://), el sistema cae a localStorage con
   la misma interfaz, para que la funcion no se quede sin hacer.
   ========================================================================= */
(function () {
  'use strict';

  var NOMBRE_DB = 'reto';
  var VERSION_ESQUEMA = 2;
  var CLAVE_TEMA = 'tema';

  /* ------------------------------------------------------------- promesa */

  function alRezar(p) {
    return p.catch(function (e) {
      throw e;
    });
  }

  /* ----------------------------------------------- IndexedDB y respaldo en
     localStorage con la misma interfaz. */

  var idb = {
    disponible: null,
    db: null,

    abrir: function () {
      if (idb.disponible !== null) {
        return Promise.resolve(idb.disponible ? idb.db : null);
      }
      if (typeof indexedDB === 'undefined' || !indexedDB) {
        idb.disponible = false;
        return Promise.resolve(null);
      }
      return new Promise(function (resolver) {
        var abrir = indexedDB.open(NOMBRE_DB, VERSION_ESQUEMA);
        var terminar = function (ok) {
          idb.disponible = ok;
          resolver(ok ? idb.db : null);
        };
        abrir.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains('preferencias')) {
            db.createObjectStore('preferencias', { keyPath: 'clave' });
          }
          if (!db.objectStoreNames.contains('libros')) {
            db.createObjectStore('libros', { keyPath: 'id' });
          }
        };
        abrir.onsuccess = function (e) { idb.db = e.target.result; terminar(true); };
        abrir.onerror = function () { terminar(false); };
        abrir.onblocked = function () { terminar(false); };
        setTimeout(function () { if (idb.disponible === null) terminar(false); }, 3000);
      });
    },

    almacenes: function () {
      return Array.prototype.slice.call(idb.db.objectStoreNames);
    },

    leer: function () {
      var db = idb.db;
      var nombres = idb.almacenes();
      if (nombres.length === 0) return Promise.resolve({});
      return Promise.all(nombres.map(function (n) {
        return new Promise(function (resolver) {
          var t = db.transaction(n, 'readonly').objectStore(n).getAll();
          t.onsuccess = function () { resolver([n, t.result || []]); };
          t.onerror = function () { resolver([n, []]); };
        });
      })).then(function (pares) {
        var salida = {};
        pares.forEach(function (p) { salida[p[0]] = p[1]; });
        return salida;
      });
    },

    escribir: function (datos) {
      var db = idb.db;
      var nombres = idb.almacenes();
      var pendientes = nombres.filter(function (n) { return datos[n] !== undefined; });
      if (pendientes.length === 0) return Promise.resolve();
      return new Promise(function (resolver, rechazar) {
        var tx = db.transaction(pendientes, 'readwrite');
        pendientes.forEach(function (n) {
          var alm = tx.objectStore(n);
          alm.clear();
          (datos[n] || []).forEach(function (registro) { alm.put(registro); });
        });
        tx.oncomplete = function () { resolver(); };
        tx.onerror = function () { rechazar(tx.error); };
        tx.onabort = function () { rechazar(tx.error); };
      });
    },

    vaciar: function () {
      var db = idb.db;
      var nombres = idb.almacenes();
      if (nombres.length === 0) return Promise.resolve();
      return new Promise(function (resolver) {
        var tx = db.transaction(nombres, 'readwrite');
        nombres.forEach(function (n) { tx.objectStore(n).clear(); });
        tx.oncomplete = function () { resolver(); };
        tx.onerror = function () { resolver(); };
      });
    }
  };

  /* ---------------------------------------------- respaldo en localStorage */

  var local = {
    LEER: function (clave) {
      try { return localStorage.getItem(clave); } catch (e) { return null; }
    },
    /* Devuelve true si pudo escribir y false si no (no cupo, o el navegador
       no deja guardar). */
    ESCRIBIR: function (clave, valor) {
      try { localStorage.setItem(clave, valor); return true; } catch (e) { return false; }
    }
  };

  var PREFIJO = 'reto_datos_';

  var respaldoLocal = {
    abrir: function () { return Promise.resolve(null); },
    leer: function () {
      var salida = {};
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(PREFIJO) === 0) {
            salida[k.slice(PREFIJO.length)] = localStorage.getItem(k);
          }
        }
      } catch (e) {}
      return Promise.resolve({ general: salida });
    },
    escribir: function (datos) {
      var g = datos.general || {};
      Object.keys(g).forEach(function (k) { local.ESCRIBIR(PREFIJO + k, g[k]); });
      return Promise.resolve();
    },
    vaciar: function () {
      try {
        var fuera = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(PREFIJO) === 0) fuera.push(k);
        }
        fuera.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) {}
      return Promise.resolve();
    }
  };

  /* -------------------------------------------------------------- publico */

  var motor = null;

  function usar() {
    return idb.abrir().catch(function () {
      idb.disponible = false;
      return null;
    }).then(function (db) {
      motor = db ? idb : respaldoLocal;
      if (!db && !avisoUnaVez) {
        avisoUnaVez = true;
        if (window.console && console.warn) {
          console.warn('[R.E.T.O.] IndexedDB no disponible; los datos se guardan en ' +
            'localStorage, que tiene bastante menos espacio.');
        }
      }
      return motor;
    });
  }

  var avisoUnaVez = false;

  function leerListaRespaldo(m, nombre) {
    var v = local.LEER(PREFIJO + nombre);
    if (!v) return [];
    try {
      var lista = JSON.parse(v);
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      return [];
    }
  }

  /* Lo que una tarjeta de la biblioteca necesita de un documento, y nada mas. */
  function ligero(d) {
    return {
      id: d.id, nombre: d.nombre, tipo: d.tipo, palabras: d.palabras,
      marca: d.marca, creado: d.creado, modificado: d.modificado,
      ligero: true
    };
  }

  var RetoDatos = {
    versionEsquema: VERSION_ESQUEMA,

    listo: function () { return usar(); },

    motor: function () {
      return motor ? (motor === idb ? 'IndexedDB' : 'localStorage') : 'sin iniciar';
    },

    poner: function (clave, valor) {
      return usar().then(function (m) {
        if (m === idb) {
          return new Promise(function (resolver, rechazar) {
            var tx = m.db.transaction('preferencias', 'readwrite');
            tx.objectStore('preferencias').put({ clave: clave, valor: valor });
            tx.oncomplete = function () { resolver(); };
            tx.onerror = function () { rechazar(tx.error); };
          });
        }
        local.ESCRIBIR(PREFIJO + clave, JSON.stringify(valor));
      });
    },

    obtener: function (clave) {
      return usar().then(function (m) {
        if (m === respaldoLocal) {
          var v = local.LEER(PREFIJO + clave);
          try { return v === null ? undefined : JSON.parse(v); } catch (e) { return undefined; }
        }
        return new Promise(function (resolver) {
          var t = m.db.transaction('preferencias', 'readonly')
                   .objectStore('preferencias').get(clave);
          t.onsuccess = function () { resolver(t.result ? t.result.valor : undefined); };
          t.onerror = function () { resolver(undefined); };
        });
      });
    },

    libros: {
      guardar: function (doc) {
        return usar().then(function (m) {
          if (m === respaldoLocal) {
            var lista = leerListaRespaldo(m, 'libros');
            var i = 0;
            while (i < lista.length && lista[i].id !== doc.id) i++;
            if (i < lista.length) lista[i] = doc; else lista.push(doc);
            
            // Aqui SI se avisa si no cupo en localStorage
            if (!local.ESCRIBIR(PREFIJO + 'libros', JSON.stringify(lista))) {
              var e = new Error('Este navegador no tiene sitio para guardarlo: esta usando el ' +
                'almacenamiento pequeño de respaldo (unos 5 MB), porque no puede usar el ' +
                'normal. Pasa en la navegación privada de algunos navegadores.');
              e.name = 'QuotaExceededError';
              throw e;
            }
            return;
          }
          return new Promise(function (resolver, rechazar) {
            var tx = m.db.transaction('libros', 'readwrite');
            tx.objectStore('libros').put(doc);
            tx.oncomplete = function () { resolver(); };
            tx.onerror = function () { rechazar(tx.error); };
            tx.onabort = function () { rechazar(tx.error); };
          });
        });
      },

      obtener: function (id) {
        return usar().then(function (m) {
          if (m === respaldoLocal) {
            var lista = leerListaRespaldo(m, 'libros');
            for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
            return undefined;
          }
          return new Promise(function (resolver) {
            var t = m.db.transaction('libros', 'readonly').objectStore('libros').get(id);
            t.onsuccess = function () { resolver(t.result); };
            t.onerror = function () { resolver(undefined); };
          });
        });
      },

      /* Lectura con CURSOR para no saturar memoria RAM en dispositivos moviles */
      listar: function (opciones) {
        var completo = !!(opciones && opciones.completo);
        return usar().then(function (m) {
          if (m === respaldoLocal) {
            var todos = leerListaRespaldo(m, 'libros');
            return completo ? todos : todos.map(ligero);
          }
          return new Promise(function (resolver) {
            var salida = [];
            var req = m.db.transaction('libros', 'readonly').objectStore('libros').openCursor();
            req.onsuccess = function () {
              var c = req.result;
              if (!c) { resolver(salida); return; }
              salida.push(completo ? c.value : ligero(c.value));
              c.continue();
            };
            req.onerror = function () { resolver(salida); };
          });
        });
      },

      borrar: function (id) {
        return usar().then(function (m) {
          if (m === respaldoLocal) {
            var lista = leerListaRespaldo(m, 'libros').filter(function (d) { return d.id !== id; });
            local.ESCRIBIR(PREFIJO + 'libros', JSON.stringify(lista));
            return;
          }
          return new Promise(function (resolver, rechazar) {
            var tx = m.db.transaction('libros', 'readwrite');
            tx.objectStore('libros').delete(id);
            tx.oncomplete = function () { resolver(); };
            tx.onerror = function () { rechazar(tx.error); };
          });
        });
      }
    },

    exportar: function () {
      return usar().then(function (m) {
        return m.leer().then(function (datos) {
          return {
            reto: VERSION_ESQUEMA,
            creado: new Date().toISOString(),
            guardadoEn: RetoDatos.motor(),
            tema: local.LEER(CLAVE_TEMA) || 'papel',
            datos: datos
          };
        });
      });
    },

    importar: function (respaldo) {
      if (!respaldo || typeof respaldo !== 'object') {
        return Promise.reject(new Error('El archivo no tiene un formato reconocible.'));
      }
      if (typeof respaldo.reto !== 'number') {
        return Promise.reject(new Error(
          'Este archivo no parece un respaldo de R.E.T.O. (falta el campo "reto").'));
      }
      if (respaldo.reto > VERSION_ESQUEMA) {
        return Promise.reject(new Error(
          'El respaldo es de una versión más nueva (' + respaldo.reto + ') que esta ' +
          'web (' + VERSION_ESQUEMA + '). Actualiza el sitio antes de restaurarlo.'));
      }
      if (!respaldo.datos || typeof respaldo.datos !== 'object') {
        return Promise.reject(new Error('El respaldo no trae datos.'));
      }
      return usar().then(function (m) {
        return m.vaciar().then(function () {
          return m.escribir(respaldo.datos);
        }).then(function () {
          if (respaldo.tema) local.ESCRIBIR(CLAVE_TEMA, respaldo.tema);
        });
      });
    }
  };

  function descargar(texto, nombre) {
    var blob = new Blob([texto], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function sello() {
    var d = new Date();
    var mes = String(d.getMonth() + 1);
    var dia = String(d.getDate());
    if (mes.length < 2) mes = '0' + mes;
    if (dia.length < 2) dia = '0' + dia;
    return d.getFullYear() + '-' + mes + '-' + dia;
  }

  function bonito(respaldo) {
    return JSON.stringify(respaldo, null, 2);
  }

  RetoDatos.descargarRespaldo = function () {
    return RetoDatos.exportar().then(function (r) {
      descargar(bonito(r), 'reto-respaldo-' + sello() + '.json');
      var cuantos = 0;
      Object.keys(r.datos).forEach(function (k) {
        cuantos += (r.datos[k] || []).length;
      });
      return { registros: cuantos, motor: r.guardadoEn };
    });
  };

  RetoDatos.restaurar = function (texto) {
    var respaldo;
    try {
      respaldo = JSON.parse(texto);
    } catch (e) {
      return Promise.reject(new Error('El archivo no es un JSON válido.'));
    }
    return RetoDatos.descargarRespaldo().then(function () {
      return RetoDatos.importar(respaldo);
    });
  };

  RetoDatos.conectar = function () {
    var btnGuardar = document.getElementById('datos-guardar');
    var btnRestaurar = document.getElementById('datos-restaurar');
    var archivo = document.getElementById('datos-archivo');
    var estado = document.getElementById('datos-estado');
    if (!btnGuardar || !btnRestaurar || !archivo || !estado) return;

    function avisar(texto, error) {
      estado.textContent = texto;
      estado.className = error ? 'datos-estado es-error' : 'datos-estado es-ok';
    }

    btnGuardar.addEventListener('click', function () {
      this.disabled = true;
      avisar('Preparando el respaldo…');
      RetoDatos.descargarRespaldo().then(function (r) {
        avisar('Listo: se descargó ' + r.registros + ' registro(s) desde ' + r.motor + '.');
      }).catch(function (e) {
        avisar('No se pudo generar el respaldo: ' + e.message, true);
      }).then(function () {
        btnGuardar.disabled = false;
      }, function () { btnGuardar.disabled = false; });
    });

    btnRestaurar.addEventListener('click', function () { archivo.click(); });

    archivo.addEventListener('change', function () {
      var f = archivo.files && archivo.files[0];
      if (!f) return;
      var lector = new FileReader();
      lector.onload = function () {
        var texto = String(lector.result || '');
        var ok = window.confirm(
          'Se va a REEMPLAZAR todo lo que hay ahora en este navegador.\n\n' +
          'Primero se descargará una copia de los datos actuales, por si acaso.\n' +
          'Archivo: ' + f.name + '\n\n¿Continuar?');
        if (!ok) { avisar('No se restauró nada.'); archivo.value = ''; return; }
        avisar('Guardando copia de seguridad…');
        RetoDatos.restaurar(texto).then(function () {
          avisar('Restaurado. Se recargará la página.');
          setTimeout(function () { location.reload(); }, 900);
        }).catch(function (e) {
          avisar('No se restauró: ' + e.message, true);
          archivo.value = '';
        });
      };
      lector.onerror = function () { avisar('No se pudo leer el archivo.', true); };
      lector.readAsText(f);
    });
  };

  window.RetoDatos = RetoDatos;

  document.addEventListener('DOMContentLoaded', function () {
    RetoDatos.conectar();
  });
})();