const POSITIVE_INTEGER = /^\d+$/;
const POSITIVE_INTEGER_MESSAGES = {
  width: 'Width must be a positive whole number.',
  height: 'Height must be a positive whole number.',
};

function isBlank(value) {
  return typeof value !== 'string' || value.trim().length === 0;
}

function isPositiveInteger(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return POSITIVE_INTEGER.test(trimmed) && Number(trimmed) > 0;
}

function isQuality(value) {
  const numeric = typeof value === 'string' ? Number(value.trim()) : value;
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 100;
}

export function validateConfig(values) {
  const errors = {};

  if (isBlank(values.sourcePath)) errors.sourcePath = 'Source folder is required.';
  if (isBlank(values.destPath)) errors.destPath = 'Destination folder is required.';
  if (!isPositiveInteger(values.width)) errors.width = POSITIVE_INTEGER_MESSAGES.width;
  if (!isPositiveInteger(values.height)) errors.height = POSITIVE_INTEGER_MESSAGES.height;
  if (!isQuality(values.quality)) {
    errors.quality = 'Quality must be a whole number between 1 and 100.';
  }

  return errors;
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

export function normalizeConfig(values) {
  return {
    ...values,
    sourcePath: values.sourcePath.trim(),
    destPath: values.destPath.trim(),
    width: Number(values.width),
    height: Number(values.height),
    quality: Number(values.quality),
  };
}
