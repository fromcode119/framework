"use client";

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { FrameworkIcons } from '@/lib/icons';
import { Slot, PluginsProvider, usePlugins } from '@fromcode/react';
import Cookies from 'js-cookie';

function PluginLoader() {
  const { registerSlotComponent, registerMenuItem } = usePlugins();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadPlugins() {
      // Small delay to ensure GlobalInitializer has run
      // and window.FrameworkIcons, window.React, window.ReactDOM are available
      let retryCount = 0;
      while (!(window as any).FrameworkIcons && retryCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 50));
        retryCount++;
      }

      if (!(window as any).FrameworkIcons) {
        console.warn("[Frontend] FrameworkIcons not found. Plugins may fail to render icons.");
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://api.framework.local';
        
        // 1. Get active plugins from API
        const res = await fetch(`${apiUrl}/api/plugins/active`);
        const plugins = await res.json();

        if (Array.isArray(plugins)) {
          for (const plugin of plugins) {
            console.log(`[Frontend] Initializing plugin stack: ${plugin.slug}`);

            // 2. Load JS entry point (Runtime Injection)
            if (plugin.ui?.entry) {
              const scriptSrc = `${apiUrl}/plugins/${plugin.slug}/ui/${plugin.ui.entry}`;
              
              // 2.1 Module Preload for performance and to fix "preloaded but not used" warnings
              if (!document.querySelector(`link[href="${scriptSrc}"][rel="modulepreload"]`)) {
                const link = document.createElement('link');
                link.rel = 'modulepreload';
                link.href = scriptSrc;
                document.head.appendChild(link);
              }

              // 2.2 Main script injection
              if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
                const script = document.createElement('script');
                script.type = 'module';
                script.src = scriptSrc;
                script.async = true;
                document.body.appendChild(script);
                console.log(`[Frontend] Injected script for ${plugin.slug}`);
              }
            }

            // 3. Load CSS (Runtime Injection)
            if (plugin.ui?.css) {
              for (const cssFile of plugin.ui.css) {
                const href = `${apiUrl}/plugins/${plugin.slug}/ui/${cssFile}`;
                if (!document.querySelector(`link[href="${href}"]`)) {
                  const link = document.createElement('link');
                  link.rel = 'stylesheet';
                  link.href = href;
                  document.head.appendChild(link);
                }
              }
            }

            // 4. Load Head Injections (Phase 4)
            if (plugin.ui?.headInjections) {
              for (const injection of plugin.ui.headInjections) {
                // Prevent duplicate scripts/links based on unique attributes
                const uniqueKey = injection.props?.id || injection.props?.src || injection.props?.href || injection.props?.name;
                const selector = uniqueKey ? `${injection.tag}[id="${uniqueKey}"], ${injection.tag}[src="${uniqueKey}"], ${injection.tag}[href="${uniqueKey}"], ${injection.tag}[name="${uniqueKey}"]` : null;

                if (selector && document.head.querySelector(selector)) continue;

                const el = document.createElement(injection.tag);
                if (injection.props) {
                  Object.entries(injection.props).forEach(([key, value]) => {
                    let val = String(value);
                    // Automatically prefix relative plugin paths with apiUrl
                    if ((key === 'src' || key === 'href') && val.startsWith('/plugins/')) {
                      val = `${apiUrl}${val}`;
                    }
                    el.setAttribute(key, val);
                  });
                }
                document.head.appendChild(el);
              }
            }
          }
        }
        setLoaded(true);
      } catch (err) {
        console.warn("[Frontend] Failed to load dynamic plugins:", err);
      }
    }
    loadPlugins();
  }, [registerSlotComponent, registerMenuItem]);

  return null;
}

export default function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://api.framework.local';

  return (
    <div style={{ padding: '20px' }}>
      <PluginsProvider apiUrl={apiUrl}>
        <main>
          <div style={{ 
            padding: '4px 12px', 
            background: '#ebf5ff', 
            color: '#0055d4', 
            borderRadius: '100px', 
            fontSize: '11px', 
            fontWeight: 'bold',
            display: 'inline-block',
            marginBottom: '20px'
          }}>
            SYSTEM: Frontend
          </div>
          <h1>Fromcode Portal</h1>
          <Slot name="frontend.home.hero" />
        </main>
        <PluginLoader />
      </PluginsProvider>
    </div>
  );
}
