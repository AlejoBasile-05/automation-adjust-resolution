const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const request = require('supertest');
const WebSocket = require('ws');

const { createApp } = require('../src/app');
const { DEFAULT_CONFIG } = require('../src/config');
const { RunManager } = require('../src/ws/runManager');
const { attachWebSocketServer } = require('../src/ws/server');

let tmpRoot;
const servers = [];

async function writeImage(filePath, { width = 40, height = 20 } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toFile(filePath);
}

function writeText(filePath, content = 'not an image') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

async function startServer(options = {}) {
  const runManager = new RunManager();
  const app = createApp(DEFAULT_CONFIG, runManager);
  const httpServer = http.createServer(app);
  const wss = attachWebSocketServer(httpServer, runManager, options);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address();

  const server = {
    app,
    runManager,
    wss,
    httpServer,
    wsUrl: `ws://127.0.0.1:${port}/ws`,
    async close() {
      for (const client of wss.clients) client.terminate();
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => httpServer.close(resolve));
    },
  };
  servers.push(server);
  return server;
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function rejection(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const settle = (value) => {
      ws.removeAllListeners();
      resolve(value);
    };
    ws.once('unexpected-response', (_req, res) => settle(res.statusCode));
    ws.once('error', (error) => settle(error.message));
    ws.once('open', () => {
      ws.close();
      reject(new Error('connection should have been rejected'));
    });
  });
}

function collect(ws) {
  const messages = [];
  ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
  return messages;
}

async function waitFor(predicate, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('waitFor: condition not met before timeout');
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'resizer-ws-'));
});

afterEach(async () => {
  while (servers.length) await servers.pop().close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('T2 — WebSocket progress streaming (S4)', () => {
  test('streams started, per-file progress and done for a subscribed run', async () => {
    const sourcePath = path.join(tmpRoot, 'src');
    const destPath = path.join(tmpRoot, 'dest');
    await writeImage(path.join(sourcePath, 'one.png'));
    await writeImage(path.join(sourcePath, 'two.png'));

    const server = await startServer();
    const ws = await connect(`${server.wsUrl}?runId=run-1`);
    const messages = collect(ws);
    await waitFor(() => server.runManager.has('run-1'));

    const response = await request(server.app)
      .post('/api/process')
      .send({ runId: 'run-1', sourcePath, destPath, width: 40, height: 40, fit: 'inside' });

    expect(response.status).toBe(200);
    await waitFor(() => messages.some((message) => message.type === 'done'));

    const types = messages.map((message) => message.type);
    expect(types[0]).toBe('started');
    expect(types[types.length - 1]).toBe('done');

    expect(messages[0]).toEqual({ type: 'started', runId: 'run-1', total: 2 });

    const progress = messages.filter((message) => message.type === 'progress');
    expect(progress).toHaveLength(2);
    expect(progress[0]).toMatchObject({ type: 'progress', processed: 1, total: 2 });
    expect(path.basename(progress[0].file)).toMatch(/^(one|two)\.png$/);

    expect(messages[messages.length - 1]).toEqual({
      type: 'done',
      total: 2,
      processed: 2,
      errors: [],
    });

    ws.close();
  });

  test('reports per-file errors and still completes the batch', async () => {
    const sourcePath = path.join(tmpRoot, 'src');
    const destPath = path.join(tmpRoot, 'dest');
    await writeImage(path.join(sourcePath, 'good.png'));
    writeText(path.join(sourcePath, 'broken.png'));

    const server = await startServer();
    const ws = await connect(`${server.wsUrl}?runId=run-err`);
    const messages = collect(ws);
    await waitFor(() => server.runManager.has('run-err'));

    await request(server.app)
      .post('/api/process')
      .send({ runId: 'run-err', sourcePath, destPath, width: 40, height: 40 });

    await waitFor(() => messages.some((message) => message.type === 'done'));

    const error = messages.find((message) => message.type === 'error');
    expect(error).toMatchObject({ type: 'error', file: expect.stringContaining('broken.png') });
    expect(typeof error.message).toBe('string');

    const done = messages[messages.length - 1];
    expect(done.type).toBe('done');
    expect(done.processed).toBe(1);
    expect(done.errors).toHaveLength(1);

    ws.close();
  });

  test('rejects a connection without a runId', async () => {
    const server = await startServer();
    await expect(rejection(server.wsUrl)).resolves.toBe(400);
  });

  test('rejects a connection with an empty runId', async () => {
    const server = await startServer();
    await expect(rejection(`${server.wsUrl}?runId=`)).resolves.toBe(400);
  });

  test('releases run state when a client disconnects', async () => {
    const server = await startServer();
    const ws = await connect(`${server.wsUrl}?runId=lonely`);
    await waitFor(() => server.runManager.has('lonely'));

    ws.close();
    await waitFor(() => !server.runManager.has('lonely'));

    expect(server.runManager.has('lonely')).toBe(false);
  });

  test('continues the batch when the WebSocket disconnects early', async () => {
    const sourcePath = path.join(tmpRoot, 'src');
    const destPath = path.join(tmpRoot, 'dest');
    await writeImage(path.join(sourcePath, 'a.png'));
    await writeImage(path.join(sourcePath, 'b.png'));

    const server = await startServer();
    const ws = await connect(`${server.wsUrl}?runId=leaver`);
    await waitFor(() => server.runManager.has('leaver'));
    ws.terminate();
    await waitFor(() => !server.runManager.has('leaver'));

    const response = await request(server.app)
      .post('/api/process')
      .send({ runId: 'leaver', sourcePath, destPath, width: 40, height: 40 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ total: 2, processed: 2, errors: [] });
  });

  test('keeps the connection alive with heartbeat pings', async () => {
    const server = await startServer({ heartbeatInterval: 25 });
    const ws = await connect(`${server.wsUrl}?runId=heartbeat`);

    let pings = 0;
    ws.on('ping', () => {
      pings += 1;
    });

    await waitFor(() => pings >= 2, 2000);

    expect(pings).toBeGreaterThanOrEqual(2);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  test('keeps concurrent runs isolated on their own streams', async () => {
    const sourceA = path.join(tmpRoot, 'a');
    const sourceB = path.join(tmpRoot, 'b');
    await writeImage(path.join(sourceA, 'only-a.png'));
    await writeImage(path.join(sourceB, 'b1.png'));
    await writeImage(path.join(sourceB, 'b2.png'));

    const server = await startServer();
    const wsA = await connect(`${server.wsUrl}?runId=alpha`);
    const wsB = await connect(`${server.wsUrl}?runId=beta`);
    const messagesA = collect(wsA);
    const messagesB = collect(wsB);
    await waitFor(() => server.runManager.has('alpha') && server.runManager.has('beta'));

    await Promise.all([
      request(server.app)
        .post('/api/process')
        .send({ runId: 'alpha', sourcePath: sourceA, destPath: path.join(tmpRoot, 'outA'), width: 40, height: 40 }),
      request(server.app)
        .post('/api/process')
        .send({ runId: 'beta', sourcePath: sourceB, destPath: path.join(tmpRoot, 'outB'), width: 40, height: 40 }),
    ]);

    await waitFor(
      () => messagesA.some((message) => message.type === 'done') && messagesB.some((message) => message.type === 'done')
    );

    expect(messagesA.find((message) => message.type === 'started')).toEqual({
      type: 'started',
      runId: 'alpha',
      total: 1,
    });
    expect(messagesA.find((message) => message.type === 'done')).toEqual({
      type: 'done',
      total: 1,
      processed: 1,
      errors: [],
    });
    expect(messagesB.find((message) => message.type === 'started')).toEqual({
      type: 'started',
      runId: 'beta',
      total: 2,
    });
    expect(messagesB.find((message) => message.type === 'done')).toEqual({
      type: 'done',
      total: 2,
      processed: 2,
      errors: [],
    });

    wsA.close();
    wsB.close();
  });
});
