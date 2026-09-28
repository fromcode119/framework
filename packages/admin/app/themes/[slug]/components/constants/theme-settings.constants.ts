import { AdminI18n } from '@/lib/i18n/admin-i18n';
export class ThemeSettingsConstants {
  static readonly GOOGLE_FONTS = [
    { label: AdminI18n.t('themes.inter'), value: 'Inter, sans-serif' },
    { label: AdminI18n.t('themes.roboto'), value: 'Roboto, sans-serif' },
    { label: AdminI18n.t('themes.playfairDisplay'), value: '"Playfair Display", serif' },
    { label: AdminI18n.t('themes.lora'), value: 'Lora, serif' },
    { label: AdminI18n.t('themes.manrope'), value: 'Manrope, sans-serif' },
    { label: AdminI18n.t('themes.jetbrainsMono'), value: '"JetBrains Mono", monospace' },
    { label: AdminI18n.t('themes.georgia'), value: 'Georgia, serif' },
    { label: AdminI18n.t('themes.systemSans'), value: 'system-ui, -apple-system, sans-serif' }
  ];
}
