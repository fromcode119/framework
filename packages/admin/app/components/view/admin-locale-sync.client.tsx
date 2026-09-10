"use client";

import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/react-class-components';
import { TranslationContext } from '@fromcode119/react';
import type { ITranslationContextValue } from '@fromcode119/react';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';

/**
 * Makes the admin honor Settings → Localization → "Admin default locale".
 *
 * The root layout hardcodes `<html lang="en">` (it is a static server shell with no settings access), and
 * the i18n provider seeds its locale from that attribute — so `admin_default_locale` was a control whose
 * value only `LocalizedField` ever read: the operator could set Bulgarian and the admin kept translating
 * into English. This closes the loop: once the signed-in shell is up, read the setting and switch the
 * live locale (and the `lang` attribute, so anything else reading it agrees).
 *
 * Renders nothing. Runs once per full page load; the localization settings page continues to own writes.
 */
export class AdminLocaleSync extends Reactor {
  static contextType = TranslationContext.Context;
  declare context: ITranslationContextValue;

  async componentDidMount(): Promise<void> {
    try {
      const settings = await AdminSystemSettingsClient.getAll();
      const configured = String(settings?.admin_default_locale ?? '').trim().toLowerCase();
      if (!configured || configured === this.context?.locale) return;
      document.documentElement.lang = configured;
      this.context?.setLocale?.(configured);
    } catch {
      // No settings (not signed in yet, API down) — keep the layout default rather than guessing.
    }
  }

  render(): ReactNode {
    return null;
  }
}
