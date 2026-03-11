// ─── Companion types file for hook-adapter-factory.ts ───────────────────────
import type { HookMessagingAdapter } from './types';

export type HookAdapterCreator = (options: any) => HookMessagingAdapter;
