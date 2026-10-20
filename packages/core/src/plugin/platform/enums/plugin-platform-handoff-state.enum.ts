import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Where a used `context.platform` ticket stands (`_system_plugin_platform_handoffs.state`).
 *
 * A NOT NULL state rather than a nullable `completed_at`: on the raw system-table path a null in a
 * WHERE becomes `= NULL`, which matches nothing (see SitePreviewGrantState).
 */
export class PluginPlatformHandoffState extends Enum {
  /** The platform part handed a claim over; the console has not finished it yet. */
  static readonly PENDING = new PluginPlatformHandoffState('pending');
  /** The console opened the handoff — finished or refused, it cannot be opened again. */
  static readonly SPENT = new PluginPlatformHandoffState('spent');
  /** The platform part gave up (the operator cancelled, nothing to connect): the ticket is used, nothing waits. */
  static readonly ABANDONED = new PluginPlatformHandoffState('abandoned');

  private constructor(value: string) {
    super(value);
  }
}
