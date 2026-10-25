const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const request = require('supertest');

const { createApp } = require('../src/app');

const { discover } = require('../src/pipeline/discover');
const { resize } = require('../src/pipeline/resize');
const { outputPathFor, writeOutput } = require('../src/pipeline/writer');
const { createPipeline } = require('../src/pipeline/orchestrator');
const { loadConfig, saveConfig, DEFAULT_CONFIG } = require('../src/config');

let tmpRoot;

async function writeImage(filePath, { width = 40, height = 20 } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const ext = path.extname(filePath).toLowerCase();
  const pipeline = sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } },
  });
  if (ext === '.png') await pipeline.png().toFile(filePath);
  else if (ext === '.webp') await pipeline.webp().toFile(filePath);
  else if (ext === '.gif') await pipeline.gif().toFile(filePath);
  else if (ext === '.tiff') await pipeline.tiff().toFile(filePath);
  else await pipeline.jpeg().toFile(filePath);
}

function writeText(filePath, content = 'not an image') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'resizer-discover-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('S1 — discover: recursive image scan', () => {
  test('finds supported images recursively and ignores non-image files', async () => {
    await writeImage(path.join(tmpRoot, 'a.jpg'));
    await writeImage(path.join(tmpRoot, 'b.png'));
    await writeImage(path.join(tmpRoot, 'nested', 'c.webp'));
    await writeImage(path.join(tmpRoot, 'nested', 'deeper', 'd.jpeg'));
    writeText(path.join(tmpRoot, 'notes.txt'));
    writeText(path.join(tmpRoot, 'nested', 'data.json'));

    const found = (await discover(tmpRoot)).map((p) => path.relative(tmpRoot, p)).sort();

    expect(found).toEqual([
      'a.jpg',
      'b.png',
      path.join('nested', 'c.webp'),
      path.join('nested', 'deeper', 'd.jpeg'),
    ]);
  });

  test('skips dot-prefixed hidden files and hidden directories', async () => {
    await writeImage(path.join(tmpRoot, 'visible.png'));
    await writeImage(path.join(tmpRoot, '.hidden.jpg'));
    await writeImage(path.join(tmpRoot, '.secret', 'inside.png'));

    const found = (await discover(tmpRoot)).map((p) => path.relative(tmpRoot, p));

    expect(found).toEqual(['visible.png']);
  });

  test('returns an empty list when the source folder has no supported images', async () => {
    writeText(path.join(tmpRoot, 'readme.md'));
    writeText(path.join(tmpRoot, 'archive.zip'));

    expect(await discover(tmpRoot)).toEqual([]);
  });
});

describe('S2 — resize: resolution adjustment', () => {
  test("default 'inside' mode fits within bounds and preserves aspect ratio", async () => {
    const source = path.join(tmpRoot, 'wide.png');
    await writeImage(source, { width: 200, height: 100 });

    const output = await resize(source, { width: 100, height: 100, fit: 'inside' });
    const meta = await sharp(output).metadata();

    expect(meta.width).toBe(100);
    expect(meta.height).toBe(50);
  });

  test("defaults to 'inside' when fit is omitted", async () => {
    const source = path.join(tmpRoot, 'wide.png');
    await writeImage(source, { width: 200, height: 100 });

    const output = await resize(source, { width: 100, height: 100 });
    const meta = await sharp(output).metadata();

    expect(meta.width).toBe(100);
    expect(meta.height).toBe(50);
  });

  test("'fill' mode stretches to the exact target dimensions", async () => {
    const source = path.join(tmpRoot, 'wide.png');
    await writeImage(source, { width: 200, height: 100 });

    const output = await resize(source, { width: 60, height: 80, fit: 'fill' });
    const meta = await sharp(output).metadata();

    expect(meta.width).toBe(60);
    expect(meta.height).toBe(80);
  });

  test('applies the requested output format and quality', async () => {
    const source = path.join(tmpRoot, 'wide.png');
    await writeImage(source, { width: 200, height: 100 });

    const output = await resize(source, {
      width: 50,
      height: 50,
      fit: 'inside',
      format: 'webp',
      quality: 70,
    });
    const meta = await sharp(output).metadata();

    expect(meta.format).toBe('webp');
  });

  test('writes the specified DPI to output image metadata', async () => {
    const source = path.join(tmpRoot, 'dpi-test.jpg');
    await writeImage(source, { width: 200, height: 100 });

    const output = await resize(source, {
      width: 100,
      height: 100,
      fit: 'inside',
      dpi: 300,
    });
    const meta = await sharp(output).metadata();

    expect(meta.density).toBe(300);
  });

  test('defaults to 72 DPI when no DPI is specified', async () => {
    const source = path.join(tmpRoot, 'dpi-default.jpg');
    await writeImage(source, { width: 200, height: 100 });

    const output = await resize(source, {
      width: 100,
      height: 100,
      fit: 'inside',
    });
    const meta = await sharp(output).metadata();

    // Sharp defaults to 72 DPI when density is not explicitly set
    expect(meta.density).toBe(72);
  });
});

describe('S3 — writer: output persistence', () => {
  test('preserves the source base filename and extension in the destination', () => {
    const dest = path.join(tmpRoot, 'out');
    expect(outputPathFor(path.join(tmpRoot, 'sub', 'photo.PNG'), dest)).toBe(
      path.join(dest, 'photo.PNG')
    );
  });

  test('creates the destination folder automatically and writes the resized file', async () => {
    const source = path.join(tmpRoot, 'pic.png');
    await writeImage(source, { width: 200, height: 100 });
    const dest = path.join(tmpRoot, 'out', 'nested');

    const buffer = await resize(source, { width: 50, height: 50, fit: 'inside' });
    await writeOutput(outputPathFor(source, dest), buffer);

    const written = path.join(dest, 'pic.png');
    expect(fs.existsSync(written)).toBe(true);
    const meta = await sharp(written).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(25);
  });

  test('overwrites an existing destination file', async () => {
    const source = path.join(tmpRoot, 'pic.png');
    await writeImage(source, { width: 200, height: 100 });
    const dest = path.join(tmpRoot, 'out');
    const target = outputPathFor(source, dest);
    await writeOutput(target, Buffer.from('stale'));

    const buffer = await resize(source, { width: 80, height: 80, fit: 'inside' });
    await writeOutput(target, buffer);

    const meta = await sharp(target).metadata();
    expect(meta.width).toBe(80);
    expect(meta.height).toBe(40);
  });
});

describe('T1.4 — orchestrator: discover → resize → write pipeline', () => {
  test("emits 'progress' per file and 'done' with an accurate summary", async () => {
    const sourcePath = path.join(tmpRoot, 'src');
    const destPath = path.join(tmpRoot, 'dest');
    await writeImage(path.join(sourcePath, 'one.png'), { width: 100, height: 50 });
    await writeImage(path.join(sourcePath, 'two.jpg'), { width: 100, height: 50 });

    const pipeline = createPipeline({
      sourcePath,
      destPath,
      widthCm: 1.02,
      heightCm: 1.02,
      dpi: 100,
      fit: 'inside',
    });
    const progress = [];
    let done;
    pipeline.on('progress', (event) => progress.push(event));
    pipeline.on('done', (summary) => {
      done = summary;
    });

    const summary = await pipeline.run();

    expect(progress).toHaveLength(2);
    expect(progress[0]).toMatchObject({ processed: 1, total: 2 });
    expect(progress[1]).toMatchObject({ processed: 2, total: 2 });
    expect(summary).toEqual({ total: 2, processed: 2, errors: [] });
    expect(done).toEqual(summary);

    const written = await sharp(path.join(destPath, 'one.png')).metadata();
    expect(written.width).toBe(40);
    expect(written.height).toBe(20);
  });

  test("emits 'error' for a corrupt image without stopping the batch", async () => {
    const sourcePath = path.join(tmpRoot, 'src');
    const destPath = path.join(tmpRoot, 'dest');
    await writeImage(path.join(sourcePath, 'good.png'), { width: 100, height: 50 });
    writeText(path.join(sourcePath, 'broken.png'), 'this is not a real image');

    const pipeline = createPipeline({
      sourcePath,
      destPath,
      widthCm: 0.76,
      heightCm: 0.76,
      dpi: 100,
      fit: 'inside',
    });
    const errors = [];
    pipeline.on('error', (event) => errors.push(event));

    const summary = await pipeline.run();

    expect(errors).toHaveLength(1);
    expect(errors[0].file).toContain('broken.png');
    expect(summary.processed).toBe(1);
    expect(summary.total).toBe(2);
    expect(summary.errors).toHaveLength(1);
    expect(fs.existsSync(path.join(destPath, 'good.png'))).toBe(true);
  });

  test('preserves specified DPI through the full pipeline', async () => {
    const sourcePath = path.join(tmpRoot, 'src');
    const destPath = path.join(tmpRoot, 'dest');
    // Square image so inside fit produces exact target dimensions
    await writeImage(path.join(sourcePath, 'test.jpg'), { width: 200, height: 200 });

    const pipeline = createPipeline({
      sourcePath,
      destPath,
      widthCm: 2.54, // 1 inch at 300 DPI = 300px
      heightCm: 2.54,
      dpi: 300,
      fit: 'inside',
    });

    await pipeline.run();

    const written = await sharp(path.join(destPath, 'test.jpg')).metadata();
    expect(written.width).toBe(300);
    expect(written.height).toBe(300);
    expect(written.density).toBe(300);
  });
});

describe('config — JSON persistence', () => {
  test('returns defaults when no config file exists', async () => {
    const configPath = path.join(tmpRoot, 'config.json');
    expect(await loadConfig(configPath)).toEqual(DEFAULT_CONFIG);
  });

  test('saves and loads configuration round-trip', async () => {
    const configPath = path.join(tmpRoot, 'nested', 'config.json');
    const config = {
      schemaVersion: 2,
      sourcePath: '/in',
      destPath: '/out',
      widthCm: 10,
      heightCm: 7.5,
      dpi: 300,
      fit: 'fill',
      quality: 80,
      format: 'webp',
    };

    await saveConfig(configPath, config);

    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toEqual(config);
    expect(await loadConfig(configPath)).toEqual(config);
  });

  test('merges partial stored config over defaults', async () => {
    const configPath = path.join(tmpRoot, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ schemaVersion: 2, widthCm: 320 }));

    const loaded = await loadConfig(configPath);

    expect(loaded.widthCm).toBe(320);
    expect(loaded.heightCm).toBe(DEFAULT_CONFIG.heightCm);
    expect(loaded.fit).toBe(DEFAULT_CONFIG.fit);
  });
});

describe('T1.5 — POST /api/process', () => {
  test('runs the pipeline and returns 200 with a summary of processed files', async () => {
    const sourcePath = path.join(tmpRoot, 'src');
    const destPath = path.join(tmpRoot, 'dest');
    await writeImage(path.join(sourcePath, 'a.png'), { width: 100, height: 50 });
    await writeImage(path.join(sourcePath, 'b.jpg'), { width: 100, height: 50 });

    const app = createApp();
    const response = await request(app)
      .post('/api/process')
      .send({ sourcePath, destPath, widthCm: 1.02, heightCm: 1.02, dpi: 100, fit: 'inside' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ total: 2, processed: 2, errors: [] });

    const written = await sharp(path.join(destPath, 'a.png')).metadata();
    expect(written.width).toBe(40);
    expect(written.height).toBe(20);
  });

  test('returns 500 with an error message when the source folder is missing', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/process')
      .send({ sourcePath: path.join(tmpRoot, 'does-not-exist'), destPath: tmpRoot });

    expect(response.status).toBe(500);
    expect(typeof response.body.error).toBe('string');
  });
});
