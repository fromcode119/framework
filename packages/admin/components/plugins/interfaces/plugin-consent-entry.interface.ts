/** One line of the consent dialog, as the api's consent summary sends it. */
export interface IPluginConsentEntry {
  /** A capability (`database:write`), `network:host:<host>` or `network:any`. */
  entry: string;
  /** `capability`, `host` or `anyHost`. */
  kind: string;
  host: string;
  /** `low`, `medium` or `high`. */
  risk: string;
  /** This approval adds it. */
  isNew: boolean;
}
