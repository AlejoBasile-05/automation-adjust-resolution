import { describe, expect, it } from 'vitest';

import { CM_PER_INCH, cmToPx, pxToCm } from '../src/services/units.js';

// These reference values mirror test/cm-units.test.js so the backend and
// frontend implementations cannot drift apart.
describe('frontend cm/px conversion units (S2, S3)', () => {
  it('CM_PER_INCH is the exact imperial conversion factor', () => {
    expect(CM_PER_INCH).toBe(2.54);
  });

  it('cmToPx converts centimeters to pixels at the given DPI', () => {
    expect(cmToPx(10, 300)).toBe(1181);
    expect(cmToPx(7.5, 300)).toBe(886);
    expect(cmToPx(10.16, 100)).toBe(400);
    expect(cmToPx(7.62, 100)).toBe(300);
  });

  it('cmToPx rounds to the nearest whole pixel', () => {
    expect(cmToPx(2.54, 100)).toBe(100);
    expect(cmToPx(1, 96)).toBe(38);
    expect(cmToPx(0.1, 300)).toBe(12);
  });

  it('pxToCm converts pixels back to centimeters rounded to two decimals', () => {
    expect(pxToCm(800, 300)).toBe(6.77);
    expect(pxToCm(600, 300)).toBe(5.08);
    expect(pxToCm(400, 100)).toBe(10.16);
    expect(pxToCm(300, 100)).toBe(7.62);
  });
});
