import type { IIntegrationStoredProfile } from '@core/integrations/interfaces/integration-stored-profile.interface';

export interface IIntegrationStoredProfiles {
  activeProfileId: string;
  profiles: IIntegrationStoredProfile[];
}
