/**
 * The `context.signing` surface of {@link PluginContext}: HMAC signatures for the links a plugin
 * mails or hands out (an unsubscribe link, a "manage your booking" link), on the install's own key.
 *
 * The key never reaches the plugin. An isolated plugin runs with an empty environment and cannot
 * decrypt the signing root, so deriving the key inside the plugin failed in exactly the place a
 * signed link matters; and a plugin that can derive keys can derive ANY purpose's key, including the
 * framework's own. Here the host derives the key, signs or verifies, and returns only the result.
 *
 * `name` is scoped to the calling plugin: `sign('unsubscribe', …)` from a plugin with the slug `alpha`
 * signs under the purpose `alpha.unsubscribe`. A plugin can therefore neither mint nor check another plugin's
 * (or the framework's) tokens.
 */
export interface IPluginContextSigning {
  /** Hex HMAC-SHA256 of `message` under this plugin's `name` key. Throws when no key can be resolved. */
  sign(name: string, message: string): Promise<string>;

  /** Constant-time check of a signature made by {@link sign}. False — never a throw — for a mismatch. */
  verify(name: string, message: string, signature: string): Promise<boolean>;
}
