/** One line of a consent dialog: what is approved, how risky it is, and whether this approval adds it. */
export interface IPluginConsentEntry {
  /** The approval entry itself — a capability (`database:write`), `network:host:<host>` or `network:any`. */
  entry: string;
  /** `capability`, `host` or `anyHost` (PluginConsentEntryKind). */
  kind: string;
  /** For a host entry, the host; otherwise empty. */
  host: string;
  /** `low`, `medium` or `high` (PluginConsentRisk). */
  risk: string;
  /** Not in the approved set yet — what this approval adds. */
  isNew: boolean;
}
