@echo off
title INT5 - Servidor CSV Integration

:: Moverse a la carpeta del proyecto (donde está este .bat)
cd /d "%~dp0"

:: Verificar que Node.js está instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Node.js no está instalado.
    echo  Descárgalo en https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Verificar que las dependencias están instaladas
if not exist "node_modules" (
    echo.
    echo  Instalando dependencias por primera vez...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo  ERROR: Falló npm install.
        pause
        exit /b 1
    )
)

:: Abrir el navegador después de 2 segundos (tiempo para que el servidor arranque)
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Iniciar el servidor
echo.
echo  Iniciando INT5...
echo  Abre el navegador en: http://localhost:3000
echo.
echo  Presiona Ctrl+C para detener el servidor.
echo.
node server.js

:: Si el servidor se detiene, pausar para ver el error
echo.
echo  El servidor se detuvo.
pause
