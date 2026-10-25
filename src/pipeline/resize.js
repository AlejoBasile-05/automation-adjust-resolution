const sharp = require('sharp');
const { analyzeSmartCrop, applySmartCrop, getResizePosition } = require('./smartCrop');

const QUALITY_FORMATS = new Set(['jpeg', 'jpg', 'webp', 'avif', 'heif']);

/**
 * Resizes an image with optional smart crop
 * @param {string} sourcePath - Path to source image
 * @param {Object} options - Resize options
 * @param {number} options.width - Target width
 * @param {number} options.height - Target height
 * @param {string} options.fit - Sharp fit mode ('inside', 'cover', 'fill', etc.)
 * @param {number} options.quality - Output quality (1-100)
 * @param {string} options.format - Output format
 * @param {number} options.dpi - DPI metadata
 * @param {Object} options.smartCrop - Smart crop config {enabled, mode}
 * @returns {Promise<Buffer>} Resized image buffer
 */
async function resize(sourcePath, { 
  width, 
  height, 
  fit = 'inside', 
  quality, 
  format, 
  dpi,
  smartCrop 
} = {}) {
  let pipeline = sharp(sourcePath);

  // Smart crop: only applies when fit === 'cover' (actual cropping occurs)
  let cropResult = null;
  let resizePosition = 'center';

  if (smartCrop?.enabled && fit === 'cover') {
    try {
      cropResult = await analyzeSmartCrop(sourcePath, width, height, smartCrop);
      resizePosition = getResizePosition(cropResult);
      
      // Apply custom crop (extract) before final resize if face detection succeeded
      if (cropResult.position === 'custom' && cropResult.crop) {
        pipeline = applySmartCrop(pipeline, cropResult);
      }
    } catch (error) {
      // Silent fallback: if smart crop fails, continue with normal resize
      console.warn(`[resize] Smart crop failed, using center: ${error.message}`);
      resizePosition = 'center';
    }
  }

  // Final resize with appropriate position
  pipeline = pipeline.resize({ 
    width, 
    height, 
    fit,
    position: resizePosition
  });

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