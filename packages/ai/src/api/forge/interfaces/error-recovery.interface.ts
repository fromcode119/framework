import { RecoveryOutcome } from '@ai/api/forge/enums/recovery-outcome.enum';

import type { IRecoveryAttempt } from '@ai/api/forge/interfaces/recovery-attempt.interface';

export interface IErrorRecovery {
  errorId: string;
  originalStepNumber: number;
  timestamp: number;
  errorMessage: string;
  errorType?: string; // 'timeout' | 'validation' | 'not-found' | etc
  recoveryAttempts: IRecoveryAttempt[];
  recovered: boolean;
  finalStatus?: RecoveryOutcome;
}
