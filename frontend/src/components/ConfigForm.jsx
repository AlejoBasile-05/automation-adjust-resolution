import { useState } from 'react';

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

export default function ConfigForm({ values, onChange, onSave, disabled = false }) {
  const [touched, setTouched] = useState({});
  const errors = validateConfig(values);

  const update = (field) => (event) => onChange(field, event.target.value);
  const touch = (field) => () => setTouched((current) => ({ ...current, [field]: true }));

  const errorFor = (field) => (touched[field] ? errors[field] : undefined);

  const handleSubmit = (event) => {
    event.preventDefault();
    setTouched({ sourcePath: true, destPath: true, width: true, height: true, quality: true });
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
            <Field
              id="sourcePath"
              label="Carpeta de origen"
              hint="se escanea de forma recursiva"
              error={errorFor('sourcePath')}
            >
              <input
                id="sourcePath"
                type="text"
                spellCheck={false}
                autoComplete="off"
                placeholder="/Users/you/Photos/originals"
                value={values.sourcePath}
                onChange={update('sourcePath')}
                onBlur={touch('sourcePath')}
                aria-invalid={Boolean(errorFor('sourcePath'))}
                aria-describedby={errorFor('sourcePath') ? 'sourcePath-error' : undefined}
                className={inputClasses}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              id="destPath"
              label="Carpeta de destino"
              hint="se crea si no existe"
              error={errorFor('destPath')}
            >
              <input
                id="destPath"
                type="text"
                spellCheck={false}
                autoComplete="off"
                placeholder="/Users/you/Photos/resized"
                value={values.destPath}
                onChange={update('destPath')}
                onBlur={touch('destPath')}
                aria-invalid={Boolean(errorFor('destPath'))}
                aria-describedby={errorFor('destPath') ? 'destPath-error' : undefined}
                className={inputClasses}
              />
            </Field>
          </div>
        </Section>

        <Section index="02" title="Geometría">
          <Field id="width" label="Ancho" hint="px" error={errorFor('width')}>
            <input
              id="width"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={values.width}
              onChange={update('width')}
              onBlur={touch('width')}
              aria-invalid={Boolean(errorFor('width'))}
              aria-describedby={errorFor('width') ? 'width-error' : undefined}
              className={inputClasses}
            />
          </Field>

          <Field id="height" label="Alto" hint="px" error={errorFor('height')}>
            <input
              id="height"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={values.height}
              onChange={update('height')}
              onBlur={touch('height')}
              aria-invalid={Boolean(errorFor('height'))}
              aria-describedby={errorFor('height') ? 'height-error' : undefined}
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
