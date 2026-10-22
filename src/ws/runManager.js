const { WebSocket } = require('ws');

/**
 * Bridges pipeline EventEmitters to WebSocket clients.
 *
 * Each run is keyed by a runId. A client socket connects first and registers
 * for a runId; the pipeline is attached later (when POST /api/process starts
 * the run) and its events are forwarded to every socket registered for that
 * run. Delivery is fire-and-forget: a slow or dead socket never blocks the
 * pipeline.
 */
class RunManager {
  constructor() {
    this.runs = new Map();
    // Kept after teardown so a finished run's errors stay queryable over HTTP.
    this.errorsByRun = new Map();
  }

  has(runId) {
    return this.runs.has(runId);
  }

  /** Attach a client socket to a run's event stream. */
  register(runId, socket) {
    const run = this.ensureRun(runId);
    run.sockets.add(socket);

    const detach = () => this.unregister(runId, socket);
    socket.once('close', detach);
    socket.once('error', detach);

    // A socket that joins after the run started still needs the header event.
    if (run.started) {
      this.deliver(socket, { type: 'started', runId, total: run.total });
    }

    return run;
  }

  /** Subscribe a pipeline to a run and forward its events to the sockets. */
  attach(runId, pipeline, total = 0) {
    const run = this.ensureRun(runId);
    run.pipeline = pipeline;
    run.total = total;
    run.started = true;
    this.errorsByRun.set(runId, []);

    this.broadcast(run, { type: 'started', runId, total });

    run.listeners = {
      progress: (event) =>
        this.broadcast(run, {
          type: 'progress',
          file: event.file,
          processed: event.processed,
          total: event.total,
        }),
      error: (event) => {
        const payload = this.toErrorPayload(event);
        this.recordError(runId, payload);
        this.broadcast(run, {
          type: 'error',
          file: payload.file,
          message: payload.message,
          error: payload,
        });
      },
      done: (summary) => {
        this.broadcast(run, {
          type: 'done',
          total: summary.total,
          processed: summary.processed,
          errors: summary.errors,
        });
        this.teardown(runId);
      },
    };

    pipeline.on('progress', run.listeners.progress);
    pipeline.on('error', run.listeners.error);
    pipeline.on('done', run.listeners.done);

    return run;
  }

  /** Structured errors recorded for a run, or null when the run is unknown. */
  errorsFor(runId) {
    const errors = this.errorsByRun.get(runId);
    return errors ? [...errors] : null;
  }

  recordError(runId, error) {
    const errors = this.errorsByRun.get(runId);
    if (errors) errors.push(error);
    else this.errorsByRun.set(runId, [error]);
  }

  toErrorPayload(event) {
    const error = event.error;
    if (error && typeof error.toJSON === 'function') return error.toJSON();
    return {
      code: 'RESIZE_FAILED',
      file: event.file,
      stage: 'resize',
      message: error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }

  unregister(runId, socket) {
    const run = this.runs.get(runId);
    if (!run) return;

    run.sockets.delete(socket);
    if (run.sockets.size === 0) this.teardown(runId);
  }

  /** Release a run's pipeline listeners and bookkeeping. */
  teardown(runId) {
    const run = this.runs.get(runId);
    if (!run) return;

    if (run.listeners) {
      run.pipeline.off('progress', run.listeners.progress);
      run.pipeline.off('error', run.listeners.error);
      run.pipeline.off('done', run.listeners.done);
    }

    this.runs.delete(runId);
  }

  ensureRun(runId) {
    let run = this.runs.get(runId);
    if (!run) {
      run = { sockets: new Set(), pipeline: null, started: false, total: 0, listeners: null };
      this.runs.set(runId, run);
    }
    return run;
  }

  broadcast(run, message) {
    for (const socket of run.sockets) this.deliver(socket, message);
  }

  deliver(socket, message) {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(message));
    } catch (error) {
      // Fire-and-forget: a failed delivery must never interrupt the pipeline.
    }
  }
}

module.exports = { RunManager };
