import type { StepType } from './reasoning-chain-tracker.types';

export interface AlternativeOption {
  id: string;
  description: string;
  pros: string[];
  cons: string[];
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
}
export interface ReasoningStep {
  stepNumber: number;
  timestamp: number;
  type: StepType;
  input: Record<string, any>;
  thinking: string; // Internal reasoning
  output: Record<string, any>;
  confidence: number; // 0-1
  alternatives?: AlternativeOption[];
  selectedChoice?: AlternativeOption;
  duration?: number; // milliseconds
}
export interface RecoveryAttempt {
  attemptNumber: number;
  strategy: string; // Description of recovery strategy
  result: 'success' | 'failure';
  message?: string;
}
export interface ErrorRecovery {
  errorId: string;
  originalStepNumber: number;
  timestamp: number;
  errorMessage: string;
  errorType?: string; // 'timeout' | 'validation' | 'not-found' | etc
  recoveryAttempts: RecoveryAttempt[];
  recovered: boolean;
  finalStatus?: 'recovered' | 'abandoned' | 'escalated';
}
export interface ReasoningReport {
  totalSteps: number;
  successfulSteps: number;
  recoveries: ErrorRecovery[];
  averageConfidence: number;
  totalDuration: number;
  keyDecisions: string[];
  riskAssessment: 'low' | 'medium' | 'high';
}
