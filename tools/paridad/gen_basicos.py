# Genera fixtures de paridad (Python -> JSON) para schulte, secuencia y red.
import json, sys, os
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PY = os.path.join(RAIZ, "_legacy_python")
sys.path.insert(0, PY)
from logica import schulte, secuencia, red

def intentar(f, *a, **k):
    try: return {"ok": f(*a, **k)}
    except ValueError as e: return {"error": str(e)}

out = {"schulte": [], "secuencia": [], "red": [], "cat": {}}
for tam in ("3x3", "4x4", "5x5", "9x9"):
    for cont in ("numeros", "letras", "emojis", "colores", "x"):
        for sem in (0, 1, 7, 999, 2**33 + 1):
            out["schulte"].append({"a": [tam, cont, sem], "r": intentar(schulte.nueva_tabla, tam, cont, semilla=sem)})
for b in ("4", "6", "9", "5"):
    for largo in (1, 5, 8, 12, 50, 61, 0):
        for sem in (1, 42, 123456):
            out["secuencia"].append({"a": [b, largo, sem], "r": intentar(secuencia.nueva_secuencia, b, largo, semilla=sem)})
out["cat"] = {"schulte": schulte.catalogos(), "secuencia": secuencia.catalogos(),
  "contraste": [[a, b, secuencia.contraste(a, b)] for a, b in (("#000000", "#FFFFFF"), ("#0072B2", "#F0E442"), ("#999999", "#222222"))],
  "texto": [[c, secuencia.color_de_texto(c)] for c in ("#0072B2", "#F0E442", "#FFFFFF", "#000000", "#999999")]}
for h in ("localhost", "127.0.0.1:8000", "192.168.1.5", "10.0.0.2:80", "172.16.5.1", "172.32.0.1", "8.8.8.8", "[::1]:8000", "mi-pc.local", "fe80::1", "reto.github.io", "", None, "300.1.1.1", "169.254.1.1"):
    out["red"].append({"k": "local", "a": [h], "r": red.es_direccion_local(h)})
for t in ("  Ana  \x00 María ", "", None, "x" * 40):
    out["red"].append({"k": "nombre", "a": [t], "r": red.limpiar_nombre(t)})
for t in ("a-b_c!!ñ", "", None, "z" * 40):
    out["red"].append({"k": "cid", "a": [t], "r": red.limpiar_cid(t)})
for t in ("hola\n mundo", "   ", None, "y" * 200):
    out["red"].append({"k": "mensaje", "a": [t], "r": intentar(red.limpiar_mensaje, t)})
e = red.Eco(); seq = []
seq.append(e.agregar("Ana", "hola", "1.1.1.1", ahora=100.0, cid="aa"))
seq.append(intentar(e.agregar, "Ana", "otra", "1.1.1.1", ahora=100.2, cid="aa"))
seq.append(e.agregar("Luis", "ey", "1.1.1.2", ahora=100.3, cid="bb"))
seq.append(e.desde(0, "1.1.1.1", ahora=101.0, cid="aa"))
seq.append(e.desde(1, "1.1.1.9", ahora=120.0))
out["red"].append({"k": "eco", "r": seq})
json.dump(out, open(os.path.join(RAIZ, "tests", "fixtures", "basicos.json"), "w"), ensure_ascii=False)
print("ok", len(out["schulte"]), len(out["secuencia"]))
