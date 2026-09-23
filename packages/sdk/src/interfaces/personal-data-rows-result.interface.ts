/** What a dataset did, in the shape a data-protection plugin's fulfilment report expects. */
export interface IPersonalDataRowsResult {
  strategy: string;
  erased: number;
  anonymised: number;
  retained: number;
  remaining: number;
  retainedReason?: string;
}
