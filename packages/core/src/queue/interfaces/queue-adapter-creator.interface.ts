// ─── Companion types file for queue-adapter-factory.ts ──────────────────────
import type { IQueueAdapter } from '@core/queue/interfaces/queue-adapter.interface';

export interface IQueueAdapterCreator {
  (options: any): IQueueAdapter;
}
