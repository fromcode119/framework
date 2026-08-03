import type { StepType } from '@ai/api/forge/enums/step-type.enum';
import type { IAlternativeOption } from '@ai/api/forge/interfaces/alternative-option.interface';

export interface IReasoningStep {
  stepNumber: number;
  timestamp: number;
  type: StepType;
  input: Record<string, any>;
  thinking: string; // Internal reasoning
  output: Record<string, any>;
  confidence: number; // 0-1
  alternatives?: IAlternativeOption[];
  selectedChoice?: IAlternativeOption;
  duration?: number; // milliseconds
}
