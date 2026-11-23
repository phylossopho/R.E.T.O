# Fixtures de paridad: mahjong y memorama.
import json, sys, os
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PY = os.path.join(RAIZ, "_legacy_python")
sys.path.insert(0, PY)
from logica import mahjong, memorama

def intentar(f, *a, **k):
    try: return {"ok": f(*a, **k)}
    except ValueError as e: return {"error": str(e)}

out = {"mahjong": [], "revolver": [], "memorama": [], "juego": []}
for nivel in ("facil", "medio", "dificil", "raro"):
    for sem in (1, 2, 3, 77, 123456, 2**31 - 1):
        p = intentar(mahjong.nueva_partida, nivel, sem)
        out["mahjong"].append({"a": [nivel, sem], "r": p})
        if "ok" in p:
            fich = p["ok"]["fichas"]
            out["revolver"].append({"a": [fich, sem + 5], "r": intentar(mahjong.revolver, fich, sem + 5)})
            out["revolver"][-1]["jug"] = mahjong.jugadas(fich)
out["revolver"].append({"a": [[], 1], "r": intentar(mahjong.revolver, [], 1)})
out["revolver"].append({"a": [[{"id":1,"x":0,"y":0,"z":0,"t":0}], 1], "r": intentar(mahjong.revolver, [{"id":1,"x":0,"y":0,"z":0,"t":0}], 1)})
out["cat_mahjong"] = mahjong.catalogos()
out["cat_memorama"] = memorama.catalogos()
for tam in ("3x4", "4x4", "4x5", "9x9"):
    for cat in ("formas", "numeros", "letras", "emojis", "x"):
        for sem in (0, 5, 99):
            out["memorama"].append({"a": [tam, cat, sem], "r": intentar(memorama.nueva_partida, tam, cat, semilla=sem)})
# una partida jugada completa (tomando los simbolos reales)
p = memorama.nueva_partida("4x4", "formas", semilla=7)
pasos = []
import copy
def reg(c):
    global p
    p, res = memorama.voltear(p, c)
    pasos.append({"carta": c, "res": res, "vista": memorama.estado_para_la_pagina(p)})
simb = {}
for c in p["cartas"]: simb.setdefault(c["simbolo"], []).append(c["id"])
reg(0); reg(1)
if p["bloqueado"]:
    pasos.append({"ocultar": True, "vista": memorama.estado_para_la_pagina(memorama.ocultar(p))})
for s, ids in simb.items():
    for c in ids: reg(c)
out["juego"] = pasos
json.dump(out, open(os.path.join(RAIZ, "tests", "fixtures", "juegos.json"), "w"), ensure_ascii=False)
print("ok")
