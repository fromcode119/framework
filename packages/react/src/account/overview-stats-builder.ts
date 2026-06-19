import { AccountRouteUtils } from '@fromcode119/core/client';

/**
 * Builds the framework account-overview stat cards from the raw responses of the installed plugins'
 * account APIs (ecommerce orders, mlm portal points/partner, subscriptions, lms enrollments). Every
 * source is optional: a card is produced only when its plugin actually responded, so the overview
 * adapts to whatever plugins are installed without the framework hard-depending on any of them.
 * Returns plain card descriptors (`{ key, label, value, sub, href, accent }`) for the panel to render.
 */
export class AccountOverviewStatsBuilder {
  static build(data: any, t: (key: string, params?: any, fallback?: string) => string): any[] {
    const cards: any[] = [];
    const add = (card: any) => { if (card) cards.push(card); };
    add(AccountOverviewStatsBuilder.orders(data?.orders, t));
    add(AccountOverviewStatsBuilder.points(data?.portal, t));
    add(AccountOverviewStatsBuilder.subscription(data?.sub, t));
    add(AccountOverviewStatsBuilder.courses(data?.courses, t));
    add(AccountOverviewStatsBuilder.partner(data?.portal, t));
    return cards;
  }

  private static num(value: any): number {
    if (value && typeof value === 'object') return Number(value.amount ?? value.value ?? value.total ?? 0) || 0;
    return Number(value) || 0;
  }

  // The framework is DOMAIN-AGNOSTIC: it does no currency validation or locale
  // currency formatting (that is a Finance concern). It only joins the value it was
  // handed with the code the data carried. (Ideal next step: each plugin contributes
  // its own overview card via a registry so it formats its own money — see CLAUDE.md.)
  private static money(amount: number, currency: any): string {
    const code = currency && typeof currency === 'object'
      ? String(currency.code ?? currency.currency ?? '')
      : String(currency ?? '');
    const suffix = code ? ` ${code}` : '';
    return `${amount.toFixed(2)}${suffix}`;
  }

  private static toRows(res: any, ...keys: string[]): any[] {
    for (const key of keys) { if (Array.isArray(res?.[key])) return res[key]; if (Array.isArray(res?.data?.[key])) return res.data[key]; }
    if (Array.isArray(res?.data?.docs)) return res.data.docs;
    if (Array.isArray(res?.docs)) return res.docs;
    if (Array.isArray(res?.data)) return res.data;
    return Array.isArray(res) ? res : [];
  }

  private static orders(res: any, t: any): any | null {
    if (!res) return null;
    const rows = AccountOverviewStatsBuilder.toRows(res, 'orders');
    const total = rows.reduce((sum, order) => sum + AccountOverviewStatsBuilder.num(order?.total ?? order?.totalAmount), 0);
    const currency = rows[0]?.currency ?? (rows[0]?.total && typeof rows[0].total === 'object' ? rows[0].total.currency : null);
    const spent = AccountOverviewStatsBuilder.money(total, currency);
    return {
      key: 'orders',
      label: t('account.overview.stats.orders', undefined, 'Orders'),
      value: String(rows.length),
      sub: t('account.overview.stats.totalSpent', { amount: spent }, `${spent} total spent`),
      href: AccountRouteUtils.sectionPath('orders'),
      accent: '#f59e0b',
    };
  }

  private static points(portal: any, t: any): any | null {
    const points = portal?.points;
    if (!points || points.balance === undefined || points.balance === null) return null;
    const balance = Number(points.balance) || 0;
    const eur = AccountOverviewStatsBuilder.money(Number(points.balanceEur) || 0, 'EUR');
    return {
      key: 'points',
      label: t('account.overview.stats.points', undefined, 'Reward points'),
      value: balance.toLocaleString(),
      sub: t('account.overview.stats.pointsValue', { amount: eur }, `worth ${eur}`),
      // The MLM partner section is registered under key 'affiliate' (/account/affiliate) —
      // the points + code cards previously linked to /account/partner, a dead route that
      // fell back to the overview, so clicking them did nothing.
      href: AccountRouteUtils.sectionPath('affiliate'),
      accent: '#7c3aed',
    };
  }

  private static subscription(sub: any, t: any): any | null {
    if (!sub) return null;
    const active = Boolean(sub.active);
    const plan = sub.plan || {};
    if (!active && !plan?.name && !sub.status) return null;
    const value = String(plan?.name || (active ? t('account.overview.stats.subActive', undefined, 'Active') : t('account.overview.stats.subInactive', undefined, 'None')));
    const price = plan?.price !== undefined ? AccountOverviewStatsBuilder.money(Number(plan.price) || 0, plan.currency) : '';
    return {
      key: 'subscription',
      label: t('account.overview.stats.subscription', undefined, 'Subscription'),
      value,
      sub: price ? t('account.overview.stats.subPrice', { amount: price }, price) : '',
      href: AccountRouteUtils.sectionPath('subscription'),
      accent: '#0ea5e9',
    };
  }

  private static courses(res: any, t: any): any | null {
    if (!res) return null;
    const rows = AccountOverviewStatsBuilder.toRows(res, 'enrollments', 'courses');
    const completed = rows.filter((row: any) => ['completed', 'complete', 'finished'].includes(String(row?.status || '').trim().toLowerCase())).length;
    return {
      key: 'courses',
      label: t('account.overview.stats.courses', undefined, 'Courses'),
      value: String(rows.length),
      sub: t('account.overview.stats.coursesCompleted', { count: completed }, `${completed} completed`),
      href: AccountRouteUtils.sectionPath('courses'),
      accent: '#16a34a',
    };
  }

  private static partner(portal: any, t: any): any | null {
    const code = String(portal?.affiliate?.code || '').trim();
    if (!code) return null;
    const earned = AccountOverviewStatsBuilder.money(Number(portal?.stats?.totalCommissions) || 0, 'EUR');
    return {
      key: 'partner',
      label: t('account.overview.stats.partner', undefined, 'Partner code'),
      value: code,
      sub: t('account.overview.stats.commissionsEarned', { amount: earned }, `${earned} earned`),
      href: AccountRouteUtils.sectionPath('affiliate'),
      accent: '#e11d48',
    };
  }
}
