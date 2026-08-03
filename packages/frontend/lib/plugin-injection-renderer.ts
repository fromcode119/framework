import { InjectionTarget } from '@fromcode119/core/client';
import React from 'react';
import type { ReactElement } from 'react';

import { FrontendConfigCache } from '@/lib/frontend-config-cache';

export class PluginInjectionRenderer {
  static async loadHeadElements(): Promise<ReactElement[]> {
    const injections = await PluginInjectionRenderer.readRenderableInjections();
    return injections
      .filter((injection) => PluginInjectionRenderer.resolveTarget(injection) === InjectionTarget.HEAD)
      .map((injection, index) => PluginInjectionRenderer.renderInjection(injection, index))
      .filter((element): element is ReactElement => element !== null);
  }

  static async loadBodyStartElements(): Promise<ReactElement[]> {
    const injections = await PluginInjectionRenderer.readRenderableInjections();
    return injections
      .filter((injection) => PluginInjectionRenderer.resolveTarget(injection) === InjectionTarget.BODY_START)
      .map((injection, index) => PluginInjectionRenderer.renderInjection(injection, index))
      .filter((element): element is ReactElement => element !== null);
  }

  private static async readRenderableInjections(): Promise<Array<Record<string, unknown>>> {
    const metadata = await FrontendConfigCache.read();
    const plugins = Array.isArray(metadata?.plugins) ? metadata.plugins : [];

    return plugins.flatMap((plugin) => {
      if (!plugin || typeof plugin !== 'object') {
        return [];
      }

      const ui = (plugin as Record<string, unknown>).ui;
      const injections = Array.isArray((ui as Record<string, unknown> | null)?.headInjections)
        ? ((ui as Record<string, unknown>).headInjections as Array<Record<string, unknown>>)
        : [];

      return injections;
    });
  }

  private static resolveTarget(injection: Record<string, unknown>): InjectionTarget {
    return String(injection?.target || '').trim() === InjectionTarget.BODY_START.value ? InjectionTarget.BODY_START : InjectionTarget.HEAD;
  }

  private static renderInjection(
    injection: Record<string, unknown>,
    index: number,
  ): ReactElement | null {
    const tag = String(injection?.tag || '').trim().toLowerCase();
    if (!tag) {
      return null;
    }

    const rawProps = injection?.props;
    const props = PluginInjectionRenderer.normalizeProps(
      rawProps && typeof rawProps === 'object' && !Array.isArray(rawProps)
        ? rawProps as Record<string, unknown>
        : {},
    );
    props.key = `${tag}-${index}`;

    const content = String(injection?.content || '');
    if (content) {
      props.dangerouslySetInnerHTML = { __html: content };
    }

    return React.createElement(tag, props);
  }

  private static normalizeProps(rawProps: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    for (const [rawKey, rawValue] of Object.entries(rawProps)) {
      const key = PluginInjectionRenderer.normalizePropName(rawKey);
      if (!key) {
        continue;
      }

      if (PluginInjectionRenderer.isBooleanProp(key)) {
        normalized[key] = rawValue === '' || rawValue === true || rawValue === 'true';
        continue;
      }

      normalized[key] = rawValue;
    }

    return normalized;
  }

  private static normalizePropName(rawKey: string): string {
    const key = String(rawKey || '').trim();
    const lowerKey = key.toLowerCase();
    if (!lowerKey) {
      return '';
    }

    if (lowerKey.startsWith('data-') || lowerKey.startsWith('aria-')) {
      return lowerKey;
    }

    if (lowerKey === 'class') return 'className';
    if (lowerKey === 'charset') return 'charSet';
    if (lowerKey === 'crossorigin') return 'crossOrigin';
    if (lowerKey === 'fetchpriority') return 'fetchPriority';
    if (lowerKey === 'http-equiv') return 'httpEquiv';
    if (lowerKey === 'referrerpolicy') return 'referrerPolicy';
    return lowerKey.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  }

  private static isBooleanProp(key: string): boolean {
    return key === 'async' || key === 'defer';
  }
}
