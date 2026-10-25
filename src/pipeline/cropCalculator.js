/**
 * Crop Calculator - Calculates optimal crop region for face-aware smart cropping
 * 
 * Features:
 * - Single face: centers crop on face with top bias (15% more margin above)
 * - Multiple faces: bounding box containing all faces with top bias
 * - If crop doesn't fit target aspect, prioritizes largest face
 * - Clamps crop to image boundaries
 */

const TOP_BIAS_RATIO = 0.15; // 15% more margin above than below

/**
 * Calculates optimal crop region based on detected faces
 * @param {Array} faces - Detected faces [{x, y, width, height, confidence, landmarks}]
 * @param {number} imageWidth - Source image width
 * @param {number} imageHeight - Source image height
 * @param {number} targetWidth - Target output width
 * @param {number} targetHeight - Target output height
 * @returns {Object|null} Crop region {left, top, width, height} or null if no faces
 */
function calculateFaceCrop(faces, imageWidth, imageHeight, targetWidth, targetHeight) {
  if (!faces || faces.length === 0) {
    return null; // No faces → fallback to attention
  }

  const targetAspect = targetWidth / targetHeight;

  // Determine the face region to center on
  let faceRegion;

  if (faces.length === 1) {
    // Single face: use its bounds
    const face = faces[0];
    faceRegion = {
      x: face.x,
      y: face.y,
      width: face.width,
      height: face.height,
      centerX: face.x + face.width / 2,
      centerY: face.y + face.height / 2,
      largestFace: face
    };
  } else {
    // Multiple faces: calculate bounding box containing all faces
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let largestFace = faces[0];
    let largestArea = 0;

    for (const face of faces) {
      minX = Math.min(minX, face.x);
      minY = Math.min(minY, face.y);
      maxX = Math.max(maxX, face.x + face.width);
      maxY = Math.max(maxY, face.y + face.height);

      const area = face.width * face.height;
      if (area > largestArea) {
        largestArea = area;
        largestFace = face;
      }
    }

    faceRegion = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      largestFace
    };
  }

  // Expand face region to match target aspect ratio
  let { width: cropW, height: cropH } = faceRegion;
  const cropAspect = cropW / cropH;

  if (cropAspect > targetAspect) {
    // Crop region is wider than target → expand height
    cropH = cropW / targetAspect;
  } else {
    // Crop region is taller than target → expand width
    cropW = cropH * targetAspect;
  }

  // Clamp crop dimensions to image bounds while maintaining target aspect
  let finalCropW = cropW;
  let finalCropH = cropH;

  if (finalCropW > imageWidth) {
    finalCropW = imageWidth;
    finalCropH = finalCropW / targetAspect;
  }
  if (finalCropH > imageHeight) {
    finalCropH = imageHeight;
    finalCropW = finalCropH * targetAspect;
  }
  // If still too large (both dimensions clamped), clamp to the more restrictive
  if (finalCropW > imageWidth) {
    finalCropW = imageWidth;
    finalCropH = finalCropW / targetAspect;
  }
  if (finalCropH > imageHeight) {
    finalCropH = imageHeight;
    finalCropW = finalCropH * targetAspect;
  }

  // Apply top bias: shift center up so there's more margin above the face
  const centerX = faceRegion.centerX;
  const centerY = faceRegion.centerY - (finalCropH * TOP_BIAS_RATIO);

  // Calculate top-left corner
  let left = Math.round(centerX - finalCropW / 2);
  let top = Math.round(centerY - finalCropH / 2);

  // Clamp position to image boundaries
  left = Math.max(0, Math.min(left, imageWidth - finalCropW));
  top = Math.max(0, Math.min(top, imageHeight - finalCropH));

  // Verify the largest face (or only face) is still within the crop
  // If not, recalculate centered on the largest face
  if (faces.length > 1 && faceRegion.largestFace) {
    const lf = faceRegion.largestFace;
    const faceCenterX = lf.x + lf.width / 2;
    const faceCenterY = lf.y + lf.height / 2;

    const faceInCrop = (
      faceCenterX >= left && faceCenterX <= left + finalCropW &&
      faceCenterY >= top && faceCenterY <= top + finalCropH
    );

    if (!faceInCrop) {
      // Recalculate centered on largest face only
      return calculateFaceCrop(
        [faceRegion.largestFace],
        imageWidth,
        imageHeight,
        targetWidth,
        targetHeight
      );
    }
  }

  // Final validation: ensure crop is within bounds and has valid dimensions
  const finalCrop = {
    left: Math.max(0, Math.round(left)),
    top: Math.max(0, Math.round(top)),
    width: Math.min(Math.round(finalCropW), imageWidth),
    height: Math.min(Math.round(finalCropH), imageHeight)
  };

  // Ensure crop doesn't exceed image boundaries
  if (finalCrop.left + finalCrop.width > imageWidth) {
    finalCrop.width = imageWidth - finalCrop.left;
  }
  if (finalCrop.top + finalCrop.height > imageHeight) {
    finalCrop.height = imageHeight - finalCrop.top;
  }

  return finalCrop;
}

/**
 * Returns the Sharp position string for attention-based cropping (fallback)
 * @returns {string} 'attention'
 */
function getAttentionPosition() {
  return 'attention';
}

module.exports = { 
  calculateFaceCrop, 
  getAttentionPosition, 
  TOP_BIAS_RATIO 
};