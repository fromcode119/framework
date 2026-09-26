import type { IPluginProtocolIdentity } from '@core/plugin/host/protocol/interfaces/plugin-protocol-identity.interface';

/**
 * The version of the messages between the api and a plugin process — checked when a process boots.
 *
 * Today an api only ever talks to processes it started from its own build, so the two always agree —
 * except when they do not: a dev stack whose plugin runtime is a baked build while the api runs the
 * current source loaded every plugin into a runtime that no longer matched, and the failures surfaced
 * as unrelated "cannot find module" errors. Once an api reattaches to processes a PREVIOUS release
 * started, it will meet mismatched runtimes by design. Either way the process is refused with the
 * reason, instead of being used and failing later on a message one side misreads.
 *
 * Bump VERSION whenever a message changes so that the other side would misread it.
 */
export class PluginHostProtocol {
  static readonly VERSION = 1;

  static identity(): IPluginProtocolIdentity {
    return { version: PluginHostProtocol.VERSION, node: process.version };
  }

  /** Why this api must not use a process that answered `identity`, or null when it can. */
  static refusal(identity: IPluginProtocolIdentity | null | undefined): string | null {
    if (!identity) return `its runtime predates the protocol handshake (this api speaks protocol ${PluginHostProtocol.VERSION})`;
    if (identity.version !== PluginHostProtocol.VERSION) return `its runtime speaks protocol ${identity.version}, this api speaks ${PluginHostProtocol.VERSION}`;
    return null;
  }
}
