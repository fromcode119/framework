import { GeoIpLookup } from '@core/geo/geo-ip-lookup';
import { GeoDatabaseSource } from '@core/geo/geo-database-source';
import type { IPluginContextGeo } from '@core/plugin/interfaces/plugin-context-geo.interface';

/**
 * `context.geo` — see {@link IPluginContextGeo}.
 *
 * Built on the HOST in both worlds: an isolated plugin asks over RPC and receives the place, never the
 * database file. The database is present only while the operator has lookups switched on.
 */
export class GeoContextProxy {
  static createGeoProxy(): IPluginContextGeo {
    return {
      lookup: async (address: string) => GeoIpLookup.shared.lookup(address),
      attribution: async () => GeoDatabaseSource.attribution(),
    };
  }
}
