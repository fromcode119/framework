/**
 * Where the platform's IP-location data comes from: DB-IP's free "IP to City Lite" database.
 *
 * Free for any use under Creative Commons Attribution 4.0, which requires crediting DB-IP wherever the
 * data is shown — so the credit lives here, once, and every screen that shows a location reads it.
 * Published monthly as `dbip-city-lite-YYYY-MM.mmdb.gz`, in the same format as MaxMind's GeoIP2 City.
 */
export class GeoDatabaseSource {
  static readonly NAME = 'DB-IP';
  static readonly URL = 'https://db-ip.com';
  static readonly LICENSE = 'CC BY 4.0';
  static readonly LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';

  private static readonly DOWNLOAD_BASE = 'https://download.db-ip.com/free';

  /** `YYYY-MM` for a date, in UTC — the edition name DB-IP publishes under. */
  static editionFor(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /** The edition before `edition` — DB-IP publishes early in the month, so the current one can be missing. */
  static previousEdition(edition: string): string {
    const [year, month] = edition.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 2, 1));
    return GeoDatabaseSource.editionFor(date);
  }

  static downloadUrl(edition: string): string {
    if (!/^\d{4}-\d{2}$/.test(edition)) throw new Error(`Invalid geo database edition: ${JSON.stringify(edition)}`);
    return `${GeoDatabaseSource.DOWNLOAD_BASE}/dbip-city-lite-${edition}.mmdb.gz`;
  }

  static attribution(): { name: string; url: string; license: string; licenseUrl: string } {
    return { name: GeoDatabaseSource.NAME, url: GeoDatabaseSource.URL, license: GeoDatabaseSource.LICENSE, licenseUrl: GeoDatabaseSource.LICENSE_URL };
  }
}
