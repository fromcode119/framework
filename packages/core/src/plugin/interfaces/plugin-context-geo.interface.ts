import type { IGeoLocation } from '@core/geo/interfaces/geo-location.interface';

/**
 * The `context.geo` surface of {@link PluginContext}: where an IP address approximately is.
 *
 * Answered by the platform's IP-location database (DB-IP City Lite, CC BY 4.0), which an operator
 * switches on in Settings → Infrastructure. `null` when it is off, not installed yet, or does not know
 * the address — a caller shows "unknown" and never guesses. City precision at best.
 *
 * A plugin that SHOWS a location credits the source: `attribution()` returns the name, link and licence.
 */
export interface IPluginContextGeo {
  lookup(address: string): Promise<IGeoLocation | null>;
  attribution(): Promise<{ name: string; url: string; license: string; licenseUrl: string }>;
}
