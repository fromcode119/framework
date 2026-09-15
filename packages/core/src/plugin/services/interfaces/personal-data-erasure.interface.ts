/** What a framework dataset did. See the privacy plugin's contract for what each number means. */
export interface IPersonalDataErasure {
  strategy: string;
  erased: number;
  anonymised: number;
  retained: number;
  remaining: number;
  retainedReason?: string;
}
