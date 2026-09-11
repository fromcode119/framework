import { SecretService } from '@core/security/secret-service';

/**
 * Encryption at rest for a plugin's third-party credentials.
 *
 * A plugin storing somebody's GitHub token, API key or password faces exactly the problem the
 * framework already solved for integration credentials, and the build server had solved it again:
 * its own `BUILD_SERVER_SECRET_KEY`, its own cipher, its own refusal — and an operator who could not
 * act on that refusal, because the only way to satisfy it was an environment variable no admin
 * screen mentions.
 *
 * One key for credentials at rest, the framework's (`SECRET_KEY`), which every integration already
 * depends on. Note what is NOT reused: `JWT_SECRET`. Coupling those would mean a session-secret leak
 * also decrypts every stored credential, and rotating either breaks the other.
 */
export class SecretsContextProxy {
  static createSecretsProxy() {
    return {
      /**
       * Whether this installation can store credentials at all. A plugin asks BEFORE offering a
       * field that takes one, so the refusal arrives as a disabled input with a reason rather than
       * as an error after the operator has typed a token.
       */
      isConfigured(): boolean {
        return SecretService.isEncryptionAvailable();
      },

      /** Encrypts a value for storage. Throws when this installation has no key — never stores plaintext. */
      encrypt(value: string): string {
        return SecretService.encrypt(value);
      },

      decrypt(value: unknown): string {
        return SecretService.decrypt(value);
      },

      isEncrypted(value: unknown): boolean {
        return SecretService.isEncryptedValue(value);
      },
    };
  }
}
