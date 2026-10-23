const RUNNING = 'running';

export default function RunControls({ status, canStart, onStart, onReset }) {
  const isRunning = status === RUNNING;
  const isTerminal = status === 'done' || status === 'failed' || status === 'connection-lost';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onStart}
        disabled={!canStart || isRunning}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-mist-100 px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ink-950 transition-colors duration-200 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-copper-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:cursor-not-allowed disabled:bg-ink-600 disabled:text-mist-400 motion-reduce:transition-none"
      >
        {isRunning && (
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-copper-400 animate-breathe motion-reduce:animate-none"
          />
        )}
        {isRunning ? 'Procesando' : 'Iniciar proceso'}
      </button>

      {isTerminal && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center rounded-lg border border-ink-600 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-mist-200 transition-colors duration-200 hover:border-mist-400 hover:text-mist-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 motion-reduce:transition-none"
        >
          Limpiar resultados
        </button>
      )}
    </div>
  );
}
