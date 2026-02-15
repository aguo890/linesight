/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, userEvent } from '@/test/utils';
import { Input } from '../Input';

describe('Input Component', () => {
  it('renders input element', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders with label', () => {
    render(<Input label="Email Address" />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it('associates label with input using htmlFor and id', () => {
    render(<Input label="Username" id="username-input" />);
    const input = screen.getByRole('textbox');
    const label = screen.getByText(/username/i);

    expect(input).toHaveAttribute('id', 'username-input');
    expect(label).toHaveAttribute('for', 'username-input');
  });

  it('generates unique id when not provided', () => {
    const { container } = render(<Input label="Auto ID" />);
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('id');
    expect(input?.id).toMatch(/^input-/);
  });

  it('displays error message', () => {
    render(<Input label="Email" error="Invalid email format" />);
    expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
  });

  it('applies error styling when error is present', () => {
    render(<Input error="Error" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('border-red-500');
  });

  it('displays helper text', () => {
    render(<Input helperText="Must be at least 8 characters" />);
    expect(screen.getByText(/must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('hides helper text when error is present', () => {
    render(
      <Input
        helperText="Helper text"
        error="Error message"
      />
    );

    expect(screen.queryByText(/helper text/i)).not.toBeInTheDocument();
    expect(screen.getByText(/error message/i)).toBeInTheDocument();
  });

  it('handles value changes', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<Input onChange={handleChange} />);
    const input = screen.getByRole('textbox');

    await user.type(input, 'test@example.com');
    expect(handleChange).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-input');
  });

  it('forwards HTML input attributes', () => {
    render(
      <Input
        type="email"
        placeholder="Enter email"
        required
        data-testid="email-input"
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('placeholder', 'Enter email');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('data-testid', 'email-input');
  });

  it('supports different input types', () => {
    const { rerender } = render(<Input type="password" />);
    let input = screen.getByRole('textbox', { hidden: true });
    expect(input).toHaveAttribute('type', 'password');

    rerender(<Input type="email" />);
    input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('can be disabled', () => {
    render(<Input disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('supports controlled input', async () => {
    const TestComponent = () => {
      const [value, setValue] = React.useState('');
      return (
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    };

    const user = userEvent.setup();
    render(<TestComponent />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');

    await user.type(input, 'controlled');
    expect(input.value).toBe('controlled');
  });
});
