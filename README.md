# R.E.T.O.

**Refuerzo · Estudio · Test · Organización** es una plataforma web local de aprendizaje. Reúne prácticas de lectura, evaluaciones, juegos de atención y memoria, una biblioteca personal y herramientas para organizar ideas.

## Módulos

- **Lectura Veloz:** práctica por palabra, grupos de palabras, frases y modo galáctico. Permite elegir textos de la biblioteca y ajustar ritmo y presentación.
- **Evaluaciones:** banco de tests fijos y dinámicos, importación desde texto marcado, resolución en varios formatos, seguimiento de preguntas por repasar y **Aventura Gráfica (Modo RPG)** con selección de avatares en formato WebP, inventario estratégico de Power-Ups y HUD compacto de combate.
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
python -m pip install -r requirements.txt
python server.py
```

El servidor escucha en el puerto `8000`. La dirección para otros dispositivos de la misma red se muestra en la consola y se escribe en `direccion-del-sitio.txt`. Ese archivo y los certificados son locales y no se incluyen en el repositorio.

## Aplicación instalable (PWA)

Con HTTPS, R.E.T.O. ofrece manifest e iconos de instalación. El service worker precarga la portada y recursos básicos, y guarda páginas y recursos estáticos que se visitan. Las rutas `/api/` no se almacenan: los juegos y funciones que requieren Flask necesitan conexión; si no la hay, se muestra una página de desconexión. El almacenamiento personal continúa en el navegador y no se sincroniza entre dispositivos.

En PythonAnywhere el sitio se sirve bajo HTTPS, condición necesaria para registrar el service worker. La PWA está preparada para publicarse desde la raíz del dominio.

## Publicar en PythonAnywhere

1. Sube o clona el repositorio privado en tu directorio de usuario.
2. En una consola Bash, crea un entorno virtual con la misma versión de Python que usarás en la pestaña **Web**, e instala dependencias:

	```bash
	mkvirtualenv --python=/usr/bin/python3.13 reto-env
	pip install -r ~/R.E.T.O/requirements.txt
	```

	Ajusta la ruta `~/R.E.T.O` si elegiste otro directorio.
3. En **Web**, crea una aplicación con configuración manual, elige esa versión de Python y asigna `reto-env` en el campo **Virtualenv**.
4. En el archivo WSGI de la pestaña **Web**, apunta al directorio del proyecto e importa el callable:

	```python
	import sys

	project_home = "/home/USUARIO/R.E.T.O"
	if project_home not in sys.path:
		 sys.path.insert(0, project_home)

	from wsgi import application
	```

	Sustituye `USUARIO` por tu nombre de cuenta y ajusta la ruta si es necesario; luego pulsa **Reload** en la pestaña **Web**.

PythonAnywhere termina HTTPS delante de la aplicación. No ejecutes `python server.py` allí: ese arranque es solo para uso local y crea un certificado autofirmado. El entrypoint WSGI importa Flask sin iniciar un servidor de desarrollo.

Antes de invitar usuarios, ten en cuenta que el progreso y las preferencias se guardan en el navegador. Las partidas activas de Memorama viven en memoria del proceso y pueden perderse si la aplicación se reinicia; los datos no son una cuenta en la nube ni una copia central.

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
- `wsgi.py`: callable de entrada para alojamientos WSGI.
- `manifest.webmanifest`, `sw.js` y `pwa/`: instalación y recursos de la PWA.

La documentación de Lectura Veloz está en [lectura-veloz.md](lectura-veloz.md). Los prompts de ejemplo para generar contenido están en `ejemplos/`.