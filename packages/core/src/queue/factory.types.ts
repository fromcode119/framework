// ─── Companion types file for factory.ts ────────────────────────────────────
import type { QueueAdapter } from './types';

export type QueueAdapterCreator = (options: any) => QueueAdapter;
