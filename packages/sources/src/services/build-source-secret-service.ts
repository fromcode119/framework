import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Logger } from '@fromcode119/core';

/**
 * Encrypts a source's git token at rest.
 *
 * The key is the FRAMEWORK's (`context.secrets`, backed by `SECRET_KEY`) — the same one protecting
 * every integration credential on the installation. This class used to demand a
 * `BUILD_SERVER_SECRET_KEY` of its own and refuse to save without it, which was right about
 * plaintext and wrong about everything else: the refusal named an environment variable no admin
 * screen mentions, so the operator was told "no" with no way to say "yes". A per-plugin key is also
 * a per-plugin rotation and a per-plugin way to lose data.
 *
 * `BUILD_SERVER_SECRET_KEY` is still honoured when set, because tokens encrypted under it must stay
 * readable; nothing new is written under it.
 */
export class BuildSourceSecretService {
  private static readonly algorithm = 'aes-256-gcm';
  private static readonly prefix = 'enc:v1:';
  private readonly logger = new Logger({ namespace: 'BuildSourceSecretService' });

  /** The framework's secrets surface, supplied by the plugin context at wiring time. */
  constructor(private readonly secrets?: { isConfigured(): boolean; encrypt(value: string): string; decrypt(value: unknown): string }) {}

  /** Whether this installation can store a token at all — asked before a token field is offered. */
  canStoreSecrets(): boolean {
    return Boolean(this.secrets?.isConfigured()) || Boolean(this.resolveKey());
  }

  decrypt(secret: string | null | undefined): string {
    if (!secret) {
      return '';
    }

    if (!this.isEncrypted(secret)) {
      return secret;
    }

    // A value the framework wrote is read back by the framework; the branch below reads the ones
    // this plugin wrote under its own key, which must keep working.
    if (!this.resolveKey() && this.secrets?.isConfigured()) {
      return this.secrets.decrypt(secret);
    }

    const key = this.resolveKey();
    if (!key) {
      throw new Error('Cannot decrypt build source token because no encryption key is configured.');
    }

    const payload = secret.slice(BuildSourceSecretService.prefix.length);
    const [ivValue, authTagValue, cipherValue] = payload.split(':');
    if (!ivValue || !authTagValue || !cipherValue) {
      throw new Error('Stored build source token is malformed.');
    }

    const decipher = createDecipheriv(
      BuildSourceSecretService.algorithm,
      this.createKeyMaterial(key),
      Buffer.from(ivValue, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherValue, 'base64url')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  encrypt(secret: string | null | undefined): string {
    const trimmedSecret = this.normalizeSecret(secret);
    if (!trimmedSecret) {
      return '';
    }

    if (this.isEncrypted(trimmedSecret)) {
      return trimmedSecret;
    }

    // The framework's key first; the plugin's own only when an operator set one before this changed.
    if (this.secrets?.isConfigured()) {
      return this.secrets.encrypt(trimmedSecret);
    }

    const key = this.resolveKey();
    if (!key) {
      throw new Error(
        'This installation cannot store credentials: no SECRET_KEY is configured, so the token would have to be saved in plaintext. Add a source without a token, or set SECRET_KEY and restart.',
      );
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv(
      BuildSourceSecretService.algorithm,
      this.createKeyMaterial(key),
      iv
    );
    const encrypted = Buffer.concat([cipher.update(trimmedSecret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${BuildSourceSecretService.prefix}${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
  }

  isEncrypted(secret: string | null | undefined): boolean {
    return Boolean(secret && secret.startsWith(BuildSourceSecretService.prefix));
  }

  private createKeyMaterial(key: string): Buffer {
    return createHash('sha256').update(key).digest();
  }

  private normalizeSecret(secret: string | null | undefined): string {
    return typeof secret === 'string' ? secret.trim() : '';
  }

  /**
   * The plugin's OWN legacy key, read only so tokens saved before the move stay readable.
   *
   * Still intentionally not `JWT_SECRET`: coupling those means a session-secret leak also decrypts
   * every stored token, and rotating either breaks the other. `SECRET_KEY` is different — it exists
   * for credentials at rest and already carries every integration's.
   */
  private resolveKey(): string {
    return (process.env.BUILD_SERVER_SECRET_KEY || '').trim();
  }
}
