/**
 * Inicialización de la Aplicación Embebida
 * 
 * Este archivo se ejecuta cuando la página carga y prepara la aplicación.
 */

class AppInitializer {
  constructor() {
    this.config = null;
    this.initialized = false;
  }

  /**
   * Inicializar la aplicación
   */
  async init() {
    try {
      Utils.logger.info('Iniciando aplicación embebida...');

      // Cargar configuración
      await this.loadConfig();

      // Inicializar almacenamiento
      this.initializeStorage();

      // Configurar event listeners
      this.setupEventListeners();

      // Cargar datos iniciales
      this.loadInitialData();

      // Marcar como inicializado
      this.initialized = true;
      Utils.logger.info('Aplicación inicializada correctamente');

      // Disparar evento de inicialización
      Utils.events.emit('app:initialized', { timestamp: Date.now() });

    } catch (error) {
      Utils.logger.error(`Error durante inicialización: ${error.message}`);
      this.handleInitError(error);
    }
  }

  /**
   * Cargar configuración
   */
  async loadConfig() {
    try {
      // Si AppConfig está disponible globalmente, usarlo
      if (typeof AppConfig !== 'undefined') {
        this.config = AppConfig;
        Utils.logger.info('Configuración cargada');
      } else {
        Utils.logger.warn('AppConfig no disponible, usando valores por defecto');
        this.config = this.getDefaultConfig();
      }
    } catch (error) {
      Utils.logger.error(`Error cargando configuración: ${error.message}`);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Obtener configuración por defecto
   */
  getDefaultConfig() {
    return {
      app: { name: 'POC - Aplicación Embebida', version: '1.0.0' },
      ui: { theme: 'dark', language: 'es' },
      storage: { enabled: true, type: 'localStorage' }
    };
  }

  /**
   * Inicializar almacenamiento
   */
  initializeStorage() {
    if (this.config.storage.enabled) {
      // Verificar que localStorage esté disponible
      try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        Utils.logger.info('Almacenamiento local disponible');
      } catch (error) {
        Utils.logger.warn('Almacenamiento local no disponible');
      }
    }
  }

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Listener para cambios de visibilidad
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        Utils.logger.info('Aplicación en segundo plano');
      } else {
        Utils.logger.info('Aplicación en primer plano');
      }
    });

    // Listener para descargar página
    window.addEventListener('beforeunload', (e) => {
      Utils.logger.info('Aplicación siendo descargada');
      // Guardar datos importantes antes de salir
      this.saveBeforeExit();
    });

    // Listener para errores no capturados
    window.addEventListener('error', (event) => {
      Utils.logger.error(`Error no capturado: ${event.message}`);
    });

    // Listener para promesas rechazadas no capturadas
    window.addEventListener('unhandledrejection', (event) => {
      Utils.logger.error(`Promesa rechazada no capturada: ${event.reason}`);
    });
  }

  /**
   * Cargar datos iniciales
   */
  loadInitialData() {
    // Cargar preferencias del usuario
    const userPreferences = Utils.storage.get('user_preferences');
    if (!userPreferences) {
      const defaultPreferences = {
        theme: this.config.ui.theme,
        language: this.config.ui.language,
        lastVisit: Date.now()
      };
      Utils.storage.set('user_preferences', defaultPreferences);
    }

    // Cargar estado de la sesión
    const sessionData = Utils.storage.get('session_data');
    if (!sessionData) {
      Utils.storage.set('session_data', {
        startTime: Date.now(),
        pageViews: 0
      });
    }

    Utils.logger.info('Datos iniciales cargados');
  }

  /**
   * Guardar datos antes de salir
   */
  saveBeforeExit() {
    try {
      const sessionData = Utils.storage.get('session_data') || {};
      sessionData.endTime = Date.now();
      sessionData.lastPage = window.location.pathname;
      Utils.storage.set('session_data', sessionData);
      Utils.logger.info('Datos de sesión guardados');
    } catch (error) {
      Utils.logger.error(`Error guardando datos: ${error.message}`);
    }
  }

  /**
   * Manejar errores de inicialización
   */
  handleInitError(error) {
    // Mostrar mensaje de error al usuario
    const errorMessage = `Error al inicializar la aplicación: ${error.message}`;
    console.error(errorMessage);

    // Intentar mostrar en la UI si es posible
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
      errorContainer.innerHTML = `<div class="error-message">${errorMessage}</div>`;
      errorContainer.style.display = 'block';
    }
  }

  /**
   * Obtener estado de inicialización
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Obtener configuración
   */
  getConfig() {
    return this.config;
  }
}

// Crear instancia global
const appInitializer = new AppInitializer();

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    appInitializer.init();
  });
} else {
  // DOM ya está listo
  appInitializer.init();
}
