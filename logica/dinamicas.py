# -*- coding: utf-8 -*-
"""Motor de preguntas dinámicas: cálculo de variables, evaluación de fórmulas y distractores.

QUÉ HACE
    Toma la definición de una pregunta dinámica (enunciado con llaves, variables
    con rangos y pasos, fórmula de cálculo y distractores) y genera una instancia
    concreta con números al azar, el resultado correcto calculado, distractores
    generados o seleccionados, y la explicación.

LA EXPLICACIÓN
    Son tres líneas que se arman solas con los números de esa pregunta (nadie las
    escribe, así que nunca se desajustan). Es lo mismo que hace
    scripts/reto-tests-eval.js en el navegador:

        formula       la fórmula tal como se escribió, con × y ÷ en vez de * y /
        sustitucion   la misma fórmula con los números ya puestos
        resultado     lo que da

    Los números de la sustitución van sin coma de millares (ver _con_numeros).
"""

import random
import math
import re

def _evaluar_formula(formula_str, variables):
    """Evalúa de forma segura una fórmula matemática simple usando las variables dadas."""
    # Permitir operaciones aritméticas básicas y funciones matemáticas seguras
    entorno_seguro = {
        'abs': abs,
        'round': round,
        'floor': math.floor,
        'ceil': math.ceil,
        'min': min,
        'max': max,
        **variables
    }
    # Reemplazar operadores si es necesario o evaluar directamente con eval seguro
    try:
        # Validar caracteres permitidos para seguridad
        if not re.match(r'^[a-zA-Z0-9_\+\-\*\/\%\(\)\.\,\s]+$', formula_str):
            raise ValueError("Fórmula con caracteres no permitidos")
        resultado = eval(formula_str, {"__builtins__": {}}, entorno_seguro)
        return float(resultado)
    except Exception as e:
        raise ValueError(f"Error evaluando fórmula {formula_str!r}: {e}")

def _formatear_numero(val):
    """Formatea un número con comas para los millares y punto para decimales."""
    if isinstance(val, float) and val.is_integer():
        # 25.0 se escribe 25, igual que en el navegador (scripts/reto-tests-eval.js).
        val = int(val)
    if isinstance(val, int):
        return f"{val:,}"
    elif isinstance(val, float):
        str_val = str(val)
        if '.' in str_val:
            partes = str_val.split('.')
            try:
                entero = int(partes[0])
                dec_parte = partes[1]
                return f"{entero:,}.{dec_parte}"
            except ValueError:
                return f"{val:,}"
        else:
            return f"{int(val):,}"
    return str(val)

def _para_mostrar(formula):
    """La fórmula como se lee en la escuela: × y ÷ en vez de * y /, y ^ para la
    potencia. Solo es para MOSTRAR: lo que se calcula es la fórmula original."""
    t = str(formula).replace("**", "\x01")
    t = re.sub(r"\s*\*\s*", " \u00d7 ", t)
    t = re.sub(r"\s*/\s*", " \u00f7 ", t)
    t = re.sub(r"\s*\x01\s*", " ^ ", t)
    return re.sub(r"\s+", " ", t).strip()


def _con_numeros(formula, valores_vars):
    """La fórmula con cada variable cambiada por su valor. Los números van SIN
    coma de millares (a diferencia del enunciado): dentro de una fórmula con
    funciones, round(4,358.2 ÷ 3, 2), esa coma se confundiría con la que separa
    los argumentos. Un valor negativo va entre paréntesis."""
    def cambia(m):
        nombre = m.group(0)
        if nombre == "resultado" or nombre not in valores_vars:
            return nombre
        valor = valores_vars[nombre]
        texto = str(int(valor)) if isinstance(valor, float) and valor.is_integer() else str(valor)
        return "(" + texto + ")" if valor < 0 else texto
    return re.sub(r"[A-Za-z_][A-Za-z0-9_]*", cambia, str(formula))


def generar_instancia(p_dinamica, semilla=None):
    """Genera una instancia concreta de una pregunta dinámica.

    `p_dinamica`: {
        id, enunciado, variables: [{ nombre, min, max, paso, decimales }],
        formula, decimales, distractores: [{ formula, clase }],
        opcionesAMostrar
    }
    """
    rng = random.Random(semilla)
    vars_def = p_dinamica.get("variables", [])
    valores_vars = {}

    # 1. Generar valores para cada variable respetando min, max y paso
    for v in vars_def:
        nombre = v["name"] if "name" in v else v["nombre"]
        min_v = float(v["min"])
        max_v = float(v["max"])
        paso_v = float(v.get("paso", 1))
        dec = int(v.get("decimales", 0))

        # Calcular pasos posibles
        if paso_v <= 0:
            paso_v = 1.0
        n_pasos = max(0, math.floor((max_v - min_v) / paso_v))
        paso_elegido = rng.randint(0, max(0, n_pasos))
        val = min_v + (paso_elegido * paso_v)
        
        if dec == 0:
            valores_vars[nombre] = int(round(val))
        else:
            valores_vars[nombre] = round(val, dec)

    # 2. Calcular resultado correcto usando la fórmula
    formula_str = p_dinamica.get("formula", "")
    dec_res = int(p_dinamica.get("decimales", 2))
    
    val_resultado = _evaluar_formula(formula_str, valores_vars)
    if dec_res == 0:
        val_resultado = int(round(val_resultado))
    else:
        val_resultado = round(val_resultado, dec_res)

    valores_vars["resultado"] = val_resultado

    # Crear versión formateada de las variables para textos (millares con comas)
    valores_fmt = {k: _formatear_numero(v) for k, v in valores_vars.items()}

    # 3. Armar el enunciado sustituyendo las variables {variable}
    enunciado_tpl = p_dinamica.get("enunciado", "")
    try:
        enunciado_armado = enunciado_tpl.format(**valores_fmt)
    except Exception:
        enunciado_armado = enunciado_tpl

    # 4. Generar opciones (correcta + distractores)
    opciones = []
    # Opción correcta
    opciones.append({
        "texto": _formatear_numero(val_resultado),
        "correcta": True
    })

    # Generar distractores a partir de las fórmulas de distractor
    distractores_def = p_dinamica.get("distractores", [])
    for d in distractores_def:
        d_formula = d.get("formula", "")
        d_clase = d.get("clase", "concepto")
        try:
            d_val = _evaluar_formula(d_formula, valores_vars)
            if dec_res == 0:
                d_val = int(round(d_val))
            else:
                d_val = round(d_val, dec_res)
            
            # Evitar duplicados exactos con la correcta u otros distractores
            texto_op = _formatear_numero(d_val)
            if not any(o["texto"] == texto_op for o in opciones):
                opciones.append({
                    "texto": texto_op,
                    "correcta": False,
                    "clase": d_clase
                })
        except Exception:
            continue

    # Rellenar con distractores de respaldo si faltan opciones
    opciones_a_mostrar = int(p_dinamica.get("opcionesAMostrar", 4))
    while len(opciones) < opciones_a_mostrar:
        # Distractor aleatorio cercano
        delta = rng.choice([-2, -1, 1, 2, 5, 10])
        val_falso = val_resultado + delta if isinstance(val_resultado, (int, float)) else val_resultado
        texto_op = _formatear_numero(val_falso)
        if not any(o["texto"] == texto_op for o in opciones):
            opciones.append({
                "texto": texto_op,
                "correcta": False,
                "clase": "calculo"
            })

    rng.shuffle(opciones)

    # 5. La explicación: la fórmula, la fórmula con los números y el resultado
    valores_sin_resultado = {k: v for k, v in valores_vars.items() if k != "resultado"}
    explicacion = {
        "formula": _para_mostrar(formula_str),
        "sustitucion": _para_mostrar(_con_numeros(formula_str, valores_sin_resultado)),
        "resultado": _formatear_numero(val_resultado)
    }

    return {
        "enunciado": enunciado_armado,
        "opciones": opciones,
        "explicacion": explicacion,
        "valores": valores_vars
    }
