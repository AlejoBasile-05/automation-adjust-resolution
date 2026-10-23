const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const { CONFIG_PATH, resolveConfigPath, start } = require('../src/server');

function sendJson(port, method, route, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path: route,
        headers: payload
          ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('resolveConfigPath (S1)', () => {
  test('joins config.json into an explicit user data directory', () => {
    expect(resolveConfigPath('/var/appdata')).toBe('/var/appdata/config.json');
  });

  test('falls back to the backwards-compatible CONFIG_PATH', () => {
    expect(resolveConfigPath()).toBe(CONFIG_PATH);
  });

  test('keeps CONFIG_PATH exported', () => {
    expect(typeof CONFIG_PATH).toBe('string');
    expect(CONFIG_PATH.endsWith('config.json')).toBe(true);
  });
});

describe('start({ configPath }) (S1)', () => {
  let scratch;
  let httpServer;

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'resizer-config-path-'));
  });

  afterEach(async () => {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
      httpServer = null;
    }
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  test('writes only to the given config path and creates nothing in process.cwd()', async () => {
    const configPath = path.join(scratch, 'custom.json');
    const cwdBefore = fs.readdirSync(process.cwd()).sort();

    httpServer = await start({ port: 0, configPath });
    const { port } = httpServer.address();
    const response = await sendJson(port, 'PUT', '/api/config', { widthCm: 12 });

    expect(response.status).toBe(200);
    expect(fs.existsSync(configPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toMatchObject({ widthCm: 12 });
    expect(fs.readdirSync(process.cwd()).sort()).toEqual(cwdBefore);
  });
});
