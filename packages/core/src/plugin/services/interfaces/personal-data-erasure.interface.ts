/** What one dataset did. The four counts are the whole outcome: nothing is implied by omission. */
export interface IPersonalDataErasure {
  strategy: string;
  erased: number;
  anonymised: number;
  retained: number;
  remaining: number;
  retainedReason?: string;
}
