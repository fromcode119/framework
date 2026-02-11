"use client";

import React, { useEffect, useState } from 'react';
import { Slot, usePlugins } from '@fromcode/react';

export default function Home() {
  const [content, setContent] = useState<any>(null);
  const [forcedLayout, setForcedLayout] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { themeLayouts, api } = usePlugins();

  useEffect(() => {
    async function fetchContent() {
      try {
        const routingSettingResult = await api.get('/collections/settings?key=routing_home_target&limit=1');
        const routingSetting = Array.isArray(routingSettingResult)
          ? routingSettingResult[0]
          : routingSettingResult?.docs?.[0];

        const target = (routingSetting?.value || 'auto').toString().trim();

        if (target.startsWith('layout:')) {
          const layoutName = target.slice('layout:'.length).trim();
          if (layoutName) {
            setForcedLayout(layoutName);
            return;
          }
        }

        if (target.startsWith('collection:')) {
          const parts = target.split(':');
          const collectionSlug = parts[1];
          const recordId = parts.slice(2).join(':');

          if (collectionSlug && recordId) {
            const result = await api.get(`/collections/${encodeURIComponent(collectionSlug)}?id=${encodeURIComponent(recordId)}&limit=1`);
            const doc = Array.isArray(result) ? result[0] : result?.docs?.[0];
            if (doc) {
              setContent(doc);
              return;
            }
          }
        }
      } catch (err) {
        console.error("[Frontend: Home] Content Resolve Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchContent();
  }, [api]);

  // If we have CMS content for the home page, render it using the selected layout
  if (content) {
    const selectedLayoutName = content.themeLayout || 'LandingLayout';
    const LayoutComponent = themeLayouts?.[selectedLayoutName] || themeLayouts?.['LandingLayout'] || themeLayouts?.['DefaultLayout'] || (({ children }: any) => <>{children}</>);
    
    return (
      <LayoutComponent page={content}>
        <div className="w-full">
          <Slot name="frontend.content.display" props={{ content: content.content }} />
          
          {(!content.content || typeof content.content === 'string') && (
            <div className="prose prose-slate dark:prose-invert max-w-4xl mx-auto py-12 px-6">
              <h1 className="text-4xl font-black mb-8">{content.title}</h1>
              <div dangerouslySetInnerHTML={{ __html: content.content || '' }} />
            </div>
          )}
        </div>
      </LayoutComponent>
    );
  }

  if (forcedLayout && themeLayouts?.[forcedLayout] && !loading) {
    const ForcedLayoutComponent = themeLayouts[forcedLayout];
    return <ForcedLayoutComponent />;
  }

  const FallbackLayout = themeLayouts?.LandingLayout || themeLayouts?.Home || themeLayouts?.Main || themeLayouts?.['StandardLayout'];

  if (FallbackLayout && !loading) {
    return <FallbackLayout />;
  }

  return (
    <div className="text-center space-y-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
      <h1 className="text-4xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-6xl">
        {loading ? 'Loading...' : 'Fromcode Framework'}
      </h1>
      <p className="text-lg text-[var(--foreground)] opacity-70">
        The open-source platform for building scalable applications.
      </p>

      {!loading && (
        <div className="flex gap-4 justify-center">
          <a
            href="/admin"
            className="btn-primary"
          >
            Go to Admin
          </a>
          <a
            href="https://docs.fromcode.com"
            className="btn-secondary"
          >
            Documentation
          </a>
        </div>
      )}
    </div>
  );
}
