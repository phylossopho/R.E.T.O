# Lectura Veloz

Este documento describe los motores que están conectados en la plataforma actual. Las reglas de preparación del texto viven en `logica/lectura_veloz.py`; el navegador se encarga de pintarlo, animarlo y controlar la lectura. La API expone esos planes mediante `POST /api/lectura/plan`.

## Motores disponibles

La pantalla de práctica admite cuatro valores para `motor`:

| Motor | Qué presenta |
|---|---|
| `galactico` | Párrafos que avanzan en perspectiva, con cuenta regresiva. |
| `palabra` | Una palabra a la vez, con punto de fijación y pausa según puntuación. |
| `grupo` | Grupos de 3 o 4 palabras. |
| `frases` | Oraciones completas; las muy largas se dividen en fragmentos legibles. |

Los motores `bionic`, `columna`, `pacer`, `sinregresion` y `skim` no están registrados en el servidor actual y no deben presentarse como funciones disponibles.

## Velocidad

### 2.1 Velocidad

```js
WPM_RANGE = { min: 50, max: 999, step: 10 }
```

La velocidad predeterminada es 300 palabras por minuto. El intervalo y el paso deben coincidir con `scripts/reto-lectura.js` y con el control de velocidad de `categorias/lectura-veloz/practica/practica.html`.

### 2.2 Pausas por puntuación

La pausa se mide a 300 palabras por minuto. El navegador conserva las proporciones cuando cambia la velocidad.

| Final de palabra | Pausa |
|---|---:|
| Punto, admiración o interrogación | **600 ms** |
| Coma, punto y coma o dos puntos | **350 ms** |
| Guion o viñeta | **300 ms** |
| Sin signo | **200 ms** |

Una viñeta o un número de lista no cierra una oración. Las comillas y paréntesis de cierre tampoco cambian el signo que determina la pausa.

## Tamaño de grupo y frases

### 2.3 Tamaño de grupo

El motor `grupo` admite 3 o 4 palabras (`tamano_grupo`). Si el valor enviado no es uno de esos dos, Python usa 3.

### 2.4 Fragmentos del modo frases

Una frase de hasta 25 palabras se presenta completa. Las oraciones más largas se dividen en partes de entre 4 y 25 palabras, con preferencia por cortes en puntuación cuando es posible.

## Contrato de la API

La petición contiene el motor y una lista de párrafos. El modo grupo también puede recibir `tamano_grupo`:

```json
{
	"motor": "palabra",
	"parrafos": ["Primer párrafo.", "Segundo párrafo."]
}
```

El servidor responde con el plan específico del motor. Los textos vacíos se descartan; un texto sin palabras o que excede los límites devuelve un error de validación. Los topes son 300 000 palabras y 20 000 párrafos.

Los valores de velocidad y pausas se contrastan con las pruebas de `test_lectura_veloz.py` para evitar discrepancias entre Python, JavaScript y esta especificación.

## Módulos agregados: prueba de velocidad, pacer, columnas y skimming

Misma regla que los cuatro motores: **Python decide qué se muestra y cuánto pesa; el navegador pinta, cronometra y maneja el teclado.** Todos se abren con `practica.html?motor=<nombre>&id=<texto>` y se piden con `POST /api/lectura/plan`.

| `motor` | Plan (Python) | Motor (JS) | Notas |
| --- | --- | --- | --- |
| `prueba` | `plan_prueba` | `scripts/reto-lectura-prueba.js` | 100 a 600 palabras; cálculo en `POST /api/lectura/velocidad` (`calcular_velocidad`) |
| `pacer` | `plan_pacer(parrafos, palabras_por_tramo)` | `scripts/reto-lectura-pacer.js` | tramos de 1, 2 o 3 palabras; "una línea" la arma el navegador midiendo |
| `columnas` | `plan_pacer` (el mismo) | el mismo motor del pacer | arranca con 2 palabras por renglón; preferencias propias |
| `skimming` | `plan_skimming` | `scripts/reto-lectura-skim.js` | pasadas: títulos, primeras frases, palabras clave, cierre |

**Cómo se enchufan.** `scripts/reto-lectura-registro.js` crea `window.RetoLecturaMotores`; cada archivo se anota con `registrar(nombres, fabrica, ajustes)` y `reto-lectura.js` lo monta desde `cargarMotor`, entregándole un contexto mínimo (`estado`, `marco`, `guardar`, `recuperar`, `pedirPlan`, `ponerVelocidad`, `detener`). El contrato es el de siempre: `reanudar`, `pausar`, `reiniciar`, `medir`, `limpiar`. Si el modo tiene modal de ajustes, `reto-lectura-ajustes.js` le pasa el turno. Los scripts nuevos van **antes** de `reto-lectura.js` en `practica.html`.

**Prueba de velocidad.** `ppm_brutas = palabras / minutos`, `comprension = aciertos / preguntas`, `ppm_efectivas = brutas × comprensión`. Más de 1500 ppm brutas se marca `saltada` y no entra al historial; sin preguntas no hay velocidad efectiva y tampoco entra. Las preguntas salen de un test del banco (solo las fijas, hasta 4 al azar), que se elige y se recuerda por texto. Sin límite de tiempo; el reloj está oculto por defecto; el tiempo con la pestaña escondida no cuenta. El resultado se compara solo con la propia persona (la medición anterior) y trae gráfica con tabla de datos.

**Pacer.** `plan_pacer` devuelve `palabras` y `pausa` en listas paralelas, `parrafo_inicio` y `tramos` (`desde`/`hasta` incluidos, `pausa`, `peso`). Un tramo nunca cruza un párrafo ni un fin de oración. Duración de un tramo: `(60 000 / ppm) × (pausa / pausa_base_ms)`. El texto se pinta una sola vez; la guía cambia una clase. Ajustes: palabras por tramo, tipo de guía (fondo, subrayado, regla), opacidad del resto, "a mi ritmo" (espacio, flecha derecha o toque, solo con el foco en el texto), desplazamiento automático (salta por páginas con movimiento reducido), cuenta regresiva opcional, ancho de columna y dos columnas en pantallas de 900 px o más. Tope: 12 000 palabras por sesión.

**Skimming.** Cada pasada avanza sola (15 a 30 s, configurable) o con "Siguiente pasada", que siempre está. Las palabras clave son las de 7 o más letras que se repiten (sin IA). La pasada 4 es el enlace al pacer; antes hay una pregunta "¿de qué trata?" cuya respuesta no se guarda.

**Progreso.** `scripts/reto-progreso.js` (`window.RetoProgreso`): `registrarSesion({ tipo, motor, minutos, palabras })` y `mediciones.guardar/listar`. Se guarda en `RetoDatos` (claves `lectura-sesiones` y `lectura-mediciones`), así que entra en el respaldo de Configuración. La sesión mínima es de 1 minuto. `reto-lectura.js` suma el tiempo de lectura de todos los motores (palabras estimadas con la velocidad); la prueba y el skimming se registran solos.

