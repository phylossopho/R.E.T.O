# -*- coding: utf-8 -*-
"""Rondas de preguntas: qué se pregunta, en qué orden y cuándo vuelve cada una.

QUÉ RESUELVE
    Un test puede tener 100 preguntas y nadie las responde de golpe. La persona
    elige CUÁNTAS quiere (10, 20, todas…) y esta lógica decide CUÁLES:

    - Las que más conviene repasar (valor de fábrica): siete de cada diez
      lugares son para lo que ya toca repasar (lo fallado, y lo que venció), con
      el lugar asegurado; el resto, para preguntas nuevas. Lo que se domina se
      va espaciando cada vez más. Las acertadas con dudas o adivinando no
      cuentan como aprendidas.
    - Al azar, o en el orden del test.
    Además mezcla el orden de las respuestas de cada pregunta (la correcta
    incluida), y guarda ese orden en la ronda para poder reconstruirla.

LA REPETICIÓN ESPACIADA, EXPLICADA
    Cada pregunta tiene una "caja" de 0 a 5. Una caja más alta quiere decir "ya
    la sé de verdad" y su próxima aparición tarda más: 0 y 1 días, 3, 7, 14 y
    30. Es el sistema de cajas de Leitner, que es sencillo y se explica en una
    frase. Las reglas, al contestar:

    - Fallo:                          vuelve a la caja 0 y está lista YA.
    - Acierto con seguridad (o sin
      preguntar la seguridad):        sube una caja.
    - Acierto con dudas:              se queda en su caja, y vuelve en lo que
                                      tardaría (mínimo un día).
    - Acierto adivinando:             igual que con dudas. Acertar por suerte
                                      no es saber.

    Ninguna regla castiga: un fallo solo hace que la pregunta vuelva antes.

POR QUÉ ESTÁ EN PYTHON, Y POR QUÉ NO GUARDA NADA
    Es lógica con reglas que se prueban (test_rondas.py) y que no deben
    depender de la pantalla. Pero los datos de la persona viven en su navegador
    (IndexedDB, y de ahí al respaldo): este archivo recibe el estado de cada
    pregunta y devuelve el nuevo, sin recordar nada entre llamadas.

EL RELOJ
    Todas las fechas de "cuándo vuelve" salen del reloj del SERVIDOR (o de
    `ahora`, para las pruebas), no del aparato desde el que se responde: si se
    entra desde un celular con otra hora, el calendario no se desordena.
"""

import random
import time

DIA_MS = 86400000

CAJAS = 5
INTERVALO_DIAS = {0: 0, 1: 1, 2: 3, 3: 7, 4: 14, 5: 30}

MODOS = ("prioridad", "azar", "orden")
SEGURIDADES = ("seguro", "dudando", "adivinando")

MIN_OPCIONES = 2
MAX_OPCIONES = 6
MAX_PREGUNTAS = 2000
MAX_TEXTO = 120

# CUÁNTO DE LA RONDA ES REPASO. Siete de cada diez lugares son para lo que ya
# toca repasar (lo fallado y lo que venció); el resto, para preguntas nuevas.
# Esto SALE DE MEDIR y no de adivinar: la primera versión solo daba más peso a lo
# fallado y sorteaba. Con 5 falladas y 30 nuevas, en rondas de 8, una fallada
# salía en tres de cada cuatro rondas aunque se le diera 9 veces el peso de una
# nueva: el sorteo siempre deja a alguna afuera. Con cuota, lo fallado tiene su
# lugar ASEGURADO (mientras haya lugares) y lo nuevo tampoco se queda sin turno
# cuando hay mucho que repasar.
CUOTA_REPASO = 0.7

# Dentro de cada grupo, el peso decide quién entra primero cuando hay más de las
# que caben (más peso = más probable).
PESO_NUEVA = 1.5
PESO_FALLO = 4.0
PESO_FALLO_SEGURO = 5.0      # fallar estando seguro es creer algo que no era así
PESO_VENCIDA_BASE = 2.0
PESO_NO_VENCIDA = 0.3
TOPE_RETRASO = 3.0           # cuántos intervalos de retraso siguen sumando peso

TEMAS_DEBILES_MAX = 5


def ahora_ms():
    return int(time.time() * 1000)


# --------------------------------------------------------------------------
# EL ESTADO DE UNA PREGUNTA
# --------------------------------------------------------------------------

def estado_inicial():
    """El estado de una pregunta que nunca se ha respondido."""
    return {"caja": 0, "vistas": 0, "aciertos": 0, "fallos": 0, "ultimo": None,
            "vence": 0, "ultimoResultado": None, "ultimaSeguridad": None}


def _entero(valor, nombre, minimo=0):
    if isinstance(valor, bool) or not isinstance(valor, int):
        raise ValueError("%s tiene que ser un número entero" % nombre)
    if valor < minimo:
        raise ValueError("%s no puede ser menor que %d" % (nombre, minimo))
    return valor


def _estado(valor):
    """Revisa un estado que viene de fuera y lo devuelve completo."""
    if valor is None:
        return estado_inicial()
    if not isinstance(valor, dict):
        raise ValueError("el estado de una pregunta tiene que ser un objeto")
    e = estado_inicial()
    for clave in ("vistas", "aciertos", "fallos", "vence"):
        if clave in valor and valor[clave] is not None:
            e[clave] = _entero(valor[clave], clave)
    if "caja" in valor and valor["caja"] is not None:
        e["caja"] = _entero(valor["caja"], "caja")
        if e["caja"] > CAJAS:
            raise ValueError("la caja va de 0 a %d" % CAJAS)
    if valor.get("ultimo") is not None:
        e["ultimo"] = _entero(valor["ultimo"], "ultimo")
    if valor.get("ultimoResultado") not in (None, "acierto", "fallo"):
        raise ValueError("ultimoResultado tiene que ser acierto o fallo")
    e["ultimoResultado"] = valor.get("ultimoResultado")
    if valor.get("ultimaSeguridad") not in (None,) + SEGURIDADES:
        raise ValueError("seguridad desconocida")
    e["ultimaSeguridad"] = valor.get("ultimaSeguridad")
    return e


def registrar(estado, acierto, seguridad=None, ahora=None):
    """El estado nuevo de una pregunta después de contestarla.

    `acierto` es True o False; `seguridad` es "seguro", "dudando",
    "adivinando" o None (cuando no se pregunta). Devuelve un estado nuevo, sin
    tocar el que se pasó.
    """
    if not isinstance(acierto, bool):
        raise ValueError("acierto tiene que ser verdadero o falso")
    if seguridad is not None and seguridad not in SEGURIDADES:
        raise ValueError("seguridad desconocida: %r" % (seguridad,))
    e = _estado(estado)
    ahora = ahora_ms() if ahora is None else _entero(ahora, "ahora")
    e["vistas"] += 1
    e["ultimo"] = ahora
    e["ultimaSeguridad"] = seguridad
    if not acierto:
        e["fallos"] += 1
        e["ultimoResultado"] = "fallo"
        e["caja"] = 0
        e["vence"] = ahora
        return e
    e["aciertos"] += 1
    e["ultimoResultado"] = "acierto"
    if seguridad in ("dudando", "adivinando"):
        # No sube: acertar con dudas o por suerte no demuestra que se sabe.
        e["vence"] = ahora + max(INTERVALO_DIAS[e["caja"]], 1) * DIA_MS
    else:
        e["caja"] = min(CAJAS, e["caja"] + 1)
        e["vence"] = ahora + INTERVALO_DIAS[e["caja"]] * DIA_MS
    return e


def esta_vencida(estado, ahora):
    return estado["vistas"] > 0 and estado["vence"] <= ahora


def prioridad(estado, ahora):
    """Cuánto conviene preguntar esto ahora. Siempre positivo."""
    e = _estado(estado)
    if e["vistas"] == 0:
        return PESO_NUEVA
    base = 0.0
    if e["ultimoResultado"] == "fallo":
        base = PESO_FALLO_SEGURO if e["ultimaSeguridad"] == "seguro" else PESO_FALLO
    if e["vence"] <= ahora:
        intervalo = max(INTERVALO_DIAS[e["caja"]], 1) * DIA_MS
        retraso = min((ahora - e["vence"]) / float(intervalo), TOPE_RETRASO)
        return max(base, PESO_VENCIDA_BASE + retraso)
    return max(base, PESO_NO_VENCIDA / (1 + e["caja"]))


# --------------------------------------------------------------------------
# LAS PREGUNTAS QUE LLEGAN DE FUERA
# --------------------------------------------------------------------------

def ruta_de_tema(tema):
    """Los niveles 2 a 4 que existan, en orden (el 1 es el título del test).
    Misma regla que rutaDeTema() de reto-tests-lista.js."""
    if not isinstance(tema, dict):
        return []
    salida = []
    for nivel in ("n2", "n3", "n4"):
        valor = tema.get(nivel)
        if isinstance(valor, str) and valor.strip():
            salida.append(valor.strip())
    return salida


def _revisar_preguntas(preguntas, exigir_opciones=True):
    if not isinstance(preguntas, list) or not preguntas:
        raise ValueError("faltan las preguntas")
    if len(preguntas) > MAX_PREGUNTAS:
        raise ValueError("hay demasiadas preguntas (el máximo es %d)" % MAX_PREGUNTAS)
    vistos = set()
    limpias = []
    for p in preguntas:
        if not isinstance(p, dict):
            raise ValueError("una pregunta no es válida")
        pid = p.get("id")
        if not isinstance(pid, str) or not pid or len(pid) > MAX_TEXTO:
            raise ValueError("cada pregunta necesita un id de texto")
        if pid in vistos:
            raise ValueError("hay dos preguntas con el mismo id: %s" % pid)
        vistos.add(pid)
        n = p.get("opciones")
        if exigir_opciones and (isinstance(n, bool) or not isinstance(n, int)
                                or not MIN_OPCIONES <= n <= MAX_OPCIONES):
            raise ValueError("la pregunta %s necesita entre %d y %d opciones"
                             % (pid, MIN_OPCIONES, MAX_OPCIONES))
        limpias.append({"id": pid, "opciones": n, "tema": p.get("tema")})
    return limpias


def _revisar_estados(estados, preguntas):
    if estados is None:
        return {}
    if not isinstance(estados, dict):
        raise ValueError("los estados tienen que ser un objeto")
    ids = set(p["id"] for p in preguntas)
    # Un estado de una pregunta que ya no existe se ignora (se borró del test).
    return dict((k, _estado(v)) for k, v in estados.items() if k in ids)


# --------------------------------------------------------------------------
# ARMAR LA RONDA
# --------------------------------------------------------------------------

def _muestra(items, estados, n, ahora, rng):
    """`n` de los `items`, sin repetir, con más probabilidad para los de más
    peso (Efraimidis-Spirakis: cada uno saca un número al azar elevado a 1/peso;
    gana el más alto). Ninguno tiene el lugar asegurado ni perdido."""
    if n <= 0 or not items:
        return []
    claves = []
    for p in items:
        peso = prioridad(estados.get(p["id"]), ahora)
        claves.append((rng.random() ** (1.0 / peso), p))
    claves.sort(key=lambda par: par[0], reverse=True)
    return [p for _, p in claves[:n]]


def _quitar(items, usadas):
    ids = set(p["id"] for p in usadas)
    return [p for p in items if p["id"] not in ids]


def _elegir(preguntas, estados, cantidad, modo, ahora, rng):
    if modo == "orden":
        return preguntas[:cantidad]
    if modo == "azar":
        return rng.sample(preguntas, cantidad)
    # prioridad: tres grupos. Lo que ya toca repasar (lo fallado y lo vencido), lo
    # nuevo, y lo que se ve bien pero aún no vence.
    debidas = [p for p in preguntas if esta_vencida(estados.get(p["id"]) or estado_inicial(), ahora)]
    nuevas = [p for p in preguntas if (estados.get(p["id"]) or estado_inicial())["vistas"] == 0]
    otras = _quitar(_quitar(preguntas, debidas), nuevas)

    cuota = min(len(debidas), -(-int(cantidad * CUOTA_REPASO * 100) // 100))
    elegidas = _muestra(debidas, estados, cuota, ahora, rng)
    # El resto, de lo nuevo; si no alcanza, más repaso; si no, lo que aún no vence.
    for grupo in (nuevas, _quitar(debidas, elegidas), otras):
        falta = cantidad - len(elegidas)
        if falta <= 0:
            break
        elegidas += _muestra(grupo, estados, falta, ahora, rng)
    rng.shuffle(elegidas)       # que repaso y nuevas vayan mezcladas, no por bloques
    return elegidas


def armar_ronda(preguntas, estados, cantidad, modo="prioridad", ahora=None, semilla=None):
    """Elige las preguntas de una ronda y mezcla las respuestas de cada una.

    `preguntas`: [{ id, opciones: cuántas, tema? }]  (las del test)
    `estados`:   { idPregunta: estado }              (lo que se sabe de cada una)
    `cantidad`:  cuántas quiere la persona. Si pide más que las que hay, son
                 todas.
    Devuelve { semilla, ahora, preguntas: [{ id, orden }] }, donde `orden` es
    una permutación de 0..opciones-1: la opción que se muestra en el lugar k es
    la `orden[k]` de las escritas. Con la misma semilla (y la misma `ahora`)
    sale la misma ronda.
    """
    if modo not in MODOS:
        raise ValueError("modo desconocido: %r" % (modo,))
    if isinstance(cantidad, bool) or not isinstance(cantidad, int) or cantidad < 1:
        raise ValueError("la cantidad tiene que ser un número entero de 1 en adelante")
    if semilla is not None and (isinstance(semilla, bool) or not isinstance(semilla, int)):
        raise ValueError("la semilla tiene que ser un número entero")
    pregs = _revisar_preguntas(preguntas)
    est = _revisar_estados(estados, pregs)
    ahora = ahora_ms() if ahora is None else _entero(ahora, "ahora")
    if semilla is None:
        semilla = random.SystemRandom().randrange(2 ** 31)
    rng = random.Random(semilla)

    cantidad = min(cantidad, len(pregs))
    elegidas = _elegir(pregs, est, cantidad, modo, ahora, rng)
    salida = []
    for p in elegidas:
        orden = list(range(p["opciones"]))
        rng.shuffle(orden)
        salida.append({"id": p["id"], "orden": orden})
    return {"semilla": semilla, "ahora": ahora, "preguntas": salida}


# --------------------------------------------------------------------------
# EL RESUMEN DE UN TEST
# --------------------------------------------------------------------------

def resumen_test(preguntas, estados, ahora=None):
    """Cómo va una persona en un test: cuántas son nuevas, cuántas toca repasar,
    cuántas ya domina y qué temas conviene mirar.

    Una pregunta "por repasar" es una que ya se vio y cuya fecha llegó (las
    falladas lo están de inmediato). "Dominada": caja 4 o 5 y todavía no vence.
    """
    pregs = _revisar_preguntas(preguntas, exigir_opciones=False)
    est = _revisar_estados(estados, pregs)
    ahora = ahora_ms() if ahora is None else _entero(ahora, "ahora")
    nuevas = repasar = dominadas = 0
    temas = {}
    for p in pregs:
        e = est.get(p["id"]) or estado_inicial()
        if e["vistas"] == 0:
            nuevas += 1
            continue
        if esta_vencida(e, ahora):
            repasar += 1
            ruta = tuple(ruta_de_tema(p.get("tema")))
            if ruta:
                temas[ruta] = temas.get(ruta, 0) + 1
        elif e["caja"] >= 4:
            dominadas += 1
    ordenados = sorted(temas.items(), key=lambda kv: (-kv[1], kv[0]))
    return {
        "total": len(pregs),
        "nuevas": nuevas,
        "por_repasar": repasar,
        "dominadas": dominadas,
        "temas_debiles": [{"ruta": list(r), "n": n} for r, n in ordenados[:TEMAS_DEBILES_MAX]],
    }
