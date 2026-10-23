import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ConfigForm from '../src/components/ConfigForm.jsx';

const loaded = {
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

function Harness({ initial, onChange, onSave, onPickFolder, pickingField, pickerError }) {
  const [values, setValues] = useState(initial);
  return (
    <ConfigForm
      values={values}
      onChange={(field, value) => {
        onChange(field, value);
        setValues((current) => ({ ...current, [field]: value }));
      }}
      onSave={onSave}
      onPickFolder={onPickFolder}
      pickingField={pickingField}
      pickerError={pickerError}
    />
  );
}

function setup(overrides = {}, props = {}) {
  const onChange = vi.fn();
  const onSave = vi.fn();
  const values = { ...loaded, ...overrides };
  render(
    <Harness initial={values} onChange={onChange} onSave={onSave} onPickFolder={vi.fn()} {...props} />
  );
  return { onChange, onSave, values, user: userEvent.setup() };
}

describe('ConfigForm', () => {
  it('renders the loaded configuration in its fields', () => {
    setup();

    expect(screen.getByLabelText(/carpeta de origen/i)).toHaveValue('/photos/in');
    expect(screen.getByLabelText(/carpeta de destino/i)).toHaveValue('/photos/out');
    expect(screen.getByLabelText(/^ancho/i)).toHaveValue(10);
    expect(screen.getByLabelText(/^alto/i)).toHaveValue(7.5);
    expect(screen.getByLabelText(/resolución \(dpi\)/i)).toHaveValue(300);
    expect(screen.getByLabelText(/modo de redimensionado/i)).toHaveValue('inside');
    expect(screen.getByLabelText(/calidad/i)).toHaveValue(80);
    expect(screen.getByLabelText(/formato/i)).toHaveValue('jpeg');
  });

  it('labels the geometry fields in centimeters and documents DPI units', () => {
    setup();

    expect(screen.getByLabelText(/^ancho \(cm\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^alto \(cm\)/i)).toBeInTheDocument();
    expect(screen.getByText(/píxeles por pulgada/i)).toBeInTheDocument();
  });

  it('shows the live pixel preview for the current centimeter and DPI values', () => {
    setup();

    const preview = screen.getByTestId('px-preview');
    expect(preview).toHaveTextContent('≈ 1181 × 886 px');
    expect(preview).toHaveAttribute('aria-live', 'polite');
  });

  it('updates the pixel preview when the DPI changes', async () => {
    const { user } = setup();

    const dpi = screen.getByLabelText(/resolución \(dpi\)/i);
    await user.clear(dpi);
    await user.type(dpi, '150');

    expect(screen.getByTestId('px-preview')).toHaveTextContent('≈ 591 × 443 px');
  });

  it('shows inline errors and blocks saving when paths are empty', async () => {
    const { onSave, user } = setup({ sourcePath: '', destPath: '' });

    await user.click(screen.getByRole('button', { name: /guardar configuración/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/carpeta de origen es obligatoria/i)).toBeInTheDocument();
    expect(screen.getByText(/carpeta de destino es obligatoria/i)).toBeInTheDocument();
  });

  it('rejects non-positive, out-of-range or non-integer geometry values', async () => {
    const { onSave, user } = setup({ widthCm: '0', heightCm: '1001', dpi: '1200.5' });

    await user.click(screen.getByRole('button', { name: /guardar configuración/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('El ancho debe ser un número mayor que 0.')).toBeInTheDocument();
    expect(screen.getByText('El alto debe ser un número mayor que 0.')).toBeInTheDocument();
    expect(
      screen.getByText('La resolución debe ser un número entero entre 1 y 1200.')
    ).toBeInTheDocument();
  });

  it('rejects a DPI outside the supported range', async () => {
    const { onSave, user } = setup({ dpi: '0' });

    await user.click(screen.getByRole('button', { name: /guardar configuración/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByText('La resolución debe ser un número entero entre 1 y 1200.')
    ).toBeInTheDocument();
  });

  it('calls onPickFolder with the source field when its Elegir button is clicked', async () => {
    const onPickFolder = vi.fn();
    const { user } = setup({}, { onPickFolder });

    await user.click(screen.getByRole('button', { name: /elegir ruta de origen/i }));

    expect(onPickFolder).toHaveBeenCalledWith('sourcePath');
  });

  it('calls onPickFolder with the destination field when its Elegir button is clicked', async () => {
    const onPickFolder = vi.fn();
    const { user } = setup({}, { onPickFolder });

    await user.click(screen.getByRole('button', { name: /elegir ruta de destino/i }));

    expect(onPickFolder).toHaveBeenCalledWith('destPath');
  });

  it('shows a pending state on the picking field and keeps the inputs editable', async () => {
    const { user } = setup({}, { pickingField: 'sourcePath' });

    const sourceButton = screen.getByRole('button', { name: /elegir ruta de origen/i });
    expect(sourceButton).toBeDisabled();
    expect(sourceButton).toHaveTextContent('…');
    expect(screen.getByRole('button', { name: /elegir ruta de destino/i })).toHaveTextContent(
      'Elegir…'
    );

    const source = screen.getByLabelText(/carpeta de origen/i);
    expect(source).not.toBeDisabled();
    await user.type(source, '/typed');
    expect(source).toHaveValue('/photos/in/typed');
  });

  it('shows the fallback message when the picker is unavailable (501)', () => {
    setup({}, { pickerError: { status: 501 } });

    expect(
      screen.getByText('El selector no está disponible en este sistema. Escribe la ruta manualmente.')
    ).toBeInTheDocument();
  });

  it('shows a generic message for other picker failures', () => {
    setup({}, { pickerError: { status: 500 } });

    expect(screen.getByText('No se pudo abrir el selector de carpetas.')).toBeInTheDocument();
  });

  it('saves valid decimal centimeters and a numeric DPI', async () => {
    const { onSave, user } = setup();

    const width = screen.getByLabelText(/^ancho/i);
    await user.clear(width);
    await user.type(width, '10.5');
    await user.selectOptions(screen.getByLabelText(/modo de redimensionado/i), 'fill');
    await user.click(screen.getByRole('button', { name: /guardar configuración/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePath: '/photos/in',
        destPath: '/photos/out',
        widthCm: 10.5,
        heightCm: 7.5,
        dpi: 300,
        quality: 80,
        fit: 'fill',
        format: 'jpeg',
      }),
    );
  });
});
