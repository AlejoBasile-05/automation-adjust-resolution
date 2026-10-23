const fs = require('fs');
const fsPromises = require('fs/promises');
const os = require('os');
const path = require('path');

const { DEFAULT_CONFIG, loadConfig, migrateConfig, saveConfig } = require('../src/config');

describe('config schema v2 migration (S4)', () => {
  let scratch;
  let configPath;

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'resizer-migration-'));
    configPath = path.join(scratch, 'config.json');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  test('DEFAULT_CONFIG is schema v2 expressed in centimeters', () => {
    expect(DEFAULT_CONFIG).toMatchObject({
      schemaVersion: 2,
      widthCm: 10,
      heightCm: 7.5,
      dpi: 300,
    });
    expect(DEFAULT_CONFIG).not.toHaveProperty('width');
    expect(DEFAULT_CONFIG).not.toHaveProperty('height');
  });

  describe('migrateConfig — pure conversion', () => {
    test('leaves an already-v2 config merged over defaults and reports no migration', () => {
      const { config, migrated } = migrateConfig({ schemaVersion: 2, widthCm: 20, dpi: 150 });

      expect(migrated).toBe(false);
      expect(config).toMatchObject({ widthCm: 20, heightCm: 7.5, dpi: 150, schemaVersion: 2 });
    });

    test('converts legacy pixels to centimeters at 300 DPI', () => {
      const { config, migrated } = migrateConfig({ width: 800, height: 600 });

      expect(migrated).toBe(true);
      expect(config).toMatchObject({
        schemaVersion: 2,
        widthCm: 6.77,
        heightCm: 5.08,
        dpi: 300,
      });
      expect(config).not.toHaveProperty('width');
      expect(config).not.toHaveProperty('height');
    });

    test('uses the legacy pixel defaults when dimensions are missing', () => {
      const { config } = migrateConfig({});

      expect(config).toMatchObject({ widthCm: 6.77, heightCm: 5.08, dpi: 300 });
    });

    test('never reinterprets a legacy pixel value as centimeters', () => {
      const { config } = migrateConfig({ width: 10, height: 10 });

      expect(config.widthCm).toBe(0.08);
      expect(config.heightCm).toBe(0.08);
    });

    test('preserves unrelated legacy settings while migrating', () => {
      const { config } = migrateConfig({
        width: 800,
        height: 600,
        sourcePath: '/in',
        destPath: '/out',
        fit: 'fill',
        quality: 55,
        format: 'webp',
      });

      expect(config).toMatchObject({
        sourcePath: '/in',
        destPath: '/out',
        fit: 'fill',
        quality: 55,
        format: 'webp',
      });
    });
  });

  describe('loadConfig — safe migration on read', () => {
    test('returns defaults and creates no file when the config is absent', async () => {
      const loaded = await loadConfig(configPath);

      expect(loaded).toEqual(DEFAULT_CONFIG);
      expect(fs.existsSync(configPath)).toBe(false);
    });

    test('migrates a legacy file and writes it back as schema v2', async () => {
      fs.writeFileSync(configPath, JSON.stringify({ width: 800, height: 600 }));

      const loaded = await loadConfig(configPath);

      expect(loaded).toMatchObject({ schemaVersion: 2, widthCm: 6.77, heightCm: 5.08, dpi: 300 });

      const onDisk = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(onDisk).toMatchObject({
        schemaVersion: 2,
        widthCm: 6.77,
        heightCm: 5.08,
        dpi: 300,
      });
      expect(onDisk).not.toHaveProperty('width');
      expect(onDisk).not.toHaveProperty('height');
    });

    test('does not rewrite an already-v2 config', async () => {
      const original = JSON.stringify(
        {
          schemaVersion: 2,
          sourcePath: '/in',
          destPath: '/out',
          widthCm: 20,
          heightCm: 15,
          dpi: 200,
          fit: 'inside',
          quality: 80,
          format: 'jpeg',
        },
        null,
        2
      );
      fs.writeFileSync(configPath, original);

      const loaded = await loadConfig(configPath);

      expect(loaded).toMatchObject({ widthCm: 20, heightCm: 15, dpi: 200 });
      expect(fs.readFileSync(configPath, 'utf8')).toBe(original);
    });

    test('still returns the migrated config when the write-back fails', async () => {
      fs.writeFileSync(configPath, JSON.stringify({ width: 800, height: 600 }));
      jest.spyOn(fsPromises, 'writeFile').mockRejectedValueOnce(new Error('disk full'));

      const loaded = await loadConfig(configPath);

      expect(loaded).toMatchObject({ schemaVersion: 2, widthCm: 6.77, heightCm: 5.08, dpi: 300 });
    });
  });

  test('saveConfig always persists schemaVersion 2', async () => {
    await saveConfig(configPath, { sourcePath: '/in', widthCm: 10, heightCm: 7.5, dpi: 300 });

    const onDisk = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(onDisk.schemaVersion).toBe(2);
  });
});
