const POSITIVE_INTEGER = /^\d+$/;
const POSITIVE_INTEGER_MESSAGES = {
  width: 'El ancho debe ser un número entero positivo.',
  height: 'El alto debe ser un número entero positivo.',
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

  if (isBlank(values.sourcePath)) errors.sourcePath = 'La carpeta de origen es obligatoria.';
  if (isBlank(values.destPath)) errors.destPath = 'La carpeta de destino es obligatoria.';
  if (!isPositiveInteger(values.width)) errors.width = POSITIVE_INTEGER_MESSAGES.width;
  if (!isPositiveInteger(values.height)) errors.height = POSITIVE_INTEGER_MESSAGES.height;
  if (!isQuality(values.quality)) {
    errors.quality = 'La calidad debe ser un número entero entre 1 y 100.';
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
