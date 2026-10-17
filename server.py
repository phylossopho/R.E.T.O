#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor de R.E.T.O.

    python server.py                 -> https://127.0.0.1:8000 y https://<IP-local>:8000

QUE HACE, EN DOS PARTES
1. SIRVE LOS ARCHIVOS DEL SITIO. HTML, CSS, JavaScript, fuentes y los
   dibujitos. Es lo que hacia antes, y sigue igual: la gente abre el sitio y ya.

2. CORRE LA LOGICA DEL SERVIDOR, en /api/...
   Ahi esta lo que el navegador NO puede decidir por su cuenta: como se
   baraja un tablero, cuando dos cartas hacen pareja, y cuando se acabo el
   juego. Esa logica esta en logica/memorama.py, en Python, y se prueba sin
   abrir nada (python test_memorama.py).

POR QUE EN UN ARCHIVO SOLO Y NO UNA CARPETA CON RUTAS
Porque hay una sola piece de logica por ahora. Cuando haya mas, se separan en
un modulo cada uno, y las rutas se agrupan con prefijo (/api/memorama, y
luego /api/test). Este archivo se queda siendo el arranque, y lo unico que
hace es pasarle el control a quien toque.

EL BARRAJEO NO SE PUEDE HACER EN EL NAVEGADOR
No por capricho. Si el navegador recibiera el tablero con los simbolos de todas
las cartas, un nino podria abrir el codigo de la pagina, ver donde esta cada
simbolo y ganar sin jugar. Mandando solo "voltea la carta 5" y preguntando
despues si hizo pareja, el simbolo de una carta tapada no sale nunca de aqui.

DONDE SE GUARDA EL TABLERO
En memoria, en este proceso. Deliberado, con una consecuencia que hay que
saber: si se apaga el servidor, se pierden las partidas empezadas. Para un
juego de veinte minutos eso no cuesta nada, y a cambio no hay base de datos
que instalar ni respaldar. El progreso de verdad de la persona (su mejor marca,
sus mapas, su biblioteca) NO esta aqui: eso vive en el navegador, en la base
de datos del sitio, y si sale en el respaldo. Ver logica/memorama.py.

PUERTO FIJO Y RED
El servidor SIEMPRE arranca en el puerto 8000 y escucha en 0.0.0.0 (todas las
interfaces). Asi funciona desde esta computadora (127.0.0.1) y desde el
celular u otra computadora de la misma red (IP local). No hay flags ni
argumentos: doble clic en servidor.cmd y listo.
"""

import datetime
import ipaddress
import os
import socket
import subprocess
import time

from flask import Flask, jsonify, request, send_from_directory

from logica import dinamicas, lectura_veloz, mahjong, memorama, rondas, schulte, secuencia

BASE = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=None)

# Los tipos se declaran uno por uno, como antes. La fuente en especial: sin
# declararla cae en application/octet-stream, que la mayoria de los navegadores
# tolera pero no es lo que dice la especificacion, y hay proxies que si la
# rechazan.
TIPOS = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".txt": "text/plain; charset=utf-8",
}

EXTENSIONES_PUBLICAS = frozenset({
    ".html", ".css", ".js", ".json", ".svg", ".png", ".jpg", ".jpeg",
    ".gif", ".webp", ".ico", ".woff2", ".woff", ".ttf", ".mp3", ".txt",
})


@app.after_request
def sin_cache(respuesta):
    """Que el navegador no se guarde una version vieja.

    Todo esto se esta cambiando seguido, y una hoja vieja en la cache hace que
    un arreglo parezca que no funciono. Cuesta un poco de ancho de banda al
    recargar y ahorra horas de estar buscando un cambio que no llega.
    """
    extension = os.path.splitext(request.path)[1].lower()
    versionado = (request.endpoint == "archivo" and request.args.get("v")
                  and extension in (".css", ".js"))
    if respuesta.status_code == 200 and versionado:
        respuesta.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        respuesta.headers.pop("Pragma", None)
        respuesta.headers.pop("Expires", None)
    else:
        respuesta.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        respuesta.headers["Pragma"] = "no-cache"
        respuesta.headers["Expires"] = "0"
    return respuesta


# ===========================================================================
# LOS ARCHIVOS DEL SITIO
# ===========================================================================

@app.route("/", defaults={"ruta": ""})
@app.route("/<path:ruta>")
def archivo(ruta):
    # "/" y "/index.html" dan los dos el archivo, y ninguno redirige al otro.
    # Antes se dejaba que Flask redirigiera, y eso ponia un 308 en cada carga
    # de la portada: un viaje de mas que el navegador tiene que seguir, y en
    # una pagina que se abre mucho se nota.
    if not ruta:
        ruta = "index.html"
    completa = os.path.abspath(os.path.join(BASE, ruta))
    # Que nadie pueda pedir un archivo de fuera de la carpeta con ".." en la
    # direccion. No es paranoia: es que sin esta comprobacion, un
    # "../../Windows/system.ini" sale del sitio y se entrega.
    if os.path.commonpath((BASE, completa)) != BASE:
        return jsonify({"error": "no se puede leer"}), 403
    if os.path.splitext(ruta)[1].lower() not in EXTENSIONES_PUBLICAS:
        return jsonify({"error": "no existe", "ruta": ruta}), 404
    if not os.path.isfile(completa):
        return jsonify({"error": "no existe", "ruta": ruta}), 404
    return send_from_directory(BASE, ruta)


# ===========================================================================
# LOS TEXTOS DE EJEMPLO
# ===========================================================================
#
# POR QUE HACE FALTA UNA RUTA Y NO UN INDICE ESCRITO A MANO
# El navegador no puede listar una carpeta: no hay forma de pedirle "dime que
# hay dentro de ejemplos/". Por eso hace falta que alguien se lo diga, y ese
# alguien es el servidor.
#
# Y NO SE ESCRIBE UN ARCHIVO CON LA LISTA, porque entonces la verdad estaria en
# dos sitios: los .txt y el indice. Al agregar un texto habria que acordarse de
# tocar las dos cosas, y el dia que se olvide el texto nuevo no aparece sin que
# salga ningun error. Leyendo la carpeta cada vez, dejar el archivo ahi es
# suficiente.

EJEMPLOS_DIR = os.path.join(BASE, "ejemplos")


@app.get("/api/ejemplos")
def ejemplos():
    """Los textos de ejemplo, para sembrar la biblioteca la primera vez.

    No guarda nada: solo devuelve el nombre y el contenido. Quien decide si se
    guardan es el navegador, que es quien tiene el analizador y la base de
    datos, y quien decide es la persona si ya tiene algo en su biblioteca.
    """
    if not os.path.isdir(EJEMPLOS_DIR):
        return jsonify({"ejemplos": []})
    salida = []
    # sorted() para que el orden sea siempre el mismo: el mismo archivo da
    # siempre la misma biblioteca, en vez de depender de como los entregue el
    # sistema de archivos.
    for nombre in sorted(os.listdir(EJEMPLOS_DIR)):
        if not nombre.lower().endswith(".txt"):
            continue
        completa = os.path.normpath(os.path.join(EJEMPLOS_DIR, nombre))
        # La misma comprobacion que en la ruta de archivos, por si alguien
        #-coloca un archivo con ".." en el nombre.
        if not completa.startswith(EJEMPLOS_DIR):
            continue
        try:
            with open(completa, encoding="utf-8") as f:
                cuerpo = f.read()
        except (OSError, UnicodeDecodeError):
            # Un .txt que no se puede leer no se cuelga el sitio: se sigue con
            # los demas.
            continue
        # La "BOM" (la marca invisible que Windows pone a veces al guardar) se
        # quita. Sin quitarla se queda pegada al principio del primer renglon y
        # el marcador [N1] deja de estar en la primera columna, que es justo lo
        # que el analizador revisa. El importador tiene el mismo problema con
        # FileReader, asi que aqui se resuelve de entrada.
        if cuerpo.startswith("\ufeff"):
            cuerpo = cuerpo[1:]
        if not cuerpo.strip():
            continue
        salida.append({
            "nombre": os.path.splitext(nombre)[0],
            "cuerpo": cuerpo
        })
    return jsonify({"ejemplos": salida})


# ===========================================================================
# LA TABLA DE SCHULTE
# ===========================================================================
#
# SOLO UNA RUTA, Y A PROPOSITO
# El memorama tiene cuatro, porque el servidor guarda la partida y cada toque
# va y vuelve. Aqui no: la rejilla entera esta a la vista desde el principio —
# ES el ejercicio—, asi que no hay nada que esconder y no hay estado que
# guardar en el servidor.
#
# Y ADEMAS EL JUEGO SE CRONOMETRA. Un viaje de ida y vuelta por cada casilla
# falsearia el tiempo, y el tiempo es justo lo que se esta midiendo. Por eso el
# tablero se pide UNA vez al empezar, y de ahi en adelante el reloj, los
# errores y el desvanecido viven en el navegador.

@app.get("/api/schulte/catalogos")
def schulte_catalogos():
    """Los tamanos y los contenidos que se pueden elegir, con su ayuda."""
    return jsonify(schulte.catalogos())


@app.post("/api/schulte/nueva")
def schulte_nueva():
    """Arma un tablero nuevo y lo devuelve."""
    datos = request.get_json(silent=True) or {}
    tamano = datos.get("tamano", "3x3")
    contenido = datos.get("contenido", "numeros")
    semilla = datos.get("semilla")
    try:
        tablero = schulte.nueva_tabla(tamano, contenido, semilla=semilla)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(tablero)


# ===========================================================================
# SECUENCIA (memoria secuencial)
# ===========================================================================
#
# Dos rutas, como Schulte: lo que el juego ofrece, y una secuencia nueva que se
# pide UNA vez al empezar. Lo demas (encender, sonar, comparar cada toque) vive
# en el navegador, porque el tiempo entre pasos es parte del juego. Ver
# logica/secuencia.py.

@app.get("/api/secuencia/catalogos")
def secuencia_catalogos():
    """Botones, metas, velocidades, etiquetas, paletas y notas."""
    return jsonify(secuencia.catalogos())


@app.post("/api/secuencia/nueva")
def secuencia_nueva():
    """Arma la secuencia completa de una partida y la devuelve."""
    datos = request.get_json(silent=True) or {}
    botones = datos.get("botones", "4")
    largo = datos.get("largo", 8)
    semilla = datos.get("semilla")
    try:
        partida = secuencia.nueva_secuencia(botones, largo, semilla=semilla)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(partida)


# ===========================================================================
# MAHJONG (solitario de fichas en pisos)
# ===========================================================================
#
# Tres rutas: lo que el juego ofrece, una partida nueva y "revolver". Sin
# estado en el servidor: el navegador manda lo que le queda y recibe lo nuevo.
# La regla de las fichas libres corre en el navegador (reto-mahjong-reglas.js),
# y test_mahjong.py comprueba que diga lo mismo que logica/mahjong.py.

@app.get("/api/mahjong/catalogos")
def mahjong_catalogos():
    """Niveles, caras, paletas y notas."""
    return jsonify(mahjong.catalogos())


@app.post("/api/mahjong/nueva")
def mahjong_nueva():
    """Arma una partida ganable del nivel pedido."""
    datos = request.get_json(silent=True) or {}
    try:
        partida = mahjong.nueva_partida(datos.get("nivel", "facil"),
                                        semilla=datos.get("semilla"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(partida)


@app.post("/api/mahjong/revolver")
def mahjong_revolver():
    """Vuelve a repartir las caras de las fichas que quedan."""
    datos = request.get_json(silent=True) or {}
    try:
        nuevas = mahjong.revolver(datos.get("fichas"),
                                  semilla=datos.get("semilla"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"fichas": nuevas})


# ===========================================================================
# TESTS: RONDAS Y REPETICION ESPACIADA
# ===========================================================================
#
# Sin estado, como el resto: el navegador manda lo que sabe (las preguntas del
# test y el estado de cada una, que vive en su IndexedDB y entra en el respaldo)
# y recibe la ronda o el estado nuevo. El reloj es el del servidor: ver
# logica/rondas.py.

@app.post("/api/tests/ronda")
def tests_ronda():
    """Elige las preguntas de una ronda y mezcla las respuestas de cada una."""
    datos = request.get_json(silent=True) or {}
    try:
        ronda = rondas.armar_ronda(datos.get("preguntas"), datos.get("estados"),
                                   datos.get("cantidad"),
                                   modo=datos.get("modo", "prioridad"),
                                   semilla=datos.get("semilla"))
        resumen = rondas.resumen_test(datos.get("preguntas"), datos.get("estados"),
                                      ahora=ronda["ahora"])
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    ronda["resumen"] = resumen
    return jsonify(ronda)


@app.post("/api/tests/dinamica")
def tests_dinamica():
    """Genera una instancia concreta (números, enunciado, opciones y pasos) de una pregunta dinámica."""
    datos = request.get_json(silent=True) or {}
    try:
        instancia = dinamicas.generar_instancia(datos.get("pregunta"), semilla=datos.get("semilla"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(instancia)


@app.post("/api/tests/registrar")
def tests_registrar():
    """El estado nuevo de una pregunta despues de contestarla."""
    datos = request.get_json(silent=True) or {}
    try:
        estado = rondas.registrar(datos.get("estado"), datos.get("acierto"),
                                  datos.get("seguridad"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"estado": estado})


@app.post("/api/tests/resumen")
def tests_resumen():
    """Como va la persona en varios tests: nuevas, por repasar, dominadas, temas."""
    datos = request.get_json(silent=True) or {}
    tests = datos.get("tests")
    if not isinstance(tests, list) or len(tests) > 200:
        return jsonify({"error": "faltan los tests (o son demasiados)"}), 400
    salida = {}
    try:
        for t in tests:
            if not isinstance(t, dict) or not isinstance(t.get("id"), str):
                raise ValueError("un test no es valido")
            salida[t["id"]] = rondas.resumen_test(t.get("preguntas"), t.get("estados"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(salida)


# ===========================================================================
# LA LOGICA DEL MEMORAMA
# ===========================================================================
#
# Una ruta por accion, y cada una es de una cosa. "/nueva" deja una partida
# nueva, "/voltear" da vuelta una carta, "/ocultar" tapa las que no hicieron
# pareja. Si mas adelante hacen falta mas acciones, se anaden aqui y ya.

# Las partidas que hay ahora, en memoria. La llave es la que lleva el
# navegador; ver MAS_ADELANTE por que el simbolo de una carta tapada no sale
# nunca de aqui.
_PARTIDAS = {}

# Un contador simple, y NO el id() de Python. El id() es la direccion de memoria
# del objeto en el proceso: es un dato del servidor que no tiene por que viajar
# al navegador, y ademas se ve enorme y feo (1881044890624). Un contador
# acotado dice lo mismo y no enseña nada. Y como es un contador y no un azar,
# dos partidas que empiezan en el mismo instante no se pisan.
_contador = 0

# Que no se guarden mas de estas. Es un tope de seguridad, no una optimizacion:
# si alguien abriera la pagina mil veces sin jugar, esto se comeria la memoria
# de la computadora sin avisar. Cuando se llega al tope, se va la mas vieja.
MAX_PARTIDAS = 60


def _nueva_llave():
    global _contador
    _contador += 1
    return "p%d" % _contador


def _recortar():
    while len(_PARTIDAS) > MAX_PARTIDAS:
        del _PARTIDAS[next(iter(_PARTIDAS))]


@app.get("/api/memorama/catalogos")
def memorama_catalogos():
    """Los tamanos y los conjuntos de simbolos que se pueden elegir."""
    return jsonify(memorama.catalogos())


@app.post("/api/memorama/nueva")
def memorama_nueva():
    """Prepara un tablero y lo devuelve sin los simbolos de las cartas tapadas."""
    datos = request.get_json(silent=True) or {}
    tamano = datos.get("tamano", "4x4")
    catalogo = datos.get("catalogo", "formas")
    semilla = datos.get("semilla")
    try:
        partida = memorama.nueva_partida(tamano, catalogo, semilla=semilla)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    _recortar()
    llave = _nueva_llave()
    _PARTIDAS[llave] = partida
    estado = memorama.estado_para_la_pagina(partida)
    estado["partida"] = llave
    return jsonify(estado)


@app.post("/api/memorama/voltear")
def memorama_voltear():
    """Da vuelta una carta y dice que paso."""
    datos = request.get_json(silent=True) or {}
    partida = _PARTIDAS.get(datos.get("partida", ""))
    if partida is None:
        return jsonify({"error": "esa partida no existe o el servidor se reinició"}), 404
    carta = datos.get("carta")
    if not isinstance(carta, int):
        return jsonify({"error": "falta la carta"}), 400

    partida, resultado = memorama.voltear(partida, carta)
    estado = memorama.estado_para_la_pagina(partida)
    estado["partida"] = datos.get("partida", "")
    estado["resultado"] = resultado
    return jsonify(estado)


@app.post("/api/memorama/ocultar")
def memorama_ocultar():
    """Vuelve a tapar las dos cartas que no hicieron pareja."""
    datos = request.get_json(silent=True) or {}
    partida = _PARTIDAS.get(datos.get("partida", ""))
    if partida is None:
        return jsonify({"error": "esa partida no existe o el servidor se reinició"}), 404
    partida = memorama.ocultar(partida)
    estado = memorama.estado_para_la_pagina(partida)
    estado["partida"] = datos.get("partida", "")
    return jsonify(estado)


# ===========================================================================
# LA LOGICA DE LA LECTURA VELOZ
# ===========================================================================
#
# El navegador manda los parrafos del texto que se eligio y recibe el plan: lo
# que hace falta para pintar ese motor (el galactico recibe los parrafos con su
# cuenta de palabras; palabra por palabra, cada palabra con su pausa; frases,
# cada oracion con su peso) y los topes de la velocidad.
# Python no guarda nada (los textos viven en IndexedDB, en el navegador); solo
# calcula y responde. El avance en pantalla lo calcula el navegador, que es el
# unico que sabe cuanto mide el texto.

# Los motores que ya tienen su plan. Cada uno que se termine se anota aqui, y
# el endpoint de abajo no cambia.
PLANES_DE_LECTURA = {
    "galactico": lectura_veloz.plan_galactico,
    "palabra": lectura_veloz.plan_palabra,
    "grupo": lectura_veloz.plan_grupo,
    "frases": lectura_veloz.plan_frases,
}


@app.post("/api/lectura/plan")
def lectura_plan():
    """El plan de lectura de un motor. Por ahora el galactico, palabra por palabra, grupo y frases."""
    datos = request.get_json(silent=True) or {}
    motor_nombre = datos.get("motor")
    plan_fn = PLANES_DE_LECTURA.get(motor_nombre)
    if plan_fn is None:
        return jsonify({"error": "ese motor todavía no está listo"}), 400
    try:
        # El modo grupo acepta tamano_grupo (3 o 4)
        kwargs = {}
        if motor_nombre == "grupo":
            tg = datos.get("tamano_grupo")
            if tg in (3, 4):
                kwargs["tamano_grupo"] = tg
        return jsonify(plan_fn(datos.get("parrafos"), **kwargs))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


# ===========================================================================
# ARRANCAR
# ===========================================================================

def _direcciones_locales():
    """Todas las direcciones IPv4 de esta computadora, menos las que no sirven.

    Se prueban TODAS y no solo la primera, porque una computadora suele tener
    varias: la del cable, la del WiFi, y las de los adaptadores virtuales
    (Hyper-V, WSL, VPN) que dan direcciones que no existen en la red de casa.
    La que sirve es la que esta en la misma red que el celular.
    """
    import socket
    encontradas = []
    # Se abre un socket "normal" contra una direccion que no se usa, para que el
    # sistema le diga por que interfaz saldria. No sale nada a la red.
    for destino in ("192.0.2.1", "198.51.100.1"):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.2)
            s.connect((destino, 1))
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith("127.") and ip not in encontradas:
                encontradas.append(ip)
        except Exception:
            pass
    return encontradas


def _anotar_la_direccion(ip, puerto):
    """Deja la direccion escrita en un archivo, para no tener que buscarla.

    Se escribe "direccion-del-sitio.txt" en la carpeta del proyecto. Sirve para
    dos cosas: no tener que recordar el numero, y que cualquier agente o persona
    la lea en vez de adivinarla. Como la IP la puede prestar el router en
    cualquier momento, tenerla escrita evita el "creo que era otra".
    """
    lineas = [
        "R.E.T.O. — direcciones para abrir el sitio",
        "",
        "Desde ESTA computadora:",
        "    https://127.0.0.1:%d" % puerto,
        "",
        "Desde el celular u otra computadora de la MISMA red:",
    ]
    if ip:
        lineas.append("    https://%s:%d" % (ip, puerto))
        lineas += [
            "",
            "Si esa direccion no abre, la IP cambio: el router la presta y puede",
            "cambiarla. Para volver a verla, deja el servidor corriendo y ejecuta:",
            "    type direccion-del-sitio.txt",
        ]
    else:
        lineas.append("    (no se pudo averiguar; revisa `ipconfig`)")
    lineas.append("")
    try:
        with open(os.path.join(BASE, "direccion-del-sitio.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(lineas) + "\n")
    except Exception:
        pass
    return "\n".join(lineas)


# ===========================================================================
# CERTIFICADO HTTPS
# ===========================================================================
#
# POR QUE HTTPS Y NO HTTP
# -----------------------
# En el celular, IndexedDB (donde vive la biblioteca de textos) NO funciona en
# http://192.168.x.x. Los navegadores modernos solo lo permiten en "contexto
# seguro": https:// o http://localhost (con la excepcion de localhost, que el
# navegador considera seguro aunque no lleve candado).
#
# Con http:// y una IP, en cambio, cae al respaldo de localStorage, que se
# llena enseguida y provoca el error de "memoria insuficiente" al importar
# textos. Por eso aqui se sirve en HTTPS con un certificado autofirmado: no es
# para "estar seguros" (esto es una red local), es para que el navegador del
# celular deje usar IndexedDB.
#
# EL AVISO DEL NAVEGADOR ES NORMAL
# --------------------------------
# Un certificado autofirmado no lo firma una autoridad de confianza, asi que
# la primera vez el navegador avisa "conexion no privada". Hay que aceptarlo
# una sola vez por dispositivo. Es exactamente el mismo caso que cuando un
# router te avisa que su pagina no tiene certificado valido.
#
# Los archivos quedan en la carpeta del proyecto (certificado.pem y llave.pem)
# y se generan solos la primera vez. No se suben a internet ni salen de aqui.

CERT_ARCHIVO = os.path.join(BASE, "certificado.pem")
LLAVE_ARCHIVO = os.path.join(BASE, "llave.pem")


def _generar_certificado():
    """Crea un certificado autofirmado con las IPs locales como nombres validos.

    Se hace con la libreria "cryptography", que ya viene en muchas
    instalaciones de Python y, si no, servidor.cmd la instala.

    El certificado lleva como nombres validos "localhost", "127.0.0.1" y TODAS
    las IPs de esta computadora. Eso importa: si solo llevara "localhost", al
    abrirlo desde el celular por 192.168.x.x el navegador diria "certificado no
    valido" y algunos bloquearian IndexedDB aunque aceptaras el aviso. Con las
    IPs dentro, es "autofirmado" pero al menos dice el nombre correcto.
    """
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    llave = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    nombres = [x509.DNSName("localhost")]
    try:
        nombres.append(x509.IPAddress(ipaddress.ip_address("127.0.0.1")))
    except Exception:
        pass
    for ip in _direcciones_locales():
        try:
            nombres.append(x509.IPAddress(ipaddress.ip_address(ip)))
        except Exception:
            pass

    sujeto = emisor = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "R.E.T.O."),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "R.E.T.O."),
    ])

    ahora = datetime.datetime.utcnow()
    certificado = (
        x509.CertificateBuilder()
        .subject_name(sujeto)
        .issuer_name(emisor)
        .public_key(llave.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(ahora - datetime.timedelta(days=1))
        .not_valid_after(ahora + datetime.timedelta(days=3650))   # 10 anios
        .add_extension(x509.SubjectAlternativeName(nombres), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(llave, hashes.SHA256())
    )

    with open(LLAVE_ARCHIVO, "wb") as f:
        f.write(llave.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))
    with open(CERT_ARCHIVO, "wb") as f:
        f.write(certificado.public_bytes(serialization.Encoding.PEM))


def _asegurar_certificado():
    """Si el certificado ya existe, lo reutiliza. Si no, lo crea.

    Se reutiliza a proposito: regenerarlo en cada arranque invalidaria el
    "aceptar el aviso" que ya hizo el celular, y habria que aceptarlo otra vez
    en cada reinicio. Guardandolo, se acepta UNA vez y ya.
    """
    if os.path.isfile(CERT_ARCHIVO) and os.path.isfile(LLAVE_ARCHIVO):
        return True
    try:
        _generar_certificado()
        print("")
        print("  Se genero el certificado HTTPS (certificado.pem y llave.pem).")
        print("  La primera vez que abras el sitio en el celular, el navegador")
        print("  avisara que la conexion no es privada: es normal, se acepta una")
        print("  sola vez. A partir de ahi no vuelve a preguntar.")
        return True
    except ImportError:
        print("")
        print("  Falta la libreria cryptography (para el certificado HTTPS).")
        print("  Se instala sola al abrir servidor.cmd. Cierra esto y vuelve a")
        print("  abrir servidor.cmd.")
        return False
    except Exception as e:
        print("")
        print("  No se pudo generar el certificado HTTPS: %s" % e)
        return False


def _matar_servidores_previos():
    """Mata cualquier server.py que este corriendo en esta computadora.

    Se hace para no dejar servidores huerfanos apilados: como el puerto ahora
    es aleatorio, cada apertura de servidor.cmd dejaria uno mas vivo si no se
    apaga el anterior a mano. Se matan TODOS los procesos de python cuyo
    CommandLine mencione "server.py". No se tocan los demas procesos de python.

    Se hace con PowerShell (Get-CimInstance), porque wmic esta deprecado en
    Windows 11 y puede no estar.
    """
    try:
        ps_cmd = 'Get-CimInstance Win32_Process | Where-Object { $_.Name -like "python*" -and $_.CommandLine -like "*server.py*" } | Select-Object -ExpandProperty ProcessId'
        resultado = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            capture_output=True, text=True, timeout=10,
        )
        pids = []
        for x in resultado.stdout.split():
            x = x.strip()
            if x.isdigit():
                pids.append(int(x))
        matados = 0
        for pid in pids:
            if pid == os.getpid():
                continue
            subprocess.run(["taskkill", "/F", "/PID", str(pid)],
                           capture_output=True)
            matados += 1
        return matados
    except Exception:
        return 0


def principal():
    os.chdir(BASE)

    # La carpeta de trabajo, bien visible: cuando se tienen varias copias
    # del proyecto abiertas, "no se ven mis cambios" casi siempre es que el
    # servidor esta sirviendo OTRA carpeta. Con esto se sabe de un vistazo.
    print("")
    print("  Carpeta de trabajo:")
    print("      " + BASE)

    hay_https = _asegurar_certificado()

    matados = _matar_servidores_previos()
    if matados:
        print("")
        print("  Se cerraron %d servidor(es) anterior(es)." % matados)
        time.sleep(0.6)

    # Puerto FIJO 8000 (ya no se busca uno libre al azar).
    puerto = 8000

    # Siempre en red (0.0.0.0): escucha en todas las interfaces para que
    # funcione tanto en esta computadora (127.0.0.1) como desde el celular
    # u otra computadora de la misma red.
    host = "0.0.0.0"
    en_red = True

    ips = _direcciones_locales()
    principal_ip = ips[0] if ips else None
    _anotar_la_direccion(principal_ip, puerto)

    print("")
    print("  " + "=" * 58)
    print("   R.E.T.O.  esta corriendo")
    print("  " + "=" * 58)
    print("")
    print("   Desde esta computadora:")
    print("       https://127.0.0.1:%d" % puerto)
    print("")
    print("   Desde el celular u otra computadora de la MISMA red:")
    if principal_ip:
        print("       https://%s:%d" % (principal_ip, puerto))
    else:
        print("       (no se pudo averiguar la direccion; revisa ipconfig)")
    if len(ips) > 1:
        print("")
        print("   OTRAS direcciones de esta computadora, por si la de arriba")
        print("   no es la de tu red (suelen ser de adaptadores virtuales):")
        for otra in ips[1:]:
            print("       https://%s:%d" % (otra, puerto))
    print("")
    print("   El navegador avisara que la conexion no es privada (certificado")
    print("   autofirmado): es normal, se acepta una sola vez por dispositivo.")
    print("")
    print("   La direccion quedo escrita en  direccion-del-sitio.txt")
    print("   Para apagar el servidor: cierra esta ventana.")
    print("")

    # Sin el reloader: recarga los archivos solo cuando se le pide, que es
    # justo lo que se quiere mientras se esta tocando el sitio.
    contexto = (CERT_ARCHIVO, LLAVE_ARCHIVO) if hay_https else None
    if not hay_https:
        print("")
        print("   AVISO: se sirve en HTTP porque el certificado HTTPS no se pudo")
        print("   crear. En el celular, la biblioteca NO funcionara bien: usara")
        print("   el respaldo de localStorage, que se llena pronto. Para")
        print("   arreglarlo, cierra esto y abre servidor.cmd (instala cryptography).")
        print("")
    app.run(host=host, port=puerto, debug=False, threaded=True,
            ssl_context=contexto)


if __name__ == "__main__":
    principal()
