# R.E.T.O.

**Refuerzo · Estudio · Test · Organización** es una plataforma web local de aprendizaje. Reúne prácticas de lectura, evaluaciones, juegos de atención y memoria, una biblioteca personal y herramientas para organizar ideas.

## Módulos

- **Lectura Veloz:** práctica por palabra, grupos de palabras, frases y modo galáctico. Permite elegir textos de la biblioteca y ajustar ritmo y presentación.
- **Evaluaciones:** banco de tests fijos y dinámicos, importación desde texto marcado, resolución en varios formatos y seguimiento de preguntas por repasar.
- **Mini-juegos:** Mahjong, Memorama, tablas de Schulte, memoria secuencial y Stroop.
- **Biblioteca:** importa, organiza, lee y practica con textos propios.
- **Organizando ideas:** espacio para registrar y relacionar ideas.
- **Configuración:** temas, animaciones, sonidos, paneles y respaldo/restauración de datos.

## Ejecución local en Windows

1. Abre la carpeta `R.E.T.O_gemini`.
2. Ejecuta `servidor.cmd`. El script comprueba Python e instala Flask y `cryptography` si hacen falta.
3. En esta computadora, abre <https://127.0.0.1:8000>.

La primera visita muestra una advertencia del navegador porque el servidor usa un certificado HTTPS autofirmado. Es necesario aceptarlo para habilitar funciones de almacenamiento seguro como IndexedDB.

También se puede iniciar desde PowerShell, en esta carpeta:

```powershell
python -m pip install Flask cryptography
python server.py
```

El servidor escucha en el puerto `8000`. La dirección para otros dispositivos de la misma red se muestra en la consola y se escribe en `direccion-del-sitio.txt`. Ese archivo y los certificados son locales y no se incluyen en el repositorio.

## Datos y alcance de red

El navegador guarda la biblioteca, preferencias y progreso en IndexedDB; la configuración exporta e importa respaldos. Flask sirve los archivos de la aplicación y calcula algunas reglas de lectura, evaluaciones y juegos. Las partidas activas del Memorama viven en memoria del servidor y se pierden al detenerlo.

El servidor escucha en todas las interfaces de red para permitir el acceso desde otros dispositivos de la misma LAN. No tiene autenticación ni está pensado para exponerse directamente a Internet.

## Estructura

- `categorias/`: páginas de los módulos.
- `scripts/`: interfaz y lógica JavaScript del navegador.
- `logica/`: reglas de dominio en Python.
- `styles/`: estilos y fuentes.
- `ejemplos/`: textos que el servidor ofrece para probar la biblioteca.
- `server.py`: servidor local y API.
- `servidor.cmd`: arranque para Windows.

La documentación de Lectura Veloz está en [lectura-veloz.md](lectura-veloz.md). Los prompts de ejemplo para generar contenido están en `ejemplos/`.