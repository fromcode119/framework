"use client";

import React, { useEffect } from 'react';
import { usePlugins } from '@fromcode/react';

export default function ThemeInitializer() {
  const { loadFrontendConfig, themeVariables } = usePlugins();

  useEffect(() => {
    loadFrontendConfig();
  }, [loadFrontendConfig]);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(themeVariables).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });
  }, [themeVariables]);

  return null;
}
