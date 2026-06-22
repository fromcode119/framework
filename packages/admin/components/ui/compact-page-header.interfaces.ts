import type React from 'react';

export interface CompactPageHeaderProps {
  /** Accepted for backward-compat and ignored — theming is via Tailwind `dark:` classes. */
  theme?: string;
  /** Optional lucide icon element shown in the indigo badge (e.g. <FrameworkIcons.Shield size={18} />). */
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Render a back button linking here (takes precedence over onBack). */
  backHref?: string;
  /** Render a back button calling this handler. */
  onBack?: () => void;
  /** Right-side action buttons. */
  actions?: React.ReactNode;
}
