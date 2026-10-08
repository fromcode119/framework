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
 *
 * Each value is sealed for the plugin that encrypted it: `decrypt` opens only that plugin's own
 * values. The key is shared, what it opens is not — a plugin cannot read a credential some other part
 * of the platform stored.
 *
 * Every method answers a Promise. An isolated plugin reaches these through its process boundary,
 * where nothing can answer synchronously; the in-process context answers the same way, so a plugin's
 * code is the same in both.
 */
export class SecretsContextProxy {
  private static readonly SEAL = 'fcp-secret:v1';

  static createSecretsProxy(pluginSlug: string) {
    const seal = `${SecretsContextProxy.SEAL}:${pluginSlug}:`;
    return {
      /**
       * Whether this installation can store credentials at all. A plugin asks BEFORE offering a
       * field that takes one, so the refusal arrives as a disabled input with a reason rather than
       * as an error after the operator has typed a token.
       */
      async isConfigured(): Promise<boolean> {
        return SecretService.isEncryptionAvailable();
      },

      /** Encrypts a value for storage. Throws when this installation has no key — never stores plaintext. */
      async encrypt(value: string): Promise<string> {
        return SecretService.encrypt(`${seal}${String(value ?? '')}`);
      },

      /** Opens a value this plugin encrypted; refuses anything else. Nothing stored opens to nothing. */
      async decrypt(value: unknown): Promise<string> {
        if (value === null || value === undefined || value === '') return '';
        const opened = SecretService.decrypt(value);
        if (!opened.startsWith(seal)) throw new Error(`This value was not encrypted by the plugin "${pluginSlug}", so it does not open it.`);
        return opened.slice(seal.length);
      },

      async isEncrypted(value: unknown): Promise<boolean> {
        return SecretService.isEncryptedValue(value);
      },
    };
  }
}
