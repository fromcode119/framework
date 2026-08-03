import { RuntimeStage } from '@ai/admin-assistant-runtime/runtime/enums/runtime-stage.enum';
import type { IRuntimeToolCall } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-tool-call.interface';
import type { IRuntimeToolResult } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-tool-result.interface';

export interface IRuntimeRetrievalResult {
  stage: RuntimeStage;
  confidence: number;
  queryHints: string[];
  passes: number;
  calls: IRuntimeToolCall[];
  results: IRuntimeToolResult[];
  blockedTools: string[];
  availableToolNames: Set<string>;
}
