import { Enum } from '@fromcode119/react-class-components';

/**
 * How much room a setting's control takes beside its name. The widths themselves are the
 * `--fc-settings-control-*` tokens in `settings.css`.
 */
export class SettingRowWidth extends Enum {
  /** A number, an amount, a short code. */
  static readonly NARROW = new SettingRowWidth('narrow');
  /** A text, an address, a choice from a list. */
  static readonly FIELD = new SettingRowWidth('field');
  /** As wide as the control itself — a switch, a pair of buttons. */
  static readonly AUTO = new SettingRowWidth('auto');

  private constructor(value: string) {
    super(value);
  }
}
