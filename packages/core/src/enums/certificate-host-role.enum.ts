import { Enum } from '@fromcode119/react-class-components';

/**
 * What a host IS on this platform — which decides who is affected when its certificate lapses.
 *
 * A site's primary host going dark takes that site down. The ADMIN host going dark locks every
 * operator out of the platform, including out of the screen they would use to fix it. Those are not
 * the same emergency, and a flat list that showed them identically would bury the second one.
 *
 * The member carries the i18n KEY, never the label: copy lives in the locale files.
 */
export class CertificateHostRole extends Enum {
  /** A site's main address. */
  static readonly PRIMARY = new CertificateHostRole('primary', 'certificates.role.primary');

  /** An additional address for the same site. */
  static readonly ALIAS = new CertificateHostRole('alias', 'certificates.role.alias');

  /** The admin console's own host. Lose this and nobody can sign in to fix anything. */
  static readonly PLATFORM_ADMIN = new CertificateHostRole('platform_admin', 'certificates.role.platformAdmin');

  /** The api's own host. Lose this and every site stops working, not just one. */
  static readonly PLATFORM_API = new CertificateHostRole('platform_api', 'certificates.role.platformApi');

  /** The platform's default storefront host, where one is configured. */
  static readonly PLATFORM_FRONTEND = new CertificateHostRole('platform_frontend', 'certificates.role.platformFrontend');

  private constructor(value: string, readonly translationKey: string) {
    super(value);
  }

  /** The member a wire value names, or null. */
  static find(value: unknown): CertificateHostRole | null {
    if (value instanceof CertificateHostRole) return value;
    return (CertificateHostRole.fromValue(String(value ?? '').trim().toLowerCase()) as CertificateHostRole | undefined) ?? null;
  }

  /** Whether this host belongs to the platform itself rather than to one site. */
  get isPlatform(): boolean {
    return this !== CertificateHostRole.PRIMARY && this !== CertificateHostRole.ALIAS;
  }
}
