// ─── Companion types file for queue-adapter-factory.browser.ts ──────────────
import type { QueueAdapter } from './types';

export type QueueAdapterCreator = (options: any) => QueueAdapter;
