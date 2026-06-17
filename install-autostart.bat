@echo off
:: ============================================================
::  install-autostart.bat
::  Registra INT5 para que arranque SOLO al iniciar sesion el
::  usuario del kiosco. Ejecutar UNA VEZ durante la instalacion.
::  (Click derecho -> Ejecutar como administrador)
:: ============================================================

cd /d "%~dp0"

:: Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Node.js no esta instalado. Instalalo desde https://nodejs.org/
    echo.
    pause
    exit /b 1
)

set "VBS=%~dp0start-int5.vbs"

echo.
echo  Registrando INT5 para arranque automatico al iniciar sesion...
echo.

schtasks /create /tn "INT5 Server" /tr "wscript.exe \"%VBS%\"" /sc onlogon /f
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: No se pudo crear la tarea. Ejecuta este .bat como administrador.
    pause
    exit /b 1
)

echo.
echo  LISTO. INT5 arrancara automaticamente (oculto) cada vez que
echo  inicie sesion este usuario.
echo.
echo  Para arrancarlo ahora mismo sin reiniciar, ejecuta start-int5.vbs
echo  (doble clic) o reinicia el equipo.
echo.
pause
