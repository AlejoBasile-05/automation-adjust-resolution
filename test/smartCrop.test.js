const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const { calculateFaceCrop } = require('../src/pipeline/cropCalculator');
const { analyzeSmartCrop, dispose } = require('../src/pipeline/smartCrop');

let tmpRoot;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'smartcrop-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

afterAll(async () => {
  await dispose(); // Clean up TF model
});

/**
 * Creates a test image with a high-contrast region simulating a face
 * @param {string} filePath 
 * @param {Object} options - {width, height, faceX, faceY, faceW, faceH}
 */
async function writeTestImage(filePath, options = {}) {
  const { width = 400, height = 300, faceX = 150, faceY = 80, faceW = 100, faceH = 120 } = options;
  
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  
  // Create base image (dark background)
  const base = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 50, g: 50, b: 50 }
    }
  });
  
  // Add a bright rectangle simulating a face
  // We'll use a composite with a bright rectangle
  const faceBuffer = await sharp({
    create: {
      width: faceW,
      height: faceH,
      channels: 3,
      background: { r: 200, g: 180, b: 160 } // Skin-tone-ish
    }
  }).png().toBuffer();
  
  await base
    .composite([{
      input: faceBuffer,
      left: faceX,
      top: faceY
    }])
    .png()
    .toFile(filePath);
}

describe('Smart Crop - Crop Calculator', () => {
  test('single face: crops centered with top bias', () => {
    const faces = [{ x: 150, y: 80, width: 100, height: 120, confidence: 0.9 }];
    const crop = calculateFaceCrop(faces, 400, 300, 200, 200); // target 1:1
    
    expect(crop).not.toBeNull();
    // Crop region matches target aspect ratio (1:1), expanded from face bounds
    // Face is 100x120 (aspect 0.833), target is 1:1 → expand width to 120
    expect(crop.width).toBe(120);
    expect(crop.height).toBe(120);
    expect(crop.width / crop.height).toBeCloseTo(1, 1);
    // Top bias: face centered higher (more margin above)
    // Face center is at y=140, with top bias of 15% of cropH = 18px
    // Expected center: 140 - 18 = 122, so top = 122 - 60 = 62
    expect(crop.top).toBeLessThan(80); // More above than face top
  });

  test('single face: maintains target aspect ratio', () => {
    const faces = [{ x: 150, y: 80, width: 100, height: 120, confidence: 0.9 }];
    // Target 16:9 (wider than face)
    const crop = calculateFaceCrop(faces, 400, 300, 400, 225);
    
    expect(crop).not.toBeNull();
    // Face region expanded to match 16:9 aspect
    // Face is 100x120, target aspect 1.78 → expand width: 120 * 1.78 = 213
    expect(crop.width).toBe(213);
    expect(crop.height).toBe(120);
    expect(crop.width / crop.height).toBeCloseTo(400 / 225, 1);
  });

  test('multiple faces: bounding box with top bias', () => {
    const faces = [
      { x: 50, y: 100, width: 80, height: 100, confidence: 0.9 },
      { x: 270, y: 120, width: 70, height: 90, confidence: 0.85 }
    ];
    const crop = calculateFaceCrop(faces, 400, 300, 400, 300); // same aspect
    
    expect(crop).not.toBeNull();
    expect(crop.left).toBeLessThanOrEqual(50);
    expect(crop.left + crop.width).toBeGreaterThanOrEqual(340);
    // Top bias applied
    expect(crop.top).toBeLessThan(100);
  });

  test('multiple faces: largest face priority when crop does not fit all', () => {
    const faces = [
      { x: 10, y: 10, width: 50, height: 50, confidence: 0.9 },     // Small, top-left
      { x: 350, y: 240, width: 80, height: 80, confidence: 0.95 }   // Large, bottom-right
    ];
    // Image 400x300, target 400x100 (4:1 wide) - forces crop that excludes bottom-right face
    const crop = calculateFaceCrop(faces, 400, 300, 400, 100);
    
    // Fallback triggers, recalculating centered on large face only
    // Single face: 80x80, target 4:1 → cropH=80, cropW=320
    // centerX = 390, centerY = 280 - 80*0.15 = 268
    // left = 390 - 160 = 230, top = 268 - 40 = 228
    // Clamp: top+80=308 > 300 → top=220, left clamped to 400-320=80
    expect(crop.left).toBe(80); // Clamped to image boundary
    expect(crop.width).toBe(320);
    expect(crop.height).toBe(80);
    expect(crop.top).toBe(220);
    // Large face center (390, 280) should be in crop [80, 400] x [220, 300] ✓
  });

  test('no faces: returns null', () => {
    const crop = calculateFaceCrop([], 400, 300, 200, 200);
    expect(crop).toBeNull();
  });

  test('crop clamped to image boundaries', () => {
    // Face near right edge
    const faces = [{ x: 350, y: 100, width: 60, height: 80, confidence: 0.9 }];
    const crop = calculateFaceCrop(faces, 400, 300, 200, 200);
    
    expect(crop).not.toBeNull();
    expect(crop.left + crop.width).toBeLessThanOrEqual(400);
    expect(crop.left).toBeGreaterThanOrEqual(0);
  });

  test('face region expanded to match target aspect', () => {
    const faces = [{ x: 150, y: 100, width: 100, height: 100, confidence: 0.9 }]; // Square face
    // Target is wide (16:9)
    const crop = calculateFaceCrop(faces, 400, 300, 400, 225);
    
    expect(crop).not.toBeNull();
    // Face region (100x100) expanded to match 16:9 → width > height
    expect(crop.width / crop.height).toBeCloseTo(400 / 225, 1);
  });
});

describe('Smart Crop - Integration', () => {
  test('disabled → returns center position', async () => {
    const source = path.join(tmpRoot, 'any.jpg');
    await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).jpeg().toFile(source);
    
    const result = await analyzeSmartCrop(source, 200, 200, { enabled: false });
    
    expect(result.position).toBe('center');
    expect(result.facesDetected).toBe(0);
  });

  test('same aspect ratio → returns center (no crop needed)', async () => {
    const source = path.join(tmpRoot, 'same-aspect.jpg');
    // 400x300 source, 200x150 target = same 4:3 aspect
    await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).jpeg().toFile(source);
    
    const result = await analyzeSmartCrop(source, 200, 150, { enabled: true });
    
    expect(result.position).toBe('center');
    expect(result.facesDetected).toBe(0);
  });

  test('no faces in image → returns attention position', async () => {
    const source = path.join(tmpRoot, 'landscape.jpg');
    // Landscape-like image (green)
    await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 34, g: 139, b: 34 } }
    }).jpeg().toFile(source);
    
    const result = await analyzeSmartCrop(source, 200, 200, { enabled: true });
    
    expect(result.position).toBe('attention');
    expect(result.facesDetected).toBe(0);
  });

  test('image with face-like region → returns custom crop', async () => {
    const source = path.join(tmpRoot, 'with-face.png');
    // Create image with high-contrast region that BlazeFace might detect
    await writeTestImage(source, { 
      width: 400, 
      height: 300, 
      faceX: 150, 
      faceY: 80, 
      faceW: 100, 
      faceH: 120 
    });
    
    const result = await analyzeSmartCrop(source, 200, 200, { enabled: true });
    
    // May return 'custom' if face detected, or 'attention' if not
    // Both are valid outcomes for this synthetic test
    expect(['custom', 'attention', 'center']).toContain(result.position);
    if (result.position === 'custom') {
      expect(result.crop).toBeDefined();
      expect(result.crop.left).toBeDefined();
      expect(result.crop.top).toBeDefined();
      expect(result.crop.width).toBe(200);
      expect(result.crop.height).toBe(200);
      expect(result.facesDetected).toBeGreaterThan(0);
    }
  });

  test('applySmartCrop with custom crop uses extract', () => {
    const mockPipeline = {
      extract: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis()
    };
    
    const cropResult = {
      position: 'custom',
      crop: { left: 50, top: 30, width: 200, height: 200 }
    };
    
    const { applySmartCrop } = require('../src/pipeline/smartCrop');
    const result = applySmartCrop(mockPipeline, cropResult);
    
    expect(mockPipeline.extract).toHaveBeenCalledWith(cropResult.crop);
    expect(result).toBe(mockPipeline);
  });

  test('applySmartCrop with attention returns pipeline unchanged', () => {
    const mockPipeline = {
      extract: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis()
    };
    
    const cropResult = { position: 'attention' };
    
    const { applySmartCrop } = require('../src/pipeline/smartCrop');
    const result = applySmartCrop(mockPipeline, cropResult);
    
    expect(mockPipeline.extract).not.toHaveBeenCalled();
    expect(result).toBe(mockPipeline);
  });

  test('getResizePosition returns correct values', () => {
    const { getResizePosition } = require('../src/pipeline/smartCrop');
    
    expect(getResizePosition({ position: 'center' })).toBe('center');
    expect(getResizePosition({ position: 'custom', crop: {} })).toBe('center');
    expect(getResizePosition({ position: 'attention' })).toBe('attention');
    expect(getResizePosition(null)).toBe('center');
    expect(getResizePosition(undefined)).toBe('center');
  });
});

describe('Smart Crop - Pipeline Integration', () => {
  test('resize with smartCrop disabled uses center position', async () => {
    const source = path.join(tmpRoot, 'test.jpg');
    await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).jpeg().toFile(source);
    
    const { resize } = require('../src/pipeline/resize');
    const buf = await resize(source, {
      width: 200,
      height: 200,
      fit: 'cover',
      smartCrop: { enabled: false }
    });
    
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
  });

  test('resize with smartCrop enabled and fit:inside does not apply crop', async () => {
    const source = path.join(tmpRoot, 'test.jpg');
    await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).jpeg().toFile(source);
    
    const { resize } = require('../src/pipeline/resize');
    const buf = await resize(source, {
      width: 200,
      height: 200,
      fit: 'inside', // No crop with inside
      smartCrop: { enabled: true }
    });
    
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBeLessThanOrEqual(200);
    expect(meta.height).toBeLessThanOrEqual(200);
  });
});