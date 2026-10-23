export default function ErrorList({ errors }) {
  const items = Array.isArray(errors) ? errors : [];

  return (
    <section
      aria-labelledby="errors-heading"
      className="rounded-2xl border border-ink-600/70 bg-ink-800/60 p-6 shadow-panel backdrop-blur-sm sm:p-8"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2
          id="errors-heading"
          className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-mist-400"
        >
          Errores ({items.length})
        </h2>
        {items.length > 0 && (
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-signal-bad">
            Requiere revisión
          </span>
        )}
      </header>

      {items.length === 0 ? (
        <p className="mt-5 text-sm text-mist-300">
          No se reportaron errores. Todos los archivos detectados se procesaron.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-ink-600/70">
          {items.map((error, index) => (
            <li
              key={`${error.file ?? 'unknown'}-${error.code ?? 'error'}-${index}`}
              className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[auto_1fr] sm:gap-x-5"
            >
              <span className="h-fit rounded-md border border-signal-bad/40 bg-signal-bad/10 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-signal-bad">
                {error.code ?? 'ERROR'}
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-mist-200" title={error.file}>
                  {error.file ?? 'archivo desconocido'}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-mist-300">
                  {error.message ?? 'Sin mensaje.'}
                </p>
                <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-mist-400">
                  etapa · {error.stage ?? 'desconocida'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
