import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../src/App.jsx';
import useRunStream from '../src/hooks/useRunStream.js';
import { getConfig, saveConfig } from '../src/services/api.js';

vi.mock('../src/services/api.js', () => ({
  getConfig: vi.fn(),
  saveConfig: vi.fn(),
  processBatch: vi.fn(),
  getErrors: vi.fn(),
}));

vi.mock('../src/hooks/useRunStream.js', () => ({
  default: vi.fn(),
}));

const stored = {
  schemaVersion: 2,
  sourcePath: '/photos/in',
  destPath: '/photos/out',
  widthCm: 10,
  heightCm: 7.5,
  dpi: 300,
  fit: 'inside',
  quality: 80,
  format: 'jpeg',
};

function idleStream(overrides = {}) {
  return {
    status: 'idle',
    runId: null,
    total: 0,
    processed: 0,
    currentFile: '',
    errors: [],
    errorMessage: '',
    start: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

describe('App', () => {
  beforeEach(() => {
    getConfig.mockResolvedValue(stored);
    saveConfig.mockImplementation(async (patch) => ({ ...stored, ...patch }));
    useRunStream.mockReturnValue(idleStream());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads the persisted configuration on mount (S6)', async () => {
    render(<App />);

    expect(await screen.findByLabelText(/carpeta de origen/i)).toHaveValue('/photos/in');
    expect(screen.getByLabelText(/^ancho/i)).toHaveValue(10);
    expect(screen.getByLabelText(/^alto/i)).toHaveValue(7.5);
    expect(screen.getByLabelText(/resolución \(dpi\)/i)).toHaveValue(300);
    expect(getConfig).toHaveBeenCalledTimes(1);
  });

  it('summarizes the geometry in centimeters and DPI in the header', async () => {
    render(<App />);

    expect(await screen.findByText('10 × 7.5 cm · 300 dpi')).toBeInTheDocument();
  });

  it('saves edited values through PUT /api/config and confirms it (S6)', async () => {
    const user = userEvent.setup();
    render(<App />);

    const source = await screen.findByLabelText(/carpeta de origen/i);
    await user.clear(source);
    await user.type(source, '/photos/new-in');
    await user.click(screen.getByRole('button', { name: /guardar configuración/i }));

    await waitFor(() =>
      expect(saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ sourcePath: '/photos/new-in', widthCm: 10 }),
      ),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/configuración guardada/i);
  });

  it('starts a run with the current configuration (S4)', async () => {
    const start = vi.fn();
    useRunStream.mockReturnValue(idleStream({ start }));
    const user = userEvent.setup();
    render(<App />);

    await screen.findByLabelText(/carpeta de origen/i);
    await user.click(screen.getByRole('button', { name: /iniciar proceso/i }));

    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePath: '/photos/in',
        destPath: '/photos/out',
        widthCm: 10,
        heightCm: 7.5,
        dpi: 300,
      }),
    );
  });

  it('does not allow a run when required folders are missing', async () => {
    getConfig.mockResolvedValue({ ...stored, sourcePath: '' });
    render(<App />);

    await screen.findByLabelText(/carpeta de origen/i);
    expect(screen.getByRole('button', { name: /iniciar proceso/i })).toBeDisabled();
  });
});
