export interface SidebarNavGroupsProps {
  isMini?: boolean;
  pathname: string;
  sortedGroups: string[];
  groupedMenu: Record<string, any[]>;
  groupLabels: Record<string, string>;
  collapsedGroups: string[];
  plugins: any[];
  previewablePaths?: string[];
  hoverPreviewPath?: string;
  activeSecondaryAnchorPath?: string;
  normalizedActivePrimaryPathOverride: string;
  normalizedActiveChildPathOverride: string;
  footerSettingsItem: any;
  footerSettingsIsGroup: boolean;
  onClose?: () => void;
  onHoverPreviewPathChange?: (path: string) => void;
}
