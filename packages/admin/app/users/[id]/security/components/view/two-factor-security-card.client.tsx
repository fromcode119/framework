import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Alert } from '@/components/ui/view/alert.client';
import { Button } from '@/components/ui/view/button.client';
import { Hint } from '@/components/ui/view/hint.client';
import { Label } from '@/components/ui/view/label.client';
import { OtpInput } from '@/components/ui/view/otp-input.client';
import { CopyValue } from '@/components/ui/view/copy-value.client';
import { CodeBlock } from '@/components/ui/view/code-block.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';
import { AdminLink } from '@/components/view/admin-link.client';
import { SecurityTab } from '@/app/settings/security/enums/security-tab.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Two-factor sign-in for one account: its state in the card's head, and below it the one thing that can
 * be done next — turn it on, finish setting it up, or manage it once it is on.
 */
export class TwoFactorSecurityCard extends PureReactor {
  @prop declare generatedRecoveryCodes: string[];
  @prop declare onDisable: () => void;
  @prop declare onEnable: () => Promise<void>;
  @prop declare onRegenerate: () => void;
  @prop declare onVerify: () => Promise<void>;
  @prop declare onCopyRecoveryCodes: () => Promise<void>;
  @prop declare isAdministrator: boolean;
  @prop declare isEnabling: boolean;
  @prop declare isRegeneratingCodes: boolean;
  @prop declare isVerifying: boolean;
  @prop declare qrCode: string | null;
  @prop declare recoveryCodesRemaining: number;
  @prop declare secret: string | null;
  @prop declare setVerificationCode: (value: string) => void;
  @prop declare twoFactorEnabled: boolean;
  /** False when the platform's two-factor switch is off: nothing can be set up, so the card says where it is switched. */
  @prop declare twoFactorAvailable: boolean;
  @prop declare verificationCode: string;

  private renderOff(): ReactNode {
    if (!this.twoFactorAvailable) {
      return (
        <Alert tone="info" action={<AdminLink href={`${AdminConstants.ROUTES.SETTINGS.SECURITY}?tab=${SecurityTab.SETTINGS.value}`}><Button variant={ButtonVariant.SECONDARY}>{AdminI18n.t('users.openSecuritySettings')}</Button></AdminLink>}>
          {AdminI18n.t('users.twoFactorTurnedOff')}
        </Alert>
      );
    }
    return (
      <div className="fc-form-stack">
        {this.isAdministrator ? <Alert tone="warning">{AdminI18n.t('users.fullSystemAccess2faStrongly')}</Alert> : null}
        <Hint>{AdminI18n.t('users.enableTwoFactorAuthenticationTo')}</Hint>
        <div><Button onClick={this.onEnable} isLoading={this.isEnabling} icon={<FrameworkIcons.ShieldCheck size={15} />}>{AdminI18n.t('users.enable2fa')}</Button></div>
      </div>
    );
  }

  private renderSetup(): ReactNode {
    const setup = AdminClass.of('twofactor-setup');
    return (
      <div className="fc-form-stack">
        <div className="fc-field-stack">
          <Label>{AdminI18n.t('users.step1ScanQrCode')}</Label>
          <Hint>{AdminI18n.t('users.useAnAuthenticatorAppLike')}</Hint>
          <img src={this.qrCode || ''} alt={AdminI18n.t('users.2faQrCode')} className={`${setup}__qr`} />
          {this.secret ? <div className="fc-field-stack"><Label>{AdminI18n.t('users.manualEntryCode')}</Label><CopyValue value={this.secret}><code>{this.secret}</code></CopyValue></div> : null}
        </div>
        <div className="fc-field-stack">
          <Label>{AdminI18n.t('users.step2VerifyCode')}</Label>
          <Hint>{AdminI18n.t('users.enterThe6DigitCode')}</Hint>
          <div className={`${setup}__verify`}>
            <OtpInput value={this.verificationCode} onChange={this.setVerificationCode} length={6} groupSize={3} label={AdminI18n.t('users.step2VerifyCode')} />
            <Button onClick={this.onVerify} isLoading={this.isVerifying} disabled={this.verificationCode.length !== 6} icon={<FrameworkIcons.Check size={15} />}>{AdminI18n.t('users.verifyEnable')}</Button>
          </div>
        </div>
      </div>
    );
  }

  private renderOn(): ReactNode {
    return (
      <div className="fc-form-stack">
        <Hint>{AdminI18n.t('users.thisAccountRequiresA6')}</Hint>
        <Hint>{AdminI18n.t('users.recoveryCodesRemaining')} {this.recoveryCodesRemaining}</Hint>
        <div className="fc-chip-row">
          <Button onClick={this.onRegenerate} variant={ButtonVariant.OUTLINE} isLoading={this.isRegeneratingCodes} icon={<FrameworkIcons.Refresh size={15} />}>{AdminI18n.t('users.regenerateRecoveryCodes')}</Button>
          <Button onClick={this.onDisable} variant={ButtonVariant.OUTLINE}>{AdminI18n.t('users.disable2fa')}</Button>
        </div>
      </div>
    );
  }

  private renderCodes(): ReactNode {
    if (this.generatedRecoveryCodes.length === 0) return null;
    return (
      <Alert tone="warning" title={AdminI18n.t('users.recoveryCodes')}
        action={<Button onClick={this.onCopyRecoveryCodes} variant={ButtonVariant.OUTLINE} icon={<FrameworkIcons.Copy size={15} />}>{AdminI18n.t('users.copy')}</Button>}>
        <div className="fc-form-stack">
          <span>{AdminI18n.t('users.eachCodeCanBeUsed')}</span>
          <CodeBlock code={this.generatedRecoveryCodes.join('\n')} />
        </div>
      </Alert>
    );
  }

  render(): ReactNode {
    const body = this.twoFactorEnabled ? this.renderOn() : this.qrCode ? this.renderSetup() : this.renderOff();
    return (
      <Card
        title={AdminI18n.t('users.twoFactorAuthentication')}
        description={AdminI18n.t('users.addAnExtraLayerOf')}
        actions={<StateBadge tone={this.twoFactorEnabled ? 'success' : 'default'}>{AdminI18n.t(this.twoFactorEnabled ? 'common.enabled' : 'common.disabled')}</StateBadge>}
      >
        <div className="fc-form-stack">
          {body}
          {this.renderCodes()}
        </div>
      </Card>
    );
  }
}
