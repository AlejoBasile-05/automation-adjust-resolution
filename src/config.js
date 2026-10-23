const fs = require('fs/promises');
const path = require('path');

const { pxToCm } = require('./units/cm');

const LEGACY_DPI = 300;
const LEGACY_DEFAULT_PIXELS = { width: 800, height: 600 };

const DEFAULT_CONFIG = {
  schemaVersion: 2,
  sourcePath: '',
  destPath: '',
  widthCm: 10,
  heightCm: 7.5,
  dpi: 300,
  fit: 'inside',
  quality: 80,
  format: 'jpeg',
};

/**
 * Normalize a persisted config to schema v2.
 *
 * A config without `schemaVersion: 2` is a legacy pixel config and its
 * `width`/`height` are converted at 300 DPI. A legacy value is never
 * reinterpreted as centimeters.
 */
function migrateConfig(raw = {}) {
  if (raw.schemaVersion === 2) {
    return { config: { ...DEFAULT_CONFIG, ...raw }, migrated: false };
  }

  const { width, height, ...rest } = raw;

  return {
    config: {
      ...DEFAULT_CONFIG,
      ...rest,
      widthCm: pxToCm(width ?? LEGACY_DEFAULT_PIXELS.width, LEGACY_DPI),
      heightCm: pxToCm(height ?? LEGACY_DEFAULT_PIXELS.height, LEGACY_DPI),
      dpi: LEGACY_DPI,
      schemaVersion: 2,
    },
    migrated: true,
  };
}

async function readRawConfig(configPath) {
  try {
    return JSON.parse(await fs.readFile(configPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function loadConfig(configPath) {
  const raw = await readRawConfig(configPath);
  if (raw === null) return { ...DEFAULT_CONFIG };

  const { config, migrated } = migrateConfig(raw);
  if (migrated) {
    try {
      await saveConfig(configPath, config);
    } catch {
      // Reading must not fail when the migration write-back fails.
    }
  }

  return config;
}

async function saveConfig(configPath, config) {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify({ ...config, schemaVersion: 2 }, null, 2));
}

module.exports = { loadConfig, saveConfig, migrateConfig, DEFAULT_CONFIG };
