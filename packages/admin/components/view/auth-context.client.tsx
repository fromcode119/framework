import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Bridge, prop } from '@fromcode119/reactor';
import { AuthProviderView } from '@/components/view/auth-provider-view.client';
import type { IAuthContextBridgeValues } from '@/components/interfaces/auth-context-bridge-values.interface';

/**
 * Hook→class bridge — reads the `useRouter()` hook and hands it to the hook-free
 * {@link AuthProviderView} class, which holds the user/isLoading state and the hydrate effect.
 */
export class AuthProvider extends Bridge<IAuthContextBridgeValues> {
  @prop declare children: ReactNode;

  protected read(): IAuthContextBridgeValues {
    return { router: useRouter() };
  }

  protected present({ router }: IAuthContextBridgeValues): ReactNode {
    return <AuthProviderView router={router}>{this.children}</AuthProviderView>;
  }
}
