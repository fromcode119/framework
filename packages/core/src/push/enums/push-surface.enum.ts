import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Where a device subscribed: the site's storefront (a customer) or its console (staff). A message
 * for staff opens the console; a customer's opens the storefront — and neither reaches the other.
 */
export class PushSurface extends Enum {
  static readonly STOREFRONT = new PushSurface('storefront');
  static readonly CONSOLE = new PushSurface('console');

  private constructor(value: string) {
    super(value);
  }
}
