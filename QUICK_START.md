# Guía Rápida - POC Aplicación Embebida

## Inicio Rápido en 3 Pasos

### Paso 1: Abrir en el Navegador
Navega a la carpeta `src/pages/` y abre **main.html** en tu navegador web favorito.

```
poc-embedded-app/src/pages/main.html
```

### Paso 2: Interactuar con el Menú
Haz clic en cualquier botón del menú. Verás notificaciones confirmando la acción.

### Paso 3: Revisar la Consola
Abre las herramientas de desarrollo (F12) para ver los logs y el historial de acciones.

---

## Estructura Rápida

```
poc-embedded-app/
├── src/
│   ├── pages/main.html          ← ABRE ESTE ARCHIVO
│   ├── styles/                  ← Estilos CSS
│   ├── js/                       ← Lógica JavaScript
│   └── assets/                   ← Recursos (imágenes, etc.)
├── config/                       ← Configuración de la app
├── docs/                         ← Documentación
└── README.md                     ← Documentación completa
```

---

## Características Principales

✅ **Menú Interactivo** - 4 secciones con múltiples opciones
✅ **Almacenamiento Local** - Datos persistentes en el navegador
✅ **Historial de Acciones** - Registro de todas las acciones
✅ **Sistema de Logging** - Depuración fácil en consola
✅ **Diseño Responsivo** - Funciona en desktop, tablet y móvil
✅ **Sin Dependencias Externas** - Todo corre localmente

---

## Comandos Útiles en la Consola

```javascript
// Ver configuración
console.log(appInitializer.getConfig());

// Ver historial de acciones
console.log(menuHandler.getHistory());

// Ver estadísticas de uso
console.log(menuHandler.getStatistics());

// Guardar datos
Utils.storage.set('mi-clave', { datos: 'valor' });

// Obtener datos
Utils.storage.get('mi-clave');

// Ver logs
Utils.logger.info('Mi mensaje');
```

---

## Agregar Nueva Acción al Menú

### 1. Editar `src/pages/main.html`
Agregar botón:
```html
<button class="menu-button" type="button" data-action="mi.accion">
  Mi Botón
</button>
```

### 2. Editar `src/js/menu-handler.js`
Agregar acción en `actionMap`:
```javascript
'mi.accion': () => {
  this.showNotification(`Mi acción ejecutada`, 'success');
}
```

¡Listo! El botón funcionará automáticamente.

---

## Solucionar Problemas

### El menú no responde
- Abre la consola (F12) y busca errores
- Verifica que todos los scripts se cargaron correctamente
- Recarga la página

### Los estilos no se ven bien
- Limpia la caché del navegador (Ctrl+Shift+Delete)
- Verifica que los archivos CSS estén en la ruta correcta
- Abre las herramientas de desarrollo y revisa los errores de red

### Los datos no se guardan
- Verifica que localStorage esté habilitado
- Abre la consola y ejecuta: `console.log(localStorage)`
- Intenta en modo incógnito/privado

---

## Próximos Pasos

1. **Personalizar el menú** - Agregar tus propias acciones
2. **Agregar nuevas páginas** - Crear páginas adicionales en `src/pages/`
3. **Modificar estilos** - Editar `src/styles/main.css`
4. **Agregar lógica** - Crear nuevos módulos en `src/js/`

---

## Recursos

- 📖 [Documentación Completa](./README.md)
- 🛠️ [Guía de Desarrollo](./docs/DEVELOPMENT.md)
- 💻 [Código Fuente](./src/)

---

## Soporte

Si necesitas ayuda, revisa los comentarios en el código o consulta la documentación completa.

¡Feliz desarrollo! 🚀
