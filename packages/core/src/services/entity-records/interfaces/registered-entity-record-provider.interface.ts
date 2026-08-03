import { IEntityRecordProviderRegistration } from '@core/services/entity-records/interfaces/entity-record-provider-registration.interface';

/** A registration after normalization, with its canonical key. */
export interface IRegisteredEntityRecordProvider extends IEntityRecordProviderRegistration {
  canonicalKey: string;
}
