import type { SecondaryPanelContext, SecondaryPanelItem } from '@fromcode119/react';
import type { SecondarySidebarMode } from './services/secondary-sidebar-state-service.types';

export type SecondarySidebarProps = {
  mode: SecondarySidebarMode;
  context: SecondaryPanelContext | null;
  items: SecondaryPanelItem[];
  sourceLabel: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPanelMouseEnter?: () => void;
  onPanelMouseLeave?: () => void;
  onItemActivate?: (item?: SecondaryPanelItem) => void;
  parentPrimaryPath?: string;
  /** When true (and not docked open), the panel renders as a floating overlay over
   *  the content — used for hover-preview so it never reserves layout width. */
  hoverOpen?: boolean;
  /** Tailwind left-offset class to anchor the hover overlay just after the primary
   *  sidebar (e.g. 'left-64' full, 'left-[72px]' mini). */
  overlayLeftClass?: string;
};

export type SecondarySidebarDesktopProps = {
  context: SecondaryPanelContext | null;
  items: SecondaryPanelItem[];
  sourceLabel: string;
  pathname: string;
  isOpen: boolean;
  hoverOpen?: boolean;
  overlayLeftClass?: string;
  hasActiveItem: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
  onClose: () => void;
  onPanelMouseEnter?: () => void;
  onPanelMouseLeave?: () => void;
  onItemActivate?: (item?: SecondaryPanelItem) => void;
  onListKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
};

export type SecondarySidebarMobileProps = {
  context: SecondaryPanelContext | null;
  items: SecondaryPanelItem[];
  sourceLabel: string;
  pathname: string;
  mode: SecondarySidebarMode;
  isOpen: boolean;
  liveMessage: string;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
  onClose: () => void;
  onItemActivate?: (item?: SecondaryPanelItem) => void;
  onOverlayKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onListKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
};
