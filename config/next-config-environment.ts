import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { NextConfigAliases } from './next-config-aliases';
import type { IRemotePatternCandidate } from './interfaces/remote-pattern-candidate.interface';

export class NextConfigEnvironment {
  static environmentInitialized: boolean;

  static initializeEnvironment() {
    if (NextConfigEnvironment.environmentInitialized) {
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

    NextConfigEnvironment.environmentInitialized = true;
  }

  /**
   * The hosts the DEV server will serve `/_next/*` to. Next blocks every other Host outright, and the
   * failure is silent from the browser's side: the document still streams, so the page paints its
   * server-rendered shell and then never hydrates — no console error, no failed request, just a screen
   * that never becomes interactive. On the admin that shell is an empty full-height div, i.e. a white
   * page, which is exactly what a workspace domain (`app.<site>`) showed.
   *
   * Under multi-tenancy the three app URLs below cannot be the whole list: every SITE gets its own host
   * and they are created in the admin, long after this file is read. So the deployment's SITE DOMAIN is
   * a source too — `COOKIE_DOMAIN` is where the platform already declares it, being the domain whose
   * subdomains share one admin session. Everything under it is by definition one of ours, and it
   * expands to a wildcard so a site added at 3pm works without editing a config.
   *
   * `ALLOWED_DEV_ORIGINS` remains the explicit override for anything neither rule covers.
   */
  static getAllowedDevOrigins() {
    NextConfigEnvironment.initializeEnvironment();

    const explicitOrigins = NextConfigEnvironment.parseCommaSeparatedValues(process.env.ALLOWED_DEV_ORIGINS);
    const inferredOrigins = [
      process.env.ADMIN_URL,
      process.env.FRONTEND_URL,
      process.env.API_URL,
      process.env.NEXT_PUBLIC_API_URL,
      process.env.PUBLIC_APP_URL,
      process.env.APP_URL,
    ];

    return NextConfigEnvironment.unique([
      ...explicitOrigins.flatMap((value) => NextConfigEnvironment.expandOriginCandidates(value)),
      ...inferredOrigins.flatMap((value) => NextConfigEnvironment.expandOriginCandidates(value)),
      ...NextConfigEnvironment.expandSiteDomainCandidates(process.env.COOKIE_DOMAIN),
    ]);
  }

  /**
   * `.framework.local` -> `['framework.local', '**.framework.local']`. The double star is deliberate:
   * Next's matcher gives `*` exactly ONE label, so `*.framework.local` would allow
   * `acme.framework.local` and still block the workspace host `app.acme.framework.local`. `**` is
   * the recursive form (it is what Next's own built-in `**.localhost` entry uses), and the apex is
   * listed separately because a wildcard there is rejected by design.
   *
   * A single-host deployment sets no cookie domain, or sets one that is a bare hostname rather than a
   * suffix; then there are no extra sites to allow and this contributes nothing.
   */
  static expandSiteDomainCandidates(value: string | undefined) {
    const domain = String(value || '').trim().replace(/^\.+/, '').replace(/\.+$/, '').toLowerCase();
    if (!domain || !domain.includes('.')) return [];
    return [domain, `**.${domain}`];
  }

  static getRemoteImagePatterns() {
    NextConfigEnvironment.initializeEnvironment();

    const candidates = [
      process.env.STORAGE_PUBLIC_URL,
      process.env.NEXT_PUBLIC_API_URL,
      process.env.API_URL,
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
    ];

    return NextConfigAliases.uniqueByKey(
      candidates
        .map((value) => NextConfigEnvironment.toRemotePattern(value))
        .filter((pattern): pattern is IRemotePatternCandidate => pattern !== null),
      (pattern: IRemotePatternCandidate) => `${pattern.protocol}//${pattern.hostname}`,
    );
  }

  static getAdminBasePath() {
    NextConfigEnvironment.initializeEnvironment();

    const fromAdminUrl = NextConfigEnvironment.deriveBasePathFromUrl(process.env.ADMIN_URL || '', '');
    if (fromAdminUrl) {
      return fromAdminUrl;
    }

    return NextConfigEnvironment.normalizePathPrefix(process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || '');
  }

  static parseCommaSeparatedValues(value: string | undefined) {
    return String(value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  static expandOriginCandidates(value: string | undefined) {
    const raw = String(value || '').trim();
    if (!raw) return [];

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        const parsed = new URL(raw);
        return NextConfigEnvironment.unique([parsed.origin, parsed.hostname]);
      } catch {
        return [];
      }
    }

    return [raw.replace(/\/+$/, '')];
  }

  static toRemotePattern(value: string | undefined): IRemotePatternCandidate | null {
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

  static deriveBasePathFromUrl(value: string | undefined, defaultPath = '') {
    const raw = String(value || '').trim();
    if (!raw) return NextConfigEnvironment.normalizePathPrefix(defaultPath);

    try {
      const parsed = new URL(raw);
      const normalizedPath = NextConfigEnvironment.normalizePathPrefix(parsed.pathname || '');
      if (!normalizedPath) {
        return NextConfigEnvironment.normalizePathPrefix(defaultPath);
      }

      const withoutVersion = normalizedPath.replace(/\/v[^/]+$/i, '');
      return NextConfigEnvironment.normalizePathPrefix(withoutVersion) || NextConfigEnvironment.normalizePathPrefix(defaultPath);
    } catch {
      return NextConfigEnvironment.normalizePathPrefix(defaultPath);
    }
  }

  static normalizePathPrefix(value: string | undefined) {
    const raw = String(value || '').trim();
    if (!raw || raw === '/') return '';
    const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeadingSlash.replace(/\/+$/, '').replace(/\/{2,}/g, '/');
  }

  static unique(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)));
  }
}

NextConfigEnvironment.environmentInitialized = false;
