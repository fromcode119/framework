/**
 * A guest called back with a token the host does not hold — revoked, foreign or invented.
 *
 * The ordinary way to get here is work that outlived its invocation: a promise a plugin started inside
 * a hook or `onInit` and did not return, still running after the host revoked the token. The host
 * refuses the call, which is correct, and the guest sees one rejected promise.
 *
 * The code is what travels, as with `PluginPeerUnavailableError`: `PluginChannel.describe/revive`
 * carries `code` across the process boundary, and the guest side compares it with `is()` — never the
 * message text, which is prose and will be reworded.
 */
export class PluginUnknownInvocationError extends Error {
  static readonly CODE = 'unknown_invocation';

  readonly code = PluginUnknownInvocationError.CODE;

  constructor(readonly plugin: string) {
    super(`unknown_invocation: plugin "${plugin}" presented a token the host did not mint`);
    this.name = 'PluginUnknownInvocationError';
  }

  /** Compares the declared code only, so it holds on a revived plain `Error` where `instanceof` cannot. */
  static is(error: unknown): boolean {
    return (error as { code?: unknown } | null)?.code === PluginUnknownInvocationError.CODE;
  }
}
