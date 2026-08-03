import { Enum } from '@fromcode119/reactor';

/** Health of a plugin as reported by its probe. Serialized as its `.value`. */
export class PluginHealthStatus extends Enum {
  static readonly OK = new PluginHealthStatus('ok');
  static readonly DEGRADED = new PluginHealthStatus('degraded');
  static readonly ERROR = new PluginHealthStatus('error');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire/plugin string to a member; defaults to OK. */
  static resolve(value: unknown): PluginHealthStatus {
    if (value instanceof PluginHealthStatus) return value;
    const found = PluginHealthStatus.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as PluginHealthStatus | undefined) ?? PluginHealthStatus.OK;
  }
}
