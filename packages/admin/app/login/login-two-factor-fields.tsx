import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoginPageConstants } from './login-page.constants';
import type { LoginTwoFactorFieldsProps } from './login-form.interfaces';

export class LoginTwoFactorFields extends React.Component<LoginTwoFactorFieldsProps> {
  render(): React.ReactNode {
    const {
      twoFactorMethod,
      totpToken,
      recoveryCode,
      fieldErrors,
      onSelectMethod,
      onTotpTokenChange,
      onRecoveryCodeChange,
    } = this.props;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={twoFactorMethod === 'totp' ? 'primary' : 'outline'}
            size="sm"
            className="rounded-lg"
            onClick={() => onSelectMethod('totp')}
          >
            Authenticator Code
          </Button>
          <Button
            type="button"
            variant={twoFactorMethod === 'recovery' ? 'primary' : 'outline'}
            size="sm"
            className="rounded-lg"
            onClick={() => onSelectMethod('recovery')}
          >
            Recovery Code
          </Button>
        </div>
        {twoFactorMethod === 'totp' ? (
          <Input
            label="2FA Code"
            placeholder="123456"
            type="text"
            required
            autoComplete="one-time-code"
            value={totpToken}
            onChange={(e) => onTotpTokenChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={fieldErrors.totpToken}
            inputClassName={LoginPageConstants.loginInputClassName}
          />
        ) : (
          <Input
            label="Recovery Code"
            placeholder="ABCDE-12345"
            type="text"
            required
            value={recoveryCode}
            onChange={(e) => onRecoveryCodeChange(e.target.value.toUpperCase())}
            error={fieldErrors.recoveryCode}
            inputClassName={LoginPageConstants.loginInputClassName}
          />
        )}
      </div>
    );
  }
}
