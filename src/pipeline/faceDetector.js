const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-wasm');
const blazeface = require('@tensorflow-models/blazeface');
const fs = require('fs');
const sharp = require('sharp');

// Try to load tfjs-node (optional dependency for Node.js decodeImage)
let tfnode = null;
try {
  tfnode = require('@tensorflow/tfjs-node');
} catch (e) {
  console.warn('[faceDetector] tfjs-node not available, will use Sharp for image decoding + WASM backend');
}

// Ensure tf.node namespace is available (tfjs-node adds it)
if (!tf.node && tfnode) {
  tf.node = tfnode.node;
}

let model = null;
let modelLoading = null;

/**
 * Initialize TensorFlow.js with WASM backend
 */
async function initTF() {
  // Always prefer WASM backend for consistency across platforms
  // tfjs-node (tensorflow backend) is optional and may not work in all environments
  const backends = ['wasm'];
  
  for (const backend of backends) {
    try {
      await tf.setBackend(backend);
      await tf.ready();
      console.log(`[faceDetector] Using backend: ${backend}`);
      return;
    } catch (e) {
      console.warn(`[faceDetector] Backend ${backend} failed: ${e.message}`);
    }
  }
  
  throw new Error('No suitable TensorFlow.js backend available');
}

/**
 * Gets the BlazeFace model (singleton, lazy loading)
 * @returns {Promise<blazeface.BlazeFaceModel>}
 */
async function getModel() {
  if (model) return model;

  if (!modelLoading) {
    modelLoading = (async () => {
      await initTF();
      model = await blazeface.load();
      return model;
    })();
  }

  return modelLoading;
}

/**
 * Decodes an image using Sharp (works without tfjs-node) and returns a tf.Tensor
 * @param {string|Buffer|Uint8Array} imageSource - File path, Buffer, or Uint8Array
 * @returns {Promise<tf.Tensor>} Decoded image tensor [H, W, 3]
 */
async function decodeImageWithSharp(imageSource) {
  let imageBuffer;
  
  if (typeof imageSource === 'string') {
    imageBuffer = fs.readFileSync(imageSource);
  } else if (Buffer.isBuffer(imageSource)) {
    imageBuffer = imageSource;
  } else if (imageSource instanceof Uint8Array) {
    imageBuffer = Buffer.from(imageSource);
  } else {
    throw new Error('Unsupported image source type for Sharp decode. Expected string path, Buffer, or Uint8Array');
  }

  // Use Sharp to decode to raw RGB pixels
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  // Create tensor from raw RGB data
  // data is Uint8Array of RGBRGBRGB..., info has width, height, channels
  // BlazeFace expects float32 tensor with values in [0, 255] range
  // Use tf.tensor3d with Float32Array for proper type
  const floatData = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    floatData[i] = data[i];
  }
  const tensor = tf.tensor3d(floatData, [info.height, info.width, info.channels]);
  return tensor;
}

/**
 * Detects faces in an image
 * @param {string|Buffer|Uint8Array|tf.Tensor} imageSource - File path, Buffer, Uint8Array, or tensor
 * @returns {Promise<Array<{x: number, y: number, width: number, height: number, confidence: number, landmarks: Array}>>
 */
async function detectFaces(imageSource) {
  const model = await getModel();

  let inputTensor = null;
  let shouldDispose = false;

  try {
    // Convert input to tensor
    if (typeof imageSource === 'string' || Buffer.isBuffer(imageSource) || imageSource instanceof Uint8Array) {
      // Use Sharp for decoding (works without tfjs-node native)
      // This is the primary path - works on all platforms
      inputTensor = await decodeImageWithSharp(imageSource);
      shouldDispose = true;
    } else if (tf.isTensor(imageSource)) {
      // Already a tensor
      inputTensor = imageSource;
      shouldDispose = false;
    } else {
      throw new Error('Unsupported image source type. Expected string path, Buffer, Uint8Array, or tf.Tensor');
    }

    // Estimate faces
    const predictions = await model.estimateFaces(inputTensor, false);

    // Filter by confidence > 0.7 and format results
    const faces = predictions
      .filter(prediction => prediction.probability[0] > 0.7)
      .map(prediction => {
        const [x1, y1] = prediction.topLeft;
        const [x2, y2] = prediction.bottomRight;
        return {
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1,
          confidence: prediction.probability[0],
          landmarks: prediction.landmarks
        };
      });

    return faces;
  } catch (error) {
    console.error('[faceDetector] Error detecting faces:', error.message);
    throw error;
  } finally {
    if (shouldDispose && inputTensor && inputTensor.dispose) {
      inputTensor.dispose();
    }
  }
}

/**
 * Disposes the model and cleans up resources
 * @returns {Promise<void>}
 */
async function dispose() {
  if (model) {
    await model.dispose();
    model = null;
    modelLoading = null;
  }
}

module.exports = { detectFaces, getModel, dispose, initTF };