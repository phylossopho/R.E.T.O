# -*- coding: utf-8 -*-
"""Secuencia: el juego de memoria secuencial.

QUÉ ES
    Se enciende una fila de botones, uno tras otro, y la persona los repite en
    el mismo orden. Si lo logra, la secuencia crece un paso. Es el juego que
    mucha gente conoce como "Simon", y entrena la memoria de trabajo: guardar
    una lista corta en la cabeza el tiempo justo para repetirla.

QUÉ HACE ESTE ARCHIVO Y QUÉ NO
    Aquí viven las REGLAS que no cambian con la pantalla: cuántos botones hay,
    qué velocidades se ofrecen, qué colores y qué notas lleva cada botón, y
    cómo se arma una secuencia. Lo que pasa mientras se juega (encender,
    sonar, comparar un toque con el paso que toca) es de la PÁGINA, por la misma
    razón que en Schulte: un viaje al servidor por cada toque retrasaría el
    juego, y aquí el tiempo entre pasos es parte de lo que se entrena.

    Por eso la secuencia se pide UNA vez al empezar, completa, y de ahí en
    adelante todo va en el navegador. No hay nada que esconder (es un juego de
    memoria, no de adivinar), así que mandarla entera no le quita nada al
    ejercicio.

POR QUÉ ESTÁ EN PYTHON Y NO EN EL NAVEGADOR
    Porque se puede probar sin abrir nada (`test_secuencia.py`), y porque aquí
    hay números que NO se deben decidir a ojo:

    - Las velocidades. Nunca hay más de un destello cada 0.9 segundos, muy por
      debajo de los tres por segundo que la norma WCAG 2.3.1 señala como el
      límite para no afectar a personas con sensibilidad a la luz.
    - Los colores. Cada paleta se midió: el texto sobre cada botón tiene que
      leerse (contraste de 4.5 o más), y la paleta pensada para daltonismo se
      eligió comparando cómo se ven los colores con visión normal y con las
      tres formas más comunes de daltonismo.
    - Las notas. Cada botón suena distinto, y la diferencia entre dos notas
      vecinas es de al menos dos semitonos: más cerca que eso, a mucha gente
      le cuesta distinguirlas.
"""

import random

# --------------------------------------------------------------------------
# Lo que el juego ofrece. Se lee desde el navegador para armar el modal de
# ajustes, así que cada opción trae su nombre y su ayuda: quien elige tiene que
# saber qué está escogiendo.
# --------------------------------------------------------------------------

BOTONES = {
    "4": {"columnas": 2, "filas": 2, "nombre": "Cuatro",
          "ayuda": "Cuatro botones. Para empezar."},
    "6": {"columnas": 3, "filas": 2, "nombre": "Seis",
          "ayuda": "Seis botones. Hay más que recordar."},
    "9": {"columnas": 3, "filas": 3, "nombre": "Nueve",
          "ayuda": "Nueve botones. El reto más grande."},
}

# La meta es hasta dónde llega una partida. "sin" no tiene tope: se juega hasta
# que la persona quiera parar. Las partidas cortas importan: terminar algo es
# lo que más ayuda a seguir intentando.
METAS = {
    "5": {"pasos": 5, "nombre": "5 pasos", "ayuda": "Una partida corta."},
    "8": {"pasos": 8, "nombre": "8 pasos", "ayuda": "Una partida mediana."},
    "12": {"pasos": 12, "nombre": "12 pasos", "ayuda": "Una partida larga."},
    "sin": {"pasos": None, "nombre": "Sin meta",
            "ayuda": "Se juega hasta que tú quieras parar."},
}

# Con cuántos pasos arranca la primera ronda.
INICIOS = {
    "1": {"pasos": 1, "nombre": "1 paso", "ayuda": "Empieza muy despacio."},
    "2": {"pasos": 2, "nombre": "2 pasos", "ayuda": "Un comienzo tranquilo."},
    "3": {"pasos": 3, "nombre": "3 pasos", "ayuda": "Se salta lo más fácil."},
}

# LAS VELOCIDADES, Y EL LÍMITE QUE NO SE CRUZA
# `encendido` es cuánto se queda prendido un botón y `pausa` cuánto se apaga
# antes del siguiente, los dos en milisegundos. Un ciclo completo es la suma.
#
# La norma WCAG 2.3.1 dice que nada debe destellar más de tres veces por
# segundo, porque a partir de ahí puede provocar crisis en personas con
# epilepsia fotosensible. Eso es un ciclo de 334 ms. Aquí el más rápido es de
# 900 ms (poco más de un destello por segundo), así que sobra margen incluso si
# alguien pone el tablero grande. Y no hay una opción más rápida: ir más
# deprisa no es un reto de memoria, es un reto de reflejos, y es otro juego.
MIN_CICLO_MS = 900

VELOCIDADES = {
    "muy-lenta": {"encendido": 1100, "pausa": 500, "nombre": "Muy lenta",
                  "ayuda": "Cada paso se ve más de un segundo."},
    "lenta": {"encendido": 800, "pausa": 400, "nombre": "Lenta",
              "ayuda": "Cada paso se ve casi un segundo."},
    "normal": {"encendido": 600, "pausa": 300, "nombre": "Normal",
               "ayuda": "El ritmo del juego de siempre."},
}

# LO QUE LLEVA ESCRITO CADA BOTÓN
# Los números van del 1 al 9. Las letras NO son el abecedario seguido: se
# dejaron fuera las que se confunden entre sí cuando se lee con dislexia (b y d,
# p y q, n y u, m y w) y las que se parecen a un número (I, O, S). Quedan nueve
# letras de forma muy distinta una de otra.
ETIQUETAS = {
    "numeros": {"nombre": "Números", "ayuda": "Del 1 al 9.",
                "valores": ["1", "2", "3", "4", "5", "6", "7", "8", "9"]},
    "letras": {"nombre": "Letras",
               "ayuda": "Letras que no se confunden entre sí.",
               "valores": ["A", "E", "H", "K", "L", "R", "T", "Y", "Z"]},
    "ninguna": {"nombre": "Ninguna", "ayuda": "Solo la forma y el color.",
                "valores": []},
}

# LAS FORMAS. Cada botón lleva la suya, y es lo que permite jugar sin ver los
# colores: el color es un apoyo, nunca la única pista. El dibujo lo hace la
# página; aquí solo está el nombre, que es también lo que dice la voz.
FORMAS = [
    {"id": "circulo", "nombre": "círculo"},
    {"id": "cuadrado", "nombre": "cuadrado"},
    {"id": "triangulo", "nombre": "triángulo"},
    {"id": "rombo", "nombre": "rombo"},
    {"id": "estrella", "nombre": "estrella"},
    {"id": "hexagono", "nombre": "hexágono"},
    {"id": "cruz", "nombre": "cruz"},
    {"id": "pentagono", "nombre": "pentágono"},
    {"id": "gota", "nombre": "gota"},
]

# LAS NOTAS (en hercios), una por botón. Es una escala pentatónica: cualquier
# combinación suena bien junta, y no hay una nota "equivocada" que resulte
# desagradable. Con menos botones se separan más, para que cada uno se
# distinga mejor.
NOTAS = {
    "4": [261.63, 329.63, 392.00, 523.25],
    "6": [261.63, 293.66, 329.63, 392.00, 440.00, 523.25],
    "9": [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25,
          783.99],
}

# Tope de la secuencia cuando no hay meta. Nadie llega a 50 de memoria, pero un
# tope existe para que la lista no crezca sin fin.
LARGO_SIN_META = 50
LARGO_MAX = 60

# --------------------------------------------------------------------------
# LOS COLORES
# --------------------------------------------------------------------------

# Los nueve colores de la paleta para daltonismo, que son los de Okabe e Ito
# (una paleta publicada para que se distingan con las formas más comunes de
# daltonismo), más un gris y un casi negro que completan nueve.
OKABE_ITO = {
    "azul": "#0072B2", "naranja": "#E69F00", "rosa": "#CC79A7",
    "amarillo": "#F0E442", "celeste": "#56B4E9", "bermellon": "#D55E00",
    "verde": "#009E73", "gris": "#999999", "negro": "#222222",
}

# Con 4 y con 6 botones NO se usan los primeros: se eligieron, entre todas las
# combinaciones posibles, las que más se distinguen entre sí (comparando cómo
# se ven con visión normal y con protanopía, deuteranopía y tritanopía). Con 4
# la diferencia mínima es de 23.7 en la escala CIE Lab, con 6 es de 17, y con
# los 9 baja a 7: ahí ya manda la forma, y por eso la forma siempre está.
_DALTONISMO = {
    "4": ["#0072B2", "#F0E442", "#56B4E9", "#D55E00"],
    "6": ["#0072B2", "#E69F00", "#CC79A7", "#F0E442", "#56B4E9", "#D55E00"],
    "9": ["#0072B2", "#E69F00", "#CC79A7", "#F0E442", "#56B4E9", "#D55E00",
          "#009E73", "#999999", "#222222"],
}

_PASTEL = ["#A9CCE3", "#D2B4DE", "#A9DFBF", "#F9E79F", "#F5B7B1", "#A3E4D7",
           "#F8C9A0", "#D5D8DC", "#C5CAE9"]

_ALTO_CONTRASTE = ["#000000", "#FFFFFF", "#FFE600", "#0033A0", "#FF7A00",
                   "#00704A", "#8A00C2", "#B30000", "#00BFFF"]

# Nueve grises repartidos de claro a oscuro. Con menos botones se toman
# repartidos (no los primeros), para que se note la diferencia.
_GRISES = ["#F5F5F5", "#D4D4D4", "#B3B3B3", "#8F8F8F", "#6B6B6B", "#4D4D4D",
           "#363636", "#222222", "#0D0D0D"]

TEXTO_OSCURO = "#1A1A1A"
TEXTO_CLARO = "#FFFFFF"


def _canal(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminancia(color):
    """Luminancia relativa de un color "#RRGGBB", como la define WCAG."""
    h = color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _canal(r) + 0.7152 * _canal(g) + 0.0722 * _canal(b)


def contraste(a, b):
    """Contraste entre dos colores, de 1 (iguales) a 21 (negro y blanco)."""
    la, lb = luminancia(a), luminancia(b)
    claro, oscuro = max(la, lb), min(la, lb)
    return (claro + 0.05) / (oscuro + 0.05)


def color_de_texto(fondo):
    """El color con el que se lee mejor algo escrito sobre `fondo`.

    Elige entre un casi negro y el blanco el que dé más contraste. El casi
    negro (y no el negro puro) es para que el texto sobre colores suaves no
    se vea duro.
    """
    if contraste(fondo, TEXTO_OSCURO) >= contraste(fondo, TEXTO_CLARO):
        return TEXTO_OSCURO
    return TEXTO_CLARO


def _repartidos(lista, cuantos):
    """`cuantos` elementos de `lista`, repartidos de punta a punta."""
    if cuantos == 1:
        return [lista[0]]
    paso = (len(lista) - 1) / float(cuantos - 1)
    return [lista[int(round(i * paso))] for i in range(cuantos)]


def _con_texto(colores):
    return [{"fondo": c, "texto": color_de_texto(c)} for c in colores]


def _paleta_por_cantidad(armar):
    return {cant: armar(int(cant)) for cant in BOTONES}


PALETAS = {
    "daltonismo": {
        "nombre": "Seguros para daltonismo",
        "ayuda": "Colores que se distinguen con las formas más comunes de "
                 "daltonismo. Siempre llevan también una forma.",
        "colores": {c: _con_texto(_DALTONISMO[c]) for c in BOTONES},
    },
    "suave": {
        "nombre": "Suaves",
        "ayuda": "Colores apagados, que cansan menos la vista.",
        "colores": _paleta_por_cantidad(lambda n: _con_texto(_PASTEL[:n])),
    },
    "alto-contraste": {
        "nombre": "Alto contraste",
        "ayuda": "Colores muy distintos entre sí, claros contra oscuros.",
        "colores": _paleta_por_cantidad(
            lambda n: _con_texto(_ALTO_CONTRASTE[:n])),
    },
    "grises": {
        "nombre": "Grises",
        "ayuda": "Sin color: de claro a oscuro. Se distingue por la forma.",
        "colores": _paleta_por_cantidad(
            lambda n: _con_texto(_repartidos(_GRISES, n))),
    },
    "unico": {
        "nombre": "Un solo color",
        "ayuda": "Todos iguales, del color del tema. Se distingue por la "
                 "forma, la etiqueta y el sonido.",
        "colores": _paleta_por_cantidad(
            lambda n: [{"fondo": None, "texto": None}] * n),
    },
    "personalizada": {
        "nombre": "La mía",
        "ayuda": "Tú eliges el color de cada botón.",
        "colores": None,
    },
}


def catalogos():
    """Todo lo que el juego ofrece, para armar el modal de ajustes.

    Cada cosa trae sus números ya calculados (los destellos por segundo, el
    texto de cada color, las notas) para que el navegador no los calcule otra
    vez y no puedan discrepar.
    """
    return {
        "botones": [
            {"id": bid, "columnas": b["columnas"], "filas": b["filas"],
             "nombre": b["nombre"], "ayuda": b["ayuda"],
             "total": b["columnas"] * b["filas"]}
            for bid, b in BOTONES.items()
        ],
        "metas": [
            {"id": mid, "pasos": m["pasos"], "nombre": m["nombre"],
             "ayuda": m["ayuda"]}
            for mid, m in METAS.items()
        ],
        "inicios": [
            {"id": iid, "pasos": i["pasos"], "nombre": i["nombre"],
             "ayuda": i["ayuda"]}
            for iid, i in INICIOS.items()
        ],
        "velocidades": [
            {"id": vid, "encendido": v["encendido"], "pausa": v["pausa"],
             "nombre": v["nombre"], "ayuda": v["ayuda"]}
            for vid, v in VELOCIDADES.items()
        ],
        "etiquetas": [
            {"id": eid, "nombre": e["nombre"], "ayuda": e["ayuda"],
             "valores": e["valores"]}
            for eid, e in ETIQUETAS.items()
        ],
        "formas": FORMAS,
        "paletas": [
            {"id": pid, "nombre": p["nombre"], "ayuda": p["ayuda"],
             "personalizable": p["colores"] is None, "colores": p["colores"]}
            for pid, p in PALETAS.items()
        ],
        "base_personalizada": _DALTONISMO["9"],
        "notas": NOTAS,
        "largo_sin_meta": LARGO_SIN_META,
    }


# --------------------------------------------------------------------------
# LA SECUENCIA
# --------------------------------------------------------------------------

# Cuántas veces seguidas puede salir el mismo botón. Dos: con tres iguales
# seguidos, el paso del medio se pierde entre los otros dos y se cuenta mal, y
# eso no es memoria, es un fallo de la secuencia.
MAX_IGUALES_SEGUIDOS = 2


def nueva_secuencia(botones, largo, semilla=None):
    """Arma la secuencia de una partida.

    `botones` es el id de la cantidad ("4", "6" o "9") y `largo` cuántos pasos
    tiene en total. Devuelve una lista de índices (0 es el primer botón) y la
    semilla usada, para poder repetirla: con la misma semilla sale siempre la
    misma. Esa propiedad es la que permite probarla.

    Las rondas NO piden una secuencia nueva: la ronda 3 es los primeros tres
    pasos de ESTA misma lista. Así lo que se aprendió en la ronda anterior
    sigue valiendo y la secuencia solo crece, que es el juego.
    """
    if botones not in BOTONES:
        raise ValueError("cantidad de botones desconocida: %r" % (botones,))
    if isinstance(largo, bool) or not isinstance(largo, int):
        raise ValueError("el largo tiene que ser un número entero")
    if largo < 1 or largo > LARGO_MAX:
        raise ValueError("el largo va de 1 a %d" % LARGO_MAX)
    if semilla is not None and (isinstance(semilla, bool)
                                or not isinstance(semilla, int)):
        raise ValueError("la semilla tiene que ser un número entero")

    if semilla is None:
        semilla = random.SystemRandom().randrange(2 ** 31)
    rng = random.Random(semilla)

    total = BOTONES[botones]["columnas"] * BOTONES[botones]["filas"]
    secuencia = []
    for _ in range(largo):
        opciones = list(range(total))
        if len(secuencia) >= MAX_IGUALES_SEGUIDOS:
            ultimos = secuencia[-MAX_IGUALES_SEGUIDOS:]
            if len(set(ultimos)) == 1:
                opciones.remove(ultimos[0])
        secuencia.append(rng.choice(opciones))

    return {"botones": botones, "largo": largo, "semilla": semilla,
            "secuencia": secuencia}
