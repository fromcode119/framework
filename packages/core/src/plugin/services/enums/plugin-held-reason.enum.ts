import { Enum } from '@fromcode119/reactor';

/**
 * Machine-readable reason a plugin is HELD (inactive + WARNING) — i.e. why it isn't running, so the
 * operator sees a real cause instead of what looks like a deliberate disable.
 */
export class PluginHeldReason extends Enum {
  /** The manifest's capabilities differ from the approved set; an admin must re-approve. */
  static readonly CAPABILITY_DRIFT = new PluginHeldReason('capability_drift');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a persisted/raw value to a member, or `undefined` when the plugin is not held. */
  static resolve(value: unknown): PluginHeldReason | undefined {
    if (value instanceof PluginHeldReason) return value;
    return PluginHeldReason.fromValue(String(value ?? '').trim().toLowerCase()) as PluginHeldReason | undefined;
  }
}
