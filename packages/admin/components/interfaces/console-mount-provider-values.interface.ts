import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export interface IConsoleMountProviderValues {
  router: AppRouterInstance | null;
  pathname: string | null;
}
