import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ProgressPanel from '../src/components/ProgressPanel.jsx';

describe('ProgressPanel', () => {
  it('shows an idle state before any run starts', () => {
    render(<ProgressPanel status="idle" processed={0} total={0} currentFile="" />);

    expect(screen.getByText(/no batch running yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('renders live counts, percent and the current file while running', () => {
    render(
      <ProgressPanel
        status="running"
        processed={3}
        total={10}
        currentFile="/src/a.jpg"
      />,
    );

    expect(screen.getByText('3 / 10')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('/src/a.jpg')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30');
  });

  it('reaches 100% and reports completion on done', () => {
    render(<ProgressPanel status="done" processed={9} total={10} currentFile="" />);

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText(/batch complete/i)).toBeInTheDocument();
    expect(screen.getByText('9 / 10')).toBeInTheDocument();
  });

  it('keeps the last progress visible when the connection drops', () => {
    render(
      <ProgressPanel
        status="connection-lost"
        processed={4}
        total={10}
        currentFile="/src/b.png"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/connection lost/i);
    expect(screen.getByText('4 / 10')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });
});
