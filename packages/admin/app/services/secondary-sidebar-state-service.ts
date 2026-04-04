import { AdminConstants } from '@/lib/constants';
import type { SecondarySidebarLayoutInput, SecondarySidebarMode } from './secondary-sidebar-state-service.interfaces';

export class SecondarySidebarStateService {
  resolveMode(input: SecondarySidebarLayoutInput): SecondarySidebarMode {
    if (input.viewportWidth < AdminConstants.SECONDARY_SIDEBAR.MOBILE_BREAKPOINT) {
      return 'mobile';
    }

    return 'desktop';
  }

  shouldShowPanel(mode: SecondarySidebarMode, hasItems: boolean): boolean {
    return mode === 'desktop' && hasItems;
  }

  shouldShowOverlay(mode: SecondarySidebarMode, hasItems: boolean, isOpen: boolean): boolean {
    return mode === 'minimal' && hasItems && isOpen;
  }

  shouldShowTrigger(mode: SecondarySidebarMode, hasItems: boolean): boolean {
    return mode === 'minimal' && hasItems;
  }

  shouldCloseOnRouteChange(mode: SecondarySidebarMode): boolean {
    return mode === 'minimal';
  }
}
