import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ErrorList from '../src/components/ErrorList.jsx';

const errors = [
  {
    code: 'CORRUPT_FILE',
    file: '/src/broken.png',
    stage: 'resize',
    message: 'Input buffer contains unsupported image format',
    timestamp: '2026-10-21T10:00:00.000Z',
  },
  {
    code: 'WRITE_FAILED',
    file: '/src/denied.jpg',
    stage: 'write',
    message: 'EACCES: permission denied',
    timestamp: '2026-10-21T10:00:01.000Z',
  },
];

describe('ErrorList', () => {
  it('reports a calm empty state when nothing failed', () => {
    render(<ErrorList errors={[]} />);

    expect(screen.getByText(/no se reportaron errores/i)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders one entry per failed file with its code and message', () => {
    render(<ErrorList errors={errors} />);

    expect(screen.getByText(/errores \(2\)/i)).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('CORRUPT_FILE');
    expect(items[0]).toHaveTextContent('/src/broken.png');
    expect(items[0]).toHaveTextContent('Input buffer contains unsupported image format');
    expect(items[0]).toHaveTextContent('resize');
    expect(items[1]).toHaveTextContent('WRITE_FAILED');
  });
});
