/**
 * Encryption at rest for a plugin's third-party credentials, on the installation's own key.
 *
 * A plugin that stores somebody's token must never store it in plaintext and must never invent its
 * own key to avoid that — a per-plugin key is a per-plugin rotation, a per-plugin way to lose data,
 * and a refusal the operator cannot act on.
 *
 * A value is sealed for the plugin that encrypted it, and only that plugin's `decrypt` opens it. Every
 * method answers a Promise, in process and isolated alike.
 */
export interface IPluginContextSecrets {
  /**
   * Whether this installation can store credentials at all.
   *
   * Ask BEFORE offering a field that takes one: a refusal after the operator has pasted a token is
   * a worse experience than a disabled field that explains itself.
   */
  isConfigured(): Promise<boolean>;

  /** Encrypts for storage. Throws when no key is configured — it never falls back to plaintext. */
  encrypt(value: string): Promise<string>;

  decrypt(value: unknown): Promise<string>;

  isEncrypted(value: unknown): Promise<boolean>;
}
