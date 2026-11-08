import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Who a declared email stream is asked about. PERSON is mail a customer or member receives and is
 * listed on their account screen; ADMIN is an alert sent to the site's administrators and is listed
 * only to them, in their own profile.
 */
export class EmailCategoryAudience extends Enum {
  static readonly PERSON = new EmailCategoryAudience('person');
  static readonly ADMIN = new EmailCategoryAudience('admin');

  private constructor(value: string) {
    super(value);
  }
}
