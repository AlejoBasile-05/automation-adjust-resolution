const sharp = require('sharp');
const { detectFaces, dispose: disposeFaceDetector } = require('./faceDetector');
const { calculateFaceCrop, getAttentionPosition } = require('./cropCalculator');

/**
 * Smart Crop Orchestrator - Hybrid face detection + attention fallback
 * 
 * Flow:
 * 1. If disabled → return 'center' (legacy behavior)
 * 2. If no crop needed (same aspect ratio) → return 'center'
 * 3. Try face detection (BlazeFace)
 * 4. If faces found → calculate custom crop region
 * 5. If no faces or detection fails → fallback to Sharp 'attention'
 * 6. Return crop config for Sharp pipeline
 */

/**
 * Analyzes an image and returns the optimal crop configuration for Sharp
 * @param {string} imagePath - Path to the image file
 * @param {number} targetWidth - Target output width
 * @param {number} targetHeight - Target output height
 * @param {Object} options - { enabled: boolean, mode: 'face-attention' }
 * @returns {Promise<Object>} Crop config: { position, crop?, facesDetected, error? }
 */
async function analyzeSmartCrop(imagePath, targetWidth, targetHeight, options = {}) {
  const { enabled = true, mode = 'face-attention' } = options;

  if (!enabled) {
    return { position: 'center', facesDetected: 0 };
  }

  // Get image metadata to check if crop is needed
  let metadata;
  try {
    metadata = await sharp(imagePath).metadata();
  } catch (error) {
    console.warn(`[smartCrop] Failed to read image metadata: ${error.message}`);
    return { position: 'center', facesDetected: 0, error: error.message };
  }

  const { width: imageWidth, height: imageHeight } = metadata;

  // Check if crop is actually needed (different aspect ratio)
  const sourceAspect = imageWidth / imageHeight;
  const targetAspect = targetWidth / targetHeight;
  const aspectDiff = Math.abs(sourceAspect - targetAspect) / targetAspect;

  // If aspect ratios are very close (< 1% difference), no crop needed
  if (aspectDiff < 0.01) {
    return { position: 'center', facesDetected: 0 };
  }

  try {
    // 1. Try face detection
    const faces = await detectFaces(imagePath);

    if (faces.length > 0) {
      // 2. Calculate custom crop centered on faces
      const crop = calculateFaceCrop(faces, imageWidth, imageHeight, targetWidth, targetHeight);

      if (crop) {
        return {
          position: 'custom',
          crop, // { left, top, width, height }
          facesDetected: faces.length
        };
      }
    }

    // 3. Fallback: Sharp attention (no faces found)
    return {
      position: getAttentionPosition(),
      facesDetected: 0
    };

  } catch (error) {
    // Error in face detection → silent fallback to attention
    console.warn(`[smartCrop] Face detection failed, falling back to attention: ${error.message}`);
    return {
      position: getAttentionPosition(),
      facesDetected: 0,
      error: error.message
    };
  }
}

/**
 * Applies the crop result to a Sharp pipeline
 * @param {sharp.Sharp} pipeline - Sharp pipeline instance
 * @param {Object} cropResult - Result from analyzeSmartCrop
 * @returns {sharp.Sharp} Modified pipeline
 */
function applySmartCrop(pipeline, cropResult) {
  if (!cropResult || cropResult.position === 'center') {
    return pipeline; // No modification needed
  }

  if (cropResult.position === 'custom' && cropResult.crop) {
    // Custom crop calculated from face detection
    // Apply extract BEFORE the final resize
    return pipeline.extract(cropResult.crop);
  }

  // For 'attention' and other Sharp position strings,
  // the position is passed to .resize() not applied here
  return pipeline;
}

/**
 * Determines the position parameter to pass to Sharp's resize()
 * @param {Object} cropResult - Result from analyzeSmartCrop
 * @returns {string|Object} Position for Sharp resize
 */
function getResizePosition(cropResult) {
  if (!cropResult || cropResult.position === 'center') {
    return 'center';
  }

  if (cropResult.position === 'custom') {
    // We already applied extract(), so resize should center
    return 'center';
  }

  // 'attention' or other Sharp position strings
  return cropResult.position;
}

/**
 * Cleans up resources (model, tensors)
 * @returns {Promise<void>}
 */
async function dispose() {
  await disposeFaceDetector();
}

module.exports = { 
  analyzeSmartCrop, 
  applySmartCrop, 
  getResizePosition, 
  dispose 
};