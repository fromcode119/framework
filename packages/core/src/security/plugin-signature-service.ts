import crypto from 'crypto';
import { EnvUtils } from '@core/utils/env-utils';

/**
 * Plugin Signature Service
 * Handles verification of code signatures for security and trust
 */
export class PluginSignatureService {
  /**
   * Verifies if a plugin's signature is valid using a public key
   * @param manifest - The plugin manifest data
   * @param signature - The signature to verify
   * @param publicKey - The public key of the publisher
   * @returns boolean
   */
  static verify(manifest: any, signature: string, publicKey: string): boolean {
    if (!signature || !publicKey) return false;

    try {
      // Create a copy without internal fields if any
      const { signature: _, ...dataToVerify } = manifest;
      
      // Canonicalize every object level. JSON.stringify's array replacer applies as an allowlist
      // at every level, so the previous root-key list silently omitted nested manifest fields.
      const data = this.canonicalize(dataToVerify);
      
      const verifier = crypto.createVerify('sha256');
      verifier.update(data);
      verifier.end();
      
      return verifier.verify(publicKey, signature, 'base64');
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Utility to check if we should enforce signatures
   * Usually true in production, false in development
   */
  static isEnforced(): boolean {
    return EnvUtils.isProduction() && EnvUtils.flag('ENFORCE_PLUGIN_SIGNATURES');
  }

  /** Sign a payload using HMAC-SHA256. */
  static sign(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private static canonicalize(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((entry) => this.canonicalize(entry)).join(',')}]`;

    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.canonicalize(record[key])}`);
    return `{${entries.join(',')}}`;
  }
}
