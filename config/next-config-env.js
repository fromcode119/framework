const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

class NextConfigEnv {
  static initializeEnvironment() {
    if (NextConfigEnv.environmentInitialized) {
      return;
    }

    const rootDir = path.resolve(__dirname, '..');
    const envFiles = [
      path.join(rootDir, '.env.local'),
      path.join(rootDir, '.env'),
    ];

    let loadedAnyFile = false;
    for (const envFile of envFiles) {
      if (!fs.existsSync(envFile)) {
        continue;
      }

      dotenv.config({ path: envFile, override: false });
      loadedAnyFile = true;
    }

    if (!loadedAnyFile) {
      const exampleEnvFile = path.join(rootDir, '.env.example');
      if (fs.existsSync(exampleEnvFile)) {
        dotenv.config({ path: exampleEnvFile, override: false });
      }
    }

    NextConfigEnv.environmentInitialized = true;
  }

  static getAllowedDevOrigins() {
    NextConfigEnv.initializeEnvironment();

    const explicitOrigins = NextConfigEnv.parseCommaSeparatedValues(process.env.ALLOWED_DEV_ORIGINS);
    const inferredOrigins = [
      process.env.ADMIN_URL,
      process.env.FRONTEND_URL,
      process.env.API_URL,
      process.env.NEXT_PUBLIC_API_URL,
      process.env.PUBLIC_APP_URL,
      process.env.APP_URL,
    ];

    return NextConfigEnv.unique([
      ...explicitOrigins.flatMap((value) => NextConfigEnv.expandOriginCandidates(value)),
      ...inferredOrigins.flatMap((value) => NextConfigEnv.expandOriginCandidates(value)),
    ]);
  }

  static getRemoteImagePatterns() {
    NextConfigEnv.initializeEnvironment();

    const candidates = [
      process.env.STORAGE_PUBLIC_URL,
      process.env.NEXT_PUBLIC_API_URL,
      process.env.API_URL,
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
    ];

    return NextConfigEnv.uniqueByKey(
      candidates
        .map((value) => NextConfigEnv.toRemotePattern(value))
        .filter(Boolean),
      (pattern) => `${pattern.protocol}//${pattern.hostname}`,
    );
  }

  static getAdminBasePath() {
    NextConfigEnv.initializeEnvironment();

    const fromAdminUrl = NextConfigEnv.deriveBasePathFromUrl(process.env.ADMIN_URL || '', '');
    if (fromAdminUrl) {
      return fromAdminUrl;
    }

    return NextConfigEnv.normalizePathPrefix(process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || '');
  }

  static parseCommaSeparatedValues(value) {
    return String(value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  static expandOriginCandidates(value) {
    const raw = String(value || '').trim();
    if (!raw) return [];

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        const parsed = new URL(raw);
        return NextConfigEnv.unique([parsed.origin, parsed.hostname]);
      } catch {
        return [];
      }
    }

    return [raw.replace(/\/+$/, '')];
  }

  static toRemotePattern(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    try {
      const parsed = new URL(raw);
      return {
        protocol: parsed.protocol.replace(/:$/, ''),
        hostname: parsed.hostname,
      };
    } catch {
      return null;
    }
  }

  static deriveBasePathFromUrl(value, defaultPath = '') {
    const raw = String(value || '').trim();
    if (!raw) return NextConfigEnv.normalizePathPrefix(defaultPath);

    try {
      const parsed = new URL(raw);
      const normalizedPath = NextConfigEnv.normalizePathPrefix(parsed.pathname || '');
      if (!normalizedPath) {
        return NextConfigEnv.normalizePathPrefix(defaultPath);
      }

      const withoutVersion = normalizedPath.replace(/\/v[^/]+$/i, '');
      return NextConfigEnv.normalizePathPrefix(withoutVersion) || NextConfigEnv.normalizePathPrefix(defaultPath);
    } catch {
      return NextConfigEnv.normalizePathPrefix(defaultPath);
    }
  }

  static normalizePathPrefix(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '/') return '';
    const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeadingSlash.replace(/\/+$/, '').replace(/\/{2,}/g, '/');
  }

  static unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  static uniqueByKey(values, getKey) {
    const seen = new Set();
    const output = [];

    for (const value of values) {
      const key = getKey(value);
      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      output.push(value);
    }

    return output;
  }
}

NextConfigEnv.environmentInitialized = false;

module.exports = { NextConfigEnv };