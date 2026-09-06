export interface IMenuItemManifest {
  label: string;
  path: string;
  icon?: string;
  priority?: number;
  group?: string;
  children?: IMenuItemManifest[];
  /** Shown to PLATFORM admins only; dropped from the payload for everyone else on a multi-tenant deployment. */
  platformOnly?: boolean;
}
