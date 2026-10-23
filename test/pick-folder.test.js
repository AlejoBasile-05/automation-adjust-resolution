const request = require('supertest');

const { createApp } = require('../src/app');
const { createPickerError, pickFolder } = require('../src/folders/pickFolder');

function execError(overrides = {}) {
  return Object.assign(new Error('Command failed'), overrides);
}

function fakeRun() {
  return jest.fn();
}

describe('pickFolder (S5)', () => {
  test('linux returns the trimmed selected path', async () => {
    const run = fakeRun().mockResolvedValue({ stdout: '  /home/me/photos\n', stderr: '' });

    await expect(pickFolder({ run, platform: 'linux' })).resolves.toEqual({
      path: '/home/me/photos',
    });
    expect(run).toHaveBeenCalledWith('zenity', expect.any(Array), expect.any(Object));
  });

  test('linux passes the base zenity arguments without an initial path', async () => {
    const run = fakeRun().mockResolvedValue({ stdout: '/picked', stderr: '' });

    await pickFolder({ run, platform: 'linux' });

    const [, args] = run.mock.calls[0];
    expect(args).toEqual(['--file-selection', '--directory', '--title=Elegir carpeta']);
  });

  test('linux passes --filename=<initial>/ only when an initial path is set', async () => {
    const run = fakeRun().mockResolvedValue({ stdout: '/picked', stderr: '' });

    await pickFolder({ run, platform: 'linux', initialPath: '/home/me/photos' });

    const [, args] = run.mock.calls[0];
    expect(args).toEqual([
      '--file-selection',
      '--directory',
      '--title=Elegir carpeta',
      '--filename=/home/me/photos/',
    ]);
  });

  test('passes arguments as an array so spaces and shell metacharacters stay inert', async () => {
    const run = fakeRun().mockResolvedValue({ stdout: '/picked', stderr: '' });
    const initialPath = '/tmp/my photos; rm -rf /';

    await pickFolder({ run, platform: 'linux', initialPath });

    const [file, args, options] = run.mock.calls[0];
    expect(file).toBe('zenity');
    expect(Array.isArray(args)).toBe(true);
    expect(args).toContain(`--filename=${initialPath}/`);
    expect(args.filter((arg) => arg === `--filename=${initialPath}/`)).toHaveLength(1);
    expect(typeof options).toBe('object');
  });

  test('applies a five minute timeout with SIGTERM and a 1 MB buffer', async () => {
    const run = fakeRun().mockResolvedValue({ stdout: '/picked', stderr: '' });

    await pickFolder({ run, platform: 'linux' });

    const [, , options] = run.mock.calls[0];
    expect(options).toMatchObject({
      timeout: 300000,
      killSignal: 'SIGTERM',
      maxBuffer: 1024 * 1024,
    });
  });

  test('treats zenity exit code 1 as a cancelled dialog', async () => {
    const run = fakeRun().mockRejectedValue(execError({ code: 1, stderr: '' }));

    await expect(pickFolder({ run, platform: 'linux' })).resolves.toEqual({ canceled: true });
  });

  test('treats osascript exit code 1 with -128 as a cancelled dialog', async () => {
    const run = fakeRun().mockRejectedValue(execError({ code: 1, stderr: 'execution error: User canceled. (-128)' }));

    await expect(pickFolder({ run, platform: 'darwin' })).resolves.toEqual({ canceled: true });
  });

  test('darwin uses osascript with a fixed argument list', async () => {
    const run = fakeRun().mockResolvedValue({ stdout: '/Users/me/Photos\n', stderr: '' });

    await expect(pickFolder({ run, platform: 'darwin' })).resolves.toEqual({
      path: '/Users/me/Photos',
    });
    const [file, args] = run.mock.calls[0];
    expect(file).toBe('osascript');
    expect(args).toEqual(['-e', 'POSIX path of (choose folder with prompt "Elegir carpeta")']);
  });

  test('win32 uses powershell with the folder browser script', async () => {
    const run = fakeRun().mockResolvedValue({ stdout: 'C:\\Photos\r\n', stderr: '' });

    await expect(pickFolder({ run, platform: 'win32' })).resolves.toEqual({
      path: 'C:\\Photos',
    });
    const [file, args] = run.mock.calls[0];
    expect(file).toBe('powershell');
    expect(args[0]).toBe('-NoProfile');
    expect(args[1]).toBe('-Command');
    expect(args[2]).toMatch(/FolderBrowserDialog/);
  });

  test('throws an UNSUPPORTED error when the binary is missing', async () => {
    const run = fakeRun().mockRejectedValue(execError({ code: 'ENOENT', stderr: '' }));

    await expect(pickFolder({ run, platform: 'linux' })).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
  });

  test('throws a TIMEOUT error when the dialog outlives the timeout', async () => {
    const run = fakeRun().mockRejectedValue(
      execError({ code: null, killed: true, signal: 'SIGTERM', stderr: '' })
    );

    await expect(pickFolder({ run, platform: 'linux' })).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  test('rethrows unexpected failures with their original message', async () => {
    const run = fakeRun().mockRejectedValue(execError({ code: 2, stderr: 'boom' }));

    await expect(pickFolder({ run, platform: 'linux' })).rejects.toThrow('Command failed');
  });

  test('createPickerError carries the requested code and message', () => {
    const error = createPickerError('TIMEOUT', 'Dialog timed out');

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('TIMEOUT');
    expect(error.message).toBe('Dialog timed out');
  });
});

describe('GET /api/pick-folder (S5)', () => {
  test('returns 200 with the chosen path and forwards the initial path', async () => {
    const pick = jest.fn().mockResolvedValue({ path: '/picked/dir' });
    const app = createApp(undefined, undefined, { pickFolder: pick });

    const res = await request(app).get('/api/pick-folder').query({ initial: '/start/here' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ path: '/picked/dir' });
    expect(pick).toHaveBeenCalledWith({ initialPath: '/start/here' });
  });

  test('returns 200 with canceled when the dialog is dismissed', async () => {
    const pick = jest.fn().mockResolvedValue({ canceled: true });
    const app = createApp(undefined, undefined, { pickFolder: pick });

    const res = await request(app).get('/api/pick-folder');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ canceled: true });
    expect(pick).toHaveBeenCalledWith({ initialPath: '' });
  });

  test('returns 501 when the platform has no supported dialog', async () => {
    const pick = jest.fn().mockRejectedValue(createPickerError('UNSUPPORTED', 'missing binary'));
    const app = createApp(undefined, undefined, { pickFolder: pick });

    const res = await request(app).get('/api/pick-folder');

    expect(res.status).toBe(501);
    expect(res.body).toEqual({
      error: 'El selector de carpetas no está disponible en este sistema.',
    });
  });

  test('returns 408 when the dialog times out', async () => {
    const pick = jest.fn().mockRejectedValue(createPickerError('TIMEOUT', 'slow dialog'));
    const app = createApp(undefined, undefined, { pickFolder: pick });

    const res = await request(app).get('/api/pick-folder');

    expect(res.status).toBe(408);
    expect(res.body).toEqual({ error: 'El selector de carpetas no respondió a tiempo.' });
  });

  test('returns 500 with the original message for other failures', async () => {
    const pick = jest.fn().mockRejectedValue(new Error('zenity blew up'));
    const app = createApp(undefined, undefined, { pickFolder: pick });

    const res = await request(app).get('/api/pick-folder');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'zenity blew up' });
  });
});
