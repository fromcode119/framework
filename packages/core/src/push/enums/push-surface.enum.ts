import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Where a device subscribed: the site's storefront (a customer), its console (staff), or the site's
 * own mobile app (a customer, on their phone). A message for staff opens the console; a customer's
 * opens the storefront or the app — and staff and customer messages never reach each other.
 */
export class PushSurface extends Enum {
  static readonly STOREFRONT = new PushSurface('storefront');
  static readonly CONSOLE = new PushSurface('console');
  /** A phone running the site's own app. Its device address is an Expo push token, not a browser endpoint. */
  static readonly APP = new PushSurface('app');

  /** The surfaces a customer is reached on: wherever they turned notifications on. */
  static readonly CUSTOMER: readonly PushSurface[] = [PushSurface.STOREFRONT, PushSurface.APP];

  private constructor(value: string) {
    super(value);
  }
}
