const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const request = require('supertest');

const { createApp } = require('../src/app');
const { start } = require('../src/server');

const INDEX_HTML = '<!doctype html><html><body><div id="root">SPA_MARKER</div></body></html>';
const APP_JS = 'console.log("asset-marker");';

function get(port, route) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: route }, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      })
      .on('error', reject);
  });
}

describe('createApp({ staticDir }) (S2)', () => {
  let staticDir;

  beforeAll(() => {
    staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resizer-static-'));
    fs.mkdirSync(path.join(staticDir, 'assets'));
    fs.writeFileSync(path.join(staticDir, 'index.html'), INDEX_HTML);
    fs.writeFileSync(path.join(staticDir, 'assets', 'app.js'), APP_JS);
  });

  afterAll(() => {
    fs.rmSync(staticDir, { recursive: true, force: true });
  });

  test('serves index.html for GET /', async () => {
    const app = createApp(undefined, undefined, { staticDir });

    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('SPA_MARKER');
  });

  test('serves static assets from the build directory', async () => {
    const app = createApp(undefined, undefined, { staticDir });

    const res = await request(app).get('/assets/app.js');

    expect(res.status).toBe(200);
    expect(res.text).toContain('asset-marker');
  });

  test('does not shadow GET /api/config when staticDir is set', async () => {
    const app = createApp(undefined, undefined, { staticDir });

    const res = await request(app).get('/api/config');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toHaveProperty('widthCm');
    expect(res.text).not.toContain('SPA_MARKER');
  });

  test('falls back to index.html for an unknown GET route', async () => {
    const app = createApp(undefined, undefined, { staticDir });

    const res = await request(app).get('/no-such-route');

    expect(res.status).toBe(200);
    expect(res.text).toContain('SPA_MARKER');
  });

  test('does not fall back to index.html for POST', async () => {
    const app = createApp(undefined, undefined, { staticDir });

    const res = await request(app).post('/no-such-route');

    expect(res.status).toBe(404);
    expect(res.text).not.toContain('SPA_MARKER');
  });

  test('without staticDir nothing is served from disk and GET / keeps its 404', async () => {
    const app = createApp();

    const res = await request(app).get('/');

    expect(res.status).toBe(404);
    expect(res.text).not.toContain('SPA_MARKER');
  });
});

describe('start({ staticDir, pickFolder }) (S3)', () => {
  let scratch;
  let staticDir;
  let httpServer;

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'resizer-start-options-'));
    staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resizer-start-static-'));
    fs.writeFileSync(path.join(staticDir, 'index.html'), INDEX_HTML);
  });

  afterEach(async () => {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
      httpServer = null;
    }
    fs.rmSync(scratch, { recursive: true, force: true });
    fs.rmSync(staticDir, { recursive: true, force: true });
  });

  test('forwards staticDir and pickFolder to createApp', async () => {
    const pickFolder = jest.fn().mockResolvedValue({ path: '/picked/dir' });

    httpServer = await start({
      port: 0,
      configPath: path.join(scratch, 'config.json'),
      staticDir,
      pickFolder,
    });
    const { port } = httpServer.address();

    const pick = await get(port, '/api/pick-folder');
    expect(pick.status).toBe(200);
    expect(JSON.parse(pick.body)).toEqual({ path: '/picked/dir' });
    expect(pickFolder).toHaveBeenCalledWith({ initialPath: '' });

    const root = await get(port, '/');
    expect(root.status).toBe(200);
    expect(root.body).toContain('SPA_MARKER');
  });
});
