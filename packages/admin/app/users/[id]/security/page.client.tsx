import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/reactor';
import { UserSecurityPageClient } from '@/app/users/[id]/security/components/view/page-client.client';

// Next.js App Router route page (client component — has a class API under "use client").
export class UserSecurityPage extends PureReactor {
  render(): ReactNode {
    return <UserSecurityPageClient />;
  }
}
