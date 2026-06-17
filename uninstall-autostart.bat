@echo off
:: ============================================================
::  uninstall-autostart.bat
::  Quita el arranque automatico de INT5 (elimina la tarea).
::  (Click derecho -> Ejecutar como administrador)
:: ============================================================

echo.
echo  Eliminando el arranque automatico de INT5...
echo.

schtasks /delete /tn "INT5 Server" /f
if %errorlevel% neq 0 (
    echo.
    echo  No se pudo eliminar (quiza no estaba registrada). Ejecuta como administrador si hace falta.
    pause
    exit /b 1
)

echo.
echo  LISTO. INT5 ya no arrancara automaticamente.
echo  (El servidor que este corriendo ahora seguira hasta que se cierre o reinicie el equipo.)
echo.
pause
