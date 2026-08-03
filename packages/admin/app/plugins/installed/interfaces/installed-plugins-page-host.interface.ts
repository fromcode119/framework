import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';
import type { IInstalledPluginsPageClientState } from '@/app/plugins/installed/interfaces/installed-plugins-page-client-state.interface';

/** What {@link InstalledPluginsPageActions} needs from the page-client to drive it, hook-free. */
export interface IInstalledPluginsPageHost {
  /** True between `componentDidMount` and `componentWillUnmount`. */
  readonly mounted: boolean;
  readonly state: IInstalledPluginsPageClientState;
  /** Raw `setState` pass-through — deliberately UNGUARDED; callers keep the `mounted` check explicit. */
  patch(patch: Partial<IInstalledPluginsPageClientState>): void;
  patchWith(updater: (state: IInstalledPluginsPageClientState) => Partial<IInstalledPluginsPageClientState>): void;
  readonly notify: INotificationContextType;
  triggerRefresh(): void;
  /** Reload installed plugins + marketplace registry into state. */
  refresh(): Promise<void>;
}
