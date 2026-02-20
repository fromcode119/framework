export const API_RESOURCE_PATHS = {
  AUTH: {
    REGISTER: '/auth/register',
    VERIFY_EMAIL: '/auth/verify-email',
    RESEND_VERIFICATION: '/auth/resend-verification',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    EMAIL_CHANGE_CONFIRM: '/auth/email-change/confirm'
  },
  SYSTEM: {
    HEALTH: '/health',
    RESOLVE: '/system/resolve',
    I18N: '/system/i18n',
    EVENTS: '/system/events'
  },
  COLLECTIONS: {
    SETTINGS: '/collections/settings',
    BASE: '/collections'
  }
} as const;
