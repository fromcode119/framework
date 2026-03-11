// ─── Companion types file for hook-adapter-factory.browser.ts ───────────────
import type { HookMessagingAdapter } from './types';

export type HookAdapterCreator = (options: any) => HookMessagingAdapter;
