# POC - Aplicación Embebida con Interfaz Frontend

Proyecto de Proof of Concept para una aplicación embebida que corre localmente sin servidor externo. Esta es una interfaz frontend completa para gestionar menús y configuraciones de máquinas.

## Estructura del Proyecto

```
poc-embedded-app/
├── src/
│   ├── pages/              # Páginas HTML principales
│   │   ├── index.html      # Página principal del menú
│   │   ├── csv-integration.html
│   │   └── Menu_decodificado.html
│   ├── components/         # Componentes reutilizables (futuro)
│   ├── styles/             # Estilos CSS
│   │   └── csv-integration.css
│   ├── js/                 # Scripts JavaScript
│   │   ├── app-local-secret.js
│   │   ├── credential-crypto.js
│   │   └── csv-integration.js
│   └── assets/             # Imágenes, iconos, recursos
├── config/                 # Configuración de la aplicación
│   ├── config-persistence.mjs
│   └── server.mjs
├── docs/                   # Documentación del proyecto
└── README.md              # Este archivo
```

## Características

- **Interfaz de Menú Profesional**: Sistema de menú modular con secciones (Máquina, Registros, Configuraciones, Integraciones)
- **Autenticación Local**: Gestión de credenciales y secretos de aplicación
- **Persistencia de Datos**: Configuración que persiste localmente
- **Cifrado de Credenciales**: Módulo de criptografía para proteger datos sensibles
- **Diseño Responsivo**: Interfaz adaptable a diferentes tamaños de pantalla

## Requisitos

- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- Node.js (opcional, para ejecutar servidor local)
- No requiere conexión a internet ni servidor externo

## Instalación y Uso

### Opción 1: Abrir directamente en el navegador

1. Navega a la carpeta `src/pages/`
2. Abre `index.html` con tu navegador web

### Opción 2: Ejecutar con servidor local (Node.js)

```bash
cd poc-embedded-app
node config/server.mjs
```

El servidor correrá en `http://localhost:8000`

## Archivos Principales

### `src/pages/index.html`
Página principal con la estructura del menú. Contiene cuatro secciones principales:
- **Máquina**: Inicio, Alarmas, Info
- **Registros**: Productos, Recetas, Diseños, Etiqueta, Clasificación, Impresoras, Registros
- **Configuraciones**: Usuarios, Corte, Embalaje, General, Formatos, Base de datos
- **Integraciones**: CSV, API-RESP, Database

### `src/styles/csv-integration.css`
Estilos CSS para la interfaz CSV. Incluye:
- Tema de colores (azul eléctrico y negro)
- Animaciones y transiciones
- Estilos responsivos para móvil y escritorio
- Efectos hover y estados activos

### `src/js/`
Scripts JavaScript para funcionalidad:
- `credential-crypto.js`: Cifrado y descifrado de credenciales
- `app-local-secret.js`: Gestión de secretos de aplicación
- `csv-integration.js`: Lógica del menú CSV

### `config/`
Archivos de configuración:
- `config-persistence.mjs`: Persistencia de configuración en almacenamiento local
- `server.mjs`: Servidor HTTP simple para desarrollo local

## Desarrollo

### Agregar nuevas páginas

1. Crea un archivo HTML en `src/pages/`
2. Importa los estilos desde `src/styles/`
3. Vincula los scripts necesarios desde `src/js/`

### Agregar nuevos estilos

1. Crea archivos CSS en `src/styles/`
2. Importa en el HTML correspondiente

### Agregar nueva funcionalidad

1. Crea scripts en `src/js/`
2. Asegúrate de que sean módulos ES6 si es necesario
3. Vincula en las páginas HTML

## Notas de Implementación

- La aplicación está diseñada para correr completamente en el navegador
- No hay dependencias externas de servidor
- Los datos se pueden persistir usando `localStorage` o `sessionStorage`
- Los módulos de criptografía protegen datos sensibles localmente

## Próximos Pasos

- [ ] Implementar módulos de componentes reutilizables
- [ ] Agregar gestión de estado global
- [ ] Crear sistema de rutas para navegación
- [ ] Implementar almacenamiento local persistente
- [ ] Agregar pruebas unitarias
- [ ] Documentar API de componentes

## Licencia

Proyecto interno - Todos los derechos reservados
