export interface INavItemProps {
  icon?: React.ReactNode;
  label: string;
  href: string;
  persistenceKey?: string;
  active?: boolean;
  isAnchoredToSecondary?: boolean;
  onClick?: () => void;
  children?: any[];
  isMini?: boolean;
  isGroupHeader?: boolean;
  version?: string;
  canHoverPreview?: boolean;
  showHoverPreview?: boolean;
  preserveActiveAnchor?: boolean;
  onHoverPreviewStart?: (path: string) => void;
  onHoverPreviewEnd?: () => void;
  /** Resolved active primary path (honours secondary-panel sourcePaths). When it matches a child,
   * that child is highlighted instead of the raw best-prefix match — so a sub-page like
   * /<plugin>/<child> lights up its parent group, not the closest-prefix sibling. */
  activePathOverride?: string;
}
