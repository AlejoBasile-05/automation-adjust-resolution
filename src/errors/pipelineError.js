const { ERROR_CODES } = require('./errorTypes');

const STAGES = Object.freeze({
  DISCOVER: 'discover',
  RESIZE: 'resize',
  WRITE: 'write',
});

/**
 * A per-file failure with enough structure for the frontend to display it.
 *
 * `toJSON()` is the single serialization format shared by the WebSocket
 * payload and the HTTP errors endpoint.
 */
class PipelineError extends Error {
  constructor({ code, file, stage, message, cause } = {}) {
    super(message);
    this.name = 'PipelineError';
    this.code = code;
    this.file = file;
    this.stage = stage;
    this.timestamp = new Date().toISOString();
    if (cause !== undefined) this.cause = cause;
  }

  toJSON() {
    return {
      code: this.code,
      file: this.file,
      stage: this.stage,
      message: this.message,
      timestamp: this.timestamp,
    };
  }
}

function corruptFile(file, message, cause) {
  return new PipelineError({
    code: ERROR_CODES.CORRUPT_FILE,
    file,
    stage: STAGES.RESIZE,
    message,
    cause,
  });
}

function unsupportedFormat(file, message, cause) {
  return new PipelineError({
    code: ERROR_CODES.UNSUPPORTED_FORMAT,
    file,
    stage: STAGES.RESIZE,
    message,
    cause,
  });
}

function resizeFailed(file, message, cause) {
  return new PipelineError({
    code: ERROR_CODES.RESIZE_FAILED,
    file,
    stage: STAGES.RESIZE,
    message,
    cause,
  });
}

function writeFailed(file, message, cause) {
  return new PipelineError({
    code: ERROR_CODES.WRITE_FAILED,
    file,
    stage: STAGES.WRITE,
    message,
    cause,
  });
}

function sourceNotFound(file, message, cause) {
  return new PipelineError({
    code: ERROR_CODES.SOURCE_NOT_FOUND,
    file,
    stage: STAGES.DISCOVER,
    message,
    cause,
  });
}

function destinationNotFound(file, message, cause) {
  return new PipelineError({
    code: ERROR_CODES.DESTINATION_NOT_FOUND,
    file,
    stage: STAGES.WRITE,
    message,
    cause,
  });
}

module.exports = {
  PipelineError,
  corruptFile,
  unsupportedFormat,
  resizeFailed,
  writeFailed,
  sourceNotFound,
  destinationNotFound,
};
