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