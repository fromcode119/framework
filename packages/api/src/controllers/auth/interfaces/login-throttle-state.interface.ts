export interface ILoginThrottleState {
  count: number;
  firstFailureAt?: string;
  lastFailureAt?: string;
  lockedUntil?: string;
}
