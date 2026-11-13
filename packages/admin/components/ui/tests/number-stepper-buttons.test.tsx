import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { NumberStepper } from '@/components/ui/number-stepper';

/**
 * Every number field is the platform stepper: − and + at either end, stepping by the declared step or by
 * one, stopping at min/max — and any number can be typed by hand, with a comma or a point.
 */
vi.mock('@fromcode119/react', async () => {
  const MockIcon = () => <span />;
  return { FrameworkIcons: new Proxy({}, { get: () => MockIcon }) };
});

const buttons = () => Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
const input = () => document.querySelector('input') as HTMLInputElement;

/** A caller that keeps the value as a string, the way the order items field did ("0" for 0.0). */
function StringCaller(props: { onChange: (v: number | string) => void; step?: number }) {
  const [value, setValue] = useState('0');
  return <NumberStepper value={value} step={props.step} onChange={(v) => { props.onChange(v); setValue(String(v === '' ? '' : Number(v))); }} />;
}

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

  it('has − and + on a fractional step too, moving by that step', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={1.25} step={0.5} onChange={onChange} />);
    expect(buttons()).toHaveLength(2);
    fireEvent.click(buttons()[1]);
    expect(onChange).toHaveBeenLastCalledWith(1.75);
    fireEvent.click(buttons()[0]);
    expect(onChange).toHaveBeenLastCalledWith(0.75);
  });

  it('keeps the zeros while 0,05 is typed, even when the caller stores a string', () => {
    const onChange = vi.fn();
    render(<StringCaller step={0.5} onChange={onChange} />);
    fireEvent.focus(input());
    for (const text of ['0', '0,', '0,0', '0,05']) {
      fireEvent.change(input(), { target: { value: text } });
      expect(input().value).toBe(text);
    }
    expect(onChange).toHaveBeenLastCalledWith(0.05);
  });

  it('accepts a point or a comma and a minus sign typed by hand', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={0} onChange={onChange} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: '12.5' } });
    expect(onChange).toHaveBeenLastCalledWith(12.5);
    fireEvent.change(input(), { target: { value: '-' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.change(input(), { target: { value: '-3,25' } });
    expect(onChange).toHaveBeenLastCalledWith(-3.25);
    expect(input().getAttribute('inputmode')).toBe('decimal');
  });

  it('clamps a typed value to max when the field is left, not while typing', () => {
    const onChange = vi.fn();
    const { rerender } = render(<NumberStepper value={5} max={10} onChange={onChange} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: '200' } });
    expect(onChange).toHaveBeenLastCalledWith(200);
    rerender(<NumberStepper value={200} max={10} onChange={onChange} />);
    fireEvent.blur(input());
    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it('steps with the arrow keys', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={2} step={0.5} onChange={onChange} />);
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(2.5);
  });

  it('writes the number with the console language\'s decimal mark, without rounding it', () => {
    expect(NumberStepper.format(12.5, 'bg')).toBe('12,5');
    expect(NumberStepper.format(0.05, 'bg')).toBe('0,05');
    expect(NumberStepper.format(12.5, 'en')).toBe('12.5');
    expect(NumberStepper.format(1250, 'bg')).toBe('1250');
  });
});
