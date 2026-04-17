import { describe, expect, it } from 'vitest';
import { SdkExportSourceBuilder } from '../../react/src/helpers/sdk-export-source-builder';

describe('SdkExportSourceBuilder', () => {
  it('includes runtime SDK exports used by plugin UI bundles', () => {
    const source = SdkExportSourceBuilder.build("window.__modules__['@fromcode119/react']");

    expect(source).toContain('export const RuntimeLocationUtils =');
    expect(source).toContain('export const BrowserStateClient =');
    expect(source).toContain('export const ApplicationUrlUtils =');
    expect(source).toContain('export const ClientRuntimeConstants =');
    expect(source).toContain('export const CookieConstants =');
    expect(source).toContain('export const MediaRelationService =');
  });

  it('parenthesizes complex accessors so named exports resolve to properties', () => {
    const source = SdkExportSourceBuilder.build("window.__modules__ && window.__modules__['@fromcode119/react']");

    expect(source).toContain(
      "export const BrowserStateClient = (window.__modules__ && window.__modules__['@fromcode119/react']) ? (window.__modules__ && window.__modules__['@fromcode119/react']).BrowserStateClient : (window.Fromcode && window.Fromcode.BrowserStateClient);",
    );
  });
});