/**
 * A heading over several settings tabs. A plugin with many tabs declares groups; the console shows the
 * groups as the page's tabs and each group's own tabs in a row beneath. Without groups, nothing changes.
 */
export interface ISettingsTabGroup {
  id: string;
  label: string;
  /** A framework icon name (`FrameworkIcons`), e.g. `Store`, `Users`, `Mail`. */
  icon?: string;
}
