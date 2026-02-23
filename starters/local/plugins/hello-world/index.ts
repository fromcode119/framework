import { definePlugin, PluginContext } from '@fromcode119/sdk';

export const onInit = async (context: PluginContext) => {
  context.ui.registerPage({
    label: 'Hello World',
    path: '/hello',
    icon: 'Star',
    group: 'Local Plugins',
  });

  context.api.get('/hello', async (_req: any, res: any) => {
    res.json({ message: 'Hello from your local plugin!' });
  });
};

export default definePlugin({ onInit });
