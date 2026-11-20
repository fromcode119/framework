import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Where ONE site's mail actually goes. The integrations page shows the provider the type resolved to,
 * but for a site without its own provider that answer ("Mock Driver — set in the server environment")
 * is not what its mail meets: the send is refused unless the site opted into the platform's server.
 */
export class EmailDeliveryRoute extends Enum {
  /** The site's own saved provider sends it. */
  static readonly OWN = new EmailDeliveryRoute('own');
  /** No provider of its own; it opted into the platform's mail server, which has a real one. */
  static readonly PLATFORM = new EmailDeliveryRoute('platform');
  /** No provider of its own and the platform's mail server is off for it: nothing is sent. */
  static readonly NONE = new EmailDeliveryRoute('none');
  /** It opted into the platform's mail server, but the platform has none (only the mock): nothing is sent. */
  static readonly PLATFORM_UNAVAILABLE = new EmailDeliveryRoute('platform-unavailable');

  private constructor(value: string) {
    super(value);
  }
}
