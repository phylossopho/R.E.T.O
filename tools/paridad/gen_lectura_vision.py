# Fixtures de paridad: lectura_veloz y vision.
import json, sys, os, re, glob
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PY = os.path.join(RAIZ, "_legacy_python")
sys.path.insert(0, PY)
from logica import lectura_veloz as lv, vision

def intentar(f, *a, **k):
    try: return {"ok": f(*a, **k)}
    except ValueError as e: return {"error": str(e)}

# textos reales de ejemplos/ (sin marcadores) + casos de borde
textos = []
for ruta in sorted(glob.glob(os.path.join(RAIZ, "ejemplos", "*.txt")))[:6]:
    t = open(ruta, encoding="utf-8-sig").read()
    pars = [re.sub(r"^\[[A-Z0-9]+\]\s*", "", l).strip() for l in t.replace("\r", "").split("\n")]
    pars = [p for p in pars if p and not p.startswith("[")]
    textos.append(pars[:60])
extra = [
  ["Hola mundo. Esto es el Sr. Pérez, dr. López y la Dra. Ana vs. el mundo... ¿Verdad? ¡Sí! Fin"],
  ["- viñeta uno", "1. punto", "2) otro punto", "— guion largo — y más; coma, dos puntos: fin.\"", "«Cita larga» (paréntesis). “otra” frase…"],
  ["a" * 30 + " b " + " ".join(["palabra%d," % i if i % 7 == 0 else "palabra%d" % i for i in range(70)]) + "."],
  ["  espacios   raros\u00a0y\tdemás  ", "", "   ", "único"],
  ["Café ñandú canción  e\u0301 acentos combinados. Último párrafo?"],
  [],
  ["   ", ""],
]
casos = textos + extra
out = {"planes": [], "utiles": [], "velocidad": [], "skim": [], "vision": [], "acotar": []}
for pars in casos:
    for motor, f, kw in (("galactico", lv.plan_galactico, {}), ("palabra", lv.plan_palabra, {}), ("grupo3", lv.plan_grupo, {"tamano_grupo": 3}),
                         ("grupo4", lv.plan_grupo, {"tamano_grupo": 4}), ("frases", lv.plan_frases, {}), ("prueba", lv.plan_prueba, {}),
                         ("pacer1", lv.plan_pacer, {"palabras_por_tramo": 1}), ("pacer2", lv.plan_pacer, {"palabras_por_tramo": 2}), ("pacer3", lv.plan_pacer, {}),
                         ("skimming", lv.plan_skimming, {})):
        out["planes"].append({"m": motor, "p": pars, "kw": kw, "r": intentar(f, pars, **kw)})
# skimming con titulos
sk = [{"texto": "Título uno", "titulo": True, "nivel": 1}, "Texto de cuerpo con palabras repetidas: tecnología tecnología tecnología aprendizaje aprendizaje. Segunda oración aquí.",
      {"texto": "Sub título", "titulo": True, "nivel": "3"}, "Otro cuerpo con tecnología y aprendizaje y conocimiento conocimiento.", {"texto": "X", "titulo": True, "nivel": "zz"}, 5, None]
out["skim"].append({"p": sk, "r": intentar(lv.plan_skimming, sk)})
sk2 = [{"texto": "Solo título", "titulo": True}]
out["skim"].append({"p": sk2, "r": intentar(lv.plan_skimming, sk2)})
out["skim"].append({"p": "cadena", "r": intentar(lv.plan_skimming, "cadena")})
for pal in ["Hola", "hola.", "Sr.", "sr.)", "A.", "1.", "12)", "-", "—", "...", "dijo,", "(fin)", "fin.\"", "ñandú:", "etc.", "Núm.", "a—", "«", "", "3.14", "U.S.A.", "e.g.", "Ñ.", "¿qué?", "¡hola!", "…", "'.", "__", "palabrotamuylarga", "x", "—x—", "áé", "12345678901234567", "'-a'"]:
    out["utiles"].append({"w": pal, "tipo": lv.tipo_de_pausa(pal), "ms": lv.pausa_ms(pal), "foco": lv.punto_de_fijacion(pal)})
for args in [(1000, 60, 3, 4), (100, 0, 3, 4), (300, 30.5, 0, 0), (200, 45, 9, 4), ("500", "60", "2", "4"), (0, 10, 1, 1), (-1, 1, 1, 1), (None, 1, 1, 1),
             ("a", 1, 1, 1), (5000, 10, 4, 4), (250, 61, 1, 3), (123, 77, 2, 3), (100.7, 33.3, 3, 4)]:
    out["velocidad"].append({"a": list(args), "r": intentar(lv.calcular_velocidad, *args)})
for v in [300, "250", 47, 1000, 1000.5, "x", None, 55, 123, 12.5, 4294967296, True, -5, "  80 ", 995, 994.9]:
    out["acotar"].append({"v": v, "wpm": lv.acotar_wpm(v), "ini": lv.acotar_escala(lv.ESCALA_INICIO, v), "fin": lv.acotar_escala(lv.ESCALA_FIN, v)})
# vision
ej = {"seguimiento": [{"trayectoria": t, "nivel": n} for t in ("horizontal", "vertical", "diagonal", "circulo", "infinito", "zz") for n in (1, 3, 5, "x", None, 9)],
      "sacadas": [{"variante": v, "nivel": n, "cantidad": c, "reto": r, "semilla": s} for v in ("horizontal", "vertical", "aleatoria", "x") for n in (1, 2, 5) for c in (6, 24, 100) for r in (True, False) for s in (1, 7, 999)],
      "fila": [{"tipo": t, "por_fila": p, "filas": f, "nivel": n, "semilla": s} for t in ("letras", "numeros", "mixto", "x") for p in (2, 8, 20) for f in (1, 4, 9) for n in (1, 4) for s in (1, 5)],
      "periferico": [{"nivel": n, "cantidad": c, "semilla": s, "sin_tiempo": st} for n in (1, 2, 3, 4, 5, 9) for c in (1, 12, 50) for s in (1, 2, 3) for st in (True, False)],
      "piramide": [{"max_ancho": a, "max_filas": f, "semilla": s, "nivel": n} for a in (3, 5, 15, 40) for f in (2, 5, 9, 20) for s in (1, 4) for n in (1, 3, 5)],
      "destello": [{"material": m, "cantidad": c, "exposicion_ms": e, "semilla": s, "minimo_ms": mn, "sensible": se, "reducido": rd} for m in ("palabras", "numeros", "figuras", "x") for c in (2, 4, 6, 9) for e in (100, 1000, 2000) for s in (1, 2, 3) for mn in (200, 500, 900) for se in (True, False) for rd in (False,)],
      "enfoque": [{"duracion_min": d, "nivel": n} for d in (1, 2, 3, 5, 4, "x") for n in (1, 2, 5)],
      "parpadeo": [{"ritmo": r, "duracion_min": d} for r in (1, 2, 3, 9) for d in (1, 2, 3, 5, 7)],
      "descanso": [{"intervalo_min": i} for i in (10, 15, 20, 30, 45, 60, 7, "30", None, "x")],
      "zzz": [{}]}
for e, lista in ej.items():
    for d in lista:
        out["vision"].append({"e": e, "d": d, "r": intentar(vision.plan_para, e, d)})
for d in [{"nivel": n, "racha": r, "acerto": a} for n in (1, 3, 5, 9) for r in (0, 1, 2, 5, "x", -4) for a in (True, False)]:
    out["vision"].append({"e": "periferico", "d": d, "aj": True, "r": intentar(vision.ajustar_para, "periferico", d)})
for d in [{"exposicion_ms": e, "acerto": a, "minimo_ms": m, "sensible": s} for e in (100, 500, 1000, 1500, 2000) for a in (True, False) for m in (300, 500, 900) for s in (True, False)]:
    out["vision"].append({"e": "destello", "d": d, "aj": True, "r": intentar(vision.ajustar_para, "destello", d)})
out["vision"].append({"e": "enfoque", "d": {}, "aj": True, "r": intentar(vision.ajustar_para, "enfoque", {})})
json.dump(out, open(os.path.join(RAIZ, "tests", "fixtures", "lectura_vision.json"), "w"), ensure_ascii=False)
print("ok", len(out["planes"]), len(out["vision"]))
