# Fixtures de paridad HTTP: las mismas peticiones al server.py original (Flask) y al enrutador JS.
import json, sys, os, re, time, glob
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PY = os.path.join(RAIZ, "_legacy_python")
sys.path.insert(0, PY)
import server
from logica import rpg
c = server.app.test_client()

def mazo(n=24):
    return [{"id": "q%d" % i, "enunciado": "P%d" % i, "tema": "T", "opciones": [{"id": "a", "texto": "A"}, {"id": "b", "texto": "B"}, {"id": "c", "texto": "C"}], "correcta": "abc"[i % 3]} for i in range(n)]

parrafos = ["Hola mundo. Esto es una prueba, con varias palabras; y más palabras para leer." * 3, "Segundo párrafo corto."]
PU = list(rpg.power_ups())
perfil = {"nombre": "Ana", "puntos": 80.5, "aciertos": 12, "inventario": PU[:4], "equipo": PU[:2], "config": {"x": 1}, "tiempo_por_modulo": {}}
tarjeta = c.post("/api/rpg/tarjeta", json={"perfil": perfil}).get_json()
reqs = [
 ("POST", "/api/lectura/plan", {"motor": m, "parrafos": parrafos, "tamano_grupo": 4, "palabras_por_tramo": 2}) for m in ("galactico", "palabra", "grupo", "frases", "pacer", "columnas", "skimming", "zzz", None)
] + [
 ("POST", "/api/lectura/plan", {"motor": "grupo", "parrafos": parrafos, "tamano_grupo": 5}),
 ("POST", "/api/lectura/plan", {"motor": "pacer", "parrafos": parrafos, "palabras_por_tramo": 9}),
 ("POST", "/api/lectura/plan", {"motor": "galactico", "parrafos": []}),
 ("POST", "/api/lectura/plan", {"motor": "galactico"}),
 ("POST", "/api/lectura/velocidad", {"palabras": 300, "segundos": 60, "aciertos": 3, "preguntas": 4}),
 ("POST", "/api/lectura/velocidad", {"palabras": 0}),
 ("POST", "/api/vision/plan", {"ejercicio": "sacadas", "semilla": 5, "variante": "aleatoria"}),
 ("POST", "/api/vision/plan", {"ejercicio": "nada"}),
 ("POST", "/api/vision/ajustar", {"ejercicio": "periferico", "nivel": 2, "racha": 2, "acerto": True}),
 ("POST", "/api/vision/ajustar", {"ejercicio": "x"}),
 ("GET", "/api/schulte/catalogos", None),
 ("POST", "/api/schulte/nueva", {"tamano": "4x4", "contenido": "colores", "semilla": 3}),
 ("POST", "/api/schulte/nueva", {"semilla": 3}), ("POST", "/api/schulte/nueva", {"tamano": "9x9"}),
 ("GET", "/api/secuencia/catalogos", None),
 ("POST", "/api/secuencia/nueva", {"semilla": 2}), ("POST", "/api/secuencia/nueva", {"botones": "6", "largo": 12, "semilla": 9}), ("POST", "/api/secuencia/nueva", {"largo": 999, "semilla": 1}),
 ("GET", "/api/mahjong/catalogos", None),
 ("POST", "/api/mahjong/nueva", {"semilla": 4}), ("POST", "/api/mahjong/nueva", {"nivel": "dificil", "semilla": 4}), ("POST", "/api/mahjong/nueva", {"nivel": "x"}),
 ("POST", "/api/mahjong/revolver", {"fichas": [], "semilla": 1}),
 ("GET", "/api/memorama/catalogos", None),
 ("POST", "/api/tests/ronda", {"preguntas": [{"id": "a%d" % i, "opciones": 4} for i in range(12)], "cantidad": 5, "modo": "azar", "semilla": 8}),
 ("POST", "/api/tests/ronda", {"preguntas": [{"id": "a%d" % i, "opciones": 4} for i in range(12)], "cantidad": 5, "semilla": 8}),
 ("POST", "/api/tests/ronda", {"preguntas": [], "cantidad": 5}),
 ("POST", "/api/tests/dinamica", {"pregunta": {"variables": [{"name": "a", "min": 1, "max": 9}], "formula": "a*2", "enunciado": "{a}x2", "decimales": 0}, "semilla": 3}),
 ("POST", "/api/tests/dinamica", {"pregunta": None}),
 ("POST", "/api/tests/registrar", {"estado": None, "acierto": True, "seguridad": "seguro"}),
 ("POST", "/api/tests/registrar", {"estado": None, "acierto": "si"}),
 ("POST", "/api/tests/resumen", {"tests": [{"id": "t1", "preguntas": [{"id": "x"}, {"id": "y"}], "estados": {}}]}),
 ("POST", "/api/tests/resumen", {"tests": "no"}), ("POST", "/api/tests/resumen", {"tests": [{"id": 5}]}),
 ("POST", "/api/rpg/nivel", {"sesiones": [{"tipo": "lectura", "minutos": 30, "fecha": "2026-10-01"}, {"tipo": "test", "rondas": 2, "preguntas": 9, "fecha": "2026-10-02"}]}),
 ("POST", "/api/rpg/nivel", {}),
 ("POST", "/api/rpg/tarjeta", {"perfil": perfil}), ("POST", "/api/rpg/tarjeta", {"perfil": "x"}), ("POST", "/api/rpg/tarjeta/validar", {"tarjeta": tarjeta}),
 ("POST", "/api/rpg/tarjeta/validar", {"tarjeta": {"tipo": "otra"}}), ("POST", "/api/rpg/tarjeta/validar", {}),
 ("POST", "/api/rpg/premios", {"aciertos_antes": 0, "aciertos": 0}), ("POST", "/api/rpg/premios", {"aciertos": "x"}), ("POST", "/api/rpg/premios", {"aciertos": 50, "entregados_hoy": 10}),
 ("GET", "/api/sala/ZZZZ/estado?token=x", None), ("POST", "/api/sala/unirse", {"codigo": "ZZZZ", "nombre": "x"}), ("POST", "/api/sala/ZZZZ/accion", {"tipo": "elegir"}),
 ("GET", "/api/ding/ZZZZ/estado?token=x", None), ("POST", "/api/ding/ZZZZ/test", {}),
 ("GET", "/api/pve/nada/estado", None), ("POST", "/api/pve/nada/accion", {"tipo": "responder"}), ("POST", "/api/pve/iniciar", {}), ("POST", "/api/pve/iniciar", {"preguntas": mazo(), "clase": "payaso"}),
]
out = []
for m, ruta, cuerpo in reqs:
    r = c.get(ruta) if m == "GET" else c.post(ruta, json=cuerpo)
    d = r.get_json(silent=True)
    out.append({"m": m, "ruta": ruta, "cuerpo": cuerpo, "status": r.status_code, "json": d})
# memorama: flujo con llave
r = c.post("/api/memorama/nueva", json={"tamano": "3x4", "catalogo": "formas", "semilla": 11}); d = r.get_json()
out.append({"m": "POST", "ruta": "/api/memorama/nueva", "cuerpo": {"tamano": "3x4", "catalogo": "formas", "semilla": 11}, "status": r.status_code, "json": d, "memo": True})
llave = d["partida"]
for carta in (0, 1, 2, 3, "x", 99):
    cuerpo = {"partida": llave, "carta": carta}
    r = c.post("/api/memorama/voltear", json=cuerpo); out.append({"m": "POST", "ruta": "/api/memorama/voltear", "cuerpo": cuerpo, "status": r.status_code, "json": r.get_json(), "memo": True})
r = c.post("/api/memorama/ocultar", json={"partida": llave}); out.append({"m": "POST", "ruta": "/api/memorama/ocultar", "cuerpo": {"partida": llave}, "status": r.status_code, "json": r.get_json(), "memo": True})
r = c.post("/api/memorama/voltear", json={"partida": "zz", "carta": 1}); out.append({"m": "POST", "ruta": "/api/memorama/voltear", "cuerpo": {"partida": "zz", "carta": 1}, "status": r.status_code, "json": r.get_json(), "memo": True})
json.dump({"fecha": time.strftime("%Y-%m-%d"), "reqs": out}, open(os.path.join(RAIZ, "tests", "fixtures", "http.json"), "w"), ensure_ascii=False)
print("ok", len(out), "peticiones;", sum(1 for x in out if x["status"] != 200), "con error")
