# Fixtures de paridad: dinamicas y rondas.
# NOTA: el original pierde el signo de los decimales entre -1 y 0 (-0.5 salia "0.5").
# En JS se corrigio; aqui se parchea el original igual para comparar el resto.
import json, sys, os
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PY = os.path.join(RAIZ, "_legacy_python")
sys.path.insert(0, PY)
from logica import dinamicas, rondas

_orig = dinamicas._formatear_numero
def _corregido(val):
    if isinstance(val, float) and not val.is_integer() and "e" not in str(val):
        s = str(val); neg = s.startswith("-"); e, d = s.lstrip("-").split(".")
        return ("-" if neg else "") + f"{int(e):,}.{d}"
    return _orig(val)
dinamicas._formatear_numero = _corregido

def intentar(f, *a, **k):
    try: return {"ok": f(*a, **k)}
    except ValueError as e: return {"error": str(e)}

preguntas_dyn = [
 {"variables":[{"name":"a","min":2,"max":9},{"name":"b","min":1,"max":5,"decimales":1,"paso":0.5}],"formula":"a*b+round(a/3,1)","enunciado":"Calcula {a} por {b}","decimales":2,"distractores":[{"formula":"a+b","clase":"concepto"},{"formula":"a-b"}]},
 {"variables":[{"nombre":"x","min":-20,"max":20,"paso":3},{"nombre":"y","min":-5,"max":5}],"formula":"x//(abs(y)+1) + x*y","enunciado":"{x} {y} {resultado}","decimales":0},
 {"variables":[{"name":"n","min":1,"max":6}],"formula":"n**2 - 3*n % 4","enunciado":"n={n}, r={resultado}","decimales":1,"opcionesAMostrar":5},
 {"variables":[{"name":"p","min":100,"max":99999,"paso":1000}],"formula":"p*1.15","enunciado":"Precio {p} -> {resultado}","decimales":2,"opcionesAMostrar":6},
 {"variables":[{"name":"a","min":1,"max":10}],"formula":"max(a, 5) + min(a, 3) + abs(a-6) + floor(a/4) + ceil(a/4)","enunciado":"{{a}} = {a}","decimales":0},
 {"variables":[{"name":"a","min":1,"max":10}],"formula":"a/0","enunciado":"x"},
 {"variables":[{"name":"a","min":1,"max":10}],"formula":"a + zz","enunciado":"x"},
 {"variables":[{"name":"a","min":1,"max":10}],"formula":"a; 1","enunciado":"x"},
 {"variables":[{"name":"a","min":1,"max":3}],"formula":"-a**2 + 2**-1 + (-a)//2 + (-7)%3","enunciado":"{a:>4} y {b} y {}","decimales":3},
 {"variables":[{"name":"a","min":-1,"max":1,"paso":0.25,"decimales":2}],"formula":"a/2","enunciado":"{a} -> {resultado}","decimales":3},
 {"variables":[],"formula":"2+2","enunciado":"sin variables","decimales":0},
]
out = {"dinamicas": [], "rondas": [], "registrar": [], "resumen": [], "prioridad": []}
for i, p in enumerate(preguntas_dyn):
    for sem in (0, 1, 2, 99, 2024):
        out["dinamicas"].append({"p": p, "s": sem, "r": intentar(dinamicas.generar_instancia, p, semilla=sem)})
        # los mensajes de error de eval de Python no se replican palabra por palabra
        r = out["dinamicas"][-1]["r"]
        if "error" in r: r["error"] = "ERROR"

# rondas
AHORA = 1_900_000_000_000
DIA = 86400000
def preg(i, n=4, tema=None): return {"id": "p%d" % i, "opciones": n, "tema": tema}
pregs = [preg(i, 2 + i % 5, {"n2": "T%d" % (i % 3), "n3": "S%d" % (i % 2)} if i % 4 else None) for i in range(40)]
estados = {}
import random
r0 = random.Random(5)
for i in range(40):
    k = r0.choice([None, "nuevo", "vencida", "futura", "fallo"])
    if k == "vencida": estados["p%d" % i] = {"caja": r0.randint(1, 4), "vistas": 3, "aciertos": 2, "fallos": 1, "ultimo": AHORA - 5*DIA, "vence": AHORA - r0.randint(1, 20)*DIA, "ultimoResultado": "acierto", "ultimaSeguridad": "seguro"}
    elif k == "futura": estados["p%d" % i] = {"caja": r0.randint(1, 5), "vistas": 5, "aciertos": 5, "fallos": 0, "ultimo": AHORA - DIA, "vence": AHORA + r0.randint(1, 20)*DIA, "ultimoResultado": "acierto"}
    elif k == "fallo": estados["p%d" % i] = {"caja": 0, "vistas": 2, "aciertos": 0, "fallos": 2, "ultimo": AHORA - DIA, "vence": AHORA - 1000, "ultimoResultado": "fallo", "ultimaSeguridad": r0.choice([None, "seguro", "dudando"])}
for modo in ("prioridad", "azar", "orden"):
    for cant in (1, 5, 10, 25, 40, 99):
        for sem in (1, 2, 3, 31337):
            out["rondas"].append({"a": [pregs, estados, cant, modo, AHORA, sem], "r": intentar(rondas.armar_ronda, pregs, estados, cant, modo=modo, ahora=AHORA, semilla=sem)})
for caso in ([pregs, estados, 0, "azar", AHORA, 1], [pregs, estados, 3, "xx", AHORA, 1], [[], None, 3, "azar", AHORA, 1],
             [[{"id": "a", "opciones": 1}], None, 1, "azar", AHORA, 1], [[{"id": "a", "opciones": 3}, {"id": "a", "opciones": 3}], None, 1, "azar", AHORA, 1],
             [pregs, {"p1": {"caja": 9}}, 3, "prioridad", AHORA, 1]):
    out["rondas"].append({"a": caso, "r": intentar(rondas.armar_ronda, caso[0], caso[1], caso[2], modo=caso[3], ahora=caso[4], semilla=caso[5])})
out["resumen"].append({"a": [pregs, estados, AHORA], "r": intentar(rondas.resumen_test, pregs, estados, ahora=AHORA)})
out["resumen"].append({"a": [pregs, None, AHORA], "r": intentar(rondas.resumen_test, pregs, None, ahora=AHORA)})
# registrar
est = None
for ac, seg in [(True, "seguro"), (True, "seguro"), (True, "dudando"), (False, "seguro"), (True, None), (True, "adivinando"), (True, "seguro"), (True, "seguro"), (True, "seguro"), (True, "seguro"), (False, None)]:
    ahora = AHORA + len(out["registrar"]) * 1000
    r = intentar(rondas.registrar, est, ac, seg, ahora=ahora)
    out["registrar"].append({"a": [est, ac, seg, ahora], "r": r}); est = r["ok"]
for bad in ([None, "si", None], [None, True, "raro"], [{"caja": 8}, True, None], [{"vistas": -1}, True, None], [5, True, None]):
    out["registrar"].append({"a": [bad[0], bad[1], bad[2], AHORA], "r": intentar(rondas.registrar, bad[0], bad[1], bad[2], ahora=AHORA)})
for k, e in estados.items():
    out["prioridad"].append({"e": e, "r": rondas.prioridad(e, AHORA)})
out["prioridad"].append({"e": None, "r": rondas.prioridad(None, AHORA)})
json.dump(out, open(os.path.join(RAIZ, "tests", "fixtures", "tests_banco.json"), "w"), ensure_ascii=False)
print("ok", len(out["dinamicas"]), len(out["rondas"]))
