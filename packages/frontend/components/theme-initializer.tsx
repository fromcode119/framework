"use client";

import React, { useEffect } from 'react';
import { SystemConstants } from '@fromcode119/sdk';
import { ContextHooks } from '@fromcode119/react';

export default function ThemeInitializer() {
  const { loadConfig, themeVariables } = ContextHooks.usePlugins();

  useEffect(() => {
    loadConfig(SystemConstants.API_PATH.SYSTEM.FRONTEND);
  }, [loadConfig]);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(themeVariables).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });
  }, [themeVariables]);

  return null;
}
