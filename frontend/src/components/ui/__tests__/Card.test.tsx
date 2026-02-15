/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/utils';
import { Card } from '../Card';

describe('Card Component', () => {
  it('renders children content', () => {
    render(
      <Card>
        <p>Card content</p>
      </Card>
    );
    expect(screen.getByText(/card content/i)).toBeInTheDocument();
  });

  it('renders without title or action', () => {
    const { container } = render(<Card>Content</Card>);
    const header = container.querySelector('.border-b');
    expect(header).not.toBeInTheDocument();
  });

  it('renders with title', () => {
    render(<Card title="Card Title">Content</Card>);
    expect(screen.getByText(/card title/i)).toBeInTheDocument();
  });

  it('renders with subtitle', () => {
    render(
      <Card title="Title" subtitle="This is a subtitle">
        Content
      </Card>
    );
    expect(screen.getByText(/this is a subtitle/i)).toBeInTheDocument();
  });

  it('renders with action element', () => {
    render(
      <Card title="Title" action={<button>Action</button>}>
        Content
      </Card>
    );
    expect(screen.getByRole('button', { name: /action/i })).toBeInTheDocument();
  });

  it('renders action without title', () => {
    render(
      <Card action={<button>Action Only</button>}>
        Content
      </Card>
    );
    expect(screen.getByRole('button', { name: /action only/i })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Card className="custom-card">Content</Card>
    );
    const card = container.firstChild;
    expect(card).toHaveClass('custom-card');
  });

  it('applies base styling classes', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild;
    expect(card).toHaveClass('bg-surface', 'rounded-lg', 'border');
  });

  it('renders complex children', () => {
    render(
      <Card>
        <div data-testid="complex-child">
          <h2>Heading</h2>
          <p>Paragraph</p>
          <button>Button</button>
        </div>
      </Card>
    );

    expect(screen.getByTestId('complex-child')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /heading/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /button/i })).toBeInTheDocument();
  });
});
