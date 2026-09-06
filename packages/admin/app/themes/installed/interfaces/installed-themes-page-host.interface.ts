

import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';

import type { IInstalledThemesPageClientState } from '@/app/themes/installed/interfaces/installed-themes-page-client-state.interface';

/** What {@link InstalledThemesPageActions} needs from the page-client to drive it, hook-free. */
export interface IInstalledThemesPageHost {
  /** True between `componentDidMount` and `componentWillUnmount`. */
  readonly mounted: boolean;
  /** May this admin act on the platform? False for a tenant admin: no marketplace calls are made. */
  readonly canManage: boolean;
  readonly state: IInstalledThemesPageClientState;
  /** Raw `setState` pass-through — deliberately UNGUARDED; callers keep the `mounted` check explicit. */
  patch(patch: Partial<IInstalledThemesPageClientState>): void;
  patchWith(updater: (state: IInstalledThemesPageClientState) => Partial<IInstalledThemesPageClientState>): void;
  readonly notify: INotificationContextType;
  triggerRefresh(): void;
  /** Reload installed + marketplace themes into state. */
  refresh(): Promise<void>;
}
