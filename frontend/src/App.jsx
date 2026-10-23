import { useCallback, useEffect, useMemo, useState } from 'react';

import ConfigForm from './components/ConfigForm.jsx';
import ErrorList from './components/ErrorList.jsx';
import ProgressPanel from './components/ProgressPanel.jsx';
import RunControls from './components/RunControls.jsx';
import useRunStream from './hooks/useRunStream.js';
import { getConfig, saveConfig } from './services/api.js';
import { hasErrors, normalizeConfig, validateConfig } from './services/validation.js';

const FALLBACK_CONFIG = {
  sourcePath: '',
  destPath: '',
  width: 800,
  height: 600,
  fit: 'inside',
  quality: 80,
  format: 'jpeg',
};

const NOTICE_TONE = {
  ok: 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok',
  bad: 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
};

export default function App() {
  const [values, setValues] = useState(FALLBACK_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const { status, processed, total, currentFile, errors, errorMessage, start, reset } =
    useRunStream();

  useEffect(() => {
    let active = true;

    getConfig()
      .then((config) => {
        if (active && config) setValues({ ...FALLBACK_CONFIG, ...config });
      })
      .catch((error) => {
        if (active) {
          setNotice({ tone: 'bad', text: `No se pudo cargar la configuración: ${error.message}` });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleChange = useCallback((field, value) => {
    setNotice(null);
    setValues((current) => ({ ...current, [field]: value }));
  }, []);

  const handleSave = useCallback(async (next) => {
    setSaving(true);
    setNotice(null);
    try {
      const saved = await saveConfig(next);
      setValues((current) => ({ ...current, ...(saved ?? next) }));
      setNotice({ tone: 'ok', text: 'Configuración guardada — persistida en el servidor.' });
    } catch (error) {
      setNotice({ tone: 'bad', text: `No se pudo guardar la configuración: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }, []);

  const validationErrors = useMemo(() => validateConfig(values), [values]);
  const canStart = !hasErrors(validationErrors) && status !== 'running';

  const handleStart = useCallback(() => {
    start(normalizeConfig(values));
  }, [start, values]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-600/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 place-items-center rounded-lg border border-copper-400/40 bg-copper-400/10 font-display text-lg text-copper-300"
            >
              L
            </span>
            <div>
              <p className="font-display text-lg leading-none text-mist-100">Lumen</p>
              <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.24em] text-mist-400">
                Atelier de resolución de imágenes
              </p>
            </div>
          </div>

          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-mist-400">
            {loading ? 'Cargando configuración' : `${values.width}×${values.height} · ${values.format}`}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="animate-rise motion-reduce:animate-none">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-copper-400">
            Redimensionado por lotes
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.05] text-mist-100 sm:text-6xl">
            Apunta a una carpeta.
            <br />
            Obtén un conjunto uniforme.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-mist-300 sm:text-base">
            Cada imagen compatible de la carpeta de origen se redimensiona a la resolución
            indicada y se guarda en la carpeta de destino. Observa cada archivo en tiempo real y
            el lote continúa incluso si un archivo falla.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <RunControls
              status={status}
              canStart={canStart}
              onStart={handleStart}
              onReset={reset}
            />
            {loading && (
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-mist-400">
                Sincronizando…
              </span>
            )}
          </div>

          {notice && (
            <p
              role="status"
              className={`mt-5 inline-flex rounded-lg border px-3 py-2 font-mono text-xs ${NOTICE_TONE[notice.tone]}`}
            >
              {notice.text}
            </p>
          )}
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <ConfigForm
            values={values}
            onChange={handleChange}
            onSave={handleSave}
            disabled={saving || status === 'running'}
          />

          <aside className="flex flex-col gap-6">
            <ProgressPanel
              status={status}
              processed={processed}
              total={total}
              currentFile={currentFile}
            />

            {status === 'failed' && errorMessage && (
              <p
                role="alert"
                className="rounded-xl border border-signal-bad/40 bg-signal-bad/10 px-4 py-3 text-sm text-signal-bad"
              >
                {errorMessage}
              </p>
            )}

            <ErrorList errors={errors} />
          </aside>
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
        <p className="border-t border-ink-600/60 pt-6 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-mist-400">
          Sharp · pipeline libvips · solo local
        </p>
      </footer>
    </div>
  );
}
