import { VerificationStatus } from '@/app/verify-email/enums/verification-status.enum';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import { PureReactor, prop, bound } from '@fromcode119/reactor';

export class VerifyEmailResendCard extends PureReactor {
  @prop declare email: string;
  @prop declare isResending: boolean;
  @prop declare resendMessage: string;
  @prop declare resendStatus: VerificationStatus;
  @prop declare resendVerificationUrl: string;
  @prop declare resendTitle: string;
  @prop declare resendDescription: string;
  @prop declare emailLabel: string;
  @prop declare resendSendingLabel: string;
  @prop declare resendButtonLabel: string;
  @prop declare openVerificationLinkLabel: string;
  @prop declare goToLoginLabel: string;
  @prop declare onEmailChange: (value: string) => void;
  @prop declare onSubmit: (event: FormEvent) => void;

  @bound
  handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    this.onEmailChange(event.target.value);
  }

  render(): ReactNode {
    return (
      <form onSubmit={this.onSubmit} className="fc-auth-card fc-auth-card-secondary">
        <h2 className="fc-auth-secondary-title">{this.resendTitle}</h2>
        <p className="fc-auth-secondary-copy">{this.resendDescription}</p>
        <label className="fc-auth-field">
          <span className="fc-auth-field-label">{this.emailLabel}</span>
          <input
            type="email"
            className="fc-auth-input"
            value={this.email}
            onChange={this.handleEmailChange}
            placeholder="you@example.com"
            required
          />
        </label>
        <button
          type="submit"
          disabled={this.isResending}
          className="fc-auth-button fc-auth-button-secondary"
        >
          {this.isResending ? this.resendSendingLabel : this.resendButtonLabel}
        </button>

        {this.resendMessage ? (
          <div
            className={`fc-auth-alert ${
              this.resendStatus === VerificationStatus.SUCCESS
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            <p>{this.resendMessage}</p>
            {this.resendVerificationUrl ? (
              <p className="fc-auth-card-link-row">
                <a
                  href={this.resendVerificationUrl}
                  className="fc-auth-inline-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {this.openVerificationLinkLabel}
                </a>
              </p>
            ) : null}
            {this.resendStatus === VerificationStatus.SUCCESS ? (
              <p className="fc-auth-card-link-row">
                <Link href="/login" className="fc-auth-inline-link">
                  {this.goToLoginLabel}
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}
      </form>
    );
  }
}
