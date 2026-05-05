/**
 * Credential Crypto - Backend Implementation
 * Decrypt credentials encrypted by the frontend
 * Uses crypto.subtle for compatibility with frontend encryption
 */

import crypto from 'crypto';
import { webcrypto } from 'crypto';

class CredentialCrypto {
  constructor(encryptionSecret) {
    if (!encryptionSecret) {
      throw new Error('ENCRYPTION_SECRET is not configured');
    }
    this.encryptionSecret = encryptionSecret;
  }

  /**
   * Decrypt a value encrypted by the frontend
   */
  async decrypt(encryptedValue) {
    if (!encryptedValue || typeof encryptedValue !== 'string') {
      return encryptedValue;
    }

    if (!encryptedValue.startsWith('enc:v1:aes-gcm:')) {
      // Not encrypted, return as-is
      return encryptedValue;
    }

    try {
      const parts = encryptedValue.split(':');
      
      if (parts.length !== 5) {
        throw new Error('Invalid encrypted format');
      }

      // Decode IV and encrypted data from base64
      const iv = this.base64ToBytes(parts[3]);
      const encryptedData = this.base64ToBytes(parts[4]);

      // Derive key from secret (same as frontend)
      const key = await this.getCryptoKey();

      // Decrypt using crypto.subtle (same as frontend)
      const decrypted = await webcrypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('[CredentialCrypto] Decryption error:', error.message);
      throw new Error(`Failed to decrypt credential: ${error.message}`);
    }
  }

  /**
   * Decrypt all sensitive fields in a config object
   */
  async decryptConfig(config, sensitiveFields) {
    const decrypted = { ...config };

    for (const field of sensitiveFields) {
      if (decrypted[field]) {
        try {
          decrypted[field] = await this.decrypt(decrypted[field]);
        } catch (error) {
          console.error(`[CredentialCrypto] Failed to decrypt ${field}:`, error.message);
          throw error;
        }
      }
    }

    return decrypted;
  }

  /**
   * Get crypto key from secret (same as frontend)
   */
  async getCryptoKey() {
    const secret = this.encryptionSecret;

    if (!secret) {
      throw new Error('Encryption secret is not configured');
    }

    // Encode secret as UTF-8
    const secretBytes = new TextEncoder().encode(secret);

    // Hash with SHA-256 (same as frontend)
    const keyMaterial = await webcrypto.subtle.digest('SHA-256', secretBytes);

    // Import as AES key
    return webcrypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
  }

  /**
   * Convert base64 string to Uint8Array
   */
  base64ToBytes(base64) {
    const binary = Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }
}

export default CredentialCrypto;
