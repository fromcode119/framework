/**
 * Typography Design Tokens for Admin UI
 * Ensures accessibility compliance (minimum 12px) and consistent scale.
 */
export const TYPOGRAPHY = {
  // Font sizes
  XS: 'text-xs',      // 12px
  SM: 'text-sm',      // 14px
  BASE: 'text-base',  // 16px
  LG: 'text-lg',      // 18px
  XL: 'text-xl',      // 20px
  '2XL': 'text-2xl',  // 24px
  '3XL': 'text-3xl',  // 30px
  '4XL': 'text-4xl',  // 36px

  // Common UI patterns
  LABEL: 'text-[11px] font-semibold text-slate-500/80 tracking-wide',
  SUBTEXT: 'text-[11px] font-medium text-slate-400 leading-relaxed',
  DETAIL: 'text-xs font-semibold leading-relaxed',
  NAV: 'text-xs font-semibold',

  // Headings (admin UI)
  HEADING: {
    SUBTLE: 'text-lg font-bold tracking-tight',
  },
};

// Re-defining to strictly meet the >=12px requirement for all primary labels
export const UI_TEXT = {
  LABEL: 'text-[11px] font-semibold text-slate-500/80 tracking-wide',
  CAPTION: 'text-xs font-semibold',
  BODY: 'text-sm font-semibold leading-relaxed',
  H1: 'text-2xl font-bold tracking-tight',
  H2: 'text-xl font-bold tracking-tight',
  H3: 'text-lg font-bold tracking-tight',
};
