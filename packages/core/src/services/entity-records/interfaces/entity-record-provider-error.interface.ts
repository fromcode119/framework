/** A provider that threw while resolving — surfaced, never fatal. */
export interface IEntityRecordProviderError {
  provider: string;
  message: string;
}
