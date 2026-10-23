const fs = require('fs');
const os = require('os');
const path = require('path');

const sharp = require('sharp');
const { WebSocket } = require('ws');

const { start } = require('../src/server');

describe('end-to-end run against the real server (S1-S5)', () => {
  let scratch;
  let sourcePath;
  let destPath;
  let httpServer;
  let baseUrl;

  beforeAll(async () => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'resizer-e2e-'));
    sourcePath = path.join(scratch, 'in');
    destPath = path.join(scratch, 'out', 'nested');
    fs.mkdirSync(sourcePath, { recursive: true });

    await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#ff0000' } })
      .jpeg()
      .toFile(path.join(sourcePath, 'a.jpg'));
    await sharp({ create: { width: 640, height: 480, channels: 3, background: '#00ff00' } })
      .png()
      .toFile(path.join(sourcePath, 'b.png'));

    fs.writeFileSync(path.join(sourcePath, 'notes.txt'), 'not an image');
    fs.writeFileSync(path.join(sourcePath, '.hidden.jpg'), 'hidden');
    fs.writeFileSync(path.join(sourcePath, 'broken.png'), 'not really an image');

    httpServer = await start({
      port: 0,
      configPath: path.join(scratch, 'config.json'),
    });
    baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
  });

  afterAll(() => {
    httpServer.close();
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  test('processes valid images, skips ignored files and reports corrupt ones', async () => {
    const runId = 'e2e-test';
    const events = [];
    const socket = new WebSocket(`ws://127.0.0.1:${httpServer.address().port}/ws?runId=${runId}`);

    socket.on('message', (raw) => events.push(JSON.parse(raw.toString())));
    await new Promise((resolve) => socket.once('open', resolve));

    const response = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId,
        sourcePath,
        destPath,
        widthCm: 10.16,
        heightCm: 7.62,
        dpi: 100,
      }),
    });
    const summary = await response.json();

    await new Promise((resolve) => setTimeout(resolve, 150));
    socket.close();

    expect(response.status).toBe(200);
    expect(summary.processed).toBe(2);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatchObject({ code: 'CORRUPT_FILE', stage: 'resize' });

    const outputs = fs.readdirSync(destPath).sort();
    expect(outputs).toEqual(['a.jpg', 'b.png']);

    const a = await sharp(path.join(destPath, 'a.jpg')).metadata();
    const b = await sharp(path.join(destPath, 'b.png')).metadata();
    expect([a.width, a.height]).toEqual([400, 267]);
    expect([b.width, b.height]).toEqual([400, 300]);

    expect(events.map((event) => event.type)).toEqual([
      'started',
      'progress',
      'progress',
      'error',
      'done',
    ]);

    const errorsResponse = await fetch(`${baseUrl}/api/errors/${runId}`);
    expect(errorsResponse.status).toBe(200);
    const errorsBody = await errorsResponse.json();
    expect(errorsBody.errors).toHaveLength(1);
    expect(errorsBody.errors[0].file).toBe(path.join(sourcePath, 'broken.png'));
  });

  test('serves persisted configuration over HTTP', async () => {
    const put = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widthCm: 21, heightCm: 14.8, dpi: 200 }),
    });
    expect(put.status).toBe(200);

    const get = await fetch(`${baseUrl}/api/config`);
    expect(get.status).toBe(200);
    await expect(get.json()).resolves.toMatchObject({ widthCm: 21, heightCm: 14.8, dpi: 200 });
  });
});
