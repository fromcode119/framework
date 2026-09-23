import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export class SecretService {
  private static readonly ENCRYPTED_PREFIX = 'enc:v1:';
  /**
   * The sentinel a masked secret is shown as, so a form can post a config back untouched.
   *
   * This carried the pre-rename product name long after everything else moved, because the comment
   * here claimed the value is PERSISTED and that renaming it needs a migration rewriting stored
   * rows. That was wrong. Every write path substitutes the stored value for the mask BEFORE storage
   * (`IntegrationStoredProviderService.resolveStoredConfig` and the plugin-settings context both
   * do), and a secret is written as `enc:v1:` ciphertext or as `''`. A sweep of all 1,681 text and
   * JSON columns on 2026-09-22 found zero rows holding it, in any spelling, and the admin blanks
   * secret fields on the way in so the mask never makes the return trip either.
   *
   * It only has to agree with itself inside one running process, and both the masking and the
   * recognising side call {@link SecretService.getSavedSecretMask} — so it is free to follow the
   * product's naming like every other `ATLANTIS_*` name in the tree.
   */
  private static readonly DEFAULT_SAVED_SECRET_MASK = '__ATLANTIS_SAVED_SECRET__';

  static getSavedSecretMask(): string {
    return String(process.env.INTEGRATION_SECRET_MASK || '').trim() || SecretService.DEFAULT_SAVED_SECRET_MASK;
  }

  static isSavedSecretMask(value: unknown): boolean {
    return String(value || '') === SecretService.getSavedSecretMask();
  }

  static isEncryptedValue(value: unknown): boolean {
    return String(value || '').startsWith(SecretService.ENCRYPTED_PREFIX);
  }

  /**
   * Whether a blob of text carries an encrypted value ANYWHERE inside it — a stored settings row
   * holds its secrets nested in JSON, so `isEncryptedValue` on the row's own value never sees them.
   * The marker stays private; callers ask this rather than repeating the literal.
   */
  static carriesEncryptedValue(text: unknown): boolean {
    return String(text ?? '').includes(SecretService.ENCRYPTED_PREFIX);
  }

  static encrypt(value: string): string {
    const normalizedValue = String(value || '');
    if (!normalizedValue) {
      return '';
    }

    const secret = SecretService.readSecretKey();
    if (!secret) {
      throw new Error('Secret storage requires SECRET_KEY (or INTEGRATION_SECRET_KEY) to be configured on the server.');
    }
    return SecretService.sealWith(normalizedValue, secret);
  }

  /**
   * Encrypts under a passphrase given here rather than the deployment's own key.
   *
   * A secret is encrypted with the key of the deployment holding it, so it is unreadable anywhere
   * else — which is why credentials do not survive a move between deployments. Sealing under a
   * passphrase both sides know lets a secret TRAVEL while never existing in the clear at rest: the
   * archive carries ciphertext, the passphrase travels separately, and neither alone is enough.
   */
  static encryptWith(value: string, passphrase: string): string {
    const normalizedValue = String(value || '');
    if (!normalizedValue) return '';
    return SecretService.sealWith(normalizedValue, SecretService.deriveKey(passphrase));
  }

  static decrypt(value: unknown): string {
    const normalizedValue = String(value || '');
    if (!normalizedValue) {
      return '';
    }

    if (!SecretService.isEncryptedValue(normalizedValue)) {
      return normalizedValue;
    }

    const secret = SecretService.readSecretKey();
    if (!secret) {
      throw new Error('Decrypting stored secrets requires SECRET_KEY (or INTEGRATION_SECRET_KEY) to be configured on the server.');
    }
    return SecretService.openWith(normalizedValue, secret);
  }

  /** Decrypts a value sealed by {@link SecretService.encryptWith} under the same passphrase. */
  static decryptWith(value: unknown, passphrase: string): string {
    const normalizedValue = String(value || '');
    if (!normalizedValue) return '';
    if (!SecretService.isEncryptedValue(normalizedValue)) return normalizedValue;
    return SecretService.openWith(normalizedValue, SecretService.deriveKey(passphrase));
  }

  private static sealWith(value: string, key: Buffer): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${SecretService.ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private static openWith(value: string, key: Buffer): string {
    const payload = value.slice(SecretService.ENCRYPTED_PREFIX.length);
    const [ivBase64, tagBase64, encryptedBase64] = payload.split(':');
    if (!ivBase64 || !tagBase64 || !encryptedBase64) {
      throw new Error('Stored secret is malformed.');
    }
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  /** A passphrase becomes a key the same way the deployment's own secret does. */
  private static deriveKey(passphrase: string): Buffer {
    const normalized = String(passphrase || '').trim();
    if (!normalized) throw new Error('A transfer passphrase is required to seal or open a secret for transit.');
    return createHash('sha256').update(normalized).digest();
  }

  static maskIfPresent(value: unknown): string {
    return String(value || '').trim() ? SecretService.getSavedSecretMask() : '';
  }

  /**
   * Whether this installation can encrypt at all.
   *
   * Callers ask before offering a field that takes a credential: a refusal at save time, after the
   * operator has pasted a token, is a worse experience than a disabled field that says why.
   */
  static isEncryptionAvailable(): boolean {
    return SecretService.readSecretKey() !== null;
  }

  private static readSecretKey(): Buffer | null {
    // SECRET_KEY is the preferred env var; INTEGRATION_SECRET_KEY kept for backward compatibility
    const rawSecret = (String(process.env.SECRET_KEY || '').trim() || String(process.env.INTEGRATION_SECRET_KEY || '').trim());
    if (!rawSecret) {
      return null;
    }
    return createHash('sha256').update(rawSecret).digest();
  }
}
