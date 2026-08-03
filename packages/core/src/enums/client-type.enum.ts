import { Enum } from '@fromcode119/reactor';

/** Which app a runtime client belongs to. Sent as the `X-Framework-Client` header value. */
export class ClientType extends Enum {
  static readonly ADMIN_UI = new ClientType('admin-ui');
  static readonly FRONTEND_UI = new ClientType('frontend-ui');

  private constructor(value: string) {
    super(value);
  }
}
