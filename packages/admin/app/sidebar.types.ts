export type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
  isMini?: boolean;
  onMiniToggle?: () => void;
  onActiveContextChange?: (contextId: string) => void;
  activeSecondaryAnchorPath?: string;
  hoverPreviewPath?: string;
  previewablePaths?: string[];
  onHoverPreviewPathChange?: (path: string) => void;
  inlineSecondaryContext?: any;
  inlineSecondaryItems?: any[];
  inlineSecondarySourceLabel?: string;
  showInlineSecondary?: boolean;
  activePrimaryPathOverride?: string;
  activeChildPathOverride?: string;
  onPreviewRegionEnter?: () => void;
  onPreviewRegionLeave?: () => void;
};
