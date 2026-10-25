const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-wasm');
const blazeface = require('@tensorflow-models/blazeface');
const fs = require('fs');

// Try to load tfjs-node (optional dependency for Node.js decodeImage)
let tfnode = null;
try {
  tfnode = require('@tensorflow/tfjs-node');
} catch (e) {
  console.warn('[faceDetector] tfjs-node not available, face detection will use WASM-only mode (no decodeImage)');
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
  // Try tensorflow backend first (needed for decodeImage), fallback to WASM
  const backends = tfnode ? ['tensorflow', 'wasm'] : ['wasm'];
  
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
    if (typeof imageSource === 'string') {
      // File path
      const imageBuffer = fs.readFileSync(imageSource);
      if (tf.node && tf.node.decodeImage) {
        inputTensor = tf.node.decodeImage(imageBuffer, 3);
      } else {
        // Fallback: use tf.io.decodeJpeg/tf.io.decodePng or load via browser-style
        // For now, throw a clear error if tfjs-node not available
        throw new Error('tfjs-node required for file path input. Provide Buffer/Uint8Array/tensor instead.');
      }
      shouldDispose = true;
    } else if (Buffer.isBuffer(imageSource)) {
      // Buffer
      if (tf.node && tf.node.decodeImage) {
        inputTensor = tf.node.decodeImage(imageSource, 3);
      } else {
        throw new Error('tfjs-node required for Buffer input. Provide Uint8Array/tensor instead.');
      }
      shouldDispose = true;
    } else if (imageSource instanceof Uint8Array) {
      // Uint8Array
      if (tf.node && tf.node.decodeImage) {
        inputTensor = tf.node.decodeImage(Buffer.from(imageSource), 3);
      } else {
        throw new Error('tfjs-node required for Uint8Array input. Provide tensor instead.');
      }
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