import React from 'react';
import { PageStyleContext } from './page-style-context';

export function PageStyleProvider({
  page,
  themeStyleVariants,
  children,
}: {
  page: { styleVariant?: string } | null | undefined;
  themeStyleVariants: Record<string, Record<string, unknown>> | undefined;
  children: React.ReactNode;
}) {
  const styleVariant = String(page?.styleVariant || 'default').trim();
  const styleConfig = themeStyleVariants?.[styleVariant] ?? null;
  const value = React.useMemo(
    () => ({ styleVariant, styleConfig }),
    [styleVariant, styleConfig],
  );
  return <PageStyleContext.context.Provider value={value}>{children}</PageStyleContext.context.Provider>;
}
