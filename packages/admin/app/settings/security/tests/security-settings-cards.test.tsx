import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import { SecuritySettingsCards } from '@/app/settings/security/security-settings-cards';
import { SecuritySettingsKeys } from '@/app/settings/security/security-settings-keys';

/**
 * The Security form renders the RIGHT KIND of control for each setting, and covers every key it owns.
 *
 * A boolean drawn as a text box is a bug even when the stored value is correct — the operator ends up
 * typing `true`/`false` into a free-text field and the platform enforces whatever lands there. Every
 * true/false setting must be a toggle, and every bounded number must carry the bounds the server
 * clamps to, so no value the operator can enter is silently rewritten afterwards.
 */

/** Row titles for the true/false settings — each must render a switch, never an input or a select. */
const TOGGLES: ReadonlyArray<readonly [string, string]> = [
  ['Two-Factor Security', SystemConstants.META_KEY.TWO_FACTOR_ENABLED],
  ['Security Notification Emails', SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS],
  ['Require an Uppercase Letter', SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_UPPERCASE],
  ['Require a Lowercase Letter', SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_LOWERCASE],
  ['Require a Number', SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_NUMBER],
  ['Require a Symbol', SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_SYMBOL],
  ['Check Against Known Breaches', SystemConstants.META_KEY.AUTH_PASSWORD_BREACH_CHECK],
  ['Require Captcha After Repeated Failures', SystemConstants.META_KEY.AUTH_CAPTCHA_ENABLED],
];

/** Row titles for the bounded numbers, with the bounds the auth policy clamps each one to. */
const BOUNDED_NUMBERS: ReadonlyArray<readonly [string, number, number]> = [
  ['Login Session Duration (minutes)', 15, 43200],
  ['Minimum Password Length', 8, 128],
  ['Password History (reuse blocked)', 0, 20],
  ['Failed Logins Before Lockout', 1, 50],
  ['Failed Login Window (minutes)', 1, 1440],
  ['Lockout Duration (minutes)', 1, 43200],
  ['Failed Logins Before Captcha', 1, 50],
  ['Password Reset Link Lifetime (minutes)', 5, 1440],
  ['Email Change Link Lifetime (minutes)', 10, 1440],
];

/** Every key the screen owns, loaded the way the page loads it: server strings, verbatim. */
const settings = (): Record<string, string> =>
  Object.fromEntries(SecuritySettingsKeys.ALL.map((key) => [key, 'true']));

/** The row container for a setting, found by its visible title. */
const rowFor = (title: string): HTMLElement => {
  const heading = screen.getByText(title);
  const row = heading.closest('div.py-4');
  expect(row, `no row rendered for "${title}"`).not.toBeNull();
  return row as HTMLElement;
};

const renderCards = () =>
  render(
    <SecuritySettingsCards settings={settings()} setSettings={vi.fn()} theme={ThemeMode.LIGHT} />,
  );

describe('Settings -> Security controls', () => {
  it.each(TOGGLES)('renders %s as a toggle, not text and not a select', (title) => {
    renderCards();
    const row = rowFor(title);

    expect(row.querySelector('[role="switch"]')).not.toBeNull();
    expect(row.querySelector('select')).toBeNull();
    expect(row.querySelector('input[type="text"]')).toBeNull();
  });

  it.each(BOUNDED_NUMBERS)('renders %s as a number input bounded %i-%i', (title, min, max) => {
    renderCards();
    const input = rowFor(title).querySelector('input[type="number"]');

    expect(input, `no number input rendered for "${title}"`).not.toBeNull();
    expect(input?.getAttribute('min')).toBe(String(min));
    expect(input?.getAttribute('max')).toBe(String(max));
  });

  it('reflects the stored value in the toggle rather than inventing one', () => {
    render(
      <SecuritySettingsCards
        settings={{ ...settings(), [SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_SYMBOL]: 'false' }}
        setSettings={vi.fn()}
        theme={ThemeMode.LIGHT}
      />,
    );

    expect(rowFor('Require a Symbol').querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false');
    expect(rowFor('Require a Number').querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
  });

  it('renders the internal-clients allowlist as a free-text field, since it holds a list of addresses', () => {
    renderCards();
    const input = rowFor('Internal Service Clients').querySelector('input');

    expect(input).not.toBeNull();
    expect(input?.getAttribute('type')).not.toBe('number');
  });

  it('renders a control for EVERY key the page loads and saves', () => {
    const { container } = renderCards();
    const controls = container.querySelectorAll('[role="switch"], input');

    expect(controls.length).toBe(SecuritySettingsKeys.ALL.length);
  });
});
