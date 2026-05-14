import { Request } from 'express';
import {
  ApplicationUrlUtils,
  AppPathConstants,
  RequestSurfaceUtils,
  SystemConstants,
} from '@fromcode119/core';
import { ApiConfig } from '../../../config/api-config';
import { AuthControllerSharedInfrastructure } from './auth-controller-shared-infrastructure';

export class AuthControllerUrlInfrastructure extends AuthControllerSharedInfrastructure {
  protected async getFrontendBaseUrl(req: Request): Promise<string> {
    const configuredInDb = String((await this.getMetaValue(SystemConstants.META_KEY.FRONTEND_URL)) || '').trim();
    if (configuredInDb) return configuredInDb.replace(/\/+$/, '');

    const configured =
      process.env.FRONTEND_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.APP_URL;

    if (configured) return configured.replace(/\/+$/, '');

    const refererUrl = RequestSurfaceUtils.readRefererUrl(req);
    if (refererUrl && RequestSurfaceUtils.isFrontendPath(refererUrl.pathname)) {
      return `${refererUrl.protocol}//${refererUrl.host}`.replace(/\/+$/, '');
    }

    const siteUrl = String((await this.getMetaValue(SystemConstants.META_KEY.SITE_URL)) || '').trim();
    if (siteUrl) return siteUrl.replace(/\/+$/, '');

    const requestOrigin = this.getRequestOriginBaseUrl(req);
    if (requestOrigin) return requestOrigin.replace(/\/+$/, '');

    throw new Error('Frontend base URL is not configured. Set frontend_url or provide a resolvable request origin.');
  }

  protected async getAdminBaseUrl(req: Request): Promise<string> {
    const configuredInDb = String((await this.getMetaValue(SystemConstants.META_KEY.ADMIN_URL)) || '').trim();
    if (configuredInDb) return this.normalizeAdminBaseUrl(configuredInDb);

    const configured = process.env.ADMIN_URL;
    if (configured) return this.normalizeAdminBaseUrl(configured);

    const refererUrl = RequestSurfaceUtils.readRefererUrl(req);
    if (refererUrl && RequestSurfaceUtils.isAdminPath(refererUrl.pathname)) {
      return `${refererUrl.protocol}//${refererUrl.host}${AppPathConstants.ADMIN.ADMIN.BASE}`.replace(/\/+$/, '');
    }

    const { host, proto } = this.getRequestHostAndProto(req);
    if (host) {
      return `${proto}://${host}${AppPathConstants.ADMIN.ADMIN.BASE}`;
    }

    const siteUrl = String((await this.getMetaValue(SystemConstants.META_KEY.SITE_URL)) || '').trim();
    if (siteUrl) {
      return this.joinBaseUrl(siteUrl, AppPathConstants.ADMIN.ADMIN.BASE);
    }

    const requestOrigin = this.getRequestOriginBaseUrl(req);
    if (requestOrigin) {
      return this.joinBaseUrl(requestOrigin, AppPathConstants.ADMIN.ADMIN.BASE);
    }

    throw new Error('Admin base URL is not configured. Set admin_url or provide a resolvable request origin.');
  }

  protected async buildEmailVerificationUrl(req: Request, token: string): Promise<string> {
    const baseUrl = await this.getFrontendBaseUrl(req);
    return `${baseUrl}${ApiConfig.getInstance().appRoutes.auth.VERIFY_EMAIL}?token=${encodeURIComponent(token)}`;
  }

  protected async buildPasswordResetUrl(req: Request, token: string, contextHint?: string): Promise<string> {
    const normalizedContextHint = this.normalizeResetContextHint(contextHint);
    let baseUrl = '';
    if (normalizedContextHint === 'admin') {
      baseUrl = await this.getAdminBaseUrl(req);
    } else if (normalizedContextHint === 'frontend') {
      baseUrl = await this.getFrontendBaseUrl(req);
    } else if (this.isAdminRequestContext(req)) {
      baseUrl = await this.getAdminBaseUrl(req);
    } else {
      baseUrl = await this.getFrontendBaseUrl(req);
    }
    return `${baseUrl}${ApiConfig.getInstance().appRoutes.auth.RESET_PASSWORD}?token=${encodeURIComponent(token)}`;
  }

  protected async buildEmailChangeUrl(req: Request, token: string): Promise<string> {
    const baseUrl = await this.getFrontendBaseUrl(req);
    return `${baseUrl}${ApiConfig.getInstance().appRoutes.auth.VERIFY_EMAIL_CHANGE}?token=${encodeURIComponent(token)}`;
  }

  protected normalizeResetContextHint(contextHint?: string): string {
    const normalizedHint = String(contextHint || '').trim().toLowerCase();
    if (normalizedHint === 'admin' || normalizedHint === RequestSurfaceUtils.CLIENTS.ADMIN_UI) {
      return 'admin';
    }
    if (normalizedHint === 'frontend' || normalizedHint === RequestSurfaceUtils.CLIENTS.FRONTEND_UI) {
      return 'frontend';
    }
    return '';
  }

  protected joinBaseUrl(baseUrl: string, path: string): string {
    return `${String(baseUrl || '').replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  }

  protected normalizeAdminBaseUrl(baseUrl: string): string {
    const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!normalizedBaseUrl) {
      return '';
    }

    const configuredBasePath = ApplicationUrlUtils.readAppBasePathFromEnvironment(ApplicationUrlUtils.ADMIN_APP)
      || AppPathConstants.ADMIN.ADMIN.BASE;
    if (!configuredBasePath || configuredBasePath === '/') {
      return normalizedBaseUrl;
    }

    const existingPath = ApplicationUrlUtils.deriveBasePathFromUrl(normalizedBaseUrl, '');
    if (existingPath) {
      return normalizedBaseUrl;
    }

    return this.joinBaseUrl(normalizedBaseUrl, configuredBasePath);
  }
}
