export interface IMenuItem {
  label: string;
  path: string;
  icon?: string;
  priority?: number;
  pluginSlug: string;
  group?: string;
  children?: IMenuItem[];
}
