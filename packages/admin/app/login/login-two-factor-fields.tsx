import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { TwoFactorMethod } from '@fromcode119/core/client';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { LoginPageConstants } from '@/app/login/constants/login-page.constants';
import type { ILoginFieldErrors } from '@/app/login/interfaces/login-field-errors.interface';

export class LoginTwoFactorFields extends PureReactor {
  @prop declare twoFactorMethod: TwoFactorMethod;
  @prop declare totpToken: string;
  @prop declare recoveryCode: string;
  @prop declare fieldErrors: ILoginFieldErrors;
  @prop declare onSelectMethod: (method: TwoFactorMethod) => void;
  @prop declare onTotpTokenChange: (value: string) => void;
  @prop declare onRecoveryCodeChange: (value: string) => void;

  render(): ReactNode {
    const {
      twoFactorMethod,
      totpToken,
      recoveryCode,
      fieldErrors,
      onSelectMethod,
      onTotpTokenChange,
      onRecoveryCodeChange,
    } = this;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={twoFactorMethod === TwoFactorMethod.TOTP ? ButtonVariant.PRIMARY : ButtonVariant.OUTLINE}
            size={FieldSize.SM}
            className="rounded-lg"
            onClick={() => onSelectMethod(TwoFactorMethod.TOTP)}
          >
            Authenticator Code
          </Button>
          <Button
            type="button"
            variant={twoFactorMethod === TwoFactorMethod.RECOVERY ? ButtonVariant.PRIMARY : ButtonVariant.OUTLINE}
            size={FieldSize.SM}
            className="rounded-lg"
            onClick={() => onSelectMethod(TwoFactorMethod.RECOVERY)}
          >
            Recovery Code
          </Button>
        </div>
        {twoFactorMethod === TwoFactorMethod.TOTP ? (
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
