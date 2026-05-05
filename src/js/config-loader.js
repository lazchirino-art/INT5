/**
 * Config Loader - Load saved configuration from backend
 * 
 * Loads saved configuration from backend API
 * and renders it in the form
 */

class ConfigLoader {
  /**
   * Load saved configuration and render Network Path form
   */
  static async loadAndRenderNetworkConfig() {
    try {
      const appConfig = await this.loadPersistedConfiguration();

      if (!appConfig?.connection) {
        console.log('[ConfigLoader] No saved configuration found');
        return false;
      }

      const config = appConfig.connection;

      // Verify it's Network Path
      if (config.connectorType !== 'networkPath') {
        console.log('[ConfigLoader] Saved configuration is not Network Path');
        return false;
      }

      // Validate stored config
      if (!CredentialCrypto.isValidStoredConfig(config)) {
        console.log('[ConfigLoader] Stored configuration is invalid');
        return false;
      }

      // Decrypt credentials
      const runtimeConfig = await CredentialCrypto.prepareConnectionConfigForRuntime(config);

      // Populate form fields
      console.log('[ConfigLoader] Populating Network Path form...');
      document.getElementById('networkPath').value = runtimeConfig.path || '';
      document.getElementById('networkFileNamePattern').value = runtimeConfig.fileNamePattern || '';
      
      // Set authentication checkbox and fields
      const useAuth = runtimeConfig.useAuthentication || false;
      document.getElementById('useNetworkAuthentication').checked = useAuth;
      document.getElementById('networkUsername').value = runtimeConfig.username || '';
      document.getElementById('networkPassword').value = runtimeConfig.password || '';
      
      // Set domain checkbox and field
      const useDomain = runtimeConfig.useDomain || false;
      document.getElementById('useNetworkDomain').checked = useDomain;
      document.getElementById('networkDomain').value = runtimeConfig.domain || '';

      // Execute UI logic to update disabled states
      console.log('[ConfigLoader] Executing UI toggle functions...');
      toggleAuthenticationFields();
      toggleOptionalField('useNetworkDomain', 'networkDomain');

      console.log('[ConfigLoader] Network Path configuration loaded successfully');
      
      // Also load Parser configuration if available
      const parserLoaded = await ParserUI.loadAndRenderParserConfig();
      if (parserLoaded) {
        console.log('[ConfigLoader] Parser configuration also loaded');
      }
      
      return true;

    } catch (error) {
      console.error('[ConfigLoader] Error loading Network Path configuration:', error);
      return false;
    }
  }

  /**
   * Load persisted configuration from backend API
   */
  static async loadPersistedConfiguration() {
    try {
      // Try to load from backend API first
      console.log('[ConfigLoader] Attempting to load from backend API...');
      const response = await fetch('/api/config/load');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'SUCCESS' && data.config) {
        console.log('[ConfigLoader] Configuration loaded from backend API');
        return data.config;
      }
      
      if (data.status === 'NOT_FOUND') {
        console.log('[ConfigLoader] No configuration found in backend');
        return null;
      }
      
      throw new Error('Unexpected API response');
    } catch (error) {
      console.error('[ConfigLoader] Error loading from backend API:', error);
      
      // Fallback: Try to load from AppConfigStore if available
      try {
        if (window.AppConfigStore?.loadConfig) {
          console.log('[ConfigLoader] Falling back to AppConfigStore');
          return window.AppConfigStore.loadConfig();
        }
      } catch (appStoreError) {
        console.error('[ConfigLoader] AppConfigStore error:', appStoreError);
      }
      
      // Final fallback: Try localStorage (for backwards compatibility)
      try {
        const storedConfig = localStorage.getItem('menuCsvInt.connectionConfig');
        if (storedConfig) {
          console.log('[ConfigLoader] Loading from localStorage (fallback)');
          return JSON.parse(storedConfig);
        }
      } catch (localStorageError) {
        console.error('[ConfigLoader] localStorage error:', localStorageError);
      }
      
      console.log('[ConfigLoader] No persisted configuration found in any storage');
      return null;
    }
  }

  /**
   * Clear saved configuration from backend
   */
  static async clearSavedConfiguration() {
    try {
      // Clear from backend API
      console.log('[ConfigLoader] Clearing configuration from backend...');
      const response = await fetch('/api/config/clear', { method: 'DELETE' });
      
      if (response.ok) {
        console.log('[ConfigLoader] Configuration cleared from backend');
      } else {
        console.warn('[ConfigLoader] Failed to clear from backend:', response.status);
      }
    } catch (error) {
      console.error('[ConfigLoader] Error clearing from backend:', error);
    }
    
    // Also clear from AppConfigStore if available
    try {
      if (window.AppConfigStore?.clearConfig) {
        console.log('[ConfigLoader] Clearing AppConfigStore');
        window.AppConfigStore.clearConfig();
      }
    } catch (error) {
      console.error('[ConfigLoader] Error clearing AppConfigStore:', error);
    }
    
    // Also clear from localStorage for backwards compatibility
    try {
      console.log('[ConfigLoader] Clearing localStorage');
      localStorage.removeItem('menuCsvInt.connectionConfig');
    } catch (error) {
      console.error('[ConfigLoader] Error clearing localStorage:', error);
    }
  }

  /**
   * Check if saved configuration exists and is valid
   */
  static async hasSavedConfiguration() {
    try {
      // Check if CredentialCrypto is available
      if (typeof CredentialCrypto === 'undefined') {
        console.log('[ConfigLoader] CredentialCrypto not available yet');
        return false;
      }

      const config = await this.loadPersistedConfiguration();
      
      if (!config || !config.connection) {
        console.log('[ConfigLoader] No saved configuration exists');
        return false;
      }

      const isValid = CredentialCrypto.isValidStoredConfig(config.connection);
      console.log(`[ConfigLoader] Configuration exists and is ${isValid ? 'valid' : 'invalid'}`);
      
      return isValid;
    } catch (error) {
      console.error('[ConfigLoader] Error checking configuration:', error);
      return false;
    }
  }
}

/**
 * Wait for CredentialCrypto to be available
 */
function waitForCredentialCrypto() {
  return new Promise((resolve) => {
    if (typeof CredentialCrypto !== 'undefined') {
      console.log('[ConfigLoader] CredentialCrypto is available');
      resolve();
      return;
    }

    console.log('[ConfigLoader] Waiting for CredentialCrypto...');
    const checkInterval = setInterval(() => {
      if (typeof CredentialCrypto !== 'undefined') {
        console.log('[ConfigLoader] CredentialCrypto is now available');
        clearInterval(checkInterval);
        resolve();
      }
    }, 50);

    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      console.warn('[ConfigLoader] Timeout waiting for CredentialCrypto');
      resolve();
    }, 5000);
  });
}

/**
 * Load configuration when page loads
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[ConfigLoader] DOMContentLoaded event fired');

  // Wait for CredentialCrypto to be available
  await waitForCredentialCrypto();

  if (typeof CredentialCrypto === 'undefined') {
    console.error('[ConfigLoader] CredentialCrypto is not available after waiting');
    return;
  }

  try {
    // Check if saved configuration exists
    const hasSaved = await ConfigLoader.hasSavedConfiguration();
    
    if (hasSaved) {
      console.log('[ConfigLoader] Found saved configuration, loading from backend...');
      
      // Set connection type to Network Path
      const connectionType = document.getElementById('connectionType');
      if (connectionType) {
        connectionType.value = 'networkPath';
        
        // Trigger change event to show Network Path fields
        connectionType.dispatchEvent(new Event('change'));
      }
      
      // Load and render the configuration
      // Use setTimeout to ensure UI is ready
      setTimeout(async () => {
        const loaded = await ConfigLoader.loadAndRenderNetworkConfig();
        if (loaded) {
          console.log('[ConfigLoader] Configuration loaded and rendered successfully from backend');
        } else {
          console.warn('[ConfigLoader] Failed to load configuration from backend');
        }
      }, 100);
    } else {
      console.log('[ConfigLoader] No saved configuration to load');
    }
  } catch (error) {
    console.error('[ConfigLoader] Error during configuration load:', error);
  }
});

// Export for global use
if (typeof window !== 'undefined') {
  window.ConfigLoader = ConfigLoader;
  
  // Expose saveToBackend method for external use
  window.saveConfigToBackend = async function(config) {
    try {
      console.log('[ConfigLoader] Saving configuration to backend...');
      const response = await fetch('/api/config/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[ConfigLoader] Configuration saved to backend successfully');
      return data;
    } catch (error) {
      console.error('[ConfigLoader] Error saving to backend:', error);
      throw error;
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigLoader;
}
