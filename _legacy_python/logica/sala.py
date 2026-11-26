"""Las salas del multijugador por wifi local: crear, unirse, prepararse y duelo.

QUIEN MANDA ES EL SERVIDOR
    La sala vive en la memoria de la computadora anfitriona (`servidor.cmd`). Los
    dispositivos mandan lo que hicieron (elegir una pregunta, responder, usar un
    power up) y preguntan el estado cada segundo; las reglas son las de
    logica/rpg.py y la hora de cada respuesta la pone el servidor al recibirla.

LO QUE CADA JUGADOR VE
    `estado()` devuelve SU vista: nunca la respuesta correcta, nunca el mazo del
    rival ni sus preguntas ofrecidas. Cada jugador se identifica con un token
    secreto que recibe al crear o unirse; sin el token no se puede mirar ni jugar.

AGUANTE DE LA RED
    - Un dispositivo "esta" si pregunto hace menos de PRESENCIA_S segundos.
    - Si en pleno duelo uno desaparece mas de ABANDONO_S, pierde por abandono.
    - Al recargar la pagina se vuelve a entrar con el mismo token.
    - Con tiempo: el defensor pierde 1 punto por cada 2 s pasados del limite.
"""

import secrets
import threading
import time

from . import red, rpg

LETRAS_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"      # sin O, 0, I, 1
LARGO_CODIGO = 4
MAX_SALAS = 20
SALA_VIVA_S = 2 * 60 * 60            # una sala sin movimiento por 2 horas se borra
PRESENCIA_S = 8
ABANDONO_S = 90
MAX_ENUNCIADO = 500
MAX_OPCION = 200
MAX_TEMA = 80

CONFIG_EDITABLE = ("dano_base", "ventaja", "contraataque", "con_tiempo", "segundos_pregunta")


class ErrorSala(ValueError):
    """Un error con el codigo HTTP que le toca (400, 403 o 404)."""

    def __init__(self, mensaje, http=400):
        super().__init__(mensaje)
        self.http = http


def _recortar(texto, largo):
    return str(texto if texto is not None else "").strip()[:largo]


def acotar_mazo(preguntas):
    """Recorta los textos largos y se queda solo con lo que el motor usa."""
    if not isinstance(preguntas, (list, tuple)):
        raise ErrorSala("El mazo tiene que ser una lista de preguntas.")
    limpio = []
    for p in preguntas:
        if not isinstance(p, dict):
            raise ErrorSala("Una pregunta no tiene el formato correcto.")
        ops = p.get("opciones")
        if not isinstance(ops, (list, tuple)):
            raise ErrorSala("Una pregunta no tiene opciones.")
        limpio.append({
            "id": _recortar(p.get("id"), 80),
            "enunciado": _recortar(p.get("enunciado"), MAX_ENUNCIADO),
            "tema": _recortar(p.get("tema"), MAX_TEMA),
            "opciones": [{"id": _recortar(o.get("id") if isinstance(o, dict) else "", 40),
                          "texto": _recortar(o.get("texto") if isinstance(o, dict) else "", MAX_OPCION)}
                         for o in ops[:6]],
            "correcta": _recortar(p.get("correcta"), 40),
        })
    return limpio


class Salas:
    def __init__(self, reloj=time.time):
        self._reloj = reloj
        self._lock = threading.RLock()
        self._salas = {}

    # ------------------------------------------------------------------ utilidades
    def _ahora(self):
        return self._reloj()

    def _limpiar_viejas(self):
        ahora = self._ahora()
        for c in [c for c, s in self._salas.items() if ahora - s["actividad"] > SALA_VIVA_S]:
            del self._salas[c]

    def _sala(self, codigo):
        s = self._salas.get(str(codigo or "").strip().upper())
        if not s:
            raise ErrorSala("No existe esa sala. Revisa el código.", 404)
        return s

    def _yo(self, sala, token):
        for jid, j in sala["jugadores"].items():
            if j and token and secrets.compare_digest(j["token"], str(token)):
                return jid
        raise ErrorSala("No eres parte de esta sala.", 403)

    def _tocar(self, sala):
        sala["version"] += 1
        sala["actividad"] = self._ahora()

    def _codigo_nuevo(self):
        for _ in range(200):
            c = "".join(secrets.choice(LETRAS_CODIGO) for _ in range(LARGO_CODIGO))
            if c not in self._salas:
                return c
        raise ErrorSala("No pude crear un código libre. Intenta otra vez.")

    def _nuevo_jugador(self, nombre):
        return {"nombre": red.limpiar_nombre(nombre), "token": secrets.token_urlsafe(16), "clase": None,
                "mazo": None, "equipo": [], "listo": False, "visto": self._ahora(),
                "perfil": None, "origen": "local"}

    # ------------------------------------------------------------------ entrar
    def crear(self, nombre):
        with self._lock:
            self._limpiar_viejas()
            if len(self._salas) >= MAX_SALAS:
                raise ErrorSala("Hay demasiadas salas abiertas. Prueba en un rato.")
            codigo = self._codigo_nuevo()
            j1 = self._nuevo_jugador(nombre)
            self._salas[codigo] = {
                "codigo": codigo, "version": 1, "actividad": self._ahora(), "fase": "espera",
                "config": rpg.normalizar_config({"modo": "pvp", "dano_base": 10}),
                "jugadores": {"j1": j1, "j2": None}, "batalla": None, "resultado": None,
                "limite": None, "inicio": None, "ticks": 0, "aviso": None,
            }
            return {"codigo": codigo, "token": j1["token"], "yo": "j1"}

    def unirse(self, codigo, nombre):
        with self._lock:
            s = self._sala(codigo)
            if s["jugadores"]["j2"] is not None:
                raise ErrorSala("La sala ya está llena.")
            if s["fase"] != "espera":
                raise ErrorSala("Esa partida ya empezó.")
            j2 = self._nuevo_jugador(nombre)
            s["jugadores"]["j2"] = j2
            self._tocar(s)
            return {"codigo": s["codigo"], "token": j2["token"], "yo": "j2"}

    # ------------------------------------------------------------------ preparacion
    def _depurar_equipos(self, s):
        """Si cambia la configuracion (por ejemplo se quita el tiempo), los power ups
        del equipo que ya no valen se sacan solos, en vez de dejar un duelo que no
        puede empezar."""
        for j in s["jugadores"].values():
            if not j or not j["equipo"]:
                continue
            validos = []
            for pu in j["equipo"]:
                try:
                    rpg.validar_equipo(validos + [pu], s["config"])
                    validos.append(pu)
                except ValueError:
                    continue
            if validos != j["equipo"]:
                j["equipo"] = validos
                s["aviso"] = "Algunos power ups se quitaron del equipo porque ya no valen con estas reglas."

    def _solo_en_espera(self, s):
        if s["fase"] != "espera":
            raise ErrorSala("Eso solo se puede hacer antes de empezar.")

    def _reiniciar_listos(self, s):
        for j in s["jugadores"].values():
            if j:
                j["listo"] = False

    def configurar(self, codigo, token, cambios):
        """Solo quien creo la sala cambia el dano base y la ventaja; todos los ven."""
        with self._lock:
            s = self._sala(codigo)
            if self._yo(s, token) != "j1":
                raise ErrorSala("Solo quien creó la sala cambia la configuración.", 403)
            self._solo_en_espera(s)
            nuevo = dict(s["config"])
            for k in CONFIG_EDITABLE:
                if isinstance(cambios, dict) and k in cambios:
                    nuevo[k] = cambios[k]
            s["config"] = rpg.normalizar_config(dict(nuevo, modo="pvp"))
            self._depurar_equipos(s)
            self._reiniciar_listos(s)
            self._tocar(s)
            return self.estado(codigo, token)

    def preparar(self, codigo, token, clase, mazo, equipo=None, perfil=None, origen="local"):
        """El jugador elige clase, sube SU mazo y su equipo. Se valida con las reglas.

        `perfil` es su nivel y sus power ups (los de este dispositivo, o los de una
        tarjeta de jugador que trajo de otro servidor): se valida con las mismas
        reglas, el nivel se RECALCULA de los puntos y el equipo solo puede ser de lo
        que hay en su inventario. `origen` ("local" o "tarjeta") se muestra a los dos."""
        with self._lock:
            s = self._sala(codigo)
            jid = self._yo(s, token)
            self._solo_en_espera(s)
            if clase not in rpg.CLASES:
                raise ErrorSala("Elige una clase.")
            try:
                limpio = rpg.validar_mazo(acotar_mazo(mazo), s["config"])
                eq = rpg.validar_equipo(list(equipo or []), s["config"])
                perfil_ok = rpg.validar_perfil(perfil) if perfil is not None else None
            except ValueError as e:
                raise ErrorSala(str(e))
            if perfil_ok is not None:
                disponible = list(perfil_ok["inventario"])
                for pu in eq:
                    if pu not in disponible:
                        raise ErrorSala("Llevas un power up que no está en tu inventario.")
                    disponible.remove(pu)
            j = s["jugadores"][jid]
            j["clase"], j["mazo"], j["equipo"] = clase, limpio, eq
            j["perfil"] = perfil_ok
            j["origen"] = "tarjeta" if origen == "tarjeta" else "local"
            # Cambia lo que cada quien lleva (clase, mazo, equipo): los dos tienen que
            # volver a decir "listo" viendolo.
            self._reiniciar_listos(s)
            self._tocar(s)
            return self.estado(codigo, token)

    def listo(self, codigo, token, valor=True):
        with self._lock:
            s = self._sala(codigo)
            jid = self._yo(s, token)
            self._solo_en_espera(s)
            j = s["jugadores"][jid]
            if valor and (j["clase"] is None or j["mazo"] is None):
                raise ErrorSala("Antes elige tu clase y arma tu mazo.")
            j["listo"] = bool(valor)
            self._tocar(s)
            a, b = s["jugadores"]["j1"], s["jugadores"]["j2"]
            if a and b and a["listo"] and b["listo"]:
                self._empezar(s)
            return self.estado(codigo, token)

    def _nivel(self, j):
        return j["perfil"]["nivel"] if j.get("perfil") else 0

    def _empezar(self, s):
        a, b = s["jugadores"]["j1"], s["jugadores"]["j2"]
        pv = s["config"]["pv_max"]

        def spec(j, k):
            return {"nombre": j["nombre"], "clase": j["clase"], "preguntas": j["mazo"], "nivel": self._nivel(j),
                    "equipo": j["equipo"], "pv_max": pv}
        try:
            s["batalla"] = rpg.nueva_batalla(s["config"], spec(a, "j1"), spec(b, "j2"))
        except ValueError as e:
            # No deberia pasar (todo se valido antes); si pasa, nadie se queda trabado.
            self._reiniciar_listos(s)
            s["aviso"] = "No se pudo empezar: %s" % e
            return
        s["fase"] = "duelo"
        s["resultado"] = None
        s["aviso"] = None
        self._poner_limite(s)

    # ------------------------------------------------------------------ duelo
    def _poner_limite(self, s, nueva=True):
        """Con tiempo: el reloj de la pregunta (`nueva`) arranca cuando aparece. Si solo se
        uso un power up, el reloj sigue y se recalcula el limite (segundos_pregunta mas
        lo que den los power ups). Cada segundo desde el inicio le cuesta vida al defensor."""
        b = s["batalla"]
        if nueva:
            s["ticks"] = 0
            s["inicio"] = self._ahora()
        if s["config"]["con_tiempo"] and b and b["fase"] == "responder":
            seg = s["config"]["segundos_pregunta"] + b["pregunta"]["tiempo_extra"]
            s["limite"] = s["inicio"] + max(5, seg)
        else:
            s["limite"] = None

    def _aplicar_tiempo(self, s):
        b = s["batalla"]
        if s["limite"] is None or not b or b["fase"] != "responder":
            return
        ticks = rpg.segundos_con_perdida(self._ahora() - s["inicio"], b["pregunta"]["tiempo_extra"])
        if ticks > s["ticks"]:
            rpg.tiempo_pasado(b, ticks - s["ticks"])
            s["ticks"] = ticks
            self._tocar(s)
            self._cerrar_si_termino(s)
        # Se acabo el tiempo: cuenta como fallo (el defensor recibe el golpe) y sigue el siguiente turno.
        if b["ganador"] is None and b["fase"] == "responder" and s["limite"] is not None and self._ahora() >= s["limite"]:
            rpg.agotar_tiempo(b)
            self._poner_limite(s)
            self._tocar(s)
            self._cerrar_si_termino(s)

    def _cerrar_si_termino(self, s):
        b = s["batalla"]
        if b and b["ganador"] is not None and s["fase"] != "fin":
            s["fase"] = "fin"
            s["resultado"] = rpg.resumen_final(b)

    def _revisar_abandono(self, s):
        if s["fase"] != "duelo":
            return
        ahora = self._ahora()
        for jid, j in s["jugadores"].items():
            if j and ahora - j["visto"] > ABANDONO_S:
                b = s["batalla"]
                b["ganador"] = "j2" if jid == "j1" else "j1"
                b["motivo"] = "abandono"
                b["fase"] = "fin"
                s["aviso"] = "%s se desconectó." % j["nombre"]
                self._cerrar_si_termino(s)
                self._tocar(s)
                return

    def accion(self, codigo, token, datos):
        """Una jugada: {"tipo": "elegir"|"responder"|"power_up"|"abandonar"|"revancha", ...}."""
        with self._lock:
            s = self._sala(codigo)
            jid = self._yo(s, token)
            datos = datos if isinstance(datos, dict) else {}
            tipo = datos.get("tipo")
            if tipo == "revancha":
                return self._revancha(s, codigo, token)
            if s["fase"] != "duelo":
                raise ErrorSala("No hay un duelo en marcha.")
            self._aplicar_tiempo(s)
            if s["fase"] != "duelo":
                return self.estado(codigo, token)
            b = s["batalla"]
            try:
                if tipo == "elegir":
                    rpg.elegir_pregunta(b, jid, str(datos.get("pregunta", "")))
                    self._poner_limite(s)
                elif tipo == "responder":
                    opcion = datos.get("opcion")
                    ms = None
                    if s["config"]["con_tiempo"] and s["limite"] is not None:
                        ms = max(0, (self._ahora() - s["inicio"]) * 1000)
                    rpg.responder(b, jid, None if opcion is None else str(opcion), ms)
                    self._poner_limite(s)
                elif tipo == "power_up":
                    rpg.usar_power_up(b, jid, str(datos.get("id", "")))
                    self._poner_limite(s, nueva=False)
                elif tipo == "abandonar":
                    b["ganador"] = "j2" if jid == "j1" else "j1"
                    b["motivo"] = "abandono"
                    b["fase"] = "fin"
                else:
                    raise ErrorSala("Esa jugada no existe.")
            except ErrorSala:
                raise
            except ValueError as e:
                raise ErrorSala(str(e))
            self._cerrar_si_termino(s)
            self._tocar(s)
            return self.estado(codigo, token)

    def _revancha(self, s, codigo, token):
        if s["fase"] != "fin":
            raise ErrorSala("La revancha es después de terminar.")
        s["fase"] = "espera"
        s["batalla"] = None
        s["resultado"] = None
        s["limite"] = None
        s["aviso"] = None
        self._reiniciar_listos(s)
        self._tocar(s)
        return self.estado(codigo, token)

    # ------------------------------------------------------------------ mirar
    def firma(self, s):
        """Cambia cuando cambia la sala o alguien se conecta o se desconecta."""
        bits = "".join("1" if j and self._ahora() - j["visto"] <= PRESENCIA_S else "0"
                       for j in s["jugadores"].values() if j is not None)
        return "%d.%s" % (s["version"], bits)

    def estado(self, codigo, token, firma=None):
        """La vista de UN jugador. Si `firma` es la actual, solo avisa que no hay cambios."""
        with self._lock:
            s = self._sala(codigo)
            jid = self._yo(s, token)
            s["jugadores"][jid]["visto"] = self._ahora()
            self._aplicar_tiempo(s)
            self._revisar_abandono(s)
            f = self.firma(s)
            if firma is not None and firma == f:
                return {"cambio": False, "firma": f}
            ahora = self._ahora()
            jugadores = []
            for k in ("j1", "j2"):
                j = s["jugadores"][k]
                if j is None:
                    continue
                # La clase es secreta: cada quien solo ve la suya (que el otro la vea es cosa de la batalla, no de la sala).
                jugadores.append({"id": k, "nombre": j["nombre"], "clase": j["clase"] if k == jid else None,
                                  "tiene_clase": j["clase"] is not None, "listo": j["listo"],
                                  "mazo": len(j["mazo"]) if j["mazo"] else 0,
                                  "conectado": ahora - j["visto"] <= PRESENCIA_S, "equipo": len(j["equipo"]),
                                  "nivel": self._nivel(j), "origen": j["origen"],
                                  "perfil": j["perfil"] is not None})
            vista = {
                "cambio": True, "firma": f, "codigo": s["codigo"], "yo": jid, "fase": s["fase"],
                "config": s["config"], "jugadores": jugadores, "aviso": s["aviso"],
                "batalla": rpg.estado_publico(s["batalla"], jid, ocultar_clase_rival=(s["fase"] != "duelo")) if s["batalla"] else None,
                "resultado": s["resultado"],
                "restante": None if s["limite"] is None else max(0, round(s["limite"] - ahora, 1)),
            }
            return vista

    def cerrar(self, codigo, token):
        with self._lock:
            s = self._sala(codigo)
            if self._yo(s, token) != "j1":
                raise ErrorSala("Solo quien creó la sala puede cerrarla.", 403)
            del self._salas[s["codigo"]]
            return {"cerrada": True}

    def cuantas(self):
        with self._lock:
            return len(self._salas)
