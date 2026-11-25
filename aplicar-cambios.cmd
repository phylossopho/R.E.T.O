@echo off
setlocal
chcp 65001 >nul
title R.E.T.O. - Aplicar cambios y subirlos a GitHub

rem ============================================================
rem  Toma los archivos modificados que te entregaron (esta misma
rem  carpeta, junto con cambios.txt), los copia a su lugar dentro
rem  de TU repositorio y sube a GitHub SOLO esos archivos.
rem  Funciona igual si descargaste los archivos sueltos en una
rem  carpeta, o si respetaste su arbol de directorios.
rem  Uso: doble clic.  (Opcional: aplicar-cambios.cmd "C:\ruta\RETOapp")
rem ============================================================

set "CARPETA=%~dp0"
if "%CARPETA:~-1%"=="\" set "CARPETA=%CARPETA:~0,-1%"
set "MANIFIESTO=%CARPETA%\cambios.txt"
set "MEMORIA=%LOCALAPPDATA%\reto-ruta-repo.txt"

echo.
echo  ===========================================
echo    R.E.T.O. - Aplicar cambios y subirlos
echo  ===========================================
echo.

where git >nul 2>nul
if errorlevel 1 goto :sin_git
if not exist "%MANIFIESTO%" goto :sin_manifiesto

rem ---------- 1. cual es tu repositorio ----------
set "REPO=%~1"
if defined REPO goto :verificar
set "ULTIMA="
if exist "%MEMORIA%" set /p ULTIMA=<"%MEMORIA%"
:pedir
if not defined ULTIMA goto :pedir_nuevo
echo  Ultima carpeta usada: %ULTIMA%
set /p "REPO= Ruta de tu repositorio (Enter = usar esa): "
if not defined REPO set "REPO=%ULTIMA%"
goto :verificar
:pedir_nuevo
echo  Pega aqui la ruta de la carpeta de tu repositorio, por ejemplo la carpeta RETOapp.
echo  Truco: arrastra la carpeta hasta esta ventana y pulsa Enter.
set /p "REPO= Ruta: "
if not defined REPO goto :pedir_nuevo

:verificar
set "REPO=%REPO:"=%"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"
if not exist "%REPO%\.git" goto :no_repo
set "TIPO=sitio"
if exist "%REPO%\plantilla-RETOapp" set "TIPO=proyecto"
echo.
echo  Cambios desde : %CARPETA%
echo  Repositorio   : %REPO%
if "%TIPO%"=="proyecto" (echo  Tipo          : proyecto completo) else (echo  Tipo          : sitio ^(solo los archivos del sitio^))
echo.

rem ---------- 2. copiar cada archivo a su lugar ----------
echo [1/3] Copiando los archivos ...
set "COPIADOS=0"
set "FALTAN=0"
set "LISTA="
for /f "usebackq eol=# tokens=1-3 delims=|" %%a in ("%MANIFIESTO%") do call :aplicar "%%a" "%%b" "%%c"
if "%COPIADOS%"=="0" goto :nada_copiado
echo       %COPIADOS% archivo^(s^) copiado^(s^).
if not "%FALTAN%"=="0" echo       [!] %FALTAN% no estaban en esta carpeta y se saltaron.

rem ---------- 3. ver que cambio de verdad ----------
cd /d "%REPO%"
echo.
echo [2/3] Revisando que cambio en tu repositorio ...
set "HAY="
if not defined LISTA goto :sin_lista
for /f "delims=" %%x in ('git status --porcelain -- %LISTA%') do set "HAY=1"
:sin_lista
if not defined HAY goto :todo_igual
echo.
git status --short -- %LISTA%
echo.
set "MSG="
set /p "MSG= Describe los cambios (Enter = fecha y hora): "
if not defined MSG set "MSG=Actualizacion %date% %time:~0,5%"
set "MSG=%MSG:"='%"
git add -- %LISTA%
git commit -q -m "%MSG%" -- %LISTA%
if errorlevel 1 goto :error_commit

rem ---------- 4. subir ----------
:subir
echo.
echo [3/3] Subiendo a GitHub ...
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "RAMA=%%b"
set "REMOTA="
for /f "delims=" %%r in ('git ls-remote --heads origin %RAMA%') do set "REMOTA=1"
if not defined REMOTA goto :empujar
git pull --rebase --autostash origin %RAMA%
if errorlevel 1 goto :error_pull
:empujar
git push -u origin %RAMA%
if errorlevel 1 goto :error_push
>"%MEMORIA%" echo %REPO%
goto :listo

:todo_igual
echo       Tu repositorio ya tiene estos archivos exactamente iguales: no hay nada que subir.
>"%MEMORIA%" echo %REPO%
goto :fin_bien

:listo
echo.
echo  ===========================================
echo    LISTO. Los cambios ya estan en GitHub.
echo  ===========================================
for /f "delims=" %%u in ('git remote get-url origin') do echo  Repositorio: %%u
echo  Avance: abre la pestana "Actions" del repositorio ^(el sitio tarda 1 o 2 minutos^).
goto :fin_bien

rem ---------- copiar un archivo (se llama una vez por linea de cambios.txt) ----------
:aplicar
set "NOMBRE=%~1"
set "DESTINO=%~2"
set "ALCANCE=%~3"
if /i "%ALCANCE%"=="proyecto" if /i not "%TIPO%"=="proyecto" exit /b 0
set "FUENTE="
if exist "%CARPETA%\%NOMBRE%" set "FUENTE=%CARPETA%\%NOMBRE%"
if not defined FUENTE if exist "%CARPETA%\%DESTINO%" set "FUENTE=%CARPETA%\%DESTINO%"
if not defined FUENTE goto :falta
for %%d in ("%REPO%\%DESTINO%") do if not exist "%%~dpd" mkdir "%%~dpd"
copy /y "%FUENTE%" "%REPO%\%DESTINO%" >nul
if errorlevel 1 goto :falla_copia
set /a COPIADOS+=1
git -C "%REPO%" check-ignore -q -- "%DESTINO%"
if not errorlevel 1 goto :ignorado
set "LISTA=%LISTA% "%DESTINO%""
exit /b 0
:ignorado
echo       ^(%DESTINO% se copia, pero tu .gitignore lo excluye: no se sube^)
exit /b 0
:falta
echo       [!] No encuentro %NOMBRE% junto a este archivo: lo salto.
set /a FALTAN+=1
exit /b 0
:falla_copia
echo       [!] No pude copiar %NOMBRE% a %REPO%\%DESTINO%
set /a FALTAN+=1
exit /b 0

rem ---------- errores ----------
:error_commit
echo.
echo [!] No se pudo crear el commit. Lee el mensaje de arriba.
goto :fin_mal
:error_pull
echo.
echo [!] Git no pudo juntar los cambios que hay en GitHub con los tuyos ^(conflicto^).
echo     No borres nada. Abre una terminal en %REPO%, ejecuta "git status"
echo     y pasale a Claude el texto que salio arriba.
goto :fin_mal
:error_push
echo.
echo [!] La subida fallo.
if /i not "%RAMA%"=="main" goto :error_push_manual
if not exist "%CARPETA%\reintentar-subida-RETOapp.cmd" if not exist "%REPO%\..\reintentar-subida-RETOapp.cmd" goto :error_push_manual
echo     Reviso la causa y te ayudo a resolverla ...
if exist "%CARPETA%\reintentar-subida-RETOapp.cmd" (call "%CARPETA%\reintentar-subida-RETOapp.cmd" "%REPO%" nopausa) else (call "%REPO%\..\reintentar-subida-RETOapp.cmd" "%REPO%" nopausa)
goto :fin_mal
:error_push_manual
echo     Copia el texto de arriba y pasaselo a Claude. Para reintentar solo la subida,
echo     abre una terminal en %REPO% y ejecuta:  git push -u origin %RAMA%
goto :fin_mal
:nada_copiado
echo.
echo [!] No copie nada: no encuentro los archivos de cambios.txt junto a este archivo.
goto :fin_mal
:no_repo
echo [!] Esa carpeta no es un repositorio de Git ^(no tiene .git^):
echo     %REPO%
goto :fin_mal
:sin_git
echo [!] No encuentro Git. Instalalo desde https://git-scm.com y vuelve a intentarlo.
goto :fin_mal
:sin_manifiesto
echo [!] No encuentro cambios.txt junto a este archivo. Descargalo con los demas.
goto :fin_mal

:fin_bien
echo.
pause
exit /b 0
:fin_mal
echo.
pause
exit /b 1
