import { MarketplaceDefaults } from '@core/marketplace/marketplace-defaults';

/**
 * Where a usage report goes when Settings → General leaves the address blank.
 *
 * Its own file because BOTH sides need it and they cannot share a module: the service that sends the
 * report reads platform settings and touches the database, which must never be pulled into the admin
 * bundle — and the admin has to state the default beside the field that overrides it.
 */
export class UsageReportDefaults {
  /** The publisher's public marketplace, which keeps the reports it is sent. Any marketplace address works. */
  static readonly ADDRESS = MarketplaceDefaults.ADDRESS;
}
