"use client";

import React, { useEffect } from 'react';
import { usePlugins } from '@fromcode119/react';
import { resolveFrontendApiBaseUrl } from '../lib/api-base-url';

export default function PluginLoader() {
  const { plugins, activeTheme, api } = usePlugins();
  const apiUrl =
    (typeof api?.getBaseUrl === 'function' && api.getBaseUrl()) ||
    resolveFrontendApiBaseUrl();
  const theme = activeTheme;
  const pluginList = Array.isArray(plugins) ? plugins : [];

  useEffect(() => {
    if (typeof document === 'undefined') return;

    for (const plugin of pluginList) {
      const injections = Array.isArray(plugin?.ui?.headInjections) ? plugin.ui.headInjections : [];
      for (const injection of injections) {
        const tag = String(injection?.tag || '').trim().toLowerCase();
        if (!tag) continue;

        const props = (injection?.props && typeof injection.props === 'object') ? injection.props : {};
        const uniqueKey =
          props.id ||
          props.src ||
          props.href ||
          props.name;

        if (uniqueKey) {
          const selector = `${tag}[id="${uniqueKey}"], ${tag}[src="${uniqueKey}"], ${tag}[href="${uniqueKey}"], ${tag}[name="${uniqueKey}"]`;
          if (document.head.querySelector(selector)) continue;
        }

        const element = document.createElement(tag);
        Object.entries(props).forEach(([key, rawValue]) => {
          let value = String(rawValue);
          if ((key === 'src' || key === 'href') && value.startsWith('/plugins/')) {
            value = `${apiUrl}${value}`;
          }
          element.setAttribute(key, value);
        });
        document.head.appendChild(element);
      }
    }
  }, [pluginList, apiUrl]);

  return (
    <>
      {pluginList.map((plugin: any) => {
        if (!plugin.ui?.entry) return null;
        const scriptUrl = `${apiUrl}/plugins/${plugin.slug}/ui/${plugin.ui.entry}`;
        return <script key={plugin.slug} src={scriptUrl} type="module" async />;
      })}
      {pluginList.flatMap((plugin: any) => {
        const css = plugin?.ui?.css;
        if (!css) return [];
        const cssList = Array.isArray(css) ? css : [css];
        return cssList.map((style: string) => (
          <link
            key={`plugin-css-${plugin.slug}-${style}`}
            rel="stylesheet"
            href={`${apiUrl}/plugins/${plugin.slug}/ui/${style}`}
          />
        ));
      })}
      {theme && theme.ui?.entry && (
        <script key={`theme-js-${theme.slug}`} src={`${apiUrl}/themes/${theme.slug}/ui/${theme.ui.entry}`} type="module" async />
      )}
      {(() => {
        const css = theme?.ui?.css || theme?.ui?.styles;
        if (!css) return null;
        const cssArray = Array.isArray(css) ? css : [css];
        return cssArray.map((style: string) => (
          <link key={`theme-css-${theme.slug}-${style}`} rel="stylesheet" href={`${apiUrl}/themes/${theme.slug}/ui/${style}`} />
        ));
      })()}
    </>
  );
}
