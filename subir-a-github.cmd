@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title R.E.T.O. - Subir cambios a GitHub

echo.
echo  ===========================================
echo    R.E.T.O. - Subir cambios a GitHub
echo  ===========================================
echo.

where git >nul 2>nul
if errorlevel 1 goto :sin_git

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 goto :sin_repo

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set RAMA=%%b

git remote get-url origin >nul 2>nul
if errorlevel 1 goto :sin_remoto

:preparar
where node >nul 2>nul
if errorlevel 1 goto :commit

echo [1/3] Actualizando los indices de archivos (ejemplos, fondos, sprites) ...
node tools\generar-indices.js
echo.
echo [2/3] Corriendo las pruebas ...
node tests\run-all.js
if errorlevel 1 goto :pruebas_fallaron
echo.
goto :commit

:pruebas_fallaron
echo.
echo [!] Alguna prueba fallo. Si subes asi, GitHub NO publicara el sitio
echo     (el despliegue corre las mismas pruebas y se detiene).
choice /c SN /n /m " Subir de todos modos? [S/N] "
if errorlevel 2 goto :fin
echo.

:commit
echo [3/3] Revisando los cambios ...
echo.
set "HAY="
for /f "delims=" %%x in ('git status --porcelain') do set HAY=1
if not defined HAY goto :nada_nuevo

git status --short
echo.
set "MSG="
set /p "MSG= Describe los cambios (Enter para usar la fecha y la hora): "
if not defined MSG set "MSG=Actualizacion %date% %time:~0,5%"
set "MSG=%MSG:"='%"

git add -A
git commit -m "%MSG%"
if errorlevel 1 goto :error_commit
goto :empujar

:nada_nuevo
echo No hay archivos nuevos ni modificados. Se intentara subir lo que falte.

:empujar
echo.
echo Trayendo lo que haya nuevo en GitHub ...
git pull --rebase --autostash origin %RAMA%
if errorlevel 1 goto :error_pull

echo.
echo Subiendo a GitHub (rama %RAMA%) ...
git push -u origin %RAMA%
if errorlevel 1 goto :error_push

echo.
echo  ===========================================
echo    LISTO. Los cambios ya estan en GitHub.
echo  ===========================================
echo.
echo GitHub Pages publica el sitio en 1 o 2 minutos.
echo Para ver el avance, abre la pestana "Actions" del repositorio.
for /f "delims=" %%u in ('git remote get-url origin') do echo Repositorio: %%u
goto :fin

:error_commit
echo.
echo [!] No se pudo crear el commit. Lee el mensaje de arriba.
goto :fin

:error_pull
echo.
echo [!] Git no pudo juntar los cambios que hay en GitHub con los tuyos.
echo     No borres nada. Abre una terminal en esta carpeta, ejecuta "git status"
echo     y pidele ayuda a Claude con el texto que salio arriba.
goto :fin

:error_push
echo.
echo [!] No se pudo subir. Causas comunes:
echo     - Se pidio iniciar sesion en GitHub y se cancelo: vuelve a intentarlo.
echo     - No hay internet.
echo     - Algun archivo pesa mas de 100 MB (GitHub no lo acepta).
goto :fin

:sin_git
echo [!] No encuentro Git. Instalalo desde https://git-scm.com y vuelve a intentarlo.
goto :fin

:sin_repo
echo [!] Esta carpeta no es un repositorio de Git.
goto :fin

:sin_remoto
echo [!] Este repositorio todavia no tiene un destino en GitHub.
set "URL="
set /p "URL= Pega la direccion del repositorio (https://github.com/USUARIO/REPO.git): "
if not defined URL goto :fin
git remote add origin %URL%
goto :preparar

:fin
echo.
pause
