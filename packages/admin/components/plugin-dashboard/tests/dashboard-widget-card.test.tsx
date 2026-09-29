import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardWidgetCard } from '@/components/plugin-dashboard/view/dashboard-widget-card.client';

/** The card every plugin dashboard widget renders: data when loaded, a stated failure, one shared load. */
describe('DashboardWidgetCard', () => {
  it('renders the loaded data', async () => {
    render(<DashboardWidgetCard title="Orders" load={async () => ({ count: 3 })} renderData={(d: any) => <span>{d.count} orders</span>} />);
    expect(await screen.findByText('3 orders')).toBeInTheDocument();
  });

  it('says the load failed rather than showing an empty card', async () => {
    render(<DashboardWidgetCard title="Orders" load={async () => { throw new Error('down'); }} renderData={() => <span>never</span>} />);
    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
    expect(screen.queryByText('never')).toBeNull();
  });

  it('shares one load between cards with the same cacheKey', async () => {
    const load = vi.fn(async () => 7);
    render(<>
      <DashboardWidgetCard title="A" cacheKey="test.shared" load={load} renderData={(n: number) => <span>a{n}</span>} />
      <DashboardWidgetCard title="B" cacheKey="test.shared" load={load} renderData={(n: number) => <span>b{n}</span>} />
    </>);
    expect(await screen.findByText('a7')).toBeInTheDocument();
    expect(await screen.findByText('b7')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
