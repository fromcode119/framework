"use client";

import React, { useEffect, useState } from 'react';
import { Slot, usePlugins } from '@fromcode/react';

export default function Home() {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { themeLayouts, resolveContent } = usePlugins();

  useEffect(() => {
    async function fetchContent() {
      try {
        // Try to resolve empty slug (homepage)
        const result = await resolveContent('');
        if (result && result.doc) {
          setContent(result.doc);
        }
      } catch (err) {
        console.error("[Frontend: Home] Content Resolve Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchContent();
  }, [resolveContent]);

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

  // Fallback if no CMS page is found for "" slug
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


