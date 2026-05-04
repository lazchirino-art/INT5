/**
 * Utilidades Generales de la Aplicación
 * 
 * Módulo que proporciona funciones auxiliares para toda la aplicación.
 * Incluye manejo de almacenamiento, logging, y utilidades de DOM.
 */

const Utils = {
  /**
   * Gestión de almacenamiento local
   */
  storage: {
    /**
     * Guardar datos en localStorage
     * @param {string} key - Clave de almacenamiento
     * @param {*} value - Valor a guardar
     * @param {boolean} encrypt - Si se debe encriptar
     */
    set: function(key, value, encrypt = false) {
      try {
        const data = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, data);
        Utils.logger.info(`Datos guardados: ${key}`);
        return true;
      } catch (error) {
        Utils.logger.error(`Error al guardar datos: ${error.message}`);
        return false;
      }
    },

    /**
     * Obtener datos de localStorage
     * @param {string} key - Clave de almacenamiento
     * @param {boolean} parse - Si se debe parsear como JSON
     */
    get: function(key, parse = true) {
      try {
        const data = localStorage.getItem(key);
        if (!data) return null;
        return parse ? JSON.parse(data) : data;
      } catch (error) {
        Utils.logger.error(`Error al obtener datos: ${error.message}`);
        return null;
      }
    },

    /**
     * Eliminar datos de localStorage
     * @param {string} key - Clave de almacenamiento
     */
    remove: function(key) {
      try {
        localStorage.removeItem(key);
        Utils.logger.info(`Datos eliminados: ${key}`);
        return true;
      } catch (error) {
        Utils.logger.error(`Error al eliminar datos: ${error.message}`);
        return false;
      }
    },

    /**
     * Limpiar todo el almacenamiento
     */
    clear: function() {
      try {
        localStorage.clear();
        Utils.logger.info('Almacenamiento limpiado');
        return true;
      } catch (error) {
        Utils.logger.error(`Error al limpiar almacenamiento: ${error.message}`);
        return false;
      }
    }
  },

  /**
   * Sistema de logging
   */
  logger: {
    /**
     * Log de información
     */
    info: function(message) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
    },

    /**
     * Log de advertencia
     */
    warn: function(message) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
    },

    /**
     * Log de error
     */
    error: function(message) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    },

    /**
     * Log de depuración
     */
    debug: function(message) {
      if (true) { // Cambiar a false para desactivar logs de debug
        console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`);
      }
    }
  },

  /**
   * Utilidades de DOM
   */
  dom: {
    /**
     * Obtener elemento por ID
     */
    getElementById: function(id) {
      return document.getElementById(id);
    },

    /**
     * Obtener elementos por selector
     */
    querySelector: function(selector) {
      return document.querySelector(selector);
    },

    /**
     * Obtener todos los elementos por selector
     */
    querySelectorAll: function(selector) {
      return document.querySelectorAll(selector);
    },

    /**
     * Crear elemento
     */
    createElement: function(tag, attributes = {}, content = '') {
      const element = document.createElement(tag);
      
      Object.keys(attributes).forEach(key => {
        if (key === 'class') {
          element.className = attributes[key];
        } else if (key === 'style') {
          Object.assign(element.style, attributes[key]);
        } else {
          element.setAttribute(key, attributes[key]);
        }
      });

      if (content) {
        element.innerHTML = content;
      }

      return element;
    },

    /**
     * Agregar clase a elemento
     */
    addClass: function(element, className) {
      if (element) {
        element.classList.add(className);
      }
    },

    /**
     * Remover clase de elemento
     */
    removeClass: function(element, className) {
      if (element) {
        element.classList.remove(className);
      }
    },

    /**
     * Verificar si elemento tiene clase
     */
    hasClass: function(element, className) {
      return element ? element.classList.contains(className) : false;
    },

    /**
     * Agregar evento a elemento
     */
    addEventListener: function(element, event, callback) {
      if (element) {
        element.addEventListener(event, callback);
      }
    },

    /**
     * Remover evento de elemento
     */
    removeEventListener: function(element, event, callback) {
      if (element) {
        element.removeEventListener(event, callback);
      }
    }
  },

  /**
   * Utilidades de validación
   */
  validation: {
    /**
     * Validar email
     */
    isEmail: function(email) {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    },

    /**
     * Validar que no esté vacío
     */
    isEmpty: function(value) {
      return !value || (typeof value === 'string' && value.trim() === '');
    },

    /**
     * Validar número
     */
    isNumber: function(value) {
      return !isNaN(value) && isFinite(value);
    },

    /**
     * Validar URL
     */
    isUrl: function(url) {
      try {
        new URL(url);
        return true;
      } catch (error) {
        return false;
      }
    }
  },

  /**
   * Utilidades de tiempo
   */
  time: {
    /**
     * Obtener timestamp actual
     */
    now: function() {
      return Date.now();
    },

    /**
     * Formatear fecha
     */
    formatDate: function(date, format = 'DD/MM/YYYY') {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      
      return format
        .replace('DD', day)
        .replace('MM', month)
        .replace('YYYY', year);
    },

    /**
     * Obtener diferencia en ms entre dos fechas
     */
    getDifference: function(date1, date2) {
      return Math.abs(new Date(date1) - new Date(date2));
    }
  },

  /**
   * Utilidades de eventos personalizados
   */
  events: {
    listeners: {},

    /**
     * Registrar listener para evento personalizado
     */
    on: function(eventName, callback) {
      if (!this.listeners[eventName]) {
        this.listeners[eventName] = [];
      }
      this.listeners[eventName].push(callback);
    },

    /**
     * Disparar evento personalizado
     */
    emit: function(eventName, data) {
      if (this.listeners[eventName]) {
        this.listeners[eventName].forEach(callback => {
          callback(data);
        });
      }
    },

    /**
     * Remover listener
     */
    off: function(eventName, callback) {
      if (this.listeners[eventName]) {
        this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback);
      }
    }
  }
};

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}
