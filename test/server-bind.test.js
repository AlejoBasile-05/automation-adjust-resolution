const fs = require('fs');
const os = require('os');
const path = require('path');

const { start } = require('../src/server');

describe('server network binding (S7)', () => {
  let scratch;
  let httpServer;

  beforeAll(async () => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'resizer-bind-'));
    httpServer = await start({ port: 0, configPath: path.join(scratch, 'config.json') });
  });

  afterAll(async () => {
    await new Promise((resolve) => httpServer.close(resolve));
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  test('binds to the loopback interface instead of all interfaces', () => {
    const address = httpServer.address();

    expect(address.address).toBe('127.0.0.1');
    expect(address.port).toBeGreaterThan(0);
  });
});
