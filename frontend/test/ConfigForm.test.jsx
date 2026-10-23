import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ConfigForm from '../src/components/ConfigForm.jsx';

const loaded = {
  sourcePath: '/photos/in',
  destPath: '/photos/out',
  width: 1920,
  height: 1080,
  fit: 'inside',
  quality: 80,
  format: 'jpeg',
};

function Harness({ initial, onChange, onSave }) {
  const [values, setValues] = useState(initial);
  return (
    <ConfigForm
      values={values}
      onChange={(field, value) => {
        onChange(field, value);
        setValues((current) => ({ ...current, [field]: value }));
      }}
      onSave={onSave}
    />
  );
}

function setup(overrides = {}) {
  const onChange = vi.fn();
  const onSave = vi.fn();
  const values = { ...loaded, ...overrides };
  render(<Harness initial={values} onChange={onChange} onSave={onSave} />);
  return { onChange, onSave, values, user: userEvent.setup() };
}

describe('ConfigForm', () => {
  it('renders the loaded configuration in its fields', () => {
    setup();

    expect(screen.getByLabelText(/source folder/i)).toHaveValue('/photos/in');
    expect(screen.getByLabelText(/destination folder/i)).toHaveValue('/photos/out');
    expect(screen.getByLabelText(/^width/i)).toHaveValue(1920);
    expect(screen.getByLabelText(/^height/i)).toHaveValue(1080);
    expect(screen.getByLabelText(/resize mode/i)).toHaveValue('inside');
    expect(screen.getByLabelText(/quality/i)).toHaveValue(80);
    expect(screen.getByLabelText(/format/i)).toHaveValue('jpeg');
  });

  it('shows inline errors and blocks saving when paths are empty', async () => {
    const { onSave, user } = setup({ sourcePath: '', destPath: '' });

    await user.click(screen.getByRole('button', { name: /save settings/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/source folder is required/i)).toBeInTheDocument();
    expect(screen.getByText(/destination folder is required/i)).toBeInTheDocument();
  });

  it('rejects non-positive or fractional dimensions without crashing', async () => {
    const { onSave, user } = setup({ width: '0', height: '10.5' });

    await user.click(screen.getByRole('button', { name: /save settings/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/width must be a positive whole number/i)).toBeInTheDocument();
    expect(screen.getByText(/height must be a positive whole number/i)).toBeInTheDocument();
  });

  it('saves valid input with numeric dimensions', async () => {
    const { onSave, user } = setup();

    const width = screen.getByLabelText(/^width/i);
    await user.clear(width);
    await user.type(width, '1024');
    await user.selectOptions(screen.getByLabelText(/resize mode/i), 'fill');
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePath: '/photos/in',
        destPath: '/photos/out',
        width: 1024,
        height: 1080,
        quality: 80,
        fit: 'fill',
        format: 'jpeg',
      }),
    );
  });
});
