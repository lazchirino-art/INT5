# Guía de Desarrollo - POC Aplicación Embebida

## Introducción

Este documento proporciona una guía completa para desarrollar y mantener la aplicación embebida.

## Estructura de Archivos

### `/src/pages/`
Contiene todas las páginas HTML de la aplicación.

- **main.html**: Página principal con el menú
- **csv-integration.html**: Página de integración CSV
- **Menu_decodificado.html**: Menú decodificado
- **index.html**: Página de índice (legacy)

### `/src/styles/`
Contiene todos los estilos CSS.

- **main.css**: Estilos base y variables CSS
- **csv-integration.css**: Estilos específicos del menú CSV

### `/src/js/`
Contiene toda la lógica JavaScript.

- **utils.js**: Utilidades generales (almacenamiento, logging, DOM, validación)
- **app-init.js**: Inicialización de la aplicación
- **menu-handler.js**: Manejador de eventos del menú
- **credential-crypto.js**: Cifrado de credenciales
- **app-local-secret.js**: Gestión de secretos locales
- **csv-integration.js**: Lógica específica del CSV

### `/config/`
Contiene archivos de configuración.

- **app-config.js**: Configuración principal de la aplicación
- **config-persistence.mjs**: Persistencia de configuración
- **server.mjs**: Servidor HTTP local (Node.js)

### `/src/assets/`
Contiene recursos (imágenes, iconos, etc.).

## Flujo de Inicialización

1. **Cargar HTML** → Se carga main.html
2. **Cargar Scripts** → En orden:
   - app-config.js (configuración)
   - utils.js (utilidades)
   - credential-crypto.js (seguridad)
   - app-local-secret.js (secretos)
   - config-persistence.mjs (persistencia)
   - app-init.js (inicialización)
   - menu-handler.js (menú)
3. **Inicialización** → AppInitializer.init() se ejecuta
4. **Menú Listo** → MenuHandler se inicializa

## Agregar Nueva Funcionalidad

### 1. Agregar Nueva Página

```html
<!-- src/pages/nueva-pagina.html -->
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Nueva Página</title>
  <link rel="stylesheet" href="../styles/main.css" />
</head>
<body>
  <main class="page">
    <!-- Contenido aquí -->
  </main>
  
  <!-- Scripts -->
  <script src="../../../config/app-config.js"></script>
  <script src="../js/utils.js"></script>
  <script src="../js/app-init.js"></script>
</body>
</html>
```

### 2. Agregar Nueva Acción al Menú

En `menu-handler.js`, agregar a `actionMap`:

```javascript
'nueva.accion': () => {
  // Lógica aquí
  this.showNotification(`Ejecutando nueva acción...`, 'info');
}
```

En `main.html`, agregar botón:

```html
<button class="menu-button" type="button" data-action="nueva.accion">
  Nueva Acción
</button>
```

### 3. Agregar Nuevo Estilo

Crear archivo en `/src/styles/` e importar en HTML:

```html
<link rel="stylesheet" href="../styles/nuevo-estilo.css" />
```

### 4. Agregar Nuevo Módulo JavaScript

Crear archivo en `/src/js/` y cargar en HTML:

```html
<script src="../js/nuevo-modulo.js"></script>
```

## Utilidades Disponibles

### Utils.storage
Gestión de almacenamiento local:

```javascript
// Guardar
Utils.storage.set('clave', { datos: 'valor' });

// Obtener
const datos = Utils.storage.get('clave');

// Remover
Utils.storage.remove('clave');

// Limpiar todo
Utils.storage.clear();
```

### Utils.logger
Sistema de logging:

```javascript
Utils.logger.info('Mensaje informativo');
Utils.logger.warn('Advertencia');
Utils.logger.error('Error');
Utils.logger.debug('Depuración');
```

### Utils.dom
Utilidades de DOM:

```javascript
// Obtener elemento
const elem = Utils.dom.getElementById('id');

// Crear elemento
const btn = Utils.dom.createElement('button', {
  class: 'mi-boton',
  'data-action': 'test'
}, 'Texto');

// Agregar clase
Utils.dom.addClass(elem, 'activo');

// Remover clase
Utils.dom.removeClass(elem, 'activo');

// Agregar evento
Utils.dom.addEventListener(elem, 'click', () => {
  console.log('Clickeado');
});
```

### Utils.validation
Validación de datos:

```javascript
Utils.validation.isEmail('test@example.com'); // true
Utils.validation.isEmpty(''); // true
Utils.validation.isNumber(123); // true
Utils.validation.isUrl('https://example.com'); // true
```

### Utils.events
Eventos personalizados:

```javascript
// Registrar listener
Utils.events.on('evento:personalizado', (data) => {
  console.log('Evento disparado:', data);
});

// Disparar evento
Utils.events.emit('evento:personalizado', { mensaje: 'Hola' });

// Remover listener
Utils.events.off('evento:personalizado', callback);
```

## Variables CSS Disponibles

```css
/* Colores */
--color-primary: #1f5bff;
--color-background: #000000;
--color-text: #ffffff;
--color-success: #10b981;
--color-warning: #f59e0b;
--color-error: #ef4444;

/* Espaciado */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;

/* Bordes */
--border-radius-sm: 8px;
--border-radius-md: 16px;
--border-radius-lg: 24px;

/* Sombras */
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);
--shadow-lg: 0 12px 30px var(--color-shadow);

/* Transiciones */
--transition-fast: 160ms ease;
--transition-normal: 300ms ease;
```

## Ejecución Local

### Opción 1: Abrir en Navegador
```bash
# Navegar a src/pages/ y abrir main.html en el navegador
```

### Opción 2: Servidor Node.js
```bash
# Desde la raíz del proyecto
node config/server.mjs

# Abrir http://localhost:8000/src/pages/main.html
```

## Debugging

### Habilitar Logs de Debug
En `utils.js`, cambiar:
```javascript
debug: function(message) {
  if (true) { // Cambiar a true para habilitar
    console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`);
  }
}
```

### Inspeccionar Almacenamiento
En la consola del navegador:
```javascript
// Ver todo el almacenamiento
console.log(localStorage);

// Ver configuración
console.log(Utils.storage.get('user_preferences'));

// Ver historial de menú
console.log(menuHandler.getHistory());

// Ver estadísticas
console.log(menuHandler.getStatistics());
```

## Mejores Prácticas

1. **Siempre usar Utils para operaciones comunes** - No reinventar la rueda
2. **Registrar acciones importantes** - Usar Utils.logger
3. **Guardar datos importantes** - Usar Utils.storage
4. **Crear eventos personalizados** - Para comunicación entre módulos
5. **Usar variables CSS** - Para mantener consistencia visual
6. **Documentar código** - Especialmente funciones complejas
7. **Probar en diferentes navegadores** - Chrome, Firefox, Safari, Edge
8. **Probar en diferentes resoluciones** - Desktop, tablet, mobile

## Seguridad

- Los datos sensibles se cifran usando credential-crypto.js
- Los secretos de aplicación se almacenan en app-local-secret.js
- Todo corre localmente - no hay transmisión a servidores externos
- Usar HTTPS si se despliega en red

## Próximos Pasos

- [ ] Implementar autenticación local
- [ ] Agregar base de datos local (IndexedDB)
- [ ] Crear sistema de temas (claro/oscuro)
- [ ] Agregar soporte para múltiples idiomas
- [ ] Implementar sincronización de datos
- [ ] Agregar pruebas unitarias
- [ ] Crear documentación de API

## Contacto y Soporte

Para preguntas o problemas, consultar la documentación del proyecto o los comentarios en el código.
