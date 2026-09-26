import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * WHICH object a guest's remote call is walked against.
 *
 * Three roots with three different reaches, which is the whole point of naming them: `CONTEXT` is the
 * plugin's own tenant-bound surface, `CORE` is the framework's, and `DDL` is the schema-owner
 * connection that runs migrations. A call routed to the wrong root is a privilege question, not a
 * typo — `DDL` can alter tables that `CONTEXT` cannot even read across sites.
 *
 * Carried as a VALUE on the wire (`IPluginRemoteCall.root`).
 */
export class PluginRemoteCallRoot extends Enum {
  /** The plugin's own `context` — tenant-bound, capability-gated. */
  static readonly CONTEXT = new PluginRemoteCallRoot('context');

  /** Framework surface the guest is allowed to reach directly. */
  static readonly CORE = new PluginRemoteCallRoot('core');

  /** The schema-owner connection: migrations and collection sync. */
  static readonly DDL = new PluginRemoteCallRoot('ddl');

  private constructor(value: string) {
    super(value);
  }
}
