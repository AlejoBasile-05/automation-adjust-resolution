const fs = require('fs/promises');
const path = require('path');

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.tiff',
  '.gif',
]);

function isHidden(name) {
  return name.startsWith('.');
}

function isSupportedImage(name) {
  return SUPPORTED_EXTENSIONS.has(path.extname(name).toLowerCase());
}

async function discover(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (isHidden(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await discover(fullPath)));
    } else if (entry.isFile() && isSupportedImage(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

module.exports = { discover, SUPPORTED_EXTENSIONS };
