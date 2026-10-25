const tf = require('@tensorflow/tfjs');
const tfnode = require('@tensorflow/tfjs-node');
require('@tensorflow/tfjs-backend-wasm');
const blazeface = require('@tensorflow-models/blazeface');
const fs = require('fs');

// Ensure tf.node namespace is available (tfjs-node adds it)
if (!tf.node) {
  tf.node = tfnode.node;
}

let model = null;
let modelLoading = null;

/**
 * Initialize TensorFlow.js with WASM backend
 */
async function initTF() {
  // Use tensorflow backend for Node.js operations (decodeImage)
  await tf.setBackend('tensorflow');
  await tf.ready();
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
      inputTensor = tf.node.decodeImage(imageBuffer, 3);
      shouldDispose = true;
    } else if (Buffer.isBuffer(imageSource)) {
      // Buffer
      inputTensor = tf.node.decodeImage(imageSource, 3);
      shouldDispose = true;
    } else if (imageSource instanceof Uint8Array) {
      // Uint8Array
      inputTensor = tf.node.decodeImage(Buffer.from(imageSource), 3);
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