import { Enum } from '@fromcode119/reactor';

/** How a plugin capability change is approved at boot. */
export class PluginApprovalMode extends Enum {
  static readonly AUTO_APPROVE = new PluginApprovalMode('auto-approve');
  static readonly HOLD = new PluginApprovalMode('hold');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to HOLD. */
  static resolve(value: unknown): PluginApprovalMode {
    if (value instanceof PluginApprovalMode) return value;
    const found = PluginApprovalMode.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as PluginApprovalMode | undefined) ?? PluginApprovalMode.HOLD;
  }
}
