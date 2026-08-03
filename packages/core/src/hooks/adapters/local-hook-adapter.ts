import { IHookMessagingAdapter } from '@core/hooks/interfaces/hook-messaging-adapter.interface';

/**
 * Local adapter: Does nothing for distribution (default)
 */
export class LocalHookAdapter implements IHookMessagingAdapter {
  publish(): void {}
  subscribe(): void {}
}