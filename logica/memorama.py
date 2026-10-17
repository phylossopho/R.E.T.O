#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
R.E.T.O. - Las reglas del Memorama
===========================================================================
Aqui vive la LOGICA del juego, y solo la logica: nada de HTML, nada de
navegador, nada de tiempo. Es un archivo de Python que se puede correr y
probar en la terminal, sin abrir nada.

POR QUE ESTA EN PYTHON Y NO EN EL NAVEGADOR
Porque las reglas son reglas, y las reglas se prueban. Si estuvieran en el
navegador, para comprobarlas habria que abrir la pagina, hacer clic a mano y
contar intentos con los dedos. Aqui se prueban con `python test_memorama.py`
y salen 20 comprobaciones en menos de un segundo.

ADEMAS, ESTO SE PUEDE CAMBIAR SIN ROMPER NADA
La pagina no sabe como se baraja ni cuando una pareja cuenta. Solo pregunta.
Si manana el memorama tiene tres vidas, o puntua por tiempo, o reparte las
cartas de otra manera, se cambia AQUI y la pagina ni se entera.

LO QUE NO ESTA AQUI, Y A PROPOSITO
Ni los colores, ni los dibujitos, ni el texto de los botones, ni los
animaciones. Eso es de la pagina. Aqui solo hay reglas: que cartas hay, cual
se puede voltear, cuando es pareja, y cuando se acabo.

COMO SE USA
    from logica.memorama import catalogos, nueva_partida, voltear, ocultar
    cat = catalogos()
    p = nueva_partida('4x4', 'formas', semilla=7)
    p, r = voltear(p, 3)      # r == 'volteada'
    p, r = voltear(p, 9)      # r == 'pareja' o 'sin-pareja'
    p = ocultar(p)             # vuelve a tapar las que no hicieron pareja

VER LAS PRUEBAS
    python test_memorama.py
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

# ===========================================================================
# LOS CONJUNTOS DE SIMBOLOS
# ===========================================================================
#
# POR QUE HAY VARIOS Y NO UNO SOLO
# R.E.T.O. lo usa gente muy distinta, y lo que para uno es facil para otro es
# imposible. Hay quien ve perfecto los colores y no distingue dos animales
# iguales; hay quien con la vista corta no alcanza a leer un numero pequeno; y
# hay computadoras que NO TIENEN un dibujito y lo muestran como un cuadrito
# vacio.
#
# Por eso hay cuatro, y quien elige elige por el motivo que sea: la vista, el
# aparato, o el gusto. Ninguno es "el bueno": cada uno resuelve un problema
# distinto.
#
#   formas   -> las mas seguras. Se dibujan con CSS, se ven IGUALES en cualquier
#               aparato, no dependen de ningun tipo de letra, y ninguna se
#               confunde con otra porque cada una tiene una silueta distinta.
#   numeros  -> cada numero tiene una forma distinta. Se leen con el Eye
#               Tracker (lee numeros) y entrenan la lectura en voz baja.
#   letras   -> como los numeros, pero con el alfabeto. Para quien esta
#               aprendiendo a leer.
#   emojis   -> los mas bonitos y los que mas les gustan a los ninos. Son los
#               UNICOS que dependen de que el aparato tenga el dibujito.
#
# POR QUE LOS EMOJIS SON UN CONJUNTO Y NO EL PRINCIPAL
# Un emoji que el aparato no tiene se ve como un cuadrito vacio, y en un
# memorama eso es lo PEOR que puede pasar: una carta que nadie puede
# emparejar nunca, porque no se sabe que tiene. Por eso el conjunto de emojis
# esta formado solo por dibujitos viejos (Unicode 9, de 2016, para atras), que
# ya estaban en cualquier telefono y computadora de cuando las escuelas tenian
# internet. Y el de formas no depende de nada: es CSS puro.
#
# Cada conjunto trae 18 simbolos, que es lo que necesita el tablero mas grande
# (4x5 = 20 cartas = 10 parejas), dejando margen para no usar el set entero.

CATALOGOS: Dict[str, Dict[str, Any]] = {
    "formas": {
        "nombre": "Formas",
        "ayuda": "Se ven igual en cualquier aparato. No dependen de nada.",
        # Un simbolo de ejemplo, para que el boton de la pagina pueda pintar
        # una carta chiquita y se vea COMO se ven las de verdad, en vez de
        # solo el nombre. El ejemplo es un dato del conjunto, asi que vive aqui.
        "muestra": "circulo",
        # "tipo" le dice a la pagina como se dibuja. "forma" = la pagina lo
        # pinta con CSS, con una silueta distinta para cada una. "texto" y
        # "emoji" son caracteres y se escriben tal cual.
        "tipo": "forma",
        # Los NOMBRES tienen que existir como clases .memo-forma-<nombre> en
        # 60_juegos.css. Hay una prueba que lo comprueba, para que nadie agregue
        # aqui una forma y se quede sin dibujar.
        "simbolos": [
            "circulo", "cuadrado", "rectangulo", "ovalo", "rombo", "triangulo",
            "hexagono", "estrella", "cruz", "gota", "flecha", "luna",
        ],
    },
    "numeros": {
        "nombre": "Números",
        "ayuda": "Cada número tiene una forma distinta. Bueno para la vista.",
        "muestra": "6",
        "tipo": "texto",
        "simbolos": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "6", "9"],
    },
    "letras": {
        "nombre": "Letras",
        "ayuda": "Como los números, pero con el abecedario.",
        "muestra": "A",
        "tipo": "texto",
        "simbolos": ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"],
    },
    "emojis": {
        "nombre": "Emojis",
        "ayuda": "Los más bonitos. Necesitan un aparato con dibujitos.",
        "muestra": "🐶",
        "tipo": "emoji",
        # Todos de Unicode 9 (2016) o anterior, a proposito. Los mas nuevos
        # (el planeta con anillo, el arandano azul, la aceituna) son de 2019 y
        # 2020, y en una computadora de la escuela salen como un cuadrito.
        "simbolos": [
            "🐶", "🐱", "🦊", "🐻", "🐼", "🐸", "🦁", "🐷",
            "🐰", "🐨", "🦄", "🐙", "🦋", "🐢", "🦉", "⚽",
            "🚗", "🚀", "🌳", "🌞", "🌧️", "🍎", "🍌", "🍓",
        ],
    },
}

# ===========================================================================
# LOS TAMAÑOS
# ===========================================================================
#
# SOLO TRES, Y A PROPOSITO. El juego tiene que ser CORTO.
#
# Se quito el 6x6 de la version anterior, que son 36 cartas y dieciocho
# parejas: en un tablero de 20 minutos, para alguien con dificultad para
# concentrarse es media hora de estar buscando, y a la mitad ya no sabe que
# estaba haciendo. Un memorama que cuesta veinte minutos no se acaba nunca.
#
# Ademas, en una pantalla de 280 px (la mas angosta que se soporta), un tablero
# de 6 columnas deja cada carta en 35 px, por debajo de los 44 que necesita un
# dedo para apuntar bien. Con 5 columnas como maximo, el 4x5 baja justo a 44 en
# esa pantalla, y los otros dos quedan muy holgados.
#
# Cada tamano trae cuantas parejas tiene y como se escribe en el tablero.

TAMANOS: Dict[str, Dict[str, int]] = {
    "3x4": {"columnas": 3, "filas": 4},   # 6 parejas, 12 cartas. El facil.
    "4x4": {"columnas": 4, "filas": 4},   # 8 parejas, 16 cartas. El de siempre.
    "4x5": {"columnas": 4, "filas": 5},   # 10 parejas, 20 cartas. El mas largo.
}

# Que se gagne sin frustrarse: un tablero muy grande tampoco es una fiesta.
MAX_INTENTOS_SIN_CASTIGO = 200

RESULTADOS = (
    "ignorado",           # no se puede voltear (ya esta vuelta, o ya esta encontrada)
    "volteada",           # primera de la pareja: se destapa
    "sin-pareja",         # no son iguales: hay que volverlas a tapar
    "pareja",             # si son iguales: se quedan
    "completo",           # se encontraron todas
)


# ===========================================================================
# LAS REGLAS
# ===========================================================================

def catalogos() -> Dict[str, Any]:
    """Lo que la pagina necesita saber para pintar los botones."""
    return {
        "tamanos": [
            # Se mandan columnas y filas aparte del nombre, porque la pagina los
            # usa para PINTAR la rejillita chiquita del boton. Si solo mandara
            # el texto "4×4", la pagina tendria que adivinar cuantos puntos
            # poner, y es justo el numero del que se trata.
            {"id": tid, "nombre": "%d×%d" % (t["columnas"], t["filas"]),
             "columnas": t["columnas"], "filas": t["filas"],
             "parejas": (t["columnas"] * t["filas"]) // 2}
            for tid, t in TAMANOS.items()
        ],
        "catalogos": [
            {"id": cid, "nombre": c["nombre"], "ayuda": c["ayuda"],
             "tipo": c["tipo"], "muestra": c["muestra"]}
            for cid, c in CATALOGOS.items()
        ],
    }


def barajar(simbolos: List[str], semilla: int | None = None) -> List[str]:
    """Fisher-Yates.

    Se usa el algoritmo de Fisher-Yates y no un "barajar() cualquiera" por dos
    razones. Primera: reparte parejo, o sea que no deja las cartas mas juntas de
    un lado, y un tablero medio ordenado se adivina sin memoria. Segunda:
    Fisher-Yates con semilla da SIEMPRE el mismo tablero, y eso es lo que
    permite probarlo: si una prueba falla, se puede volver a hacer el mismo
    tablero y ver exactamente que pasó.

    Con la semilla que se le pase; sin ella, al azar de verdad.
    """
    r = random.Random(semilla)
    valores = list(simbolos)
    for i in range(len(valores) - 1, 0, -1):
        j = r.randrange(i + 1)
        valores[i], valores[j] = valores[j], valores[i]
    return valores


def nueva_partida(tamano: str, catalogo: str, semilla: int | None = None) -> Dict[str, Any]:
    """Prepara un tablero nuevo.

    Devuelve el estado de la partida. La pagina NO recibe los simbolos de las
    cartas al principio: solo los identificadores. Los simbolos se van uncovering
    uno por uno conforme se voltean, que es justo como funciona un memorama de
    verdad, y no se pueden ver en el codigo de la pagina antes de tiempo.
    """
    if tamano not in TAMANOS:
        raise ValueError("tamaño desconocido: %r" % (tamano,))
    if catalogo not in CATALOGOS:
        raise ValueError("catálogo desconocido: %r" % (catalogo,))

    t = TAMANOS[tamano]
    parejas = (t["columnas"] * t["filas"]) // 2
    simbolos = CATALOGOS[catalogo]["simbolos"]
    if parejas > len(simbolos):
        raise ValueError("el catálogo %r no tiene %d símbolos" % (catalogo, parejas))

    # EL ORDEN IMPORTA, Y ESTE FUE UN FALLO GRAVE
    # Se duplica PRIMERO y se baraja DESPUES. Al reves el tablero queda partido
    # en dos mitades identicas: la carta 0 y la carta 8 llevan lo mismo, la 1 y
    # la 9, y asi en todas. En un tablero de cuatro columnas, cada carta esta
    # exactamente una fila mas abajo que su pareja: el memorama se resolvia
    # mirando para abajo la mitad de abajo, sin recordar nada.
    #
    # Barajar la lista de simbolos y DESPUES pegarle una copia deja la copia
    # en el mismo orden que el original, y eso no es un tablero revuelto: es un
    # tablero con la respuesta a la vista.
    deck = list(simbolos[:parejas]) + list(simbolos[:parejas])
    deck = barajar(deck, semilla)
    cartas = [{"id": i, "simbolo": s, "volteada": False, "emparejada": False}
              for i, s in enumerate(deck)]

    return {
        "tamano": tamano,
        "catalogo": catalogo,
        "columnas": t["columnas"],
        "filas": t["filas"],
        "cartas": cartas,
        "volteadas": [],
        "intentos": 0,
        "parejas": 0,
        "totalParejas": parejas,
        "bloqueado": False,
        "completo": False,
    }


def _visible(partida: Dict[str, Any]) -> Dict[str, Any]:
    """La parte de la partida que la pagina puede ver.

    aqui se quitan los simbolos de las cartas que siguen tapadas. Es la unica
    vez que se copia el estado, y se copia SIN lo que no se debe ver: si la
    pagina recibiera el simbolo de una carta tapada, se podria hacer trampa
    mirando el codigo, y en un juego para ninos eso no es un detalle menor.
    """
    cartas = []
    for c in partida["cartas"]:
        ver = c["volteada"] or c["emparejada"]
        cartas.append({
            "id": c["id"],
            "simbolo": c["simbolo"] if ver else None,
            "volteada": c["volteada"],
            "emparejada": c["emparejada"],
        })
    return {
        "tamano": partida["tamano"],
        "catalogo": partida["catalogo"],
        "columnas": partida["columnas"],
        "filas": partida["filas"],
        "cartas": cartas,
        "volteadas": list(partida["volteadas"]),
        "intentos": partida["intentos"],
        "parejas": partida["parejas"],
        "totalParejas": partida["totalParejas"],
        "bloqueado": partida["bloqueado"],
        "completo": partida["completo"],
    }


def voltear(partida: Dict[str, Any], carta_id: int) -> Tuple[Dict[str, Any], str]:
    """Voltea una carta. Devuelve (estado nuevo, qué pasó).

    "qué pasó" es uno de RESULTADOS, y la pagina lo usa para decidir si
    festeja, si tapa de vuelta, o si no hace nada. Que la regla diga EL QUE le
    paso, y no solo el estado, es lo que deja a la pagina sin logica: no tiene
    que comparar intentos ni parejas para saber si se acabo.
    """
    if partida["bloqueado"] or partida["completo"]:
        return partida, "ignorado"

    carta = next((c for c in partida["cartas"] if c["id"] == carta_id), None)
    if carta is None or carta["volteada"] or carta["emparejada"]:
        return partida, "ignorado"
    if len(partida["volteadas"]) >= 2:
        return partida, "ignorado"

    carta["volteada"] = True
    partida["volteadas"].append(carta_id)
    if len(partida["volteadas"]) < 2:
        return partida, "volteada"

    partida["intentos"] += 1
    a = partida["cartas"][partida["volteadas"][0]]
    b = partida["cartas"][partida["volteadas"][1]]

    if a["simbolo"] == b["simbolo"]:
        a["emparejada"] = True
        b["emparejada"] = True
        partida["volteadas"] = []
        partida["parejas"] += 1
        if partida["parejas"] == partida["totalParejas"]:
            partida["completo"] = True
            return partida, "completo"
        return partida, "pareja"

    # Queda bloqueada hasta que se llame a ocultar(). Quien llama (la pagina)
    # muestra las dos cartas un instante y despues las tapa; si el motor se
    # destapara solo, se verian las dos cartas y la que no era en un par.
    partida["bloqueado"] = True
    return partida, "sin-pareja"


def ocultar(partida: Dict[str, Any]) -> Dict[str, Any]:
    """Vuelve a tapar las dos cartas que no hicieron pareja."""
    for cid in list(partida["volteadas"]):
        carta = partida["cartas"][cid]
        carta["volteada"] = False
    partida["volteadas"] = []
    partida["bloqueado"] = False
    return partida


def estado_para_la_pagina(partida: Dict[str, Any]) -> Dict[str, Any]:
    """La partida como la pagina la ve: sin simbolos de las cartas tapadas."""
    return _visible(partida)
