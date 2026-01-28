"use client";

import React, { useEffect, useState } from 'react';
import { usePlugins } from '@fromcode/react';

export default function PluginLoader() {
  const { refreshVersion } = usePlugins();
  const [plugins, setPlugins] = useState<any[]>([]);
  const [theme, setTheme] = useState<any>(null);
  const [apiUrl, setApiUrl] = useState<string>('http://api.fromcode.local');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const bridgeUrl = (window as any).FROMCODE_API_URL;
        const currentApiUrl = bridgeUrl || 'http://api.fromcode.local';
        setApiUrl(currentApiUrl);

        const apiVersion = 'v1';
        const response = await fetch(`${currentApiUrl}/api/${apiVersion}/system/frontend`);
        const data = await response.json();
        setPlugins(data.plugins || []);
        setTheme(data.activeTheme || null);
      } catch (err) {
        console.error('[Frontend: Loader] Failed to fetch frontend config:', err);
      }
    };

    fetchConfig();
  }, [refreshVersion]);

  return (
    <>
      {plugins.map((plugin) => {
        if (!plugin.ui?.entry) return null;
        const scriptUrl = `${apiUrl}/plugins/${plugin.slug}/ui/${plugin.ui.entry}`;
        return <script key={plugin.slug} src={scriptUrl} type="module" async />;
      })}
      {theme && theme.ui?.entry && (
        <script key={`theme-${theme.slug}`} src={`${apiUrl}/themes/${theme.slug}/ui/${theme.ui.entry}`} type="module" async />
      )}
    </>
  );
}
