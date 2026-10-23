const STATUS_COPY = {
  idle: 'Inactivo',
  running: 'Procesando',
  done: 'Completado',
  failed: 'Fallido',
  'connection-lost': 'Interrumpido',
};

function percentFor(status, processed, total) {
  if (status === 'done') return 100;
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((processed / total) * 100)));
}

export default function ProgressPanel({ status, processed, total, currentFile }) {
  const percent = percentFor(status, processed, total);
  const isIdle = status === 'idle';

  return (
    <section
      aria-labelledby="progress-heading"
      className="relative overflow-hidden rounded-2xl border border-ink-600/70 bg-ink-800/60 p-6 shadow-panel backdrop-blur-sm sm:p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-copper-500/10 blur-3xl"
      />

      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="progress-heading"
          className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-mist-400"
        >
          Progreso del lote
        </h2>
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-mist-300">
          {STATUS_COPY[status] ?? 'Inactivo'}
        </span>
      </header>

      {isIdle ? (
        <p className="mt-6 max-w-sm text-sm leading-relaxed text-mist-300">
          Aún no hay ningún lote en ejecución. Confirma las carpetas y la resolución, y luego
          inicia un proceso para ver cada archivo avanzar.
        </p>
      ) : (
        <>
          <div className="mt-5 flex items-end justify-between gap-4">
            <p className="font-display text-5xl leading-none text-mist-100 tabular-nums sm:text-6xl">
              {percent}%
            </p>
            <p className="font-mono text-sm text-mist-200 tabular-nums" data-testid="counts">
              {processed} / {total}
            </p>
          </div>

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Finalización del lote"
            className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink-600"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-copper-600 via-copper-400 to-copper-300 transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="mt-5 min-h-10">
            {currentFile ? (
              <p className="truncate font-mono text-xs text-mist-400" title={currentFile}>
                <span className="text-mist-300">ahora · </span>
                {currentFile}
              </p>
            ) : (
              <p className="font-mono text-xs text-mist-400">&nbsp;</p>
            )}
          </div>

          {status === 'done' && (
            <p className="text-sm text-signal-ok">Lote completado.</p>
          )}
          {status === 'failed' && (
            <p role="alert" className="text-sm text-signal-bad">
              No se pudo iniciar el proceso. El progreso mostrado es el último estado conocido.
            </p>
          )}
          {status === 'connection-lost' && (
            <p role="alert" className="text-sm text-signal-warn">
              Conexión perdida. El progreso mostrado es la última actualización recibida; el
              lote puede seguir terminando en el servidor.
            </p>
          )}
        </>
      )}
    </section>
  );
}
