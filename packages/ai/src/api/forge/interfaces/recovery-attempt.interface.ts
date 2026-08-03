import { AttemptResult } from '@ai/api/forge/enums/attempt-result.enum';

export interface IRecoveryAttempt {
  attemptNumber: number;
  strategy: string; // Description of recovery strategy
  result: AttemptResult;
  message?: string;
}
