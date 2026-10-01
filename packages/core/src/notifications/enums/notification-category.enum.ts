import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * What kind of message a person is being sent, which decides whether their consent covers it.
 * UPDATES is about something they did (an order, a booking, a support reply); OFFERS is anything a
 * business sends unprompted — a campaign. Someone may want one and not the other.
 */
export class NotificationCategory extends Enum {
  static readonly UPDATES = new NotificationCategory('updates');
  static readonly OFFERS = new NotificationCategory('offers');

  private constructor(value: string) {
    super(value);
  }
}
