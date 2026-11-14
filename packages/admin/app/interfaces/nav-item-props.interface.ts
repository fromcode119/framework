export interface INavItemProps {
  icon?: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
  children?: any[];
  /** More pages of the section (its panel entries), shown under it while it is open. */
  subItems?: any[];
  pluginSlug?: string;
  isMini?: boolean;
  /** Resolved active path (honours secondary-panel sourcePaths). When it matches one of the section's
   * pages, that page is the one marked — so a sub-page like /<plugin>/<child> lights up its true
   * parent, not the closest-prefix sibling. */
  activePathOverride?: string;
}
