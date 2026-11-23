@echo off
setlocal
chcp 65001 >nul
title R.E.T.O. - Crear el repositorio RETOapp

rem ============================================================
rem  Crea una carpeta NUEVA y limpia (RETOapp, al lado de esta)
rem  con SOLO lo que la plataforma necesita para funcionar en
rem  linea, la convierte en un repositorio de Git y la sube a
rem  GitHub. No toca esta carpeta ni su repositorio.
rem ============================================================

set "ORIGEN=%~dp0"
if "%ORIGEN:~-1%"=="\" set "ORIGEN=%ORIGEN:~0,-1%"
for %%i in ("%ORIGEN%\..\RETOapp") do set "DEST=%%~fi"
set "NOMBRE=RETOapp"

echo.
echo  ===========================================
echo    R.E.T.O. - Crear el repositorio %NOMBRE%
echo  ===========================================
echo.
echo  Origen : %ORIGEN%
echo  Destino: %DEST%
echo.

where git >nul 2>nul
if errorlevel 1 goto :sin_git
if not exist "%ORIGEN%\plantilla-RETOapp\deploy-pages.yml" goto :sin_plantilla

if not exist "%DEST%" goto :copiar
echo [!] La carpeta destino ya existe:
echo     %DEST%
choice /c SN /n /m " Borrarla y empezar de nuevo? [S/N] "
if errorlevel 2 goto :fin
rmdir /s /q "%DEST%"
if exist "%DEST%" goto :error_borrar

:copiar
echo [1/4] Copiando solo lo necesario ...
mkdir "%DEST%"
for %%d in (categorias datos ejemplos imagenes pwa sonidos styles) do (
  robocopy "%ORIGEN%\%%d" "%DEST%\%%d" /E /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 goto :error_copia
)
rem la logica y las pantallas (menos un archivo que ninguna pagina usa)
robocopy "%ORIGEN%\scripts" "%DEST%\scripts" /E /XF reto-tests-dinamico.js /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :error_copia
rem paginas de la raiz que si se usan
for %%f in (index.html offline.html configuracion_general.html configuracion-animaciones.html configuracion-datos.html configuracion-interfaz.html configuracion-paneles.html configuracion-sonido.html configuracion-tarjeta.html configuracion-tema.html sw.js manifest.webmanifest) do (
  copy /y "%ORIGEN%\%%f" "%DEST%\" >nul
  if errorlevel 1 goto :error_copia
)
rem herramientas minimas: indices de archivos, servidor local y la revision del sitio
mkdir "%DEST%\tools"
mkdir "%DEST%\tests"
copy /y "%ORIGEN%\tools\generar-indices.js" "%DEST%\tools\" >nul
copy /y "%ORIGEN%\tools\servir.js" "%DEST%\tools\" >nul
copy /y "%ORIGEN%\tests\sitio.test.js" "%DEST%\tests\" >nul
rem publicacion y documentos del repositorio
mkdir "%DEST%\.github\workflows"
copy /y "%ORIGEN%\plantilla-RETOapp\deploy-pages.yml" "%DEST%\.github\workflows\deploy-pages.yml" >nul
copy /y "%ORIGEN%\plantilla-RETOapp\gitignore.txt" "%DEST%\.gitignore" >nul
copy /y "%ORIGEN%\plantilla-RETOapp\README.md" "%DEST%\README.md" >nul
copy /y "%ORIGEN%\plantilla-RETOapp\package.json" "%DEST%\package.json" >nul
echo       Listo.

echo.
echo [2/4] Revisando que el sitio quedo completo ...
where node >nul 2>nul
if errorlevel 1 goto :sin_node
pushd "%DEST%"
node tools\generar-indices.js
node tests\sitio.test.js
if errorlevel 1 goto :error_revision
popd
goto :git
:sin_node
echo       (No encontre Node.js: me salto la revision. GitHub la hara al publicar.)

:git
echo.
echo [3/4] Creando el repositorio de Git ...
cd /d "%DEST%"
git init >nul
git symbolic-ref HEAD refs/heads/main
set "GNOMBRE="
for /f "delims=" %%a in ('git config user.name') do set "GNOMBRE=%%a"
if not defined GNOMBRE goto :pedir_nombre
:commit
git add -A
git commit -q -m "Primera version de %NOMBRE%"
if errorlevel 1 goto :error_commit
echo       Listo.
goto :github

:pedir_nombre
set /p "GNOMBRE= Tu nombre para firmar los commits: "
if not defined GNOMBRE goto :pedir_nombre
set "GCORREO="
set /p "GCORREO= Tu correo: "
git config user.name "%GNOMBRE%"
git config user.email "%GCORREO%"
goto :commit

:github
echo.
echo [4/4] Subiendo a GitHub ...
set "USUARIO="
where gh >nul 2>nul
if errorlevel 1 goto :manual
gh auth status >nul 2>nul
if errorlevel 1 goto :manual

rem --- Camino automatico: GitHub CLI ya instalado y con sesion ---
for /f "delims=" %%u in ('gh api user -q .login') do set "USUARIO=%%u"
echo       Creando %USUARIO%/%NOMBRE% (publico: GitHub Pages gratis lo necesita) ...
gh repo create %NOMBRE% --public --source=. --remote=origin --description "R.E.T.O. - plataforma de aprendizaje (sitio estatico)"
if errorlevel 1 goto :error_gh
gh api -X POST repos/%USUARIO%/%NOMBRE%/pages -f build_type=workflow >nul 2>nul
git push -u origin main
if errorlevel 1 goto :error_push
goto :listo

:manual
rem --- Camino manual: tu creas el repositorio vacio en la pagina de GitHub ---
echo.
echo  No encontre GitHub CLI con sesion iniciada, asi que hay que hacer 2 cosas en la pagina:
echo.
echo   1) Entra a  https://github.com/new
echo      - Nombre: %NOMBRE%
echo      - Publico  ^(GitHub Pages gratis lo necesita^)
echo      - SIN README, SIN .gitignore, SIN licencia  ^(que quede vacio^)
echo      - Pulsa "Create repository"
echo.
echo   2) En ese repositorio: Settings ^> Pages ^> Source: GitHub Actions
echo.
set /p "USUARIO= Tu usuario de GitHub (Enter = phylossopho): "
if not defined USUARIO set "USUARIO=phylossopho"
echo.
pause
git remote add origin https://github.com/%USUARIO%/%NOMBRE%.git
git push -u origin main
if errorlevel 1 goto :error_push

:listo
echo.
echo  ===========================================
echo    LISTO. %NOMBRE% ya esta en GitHub.
echo  ===========================================
echo.
echo  Repositorio : https://github.com/%USUARIO%/%NOMBRE%
echo  Avance      : https://github.com/%USUARIO%/%NOMBRE%/actions
echo  Sitio       : https://%USUARIO%.github.io/%NOMBRE%/   ^(tarda 1 o 2 minutos^)
echo  Version     : https://%USUARIO%.github.io/%NOMBRE%/version.txt
echo.
echo  Si en Actions sale un error de "Pages", entra a Settings ^> Pages y elige
echo  Source: GitHub Actions; luego, en Actions, pulsa "Re-run all jobs".
echo.
echo  Para subir cambios despues: abre la carpeta %DEST%
echo  con GitHub Desktop ^(File ^> Add local repository^).
goto :fin

:sin_git
echo [!] No encuentro Git. Instalalo desde https://git-scm.com y vuelve a intentarlo.
goto :fin
:sin_plantilla
echo [!] No encuentro la carpeta plantilla-RETOapp junto a este archivo.
goto :fin
:error_borrar
echo [!] No pude borrar la carpeta destino. Cierra lo que la tenga abierta e intentalo otra vez.
goto :fin
:error_copia
echo [!] Fallo al copiar los archivos. Revisa que esta carpeta este completa.
goto :fin
:error_revision
echo.
echo [!] La revision del sitio encontro problemas ^(arriba dice cuales^). No se subio nada.
popd
goto :fin
:error_commit
echo [!] No se pudo crear el commit. Lee el mensaje de arriba.
goto :fin
:error_gh
echo.
echo [!] GitHub CLI no pudo crear el repositorio ^(quiza ya existe uno llamado %NOMBRE%^).
echo     Borralo en GitHub o usa otro nombre, y vuelve a ejecutar este archivo.
goto :fin
:error_push
echo.
echo [!] No se pudo subir. Causas comunes:
echo     - Se pidio iniciar sesion en GitHub y se cancelo: vuelve a intentarlo.
echo     - El repositorio %NOMBRE% no existe todavia o no esta vacio.
echo     - No hay internet.
echo     Para reintentar solo la subida, abre una terminal en %DEST% y ejecuta: git push -u origin main

:fin
echo.
pause
