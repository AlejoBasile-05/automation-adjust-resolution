import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getConfig, getErrors, processBatch, saveConfig } from '../src/services/api.js';

const CONFIG = {
  sourcePath: '',
  destPath: '',
  width: 800,
  height: 600,
  fit: 'inside',
  quality: 80,
  format: 'jpeg',
};

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('api service', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the persisted config with GET /api/config', async () => {
    global.fetch.mockResolvedValue(jsonResponse(CONFIG));

    await expect(getConfig()).resolves.toEqual(CONFIG);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/config');
    expect(options.method ?? 'GET').toBe('GET');
  });

  it('saves a partial config patch with PUT /api/config', async () => {
    const saved = { ...CONFIG, sourcePath: '/a', width: 1920 };
    global.fetch.mockResolvedValue(jsonResponse(saved));

    await expect(saveConfig({ sourcePath: '/a', width: 1920 })).resolves.toEqual(saved);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/config');
    expect(options.method).toBe('PUT');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ sourcePath: '/a', width: 1920 });
  });

  it('starts a batch with POST /api/process including the runId', async () => {
    const summary = { total: 10, processed: 9, errors: [] };
    global.fetch.mockResolvedValue(jsonResponse(summary));

    const payload = { runId: 'run-1', ...CONFIG, sourcePath: '/a', destPath: '/b' };
    await expect(processBatch(payload)).resolves.toEqual(summary);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/process');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(payload);
  });

  it('surfaces the backend error message when a request fails', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ error: 'Source folder missing' }, 500));

    await expect(processBatch({ runId: 'run-1' })).rejects.toThrow('Source folder missing');
  });

  it('fetches structured run errors with GET /api/errors/:runId', async () => {
    const errors = [
      {
        code: 'CORRUPT_FILE',
        file: '/src/a.png',
        stage: 'resize',
        message: 'bad bytes',
        timestamp: 't',
      },
    ];
    global.fetch.mockResolvedValue(jsonResponse({ runId: 'run-1', errors }));

    await expect(getErrors('run-1')).resolves.toEqual(errors);
    expect(global.fetch.mock.calls[0][0]).toBe('/api/errors/run-1');
  });

  it('treats an unknown run as an empty error list', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ error: 'Run not found' }, 404));

    await expect(getErrors('missing')).resolves.toEqual([]);
  });
});
