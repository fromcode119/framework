/**
 * A primary navigation entry handed to an appearance shell so it can render real navigation without
 * recomputing the framework's plugin-driven menu. A read-only projection of the admin's menu.
 */
export interface IAppearanceNavItem {
  path: string;
  label: string;
  icon?: string;
  group?: string;
  pluginSlug?: string;
  children?: IAppearanceNavItem[];
}
