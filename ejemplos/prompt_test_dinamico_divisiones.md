# Generar un test dinámico de divisiones para R.E.T.O.

Este prompt pide el formato de texto que acepta el importador de R.E.T.O. Guárdalo como `.txt` e impórtalo desde **Gestionar banco de tests**.

> Actúa como especialista en educación matemática. Crea un test para sexto de primaria sobre divisiones de números de cuatro cifras con decimales entre divisores de dos cifras con decimales.
>
> Devuelve únicamente texto en el formato marcado de R.E.T.O., sin saludos ni bloques JSON. Sigue estas reglas:
>
> - La primera línea es `[N1]` con el título del test. Añade `[MATERIA] Matemáticas` y los temas con `[N2]` y `[N3]`.
> - Cada pregunta dinámica lleva una línea `[DINAMICA]` con el enunciado. Escribe cada variable mencionada entre llaves, por ejemplo `{dividendo}`.
> - Cada variable lleva una línea `[VAR] nombre: mínimo, máximo, paso, decimales`.
> - Incluye una fórmula válida con `[FORMULA]` y al menos tres distractores con `[DISTRACTOR] fórmula | calculo` o `| concepto`.
> - Añade `[EXPLICA]` con una orientación breve que ayude a razonar, sin revelar directamente el resultado.
> - Usa nombres de variables sin espacios ni acentos. Solo usa `round`, `floor`, `ceil`, `abs`, `min`, `max`, operadores aritméticos y paréntesis.
> - Asegúrate de que los rangos y pasos sean coherentes, no permitan dividir entre cero y no produzcan distractores iguales a la respuesta correcta.
>
> Usa esta estructura como punto de partida y verifica que cada pregunta dinámica tenga sus propias variables, fórmula y distractores:
>
> ```text
> [N1] Divisiones con decimales
> [MATERIA] Matemáticas
> [N2] Matemáticas de sexto
> [N3] División con decimales
> [DINAMICA] Resuelve la división de {dividendo} entre {divisor}. Redondea a dos decimales.
> [VAR] dividendo: 1000, 9999.5, 0.5, 2
> [VAR] divisor: 10, 99.5, 0.5, 1
> [FORMULA] round(dividendo / divisor, 2)
> [DISTRACTOR] round(dividendo / divisor * 10, 2) | calculo
> [DISTRACTOR] round(dividendo / divisor / 10, 2) | concepto
> [DISTRACTOR] round(dividendo / divisor + 1.25, 2) | calculo
> [EXPLICA] Para dividir decimales, desplaza la coma en ambos números la misma cantidad de lugares y comprueba la operación.
> ```
