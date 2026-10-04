export interface ISettingsTab {
  id: string;
  label: string;
  icon?: string;
  fields?: string[]; // Optional explicit field names; field.tab is the canonical source when omitted
  /** The schema's `groups` entry this tab sits under: groups become the page's tabs, their tabs a row below. */
  group?: string;
}
