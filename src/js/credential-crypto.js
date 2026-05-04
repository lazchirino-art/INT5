(function () {
    const encryptedPrefix = 'enc:v1:aes-gcm';
    const sensitiveFieldsByConnector = {
        networkPath: ['password'],
        sftp: ['password', 'privateKey', 'passphrase']
    };

    async function encrypt(value) {
        if (value === undefined || value === null || value === '') {
            return value;
        }

        const key = await getCryptoKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedValue = new TextEncoder().encode(String(value));
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encodedValue);

        return `${encryptedPrefix}:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
    }

    async function decrypt(value) {
        if (value === undefined || value === null || value === '') {
            return value;
        }

        if (typeof value !== 'string' || !value.startsWith(`${encryptedPrefix}:`)) {
            throw new Error('Invalid encrypted credential');
        }

        const parts = value.split(':');

        if (parts.length !== 5) {
            throw new Error('Invalid encrypted credential');
        }

        try {
            const key = await getCryptoKey();
            const iv = base64ToBytes(parts[3]);
            const encrypted = base64ToBytes(parts[4]);
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);

            return new TextDecoder().decode(decrypted);
        } catch {
            throw new Error('Invalid encrypted credential');
        }
    }

    async function prepareConnectionConfigForStorage(config) {
        const storedConfig = cloneConfig(config);
        const sensitiveFields = getSensitiveFields(storedConfig.connectorType);

        for (const fieldName of sensitiveFields) {
            if (storedConfig[fieldName]) {
                storedConfig[fieldName] = await encrypt(storedConfig[fieldName]);
            }
        }

        return storedConfig;
    }

    async function prepareConnectionConfigForRuntime(storedConfig) {
        const runtimeConfig = cloneConfig(storedConfig);
        const sensitiveFields = getSensitiveFields(runtimeConfig.connectorType);

        try {
            for (const fieldName of sensitiveFields) {
                if (runtimeConfig[fieldName]) {
                    runtimeConfig[fieldName] = await decrypt(runtimeConfig[fieldName]);
                }
            }
        } catch (error) {
            throw new Error(`Invalid ${runtimeConfig.connectorType} configuration: ${error.message}`);
        }

        return runtimeConfig;
    }

    function getSensitiveFields(connectorType) {
        const sensitiveFields = sensitiveFieldsByConnector[connectorType];

        if (!sensitiveFields) {
            throw new Error(`Unsupported connector type: ${connectorType}`);
        }

        return sensitiveFields;
    }

    async function getCryptoKey() {
        const secret = window.CSV_INT_LOCAL_SECRET;

        if (!secret || secret === 'replace-this-with-a-stable-random-installer-secret') {
            throw new Error('Local encryption secret is not configured');
        }

        const secretBytes = new TextEncoder().encode(secret);
        const keyMaterial = await crypto.subtle.digest('SHA-256', secretBytes);

        return crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }

    function cloneConfig(config) {
        return JSON.parse(JSON.stringify(config));
    }

    function bytesToBase64(bytes) {
        let binary = '';
        bytes.forEach(byte => {
            binary += String.fromCharCode(byte);
        });

        return btoa(binary);
    }

    function base64ToBytes(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }

        return bytes;
    }

    function isValidStoredConfig(config) {
        if (!config || typeof config !== 'object') {
            return false;
        }

        if (!config.connectorType) {
            return false;
        }

        if (config.connectorType === 'networkPath') {
            return config.path && config.fileNamePattern;
        }

        return false;
    }

    window.CredentialCrypto = {
        encrypt,
        decrypt,
        prepareConnectionConfigForStorage,
        prepareConnectionConfigForRuntime,
        isValidStoredConfig
    };
})();
