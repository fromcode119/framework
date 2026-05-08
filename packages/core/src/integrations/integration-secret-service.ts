import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export class IntegrationSecretService {
  private static readonly ENCRYPTED_PREFIX = 'enc:v1:';
  private static readonly DEFAULT_SAVED_SECRET_MASK = '__FROMCODE_SAVED_SECRET__';

  static getSavedSecretMask(): string {
    return String(process.env.INTEGRATION_SECRET_MASK || '').trim() || IntegrationSecretService.DEFAULT_SAVED_SECRET_MASK;
  }

  static isSavedSecretMask(value: unknown): boolean {
    return String(value || '') === IntegrationSecretService.getSavedSecretMask();
  }

  static isEncryptedValue(value: unknown): boolean {
    return String(value || '').startsWith(IntegrationSecretService.ENCRYPTED_PREFIX);
  }

  static encrypt(value: string): string {
    const normalizedValue = String(value || '');
    if (!normalizedValue) {
      return '';
    }

    const secret = IntegrationSecretService.readSecretKey();
    if (!secret) {
      throw new Error('Integration secret storage requires INTEGRATION_SECRET_KEY to be configured on the server.');
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', secret, iv);
    const encrypted = Buffer.concat([cipher.update(normalizedValue, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${IntegrationSecretService.ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  static decrypt(value: unknown): string {
    const normalizedValue = String(value || '');
    if (!normalizedValue) {
      return '';
    }

    if (!IntegrationSecretService.isEncryptedValue(normalizedValue)) {
      return normalizedValue;
    }

    const secret = IntegrationSecretService.readSecretKey();
    if (!secret) {
      throw new Error('Encrypted integration secrets require INTEGRATION_SECRET_KEY to be configured on the server.');
    }

    const payload = normalizedValue.slice(IntegrationSecretService.ENCRYPTED_PREFIX.length);
    const [ivBase64, tagBase64, encryptedBase64] = payload.split(':');
    if (!ivBase64 || !tagBase64 || !encryptedBase64) {
      throw new Error('Stored integration secret is malformed.');
    }

    const decipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(ivBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  static maskIfPresent(value: unknown): string {
    return String(value || '').trim() ? IntegrationSecretService.getSavedSecretMask() : '';
  }

  private static readSecretKey(): Buffer | null {
    const rawSecret = String(process.env.INTEGRATION_SECRET_KEY || '').trim();
    if (!rawSecret) {
      return null;
    }
    return createHash('sha256').update(rawSecret).digest();
  }
}