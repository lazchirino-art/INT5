/**
 * Manejador del Menú
 * 
 * Gestiona los eventos y acciones del menú principal.
 */

class MenuHandler {
  constructor() {
    this.menuButtons = null;
    this.actionHistory = [];
    this.maxHistorySize = 50;
  }

  /**
   * Inicializar el manejador del menú
   */
  init() {
    try {
      this.menuButtons = document.querySelectorAll('.menu-button');
      this.setupButtonListeners();
      Utils.logger.info(`Menú inicializado con ${this.menuButtons.length} botones`);
    } catch (error) {
      Utils.logger.error(`Error inicializando menú: ${error.message}`);
    }
  }

  /**
   * Configurar listeners para los botones del menú
   */
  setupButtonListeners() {
    this.menuButtons.forEach(button => {
      // Click
      button.addEventListener('click', (e) => {
        this.handleButtonClick(e, button);
      });

      // Hover
      button.addEventListener('mouseenter', () => {
        this.handleButtonHover(button, true);
      });

      button.addEventListener('mouseleave', () => {
        this.handleButtonHover(button, false);
      });

      // Keyboard
      button.addEventListener('keydown', (e) => {
        this.handleButtonKeydown(e, button);
      });
    });
  }

  /**
   * Manejar click en botón del menú
   */
  handleButtonClick(event, button) {
    const action = button.getAttribute('data-action');
    const label = button.textContent.trim();

    Utils.logger.info(`Botón clickeado: ${label} (${action})`);

    // Registrar en historial
    this.addToHistory({
      action: action,
      label: label,
      timestamp: Date.now(),
      type: 'click'
    });

    // Ejecutar acción
    this.executeAction(action, label);

    // Efecto visual
    this.playClickEffect(button);

    // Disparar evento personalizado
    Utils.events.emit('menu:action', { action, label });
  }

  /**
   * Manejar hover en botón del menú
   */
  handleButtonHover(button, isHovering) {
    if (isHovering) {
      button.classList.add('hovered');
    } else {
      button.classList.remove('hovered');
    }
  }

  /**
   * Manejar teclas en botón del menú
   */
  handleButtonKeydown(event, button) {
    // Enter o Space para activar
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      button.click();
    }
  }

  /**
   * Ejecutar acción del menú
   */
  executeAction(action, label) {
    // Mapeo de acciones
    const actionMap = {
      // Máquina
      'machine.start': () => this.showNotification(`Iniciando máquina...`, 'info'),
      'machine.alarms': () => this.showNotification(`Abriendo alarmas...`, 'info'),
      'machine.info': () => this.showNotification(`Mostrando información...`, 'info'),

      // Registros
      'records.products': () => this.showNotification(`Abriendo productos...`, 'info'),
      'records.recipes': () => this.showNotification(`Abriendo recetas...`, 'info'),
      'records.designs': () => this.showNotification(`Abriendo diseños...`, 'info'),
      'records.labels': () => this.showNotification(`Abriendo etiquetas...`, 'info'),
      'records.classification': () => this.showNotification(`Abriendo clasificación...`, 'info'),
      'records.printers': () => this.showNotification(`Abriendo impresoras...`, 'info'),
      'records.logs': () => this.showNotification(`Abriendo registros...`, 'info'),

      // Configuraciones
      'config.users': () => this.showNotification(`Abriendo usuarios...`, 'info'),
      'config.cutting': () => this.showNotification(`Abriendo configuración de corte...`, 'info'),
      'config.packaging': () => this.showNotification(`Abriendo embalaje...`, 'info'),
      'config.general': () => this.showNotification(`Abriendo configuración general...`, 'info'),
      'config.formats': () => this.showNotification(`Abriendo formatos...`, 'info'),
      'config.database': () => this.showNotification(`Abriendo base de datos...`, 'info'),

      // Integraciones
      'integration.csv': () => this.showNotification(`Abriendo CSV...`, 'info'),
      'integration.api': () => this.showNotification(`Abriendo API-RESP...`, 'info'),
      'integration.database': () => this.showNotification(`Abriendo Database...`, 'info'),
    };

    // Ejecutar acción si existe
    if (actionMap[action]) {
      actionMap[action]();
    } else {
      Utils.logger.warn(`Acción no mapeada: ${action}`);
      this.showNotification(`Acción no implementada: ${label}`, 'warning');
    }
  }

  /**
   * Reproducir efecto visual de click
   */
  playClickEffect(button) {
    // Agregar clase de animación
    button.classList.add('clicked');

    // Remover clase después de la animación
    setTimeout(() => {
      button.classList.remove('clicked');
    }, 200);
  }

  /**
   * Mostrar notificación
   */
  showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = Utils.dom.createElement('div', {
      class: `notification notification-${type}`,
      style: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '16px 24px',
        backgroundColor: this.getNotificationColor(type),
        color: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: '9999',
        animation: 'slideIn 300ms ease',
        maxWidth: '400px'
      }
    }, message);

    // Agregar al documento
    document.body.appendChild(notification);

    // Remover después de 3 segundos
    setTimeout(() => {
      notification.style.animation = 'fadeOut 300ms ease';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  /**
   * Obtener color de notificación
   */
  getNotificationColor(type) {
    const colors = {
      'info': '#1f5bff',
      'success': '#10b981',
      'warning': '#f59e0b',
      'error': '#ef4444'
    };
    return colors[type] || colors['info'];
  }

  /**
   * Agregar acción al historial
   */
  addToHistory(entry) {
    this.actionHistory.push(entry);

    // Limitar tamaño del historial
    if (this.actionHistory.length > this.maxHistorySize) {
      this.actionHistory.shift();
    }

    // Guardar en almacenamiento
    Utils.storage.set('menu_history', this.actionHistory);
  }

  /**
   * Obtener historial de acciones
   */
  getHistory() {
    return this.actionHistory;
  }

  /**
   * Limpiar historial
   */
  clearHistory() {
    this.actionHistory = [];
    Utils.storage.remove('menu_history');
    Utils.logger.info('Historial limpiado');
  }

  /**
   * Obtener estadísticas de uso
   */
  getStatistics() {
    const stats = {
      totalActions: this.actionHistory.length,
      uniqueActions: new Set(this.actionHistory.map(h => h.action)).size,
      lastAction: this.actionHistory[this.actionHistory.length - 1] || null,
      actionsByType: {}
    };

    // Contar acciones por tipo
    this.actionHistory.forEach(entry => {
      const type = entry.action.split('.')[0];
      stats.actionsByType[type] = (stats.actionsByType[type] || 0) + 1;
    });

    return stats;
  }
}

// Crear instancia global y inicializar cuando esté lista
const menuHandler = new MenuHandler();

// Escuchar evento de inicialización de la app
Utils.events.on('app:initialized', () => {
  menuHandler.init();
  Utils.logger.info('MenuHandler inicializado');
});

// Alternativa: inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!menuHandler.menuButtons) {
      menuHandler.init();
    }
  });
} else {
  if (!menuHandler.menuButtons) {
    menuHandler.init();
  }
}
