/** What a plugin process says it speaks, in its answer to `boot`. */
export interface IPluginProtocolIdentity {
  /** `PluginHostProtocol.VERSION` of the runtime that started the process. */
  version: number;
  /** The Node version it runs on — the wire is `v8.serialize`, whose format belongs to Node. */
  node: string;
}
