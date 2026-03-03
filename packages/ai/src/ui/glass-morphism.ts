/**
 * Glass Morphism / Frost Design Utility Classes
 * Shared Tailwind CSS classes for consistent glass/frost aesthetic
 */

export const GLASS_CARD = `
  group relative
  flex-1 overflow-hidden rounded-2xl
  border border-slate-200/70
  bg-gradient-to-br from-white/95 via-white/92 to-slate-50/95
  shadow-[0_20px_50px_rgba(2,6,23,0.12)]
  backdrop-blur-xl
  transition-shadow duration-500
  hover:shadow-[0_20px_50px_rgba(2,6,23,0.18)]
  dark:border-slate-700/60
  dark:from-slate-900/80 dark:via-slate-900/75 dark:to-slate-800/80
  dark:shadow-[0_20px_50px_rgba(2,6,23,0.3)]
  dark:hover:shadow-[0_20px_50px_rgba(2,6,23,0.4)]
`;

export const GLASS_PANEL = `
  rounded-xl
  border border-slate-200/50
  bg-white/70 backdrop-blur-md
  p-4
  dark:border-slate-700/50
  dark:bg-slate-900/50
`;

export const GLASS_INPUT = `
  rounded-lg
  border border-slate-200/60
  bg-white/80 backdrop-blur-sm
  px-3 py-2
  text-slate-900
  placeholder-slate-400
  transition-all duration-200
  focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.1)] focus:outline-none
  dark:border-slate-700/60
  dark:bg-slate-800/60
  dark:text-slate-100
  dark:placeholder-slate-500
  dark:focus:border-cyan-500 dark:focus:shadow-[0_0_0_3px_rgba(34,211,238,0.15)]
`;

export const GLASS_BUTTON = `
  inline-flex items-center justify-center
  rounded-lg
  border border-slate-200/70
  bg-gradient-to-br from-white/90 to-slate-50/90
  px-4 py-2.5
  font-medium text-slate-700
  shadow-[0_4px_12px_rgba(2,6,23,0.08)]
  transition-all duration-200
  hover:shadow-[0_8px_24px_rgba(2,6,23,0.12)]
  hover:border-slate-300/70
  active:scale-95
  dark:border-slate-700/70
  dark:from-slate-800/90 dark:to-slate-900/90
  dark:text-slate-200
  dark:shadow-[0_4px_12px_rgba(2,6,23,0.3)]
  dark:hover:shadow-[0_8px_24px_rgba(2,6,23,0.4)]
`;

export const GLASS_BUTTON_PRIMARY = `
  inline-flex items-center justify-center
  rounded-lg
  border border-cyan-400/50
  bg-gradient-to-br from-cyan-500/90 to-cyan-600/90
  px-4 py-2.5
  font-medium text-white
  shadow-[0_4px_12px_rgba(6,182,212,0.3)]
  transition-all duration-200
  hover:shadow-[0_8px_24px_rgba(6,182,212,0.4)]
  hover:border-cyan-300/70
  active:scale-95
  dark:border-cyan-400/60
  dark:from-cyan-500/95 dark:to-cyan-600/95
  dark:shadow-[0_4px_12px_rgba(6,182,212,0.4)]
  dark:hover:shadow-[0_8px_24px_rgba(6,182,212,0.5)]
`;

export const GLASS_GRADIENT_TEXT = `
  bg-gradient-to-r from-cyan-600 to-sky-600
  bg-clip-text text-transparent
  dark:from-cyan-400 dark:to-sky-400
`;

export const GLASS_PROGRESS_BAR = `
  h-1 overflow-hidden rounded-full
  transition-all duration-500
  bg-gradient-to-r from-emerald-500 to-emerald-600
  dark:from-emerald-400 dark:to-emerald-500
`;

export const GLASS_PROGRESS_ACTIVE = `
  h-full w-full
  animate-pulse
  bg-white/40
`;
