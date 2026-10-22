const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const sharp = require('sharp');
const request = require('supertest');
const { WebSocket } = require('ws');

const { createApp } = require('../src/app');
const { createPipeline } = require('../src/pipeline/orchestrator');
const { RunManager } = require('../src/ws/runManager');
const { PipelineError, corruptFile } = require('../src/errors/pipelineError');
const { ERROR_CODES } = require('../src/errors/errorTypes');

let tmpRoot;

async function writeImage(filePath, { width = 40, height = 20 } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toFile(filePath);
}

function writeText(filePath, content = 'this is not a real image') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function configFor(sourcePath, destPath, overrides = {}) {
  return { sourcePath, destPath, width: 30, height: 30, fit: 'inside', ...overrides };
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'resizer-errors-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('T3.1 — structured PipelineError', () => {
  test('factory exposes code, file, stage and ISO timestamp in JSON and the catalog defines all codes', () => {
    const error = corruptFile('/source/photo.jpg', 'Input buffer contains unsupported image format');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PipelineError);
    expect(error.name).toBe('PipelineError');

    const json = error.toJSON();
    expect(json).toEqual({
      code: 'CORRUPT_FILE',
      file: '/source/photo.jpg',
      stage: 'resize',
      message: 'Input buffer contains unsupported image format',
      timestamp: expect.any(String),
    });
    expect(Object.keys(json)).toEqual(['code', 'file', 'stage', 'message', 'timestamp']);
    expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);

    expect(Object.values(ERROR_CODES).sort()).toEqual([
      'CORRUPT_FILE',
      'DESTINATION_NOT_FOUND',
      'RESIZE_FAILED',
      'SOURCE_NOT_FOUND',
      'UNSUPPORTED_FORMAT',
      'WRITE_FAILED',
    ]);
  });
});

describe('T3.3 — orchestrator: enriched per-file errors', () => {
  test('a corrupt file reports CORRUPT_FILE at the resize stage and the batch continues', async () => {
    const sourcePath = path.join(tmpRoot, 'src');
    const destPath = path.join(tmpRoot, 'dest');
    await writeImage(path.join(sourcePath, 'good-a.png'));
    await writeImage(path.join(sourcePath, 'good-b.png'));
    writeText(path.join(sourcePath, 'broken.png'));

    const pipeline = createPipeline(configFor(sourcePath, destPath));
    const errors = [];
    const progress = [];
    pipeline.on('error', (event) => errors.push(event));
    pipeline.on('progress', (event) => progress.push(event));

    const summary = await pipeline.run();

    expect(errors).toHaveLength(1);
    const reported = errors[0].error;
    expect(reported).toBeInstanceOf(PipelineError);
    expect(reported.toJSON()).toEqual({
      code: 'CORRUPT_FILE',
      file: expect.stringContaining('broken.png'),
      stage: 'resize',
      message: expect.stringContaining('unsupported image format'),
      timestamp: expect.any(String),
    });

    expect(summary).toEqual({
      total: 3,
      processed: 2,
      errors: [reported.toJSON()],
    });
    expect(progress.map((event) => path.basename(event.file)).sort()).toEqual([
      'good-a.png',
      'good-b.png',
    ]);
    expect(fs.existsSync(path.join(destPath, 'good-a.png'))).toBe(true);
    expect(fs.existsSync(path.join(destPath, 'good-b.png'))).toBe(true);
    expect(fs.existsSync(path.join(destPath, 'broken.png'))).toBe(false);
  });

  test('a write failure reports WRITE_FAILED at the write stage and the batch continues', async () => {
    const sourcePath = path.join(tmpRoot, 'src');
    await writeImage(path.join(sourcePath, 'one.png'));
    await writeImage(path.join(sourcePath, 'two.png'));

    // A regular file where the destination directory should be forces every write to fail.
    const blocker = path.join(tmpRoot, 'blocker');
    fs.writeFileSync(blocker, 'not a directory');
    const destPath = path.join(blocker, 'dest');

    const pipeline = createPipeline(configFor(sourcePath, destPath));
    const errors = [];
    pipeline.on('error', (event) => errors.push(event));

    const summary = await pipeline.run();

    expect(summary.total).toBe(2);
    expect(summary.processed).toBe(0);
    expect(summary.errors).toHaveLength(2);
    expect(errors).toHaveLength(2);
    for (const { error } of errors) {
      expect(error).toBeInstanceOf(PipelineError);
      expect(error.toJSON()).toEqual({
        code: 'WRITE_FAILED',
        file: expect.stringContaining('.png'),
        stage: 'write',
        message: expect.any(String),
        timestamp: expect.any(String),
      });
    }
  });

  test('a missing source folder fails with a structured SOURCE_NOT_FOUND error', async () => {
    const sourcePath = path.join(tmpRoot, 'missing');
    const pipeline = createPipeline(configFor(sourcePath, path.join(tmpRoot, 'dest')));

    const failure = await pipeline.run().catch((error) => error);

    expect(failure).toBeInstanceOf(PipelineError);
    expect(failure.toJSON()).toEqual({
      code: 'SOURCE_NOT_FOUND',
      file: sourcePath,
      stage: 'discover',
      message: expect.stringContaining(sourcePath),
      timestamp: expect.any(String),
    });
  });
});

describe('T3.3/T3.4 — error reporting across WebSocket and HTTP', () => {
  test('the WebSocket error payload and the errors stored per run share the structured format', async () => {
    const sourcePath = path.join(tmpRoot, 'src');
    const destPath = path.join(tmpRoot, 'dest');
    await writeImage(path.join(sourcePath, 'good.png'));
    writeText(path.join(sourcePath, 'broken.png'));

    const runManager = new RunManager();
    const socket = new EventEmitter();
    socket.readyState = WebSocket.OPEN;
    socket.send = jest.fn();
    runManager.register('run-ws', socket);

    const pipeline = createPipeline(configFor(sourcePath, destPath));
    runManager.attach('run-ws', pipeline, 2);
    await pipeline.run();

    const sent = socket.send.mock.calls.map(([raw]) => JSON.parse(raw));
    const errorMessage = sent.find((message) => message.type === 'error');

    expect(errorMessage).toMatchObject({
      type: 'error',
      file: expect.stringContaining('broken.png'),
      message: expect.stringContaining('unsupported image format'),
      error: {
        code: 'CORRUPT_FILE',
        file: expect.stringContaining('broken.png'),
        stage: 'resize',
        message: expect.stringContaining('unsupported image format'),
        timestamp: expect.any(String),
      },
    });
    expect(runManager.errorsFor('run-ws')).toEqual([errorMessage.error]);
  });

  test('GET /api/errors/:runId returns the structured errors recorded for that run', async () => {
    const sourcePath = path.join(tmpRoot, 'src');
    const destPath = path.join(tmpRoot, 'dest');
    await writeImage(path.join(sourcePath, 'good.png'));
    writeText(path.join(sourcePath, 'broken.png'));

    const app = createApp();
    const runResponse = await request(app)
      .post('/api/process')
      .send({ runId: 'run-errors', ...configFor(sourcePath, destPath) });

    expect(runResponse.status).toBe(200);

    const response = await request(app).get('/api/errors/run-errors');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      runId: 'run-errors',
      errors: [
        {
          code: 'CORRUPT_FILE',
          file: expect.stringContaining('broken.png'),
          stage: 'resize',
          message: expect.stringContaining('unsupported image format'),
          timestamp: expect.any(String),
        },
      ],
    });
    expect(response.body.errors).toEqual(runResponse.body.errors);
  });

  test('GET /api/errors/:runId returns 404 for an unknown run', async () => {
    const response = await request(createApp()).get('/api/errors/never-started');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Run not found' });
  });
});
