/**
 * A peer plugin's public API did not resolve — so there was nothing to call, and nothing went wrong.
 *
 * This is NOT the same event as "the peer's method threw", and the difference decides whether an
 * operator is shown a warning. A peer is legitimately unresolvable at several ordinary moments: it
 * has not reached ACTIVE yet in the boot order, it is not enabled on the site this call is running
 * for, or it was disabled or replaced between the guest being told about it and the call arriving.
 * Every one of those means "not now, ask again later" — which is exactly what the registration
 * helpers already do when they can see a falsy peer.
 *
 * An isolated guest could not see any of that. Both outcomes arrived as one rejected call carrying
 * `cannot read "<method>" of null`, so a peer that simply was not there for this call was reported
 * as a FAILED registration. A false failure on that line is worse than noise: it is the line a real
 * failure would appear on.
 *
 * The code is what travels — `PluginChannel.describe/revive` already carries `code` across the
 * process boundary, the same way `unknown_invocation` does. Nothing anywhere matches the message
 * text: the host decides from the SHAPE of the call being walked, and the guest side compares this
 * code. A message is prose and will be reworded; a code is a contract.
 */
export class PluginPeerUnavailableError extends Error {
  static readonly CODE = 'peer_unavailable';

  readonly code = PluginPeerUnavailableError.CODE;

  constructor(readonly peer: string) {
    super(`peer "${peer}" is not resolvable for this call`);
    this.name = 'PluginPeerUnavailableError';
  }

  /**
   * Is this the "peer was not there" rejection?
   *
   * Compares the declared code and nothing else, so it works on the guest side where the error has
   * been revived as a plain `Error` and `instanceof` cannot hold.
   */
  static is(error: unknown): boolean {
    return (error as { code?: unknown } | null)?.code === PluginPeerUnavailableError.CODE;
  }
}
