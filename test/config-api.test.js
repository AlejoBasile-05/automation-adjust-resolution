const fs = require('fs');
const os = require('os');
const path = require('path');

const request = require('supertest');

const { createApp } = require('../src/app');

describe('config API (S6)', () => {
  let scratch;
  let configPath;

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'resizer-config-'));
    configPath = path.join(scratch, 'config.json');
  });

  afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  test('GET /api/config returns defaults when the file does not exist', async () => {
    const app = createApp(undefined, undefined, { configPath });

    const res = await request(app).get('/api/config');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      schemaVersion: 2,
      widthCm: 10,
      heightCm: 7.5,
      dpi: 300,
      fit: 'inside',
      quality: 80,
      format: 'jpeg',
    });
  });

  test('PUT /api/config persists settings to disk and GET reflects them', async () => {
    const app = createApp(undefined, undefined, { configPath });

    const put = await request(app)
      .put('/api/config')
      .send({ sourcePath: '/tmp/src', destPath: '/tmp/dst', widthCm: 20, heightCm: 15, dpi: 200 });

    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ widthCm: 20, heightCm: 15, dpi: 200 });

    const onDisk = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(onDisk.widthCm).toBe(20);
    expect(onDisk.schemaVersion).toBe(2);
    expect(onDisk.sourcePath).toBe('/tmp/src');

    const get = await request(app).get('/api/config');
    expect(get.status).toBe(200);
    expect(get.body).toMatchObject({ destPath: '/tmp/dst', widthCm: 20, dpi: 200 });
  });

  test('PUT /api/config merges partial updates without dropping existing settings', async () => {
    const app = createApp(undefined, undefined, { configPath });

    await request(app).put('/api/config').send({ widthCm: 20, heightCm: 15, dpi: 150 });
    const res = await request(app).put('/api/config').send({ quality: 55 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ widthCm: 20, heightCm: 15, dpi: 150, quality: 55 });
  });

  test.each([
    ['a non-numeric DPI', { dpi: 'abc' }],
    ['a DPI above the range', { dpi: 1500 }],
    ['a DPI below the range', { dpi: 0 }],
    ['a fractional DPI', { dpi: 300.5 }],
    ['a zero width', { widthCm: 0 }],
    ['a negative height', { heightCm: -3 }],
    ['a width above the range', { widthCm: 1001 }],
  ])('PUT /api/config rejects %s and leaves the file unchanged', async (_label, payload) => {
    const app = createApp(undefined, undefined, { configPath });

    await request(app).put('/api/config').send({ widthCm: 20, heightCm: 15, dpi: 150 });
    const before = fs.readFileSync(configPath, 'utf8');

    const res = await request(app).put('/api/config').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(fs.readFileSync(configPath, 'utf8')).toBe(before);
  });

  test('PUT /api/config accepts a decimal centimeter geometry', async () => {
    const app = createApp(undefined, undefined, { configPath });

    const res = await request(app).put('/api/config').send({ widthCm: 10.16, heightCm: 7.62, dpi: 100 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ widthCm: 10.16, heightCm: 7.62, dpi: 100 });
  });
});
