import { ContextBridge } from '@fromcode119/react';
import { AccountDashboard } from './dashboard';
import { AccountDashboardHero } from './dashboard-hero';
import { AccountTabNavigation } from './tab-navigation';
import { AccountOverviewPanel } from './overview-panel';
import { AccountOrdersPanel } from './orders-panel';
import { AccountProfileCard } from './profile-card';
import { AccountSecurityCard } from './security-card';
import { AccountSessionCard } from './session-card';
import { AccountTwoFactorCard } from './two-factor-card';

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
