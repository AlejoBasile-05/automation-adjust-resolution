/**
 * Catalog of per-file pipeline error codes.
 *
 * Each code maps to a stage where the failure happened, so the frontend can
 * render a typed indicator instead of parsing free-form messages.
 */
const ERROR_CODES = Object.freeze({
  CORRUPT_FILE: 'CORRUPT_FILE',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  RESIZE_FAILED: 'RESIZE_FAILED',
  WRITE_FAILED: 'WRITE_FAILED',
  SOURCE_NOT_FOUND: 'SOURCE_NOT_FOUND',
  DESTINATION_NOT_FOUND: 'DESTINATION_NOT_FOUND',
});

module.exports = { ERROR_CODES };
