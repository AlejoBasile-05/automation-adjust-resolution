const CM_PER_INCH = 2.54;

function cmToPx(cm, dpi) {
  return Math.round((Number(cm) / CM_PER_INCH) * Number(dpi));
}

function pxToCm(px, dpi) {
  return Number(((Number(px) * CM_PER_INCH) / Number(dpi)).toFixed(2));
}

module.exports = { CM_PER_INCH, cmToPx, pxToCm };
