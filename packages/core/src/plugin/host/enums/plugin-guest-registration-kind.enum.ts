import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * WHAT the guest registered that the host must forward back to it.
 *
 * These are the places where a FUNCTION crosses the process boundary: the guest keeps the function
 * under a handler id and the host puts a forwarding stand-in on the real context. Getting the kind
 * wrong does not fail loudly — the host would register the wrong kind of stand-in, and the plugin's
 * route, hook or scheduled job would simply never run.
 *
 * Carried as a VALUE on the wire (`IPluginGuestRegistration.kind`): the message is serialised between
 * two processes, and an Enum instance does not survive that. The enum is where the list lives, so a
 * producer cannot invent a kind the host has never heard of without failing to compile.
 */
export class PluginGuestRegistrationKind extends Enum {
  /** An HTTP route, forwarded to the guest's own socket by path — the only kind with no handler id. */
  static readonly ROUTE = new PluginGuestRegistrationKind('route');
  static readonly USE = new PluginGuestRegistrationKind('use');
  static readonly MIDDLEWARE = new PluginGuestRegistrationKind('middleware');
  static readonly HOOK = new PluginGuestRegistrationKind('hook');
  static readonly HOOK_OFF = new PluginGuestRegistrationKind('hook-off');
  /** `context.plugins.on(event)` — the platform bus (`plugins:ready`), NOT the tenant-gated hooks. */
  static readonly PLUGINS_ON = new PluginGuestRegistrationKind('plugins-on');
  static readonly SCHEDULER = new PluginGuestRegistrationKind('scheduler');
  static readonly TENANTS_FOR_EACH = new PluginGuestRegistrationKind('tenants-for-each');
  static readonly JOB_WORKER = new PluginGuestRegistrationKind('job-worker');
  static readonly MCP_TOOLS = new PluginGuestRegistrationKind('mcp-tools');
  static readonly GATE = new PluginGuestRegistrationKind('gate');
  static readonly CANONICAL_PATH = new PluginGuestRegistrationKind('canonical-path');

  private constructor(value: string) {
    super(value);
  }
}
