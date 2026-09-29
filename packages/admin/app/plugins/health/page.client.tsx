import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/react-class-components';
import { PluginHealthPageClient } from '@/app/plugins/health/components/view/page-client.client';
import { PlatformScopeGate } from '@/components/view/platform-scope-gate.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

// Next.js App Router route page — client component class (hook-free, reactor OOP).
export class PluginHealthPage extends PureReactor {
  render(): ReactNode {
    return <PlatformScopeGate what={AdminI18n.t('plugins.list.pluginHealth')}><PluginHealthPageClient /></PlatformScopeGate>;
  }
}
