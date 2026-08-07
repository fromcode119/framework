import { CapabilityTier } from '@ai/api/forge/enums/capability-tier.enum';
import { AssistantRole } from '@ai/enums/assistant-role.enum';
import { AiActComplianceWrapper } from '@ai/gateways/ai-act-compliance-wrapper';
import type { IAssistantClient } from '@ai/interfaces/assistant-client.interface';
function innerReturning(content: string): IAssistantClient {
  return { chat: async () => ({ content, model: 'test-model' }) };
}

describe('AiActComplianceWrapper', () => {
  it('passes the model output through unchanged and stamps a transparency disclosure', async () => {
    const wrapped = AiActComplianceWrapper.wrap(innerReturning('the answer'), 'openai');
    const res = await wrapped.chat({ messages: [{ role: AssistantRole.USER, content: 'hi' }] });
    expect(res.content).toBe('the answer');
    expect(res.model).toBe('test-model');
    expect(res.aiAct?.riskTier).toBe(CapabilityTier.LIMITED);
    expect(res.aiAct?.disclosure).toContain('Art. 50');
    expect(typeof res.aiAct?.loggedAt).toBe('string');
  });

  it('marks a high-risk (income-adjacent) call with a human-oversight disclosure', async () => {
    const wrapped = AiActComplianceWrapper.wrap(innerReturning('x'), 'anthropic');
    const res = await wrapped.chat({ messages: [], purpose: 'mlm.copilot', riskTier: CapabilityTier.HIGH });
    expect(res.aiAct?.riskTier).toBe(CapabilityTier.HIGH);
    expect(res.aiAct?.disclosure).toContain('Art. 14');
  });

  it('rethrows an inner failure (never swallows a model error)', async () => {
    const failing: IAssistantClient = { chat: async () => { throw new Error('provider down'); } };
    const wrapped = AiActComplianceWrapper.wrap(failing, 'ollama');
    await expect(wrapped.chat({ messages: [] })).rejects.toThrow('provider down');
  });

  it('persists a text-free audit entry to the wired sink (Art. 12 record-keeping)', async () => {
    const entries: any[] = [];
    AiActComplianceWrapper.useSink((e) => entries.push(e));
    try {
      const wrapped = AiActComplianceWrapper.wrap(innerReturning('generated'), 'anthropic');
      await wrapped.chat({ messages: [{ role: AssistantRole.USER, content: 'hello' }], purpose: 'mlm.copilot', riskTier: CapabilityTier.HIGH });
      expect(entries.length).toBe(1);
      const e = entries[0];
      expect(e.provider).toBe('anthropic');
      expect(e.purpose).toBe('mlm.copilot');
      expect(e.riskTier).toBe(CapabilityTier.HIGH);
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
      const failing: IAssistantClient = { chat: async () => { throw new Error('provider down'); } };
      const wrapped = AiActComplianceWrapper.wrap(failing, 'openai');
      await expect(wrapped.chat({ messages: [], purpose: 'x', riskTier: CapabilityTier.HIGH })).rejects.toThrow('provider down');
      expect(entries.length).toBe(1);
      expect(entries[0].ok).toBe(false);
      expect(entries[0].error).toBe('provider down');
    } finally {
      AiActComplianceWrapper.useSink(null);
    }
  });
});
