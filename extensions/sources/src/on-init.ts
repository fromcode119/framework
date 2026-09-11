import type { PluginContext } from '@fromcode119/sdk';
import { SourcesBootstrap } from '@plugin/src/bootstrap/sources-bootstrap';

export class SourcesLifecycle {
  static async onInit(context: PluginContext): Promise<void> {
    await new SourcesBootstrap(context).initialize();
  }
}
