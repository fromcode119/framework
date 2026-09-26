import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * WHY the host is calling into the guest.
 *
 * The kind is not decoration: it is what the invocation token is minted for, and it decides the
 * deadline — a `LIFECYCLE` call gets the boot timeout because `onInit` legitimately takes seconds,
 * while everything else gets the plugin's per-request one. Mislabel a call and it is either killed
 * early or allowed to hang the boot.
 *
 * Carried as a VALUE on the wire (`IPluginInvocation.kind`): the message crosses a process boundary
 * and an Enum instance does not survive serialisation.
 */
export class PluginInvocationKind extends Enum {
  /** onInstall | onInit | onUpdate | onEnable | onDisable | onUninstall — `name` says which. */
  static readonly LIFECYCLE = new PluginInvocationKind('lifecycle');
  static readonly HOOK = new PluginInvocationKind('hook');
  static readonly SCHEDULER = new PluginInvocationKind('scheduler');
  static readonly JOB = new PluginInvocationKind('job');
  static readonly MCP_TOOL = new PluginInvocationKind('mcp-tool');
  static readonly GATE = new PluginInvocationKind('gate');
  static readonly CANONICAL_PATH = new PluginInvocationKind('canonical-path');
  /** One of the functions this plugin publishes to its peers; `name` is the function. */
  static readonly PUBLIC_API = new PluginInvocationKind('public-api');
  /** A function the guest handed out inside a payload, called by whoever received it. */
  static readonly CALLBACK = new PluginInvocationKind('callback');

  private constructor(value: string) {
    super(value);
  }
}
