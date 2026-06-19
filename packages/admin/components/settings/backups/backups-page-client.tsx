'use client';

import React from 'react';
import { ThemeHooks } from '@/components/use-theme';
import type { BackupsPageClientProps } from './backups-page-client.interfaces';
import { BackupsPageControllerHooks } from './backups-page-controller';
import { BackupsPageClientView } from './backups-page-client-view';

/**
 * Thin functional shim — reads the theme + controller hooks and hands their values to the
 * hook-free {@link BackupsPageClientView} class, which holds the (purely presentational) render.
 */
export function BackupsPageClient({}: BackupsPageClientProps) {
  const { theme } = ThemeHooks.useTheme();
  const controller = BackupsPageControllerHooks.useController();
  return <BackupsPageClientView theme={theme} controller={controller} />;
}
