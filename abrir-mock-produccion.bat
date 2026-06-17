@echo off
title INT5 - Mock App de Produccion (CSV)

:: Abre la vista mock de produccion que prueba el flujo de importacion CSV.
:: NOTA: requiere que INT5 ya este corriendo en el puerto 3000
::       (con iniciar.bat o con la cuenta int5svc).

echo.
echo  Abriendo la vista MOCK de produccion (CSV)...
echo  URL: http://localhost:3000/mock-production.html
echo.
echo  (INT5 debe estar corriendo en el puerto 3000)
echo.

start "" http://localhost:3000/mock-production.html
