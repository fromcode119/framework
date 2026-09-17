import { Enum } from '@fromcode119/react-class-components';

/**
 * How a file group's badge reads — a state marker, deliberately generic.
 *
 * Two tones only, and kept meaningless on purpose: the account panel has no business knowing what a
 * plugin's states mean. A drip lock and an expiring link are both `WARNING` here; the plugin supplies
 * the label that says which.
 */
export class AccountBadgeTone extends Enum {
  static readonly NEUTRAL = new AccountBadgeTone('neutral');
  static readonly WARNING = new AccountBadgeTone('warning');

  private constructor(value: string) {
    super(value);
  }
}
