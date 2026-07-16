import { describe, expect, it } from 'vitest';
import { AiActComplianceWrapper } from './ai-act-compliance-wrapper';
import type { AssistantClient } from '../types.interfaces';

function innerReturning(content: string): AssistantClient {
  return { chat: async () => ({ content, model: 'test-model' }) };
}

describe('AiActComplianceWrapper', () => {
  it('passes the model output through unchanged and stamps a transparency disclosure', async () => {
    const wrapped = AiActComplianceWrapper.wrap(innerReturning('the answer'), 'openai');
    const res = await wrapped.chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.content).toBe('the answer');
    expect(res.model).toBe('test-model');
    expect(res.aiAct?.riskTier).toBe('limited');
    expect(res.aiAct?.disclosure).toContain('Art. 50');
    expect(typeof res.aiAct?.loggedAt).toBe('string');
  });

  it('marks a high-risk (income-adjacent) call with a human-oversight disclosure', async () => {
    const wrapped = AiActComplianceWrapper.wrap(innerReturning('x'), 'anthropic');
    const res = await wrapped.chat({ messages: [], purpose: 'mlm.copilot', riskTier: 'high' });
    expect(res.aiAct?.riskTier).toBe('high');
    expect(res.aiAct?.disclosure).toContain('Art. 14');
  });

  it('rethrows an inner failure (never swallows a model error)', async () => {
    const failing: AssistantClient = { chat: async () => { throw new Error('provider down'); } };
    const wrapped = AiActComplianceWrapper.wrap(failing, 'ollama');
    await expect(wrapped.chat({ messages: [] })).rejects.toThrow('provider down');
  });

  it('persists a text-free audit entry to the wired sink (Art. 12 record-keeping)', async () => {
    const entries: any[] = [];
    AiActComplianceWrapper.useSink((e) => entries.push(e));
    try {
      const wrapped = AiActComplianceWrapper.wrap(innerReturning('generated'), 'anthropic');
      await wrapped.chat({ messages: [{ role: 'user', content: 'hello' }], purpose: 'mlm.copilot', riskTier: 'high' });
      expect(entries.length).toBe(1);
      const e = entries[0];
      expect(e.provider).toBe('anthropic');
      expect(e.purpose).toBe('mlm.copilot');
      expect(e.riskTier).toBe('high');
      expect(e.ok).toBe(true);
      expect(e.promptChars).toBe(5);
      expect(e.responseChars).toBe(9);
      // never the raw prompt/response text
      expect(JSON.stringify(e)).not.toContain('hello');
      expect(JSON.stringify(e)).not.toContain('generated');
    } finally {
      AiActComplianceWrapper.useSink(null);
    }
  });

  it('records a failed call as an audit entry with ok:false, then rethrows', async () => {
    const entries: any[] = [];
    AiActComplianceWrapper.useSink((e) => entries.push(e));
    try {
      const failing: AssistantClient = { chat: async () => { throw new Error('provider down'); } };
      const wrapped = AiActComplianceWrapper.wrap(failing, 'openai');
      await expect(wrapped.chat({ messages: [], purpose: 'x', riskTier: 'high' })).rejects.toThrow('provider down');
      expect(entries.length).toBe(1);
      expect(entries[0].ok).toBe(false);
      expect(entries[0].error).toBe('provider down');
    } finally {
      AiActComplianceWrapper.useSink(null);
    }
  });
});
