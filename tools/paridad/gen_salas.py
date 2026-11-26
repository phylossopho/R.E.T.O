# Fixtures de paridad: pve (aventura), sala (duelo) y ding (quiz bowl) con reloj falso y azar determinista.
import json, sys, os, random, secrets, copy
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PY = os.path.join(RAIZ, "_legacy_python")
sys.path.insert(0, PY)

# ---- azar determinista, igual que en tests/paridad_salas.test.js ----
_cont = {"tok": 0, "let": 0, "sys": 0}
def token_falso(n=32):
    _cont["tok"] += 1; return "tok%d_%d" % (_cont["tok"], n)
def choice_falso(texto):
    _cont["let"] += 1; return texto[(_cont["let"] * 7) % len(texto)]
secrets.token_urlsafe = token_falso
secrets.choice = choice_falso
class SysFalso:
    def randrange(self, n):
        _cont["sys"] += 1; return (_cont["sys"] * 7919 + 13) % n
random.SystemRandom = SysFalso

from logica import pve, sala, ding, rpg

PU = rpg.power_ups()
reloj = {"t": 1000.0}
def ahora(): return reloj["t"]

def llamar(rec, obj, at, metodo, *args, **kw):
    reloj["t"] = at
    try:
        r = {"ok": getattr(obj, metodo)(*args, **kw)}
    except (pve.ErrorPve, sala.ErrorSala) as e:
        r = {"error": str(e), "http": e.http}
    except ValueError as e:
        r = {"valueerror": str(e)}
    rec.append({"at": at, "m": metodo, "a": copy.deepcopy(list(args)), "kw": kw, "r": copy.deepcopy(r)})
    return r

def mazo(n, prefijo="q"):
    return [{"id": "%s%d" % (prefijo, i), "enunciado": "Pregunta %d" % i, "tema": "Tema %d" % (i % 4),
             "opciones": [{"id": "a", "texto": "A"}, {"id": "b", "texto": "B"}, {"id": "c", "texto": "C"}, {"id": "d", "texto": "D"}],
             "correcta": "abcd"[i % 4]} for i in range(n)]

out = {"pve": [], "sala": [], "ding": []}

# ============ PVE ============
for n in range(14):
    _cont.update(tok=0, **{"let": 0, "sys": 0})
    r = random.Random(500 + n)
    rec = []
    av = pve.Aventuras(reloj=ahora)
    t = 1000.0
    datos = {"nombre": "Héroe", "clase": r.choice(rpg.CLASES), "preguntas": mazo(r.randint(5, 20)), "equipo": [k for k in list(PU)[:3]],
             "dificultad": r.choice(("facil", "normal", "dificil", "x")), "con_tiempo": n % 2 == 0, "segundos": 20,
             "enemigo": {"nombre": "Orco", "clase": "mago"}, "aciertos_antes": r.choice((0, 8, 25)), "entregados_antes": r.choice((0, 49)), "entregados_hoy": r.choice((0, 9, 10))}
    if n == 12: datos["preguntas"] = []
    if n == 13: datos["clase"] = "payaso"
    res = llamar(rec, av, t, "iniciar", datos)
    if "ok" in res:
        token = res["ok"]["token"]
        for paso in range(70):
            t += r.choice((0.5, 2, 5, 11, 25, 45))
            vista = llamar(rec, av, t, "estado", token)
            if "ok" not in vista: break
            v = vista["ok"]
            if v["batalla"]["ganador"] is not None: break
            b = v["batalla"]
            e = r.random()
            if b["fase"] == "responder":
                if e < 0.15 and b["yo_estado"]["equipo"]:
                    llamar(rec, av, t, "accion", token, {"tipo": "power_up", "id": r.choice(list(b["yo_estado"]["equipo"])), "turno": b["turno"]})
                elif e < 0.2:
                    llamar(rec, av, t, "accion", token, {"tipo": "responder", "opcion": "a", "turno": b["turno"] - 1})
                elif e < 0.23:
                    llamar(rec, av, t, "accion", token, {"tipo": "dance"})
                elif e < 0.25:
                    llamar(rec, av, t, "accion", token, {"tipo": "abandonar"})
                else:
                    correcta = b["pregunta"]["opciones"][0]["id"]
                    q = av._b[token]["estado"]["jugadores"]["j2"]["mazo"]["preguntas"][b["pregunta"]["id"]]
                    op = q["correcta"] if r.random() < 0.6 else r.choice([o["id"] for o in b["pregunta"]["opciones"]] + [None])
                    llamar(rec, av, t, "accion", token, {"tipo": "responder", "opcion": op, "turno": b["turno"]})
        llamar(rec, av, t + 1, "estado", token)
        llamar(rec, av, t + 2, "accion", token, {"tipo": "abandonar"})
    llamar(rec, av, t + 3, "estado", "no-existe")
    out["pve"].append({"n": n, "datos": datos, "ops": rec})

# ============ SALA ============
def preparar_ambos(rec, S, codigo, t, tk1, tk2, r, con_tiempo):
    for tk in (tk1, tk2):
        eq = [k for k, v in PU.items() if (con_tiempo or not v.get("requiere_tiempo")) and v["rareza"] == "comun"][:r.randint(0, 3)]
        llamar(rec, S, t, "preparar", codigo, tk, r.choice(rpg.CLASES), mazo(24, "m"), eq)

for n in range(12):
    _cont.update(tok=0, **{"let": 0, "sys": 0})
    r = random.Random(900 + n)
    rec = []
    S = sala.Salas(reloj=ahora)
    t = 5000.0
    con_tiempo = n % 2 == 0
    c = llamar(rec, S, t, "crear", "Ana")["ok"]; cod = c["codigo"]; tk1 = c["token"]
    llamar(rec, S, t, "unirse", "zzzz", "X")
    llamar(rec, S, t, "estado", cod, "mal-token")
    u = llamar(rec, S, t, "unirse", cod.lower(), "  Luis  ")["ok"]; tk2 = u["token"]
    llamar(rec, S, t, "unirse", cod, "Tercero")
    llamar(rec, S, t, "configurar", cod, tk2, {"dano_base": 5})
    llamar(rec, S, t, "configurar", cod, tk1, {"con_tiempo": con_tiempo, "segundos_pregunta": 20, "dano_base": r.choice((5, 10, 25)), "ventaja": 2, "basura": 1})
    llamar(rec, S, t, "listo", cod, tk1, True)
    llamar(rec, S, t, "preparar", cod, tk1, "payaso", mazo(24))
    llamar(rec, S, t, "preparar", cod, tk1, "mago", mazo(3))
    preparar_ambos(rec, S, cod, t, tk1, tk2, r, con_tiempo)
    llamar(rec, S, t, "estado", cod, tk1)
    f = llamar(rec, S, t, "estado", cod, tk1)["ok"]["firma"]
    llamar(rec, S, t + 1, "estado", cod, tk1, f)
    llamar(rec, S, t + 2, "listo", cod, tk1, True)
    llamar(rec, S, t + 3, "listo", cod, tk2, True)
    toks = {"j1": tk1, "j2": tk2}
    for paso in range(110):
        t += r.choice((0.5, 1, 3, 9, 15, 40))
        if n == 5 and paso == 25: t += 200                      # abandono por inactividad
        v = llamar(rec, S, t, "estado", cod, tk1 if paso % 2 == 0 else tk2)
        if "ok" not in v: break
        v = v["ok"]
        if v["fase"] == "fin":
            if n % 3 == 0 and paso < 100:
                llamar(rec, S, t, "accion", cod, tk1, {"tipo": "revancha"})
                preparar_ambos(rec, S, cod, t, tk1, tk2, r, con_tiempo)
                llamar(rec, S, t, "listo", cod, tk1, True); llamar(rec, S, t, "listo", cod, tk2, True)
                continue
            break
        if v["fase"] != "duelo": break
        b = v["batalla"]; atq = b["atacante"]; dfn = "j2" if atq == "j1" else "j1"
        s = S._salas[cod]; est = s["batalla"]; e = r.random()
        if b["fase"] == "elegir":
            if e < 0.2 and est["jugadores"][atq]["equipo"]:
                llamar(rec, S, t, "accion", cod, toks[atq], {"tipo": "power_up", "id": r.choice(list(est["jugadores"][atq]["equipo"]))})
            elif e < 0.25:
                llamar(rec, S, t, "accion", cod, toks[dfn], {"tipo": "elegir", "pregunta": "q1"})
            else:
                llamar(rec, S, t, "accion", cod, toks[atq], {"tipo": "elegir", "pregunta": r.choice(est["jugadores"][atq]["oferta"])})
        else:
            if e < 0.15 and est["jugadores"][dfn]["equipo"]:
                llamar(rec, S, t, "accion", cod, toks[dfn], {"tipo": "power_up", "id": r.choice(list(est["jugadores"][dfn]["equipo"]))})
            elif e < 0.2:
                llamar(rec, S, t, "accion", cod, toks[atq], {"tipo": "responder", "opcion": "a"})
            elif e < 0.22:
                llamar(rec, S, t, "accion", cod, toks[dfn], {"tipo": "abandonar"})
            elif e < 0.24:
                llamar(rec, S, t, "accion", cod, toks[dfn], {"tipo": "baile"})
            else:
                p = est["pregunta"]; q = est["jugadores"][p["de"]]["mazo"]["preguntas"][p["id"]]
                op = q["correcta"] if r.random() < 0.55 else r.choice([o["id"] for o in q["opciones"]] + [None])
                llamar(rec, S, t, "accion", cod, toks[dfn], {"tipo": "responder", "opcion": op})
    llamar(rec, S, t + 1, "cerrar", cod, tk2)
    llamar(rec, S, t + 2, "cerrar", cod, tk1)
    llamar(rec, S, t + 3, "estado", cod, tk1)
    out["sala"].append({"n": n, "ops": rec})

# ============ DING ============
def test_ding(n):
    fijas = [{"id": "f%d" % i, "enunciado": "¿Pregunta fija %d?" % i, "tema": "T",
              "opciones": [{"id": "a", "texto": "uno"}, {"id": "b", "texto": "dos"}, {"id": "c", "texto": "tres"}], "correcta": "abc"[i % 3]} for i in range(4)]
    din = [{"id": "d1", "enunciado": "Suma {a} + {b}", "dinamica": {"enunciado": "Suma {a} + {b}", "variables": [{"nombre": "a", "min": 1, "max": 9}, {"name": "b", "min": 2, "max": 20, "paso": 2}],
            "formula": "a + b", "decimales": 0, "distractores": [{"formula": "a - b", "clase": "concepto"}], "opcionesAMostrar": 4}},
           {"id": "d2", "dinamica": {"enunciado": "Divide {x} entre {y} = ?", "variables": [{"nombre": "x", "min": 10, "max": 100, "paso": 5}, {"nombre": "y", "min": 1, "max": 5, "decimales": 1, "paso": 0.5}], "formula": "round(x / y, 2)", "decimales": 2}}]
    return fijas + din

for n in range(14):
    _cont.update(tok=0, **{"let": 0, "sys": 0})
    r = random.Random(2000 + n)
    rec = []
    D = ding.Dings(reloj=ahora, rng=random.Random(77 + n))
    t = 9000.0
    c = llamar(rec, D, t, "crear", "Profe")["ok"]; cod = c["codigo"]; tp = c["token"]
    llamar(rec, D, t, "crear", None)
    toks = [llamar(rec, D, t, "unirse", cod, "Jugador%d" % i)["ok"]["token"] for i in range(r.choice((1, 2, 3, 4)))]
    llamar(rec, D, t, "unirse", cod, "Sobra"); llamar(rec, D, t, "unirse", cod, "Sobra2")
    llamar(rec, D, t, "configurar", toks[0], toks[0], {"efecto": "caen"})
    llamar(rec, D, t, "configurar", cod, toks[0], {"efecto": "caen"})
    llamar(rec, D, t, "configurar", cod, tp, {"efecto": r.choice(("maquina", "caen", "giran", "ninguno", "zzz")), "velocidad": r.choice(("lenta", "rapida", "x")),
           "num_preguntas": r.choice((0, 3, 6)), "mezclar": n % 2 == 0, "repeticiones_dinamicas": r.choice((1, 2, 20)), "auto_avance": n % 3 != 0,
           "espera_s": 3, "restar_puntos": n % 4 != 0, "puntos_acierto": 12, "puntos_fallo": 7, "limite_activo": n % 5 == 0, "limite_s": 15, "otro": 5})
    llamar(rec, D, t, "accion", cod, tp, {"tipo": "empezar"})
    llamar(rec, D, t, "cargar_test", cod, tp, " Mi test ", [])
    llamar(rec, D, t, "cargar_test", cod, tp, "malo", [{"id": "x", "opciones": [{"id": "a"}]}])
    llamar(rec, D, t, "cargar_test", cod, tp, "malo2", [{"id": "x", "enunciado": "e", "dinamica": {"formula": "a/0", "variables": [{"nombre": "a", "min": 1, "max": 3}]}}])
    llamar(rec, D, t, "cargar_test", cod, tp, "malo3", [{"id": "x", "enunciado": "e", "dinamica": {"formula": "2**3**2", "variables": []}}])
    llamar(rec, D, t, "cargar_test", cod, tp, "Mi test de prueba", test_ding(n))
    llamar(rec, D, t, "accion", cod, tp, {"tipo": "empezar"}) if len(toks) < 2 else None
    llamar(rec, D, t, "accion", cod, toks[0], {"tipo": "empezar"})
    llamar(rec, D, t, "accion", cod, tp, {"tipo": "empezar"})
    for paso in range(160):
        t += r.choice((0.2, 1, 2, 6, 20))
        who = r.choice(["pres"] + list(range(len(toks))))
        tk = tp if who == "pres" else toks[who]
        v = llamar(rec, D, t, "estado", cod, tk)
        if "ok" not in v: break
        v = v["ok"]
        if v["fase"] == "fin":
            break
        s = D._salas[cod]
        if v["fase"] == "abierta":
            if r.random() < 0.7:
                j = r.randrange(len(toks)); jid = "p%d" % (j + 1)
                a = s["actual"]
                op = a["correcta"] if r.random() < 0.4 else r.choice([o["id"] for o in a["opciones"]] + ["zz"])
                llamar(rec, D, t, "accion", cod, toks[j], {"tipo": "responder", "opcion": op})
        elif v["fase"] == "resuelta":
            if not s["config"]["auto_avance"] and r.random() < 0.6:
                llamar(rec, D, t, "accion", cod, tp, {"tipo": "siguiente"})
            elif r.random() < 0.05:
                llamar(rec, D, t, "accion", cod, tp, {"tipo": "terminar"})
        if r.random() < 0.03: llamar(rec, D, t, "accion", cod, tp, {"tipo": "baile"})
        if r.random() < 0.03: llamar(rec, D, t, "accion", cod, toks[0], {"tipo": "siguiente"})
        f = v.get("firma")
        if r.random() < 0.3: llamar(rec, D, t, "estado", cod, tk, f)
    llamar(rec, D, t + 1, "accion", cod, tp, {"tipo": "terminar"})
    llamar(rec, D, t + 2, "estado", cod, toks[0])
    llamar(rec, D, t + 3, "cerrar", cod, toks[0])
    llamar(rec, D, t + 4, "cerrar", cod, tp)
    out["ding"].append({"n": n, "ops": rec})

json.dump(out, open(os.path.join(RAIZ, "tests", "fixtures", "salas.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("ok", sum(len(x["ops"]) for x in out["pve"]), sum(len(x["ops"]) for x in out["sala"]), sum(len(x["ops"]) for x in out["ding"]))
