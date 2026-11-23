# Fixtures de paridad: rpg (batallas completas paso a paso, premios, niveles, tarjetas).
import json, sys, os, random, copy
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PY = os.path.join(RAIZ, "_legacy_python")
sys.path.insert(0, PY)
from logica import rpg

def intentar(f, *a, **k):
    try: return {"ok": f(*a, **k)}
    except ValueError as e: return {"error": str(e)}

PU = rpg.power_ups()
out = {"batallas": [], "premios": [], "niveles": [], "tarjetas": [], "config": [], "mazo": [], "equipo": [], "efectos": [], "varios": []}

def mazo(n, prefijo="q"):
    return [{"id": "%s%d" % (prefijo, i), "enunciado": "Pregunta %d" % i, "tema": "Tema %d" % (i % 4),
             "opciones": [{"id": "a", "texto": "A"}, {"id": "b", "texto": "B"}, {"id": "c", "texto": "C"}, {"id": "d", "texto": "D"}],
             "correcta": "abcd"[i % 4]} for i in range(n)]

def equipo_al_azar(r, con_tiempo):
    ids = [k for k, v in PU.items() if con_tiempo or not v.get("requiere_tiempo")]
    r.shuffle(ids)
    eq, c = [], {"comun": 0, "especial": 0, "raro_o_muy_raro": 0}
    for i in ids:
        k = "raro_o_muy_raro" if PU[i]["rareza"] in ("raro", "muy_raro") else PU[i]["rareza"]
        if c[k] < rpg.EQUIPO_MAX[k] if hasattr(rpg, "EQUIPO_MAX") else True:
            pass
        lim = {"comun": 3, "especial": 2, "raro_o_muy_raro": 1}[k]
        if c[k] < lim and len(eq) < r.choice((2, 4, 6)):
            eq.append(i); c[k] += 1
    return eq

for n in range(70):
    r = random.Random(1000 + n)
    modo = "pve" if n % 3 == 0 else "pvp"
    con_tiempo = n % 2 == 0
    cfg = {"modo": modo, "con_tiempo": con_tiempo, "pv_max": r.choice((50, 100, 150)), "dano_base": r.choice((5, 10, 20)), "ventaja": r.choice((0, 3, 6)),
           "contraataque": r.choice((0.5, 1.0, 1.25)), "max_por_pregunta": r.choice((1, 2)), "max_power_ups": r.choice((None, 2, 5)),
           "mazo_min": 6, "mazo_max": 30, "oferta": r.choice((2, 4)), "max_turnos": r.choice((6, 12, 60))}
    s1 = {"nombre": "Ana" + "x" * 30, "clase": r.choice(rpg.CLASES), "nivel": r.randint(0, 40), "preguntas": mazo(r.randint(8, 12), "a"), "equipo": equipo_al_azar(r, con_tiempo)}
    s2 = {"nombre": "Enemigo", "clase": r.choice(rpg.CLASES), "preguntas": mazo(r.randint(8, 12), "b"), "equipo": equipo_al_azar(r, con_tiempo)}
    sem = r.choice((n, 123456, "texto-%d" % n, 2**40 + n)) if n % 5 == 0 else n + 7
    pasos = []
    try:
        est = rpg.nueva_batalla(cfg, s1, s2, semilla=sem)
    except ValueError as e:
        out["batallas"].append({"cfg": cfg, "s1": s1, "s2": s2, "sem": sem, "inicio": {"error": str(e)}}); continue
    out["batallas"].append({"cfg": cfg, "s1": s1, "s2": s2, "sem": sem, "inicio": {"ok": copy.deepcopy(est)}, "pasos": pasos})
    for _ in range(90):
        if est["ganador"] is not None: break
        fase = est["fase"]; atq = est["atacante"]; dfn = "j2" if atq == "j1" else "j1"
        pub = rpg.estado_publico(est, atq)
        eleccion = r.random()
        if fase == "elegir":
            if eleccion < 0.25 and est["jugadores"][atq]["equipo"]:
                accion = ["usar_power_up", atq, r.choice(list(est["jugadores"][atq]["equipo"]))]
            elif eleccion < 0.3:
                accion = ["elegir_pregunta", dfn, "x"]
            else:
                accion = ["elegir_pregunta", atq, r.choice(est["jugadores"][atq]["oferta"] + (["zzz"] if r.random() < 0.05 else []))]
        elif fase == "responder":
            if eleccion < 0.2 and est["jugadores"][dfn]["equipo"]:
                accion = ["usar_power_up", dfn, r.choice(list(est["jugadores"][dfn]["equipo"]))]
            elif eleccion < 0.28:
                accion = ["tiempo_pasado", r.randint(0, 40)]
            elif eleccion < 0.33:
                accion = ["agotar_tiempo"]
            elif eleccion < 0.36:
                accion = ["responder", atq, "a", 1000]
            else:
                p = est["pregunta"]; q = est["jugadores"][p["de"]]["mazo"]["preguntas"][p["id"]]
                op = q["correcta"] if r.random() < 0.55 else r.choice([o["id"] for o in q["opciones"]] + [None, "zz"])
                accion = ["responder", dfn, op, r.choice((None, 500, 20000, 60000))]
        else: break
        f = accion[0]
        if f == "usar_power_up": res = intentar(rpg.usar_power_up, est, accion[1], accion[2])
        elif f == "elegir_pregunta": res = intentar(rpg.elegir_pregunta, est, accion[1], accion[2])
        elif f == "responder": res = intentar(rpg.responder, est, accion[1], accion[2], accion[3])
        elif f == "agotar_tiempo": res = intentar(rpg.agotar_tiempo, est)
        elif f == "tiempo_pasado": res = intentar(rpg.tiempo_pasado, est, accion[1])
        if "error" in res: paso = {"a": accion, "error": res["error"]}
        else: paso = {"a": accion, "ok": True}
        paso["estado"] = copy.deepcopy(est)
        paso["pub1"] = rpg.estado_publico(est, "j1"); paso["pub2"] = rpg.estado_publico(est, "j2", True)
        pasos.append(paso)
    if est["ganador"] is not None:
        pasos.append({"a": ["resumen"], "resumen": rpg.resumen_final(est)})
# premios
for s in range(40):
    for (a, d) in ((0, 10), (5, 35), (9, 10), (0, 100), (50, 49), (0, 600)):
        r1 = random.Random(s)
        out["premios"].append({"a": [a, d, s, bool(s % 2), s * 3, s % 12], "r": rpg.sortear_premios(a, d, r1, bool(s % 2), s * 3, s % 12)})
for s in range(30):
    out["premios"].append({"a": ["unico", s], "r": rpg.sortear_power_up(random.Random(s), bool(s % 2), None), "raro": rpg.sortear_power_up(random.Random(s), True, "muy_raro")})
# niveles
for p in [0, 0.5, 19.9, 20, 56.5, 56.57, 160, 160.0001, 1000, 5000, 12345.6, 99999, 1_000_000, -5]:
    out["niveles"].append({"p": p, "nivel": rpg.nivel_de_puntos(p), "prog": rpg.progreso_de_nivel(p) if p >= 0 else None})
for tipo in ("lectura", "vision", "test", "rpg", "otro"):
    for mm, rr, pp in ((0, 0, 0), (0.5, 1, 2), (1, 0, 0), (5, 3, 10), (0, 2, 3), (0, 2, 2)):
        out["niveles"].append({"s": [tipo, mm, rr, pp], "r": rpg.puntos_sesion(tipo, mm, rr, pp)})
for hoy, nuevos in ((0, 10), (100, 50), (130, 5), (-4, 3), (0, -1)):
    out["niveles"].append({"t": [hoy, nuevos], "r": rpg.aplicar_tope_diario(hoy, nuevos)})
ses = [{"tipo": "lectura", "minutos": 30, "fecha": "2026-10-01T10:00"}, {"tipo": "lectura", "minutos": 200, "fecha": "2026-10-01"}, {"tipo": "test", "rondas": 2, "preguntas": 9, "fecha": "2026-10-02"},
       {"tipo": "x"}, "raro", {"tipo": "vision", "minutos": "abc"}, {"tipo": "rpg", "rondas": "3", "preguntas": 4.7, "minutos": "2.5", "fecha": 20261003}, {"tipo": "vision", "minutos": 1}]
out["niveles"].append({"ses": ses, "r": rpg.puntos_de_sesiones(ses)})
out["niveles"].append({"ses": None, "r": rpg.puntos_de_sesiones(None)})
for t in (0, 5, 29.5, 2**33):
    out["niveles"].append({"seg": [t, 2], "r": rpg.segundos_con_perdida(t, 2)})
# tarjetas
inv = list(PU)[:8]
perfiles = [
 {"nombre": "Ana", "puntos": 123.46, "aciertos": 30, "inventario": inv, "equipo": inv[:3], "config": {"contraataque": 1.25, "con_tiempo": True, "x": [1, 2.5, "é"]}, "tiempo_por_modulo": {"lectura": 12.5, "test": 30}},
 {"nombre": "Ñandú " * 8, "puntos": 0, "aciertos": 0, "inventario": [], "equipo": [], "config": {}, "tiempo_por_modulo": {}},
 {"puntos": "50", "aciertos": "7", "inventario": inv[:2], "equipo": ["no-esta", inv[0], inv[0]]},
 {"nombre": "Tope", "puntos": 9999999, "aciertos": 99999999999},
 {"nombre": "Malo", "inventario": ["inexistente"]}, {"nombre": "Malo2", "puntos": "abc"}, {"nombre": "Malo3", "inventario": "x"}, "texto", None,
]
for p in perfiles:
    t = intentar(rpg.crear_tarjeta, p, "2026-10-24T10:20:00")
    out["tarjetas"].append({"perfil": p, "t": t})
    if "ok" in t:
        out["tarjetas"].append({"validar": t["ok"], "r": intentar(rpg.validar_tarjeta, t["ok"])})
        mal = copy.deepcopy(t["ok"]); mal["perfil"]["aciertos"] = 5000
        out["tarjetas"].append({"validar": mal, "r": intentar(rpg.validar_tarjeta, mal)})
        mal2 = dict(t["ok"], fecha="2030-01-01")
        out["tarjetas"].append({"validar": mal2, "r": intentar(rpg.validar_tarjeta, mal2)})
for t in (None, "hola", {}, {"tipo": "otra"}, {"tipo": "tarjeta-reto", "v": 99}):
    out["tarjetas"].append({"validar": t, "r": intentar(rpg.validar_tarjeta, t)})
# v1
t1 = {"tipo": "tarjeta-reto", "v": 1, "fecha": "2026-01-01", "perfil": rpg.validar_perfil(perfiles[0], version=1)}
t1["huella"] = rpg._huella(t1["perfil"], "2026-01-01", version=1)
out["tarjetas"].append({"validar": t1, "r": intentar(rpg.validar_tarjeta, t1)})
# config
for cfg in (None, {}, {"modo": "pve"}, {"pv_max": "70", "dano_base": 99, "ventaja": -3, "contraataque": "x", "con_tiempo": "no", "segundos_pregunta": 5, "oferta": 9,
            "mazo_min": 80, "mazo_max": 3, "max_power_ups": 50, "max_por_pregunta": 7, "rarezas": ["raro", "zz", "comun"], "prohibidos": ["a", 2, None], "max_turnos": 1},
            {"con_tiempo": 0, "max_power_ups": None, "rarezas": "x", "prohibidos": "y"}, {"contraataque": 0.333, "pv_max": 99.9}):
    out["config"].append({"cfg": cfg, "r": rpg.normalizar_config(cfg)})
# mazo / equipo
m24 = mazo(24)
casos_mazo = [(m24, None), (mazo(3), None), ("x", None), ([{"id": "", "enunciado": "x", "opciones": [1, 2]}] * 24, None), (mazo(24) + [], {"mazo_min": 30}),
              ([dict(q, correcta="z") for q in m24], None), ([dict(m24[0])] * 24, None),
              ([dict(q, opciones=[{"id": "a", "texto": "x"}, {"id": "a", "texto": "y"}]) for q in m24], None), ([5] * 24, None),
              ([dict(q, id=" %s " % q["id"], tema=None) for q in m24], None)]
for pregs, cfg in casos_mazo:
    out["mazo"].append({"a": [pregs, cfg], "r": intentar(rpg.validar_mazo, pregs, cfg)})
ids = list(PU)
for eq, cfg in ([[], None], [ids[:3], None], [[ids[0], ids[0]], None], [["xx"], None], [ids, None], [ids[:2], {"prohibidos": [ids[0]]}], [ids[:2], {"rarezas": ["comun"]}],
                [[k for k, v in PU.items() if v.get("requiere_tiempo")][:1], {"con_tiempo": False}], [[k for k, v in PU.items() if v["rareza"] in ("raro", "muy_raro")][:2], None]):
    out["equipo"].append({"a": [eq, cfg], "r": intentar(rpg.validar_equipo, eq, cfg)})
for k in PU:
    for clase in rpg.CLASES:
        for modo in ("pvp", "pve"):
            out["efectos"].append({"a": [k, clase, modo], "r": rpg.efecto_de(k, clase, modo)})
out["varios"].append({"elegibles": [rpg.elegibles(True), rpg.elegibles(False), rpg.elegibles(True, ["raro"], [ids[0]])]})
out["varios"].append({"inv": [intentar(rpg.inventario_agregar, ["a"], ids[0]), intentar(rpg.inventario_agregar, ["a"] * 99, ids[0]), intentar(rpg.inventario_agregar, [], "zz")]})
out["varios"].append({"clase": [[a, b, v, rpg.puntos_de_clase(a, b, v)] for a in rpg.CLASES for b in rpg.CLASES for v in (0, 3)]})
json.dump(out, open(os.path.join(RAIZ, "tests", "fixtures", "rpg.json"), "w"), ensure_ascii=False)
print("ok", len(out["batallas"]), sum(len(b.get("pasos", [])) for b in out["batallas"]), "pasos")
