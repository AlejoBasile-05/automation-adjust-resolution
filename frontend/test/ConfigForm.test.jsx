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

    expect(screen.getByLabelText(/carpeta de origen/i)).toHaveValue('/photos/in');
    expect(screen.getByLabelText(/carpeta de destino/i)).toHaveValue('/photos/out');
    expect(screen.getByLabelText(/^ancho/i)).toHaveValue(1920);
    expect(screen.getByLabelText(/^alto/i)).toHaveValue(1080);
    expect(screen.getByLabelText(/modo de redimensionado/i)).toHaveValue('inside');
    expect(screen.getByLabelText(/calidad/i)).toHaveValue(80);
    expect(screen.getByLabelText(/formato/i)).toHaveValue('jpeg');
  });

  it('shows inline errors and blocks saving when paths are empty', async () => {
    const { onSave, user } = setup({ sourcePath: '', destPath: '' });

    await user.click(screen.getByRole('button', { name: /guardar configuración/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/carpeta de origen es obligatoria/i)).toBeInTheDocument();
    expect(screen.getByText(/carpeta de destino es obligatoria/i)).toBeInTheDocument();
  });

  it('rejects non-positive or fractional dimensions without crashing', async () => {
    const { onSave, user } = setup({ width: '0', height: '10.5' });

    await user.click(screen.getByRole('button', { name: /guardar configuración/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/el ancho debe ser un número entero positivo/i)).toBeInTheDocument();
    expect(screen.getByText(/el alto debe ser un número entero positivo/i)).toBeInTheDocument();
  });

  it('saves valid input with numeric dimensions', async () => {
    const { onSave, user } = setup();

    const width = screen.getByLabelText(/^ancho/i);
    await user.clear(width);
    await user.type(width, '1024');
    await user.selectOptions(screen.getByLabelText(/modo de redimensionado/i), 'fill');
    await user.click(screen.getByRole('button', { name: /guardar configuración/i }));

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
