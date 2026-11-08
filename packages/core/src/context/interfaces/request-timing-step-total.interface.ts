/** What one named step of a request has taken so far: the time, and how many times it ran. */
export interface IRequestTimingStepTotal {
  ms: number;
  count: number;
}
