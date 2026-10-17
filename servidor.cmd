@echo off
REM ===========================================================================
REM  R.E.T.O. — levantar el sitio
REM ===========================================================================
REM  ESTO SE ABRE CON UN DOBLE CLIC y deja el servidor corriendo en ESTA
REM  ventana.
REM
REM  POR QUE EN UNA VENTANA PROPIA Y NO EN UN AGENTE
REM  Un servidor que arranca desde una conversacion se apaga cuando esa
REM  conversacion se cierra. Este no: vive mientras esta la ventana abierta.
REM  While este abierta, se puede entrar desde el celular o desde otra
REM  computadora, con la direccion que se muestra abajo y que ademas queda
REM  escrita en direccion-del-sitio.txt.
REM
REM  PARA APAGARLO: cerrar esta ventana.
REM ===========================================================================

cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
    echo.
    echo   No se encontro Python en esta computadora.
    echo   Instala Python desde python.org y vuelve a abrir este archivo.
    echo.
    pause
    exit /b 1
)

REM Flask se instala solo la primera vez. A partir de ahi ya esta.
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Falta Flask. Se va a instalar ahora. Puede tardar un momento...
    echo.
    python -m pip install flask
    if errorlevel 1 (
        echo.
        echo   No se pudo instalar Flask. Revisa la conexion a internet.
        echo.
        pause
        exit /b 1
    )
)

REM cryptography genera el certificado HTTPS autofirmado la primera vez.
python -c "import cryptography" >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Falta cryptography. Se va a instalar ahora. Puede tardar un momento...
    echo.
    python -m pip install cryptography
    if errorlevel 1 (
        echo.
        echo   No se pudo instalar cryptography. Revisa la conexion a internet.
        echo.
        pause
        exit /b 1
    )
)

python server.py

echo.
echo   El servidor se apago.
pause
