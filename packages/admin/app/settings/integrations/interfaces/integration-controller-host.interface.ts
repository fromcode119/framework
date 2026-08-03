import type { INotify } from '@/app/settings/integrations/interfaces/notify.interface';
import type { ISetState } from '@/app/settings/integrations/interfaces/set-state.interface';
import type { IIntegrationsSettingsPageClientState } from '@/app/settings/integrations/interfaces/integrations-settings-page-client-state.interface';

export interface IIntegrationControllerHost {
  getState: () => IIntegrationsSettingsPageClientState;
  setState: ISetState;
  notify: INotify;
  replaceRoute: (path: string) => void;
  isMounted: () => boolean;
}
