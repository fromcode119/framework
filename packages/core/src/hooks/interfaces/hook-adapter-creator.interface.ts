// ─── Companion types file for hook-adapter-factory.browser.ts ───────────────
import type { IHookMessagingAdapter } from '@core/hooks/interfaces/hook-messaging-adapter.interface';

export interface IHookAdapterCreator {
  (options: any): IHookMessagingAdapter;
}
