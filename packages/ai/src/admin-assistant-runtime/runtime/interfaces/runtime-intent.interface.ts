import { RuntimeIntentKind } from '@ai/admin-assistant-runtime/runtime/enums/runtime-intent-kind.enum';

export interface IRuntimeIntent {
  kind: RuntimeIntentKind;
  confidence: number;
  replace?: { from: string; to: string };
  urlHint?: string;
  queryHint?: string;
  quickAnswer?: string;
}
