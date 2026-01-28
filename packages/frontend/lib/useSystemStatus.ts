"use client";

import { useState, useEffect } from 'react';
import { usePlugins } from '@fromcode/react';

export type SystemStatus = 'LOADING' | 'OK' | 'MAINTENANCE';

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>('LOADING');
  const { registerSlotComponent, registerMenuItem } = usePlugins();

  useEffect(() => {
    async function initializeSystem() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://api.fromcode.local';
        
        // 1. Check system health and maintenance status (Whitelisted)
        const healthRes = await fetch(`${apiUrl}/api/health`, { 
          cache: 'no-store',
          credentials: 'include' 
        });
        const health = await healthRes.json();

        // 2. Gate for non-admins if maintenance is ON
        if (health.maintenance && !health.bypass) {
          setStatus('MAINTENANCE');
          return;
        }

        // 3. Load active plugins
        const res = await fetch(`${apiUrl}/api/plugins/active`, { 
          cache: 'no-store',
          credentials: 'include' 
        });

        if (!res.ok) throw new Error(`API returned ${res.status}`);

        const plugins = await res.json();
        
        if (Array.isArray(plugins)) {
          for (const plugin of plugins) {
            // Load Scripts
            if (plugin.ui?.entry) {
              const scriptSrc = `${apiUrl}/plugins/${plugin.slug}/ui/${plugin.ui.entry}`;
              if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
                // Preload
                if (!document.querySelector(`link[href="${scriptSrc}"][rel="modulepreload"]`)) {
                  const link = document.createElement('link');
                  link.rel = 'modulepreload';
                  link.href = scriptSrc;
                  document.head.appendChild(link);
                }

                const script = document.createElement('script');
                script.type = 'module';
                script.src = scriptSrc;
                script.async = true;
                document.body.appendChild(script);
              }
            }

            // Load CSS
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

            // Load Head Injections
            if (plugin.ui?.headInjections) {
              for (const injection of plugin.ui.headInjections) {
                const uniqueKey = injection.props?.id || injection.props?.src || injection.props?.href || injection.props?.name;
                const selector = uniqueKey ? `${injection.tag}[id="${uniqueKey}"], ${injection.tag}[src="${uniqueKey}"], ${injection.tag}[href="${uniqueKey}"], ${injection.tag}[name="${uniqueKey}"]` : null;

                if (selector && document.head.querySelector(selector)) continue;

                const el = document.createElement(injection.tag);
                if (injection.props) {
                  Object.entries(injection.props).forEach(([key, value]) => {
                    let val = String(value);
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
        
        setStatus('OK');
      } catch (err) {
        console.error("[useSystemStatus] Initialization failed:", err);
        setStatus('MAINTENANCE'); // Fail safe to maintenance screen
      }
    }

    initializeSystem();
  }, [registerSlotComponent, registerMenuItem]);

  return status;
}
