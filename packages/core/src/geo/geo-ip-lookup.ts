import fs from 'fs';
import { Reader } from 'mmdb-lib';
import { NetworkAddressUtils } from '@core/security/network-address-utils';
import { GeoDatabaseStore } from '@core/geo/geo-database-store';
import type { IGeoLocation } from '@core/geo/interfaces/geo-location.interface';

/**
 * Looks an address up in the installed database — `context.geo.lookup` for plugins.
 *
 * The file is read once per process and re-read when a newer edition replaces it (its modification
 * time changes; checked at most once a minute). No database, a private address or an address the
 * database does not know all answer `null`: a caller shows "unknown", never a guessed place.
 */
export class GeoIpLookup {
  private static readonly RECHECK_MS = 60_000;

  private reader: Reader<any> | null = null;
  private loadedMtime = 0;
  private checkedAt = 0;

  constructor(private readonly store: GeoDatabaseStore = new GeoDatabaseStore()) {}

  /** The shared lookup for this process. */
  static readonly shared = new GeoIpLookup();

  lookup(address: unknown): IGeoLocation | null {
    const ip = NetworkAddressUtils.normalize(address);
    if (!ip || !NetworkAddressUtils.isPublic(ip)) return null;
    const reader = this.current();
    if (!reader) return null;
    let record: any;
    try {
      record = reader.get(ip);
    } catch {
      return null;
    }
    const countryCode = String(record?.country?.iso_code ?? '').toUpperCase();
    if (!countryCode) return null;
    return {
      countryCode,
      country: String(record?.country?.names?.en ?? ''),
      region: String(record?.subdivisions?.[0]?.names?.en ?? ''),
      city: String(record?.city?.names?.en ?? ''),
    };
  }

  /** Whether a database is installed and readable in this process. */
  available(): boolean {
    return this.current() !== null;
  }

  private current(): Reader<any> | null {
    const now = Date.now();
    if (this.reader && now - this.checkedAt < GeoIpLookup.RECHECK_MS) return this.reader;
    this.checkedAt = now;
    let mtime = 0;
    try {
      mtime = fs.statSync(this.store.databasePath).mtimeMs;
    } catch {
      this.reader = null;
      this.loadedMtime = 0;
      return null;
    }
    if (this.reader && mtime === this.loadedMtime) return this.reader;
    try {
      this.reader = new Reader(fs.readFileSync(this.store.databasePath));
      this.loadedMtime = mtime;
    } catch {
      this.reader = null;
      this.loadedMtime = 0;
    }
    return this.reader;
  }
}
