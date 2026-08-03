import type { ReactNode } from 'react';
import { Bridge } from '@fromcode119/reactor';
import { ContextHooks } from '@fromcode119/react';
import { AuthHooks } from '@/components/view/use-auth.client';
import { PluginLoaderRunner } from '@/app/components/view/plugin-loader-runner.client';
import type { IPluginLoaderValues } from '@/app/interfaces/plugin-loader-values.interface';
import type { IPluginsContextSurface } from '@/app/interfaces/plugins-context-surface.interface';

/**
 * Hook→class bridge for the admin plugin data layer: reads the plugins context + auth state and hands
 * them to the hook-free {@link PluginLoaderRunner}, which owns the metadata load and the HMR stream.
 */
export class PluginLoader extends Bridge<IPluginLoaderValues> {
  protected read(): IPluginLoaderValues {
    const auth = AuthHooks.useAuth();
    return {
      pluginsContext: ContextHooks.usePlugins() as unknown as IPluginsContextSurface,
      user: auth.user,
      isAuthLoading: auth.isLoading,
    };
  }

  protected present({ pluginsContext, user, isAuthLoading }: IPluginLoaderValues): ReactNode {
    return <PluginLoaderRunner pluginsContext={pluginsContext} user={user} isAuthLoading={isAuthLoading} />;
  }
}
