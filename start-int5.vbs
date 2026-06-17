' ============================================================
'  start-int5.vbs  —  Arranca el servidor INT5 SIN ventana visible
' ============================================================
'  Pensado para el kiosco de producción:
'   - No abre consola (corre oculto en segundo plano)
'   - No abre navegador (el wizard se ve embebido en la app de producción)
'   - Usa como carpeta de trabajo la del propio script (portable: funciona
'     esté donde esté el proyecto, p.ej. C:\INT5)
'
'  Se puede ejecutar a mano (doble clic) o, mejor, registrarlo para que
'  arranque solo al iniciar sesión con install-autostart.bat
' ============================================================

Set fso   = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' Carpeta donde está este .vbs = raíz del proyecto
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir

' Ejecuta el servidor oculto (0 = ventana oculta, False = no esperar)
shell.Run "cmd /c node server.js", 0, False
