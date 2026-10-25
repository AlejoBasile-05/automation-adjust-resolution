const sharp = require('sharp');

const QUALITY_FORMATS = new Set(['jpeg', 'jpg', 'webp', 'avif', 'heif']);

function resize(sourcePath, { width, height, fit = 'inside', quality, format, dpi } = {}) {
  let pipeline = sharp(sourcePath).resize({ width, height, fit });

  if (format) {
    const encoding = QUALITY_FORMATS.has(format) && quality ? { quality } : {};
    pipeline = pipeline.toFormat(format, encoding);
  }

  if (dpi) {
    pipeline = pipeline.withMetadata({ density: dpi });
  }

  return pipeline.toBuffer();
}

module.exports = { resize };
