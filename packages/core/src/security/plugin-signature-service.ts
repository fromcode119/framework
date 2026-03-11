import crypto from 'crypto';

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
      
      // Canonicalize data (stable key ordering)
      const data = JSON.stringify(dataToVerify, Object.keys(dataToVerify).sort());
      
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
    return process.env.NODE_ENV === 'production' && process.env.ENFORCE_PLUGIN_SIGNATURES === 'true';
  }

  /** Sign a payload using HMAC-SHA256. */
  static sign(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }
}