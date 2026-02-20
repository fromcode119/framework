import { cache } from 'react';
import { buildSettingsCollectionPath, serverFetchJson } from './server-api';

function parseBoolean(value: any, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

const readSettingsMap = cache(async () => {
  const result = await serverFetchJson(buildSettingsCollectionPath(500));
  const docs = Array.isArray(result?.docs)
    ? result.docs
    : Array.isArray(result)
      ? result
      : [];

  const map = new Map<string, string>();
  for (const doc of docs) {
    const key = String(doc?.key || '').trim();
    if (!key) continue;
    map.set(key, String(doc?.value ?? '').trim());
  }
  return map;
});

async function readSettingValue(key: string): Promise<string> {
  const map = await readSettingsMap();
  return String(map.get(key) || '').trim();
}

export async function isFrontendAuthEnabled(): Promise<boolean> {
  const raw = await readSettingValue('frontend_auth_enabled');
  return parseBoolean(raw, true);
}

export async function isFrontendRegistrationEnabled(): Promise<boolean> {
  const raw = await readSettingValue('frontend_registration_enabled');
  return parseBoolean(raw, true);
}
