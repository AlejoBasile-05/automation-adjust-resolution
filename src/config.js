const fs = require('fs/promises');
const path = require('path');

const DEFAULT_CONFIG = {
  sourcePath: '',
  destPath: '',
  width: 800,
  height: 600,
  fit: 'inside',
  quality: 80,
  format: 'jpeg',
};

async function loadConfig(configPath) {
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (error) {
    if (error.code === 'ENOENT') return { ...DEFAULT_CONFIG };
    throw error;
  }
}

async function saveConfig(configPath, config) {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

module.exports = { loadConfig, saveConfig, DEFAULT_CONFIG };
