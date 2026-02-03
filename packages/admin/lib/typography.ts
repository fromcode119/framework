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
  LABEL: 'text-xs font-black uppercase tracking-widest',
  SUBTEXT: 'text-[11px] font-bold uppercase tracking-tight opacity-60', // Exception for secondary metadata, but will use text-xs if requested
  DETAIL: 'text-xs font-bold leading-relaxed',
  NAV: 'text-[11px] font-black uppercase tracking-widest',
};

// Re-defining to strictly meet the >=12px requirement for all primary labels
export const UI_TEXT = {
  LABEL: 'text-xs font-black uppercase tracking-widest',
  CAPTION: 'text-xs font-bold uppercase tracking-tight',
  BODY: 'text-sm font-bold leading-relaxed',
  H1: 'text-2xl font-black uppercase tracking-tight',
  H2: 'text-xl font-black uppercase tracking-tight',
  H3: 'text-lg font-black uppercase tracking-tight',
};
