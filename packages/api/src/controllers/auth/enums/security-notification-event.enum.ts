import { Enum } from '@fromcode119/react-class-components';

/**
 * What a security notification is about. The template for the reader's language turns it into words;
 * code never writes the sentence.
 */
export class SecurityNotificationEvent extends Enum {
  static readonly NEW_LOGIN = new SecurityNotificationEvent('newLogin');
  static readonly PASSWORD_CHANGED = new SecurityNotificationEvent('passwordChanged');
  static readonly PASSWORD_RESET = new SecurityNotificationEvent('passwordReset');
  /** Sent to the OLD address when a change is requested. */
  static readonly EMAIL_CHANGE_REQUESTED = new SecurityNotificationEvent('emailChangeRequested');
  /** Sent to both addresses once the change is confirmed. */
  static readonly EMAIL_CHANGED = new SecurityNotificationEvent('emailChanged');
  static readonly TWO_FACTOR_ENABLED = new SecurityNotificationEvent('twoFactorEnabled');
  static readonly TWO_FACTOR_DISABLED = new SecurityNotificationEvent('twoFactorDisabled');

  private constructor(value: string) {
    super(value);
  }
}
