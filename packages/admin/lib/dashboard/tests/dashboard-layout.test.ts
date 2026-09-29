import { describe, expect, it } from 'vitest';
import { DashboardWidgetSize } from '@fromcode119/core/client';
import { DashboardLayout } from '@/lib/dashboard/dashboard-layout';
import type { IDashboardWidgetDefinition } from '@/lib/dashboard/interfaces/dashboard-widget-definition.interface';

const widget = (key: string, defaultVisible = true, size = DashboardWidgetSize.SMALL): IDashboardWidgetDefinition => ({
  key, label: key, description: '', source: '', size, defaultVisible, render: () => null,
});

describe('DashboardLayout', () => {
  const definitions = [widget('a', true, DashboardWidgetSize.LARGE), widget('b'), widget('c', false)];

  it('shows the default widgets, in declared order, when nothing is saved', () => {
    expect(DashboardLayout.resolve(definitions, null)).toEqual([{ key: 'a', size: 'large' }, { key: 'b', size: 'small' }]);
  });

  it('keeps the saved order and sizes, and drops widgets that are no longer offered', () => {
    const saved = [{ key: 'c', size: 'medium' }, { key: 'gone', size: 'small' }, { key: 'a', size: 'small' }];
    expect(DashboardLayout.resolve(definitions, saved)).toEqual([{ key: 'c', size: 'medium' }, { key: 'a', size: 'small' }]);
  });

  it('does not force a newly offered widget onto a saved dashboard — it waits in the picker', () => {
    const layout = DashboardLayout.resolve(definitions, [{ key: 'a', size: 'large' }]);
    expect(DashboardLayout.available(definitions, layout).map((d) => d.key)).toEqual(['b', 'c']);
  });

  it('an empty saved dashboard stays empty rather than reverting to the defaults', () => {
    expect(DashboardLayout.resolve(definitions, [])).toEqual([]);
  });

  it('adds, removes, resizes and reorders', () => {
    let layout = DashboardLayout.defaults(definitions);
    layout = DashboardLayout.add(layout, definitions[2]!);
    layout = DashboardLayout.move(layout, 'c', 'a');
    expect(layout.map((e) => e.key)).toEqual(['c', 'a', 'b']);
    layout = DashboardLayout.shift(layout, 'b', -1);
    expect(layout.map((e) => e.key)).toEqual(['c', 'b', 'a']);
    layout = DashboardLayout.resize(layout, 'b', DashboardWidgetSize.MEDIUM);
    layout = DashboardLayout.remove(layout, 'c');
    expect(layout).toEqual([{ key: 'b', size: 'medium' }, { key: 'a', size: 'large' }]);
  });

  it('ignores a duplicated key and an unknown size in a saved layout', () => {
    expect(DashboardLayout.resolve(definitions, [{ key: 'b', size: 'huge' }, { key: 'b', size: 'large' }]))
      .toEqual([{ key: 'b', size: 'small' }]);
  });
});
