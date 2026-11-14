/** One card of a settings tab: the fields under one `admin.section` heading, with the line the schema gives it. */
export interface IPluginSettingsSectionCard {
  key: string;
  title?: string;
  description?: string;
  fields: any[];
}
