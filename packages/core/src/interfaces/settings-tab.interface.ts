export interface ISettingsTab {
  id: string;
  label: string;
  icon?: string;
  fields?: string[]; // Optional explicit field names; field.tab is the canonical source when omitted
}
