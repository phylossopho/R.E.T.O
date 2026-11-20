"""La tabla de Schulte: el tablero y las reglas.

QUÉ ES
    Una rejilla de símbolos puestos al azar. La persona los busca EN ORDEN,
    del primero al último, y toca cada uno. Al terminar, gana quien tardó menos.

    La inventó Walter Schulte, un psiquiatra alemán, como instrumento de
    psicodiagnóstico para estudiar la atención; después se convirtió en un
    juego de entrenamiento, y es lo que hoy casi todo el mundo conoce.

QUÉ HACE ESTE ARCHIVO Y QUÉ NO
    Aquí vive UNA COSA: cómo se arma el tablero. Qué pasa cuando tocas, el
    reloj, el desvanecido y los sonidos son de la PÁGINA, que es lo único que
    sabe lo que está pasando en este momento.

POR QUÉ ESTÁ EN PYTHON Y NO EN EL NAVEGADOR
    Porque se puede probar. La regla del proyecto es que la lógica va aquí y se
    prueba sin abrir nada: `test_schulte.py` importa este archivo de verdad y
    comprueba que no falte ningún símbolo, que el tablero no sea predecible y
    que con la misma semilla salga siempre el mismo. Esa última es la que más
    importa: sin ella, un fallo sería "a veces el juego va raro", que es la
    forma más difícil de encontrar un error.

    Y hay una razón de peso para que el tablero NO se pida en cada toque: el
    juego se cronometra. Un viaje de ida y vuelta al servidor por cada casilla
    falsearía el tiempo, y el tiempo es justo lo que se está midiendo. Así que
    el tablero se pide UNA vez al empezar y de ahí en adelante todo va en el
    navegador.

LO QUE NO HACE, Y POR QUÉ
    No tiene nada que esconder. En el memorama el servidor guarda los símbolos
    de las cartas tapadas para que un niño que abre el código con el
    inspector no las vea antes de tiempo. Aquí la rejilla entera está a la
    vista desde el principio: ES el ejercicio. No hay nada secreto que
    proteger, y un servidor de más solo añadiría latencia.
"""

import random

# --------------------------------------------------------------------------
# Lo que el juego ofrece. Se lee desde el navegador para armar el modal de
# configuración, así que el nombre y la ayuda travels vacío nunca: quien elige
# tiene que saber qué está escogiendo.
# --------------------------------------------------------------------------

TAMANOS = {
    "3x3": {"columnas": 3, "filas": 3, "nombre": "Fácil", "ayuda":
            "Nueve casillas. Para empezar."},
    "4x4": {"columnas": 4, "filas": 4, "nombre": "Medio", "ayuda":
            "Dieciséis casillas. Requiere más campo visual."},
    "5x5": {"columnas": 5, "filas": 5, "nombre": "Difícil", "ayuda":
            "Veinticinco casillas. La de los pilotos."},
}

CONTENIDOS = {
    "numeros": {
        "nombre": "Números",
        "ayuda": "Del 1 en adelante, como la tabla clásica.",
        "muestra": "7",
    },
    "letras": {
        "nombre": "Letras",
        "ayuda": "El abecedario en orden. Igual de difícil, se lee una letra "
                 "y no un número.",
        "muestra": "M",
    },
    "emojis": {
        "nombre": "Dibujos",
        "ayuda": "Dibujos de todos los días. La pantalla te dice cuál buscar.",
        "muestra": "🍎",
    },
    "colores": {
        "nombre": "Colores con forma",
        "ayuda": "Formas de colores. Cada una se distingue por su forma y por su "
                 "color, así que sirve también si te cuesta distinguir colores.",
        "muestra": "▲-c1",
    },
}

# LOS DOS CONTENIDOS NUEVOS NO TIENEN ORDEN NATURAL (no hay un "despues del
# manzana"), asi que el orden de busqueda es una mezcla que decide el servidor y
# el tablero trae `mostrar_objetivo`: la pantalla dice en cada momento cual
# buscar. La regla de las vecinas "consecutivas" y la de la esquina se aplican
# sobre ESE orden, igual que con los numeros.
CON_OBJETIVO = ("emojis", "colores")

# Veinticinco dibujos, los que cubre un 5x5. Cada uno con el nombre que lee el
# lector de pantalla. Solo emojis sencillos y sin selector de variacion: se ven
# igual en todos los sistemas.
DIBUJOS = [
    ("🍎", "manzana"), ("🍌", "plátano"), ("🍇", "uvas"), ("🍓", "fresa"),
    ("🍒", "cerezas"), ("🍋", "limón"), ("🍉", "sandía"), ("🥕", "zanahoria"),
    ("🌽", "maíz"), ("🍄", "hongo"), ("🌻", "girasol"), ("🌳", "árbol"),
    ("🐶", "perro"), ("🐱", "gato"), ("🐟", "pez"), ("🐢", "tortuga"),
    ("🦋", "mariposa"), ("🐝", "abeja"), ("🚗", "coche"), ("🚲", "bicicleta"),
    ("⚽", "balón"), ("🔔", "campana"), ("🔑", "llave"), ("🎈", "globo"),
    ("🏠", "casa"),
]

# Formas y colores: 7 formas x 4 colores = 28 combinaciones, mas que las 25
# casillas del 5x5. Los colores son CLAVES del tema (la pagina las pinta con las
# variables del sitio, no con colores sueltos) y se llaman por su tono.
FORMAS_COLOR = [("▲", "triángulo"), ("●", "círculo"), ("■", "cuadrado"),
                ("◆", "rombo"), ("★", "estrella"), ("✚", "cruz"), ("▼", "triángulo invertido")]
COLORES_TEMA = [("c1", "azul"), ("c2", "verde"), ("c3", "rosa"), ("c4", "naranja")]

# EL ABECEDARIO, Y POR QUÉ SE QUEDAN FUERA LA Y Y LA Z
# El abecedario español tiene 27 letras: las 26 del A al Z más la Ñ, que es una
# letra propia y va entre la N y la O.
#
# La tabla de 5x5 tiene 25 casillas, así que NO alcanzan. Se usan las
# primeras 25, que llegan hasta la X: la Y y la Z se quedan fuera, pero la Ñ sí
# entra, y entra en su sitio.
#
# ¿No es un defecto que falten la Y y la Z? No, y por una razón que conviene
# tener clara: esto NO es un examen del abecedario. La tarea es buscar en orden
# alfabético, no comprobar que uno se sepa las letras. Lo que sí importa es que
# el orden sea el de verdad —que la Ñ vaya entre la N y la O—, porque si el
# abecedario estuviera desordenado la tarea sería otro juego, y más difícil de
# una forma que nadie pidió.
ABECEDARIO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"

# Cuántas mezclas se prueban antes de aceptar un tablero.
#
# ESTE NÚMERO SALE DE MEDIR, NO DE ADIVINAR. En 200 semillas por tamaño, hacer
# falta un promedio de unas 40 mezclas y el peor caso fue 275, en el 3x3 (que
# es el que más cuesta, porque tiene menos casillas y las cuatro esquinas son
# una parte grande del tablero). Con 800 hay margen de sobra para el peor caso
# conocido, y quedarse sin margen significaría devolver un tablero con números
# consecutivos pegados, que es justo lo que este archivo existe para evitar.
INTENTOS = 800


def catalogos():
    """Lo que el juego ofrece, para armar el modal de configuración.

    Cada tamaño trae sus columnas y filas para que el navegador no las calcule
    otra vez (y no puedan discrepar), y cada contenido trae un símbolo de
    muestra para el botón.
    """
    return {
        "tamanos": [
            {
                "id": tid,
                "columnas": t["columnas"],
                "filas": t["filas"],
                "nombre": t["nombre"],
                "ayuda": t["ayuda"],
                "total": t["columnas"] * t["filas"],
            }
            for tid, t in TAMANOS.items()
        ],
        "contenidos": [
            {"id": cid, "nombre": c["nombre"], "ayuda": c["ayuda"],
             "muestra": c["muestra"]}
            for cid, c in CONTENIDOS.items()
        ],
    }


def _simbolos(contenido, total):
    """Los símbolos que van en el tablero, en su orden natural.

    La lista va EN ORDEN, y el barajado la mezcla después. Guardar el orden es
    lo que permite decidir si dos casillas vecinas son "consecutivas", que es
    la regla de calidad del punto 2.
    """
    if contenido == "numeros":
        return [str(n) for n in range(1, total + 1)]
    if contenido == "letras":
        return list(ABECEDARIO[:total])
    if contenido == "emojis":
        return [e for e, _ in DIBUJOS[:total]]
    if contenido == "colores":
        # Con i % 7 y i % 4 las 28 parejas son distintas (7 y 4 no comparten
        # divisores) Y las primeras N ya mezclan todos los colores: en un 3x3 no
        # salen nueve formas del mismo azul.
        combos = [(FORMAS_COLOR[i % 7], COLORES_TEMA[i % 4]) for i in range(28)]
        return ["%s-%s" % (f[0], c[0]) for f, c in combos[:total]]
    raise ValueError("contenido desconocido: %r" % (contenido,))


def _barajar(lista, rng):
    """Mezcla la lista en su sitio (Fisher-Yates)."""
    for i in range(len(lista) - 1, 0, -1):
        j = rng.randrange(i + 1)
        lista[i], lista[j] = lista[j], lista[i]
    return lista


def _posicion(columnas, filas, indice):
    """La fila y la columna de una casilla por su número de orden."""
    return indice // columnas, indice % columnas


def _es_esquina(fila, columna, filas, columnas):
    return ((fila == 0 or fila == filas - 1)
            and (columna == 0 or columnas - 1 == columna))


def _vecinos(indice, columnas, filas):
    """Las casillas que tocan a esta por un lado: arriba, abajo, izquierda,
    derecha. Las diagonales NO cuentan."""
    fila, columna = _posicion(columnas, filas, indice)
    if fila > 0:
        yield indice - columnas
    if fila < filas - 1:
        yield indice + columnas
    if columna > 0:
        yield indice - 1
    if columna < columnas - 1:
        yield indice + 1


def _tablero_limpio(celdas, columnas, filas, orden_natural):
    """Las DOS reglas de calidad que un tablero tiene que cumplir.

    1. NINGUNA PAREJA VECINA ES CONSECUTIVA. Dos casillas que se tocan no
       pueden llevar números (o letras) que van seguidos. Sin esto el tablero
       se resuelve recorriéndolo con el dedo, que no es el ejercicio: el
       ejercicio es buscar en el campo visual entero. Con esto, el 12 y el 13
       nunca están pegados, así que no hay atajo.

    2. EL PRIMERO NO ESTÁ EN UNA ESQUINA. El primer símbolo es el que se busca
       primero, y en una esquina se encuentra siempre más rápido que en
       cualquier otro sitio. Buscarlo en una esquina no entrena nada, y hace
       que el primer segundo de cada tabla sea el mismo.

    `orden_natural` es la lista SIN MEZCLAR: la que dice qué número (o letra)
    va detrás de cuál. La comparación se hace contra ella y NO contra la
    posición que ocupa cada símbolo en el tablero, porque esa posición es
    justamente lo que estamos organizando y no dice nada sobre qué símbolo
    hay al lado. Con la lista mezclada, dos números consecutivos casi nunca
    salen pegados, la comprobación casi nunca se cumple, y el tablero que se
    devuelve es siempre el último que se probó: sucio. Las pruebas lo cazaron.

    Se prueban las DOS reglas porque las dos hacen el tablero más justo, y
    porque son las que un tablero aleatorio cumple casi siempre mal: en un 5x5
    hay 40 pares de casillas que se tocan y unas 8 de cada 100 son
    consecutivas, así que lo normal es que salgan tres o cuatro juntas.
    """
    donde = {v: i for i, v in enumerate(orden_natural)}

    for indice, valor in enumerate(celdas):
        for vecino in _vecinos(indice, columnas, filas):
            # "abs(1)" y no "es -1": dos símbolos son consecutivos cuando sus
            # posiciones en el abecedario difieren en uno, sin importar cuál
            # de los dos va antes en la casilla.
            if abs(donde[valor] - donde[celdas[vecino]]) == 1:
                return False

    fila, columna = _posicion(columnas, filas, celdas.index(orden_natural[0]))
    return not _es_esquina(fila, columna, filas, columnas)


def _detalle(valor, contenido):
    """Lo que la pantalla necesita para pintar y nombrar un simbolo nuevo."""
    if contenido == "emojis":
        nombres = dict(DIBUJOS)
        return {"texto": valor, "nombre": nombres[valor]}
    forma, color = valor.split("-")
    nombre_forma = dict(FORMAS_COLOR)[forma]
    nombre_color = dict(COLORES_TEMA)[color]
    return {"texto": forma, "color": color, "nombre": "%s %s" % (nombre_forma, nombre_color)}


def _celda(indice, valor, contenido):
    celda = {"id": indice, "valor": valor}
    if contenido in CON_OBJETIVO:
        celda.update(_detalle(valor, contenido))
    return celda


def nueva_tabla(tamano="5x5", contenido="numeros", semilla=None):
    """Arma un tablero nuevo.

    Devuelve un diccionario con la forma del tablero, los símbolos ya mezclados
    en las casillas, y la semilla con que se hizo, que se devuelve para poder
    repetir exactamente el mismo tablero.

    Con la misma semilla sale SIEMPRE el mismo tablero. Eso no es un adorno:
    es lo que permite que un fallo se pueda volver a provocar a mano, y lo que
    hace que las pruebas del archivo puedan comprobar cosas que dependen del
    azar.

    Si después de todos los reintentos no sale un tablero que cumpla las dos
    reglas, se devuelve el último que se probó. Pasa en menos de un tablero en
    mil, y es preferible dar un tablero un poco menos bueno que no dar ninguno:
    el juego tiene que empezar siempre.
    """
    if tamano not in TAMANOS:
        raise ValueError("tamaño desconocido: %r" % (tamano,))
    if contenido not in CONTENIDOS:
        raise ValueError("contenido desconocido: %r" % (contenido,))

    t = TAMANOS[tamano]
    columnas, filas = t["columnas"], t["filas"]
    total = columnas * filas
    base = _simbolos(contenido, total)

    rng = random.Random(semilla)
    if contenido in CON_OBJETIVO:
        # Sin orden natural: el orden de busqueda lo decide una mezcla.
        _barajar(base, rng)
    mejor = None
    for _ in range(INTENTOS):
        celdas = _barajar(base.copy(), rng)
        mejor = celdas
        if _tablero_limpio(celdas, columnas, filas, base):
            break

    return {
        "tamano": tamano,
        "contenido": contenido,
        "columnas": columnas,
        "filas": filas,
        "total": total,
        "celdas": [_celda(i, v, contenido) for i, v in enumerate(mejor)],
        "mostrar_objetivo": contenido in CON_OBJETIVO,
        # EL ORDEN, PARA QUE EL NAVEGADOR NO LO ADIVINE
        # La lista de símbolos en su orden natural. El navegador la necesita
        # para saber cuál es el siguiente que hay que buscar, y no puede
        # deducirlo del tablero: con letras, ordenar con "sort()" pondría la Ñ
        # al final, porque en el alfabeto de la computadora va después de la Z.
        # El abecedario español, con su Ñ entre la N y la O, vive en este
        # archivo y en ningún otro sitio.
        "orden": list(base),
        # El detalle de cada simbolo en el orden de busqueda (solo en los
        # contenidos con objetivo): lo que la pantalla muestra como "Busca: ...".
        "orden_detalle": ([_detalle(v, contenido) for v in base]
                          if contenido in CON_OBJETIVO else []),
        "semilla": semilla,
    }