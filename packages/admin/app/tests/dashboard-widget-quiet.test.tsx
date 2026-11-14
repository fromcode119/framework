import { describe, expect, it } from 'vitest';
import { DashboardWidgetFrame } from '@/app/dashboard-widget-frame.client';

/**
 * A widget with nothing to show folds into the dashboard's "nothing waiting" line. Only when it says
 * nothing else: a widget with figures and one empty list keeps its card.
 */
const widget = (html: string): HTMLElement => {
  const node = document.createElement('div');
  node.innerHTML = html;
  return node;
};

describe('dashboard widget quiet', () => {
  it('is quiet when only its title and its empty state are on it', () => {
    expect(DashboardWidgetFrame.onlyEmpty(widget('<section><header><h2>Low stock</h2><a>Open</a></header><div><p data-empty-state>Stock is fine.</p></div></section>'))).toBe(true);
  });

  it('is quiet for a card whose title is a heading', () => {
    expect(DashboardWidgetFrame.onlyEmpty(widget('<div><h3>Activity</h3><p data-empty-state>Nothing yet.</p></div>'))).toBe(true);
  });

  it('keeps its card when it shows anything besides the empty state', () => {
    expect(DashboardWidgetFrame.onlyEmpty(widget('<section><header><h2>Queue</h2></header><p>Payouts 3</p><p data-empty-state>No commissions.</p></section>'))).toBe(false);
  });

  it('keeps its card when it has no empty state at all', () => {
    expect(DashboardWidgetFrame.onlyEmpty(widget('<section><header><h2>Orders</h2></header></section>'))).toBe(false);
  });
});
