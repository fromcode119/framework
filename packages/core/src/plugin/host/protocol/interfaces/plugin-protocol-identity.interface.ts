/** What a plugin process says it speaks, in its answer to `boot`. */
export interface IPluginProtocolIdentity {
  /** `PluginHostProtocol.VERSION` of the runtime that started the process. */
  version: number;
  /** The Node version it runs on — the wire is `v8.serialize`, whose format belongs to Node. */
  node: string;
  /**
   * Optional answers the process can read, beyond what VERSION promises (`PluginHostProtocol.ACCEPTS`).
   * An api offers one only to a process that lists it: a process an api took over from an older
   * release lists none, and is answered as before — no version bump, no restart.
   */
  accepts?: string[];
}
