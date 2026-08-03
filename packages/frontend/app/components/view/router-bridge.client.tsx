import { Bridge } from '@fromcode119/reactor';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { RouterNavigationListener } from '@/app/components/view/router-navigation-listener.client';
import type { IRouterBridgeValues } from '@/app/interfaces/router-bridge-values.interface';

/** Hook→class bridge: reads `useRouter()` and hands it to the hook-free listener class. */
export class RouterBridge extends Bridge<IRouterBridgeValues> {
  protected read(): IRouterBridgeValues {
    return { router: useRouter() };
  }

  protected present({ router }: IRouterBridgeValues): ReactNode {
    return <RouterNavigationListener router={router} />;
  }
}
