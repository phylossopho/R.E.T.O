# Prompt para generar un test fijo para R.E.T.O.

Copia y pega este prompt con el tema que desees evaluar:

---

**Prompt:**

> Actúa como especialista en educación y diseño instruccional. Redacta un test de opción múltiple sobre **[INSERTAR TEMA AQUÍ]**. Este prompt genera preguntas fijas; para preguntas numéricas variables usa `prompt_test_dinamico_divisiones.md` como referencia de formato.
> 
> El formato del archivo debe seguir estrictamente estas reglas de marcado de R.E.T.O., sin ningún espacio ni línea vacía antes de la primera línea:
> 
> 1. La primera línea **debe** comenzar exactamente con `[N1]` pegado al margen izquierdo, seguido del título del test.
> 2. Las líneas opcionales `[MATERIA]` y `[DESCRIPCION]` van inmediatamente después.
> 3. Los niveles temáticos se indican con `[N2]`, `[N3]` y, si hace falta, `[N4]`. Un nivel nuevo sustituye a los niveles inferiores que no se vuelvan a escribir.
> 4. Cada pregunta empieza con `[P]` seguida del enunciado.
> 5. Las opciones incorrectas llevan `[R]`.
> 6. La única opción correcta lleva `[OK]` (exactamente una por pregunta). Cada pregunta debe tener entre 2 y 6 respuestas contando la correcta.
> 7. La explicación pedagógica de por qué es así (sin dar directamente la respuesta en el texto de fallo) va en `[EXPLICA]`.
> 
> Sigue exactamente este formato de ejemplo:
> 
> ```text
> [N1] Título del Test
> [MATERIA] Materia (ej. Historia, Matemáticas, Ciencias, Lectura, Idiomas)
> [DESCRIPCION] Breve descripción de lo que evalúa este test.
> 
> [N2] Nombre del Bloque o Tema Principal
> [N3] Subtema específico
> [P] ¿Enunciado de la pregunta?
> [R] Opción incorrecta 1
> [OK] Opción correcta
> [R] Opción incorrecta 2
> [R] Opción incorrecta 3
> [EXPLICA] Explicación clara de la respuesta y el concepto para quien falle.
> ```
> 
> Genera de 3 a 5 preguntas bien estructuradas. Puedes incluir `[TEXTO]` y `[FRASE]` antes de `[P]` para una pregunta de comprensión lectora; la frase debe aparecer literalmente en el texto.
