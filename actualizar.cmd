@echo off
chcp 65001 >nul
cd /d "%~dp0"
title R.E.T.O. - Actualizar y Sincronizar con GitHub

echo ===========================================
echo   R.E.T.O. - Sincronizacion Automatica
echo ===========================================
echo.

:: 1. Actualizar indices
echo [1/4] Actualizando indices de archivos...
node tools\generar-indices.js

:: 2. Correr pruebas
echo.
echo [2/4] Ejecutando pruebas de integridad...
node tests\run-all.js
if errorlevel 1 (
    echo.
    echo [!] ADVERTENCIA: Alguna prueba fallo. Corrige el error antes de subir.
    pause
    exit /b 1
)

:: 3. Git add & commit
echo.
echo [3/4] Preparando cambios en Git...
git add -A
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "Update: actualizacion automatica de cambios en R.E.T.O."
) else (
    echo No hay cambios nuevos para confirmar.
)

:: 4. Git push
echo.
echo [4/4] Subiendo cambios a GitHub...
git push origin main

echo.
echo ===========================================
echo   ¡Sincronizacion completada con exito!
echo ===========================================
pause
