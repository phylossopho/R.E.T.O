# R.E.T.O.

**Refuerzo · Estudio · Test · Organización** es una plataforma web de aprendizaje. Reúne prácticas de lectura, evaluaciones, juegos de atención y memoria, una biblioteca personal y herramientas para organizar ideas.

Es un **sitio estático** (HTML, CSS y JavaScript, sin servidor): se publica tal cual en GitHub Pages y también funciona sin internet una vez visitado.

## Módulos

- **Lectura Veloz:** práctica por palabra, grupos de palabras, frases, pacer, columnas, skimming, prueba de velocidad y modo galáctico. Permite elegir textos de la biblioteca y ajustar ritmo y presentación.
- **Evaluaciones:** banco de tests fijos y dinámicos, importación desde texto marcado, resolución en varios formatos, seguimiento de preguntas por repasar y **Aventura Gráfica (Modo RPG)** con tres interfaces de batalla, editor de layout, 27 power ups que se ganan acertando y se llevan como equipo, y nivel de práctica.
- **Mini-juegos:** Mahjong, Memorama, memoria secuencial y Stroop.
- **Visión:** ejercicios para descansar y entrenar la vista (seguimiento, sacadas, tablas de Schulte, periferia, destello, pausa 20-20-20…). Ver `vision.md`.
- **Multijugador:** duelos de dos jugadores y **Ding!**, un quiz bowl de 2 a 4 jugadores con una persona que presenta. Sin servidor ni cuenta: la sala vive en el dispositivo de quien la crea y los demás se conectan con un código. Ver `multijugador.md` y `rpg.md`.
- **Biblioteca:** importa, organiza, lee y practica con textos propios.
- **Organizando ideas:** espacio para registrar y relacionar ideas.
- **Configuración:** temas, animaciones, sonidos, paneles y respaldo/restauración de datos.

## Cómo está hecho

- `categorias/`: páginas de los módulos. `styles/`: estilos y fuentes (autoalojadas).
- `scripts/`: la interfaz de cada pantalla (`reto-*.js`).
- `scripts/logica/`: **las reglas** (planes de lectura, ejercicios de visión, daños y power ups, rondas de repaso, salas…). Se escribieron primero en Python y se portaron a JavaScript; las pruebas comprueban que dan exactamente lo mismo que el original.
- `scripts/reto-api.js`: responde en el navegador las llamadas `/api/...` que antes atendía un servidor, y hace que el sitio funcione dentro de una subcarpeta (`usuario.github.io/REPO/`).
- `datos/`: power ups y los índices de carpetas (los escribe `tools/generar-indices.js`).
- `tests/` y `tools/`: pruebas y herramientas; no se publican.

## Probar en tu computadora

Hace falta [Node.js](https://nodejs.org) (versión 18 o más).

```bash
node tools/servir.js        # abre http://localhost:8000
npm test                    # corre todas las pruebas
npm run indices             # vuelve a escribir los índices (tras agregar ejemplos, fondos o sprites)
```

## Publicar en GitHub Pages

En Windows, **doble clic en `subir-a-github.cmd`**: actualiza los índices, corre las pruebas, te pide una descripción de los cambios y sube todo a GitHub.

1. Sube el proyecto a un repositorio de GitHub.
2. En **Settings → Pages**, elige **Source: GitHub Actions**.
3. Cada vez que subas a `main`, `.github/workflows/deploy-pages.yml` corre las pruebas, genera los índices y publica el sitio. Si alguna prueba falla, no se publica.

La dirección queda en `https://USUARIO.github.io/REPO/`. Cada dirección guarda sus propios datos (biblioteca, progreso, power ups): para moverlos, usa el respaldo de Configuración › Datos.

## Aplicación instalable (PWA)

Con HTTPS (GitHub Pages) o `localhost`, R.E.T.O. ofrece manifest e iconos de instalación. El service worker guarda el sitio y las reglas, así que **todo funciona sin conexión** después de la primera visita. El almacenamiento personal vive en el navegador y no se sincroniza entre dispositivos.

## Multijugador entre dispositivos

Quien crea la sala es el **anfitrión**: su navegador guarda la partida. Los demás se unen con el código de 4 letras; si están en otro dispositivo, antes se conectan con el botón **«Invitar a otro dispositivo»** (se intercambian dos códigos de texto, sin servidor). Funciona en la misma red wifi sin internet. El anfitrión debe mantener abierta su página mientras dure la partida. Detalles en `multijugador.md`.

## Datos y alcance

El navegador guarda la biblioteca, preferencias y progreso en IndexedDB; la configuración exporta e importa respaldos. No hay cuentas ni base de datos central.
