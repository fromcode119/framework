export interface IMenuItemManifest {
  label: string;
  path: string;
  icon?: string;
  priority?: number;
  group?: string;
  children?: IMenuItemManifest[];
}
