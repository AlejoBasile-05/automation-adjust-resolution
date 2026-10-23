import { useState } from 'react';

import { cmToPx } from '../services/units.js';
import { hasErrors, normalizeConfig, validateConfig } from '../services/validation.js';

const FIT_OPTIONS = [
  { value: 'inside', label: 'Inside — conserva la proporción' },
  { value: 'fill', label: 'Fill — estira al tamaño exacto' },
];

const FORMAT_OPTIONS = ['jpeg', 'png', 'webp', 'tiff', 'gif'];

function Field({ id, label, hint, error, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-mist-300"
        >
          {label}
        </label>
        {hint && <span className="font-mono text-[0.65rem] text-mist-400">{hint}</span>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-signal-bad">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClasses =
  'w-full rounded-lg border border-ink-600 bg-ink-900/80 px-3.5 py-2.5 font-mono text-sm text-mist-100 placeholder:text-mist-400/60 transition-colors duration-200 hover:border-ink-600/80 focus:border-copper-400 focus:outline-none focus:ring-2 focus:ring-copper-400/30 motion-reduce:transition-none';

const pickButtonClasses =
  'shrink-0 rounded-lg border border-ink-600 bg-ink-900/60 px-3.5 py-2.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-mist-200 transition-colors duration-200 hover:border-copper-400/60 hover:text-copper-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none';

const PICKER_UNAVAILABLE =
  'El selector no está disponible en este sistema. Escribí la ruta manualmente.';
const PICKER_GENERIC_ERROR = 'No se pudo abrir el selector de carpetas.';

function pickerMessage(pickerError) {
  if (!pickerError) return null;
  return pickerError.status === 501 ? PICKER_UNAVAILABLE : PICKER_GENERIC_ERROR;
}

function FolderField({ id, label, hint, error, value, placeholder, onChange, onBlur, onPick, picking }) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <div className="flex items-stretch gap-2">
        <input
          id={id}
          type="text"
          spellCheck={false}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={`${inputClasses} flex-1`}
        />
        <button
          type="button"
          onClick={() => onPick(id)}
          disabled={picking}
          aria-label={`Elegir ruta de ${id === 'sourcePath' ? 'origen' : 'destino'}`}
          className={pickButtonClasses}
        >
          {picking ? '…' : 'Elegir…'}
        </button>
      </div>
    </Field>
  );
}

function Section({ index, title, children }) {
  return (
    <fieldset className="grid gap-5 sm:grid-cols-2">
      <legend className="col-span-full flex items-center gap-3 pb-1">
        <span className="font-mono text-[0.65rem] text-copper-400">{index}</span>
        <span className="font-display text-xl text-mist-100">{title}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-ink-600/80" />
      </legend>
      {children}
    </fieldset>
  );
}

export default function ConfigForm({
  values,
  onChange,
  onSave,
  onPickFolder = () => {},
  pickingField = null,
  pickerError = null,
  disabled = false,
}) {
  const [touched, setTouched] = useState({});
  const errors = validateConfig(values);
  const folderPickerMessage = pickerMessage(pickerError);

  const update = (field) => (event) => onChange(field, event.target.value);
  const touch = (field) => () => setTouched((current) => ({ ...current, [field]: true }));

  const errorFor = (field) => (touched[field] ? errors[field] : undefined);

  const handleSubmit = (event) => {
    event.preventDefault();
    setTouched({
      sourcePath: true,
      destPath: true,
      widthCm: true,
      heightCm: true,
      dpi: true,
      quality: true,
    });
    if (hasErrors(errors)) return;
    onSave(normalizeConfig(values));
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Configuración del lote"
      className="rounded-2xl border border-ink-600/70 bg-ink-800/60 p-6 shadow-panel backdrop-blur-sm sm:p-8"
    >
      <div className="grid gap-8">
        <Section index="01" title="Carpetas">
          <div className="sm:col-span-2">
            <FolderField
              id="sourcePath"
              label="Carpeta de origen"
              hint="se escanea de forma recursiva"
              error={errorFor('sourcePath')}
              value={values.sourcePath}
              placeholder="/Users/you/Photos/originals"
              onChange={update('sourcePath')}
              onBlur={touch('sourcePath')}
              onPick={onPickFolder}
              picking={pickingField === 'sourcePath'}
            />
          </div>

          <div className="sm:col-span-2">
            <FolderField
              id="destPath"
              label="Carpeta de destino"
              hint="se crea si no existe"
              error={errorFor('destPath')}
              value={values.destPath}
              placeholder="/Users/you/Photos/resized"
              onChange={update('destPath')}
              onBlur={touch('destPath')}
              onPick={onPickFolder}
              picking={pickingField === 'destPath'}
            />
          </div>

          {folderPickerMessage && (
            <div className="sm:col-span-2">
              <p
                role="alert"
                className="rounded-lg border border-signal-bad/40 bg-signal-bad/10 px-3.5 py-2.5 font-mono text-xs text-signal-bad"
              >
                {folderPickerMessage}
              </p>
            </div>
          )}
        </Section>

        <Section index="02" title="Geometría">
          <Field id="widthCm" label="Ancho (cm)" error={errorFor('widthCm')}>
            <input
              id="widthCm"
              type="number"
              inputMode="decimal"
              min="0.1"
              max="1000"
              step="0.1"
              value={values.widthCm}
              onChange={update('widthCm')}
              onBlur={touch('widthCm')}
              aria-invalid={Boolean(errorFor('widthCm'))}
              aria-describedby={errorFor('widthCm') ? 'widthCm-error' : undefined}
              className={inputClasses}
            />
          </Field>

          <Field id="heightCm" label="Alto (cm)" error={errorFor('heightCm')}>
            <input
              id="heightCm"
              type="number"
              inputMode="decimal"
              min="0.1"
              max="1000"
              step="0.1"
              value={values.heightCm}
              onChange={update('heightCm')}
              onBlur={touch('heightCm')}
              aria-invalid={Boolean(errorFor('heightCm'))}
              aria-describedby={errorFor('heightCm') ? 'heightCm-error' : undefined}
              className={inputClasses}
            />
          </Field>

          <Field
            id="dpi"
            label="Resolución (DPI)"
            hint="píxeles por pulgada"
            error={errorFor('dpi')}
          >
            <input
              id="dpi"
              type="number"
              inputMode="numeric"
              min="1"
              max="1200"
              step="1"
              value={values.dpi}
              onChange={update('dpi')}
              onBlur={touch('dpi')}
              aria-invalid={Boolean(errorFor('dpi'))}
              aria-describedby={errorFor('dpi') ? 'dpi-error' : undefined}
              className={inputClasses}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field id="fit" label="Modo de redimensionado">
              <select
                id="fit"
                value={values.fit}
                onChange={update('fit')}
                className={`${inputClasses} appearance-none`}
              >
                {FIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <p
              data-testid="px-preview"
              aria-live="polite"
              className="rounded-lg border border-ink-600/70 bg-ink-900/60 px-3.5 py-2.5 font-mono text-sm text-mist-200"
            >
              ≈ {cmToPx(values.widthCm, values.dpi)} × {cmToPx(values.heightCm, values.dpi)} px
            </p>
          </div>
        </Section>

        <Section index="03" title="Codificación">
          <Field
            id="quality"
            label="Calidad"
            hint="1 – 100"
            error={errorFor('quality')}
          >
            <input
              id="quality"
              type="number"
              inputMode="numeric"
              min="1"
              max="100"
              step="1"
              value={values.quality}
              onChange={update('quality')}
              onBlur={touch('quality')}
              aria-invalid={Boolean(errorFor('quality'))}
              aria-describedby={errorFor('quality') ? 'quality-error' : undefined}
              className={inputClasses}
            />
          </Field>

          <Field id="format" label="Formato">
            <select
              id="format"
              value={values.format}
              onChange={update('format')}
              className={`${inputClasses} appearance-none`}
            >
              {FORMAT_OPTIONS.map((format) => (
                <option key={format} value={format}>
                  {format.toUpperCase()}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <div className="flex flex-col gap-3 border-t border-ink-600/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xs text-xs leading-relaxed text-mist-400">
            La configuración se guarda en el servidor y se restaura al recargar.
          </p>
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center justify-center rounded-lg bg-copper-400 px-5 py-2.5 font-mono text-xs font-medium uppercase tracking-[0.2em] text-ink-950 transition-colors duration-200 hover:bg-copper-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            Guardar configuración
          </button>
        </div>
      </div>
    </form>
  );
}
