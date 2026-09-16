import { SystemConstants } from '@core/constants/system.constants';

/** Every declared `_system_meta` key, derived from `META_KEY` so a new key with no descriptor here is a compile error. */
export type SystemSettingKey = typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY];
