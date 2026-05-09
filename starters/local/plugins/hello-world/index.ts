import type { PluginContext } from '@fromcode119/sdk';

export async function onInit(context: PluginContext): Promise<void> {
  context.api.get('/hello', async (_req: any, res: any) => {
    res.json({ message: 'Hello from your local plugin!' });
  });
}
