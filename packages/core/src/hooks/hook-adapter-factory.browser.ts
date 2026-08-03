// Light-weight HookAdapterFactory for the browser
import { IHookMessagingAdapter } from '@core/hooks/interfaces/hook-messaging-adapter.interface';
import { LocalHookAdapter } from '@core/hooks/adapters/local-hook-adapter';
import type { IHookAdapterCreator } from '@core/hooks/interfaces/hook-adapter-creator.interface';

export class HookAdapterFactory {
  private static registry: Map<string, IHookAdapterCreator> = new Map();

  static register(type: string, creator: IHookAdapterCreator) {
    this.registry.set(type, creator);
  }

  static create(type?: string, options: any = {}): IHookMessagingAdapter {
    return new LocalHookAdapter();
  }
}