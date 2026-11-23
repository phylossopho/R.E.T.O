@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Configurando credenciales de Git con GitHub CLI...
"C:\Program Files\GitHub CLI\gh.exe" auth setup-git
echo.
echo Añadiendo archivos y haciendo commit...
git add .
git commit -m "Update: sincronizacion completa de archivos y modulos de R.E.T.O." --allow-empty
echo.
echo Subiendo archivos a GitHub...
git push -u origin main
echo.
echo ========================================
echo ¡Proceso completado!
echo ========================================
pause
