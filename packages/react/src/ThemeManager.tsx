"use client";

import React, { useEffect } from 'react';
import { usePlugins } from './context';

export const ThemeManager = ({ apiUrl }: { apiUrl: string }) => {
  const { themeVariables, refreshVersion } = usePlugins();

  useEffect(() => {
    // Apply variables to :root
    const root = document.documentElement;
    Object.entries(themeVariables).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });
  }, [themeVariables]);

  return null;
};
