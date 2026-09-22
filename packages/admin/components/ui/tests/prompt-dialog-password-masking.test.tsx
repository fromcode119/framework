import { render, screen } from '@testing-library/react';
import { PromptDialog } from '@/components/ui/view/prompt-dialog.client';
import { PromptInputType } from '@/components/ui/enums/prompt-input-type.enum';

/**
 * Renders the real dialog and asserts the rendered INPUT, not the prop that was passed to it.
 *
 * The read-only override dialog asked for the operator's account password with `inputType="password"`
 * and still rendered `type="text"`: the component read `inputType.value` off what was actually a raw
 * string, got `undefined`, React dropped the attribute, and every character showed on screen. Nothing
 * failed, nothing logged, and the prop at the call site read correctly the whole time — which is why
 * this asserts the DOM.
 */
describe('PromptDialog password masking', () => {
  const baseProps: any = {
    isOpen: true,
    onClose: () => {},
    onConfirm: () => {},
    title: 'Confirm it is you',
    placeholder: 'Current password',
  };

  it('masks the input when the type is passed as a raw string', () => {
    render(<PromptDialog {...baseProps} inputType="password" />);
    expect(screen.getByPlaceholderText('Current password')).toHaveAttribute('type', 'password');
  });

  it('masks the input when the type is passed as the enum member', () => {
    render(<PromptDialog {...baseProps} inputType={PromptInputType.PASSWORD} />);
    expect(screen.getByPlaceholderText('Current password')).toHaveAttribute('type', 'password');
  });

  it('still renders a plain text prompt when no type is given', () => {
    render(<PromptDialog {...baseProps} placeholder="Name this revision" />);
    expect(screen.getByPlaceholderText('Name this revision')).toHaveAttribute('type', 'text');
  });

  /** Asymmetric on purpose: masking a field that did not need it costs nothing. */
  it('masks rather than reveals when the type is not recognised', () => {
    render(<PromptDialog {...baseProps} inputType="passwrd" />);
    expect(screen.getByPlaceholderText('Current password')).toHaveAttribute('type', 'password');
  });
});
