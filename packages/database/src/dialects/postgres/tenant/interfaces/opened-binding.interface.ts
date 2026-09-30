/** What the api knows about one physical connection's binding (see TenantBindingSql / PostgresTenantSession). */
export interface IOpenedBinding {
  /** Issued by `fc_binding_open`; resolves once the connection has opened. */
  nonce: Promise<string>;
  /** The last counter the database accepted; the next bind signs `counter + 1`. */
  counter: number;
}
