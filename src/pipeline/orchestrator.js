const { EventEmitter } = require('events');
const path = require('path');

const { discover, SUPPORTED_EXTENSIONS } = require('./discover');
const { resize } = require('./resize');
const { cmToPx } = require('../units/cm');
const { outputPathFor, writeOutput } = require('./writer');
const {
  PipelineError,
  corruptFile,
  unsupportedFormat,
  resizeFailed,
  writeFailed,
  sourceNotFound,
  destinationNotFound,
} = require('../errors/pipelineError');

const UNREADABLE_IMAGE_PATTERN =
  /unsupported image format|corrupt header|premature end of|invalid input/i;

function hasSupportedExtension(file) {
  return SUPPORTED_EXTENSIONS.has(path.extname(file).toLowerCase());
}

/**
 * Translate a Sharp/fs failure into the pipeline error catalog.
 *
 * A supported extension whose bytes cannot be decoded is a corrupt file; an
 * undecodable file with an unsupported extension is an unsupported format.
 */
function classifyResizeError(file, cause) {
  if (cause instanceof PipelineError) return cause;

  if (cause.code === 'ENOENT') {
    return sourceNotFound(file, `Source file not found: ${file}`, cause);
  }

  if (UNREADABLE_IMAGE_PATTERN.test(cause.message)) {
    return hasSupportedExtension(file)
      ? corruptFile(file, cause.message, cause)
      : unsupportedFormat(file, cause.message, cause);
  }

  return resizeFailed(file, cause.message, cause);
}

function classifyWriteError(file, cause) {
  if (cause instanceof PipelineError) return cause;

  if (cause.code === 'ENOENT') {
    return destinationNotFound(file, `Destination folder not found for ${file}`, cause);
  }

  return writeFailed(file, cause.message, cause);
}

async function resizeStep(file, config) {
  try {
    return await resize(file, config);
  } catch (cause) {
    throw classifyResizeError(file, cause);
  }
}

async function writeStep(file, config, buffer) {
  try {
    await writeOutput(outputPathFor(file, config.destPath), buffer);
  } catch (cause) {
    throw classifyWriteError(file, cause);
  }
}

async function discoverFiles(config) {
  try {
    return await discover(config.sourcePath);
  } catch (cause) {
    if (cause instanceof PipelineError) throw cause;
    if (cause.code === 'ENOENT') {
      throw sourceNotFound(
        config.sourcePath,
        `Source folder not found: ${config.sourcePath}`,
        cause
      );
    }
    throw cause;
  }
}

/**
 * Translate the persisted centimeter geometry into the pixel dimensions the
 * pure resize function expects. Direct pixel configs keep working so callers
 * that already speak pixels are unaffected.
 */
function resolveGeometry(config) {
  if (config.widthCm != null && config.heightCm != null) {
    return {
      width: cmToPx(config.widthCm, config.dpi),
      height: cmToPx(config.heightCm, config.dpi),
    };
  }

  return { width: config.width, height: config.height };
}

function createPipeline(config) {
  const emitter = new EventEmitter();
  // Keep per-file failures from crashing the process when no observer is attached.
  emitter.on('error', () => {});

  const processFile = async (file, summary, runConfig) => {
    try {
      const buffer = await resizeStep(file, runConfig);
      await writeStep(file, runConfig, buffer);
      summary.processed += 1;
      emitter.emit('progress', {
        file,
        processed: summary.processed,
        total: summary.total,
      });
    } catch (cause) {
      const error =
        cause instanceof PipelineError
          ? cause
          : resizeFailed(file, cause.message, cause);
      summary.errors.push(error.toJSON());
      emitter.emit('error', { file, error });
    }
  };

  emitter.run = async () => {
    const files = await discoverFiles(config);
    const runConfig = { ...config, ...resolveGeometry(config) };
    const summary = { total: files.length, processed: 0, errors: [] };

    for (const file of files) {
      await processFile(file, summary, runConfig);
    }

    emitter.emit('done', summary);
    return summary;
  };

  return emitter;
}

module.exports = { createPipeline };
