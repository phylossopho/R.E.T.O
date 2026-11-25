@echo off
setlocal
chcp 65001 >nul
title R.E.T.O. - Reintentar la subida de RETOapp

rem ============================================================
rem  Reintenta SOLO la subida a GitHub de la carpeta RETOapp,
rem  lee el error de Git, dice cual es la causa y ofrece la
rem  solucion. Uso: doble clic (busca RETOapp junto a esta carpeta,
rem  o usa esta carpeta si este archivo esta dentro de RETOapp).
rem ============================================================

set "SCRIPTDIR=%~dp0"
if "%SCRIPTDIR:~-1%"=="\" set "SCRIPTDIR=%SCRIPTDIR:~0,-1%"
if not "%~1"=="" (
  set "DEST=%~1"
) else if exist "%SCRIPTDIR%\.git" (
  set "DEST=%SCRIPTDIR%"
) else (
  for %%i in ("%SCRIPTDIR%\..\RETOapp") do set "DEST=%%~fi"
)
set "SALIDA=%TEMP%\retoapp-git.txt"

echo.
echo  ===========================================
echo    R.E.T.O. - Reintentar la subida
echo  ===========================================
echo.
echo  Carpeta: %DEST%
echo.

where git >nul 2>nul
if errorlevel 1 goto :sin_git
cd /d "%DEST%" 2>nul
if errorlevel 1 goto :sin_carpeta
git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 goto :sin_repo
git remote get-url origin >nul 2>nul
if errorlevel 1 goto :sin_remoto

:empujar
for /f "delims=" %%u in ('git remote get-url origin') do set "URL=%%u"
echo  Destino: %URL%
echo.
echo  Subiendo ...
git push -u origin main > "%SALIDA%" 2>&1
set "CODIGO=%errorlevel%"
type "%SALIDA%"
if "%CODIGO%"=="0" goto :exito

echo.
echo  --------------------------------------------------
echo  La subida fallo. Esto es lo que entiendo del error:
echo  --------------------------------------------------
call :diagnosticar "%SALIDA%"
if "%DX%"=="WORKFLOW" goto :h_workflow
if "%DX%"=="NOEXISTE" goto :h_noexiste
if "%DX%"=="AUTH" goto :h_auth
if "%DX%"=="NOVACIO" goto :h_novacio
if "%DX%"=="RED" goto :h_red
if "%DX%"=="GRANDE" goto :h_grande
goto :h_otro

rem ---------- diagnostico: lee la salida de git y deja la causa en DX ----------
:diagnosticar
set "DX=OTRO"
findstr /i /c:"refusing to allow" "%~1" >nul
if not errorlevel 1 (set "DX=WORKFLOW" & goto :eof)
findstr /i /c:"not found" "%~1" >nul
if not errorlevel 1 (set "DX=NOEXISTE" & goto :eof)
findstr /i /c:"error: 404" "%~1" >nul
if not errorlevel 1 (set "DX=NOEXISTE" & goto :eof)
findstr /i /c:"Authentication failed" "%~1" >nul
if not errorlevel 1 (set "DX=AUTH" & goto :eof)
findstr /i /c:"could not read Username" "%~1" >nul
if not errorlevel 1 (set "DX=AUTH" & goto :eof)
findstr /i /c:"Permission to" "%~1" >nul
if not errorlevel 1 (set "DX=AUTH" & goto :eof)
findstr /i /c:"error: 403" "%~1" >nul
if not errorlevel 1 (set "DX=AUTH" & goto :eof)
findstr /i /c:"Invalid username" "%~1" >nul
if not errorlevel 1 (set "DX=AUTH" & goto :eof)
findstr /i /c:"fetch first" "%~1" >nul
if not errorlevel 1 (set "DX=NOVACIO" & goto :eof)
findstr /i /c:"non-fast-forward" "%~1" >nul
if not errorlevel 1 (set "DX=NOVACIO" & goto :eof)
findstr /i /c:"Updates were rejected" "%~1" >nul
if not errorlevel 1 (set "DX=NOVACIO" & goto :eof)
findstr /i /c:"Could not resolve host" "%~1" >nul
if not errorlevel 1 (set "DX=RED" & goto :eof)
findstr /i /c:"Failed to connect" "%~1" >nul
if not errorlevel 1 (set "DX=RED" & goto :eof)
findstr /i /c:"timed out" "%~1" >nul
if not errorlevel 1 (set "DX=RED" & goto :eof)
findstr /i /c:"exceeds GitHub" "%~1" >nul
if not errorlevel 1 (set "DX=GRANDE" & goto :eof)
findstr /i /c:"File size limit" "%~1" >nul
if not errorlevel 1 (set "DX=GRANDE" & goto :eof)
goto :eof

rem ---------- causas y soluciones ----------
:h_noexiste
echo.
echo  GitHub no encuentra el repositorio:
echo    %URL%
echo  Casi siempre es una de estas:
echo    - Todavia no lo creaste en la pagina de GitHub.
echo    - El usuario del enlace no es el tuyo.
echo.
echo   [1] Abrir github.com/new para crearlo y reintentar
echo        ^(Nombre: RETOapp, Publico, SIN README, SIN .gitignore, SIN licencia^)
echo   [2] Cambiar el usuario del destino y reintentar
echo   [N] Salir
choice /c 12N /n /m " Elige 1, 2 o N: "
if errorlevel 3 goto :fin_mal
if errorlevel 2 goto :cambiar_usuario
start "" https://github.com/new
echo.
echo  Cuando lo hayas creado ^(y en Settings ^> Pages elegido "Source: GitHub Actions"^), pulsa una tecla.
pause >nul
goto :empujar

:cambiar_usuario
set "NUEVO="
set /p "NUEVO= Tu usuario de GitHub: "
if not defined NUEVO goto :cambiar_usuario
git remote set-url origin https://github.com/%NUEVO%/RETOapp.git
goto :empujar

:h_auth
echo.
echo  Git no pudo iniciar sesion en GitHub ^(o esa cuenta no tiene permiso en este repositorio^).
echo  Soluciones, en orden:
echo    1. Instala o actualiza Git for Windows ^(https://git-scm.com^): trae el
echo       Administrador de credenciales, que abre el navegador para iniciar sesion.
echo    2. Si tienes GitHub CLI: abre una terminal y ejecuta  gh auth login
echo       ^(elige HTTPS y el navegador^), luego  gh auth setup-git
echo    3. Revisa que el usuario del destino sea el tuyo:
echo         %URL%
echo.
echo   [R] Reintentar ahora      [U] Cambiar el usuario del destino      [N] Salir
choice /c RUN /n /m " Elige R, U o N: "
if errorlevel 3 goto :fin_mal
if errorlevel 2 goto :cambiar_usuario
goto :empujar

:h_workflow
echo.
echo  El inicio de sesion que usa Git no tiene el permiso "workflow", que GitHub exige
echo  para subir la carpeta .github/workflows ^(el publicador del sitio^).
echo  Solucion: borra la sesion guardada y vuelve a iniciar sesion por el navegador:
echo    1. Abre "Administrador de credenciales" ^> "Credenciales de Windows".
echo    2. Borra las que digan github.com.
echo    3. Reintenta: Git pedira iniciar sesion en el navegador con todos los permisos.
echo  Si usas un token personal, crealo con los permisos "repo" y "workflow".
echo.
echo   [A] Abrir el Administrador de credenciales    [R] Reintentar ahora    [N] Salir
choice /c ARN /n /m " Elige A, R o N: "
if errorlevel 3 goto :fin_mal
if errorlevel 2 goto :empujar
start "" control.exe /name Microsoft.CredentialManager
echo.
echo  Cuando hayas borrado las credenciales de github.com, pulsa una tecla.
pause >nul
goto :empujar

:h_novacio
echo.
echo  El repositorio en GitHub NO esta vacio ^(seguramente se creo con un README o una licencia^).
echo  Como RETOapp es nuevo, puedes sobrescribir lo que tenga: se pierde solo ese contenido
echo  de relleno, no tus archivos.
echo.
choice /c SN /n /m " Sobrescribir el repositorio de GitHub con tu carpeta? [S/N] "
if errorlevel 2 goto :fin_mal
echo.
echo  Subiendo ^(sobrescribiendo^) ...
git push -u origin main --force > "%SALIDA%" 2>&1
set "CODIGO=%errorlevel%"
type "%SALIDA%"
if "%CODIGO%"=="0" goto :exito
goto :h_otro

:h_red
echo.
echo  No hay conexion con GitHub ^(sin internet, o una red que lo bloquea^).
echo  Revisa tu conexion y reintenta.
echo.
choice /c RN /n /m " [R] Reintentar   [N] Salir: "
if errorlevel 2 goto :fin_mal
goto :empujar

:h_grande
echo.
echo  Algun archivo es demasiado grande para GitHub ^(el limite es 100 MB por archivo^).
echo  Dime cual es con el texto de arriba y lo quitamos.
goto :fin_mal

:h_otro
echo.
echo  No reconozco este error. Copia TODO el texto de arriba ^(desde "Subiendo"^) y
echo  pasaselo a Claude para que lo revise.
goto :fin_mal

:exito
for /f "delims=" %%u in ('git remote get-url origin') do set "URL=%%u"
set "U=%URL:https://github.com/=%"
set "U=%U:.git=%"
for /f "tokens=1,2 delims=/" %%a in ("%U%") do (
  set "USUARIO=%%a"
  set "REPO=%%b"
)
echo.
echo  ===========================================
echo    LISTO. Los archivos ya estan en GitHub.
echo  ===========================================
echo.
echo  Repositorio : https://github.com/%USUARIO%/%REPO%
echo  Avance      : https://github.com/%USUARIO%/%REPO%/actions
echo  Sitio       : https://%USUARIO%.github.io/%REPO%/   ^(tarda 1 o 2 minutos^)
echo  Version     : https://%USUARIO%.github.io/%REPO%/version.txt
echo.
echo  Si en Actions sale un error de "Pages", entra a Settings ^> Pages, elige
echo  Source: GitHub Actions y en Actions pulsa "Re-run all jobs".
goto :fin_bien

:sin_git
echo [!] No encuentro Git. Instalalo desde https://git-scm.com y vuelve a intentarlo.
goto :fin_mal
:sin_carpeta
echo [!] No encuentro la carpeta %DEST%
echo     Ejecuta primero crear-repo-RETOapp.cmd, o copia este archivo dentro de RETOapp.
goto :fin_mal
:sin_repo
echo [!] Esa carpeta no es un repositorio de Git.
goto :fin_mal
:sin_remoto
echo [!] Ese repositorio no tiene destino en GitHub ^(origin^).
set "USUARIO="
set /p "USUARIO= Tu usuario de GitHub: "
if not defined USUARIO goto :sin_remoto
git remote add origin https://github.com/%USUARIO%/RETOapp.git
goto :empujar

:fin_bien
if /i not "%~2"=="nopausa" (
  echo.
  pause
)
endlocal & exit /b 0

:fin_mal
if /i not "%~2"=="nopausa" (
  echo.
  pause
)
endlocal & exit /b 1
