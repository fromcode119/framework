import { HookMessagingAdapter } from '../types';

/**
 * Local adapter: Does nothing for distribution (default)
 */
export class LocalHookAdapter implements HookMessagingAdapter {
  publish(): void {}
  subscribe(): void {}
}
