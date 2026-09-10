import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/react-class-components';
import { PluginHealthPageClient } from '@/app/plugins/health/components/view/page-client.client';

// Next.js App Router route page — client component class (hook-free, reactor OOP).
export class PluginHealthPage extends PureReactor {
  render(): ReactNode {
    return <PluginHealthPageClient />;
  }
}
