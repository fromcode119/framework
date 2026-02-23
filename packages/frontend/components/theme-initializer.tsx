"use client";

import React, { useEffect } from 'react';
import { usePlugins } from '@fromcode119/react';

export default function ThemeInitializer() {
  const { loadConfig, themeVariables } = usePlugins();

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(themeVariables).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });
  }, [themeVariables]);

  return null;
}
