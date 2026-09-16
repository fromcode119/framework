import { CapabilityScope } from '@core/enums/capability-scope.enum';

export interface ISecondaryPanelItemManifest {
  id: string;
  label: string;
  path: string;
  sourcePaths?: string[];
  icon?: string;
  scope?: CapabilityScope;
  targetNamespace?: string;
  targetPlugin?: string;
  priority?: number;
  requiredRoles?: string[];
  requiredCapabilities?: string[];
  group?: string;
  description?: string;
  sourceNamespace?: string;
  sourcePlugin?: string;
  allowGlobal?: boolean;
  governanceKey?: string;
  /** See `IMenuItemManifest.siteOnly` — needs a site to mean anything, dropped while none is selected. */
  siteOnly?: boolean;
  /**
   * See `IMenuItemManifest.platformScopeOnly` — belongs to the platform, withheld INSIDE a site.
   *
   * `AdminNavigationScopeFilter.applyToPanel` has always read this flag on panel entries; only the
   * type was missing, so no settings entry could declare it and Infrastructure, Backups and Updates
   * stayed in the sidebar of a console headed with one customer's name.
   */
  platformScopeOnly?: boolean;
}
