import type { PluginContext } from '@fromcode119/sdk';
import { BenchItems } from '@plugin/src/items';
import { BenchWide } from '@plugin/src/wide';

export class BenchItemsLifecycle {
  static async onInit(context: PluginContext): Promise<void> {
    context.collections.register(BenchItems);
    context.collections.register(BenchWide);
  }
}
