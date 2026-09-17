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

      // Mostrar los campos de Network Path
      const connectionType = document.getElementById('connectionType');
      if (connectionType && config.connectorType === 'networkPath') {
        connectionType.value = 'networkPath';
        handleConnectionTypeChange();
      }

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

      // Decrypt credentials — if decryption fails (e.g. key mismatch), still load
      // the non-sensitive fields and leave the password empty so the user can re-enter it.
      let runtimeConfig;
      try {
        runtimeConfig = await CredentialCrypto.prepareConnectionConfigForRuntime(config);
      } catch (decryptErr) {
        console.warn('[ConfigLoader] Could not decrypt password, loading without it:', decryptErr.message);
        runtimeConfig = { ...config, password: '', privateKey: '', passphrase: '' };
      }

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
      
      console.log('[ConfigLoader] No persisted configuration found in any storage');
      return null;
    }
  }

}

// Export for global use
window.ConfigLoader = ConfigLoader;
