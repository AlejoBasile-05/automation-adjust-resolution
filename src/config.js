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
  // Smart crop configuration (hybrid face detection + attention fallback)
  smartCrop: {
    enabled: false,        // OFF by default for backward compatibility
    mode: 'face-attention' // Face detection first, then attention fallback
  }
};

const MAX_DIMENSION_CM = 1000;
const MAX_DPI = 1200;

function isNumberInRange(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Reject geometry that would produce nonsensical pixel dimensions.
 * Returns an error message, or `null` when the config is usable.
 */
function validateGeometry(config = {}) {
  if (!isNumberInRange(config.widthCm, Number.MIN_VALUE, MAX_DIMENSION_CM)) {
    return `El ancho debe ser un número mayor que 0 y menor o igual a ${MAX_DIMENSION_CM} cm.`;
  }
  if (!isNumberInRange(config.heightCm, Number.MIN_VALUE, MAX_DIMENSION_CM)) {
    return `El alto debe ser un número mayor que 0 y menor o igual a ${MAX_DIMENSION_CM} cm.`;
  }
  if (!Number.isInteger(config.dpi) || config.dpi < 1 || config.dpi > MAX_DPI) {
    return `La resolución debe ser un número entero entre 1 y ${MAX_DPI}.`;
  }
  
  // Validate smartCrop configuration
  if (config.smartCrop) {
    if (typeof config.smartCrop.enabled !== 'boolean') {
      return 'smartCrop.enabled debe ser true o false.';
    }
    if (config.smartCrop.mode && config.smartCrop.mode !== 'face-attention') {
      return 'smartCrop.mode debe ser "face-attention".';
    }
  }
  
  return null;
}

/**
 * Normalize a persisted config to schema v2.
 */
function migrateConfig(raw = {}) {
  const carriesCentimeters = raw.widthCm != null || raw.heightCm != null;

  if (raw.schemaVersion === 2 || (raw.schemaVersion == null && carriesCentimeters)) {
    const { width, height, ...rest } = raw;
    return {
      config: { ...DEFAULT_CONFIG, ...rest, schemaVersion: 2 },
      migrated: raw.schemaVersion !== 2,
    };
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

module.exports = {
  loadConfig,
  saveConfig,
  migrateConfig,
  validateGeometry,
  DEFAULT_CONFIG,
};