import { describe, it, expect, afterEach } from 'vitest';
import { PluginCapabilityApprovalPolicy } from './plugin-capability-approval-policy';

const ENV_KEYS = ['AUTO_APPROVE_PLUGIN_CAPABILITIES', 'AUTO_APPROVE_TRUSTED_SLUGS'];
afterEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });

describe('PluginCapabilityApprovalPolicy', () => {
  it('disabled by default', () => {
    expect(PluginCapabilityApprovalPolicy.isEnabled()).toBe(false);
  });
  it('enabled via env flag', () => {
    process.env.AUTO_APPROVE_PLUGIN_CAPABILITIES = 'true';
    expect(PluginCapabilityApprovalPolicy.isEnabled()).toBe(true);
  });
  it('trusts a signature-verified plugin', () => {
    expect(PluginCapabilityApprovalPolicy.isTrusted('ecommerce', true)).toBe(true);
  });
  it('trusts a slug in the allowlist env (case/space-insensitive)', () => {
    process.env.AUTO_APPROVE_TRUSTED_SLUGS = ' Ecommerce , mlm ';
    expect(PluginCapabilityApprovalPolicy.isTrusted('ecommerce', false)).toBe(true);
    expect(PluginCapabilityApprovalPolicy.isTrusted('mlm', false)).toBe(true);
    expect(PluginCapabilityApprovalPolicy.isTrusted('forms', false)).toBe(false);
  });
  it('does NOT trust an unsigned, non-allowlisted plugin', () => {
    expect(PluginCapabilityApprovalPolicy.isTrusted('forms', false)).toBe(false);
  });
  it('shouldAutoApprove requires BOTH enabled AND trusted', () => {
    expect(PluginCapabilityApprovalPolicy.shouldAutoApprove('ecommerce', true)).toBe(false);
    process.env.AUTO_APPROVE_PLUGIN_CAPABILITIES = 'true';
    expect(PluginCapabilityApprovalPolicy.shouldAutoApprove('ecommerce', true)).toBe(true);
    expect(PluginCapabilityApprovalPolicy.shouldAutoApprove('forms', false)).toBe(false);
  });
});
