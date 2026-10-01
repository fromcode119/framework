import { Enum } from '@fromcode119/react-class-components/lang';

/** A way of reaching a person outside the site that they must agree to first. */
export class ConsentChannel extends Enum {
  /** Text messages to a phone number. */
  static readonly SMS = new ConsentChannel('sms');
  /** Notifications on the devices they turned them on for. */
  static readonly PUSH = new ConsentChannel('push');

  private constructor(value: string) {
    super(value);
  }
}
