import { VerificationStatus } from '@/app/verify-email/enums/verification-status.enum';
import type { ChangeEvent } from 'react';
import Link from 'next/link';
import { PureReactor, prop, bound } from '@fromcode119/reactor';

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
      <div className="fc-auth-card fc-auth-card-primary">
        <label className="fc-auth-field">
          <span className="fc-auth-field-label">{this.verificationTokenLabel}</span>
          <input
            className="fc-auth-input"
            value={this.token}
            onChange={this.handleTokenChange}
            placeholder={this.verificationTokenPlaceholder}
          />
        </label>

        <button
          type="button"
          onClick={this.onVerify}
          disabled={this.status === VerificationStatus.VERIFYING}
          className="fc-auth-button fc-auth-button-primary"
        >
          {this.status === VerificationStatus.VERIFYING ? this.verifyingLabel : this.verifyButtonLabel}
        </button>

        {this.message ? (
          <div
            className={`fc-auth-alert ${
              this.status === VerificationStatus.SUCCESS
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : this.status === VerificationStatus.ERROR
                  ? 'border border-rose-200 bg-rose-50 text-rose-700'
                  : 'border border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            {this.message}
          </div>
        ) : null}

        {this.status === VerificationStatus.SUCCESS ? (
          <p className="fc-auth-card-link-row">
            <Link href="/login" className="fc-auth-inline-link">
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
