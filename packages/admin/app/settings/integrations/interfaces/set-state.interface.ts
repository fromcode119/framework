import type { IIntegrationsSettingsPageClientState } from '@/app/settings/integrations/interfaces/integrations-settings-page-client-state.interface';

/** Applies a state patch, either directly or via an updater. Call signature — interface, not a type alias. */
export interface ISetState {
  (
    patch:
      | Partial<IIntegrationsSettingsPageClientState>
      | ((previous: IIntegrationsSettingsPageClientState) => Partial<IIntegrationsSettingsPageClientState> | null),
  ): void;
}
