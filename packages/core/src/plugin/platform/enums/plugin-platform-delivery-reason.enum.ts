import { Enum } from '@fromcode119/react-class-components/lang';

/** Why `context.platform.deliver` delivered nothing. Crosses into a plugin's process as its `value`. */
export class PluginPlatformDeliveryReason extends Enum {
  /** Nobody owns the key. */
  static readonly UNCLAIMED = new PluginPlatformDeliveryReason('unclaimed');
  /** The owner switched the plugin off. */
  static readonly DISABLED = new PluginPlatformDeliveryReason('disabled');
  /** The tenant part registered no receiver. */
  static readonly NO_RECEIVER = new PluginPlatformDeliveryReason('no-receiver');

  private constructor(value: string) {
    super(value);
  }
}
