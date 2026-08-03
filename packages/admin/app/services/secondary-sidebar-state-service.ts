import { AdminConstants } from '@/lib/constants/admin.constants';
import type { ISecondarySidebarLayoutInput } from '@/app/services/interfaces/secondary-sidebar-layout-input.interface';
import { SecondarySidebarMode } from '@/app/services/enums/secondary-sidebar-mode.enum';

export class SecondarySidebarStateService {
  resolveMode(input: ISecondarySidebarLayoutInput): SecondarySidebarMode {
    if (input.viewportWidth < AdminConstants.SECONDARY_SIDEBAR.MOBILE_BREAKPOINT) {
      return SecondarySidebarMode.MOBILE;
    }

    return SecondarySidebarMode.DESKTOP;
  }

  shouldShowPanel(mode: SecondarySidebarMode, hasItems: boolean): boolean {
    return mode === SecondarySidebarMode.DESKTOP && hasItems;
  }

  shouldShowOverlay(mode: SecondarySidebarMode, hasItems: boolean, isOpen: boolean): boolean {
    return mode === SecondarySidebarMode.MINIMAL && hasItems && isOpen;
  }

  shouldShowTrigger(mode: SecondarySidebarMode, hasItems: boolean): boolean {
    return mode === SecondarySidebarMode.MINIMAL && hasItems;
  }

  shouldCloseOnRouteChange(mode: SecondarySidebarMode): boolean {
    return mode === SecondarySidebarMode.MINIMAL;
  }
}
