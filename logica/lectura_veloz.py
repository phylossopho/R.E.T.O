#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
R.E.T.O. - Las reglas de la lectura veloz
===========================================================================
Aqui viven las REGLAS de los motores de lectura, y solo las reglas: nada de
HTML, nada de navegador, nada de reloj. Se pueden probar en la terminal:

    python test_lectura_veloz.py

QUE DECIDE ESTE ARCHIVO
    - como se parte un texto en parrafos y en palabras;
    - cuantas palabras tiene cada parrafo y cuantas el texto entero;
    - los topes de la velocidad (50 a 999, de diez en diez);
    - cuantos segundos dura la cuenta regresiva antes de empezar;
    - los limites de las dos escalas del modo galactico (con que tamano entra
      el texto y con cual se pierde);
    - en el modo palabra por palabra: cuanto se detiene la lectura despues de
      cada palabra segun como termine (punto, coma, guion o nada) y cual es la
      letra de cada palabra donde el ojo se fija.
    - en el modo frases: donde termina cada oracion, como se corta una oracion
      demasiado larga y cuanto dura cada frase en pantalla.

QUE NO DECIDE, Y A PROPOSITO
    Nada de pixeles ni de fotogramas. Cuanto mide el texto en pantalla, y
    cuanto avanza en cada fotograma, lo sabe SOLO el navegador (Python no ve la
    pantalla). El navegador recibe de aqui el conteo de palabras y con eso
    calcula el avance: ver crearGalactico en scripts/reto-lectura.js.
    Tampoco decide el reloj: Python dice cuanto PESA cada pausa y el navegador
    la convierte en milisegundos segun la velocidad del momento (ver
    PAUSA_BASE_MS y crearPalabra).

POR QUE LOS NUMEROS ESTAN AQUI Y NO REPETIDOS
    Los topes de velocidad son los mismos de lectura-veloz.md. El navegador
    tambien los tiene (WPM_CHICA, WPM_GRANDE, WPM_PASO en reto-lectura.js) y
    la barra de practica.html lleva los mismos tres. Si se cambia uno, se
    cambian los tres. Aqui se dejan como constantes con nombre para que la
    prueba los compare contra lectura-veloz.md y no se desincronicen en
    silencio.

COMO SE USA
    from logica.lectura_veloz import plan_galactico
    plan = plan_galactico(["Primer parrafo.", "Segundo parrafo."])
    plan["total_palabras"]      # 4
    plan["parrafos"][0]         # {"texto": "Primer parrafo.", "palabras": 2}

    from logica.lectura_veloz import plan_palabra
    plan = plan_palabra(["Hola, mundo."])
    plan["palabras"]          # ["Hola,", "mundo."]
    plan["pausa"]             # [350, 600]   (milisegundos medidos a 300 ppm)
    plan["foco"]              # [1, 1]       (la letra que se resalta)
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, Iterable, List

# ===========================================================================
# LOS NUMEROS YA DECIDIDOS (lectura-veloz.md, seccion 2.1)
# ===========================================================================

WPM_MIN = 50           # abajo de esto ya no es leer, es ir deslizando el dedo
WPM_MAX = 999          # arriba de esto el texto entra antes de que el ojo lo lea
WPM_PASO = 10          # de diez en diez es lo que se nota como cambio de ritmo
WPM_POR_DEFECTO = 300

# La cuenta regresiva de 3-2-1: un segundo por numero, para que la vista se
# acomode antes de la primera palabra (lectura-veloz.md, seccion 5.1).
CUENTA_SEG = 3

# LA PAUSA DESPUES DE CADA PALABRA (lectura-veloz.md, seccion 2.2)
#
# Cuanto se detiene la lectura sobre una palabra, segun como termine. La tabla
# esta MEDIDA A 300 PALABRAS POR MINUTO (el valor por defecto): a esa velocidad
# una palabra sin signo dura 60 000 / 300 = 200 ms, que es el piso de la tabla.
#
# A otra velocidad estos milisegundos NO se usan tal cual. Si se usaran, el
# piso de 200 ms limitaria la lectura a 300 ppm y la barra de 50 a 999 no
# serviria de nada: a 600 ppm una palabra debe durar 100 ms, no 200. Lo que se
# conserva es la PROPORCION: una coma pesa 350 / 200 = 1.75 palabras normales,
# un punto 600 / 200 = 3. El navegador hace esa cuenta con PAUSA_BASE_MS, que
# viaja en el plan para que el numero viva solo aqui.
PAUSA_MS = {"oracion": 600, "coma": 350, "guion": 300, "nada": 200}
PAUSA_BASE_MS = PAUSA_MS["nada"]

# LAS DOS ESCALAS DEL MODO GALACTICO
# El texto entra por abajo a un tamano y se pierde arriba a otro mas chico.
# Las dos son porcentajes y la persona las ajusta en el modal del modo:
#
#   inicio  con que tamano ENTRA, como % del tamano de la letra elegida.
#           100 = la letra tal cual; 160 = entra un 60 % mas grande.
#   fin     con que tamano SE PIERDE, como % del tamano con el que entro. Es
#           cuando el ultimo renglon llega a ese tamano y se da por terminado:
#           mas chico = viaja mas lejos y la lectura dura mas.
#
# El tope de fin es 80 a proposito: con 90 o 100 el texto se "perderia" sin
# haberse achicado, y se quedaria a medio camino sin irse a ningun lado. Y el
# piso de 10 es porque a menos de eso el ultimo renglon ya no se ve y solo se
# alarga la espera.
ESCALA_INICIO = {"min": 60, "max": 160, "paso": 5, "defecto": 100}
ESCALA_FIN = {"min": 10, "max": 80, "paso": 5, "defecto": 30}

# Un tope de seguridad, no una optimizacion. Un libro largo son unas 100 mil
# palabras; con esto entran varios y todavia no se come la memoria del
# navegador pintando un parrafo por cada frase de una novela entera.
MAX_PALABRAS = 300_000
MAX_PARRAFOS = 20_000


# ===========================================================================
# PARTIR EL TEXTO
# ===========================================================================

def partir_palabras(texto: str) -> List[str]:
    """Las palabras de un texto: lo que queda entre espacios.

    Es la MISMA cuenta que hace reto-marcado.js al guardar un documento
    (`split(/\\s+/)`), a proposito: si aqui se contara distinto, el numero que
    dice la biblioteca ("664 palabras") y el que usa la lectura no coincidirian.
    Un guion suelto o una viñeta cuentan como palabra en las dos cuentas.
    """
    if not isinstance(texto, str):
        return []
    return texto.split()


def limpiar_parrafo(texto: Any) -> str:
    """Un parrafo en una sola linea, con los espacios en su sitio.

    Los saltos de linea dentro de un parrafo y los espacios dobles no le
    importan al ojo pero si ensucian el ancho de la linea, asi que se juntan.
    Lo que no es texto (un numero, None) se ignora y da "".
    """
    if not isinstance(texto, str):
        return ""
    return " ".join(texto.split())


# ===========================================================================
# LA VELOCIDAD
# ===========================================================================

def acotar_wpm(valor: Any) -> int:
    """Deja la velocidad dentro de los topes y de diez en diez.

    Igual que `acotarWpm` del navegador: un 297 guardado por una version vieja
    se vuelve 300, y un valor que no es un numero se vuelve el del medio.
    """
    try:
        n = int(round(float(valor)))
    except (TypeError, ValueError):
        return WPM_POR_DEFECTO
    n = int(round(n / WPM_PASO)) * WPM_PASO
    return max(WPM_MIN, min(WPM_MAX, n))


def acotar_escala(rango: Dict[str, int], valor: Any) -> int:
    """Deja una escala dentro de su rango y en su paso.

    `rango` es ESCALA_INICIO o ESCALA_FIN. Igual que `acotar_wpm`: un valor que
    no es un numero (o que viene de una version vieja con otros topes) no
    rompe nada, se vuelve el del medio o el tope mas cercano.
    """
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return rango["defecto"]
    if n != n or n in (float("inf"), float("-inf")):   # nan o infinito
        return rango["defecto"]
    paso = rango["paso"]
    n = int(round(n / paso)) * paso
    return max(rango["min"], min(rango["max"], n))


# ===========================================================================
# LOS PARRAFOS, LIMPIOS Y CONTADOS (lo comparten los dos planes)
# ===========================================================================

def _leer_parrafos(parrafos: Iterable[Any]) -> List[Dict[str, Any]]:
    """Los parrafos del texto, limpios y con sus palabras partidas.

    Devuelve una lista de {"texto": parrafo limpio, "palabras": [palabras]}.
    Es la parte que NO cambia de un modo a otro: que se descarta, cuando un
    texto es demasiado grande y con que mensaje se avisa. Va en un solo sitio
    para que el galactico y el palabra por palabra no cuenten distinto.

    Los parrafos vacios (o que no son texto) se descartan: un hueco en medio de
    la lectura se veria como una pausa que nadie pidio.

    Lanza ValueError, con un mensaje que se puede mostrar tal cual, si no hay
    nada que leer o si el texto es demasiado grande.
    """
    if parrafos is None or isinstance(parrafos, (str, bytes)):
        # Un texto suelto NO es una lista de parrafos: recorrerlo daria una
        # letra por parrafo. Se pide la lista.
        raise ValueError("Falta la lista de parrafos.")

    salida: List[Dict[str, Any]] = []
    total = 0
    for crudo in parrafos:
        texto = limpiar_parrafo(crudo)
        if not texto:
            continue
        palabras = partir_palabras(texto)
        total += len(palabras)
        if total > MAX_PALABRAS:
            raise ValueError(
                "Este texto es demasiado largo para este modo. "
                "Prueba con un capitulo o una parte."
            )
        salida.append({"texto": texto, "palabras": palabras})
        if len(salida) > MAX_PARRAFOS:
            raise ValueError(
                "Este texto tiene demasiados parrafos para este modo. "
                "Prueba con un capitulo o una parte."
            )

    if not salida:
        raise ValueError("Este texto no tiene palabras que leer.")

    return salida


# ===========================================================================
# EL PLAN DEL MODO GALACTICO
# ===========================================================================

def plan_galactico(parrafos: Iterable[Any]) -> Dict[str, Any]:
    """El plan de lectura del modo galactico.

    Recibe los parrafos del texto y devuelve lo que el navegador necesita para
    pintar: cada parrafo limpio con su cuenta de palabras, el total, y los
    segundos de cuenta regresiva.

    Lanza ValueError, con un mensaje que se puede mostrar tal cual, si no hay
    nada que leer o si el texto es demasiado grande (ver _leer_parrafos).
    """
    leidos = _leer_parrafos(parrafos)
    salida = [{"texto": p["texto"], "palabras": len(p["palabras"])} for p in leidos]
    total = sum(p["palabras"] for p in salida)

    return {
        "motor": "galactico",
        "parrafos": salida,
        "total_palabras": total,
        "cuenta_seg": CUENTA_SEG,
        "wpm": {"min": WPM_MIN, "max": WPM_MAX, "paso": WPM_PASO},
        "escala": {"inicio": dict(ESCALA_INICIO), "fin": dict(ESCALA_FIN)},
    }


# ===========================================================================
# PALABRA POR PALABRA (RSVP)
# ===========================================================================
#
# Cada palabra sale en el MISMO punto de la pantalla, una tras otra. Para que
# el ojo no tenga que buscarla, la palabra no se centra entera: se centra UNA
# LETRA, la del punto de fijacion, y el resto cuelga a los lados. Python decide
# cual es esa letra y cuanto dura cada palabra; el navegador solo pinta y
# cronometra (motores-de-lectura.md, seccion 2).

# Lo que cierra una palabra sin ser parte de su final: comillas, parentesis y
# rayitas de formato. En `fin."` el final de verdad es el punto, no la comilla.
_CIERRES = "\"'\u201d\u2019\u00bb\u203a)]}*_"
_FINALES_DE_ORACION = ".!?\u2026"      # . ! ? y los puntos suspensivos
_FINALES_DE_COMA = ",;:"
_GUIONES = "-\u2013\u2014"            # guion, guion medio y raya
_VINETAS = "-\u2013\u2014\u2022\u00b7*\u25aa\u25e6"

# "1." o "12)": el numero de una lista, que marca un elemento y no cierra un
# pensamiento. Sin esto, cada elemento numerado se leeria como si terminara
# una oracion.
_LISTA_NUMERADA = re.compile(r"^\d{1,3}[.)]$")

# Abreviaturas que terminan en punto SIN terminar la oracion. Sin esto, "Sr."
# o "pag." harian una pausa de punto en medio de una frase. No esta "etc.": ahi
# el punto casi siempre SI cierra la oracion.
ABREVIATURAS = frozenset({
    "sr", "sra", "srta", "dr", "dra", "lic", "ing", "prof", "av",
    "n\u00fam", "p\u00e1g", "p\u00e1gs", "vs", "art", "ej", "tel",
})


def _es_abreviatura(fin: str) -> bool:
    """`fin` termina en punto: dice si ese punto es de una abreviatura.

    Cuenta como abreviatura la lista de ABREVIATURAS y la inicial suelta
    ("J." de "J. Perez"). Un punto despues de una sola letra casi nunca cierra
    una oracion.
    """
    nucleo = fin[:-1]
    i = 0
    while i < len(nucleo) and not nucleo[i].isalnum():
        i += 1
    nucleo = nucleo[i:]
    if len(nucleo) == 1 and nucleo.isalpha():
        return True
    return nucleo.lower() in ABREVIATURAS


def tipo_de_pausa(palabra: str) -> str:
    """Como termina una palabra: "oracion", "coma", "guion" o "nada".

    Mira el FINAL real de la palabra, saltando lo que la cierra (comillas,
    parentesis): `dijo."` termina en oracion y `(ver,` en coma. Una vineta o el
    numero de una lista cuentan como "guion": marcan un elemento, no cierran un
    pensamiento. Lo que no es texto se trata como una palabra sin signo.
    """
    if not isinstance(palabra, str) or not palabra:
        return "nada"
    if all(c in _VINETAS for c in palabra) or _LISTA_NUMERADA.match(palabra):
        return "guion"
    fin = palabra.rstrip(_CIERRES)
    if not fin:
        return "nada"          # solo habia cierres: un `)` suelto no pesa nada
    ultimo = fin[-1]
    if ultimo in _FINALES_DE_ORACION:
        if ultimo == "." and _es_abreviatura(fin):
            return "nada"
        return "oracion"
    if ultimo in _FINALES_DE_COMA:
        return "coma"
    if ultimo in _GUIONES:
        return "guion"
    return "nada"


def pausa_ms(palabra: str) -> int:
    """Los milisegundos de la tabla para esta palabra, medidos a 300 ppm."""
    return PAUSA_MS[tipo_de_pausa(palabra)]


def punto_de_fijacion(palabra: str) -> int:
    """El indice de la letra donde el ojo se fija (0 es la primera).

    Se fija un poco ANTES del centro de la palabra: ahi el ojo reconoce la
    palabra entera con menos esfuerzo. Es la convencion de los lectores de
    este tipo, segun el largo de la palabra:

        1 letra          la primera
        2 a 5 letras     la segunda
        6 a 9 letras     la tercera
        10 a 13 letras   la cuarta
        14 o mas         la quinta

    El largo se cuenta SIN los signos de los lados: en `(casa),` son 4 letras
    y la fijacion cae en la "a", no en el parentesis. El indice que se devuelve
    es sobre la palabra COMPLETA, para que el navegador la parta tal cual.

    Lo que se resalta es siempre una letra o un numero. Si la cuenta cae sobre
    un signo de EN MEDIO (la coma de `3,5`, los puntos de `S.A.`), se corre a la
    letra mas cercana, y si hay dos a la misma distancia, a la de la izquierda.
    Si no hay ninguna letra ni numero (una raya suelta), es 0.
    """
    if not isinstance(palabra, str) or not palabra:
        return 0
    inicio = None
    fin = 0
    for i, c in enumerate(palabra):
        if c.isalnum():
            if inicio is None:
                inicio = i
            fin = i + 1
    if inicio is None:
        return 0
    largo = fin - inicio
    if largo <= 1:
        desplazamiento = 0
    elif largo <= 5:
        desplazamiento = 1
    elif largo <= 9:
        desplazamiento = 2
    elif largo <= 13:
        desplazamiento = 3
    else:
        desplazamiento = 4
    objetivo = inicio + desplazamiento
    for lejos in range(len(palabra)):
        for i in (objetivo - lejos, objetivo + lejos):
            if 0 <= i < len(palabra) and palabra[i].isalnum():
                return i
    return objetivo      # no se llega aqui: hay al menos una letra (ver arriba)


def plan_palabra(parrafos: Iterable[Any]) -> Dict[str, Any]:
    """El plan de lectura del modo palabra por palabra.

    Devuelve tres listas del MISMO largo, una posicion por palabra:

        palabras   la palabra tal cual, con sus signos
        foco       el indice de la letra que se resalta (punto_de_fijacion)
        pausa      su pausa en milisegundos MEDIDA A 300 PPM (ver PAUSA_MS)

    mas el total, la cuenta regresiva, los topes de la velocidad y
    `pausa_base_ms`, que es lo que el navegador usa para pasar la pausa a la
    velocidad del momento:

        duracion de la palabra = (60 000 / ppm) x (pausa / pausa_base_ms)

    Van en listas paralelas y no en una lista de objetos porque un libro tiene
    decenas de miles de palabras y un objeto por palabra pesa varias veces mas
    por el camino.

    LA ULTIMA PALABRA DE CADA PARRAFO pesa como fin de oracion aunque no lleve
    punto: un titulo o un elemento de lista sin signo, si no, se pegaria a la
    primera palabra del parrafo siguiente con la pausa de una palabra cualquiera
    y se leeria como una sola frase.

    Las palabras salen en NFC (la "e" y su acento en un solo caracter): el
    navegador parte la palabra con el indice de `foco`, y con el acento suelto
    el indice caeria una letra corrido.

    Lanza ValueError, con un mensaje que se puede mostrar tal cual, si no hay
    nada que leer o si el texto es demasiado grande (ver _leer_parrafos).
    """
    palabras: List[str] = []
    foco: List[int] = []
    pausa: List[int] = []
    for par in _leer_parrafos(parrafos):
        lista = par["palabras"]
        ultima = len(lista) - 1
        for i, crudo in enumerate(lista):
            palabra = unicodedata.normalize("NFC", crudo)
            ms = pausa_ms(palabra)
            if i == ultima:
                ms = max(ms, PAUSA_MS["oracion"])
            palabras.append(palabra)
            foco.append(punto_de_fijacion(palabra))
            pausa.append(ms)

    return {
        "motor": "palabra",
        "palabras": palabras,
        "foco": foco,
        "pausa": pausa,
        "pausa_base_ms": PAUSA_BASE_MS,
        "total_palabras": len(palabras),
        "cuenta_seg": CUENTA_SEG,
        "wpm": {"min": WPM_MIN, "max": WPM_MAX, "paso": WPM_PASO},
    }


# ===========================================================================
# PALABRAS EN GRUPO (CHUNK) — 3 o 4 palabras por fijación
# ===========================================================================
#
# El span perceptual (Rayner et al.) permite ~18-19 letras por fijación:
# 3-4 palabras típicas. El usuario elige 3 o 4 con un botón toggle.
#
# Reglas:
# - Se agrupan palabras de N en N (N = 3 o 4).
# - No se rompe una oración: si el grupo caería en medio de signo fuerte
#   (punto, !, ?), se cierra el grupo antes.
# - Si al final quedan 1-2 palabras, se unen al grupo anterior (no grupo de 1).
# - ORP (punto de fijación) = palabra central del grupo (índice N//2).
# - Pausa del grupo = pausa de la ÚLTIMA palabra del grupo (prosodia natural).
# - Blur progresivo en CSS: centro nítido, lados con blur según distancia al ORP.
#
# Python decide la agrupación y pausas; el navegador solo pinta y cronometra.
# ===========================================================================

def _es_fin_fuerte(palabra: str) -> bool:
    """True si la palabra termina en punto, !, ? o … (saltando cierres)."""
    if not isinstance(palabra, str) or not palabra:
        return False
    fin = palabra.rstrip(_CIERRES)
    if not fin:
        return False
    return fin[-1] in _FINALES_DE_ORACION


def _agrupar_palabras(palabras: List[str], n: int) -> List[List[str]]:
    """Agrupa palabras en bloques de n, sin romper oraciones.
    
    Si un grupo terminaría en medio de una oración (no hay fin fuerte),
    se cierra antes. Al final, si quedan 1-2 palabras sin grupo (en `actual`),
    se unen al último grupo. Y si el último grupo tiene menos de n palabras
    y el grupo anterior tiene n o más, se une al anterior (evita grupo final de 1-2).
    """
    if not palabras:
        return []
    
    grupos: List[List[str]] = []
    actual: List[str] = []
    
    for p in palabras:
        actual.append(p)
        if len(actual) == n:
            grupos.append(actual)
            actual = []
        elif _es_fin_fuerte(p) and actual:
            # Fin de oración: cierra el grupo aunque no lleve n palabras
            grupos.append(actual)
            actual = []
    
    # Lo que queda en `actual` (1 o 2 palabras que no formaron grupo completo
    # ni terminaron en signo fuerte) se une al último grupo.
    if actual:
        if grupos:
            grupos[-1].extend(actual)
        else:
            grupos.append(actual)
    
    # Si el último grupo tiene menos de n palabras Y el grupo anterior
    # tiene n o más palabras, únelos (evita grupo final de 1-2 suelto
    # cuando el anterior sí es un grupo completo).
    if len(grupos) >= 2 and len(grupos[-1]) < n <= len(grupos[-2]):
        grupos[-2].extend(grupos[-1])
        grupos.pop()
    
    return grupos


def _orp_indice_grupo(grupo: List[str]) -> int:
    """Índice de la palabra ORP dentro del grupo (centro visual).
    
    Para 3 palabras -> índice 1 (la 2ª)
    Para 4 palabras -> índice 1 (la 2ª) por convención visual.
    Para 5+ -> índice n//2 (la central).
    """
    n = len(grupo)
    if n <= 2:
        return 0
    if n == 4:
        return 1  # 2ª palabra (índice 1) como centro visual
    return n // 2  # 3->1, 5->2, etc.


def plan_grupo(parrafos: Iterable[Any], tamano_grupo: int = 3) -> Dict[str, Any]:
    """El plan de lectura del modo palabras en grupo (chunk).
    
    Devuelve una lista de grupos, cada uno con:
        - palabras: lista de strings (3 o 4 típicamente)
        - orp_idx: índice de la palabra ORP dentro del grupo
        - pausa: ms de la tabla PAUSA_MS medidos a 300 PPM (de la última palabra)
    
    Parámetros:
        tamano_grupo: 3 o 4 (viene del usuario, botón toggle en el panel).
    
    Lanza ValueError si no hay texto o es demasiado grande.
    """
    if tamano_grupo not in (3, 4):
        tamano_grupo = 3
    
    leidos = _leer_parrafos(parrafos)
    # Aplanar todas las palabras del texto en orden
    todas_palabras: List[str] = []
    for par in leidos:
        todas_palabras.extend(par["palabras"])
    
    # Agrupar
    grupos_palabras = _agrupar_palabras(todas_palabras, tamano_grupo)
    
    grupos = []
    total_palabras = 0
    for g in grupos_palabras:
        total_palabras += len(g)
        ultima = g[-1]
        ms = pausa_ms(unicodedata.normalize("NFC", ultima))
        # Si es la última palabra del texto completo, fuerza pausa de oración
        # (el navegador sabrá si es el último grupo por posición)
        orp_idx = _orp_indice_grupo(g)
        grupos.append({
            "palabras": [unicodedata.normalize("NFC", p) for p in g],
            "orp_idx": orp_idx,
            "pausa": ms,
        })
    
    # El último grupo del texto fuerza pausa de oración
    if grupos:
        grupos[-1]["pausa"] = max(grupos[-1]["pausa"], PAUSA_MS["oracion"])
    
    return {
        "motor": "grupo",
        "grupos": grupos,
        "total_palabras": total_palabras,
        "total_grupos": len(grupos),
        "cuenta_seg": CUENTA_SEG,
        "wpm": {"min": WPM_MIN, "max": WPM_MAX, "paso": WPM_PASO},
        "pausa_base_ms": PAUSA_BASE_MS,
        "tamano_grupo": tamano_grupo,
    }


# ===========================================================================
# FRASES COMPLETAS — una oracion entera a la vez
# ===========================================================================
#
# Aqui no se fragmenta el texto: se muestra la oracion COMPLETA, para quien
# entiende mejor viendo la idea entera que piezas sueltas (motores-de-lectura.md,
# seccion 4). Es "leer normal, pero a un ritmo fijo".
#
# Reglas (lectura-veloz.md, seccion 4.3):
# - Una frase termina donde termina una oracion: punto, ! , ? o puntos
#   suspensivos (tipo_de_pausa == "oracion"). Eso ya sabe que `Sr.` o `J.` NO
#   cierran la oracion, y que `etc.` si.
# - El final de cada parrafo cierra la frase, aunque no lleve punto: un titulo
#   o un elemento de lista es una frase, y no se pega con el parrafo siguiente.
# - Una oracion de mas de MAX_PALABRAS_FRASE palabras NO cabe de una mirada ni
#   en la pantalla: se corta en la coma (o punto y coma, o dos puntos) mas
#   cercana a su mitad. Si no hay ninguna, se corta por la mitad, sin mas.
# - Cada pieza queda con MIN_PALABRAS_FRASE palabras como minimo: no se deja
#   una frase de una palabra colgando de una coma.
# - Cuanto dura una frase = la suma de lo que pesa cada una de sus palabras (la
#   tabla PAUSA_MS), igual que en palabra por palabra y en grupos. Por eso las
#   comas de adentro tambien cuentan, y una frase con tres comas dura mas que
#   una sin ninguna del mismo largo.
#
# Python decide donde se corta y cuanto pesa; el navegador pinta, mide si cabe
# y cronometra.

# Una frase de mas palabras que esto se corta. A 25 una oracion normal en
# espanol (15 a 20 palabras) entra entera, y las muy largas (de libro) no.
MAX_PALABRAS_FRASE = 25
# Al cortar una oracion larga, ninguna pieza queda con menos de esto.
MIN_PALABRAS_FRASE = 4


def _partir_oracion_larga(palabras: List[str]) -> List[List[str]]:
    """Corta una oracion de mas de MAX_PALABRAS_FRASE palabras en piezas.

    Se corta DESPUES de una palabra que termina en coma, punto y coma o dos
    puntos (tipo_de_pausa == "coma"), eligiendo la que deja la pieza mas
    cercana a un reparto parejo. Si ninguna sirve, se corta en el reparto
    parejo, sin mas. Una oracion que ya cabe se devuelve tal cual.

    Siempre se cumple: cada pieza tiene entre MIN_PALABRAS_FRASE y
    MAX_PALABRAS_FRASE palabras (salvo que la oracion entera sea mas corta que
    el minimo), y las piezas juntas son la oracion, en orden.
    """
    if len(palabras) <= MAX_PALABRAS_FRASE:
        return [list(palabras)]

    piezas: List[List[str]] = []
    resto = list(palabras)
    while len(resto) > MAX_PALABRAS_FRASE:
        cuantas = -(-len(resto) // MAX_PALABRAS_FRASE)     # techo
        ideal = int(round(len(resto) / cuantas))           # el largo de un reparto parejo
        tope = min(MAX_PALABRAS_FRASE, len(resto) - MIN_PALABRAS_FRASE)
        mejor = None
        for largo in range(MIN_PALABRAS_FRASE, tope + 1):
            if tipo_de_pausa(resto[largo - 1]) == "coma":
                if mejor is None or abs(largo - ideal) < abs(mejor - ideal):
                    mejor = largo
        if mejor is None:
            mejor = ideal
        piezas.append(resto[:mejor])
        resto = resto[mejor:]
    piezas.append(resto)
    return piezas


def _frases_de_parrafo(palabras: List[str]) -> List[List[str]]:
    """Las frases de UN parrafo: cada oracion, y las largas ya cortadas.

    Una oracion termina en la palabra cuyo final cierra oracion (tipo_de_pausa).
    Lo que quede al final del parrafo sin cerrar (un titulo, un elemento de
    lista) es una frase mas.
    """
    frases: List[List[str]] = []
    actual: List[str] = []
    for palabra in palabras:
        actual.append(palabra)
        if tipo_de_pausa(palabra) == "oracion":
            frases.extend(_partir_oracion_larga(actual))
            actual = []
    if actual:
        frases.extend(_partir_oracion_larga(actual))
    return frases


def plan_frases(parrafos: Iterable[Any]) -> Dict[str, Any]:
    """El plan de lectura del modo frases completas.

    Devuelve una lista de frases, cada una con:

        texto     la frase tal cual, con sus signos y en NFC (las palabras
                  separadas por un solo espacio)
        palabras  cuantas palabras tiene
        pausa     lo que pesa, en milisegundos MEDIDOS A 300 PPM: la suma de la
                  pausa de cada palabra (ver PAUSA_MS)

    mas el total de palabras y de frases, la cuenta regresiva, los topes de la
    velocidad y `pausa_base_ms`. El navegador pasa la pausa a la velocidad del
    momento con la MISMA cuenta de los otros modos:

        duracion de la frase = (60 000 / ppm) x (pausa / pausa_base_ms)

    LA ULTIMA PALABRA DE CADA PARRAFO pesa como fin de oracion aunque no lleve
    punto (igual que en plan_palabra): un titulo o un elemento de lista, si no,
    durarian lo de una palabra cualquiera.

    Lanza ValueError, con un mensaje que se puede mostrar tal cual, si no hay
    nada que leer o si el texto es demasiado grande (ver _leer_parrafos).
    """
    frases: List[Dict[str, Any]] = []
    total_palabras = 0
    for par in _leer_parrafos(parrafos):
        lista = [unicodedata.normalize("NFC", p) for p in par["palabras"]]
        pesos = [pausa_ms(p) for p in lista]
        pesos[-1] = max(pesos[-1], PAUSA_MS["oracion"])
        inicio = 0
        for frase in _frases_de_parrafo(lista):
            fin = inicio + len(frase)
            frases.append({
                "texto": " ".join(frase),
                "palabras": len(frase),
                "pausa": sum(pesos[inicio:fin]),
            })
            total_palabras += len(frase)
            inicio = fin

    return {
        "motor": "frases",
        "frases": frases,
        "total_palabras": total_palabras,
        "total_frases": len(frases),
        "pausa_base_ms": PAUSA_BASE_MS,
        "cuenta_seg": CUENTA_SEG,
        "wpm": {"min": WPM_MIN, "max": WPM_MAX, "paso": WPM_PASO},
    }
