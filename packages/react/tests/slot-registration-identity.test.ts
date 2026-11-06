import { describe, expect, it } from 'vitest';
import { RegistrationStateReducers } from '@react/context/registration-state-reducers';

/** Two classes the way a minified bundle emits them: different components, the same short name. */
const minified = () => {
  const a = class i {};
  const b = class i {};
  return [a, b];
};

describe('slot registration identity', () => {
  it('keeps two panels of one plugin whose minified class names collide', () => {
    const [giftCards, invoices] = minified() as any[];
    Object.defineProperty(giftCards, 'registrationId', { value: './gift-cards-panel.tsx#GiftCardsPanel' });
    Object.defineProperty(invoices, 'registrationId', { value: './invoices-panel.tsx#InvoicesPanel' });
    let slots = RegistrationStateReducers.foldSlot({}, 'account.panels', { component: giftCards, pluginSlug: 'finance', priority: 45 } as any);
    slots = RegistrationStateReducers.foldSlot(slots, 'account.panels', { component: invoices, pluginSlug: 'finance', priority: 40 } as any);
    expect(slots['account.panels']).toHaveLength(2);
  });

  it('still folds a reloaded bundle\'s copy of the same export into its entry', () => {
    const [first, reloaded] = minified() as any[];
    Object.defineProperty(first, 'registrationId', { value: './panel.tsx#Panel' });
    Object.defineProperty(reloaded, 'registrationId', { value: './panel.tsx#Panel' });
    let slots = RegistrationStateReducers.foldSlot({}, 'account.panels', { component: first, pluginSlug: 'finance', priority: 45 } as any);
    slots = RegistrationStateReducers.foldSlot(slots, 'account.panels', { component: reloaded, pluginSlug: 'finance', priority: 45 } as any);
    expect(slots['account.panels']).toHaveLength(1);
    expect(slots['account.panels'][0].component).toBe(reloaded);
  });
});
