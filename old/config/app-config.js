/**
 * Configuración Principal de la Aplicación Embebida
 * 
 * Este archivo centraliza toda la configuración de la aplicación.
 * No requiere servidor externo - todo corre localmente.
 */

const AppConfig = {
  // Información de la aplicación
  app: {
    name: 'POC - Aplicación Embebida',
    version: '1.0.0',
    environment: 'local',
    description: 'Interfaz frontend para aplicación embebida'
  },

  // Configuración de la interfaz
  ui: {
    theme: 'dark',
    language: 'es',
    defaultPage: 'index.html',
    animationsEnabled: true,
    transitionDuration: 160 // ms
  },

  // Configuración de almacenamiento local
  storage: {
    enabled: true,
    type: 'localStorage', // 'localStorage' o 'sessionStorage'
    prefix: 'poc_app_',
    clearOnExit: false
  },

  // Configuración de seguridad
  security: {
    encryptionEnabled: true,
    credentialsStorage: 'encrypted',
    sessionTimeout: 3600000, // 1 hora en ms
    requiresAuthentication: false
  },

  // Configuración de menú
  menu: {
    sections: [
      {
        id: 'maquina',
        title: 'Máquina',
        items: [
          { label: 'Inicio', action: 'machine.start' },
          { label: 'Alarmas', action: 'machine.alarms' },
          { label: 'Info', action: 'machine.info' }
        ]
      },
      {
        id: 'registros',
        title: 'Registros',
        items: [
          { label: 'Productos', action: 'records.products' },
          { label: 'Recetas', action: 'records.recipes' },
          { label: 'Diseños', action: 'records.designs' },
          { label: 'Etiqueta', action: 'records.labels' },
          { label: 'Clasificación', action: 'records.classification' },
          { label: 'Impresoras', action: 'records.printers' },
          { label: 'Registros', action: 'records.logs' }
        ]
      },
      {
        id: 'configuraciones',
        title: 'Configuraciones',
        items: [
          { label: 'Usuarios', action: 'config.users' },
          { label: 'Corte', action: 'config.cutting' },
          { label: 'Embalaje', action: 'config.packaging' },
          { label: 'General', action: 'config.general' },
          { label: 'Formatos', action: 'config.formats' },
          { label: 'Base de datos', action: 'config.database' }
        ]
      },
      {
        id: 'integraciones',
        title: 'Integraciones',
        items: [
          { label: 'CSV', action: 'integration.csv' },
          { label: 'API-RESP', action: 'integration.api' },
          { label: 'Database', action: 'integration.database' }
        ]
      }
    ]
  },

  // Configuración de servidor local (si se usa)
  server: {
    host: 'localhost',
    port: 8000,
    protocol: 'http'
  },

  // Rutas de recursos
  paths: {
    pages: './src/pages/',
    styles: './src/styles/',
    scripts: './src/js/',
    assets: './src/assets/',
    components: './src/components/'
  },

  // Configuración de logging
  logging: {
    enabled: true,
    level: 'info', // 'debug', 'info', 'warn', 'error'
    console: true,
    storage: false
  },

  // Configuración de caché
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hora en ms
    maxSize: 10485760 // 10MB
  }
};

// Exportar configuración
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppConfig;
}
