import { SystemConstants } from '@fromcode119/core/client';
import type { ComponentType, ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingListValue } from '@/app/settings/security/setting-list-value';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What protects the platform right now, read from the saved Security settings — the same values the
 * Settings tab edits, stated as a sentence each, with whether the switch is on. Nothing here is a
 * separate reading that could disagree with the form.
 */
export class SecurityProtectionSummary extends PureReactor {
  declare props: Pick<SecurityProtectionSummary, 'settings' | 'onOpenSettings'>;

  @prop declare settings: Record<string, string>;
  @prop declare onOpenSettings: () => void;

  private value(key: string): string {
    return String(this.settings?.[key] ?? '').trim();
  }

  private on(key: string): boolean {
    return this.value(key) === 'true';
  }

  private row(icon: ComponentType<{ size?: number; className?: string }>, title: string, detail: string, active: boolean): ReactNode {
    const Icon = icon;
    return (
      <li key={title} className="flex items-start justify-between gap-4 py-3 border-b last:border-0 border-slate-100 dark:border-slate-800">
        <div className="flex gap-3">
          <Icon size={16} className="mt-0.5 text-indigo-500" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{title}</p>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">{detail}</p>
          </div>
        </div>
        <Badge variant={active ? BadgeVariant.SUCCESS : BadgeVariant.GRAY}>
          {active ? AdminI18n.t('settings.security.summaryOn') : AdminI18n.t('settings.security.summaryOff')}
        </Badge>
      </li>
    );
  }

  render(): ReactNode {
    const keys = SystemConstants.META_KEY;
    const perVisitor = Number(this.value(keys.EDGE_RATE_LIMIT_PER_MINUTE) || 0);
    const relays = SettingListValue.parse(this.value(keys.TRUSTED_RELAYS));
    return (
      <Card title={AdminI18n.t('settings.security.summaryTitle')}>
        <ul className="pt-1">
          {this.row(FrameworkIcons.Lock, AdminI18n.t('settings.security.failedLoginsBeforeLockout'),
            AdminI18n.t('settings.security.summaryLockout', { count: this.value(keys.AUTH_LOCKOUT_THRESHOLD), minutes: this.value(keys.AUTH_LOCKOUT_DURATION_MINUTES) }), true)}
          {this.row(FrameworkIcons.Lock, AdminI18n.t('settings.security.failedLoginsPerAddress'),
            AdminI18n.t('settings.security.summaryAddressLockout', { count: this.value(keys.AUTH_LOCKOUT_ADDRESS_THRESHOLD) }), true)}
          {this.row(FrameworkIcons.Mail, AdminI18n.t('settings.security.passwordResetLimit'),
            AdminI18n.t('settings.security.summaryResetLimit', { count: this.value(keys.AUTH_PASSWORD_RESET_LIMIT) }), true)}
          {this.row(FrameworkIcons.Fingerprint, AdminI18n.t('settings.security.summaryTwoFactor'),
            AdminI18n.t('settings.security.summaryTwoFactorDetail'), this.on(keys.TWO_FACTOR_ENABLED))}
          {this.row(FrameworkIcons.ShieldAlert, AdminI18n.t('settings.security.underAttackMode'),
            AdminI18n.t('settings.security.summaryUnderAttack'), this.on(keys.EDGE_UNDER_ATTACK))}
          {this.row(FrameworkIcons.Shield, AdminI18n.t('settings.security.blockAttackPatterns'),
            AdminI18n.t('settings.security.summaryAttackPatterns'), this.on(keys.EDGE_BLOCK_ATTACK_PATTERNS))}
          {this.row(FrameworkIcons.Activity, AdminI18n.t('settings.security.visitorRequestsPerMinute'),
            perVisitor > 0 ? AdminI18n.t('settings.security.summaryPerVisitor', { count: perVisitor }) : AdminI18n.t('settings.security.summaryPerVisitorOff'), perVisitor > 0)}
          {this.row(FrameworkIcons.Globe, AdminI18n.t('settings.security.trustedRelays'),
            relays.length ? relays.join(', ') : AdminI18n.t('settings.security.trustedRelaysNone'), relays.length > 0)}
        </ul>
        <div className="pt-3">
          <Button variant={ButtonVariant.OUTLINE} size={FieldSize.SM} onClick={this.onOpenSettings}>{AdminI18n.t('settings.security.summaryChange')}</Button>
        </div>
      </Card>
    );
  }
}
