import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FieldRenderer } from './field-renderer';
import React from 'react';

// Mock usePlugins
vi.mock('@fromcode119/react', () => {
  const MockIcon = () => <div data-testid="mock-icon" />;
  return {
    ContextHooks: {
      usePlugins: vi.fn(() => ({
        collections: [],
        fieldComponents: {}
      })),
    },
    Slot: ({ children }: any) => <div>{children}</div>,
    FrameworkIcons: {
      Alert: MockIcon,
      Refresh: MockIcon,
      Lock: MockIcon,
      Check: MockIcon,
      Globe: MockIcon,
      Down: MockIcon,
      Close: MockIcon,
    }
  };
});

// Mock the UI components used by FieldRenderer
vi.mock('@/components/ui/input', () => ({
  Input: ({ onChange, value, placeholder }: any) => (
    <input 
      data-testid="mock-input" 
      value={value} 
      placeholder={placeholder}
      onChange={onChange} 
    />
  )
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ onChange, value, options }: any) => (
    <select data-testid="mock-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}));

describe('./field-renderer', () => {
  it('renders a text input for text type', () => {
    const field: any = { name: 'title', type: 'text', label: 'Title' };
    const onChange = vi.fn();
    
    render(
      <FieldRenderer 
        field={field} 
        value="" 
        onChange={onChange} 
        theme="light" 
        collectionSlug="posts" 
      />
    );

    const input = screen.getByTestId('mock-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Enter Title...');
  });

  it('renders a textarea for textarea type', () => {
    const field: any = { name: 'content', type: 'textarea' };
    render(
      <FieldRenderer 
        field={field} 
        value="" 
        onChange={vi.fn()} 
        theme="light" 
        collectionSlug="posts" 
      />
    );

    expect(screen.getByPlaceholderText('Enter Content...')).toBeInTheDocument();
  });

  it('renders a select for select type', () => {
    const field: any = { 
      name: 'status', 
      type: 'select', 
      options: [{ label: 'Draft', value: 'draft' }] 
    };
    render(
      <FieldRenderer 
        field={field} 
        value="draft" 
        onChange={vi.fn()} 
        theme="light" 
        collectionSlug="posts" 
      />
    );

    expect(screen.getByTestId('mock-select')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('displays required asterisk if field is required', () => {
    const field: any = { name: 'title', type: 'text', required: true };
    render(
      <FieldRenderer 
        field={field} 
        value="" 
        onChange={vi.fn()} 
        theme="light" 
        collectionSlug="posts" 
      />
    );

    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows slug warning if provided', () => {
    const field: any = { name: 'slug', type: 'text' };
    render(
      <FieldRenderer 
        field={field} 
        value="test" 
        onChange={vi.fn()} 
        theme="light" 
        collectionSlug="posts" 
        slugWarning="Already taken"
      />
    );

    expect(screen.getByText('Already taken')).toBeInTheDocument();
  });

  it('renders a select for checkbox type', () => {
    const field: any = {
      name: 'required',
      type: 'checkbox',
      label: 'Required Add-on'
    };
    render(
      <FieldRenderer
        field={field}
        value={false}
        onChange={vi.fn()}
        theme="light"
        collectionSlug="products"
      />
    );

    expect(screen.getByTestId('mock-select')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('allows requesting a password override for read-only fields by default', () => {
    const onReadOnlyOverrideRequest = vi.fn();
    render(
      <FieldRenderer
        field={{ name: 'invoiceNumber', type: 'text', label: 'Invoice Number', admin: { readOnly: true } } as any}
        value="INV-001"
        onChange={vi.fn()}
        theme="light"
        collectionSlug="invoices"
        onReadOnlyOverrideRequest={onReadOnlyOverrideRequest}
      />
    );

    fireEvent.click(screen.getByLabelText('Override read-only field Invoice Number'));

    expect(onReadOnlyOverrideRequest).toHaveBeenCalledWith({
      name: 'invoiceNumber',
      label: 'Invoice Number'
    });
  });

  it('keeps read-only fields locked when the schema explicitly disables override', () => {
    render(
      <FieldRenderer
        field={{ name: 'invoiceNumber', type: 'text', label: 'Invoice Number', admin: { readOnly: true, readOnlyOverride: false } } as any}
        value="INV-001"
        onChange={vi.fn()}
        theme="light"
        collectionSlug="invoices"
        onReadOnlyOverrideRequest={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('Override read-only field Invoice Number')).not.toBeInTheDocument();
  });
});
