import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useRunStream from '../src/hooks/useRunStream.js';

class FakeSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.listeners = new Map();
    this.closed = false;
    FakeSocket.instances.push(this);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  emitMessage(payload) {
    this.emit('message', { data: JSON.stringify(payload) });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.emit('close', {});
  }
}

const CONFIG = {
  sourcePath: '/a',
  destPath: '/b',
  width: 800,
  height: 600,
  fit: 'inside',
  quality: 80,
  format: 'jpeg',
};

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('useRunStream', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ total: 0, processed: 0, errors: [] }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens the stream for a fresh runId before POSTing the batch', async () => {
    const { result } = renderHook(() => useRunStream());

    await act(async () => {
      await result.current.start(CONFIG);
    });

    expect(FakeSocket.instances).toHaveLength(1);
    const socket = FakeSocket.instances[0];
    const runId = new URL(socket.url).searchParams.get('runId');
    expect(runId).toBeTruthy();
    expect(socket.url).toMatch(/\/ws\?runId=/);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/process');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toMatchObject({ ...CONFIG, runId });

    act(() => socket.emitMessage({ type: 'started', runId, total: 10 }));
    act(() =>
      socket.emitMessage({ type: 'progress', file: '/a.jpg', processed: 3, total: 10 }),
    );

    expect(result.current.status).toBe('running');
    expect(result.current.total).toBe(10);
    expect(result.current.processed).toBe(3);
    expect(result.current.currentFile).toBe('/a.jpg');
  });

  it('keeps per-file errors and pulls the full list once the run is done', async () => {
    const persisted = [
      {
        code: 'CORRUPT_FILE',
        file: '/a.png',
        stage: 'resize',
        message: 'bad bytes',
        timestamp: 't',
      },
      {
        code: 'WRITE_FAILED',
        file: '/b.jpg',
        stage: 'write',
        message: 'denied',
        timestamp: 't',
      },
    ];
    global.fetch.mockImplementation(async (url) => {
      if (url.startsWith('/api/errors/')) return jsonResponse({ runId: 'x', errors: persisted });
      return jsonResponse({ total: 10, processed: 9, errors: [] });
    });

    const { result } = renderHook(() => useRunStream());
    await act(async () => {
      await result.current.start(CONFIG);
    });

    const socket = FakeSocket.instances[0];
    act(() => socket.emitMessage({ type: 'started', runId: 'x', total: 10 }));
    act(() =>
      socket.emitMessage({
        type: 'error',
        file: '/a.png',
        message: 'bad bytes',
        error: persisted[0],
      }),
    );
    expect(result.current.errors).toHaveLength(1);

    act(() =>
      socket.emitMessage({ type: 'done', total: 10, processed: 9, errors: [persisted[0]] }),
    );

    expect(result.current.status).toBe('done');
    expect(result.current.processed).toBe(9);
    await waitFor(() => expect(result.current.errors).toEqual(persisted));
  });

  it('flags a lost connection without dropping rendered progress', async () => {
    const { result } = renderHook(() => useRunStream());
    await act(async () => {
      await result.current.start(CONFIG);
    });

    const socket = FakeSocket.instances[0];
    act(() => socket.emitMessage({ type: 'started', total: 10 }));
    act(() => socket.emitMessage({ type: 'progress', file: '/a.jpg', processed: 4, total: 10 }));
    act(() => socket.close());

    expect(result.current.status).toBe('connection-lost');
    expect(result.current.processed).toBe(4);
    expect(result.current.total).toBe(10);
  });

  it('reports a fatal backend error as a failed run', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ error: 'Source folder missing' }, 500));

    const { result } = renderHook(() => useRunStream());
    await act(async () => {
      await result.current.start(CONFIG);
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.errorMessage).toBe('Source folder missing');
  });
});
