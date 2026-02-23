// Light-weight HookAdapterFactory for the browser
import { HookMessagingAdapter } from './types';
import { LocalHookAdapter } from './adapters/local-hook-adapter';

export type HookAdapterCreator = (options: any) => HookMessagingAdapter;

export class HookAdapterFactory {
  private static registry: Map<string, HookAdapterCreator> = new Map();

  static register(type: string, creator: HookAdapterCreator) {
    this.registry.set(type, creator);
  }

  static create(type?: string, options: any = {}): HookMessagingAdapter {
    return new LocalHookAdapter();
  }
}
