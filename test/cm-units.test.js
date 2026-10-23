const { CM_PER_INCH, cmToPx, pxToCm } = require('../src/units/cm');

describe('cm/px conversion units (S2)', () => {
  test('CM_PER_INCH is the exact imperial conversion factor', () => {
    expect(CM_PER_INCH).toBe(2.54);
  });

  test('cmToPx converts centimeters to pixels at the given DPI', () => {
    expect(cmToPx(10, 300)).toBe(1181);
    expect(cmToPx(7.5, 300)).toBe(886);
    expect(cmToPx(10.16, 100)).toBe(400);
    expect(cmToPx(7.62, 100)).toBe(300);
  });

  test('cmToPx rounds to the nearest whole pixel', () => {
    expect(cmToPx(2.54, 100)).toBe(100);
    expect(cmToPx(1, 96)).toBe(38);
    expect(cmToPx(0.1, 300)).toBe(12);
  });

  test('pxToCm converts pixels back to centimeters rounded to two decimals', () => {
    expect(pxToCm(800, 300)).toBe(6.77);
    expect(pxToCm(600, 300)).toBe(5.08);
    expect(pxToCm(400, 100)).toBe(10.16);
    expect(pxToCm(300, 100)).toBe(7.62);
  });

  test('conversion round-trips the reference dimensions', () => {
    expect(pxToCm(cmToPx(10.16, 100), 100)).toBe(10.16);
    expect(pxToCm(cmToPx(7.62, 100), 100)).toBe(7.62);
  });
});
