import { ContextBridge } from '@fromcode119/react/context-bridge';
import { AccountDashboard } from '@/components/account/dashboard';
import { AccountDashboardHero } from '@/components/account/dashboard-hero';
import { AccountTabNavigation } from '@/components/account/tab-navigation';
import { AccountOverviewPanel } from '@/components/account/overview-panel';
import { AccountOrdersPanel } from '@/components/account/orders-panel';
import { AccountProfileCard } from '@/components/account/profile-card';
import { AccountSecurityCard } from '@/components/account/security-card';
import { AccountSessionCard } from '@/components/account/session-card';
import { AccountTwoFactorCard } from '@/components/account/two-factor-card';

export class AccountSlotRegistrar {
  static register(): void {
    ContextBridge.registerOverride('account.dashboard', AccountDashboard, 'framework', 3);
    ContextBridge.registerOverride('account.dashboard-hero', AccountDashboardHero, 'framework', 3);
    ContextBridge.registerOverride('account.tab-navigation', AccountTabNavigation, 'framework', 3);
    ContextBridge.registerOverride('account.overview-panel', AccountOverviewPanel, 'framework', 3);
    ContextBridge.registerOverride('account.orders-panel', AccountOrdersPanel, 'framework', 3);
    ContextBridge.registerOverride('account.profile-card', AccountProfileCard, 'framework', 3);
    ContextBridge.registerOverride('account.security-card', AccountSecurityCard, 'framework', 3);
    ContextBridge.registerOverride('account.session-card', AccountSessionCard, 'framework', 3);
    ContextBridge.registerOverride('account.two-factor-card', AccountTwoFactorCard, 'framework', 3);
  }
}
