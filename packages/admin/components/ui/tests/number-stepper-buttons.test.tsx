import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NumberStepper } from '@/components/ui/number-stepper';

/**
 * Every number field is the platform stepper: − and + at either end, stepping by the declared step or by
 * one, stopping at min/max. Before, the buttons appeared only where a whole `step` was declared — and
 * almost no field declares one, so nearly every number in the console was a bare box.
 */
vi.mock('@fromcode119/react', async () => {
  const MockIcon = () => <span />;
  return { FrameworkIcons: new Proxy({}, { get: () => MockIcon }) };
});

const buttons = () => Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];

describe('NumberStepper buttons', () => {
  it('draws − and + on a field that declares no step, stepping by one up to max', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={19999} max={20000} onChange={onChange} />);
    expect(buttons()).toHaveLength(2);
    fireEvent.click(buttons()[1]);
    expect(onChange).toHaveBeenLastCalledWith(20000);
  });

  it('stops at min', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={0} min={0} onChange={onChange} />);
    fireEvent.click(buttons()[0]);
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('still accepts a typed decimal when no step is declared', () => {
    render(<NumberStepper value={6.9} onChange={() => {}} />);
    const input = document.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('step')).toBe('any');
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });

  it('is a plain box only where a fractional step is declared', () => {
    render(<NumberStepper value={1.25} step={0.01} onChange={() => {}} />);
    expect(buttons()).toHaveLength(0);
  });
});
