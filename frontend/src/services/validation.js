const DIMENSION_MESSAGES = {
  widthCm: 'El ancho debe ser un número mayor que 0.',
  heightCm: 'El alto debe ser un número mayor que 0.',
};
const DPI_MESSAGE = 'La resolución debe ser un número entero entre 1 y 1200.';
const MAX_DIMENSION_CM = 1000;

function isBlank(value) {
  return typeof value !== 'string' || value.trim().length === 0;
}

function toNumber(value) {
  return typeof value === 'string' ? Number(value.trim()) : value;
}

function isPositiveDimension(value) {
  const numeric = toNumber(value);
  return Number.isFinite(numeric) && numeric > 0 && numeric <= MAX_DIMENSION_CM;
}

function isQuality(value) {
  const numeric = toNumber(value);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 100;
}

function isDpi(value) {
  const numeric = toNumber(value);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 1200;
}

export function validateConfig(values) {
  const errors = {};

  if (isBlank(values.sourcePath)) errors.sourcePath = 'La carpeta de origen es obligatoria.';
  if (isBlank(values.destPath)) errors.destPath = 'La carpeta de destino es obligatoria.';
  if (!isPositiveDimension(values.widthCm)) errors.widthCm = DIMENSION_MESSAGES.widthCm;
  if (!isPositiveDimension(values.heightCm)) errors.heightCm = DIMENSION_MESSAGES.heightCm;
  if (!isDpi(values.dpi)) errors.dpi = DPI_MESSAGE;
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
    widthCm: Number(values.widthCm),
    heightCm: Number(values.heightCm),
    dpi: Number(values.dpi),
    quality: Number(values.quality),
    // smartCrop is now auto-computed by backend based on fit === 'cover'
    // Keep for backward compatibility with persisted configs
    smartCrop: values.smartCrop ? {
      enabled: Boolean(values.smartCrop.enabled),
      mode: values.smartCrop.mode || 'face-attention'
    } : { enabled: false, mode: 'face-attention' }
  };
}