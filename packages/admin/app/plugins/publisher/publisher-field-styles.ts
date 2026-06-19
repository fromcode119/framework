export class PublisherFieldStyles {
  static inputClass(theme: string): string {
    return `w-full h-14 px-5 rounded-2xl border-0 ring-1 font-semibold text-sm transition-all focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-800 ring-white/10 text-white' : 'bg-slate-50 ring-slate-200 text-slate-900'}`;
  }
}
