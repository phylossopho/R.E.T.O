# -*- coding: utf-8 -*-
"""Mahjong: el solitario de fichas apiladas en pisos.

QUÉ ES
    Un montón de fichas puestas en pisos, una sobre otra. Se quitan DE DOS EN
    DOS: dos fichas iguales y libres. Una ficha está libre si no tiene nada
    encima y, por lo menos, uno de sus dos lados (izquierda o derecha) está
    despejado. Se gana al quitar todas.

QUÉ HACE ESTE ARCHIVO Y QUÉ NO
    Aquí viven las REGLAS que no cambian con la pantalla: cómo son los tableros
    de cada nivel, qué es una ficha libre, cómo se reparten las caras, y cómo
    se garantiza que una partida SE PUEDE GANAR. Lo que pasa mientras se juega
    (elegir, quitar, deshacer) es de la PÁGINA, por la misma razón que en
    Schulte y en Secuencia: un viaje al servidor por cada toque retrasaría el
    juego.

    La regla de "ficha libre" está escrita DOS veces: aquí y en
    scripts/reto-mahjong-reglas.js. No es un descuido: el navegador la necesita
    en cada toque para marcar qué se puede tocar. Por eso `test_mahjong.py`
    corre el archivo de JavaScript de verdad y comprueba que las dos digan lo
    mismo en cientos de tableros. Si una cambia, esa prueba falla.

POR QUÉ SIEMPRE SE PUEDE GANAR (AL REVÉS)
    Barajar las caras al azar sobre un tablero deja, muy a menudo, partidas
    imposibles: es el defecto clásico de este juego. Aquí se hace al revés: se
    "juega" el tablero hacia atrás. Se eligen dos posiciones libres, se quitan,
    se eligen otras dos, y así hasta vaciarlo. Cada pareja de posiciones que se
    quitó se queda con UNA misma cara. Así existe, por construcción, al menos
    una forma de quitarlo todo.

    Ojo con lo que NO garantiza: la persona puede quitar parejas en otro orden
    y llegar a un punto sin jugadas. Para eso están "deshacer" (sin límite) y
    "revolver", que vuelve a repartir las caras de lo que queda con el mismo
    método, y por lo tanto devuelve una partida ganable.

LOS NIVELES
    Fácil son 3 pisos; medio y difícil, 4. Lo que los separa, además de los
    pisos, es cuántas caras distintas hay y cómo están apiladas:

    - Fácil:   36 fichas, 6 caras distintas, todo alineado. Hay muchas parejas.
    - Medio:   54 fichas, 9 caras distintas, todo alineado.
    - Difícil: 68 fichas, 17 caras distintas (cada una cuatro veces, como en el
               juego clásico) y los pisos de arriba van "a caballo": cada ficha
               tapa a varias de abajo, así que cuesta más liberarlas.
"""

import random

from logica import secuencia

# --------------------------------------------------------------------------
# LA MEDIDA: una ficha ocupa 2 x 2 unidades. Las posiciones se escriben en
# unidades, no en fichas, porque en los pisos de arriba una ficha puede quedar
# a caballo, a media ficha de la de abajo.
# --------------------------------------------------------------------------

ANCHO_FICHA = 2
ALTO_FICHA = 2

# Cada capa: (piso, x inicial, y inicial, columnas, filas). Las fichas de una
# capa van de 2 en 2 unidades.
NIVELES = {
    "facil": {
        "nombre": "Fácil",
        "ayuda": "3 pisos, 36 fichas y 6 caras distintas. Para empezar.",
        "tipos": 6,
        "pares_por_tipo": 3,
        "capas": [(0, 0, 0, 6, 4), (1, 2, 2, 4, 2), (2, 4, 2, 2, 2)],
    },
    "medio": {
        "nombre": "Medio",
        "ayuda": "4 pisos, 54 fichas y 9 caras distintas.",
        "tipos": 9,
        "pares_por_tipo": 3,
        "capas": [(0, 0, 0, 8, 4), (1, 2, 2, 6, 2), (2, 4, 2, 4, 2),
                  (3, 6, 3, 2, 1)],
    },
    "dificil": {
        "nombre": "Difícil",
        "ayuda": "4 pisos, 68 fichas y 17 caras distintas. Los pisos de arriba "
                 "van a caballo, y cuesta más dejar libres las fichas.",
        "tipos": 17,
        "pares_por_tipo": 2,
        "capas": [(0, 0, 0, 8, 5), (1, 3, 1, 5, 4), (2, 5, 3, 3, 2),
                  (3, 7, 3, 1, 2)],
    },
}

# Cuántas veces se reintenta armar un tablero antes de rendirse. SALE DE
# MEDIR, no de adivinar: ver test_mahjong.py. Con 300 hay margen de sobra
# sobre el peor caso conocido, y rendirse significaría devolver un tablero
# que quizá no se puede ganar, que es justo lo que este archivo evita.
INTENTOS = 300

# Tope de fichas que se aceptan en una petición de revolver. El tablero más
# grande tiene 68; este tope solo evita que alguien mande una lista enorme.
MAX_FICHAS = 144

# --------------------------------------------------------------------------
# LAS CARAS. Cada ficha lleva un dibujo (o un número, o una letra): ESO es lo
# que la distingue. El color es un apoyo, nunca la única pista, y por eso los
# colores se repiten entre caras y los dibujos no.
# --------------------------------------------------------------------------

DIBUJOS = [
    ("circulo", "círculo"), ("cuadrado", "cuadrado"),
    ("triangulo", "triángulo"), ("rombo", "rombo"), ("estrella", "estrella"),
    ("hexagono", "hexágono"), ("cruz", "cruz"), ("pentagono", "pentágono"),
    ("gota", "gota"), ("corazon", "corazón"), ("luna", "luna"), ("sol", "sol"),
    ("rayo", "rayo"), ("anillo", "anillo"), ("flecha", "flecha"),
    ("casa", "casa"), ("hoja", "hoja"),
]

# LAS LETRAS. De cada pareja que se confunde al leer con dislexia (b/d, p/q,
# n/u, m/w) entra UNA sola, y no entran I, O ni S, que se parecen a un 1, un 0
# y un 5. Se escriben siempre en mayúscula. Son 17, las que hacen falta para el
# nivel difícil.
LETRAS = ["A", "B", "C", "E", "F", "H", "J", "K", "L", "M", "P", "R", "T", "V",
          "X", "Y", "Z"]

NUMEROS = [str(n) for n in range(1, 18)]

# LOS EMOJIS. Diecisiete, los que hacen falta para el nivel difícil. Se
# escogieron por SILUETA y por color, no por tema: ninguno se parece a otro a
# primera vista (nada de dos caras de animales casi iguales, ni dos frutas
# redondas rojas). Es el mismo principio que con los dibujos: lo que distingue
# a una ficha es lo que lleva, y el color de la ficha solo acompaña. El
# "nombre" es lo que lee el lector de pantalla y lo que dice la voz.
EMOJIS = [
    ("🐶", "perro"), ("🐱", "gato"), ("🐸", "rana"), ("🐼", "panda"),
    ("🍎", "manzana"), ("🍌", "plátano"), ("🍇", "uvas"), ("🍓", "fresa"),
    ("🚗", "coche"), ("✈️", "avión"), ("⚽", "balón"), ("🎈", "globo"),
    ("🌙", "luna"), ("🌸", "flor"), ("🏠", "casa"), ("🎵", "nota musical"),
    ("🔔", "campana"),
]

CARAS = {
    "dibujos": {
        "nombre": "Dibujos",
        "ayuda": "Círculo, estrella, corazón… Lo más fácil de distinguir.",
        "valores": [{"id": i, "nombre": n} for i, n in DIBUJOS],
    },
    "numeros": {
        "nombre": "Números",
        "ayuda": "Del 1 al 17.",
        "valores": [{"id": n, "nombre": n} for n in NUMEROS],
    },
    "letras": {
        "nombre": "Letras",
        "ayuda": "Letras que no se confunden entre sí.",
        "valores": [{"id": c, "nombre": "letra " + c} for c in LETRAS],
    },
    "emojis": {
        "nombre": "Emojis",
        "ayuda": "Perro, manzana, coche, luna… Dibujos a color, fáciles de reconocer.",
        "valores": [{"id": e, "nombre": n} for e, n in EMOJIS],
    },
}

TIPOS_MAX = len(DIBUJOS)


# --------------------------------------------------------------------------
# EL TABLERO Y LA REGLA DE LAS FICHAS LIBRES
# --------------------------------------------------------------------------

def posiciones(nivel):
    """Las posiciones (x, y, piso) de un nivel, en un orden fijo.

    El orden es de abajo hacia arriba y, dentro de un piso, de arriba hacia
    abajo y de izquierda a derecha. Ese orden es también el número de cada
    ficha, así que no cambia entre partidas del mismo nivel.
    """
    if nivel not in NIVELES:
        raise ValueError("nivel desconocido: %r" % (nivel,))
    salida = []
    for piso, x0, y0, columnas, filas in NIVELES[nivel]["capas"]:
        for f in range(filas):
            for c in range(columnas):
                salida.append((x0 + c * ANCHO_FICHA, y0 + f * ALTO_FICHA, piso))
    salida.sort(key=lambda p: (p[2], p[1], p[0]))
    return salida


def _tapa(a, b):
    """True si la ficha `b` está encima de la `a` (aunque sea en parte)."""
    return (b[2] == a[2] + 1 and abs(b[0] - a[0]) < ANCHO_FICHA
            and abs(b[1] - a[1]) < ALTO_FICHA)


def _vecina(a, b, lado):
    """True si `b` está pegada a `a` en el mismo piso, a la izquierda
    (lado = -1) o a la derecha (lado = 1)."""
    if b[2] != a[2] or abs(b[1] - a[1]) >= ALTO_FICHA:
        return False
    dx = b[0] - a[0]
    if lado < 0:
        return -ANCHO_FICHA <= dx < 0
    return 0 < dx <= ANCHO_FICHA


def libres(pos):
    """Índices de las posiciones libres de una lista de posiciones (x, y, piso).

    Libre quiere decir: nada encima Y (nada a la izquierda O nada a la
    derecha). Las posiciones que se pasan son solo las que SIGUEN en el
    tablero; las que ya se quitaron no cuentan.
    """
    salida = []
    for i, a in enumerate(pos):
        tapada = False
        izquierda = False
        derecha = False
        for j, b in enumerate(pos):
            if i == j:
                continue
            if _tapa(a, b):
                tapada = True
                break
            if _vecina(a, b, -1):
                izquierda = True
            elif _vecina(a, b, 1):
                derecha = True
        if not tapada and not (izquierda and derecha):
            salida.append(i)
    return salida


def jugadas(fichas):
    """Las parejas que se pueden quitar ahora: dos fichas libres con la misma
    cara. `fichas` es una lista de dicts con id, x, y, z y t. Devuelve una
    lista de pares de ids."""
    pos = [(f["x"], f["y"], f["z"]) for f in fichas]
    libre = [fichas[i] for i in libres(pos)]
    salida = []
    for i in range(len(libre)):
        for j in range(i + 1, len(libre)):
            if libre[i]["t"] == libre[j]["t"]:
                salida.append((libre[i]["id"], libre[j]["id"]))
    return salida


# --------------------------------------------------------------------------
# ARMAR UNA PARTIDA QUE SE PUEDE GANAR
# --------------------------------------------------------------------------

def _vaciar(pos, rng):
    """Quita el tablero de dos en dos, siempre con fichas libres.

    Devuelve la lista de parejas (índices en `pos`) en el orden en que se
    quitaron, o None si se atascó (quedó una sola ficha libre con otras
    tapadas). Quien llama reintenta con otra mezcla.
    """
    quedan = list(range(len(pos)))
    parejas = []
    while quedan:
        sub = [pos[i] for i in quedan]
        libre = [quedan[k] for k in libres(sub)]
        if len(libre) < 2:
            return None
        a, b = rng.sample(libre, 2)
        parejas.append((a, b))
        quedan.remove(a)
        quedan.remove(b)
    return parejas


def _validar_semilla(semilla):
    if semilla is not None and (isinstance(semilla, bool)
                                or not isinstance(semilla, int)):
        raise ValueError("la semilla tiene que ser un número entero")


def _generar(nivel, semilla=None):
    """Arma una partida y devuelve (partida, solucion).

    `solucion` es la lista de parejas de ids en el orden en que se pueden
    quitar. Sirve para las pruebas y no sale al navegador.
    """
    if nivel not in NIVELES:
        raise ValueError("nivel desconocido: %r" % (nivel,))
    _validar_semilla(semilla)
    if semilla is None:
        semilla = random.SystemRandom().randrange(2 ** 31)
    rng = random.Random(semilla)
    cfg = NIVELES[nivel]
    pos = posiciones(nivel)

    parejas = None
    for _ in range(INTENTOS):
        parejas = _vaciar(pos, rng)
        if parejas is not None:
            break
    if parejas is None:
        raise RuntimeError("no se pudo armar un tablero de %s" % nivel)

    # Cada cara se usa en `pares_por_tipo` parejas. Se mezclan para que las
    # parejas que se quitan primero no sean siempre de las mismas caras.
    caras = []
    for t in range(cfg["tipos"]):
        caras += [t] * cfg["pares_por_tipo"]
    rng.shuffle(caras)

    tipo = {}
    for (a, b), t in zip(parejas, caras):
        tipo[a] = t
        tipo[b] = t
    fichas = [{"id": i, "x": p[0], "y": p[1], "z": p[2], "t": tipo[i]}
              for i, p in enumerate(pos)]
    solucion = [(a, b) for a, b in parejas]
    partida = {
        "nivel": nivel,
        "semilla": semilla,
        "fichas": fichas,
        "pisos": max(p[2] for p in pos) + 1,
    }
    return partida, solucion


def nueva_partida(nivel, semilla=None):
    """Arma la partida de un nivel. Con la misma semilla sale la misma."""
    return _generar(nivel, semilla)[0]


def _revisar_fichas(fichas):
    """Comprueba la lista que manda el navegador para revolver."""
    if not isinstance(fichas, list) or not fichas:
        raise ValueError("faltan las fichas")
    if len(fichas) > MAX_FICHAS:
        raise ValueError("hay demasiadas fichas")
    vistos = set()
    for f in fichas:
        if not isinstance(f, dict):
            raise ValueError("una ficha no es válida")
        for clave in ("id", "x", "y", "z", "t"):
            v = f.get(clave)
            if isinstance(v, bool) or not isinstance(v, int):
                raise ValueError("la ficha necesita %s como número entero"
                                 % clave)
        if f["id"] in vistos:
            raise ValueError("hay dos fichas con el mismo id")
        vistos.add(f["id"])
        if f["z"] < 0 or f["z"] > 9 or f["t"] < 0 or f["t"] >= TIPOS_MAX:
            raise ValueError("una ficha tiene datos fuera de rango")
    cuentas = {}
    for f in fichas:
        cuentas[f["t"]] = cuentas.get(f["t"], 0) + 1
    if any(n % 2 for n in cuentas.values()):
        raise ValueError("cada cara tiene que estar un número par de veces")


def _revolver(fichas, semilla=None):
    _revisar_fichas(fichas)
    _validar_semilla(semilla)
    if semilla is None:
        semilla = random.SystemRandom().randrange(2 ** 31)
    rng = random.Random(semilla)
    pos = [(f["x"], f["y"], f["z"]) for f in fichas]

    parejas = None
    for _ in range(INTENTOS):
        parejas = _vaciar(pos, rng)
        if parejas is not None:
            break
    if parejas is None:
        raise ValueError("con esas fichas no se puede armar una partida")

    # Las mismas caras que quedaban, repartidas de nuevo.
    caras = []
    cuentas = {}
    for f in fichas:
        cuentas[f["t"]] = cuentas.get(f["t"], 0) + 1
    for t, n in cuentas.items():
        caras += [t] * (n // 2)
    rng.shuffle(caras)

    tipo = {}
    for (a, b), t in zip(parejas, caras):
        tipo[a] = t
        tipo[b] = t
    nuevas = [{"id": f["id"], "t": tipo[i]} for i, f in enumerate(fichas)]
    solucion = [(fichas[a]["id"], fichas[b]["id"]) for a, b in parejas]
    return nuevas, solucion


def revolver(fichas, semilla=None):
    """Vuelve a repartir las caras de las fichas que quedan.

    Mantiene las mismas caras (cuántas hay de cada una) y las mismas
    posiciones; solo cambia cuál va en cuál. Devuelve [{id, t}], y la partida
    resultante se puede ganar.
    """
    return _revolver(fichas, semilla)[0]


def catalogos():
    """Todo lo que el juego ofrece, para armar la pantalla y el modal."""
    niveles = []
    for nid, n in NIVELES.items():
        pos = posiciones(nid)
        niveles.append({
            "id": nid,
            "nombre": n["nombre"],
            "ayuda": n["ayuda"],
            "pisos": max(p[2] for p in pos) + 1,
            "fichas": len(pos),
            "tipos": n["tipos"],
            "ancho": max(p[0] for p in pos) + ANCHO_FICHA,
            "alto": max(p[1] for p in pos) + ALTO_FICHA,
        })
    paletas = []
    for pid, p in secuencia.PALETAS.items():
        paletas.append({
            "id": pid,
            "nombre": p["nombre"],
            "ayuda": p["ayuda"],
            "personalizable": p["colores"] is None,
            # Nueve colores, que se reparten entre las caras de vuelta y vuelta.
            "colores": None if p["colores"] is None else p["colores"]["9"],
        })
    return {
        "niveles": niveles,
        "caras": [
            {"id": cid, "nombre": c["nombre"], "ayuda": c["ayuda"],
             "valores": c["valores"]}
            for cid, c in CARAS.items()
        ],
        "paletas": paletas,
        "base_personalizada": secuencia.catalogos()["base_personalizada"],
        "notas": secuencia.NOTAS["9"],
    }
