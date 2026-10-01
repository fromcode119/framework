import { VerificationStatus } from '@/app/verify-email/enums/verification-status.enum';
import type { ChangeEvent } from 'react';
import Link from 'next/link';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';

export class VerifyEmailVerificationCard extends PureReactor {
  @prop declare token: string;
  @prop declare status: VerificationStatus;
  @prop declare message: string;
  @prop declare verificationTokenLabel: string;
  @prop declare verificationTokenPlaceholder: string;
  @prop declare verifyingLabel: string;
  @prop declare verifyButtonLabel: string;
  @prop declare goToLoginLabel: string;
  @prop declare verificationErrorNote: string;
  @prop declare onTokenChange: (value: string) => void;
  @prop declare onVerify: () => void;

  @bound
  handleTokenChange(event: ChangeEvent<HTMLInputElement>): void {
    this.onTokenChange(event.target.value);
  }

  render() {
    return (
      <div className="fc-auth-card fc-auth-card-primary fc-auth__card">
        <label className="fc-auth-field fc-auth__field">
          <span className="fc-auth-field-label fc-auth__label">{this.verificationTokenLabel}</span>
          <input
            className="fc-auth-input fc-auth__input"
            value={this.token}
            onChange={this.handleTokenChange}
            placeholder={this.verificationTokenPlaceholder}
          />
        </label>

        <button
          type="button"
          onClick={this.onVerify}
          disabled={this.status === VerificationStatus.VERIFYING}
          className="fc-auth-button fc-auth-button-primary fc-auth__button"
        >
          {this.status === VerificationStatus.VERIFYING ? this.verifyingLabel : this.verifyButtonLabel}
        </button>

        {this.message ? (
          <div
            className={`fc-auth-alert ${this.status === VerificationStatus.ERROR ? 'fc-auth__error' : 'fc-auth__notice'}`}
          >
            {this.message}
          </div>
        ) : null}

        {this.status === VerificationStatus.SUCCESS ? (
          <p className="fc-auth-card-link-row">
            <Link href="/login" className="fc-auth-inline-link fc-auth__link">
              {this.goToLoginLabel}
            </Link>
          </p>
        ) : null}

        {this.status === VerificationStatus.ERROR ? (
          <p className="fc-auth-card-note">
            {this.verificationErrorNote}
          </p>
        ) : null}
      </div>
    );
  }
}
