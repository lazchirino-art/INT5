@echo off
title INT5 - Mock API Server (puerto 3001)

:: Moverse a la carpeta del proyecto (donde esta este .bat)
cd /d "%~dp0"

:: Verificar que Node.js esta instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Node.js no esta instalado.
    echo  Descargalo en https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Abrir el navegador despues de 2 segundos (tiempo para que el servidor arranque)
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3001/"

:: Iniciar el servidor mock
echo.
echo  Iniciando INT5 Mock API Server...
echo  URL: http://localhost:3001
echo.
echo  Productos de prueba: ASP001, IBU200, AMO500, INCOMPLETE
echo.
echo  Presiona Ctrl+C para detener el servidor.
echo.
node mock-api-server.js

:: Si el servidor se detiene, pausar para ver el error
echo.
echo  El servidor mock se detuvo.
pause
