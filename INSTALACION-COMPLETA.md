# Instalación Completa — INT5

> **La guía de instalación vigente es [docs/INSTALACION-PC-FINAL.md](docs/INSTALACION-PC-FINAL.md)** (requisitos, dependencias, `backend/.env`, arranque, autoarranque y verificación). Esta página solo conserva algunos complementos que no están allí.
>
> ⚠️ **No generes un `ENCRYPTION_SECRET` nuevo.** `backend/.env` ya viene incluido en la entrega y su secreto debe coincidir con el del frontend (`window.CSV_INT_LOCAL_SECRET` en `src/pages/csv-integration.html`); si no coinciden, las contraseñas guardadas no se descifran (ver sección 9 de la guía).

---

## Habilitar ejecución de scripts en PowerShell

Si `npm` falla en PowerShell con "la ejecución de scripts está deshabilitada", abre PowerShell **como Administrador** y ejecuta:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Responde `Y`. (En `cmd` no hace falta.)

---

## Acceso por nombre `int5` (opcional)

Para acceder con `http://int5:3000` en lugar de `http://localhost:3000`, abre PowerShell **como Administrador** y ejecuta:

```powershell
Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "`n127.0.0.1`tint5" -Encoding utf8
```

Para acceso desde el **teléfono** (misma red WiFi), el mDNS (`http://int5.local:3000`) se anuncia automáticamente al iniciar el servidor.

---

## Llamada de prueba

Con el wizard CSV configurado y guardado (incluida la **Search Column** del Mapping), sustituye `PROD-001` por un código que exista en el CSV:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/product/import" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"productCode":"PROD-001"}'
```

O con curl:

```bash
curl -X POST http://localhost:3000/api/product/import -H "Content-Type: application/json" -d '{"productCode":"PROD-001"}'
```

No envíes `searchColumnIndex`: si se envía, sustituye a la columna configurada en el Mapping.

---

Ver `docs/API-ENDPOINT.md` para la referencia completa de endpoints.
