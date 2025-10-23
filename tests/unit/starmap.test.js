/**
 * Unit tests for starmap data loading and geometry creation
 * These tests verify the core data processing logic
 */
import { describe, it, expect } from 'vitest';

describe('Coordinate transformation', () => {
  it('should apply Rx(-90°) transform correctly', () => {
    // Simulating the transform: (x, y, z) -> (x, z, -y)
    const transform = (x, y, z) => {
      return { x: x, y: z, z: -y };
    };

    const result = transform(1, 2, 3);
    expect(result).toEqual({ x: 1, y: 3, z: -2 });
  });

  it('should handle zero coordinates', () => {
    const transform = (x, y, z) => ({ x: x, y: z, z: -y });
    const result = transform(0, 0, 0);
    // Use closeTo for z to handle signed zero (-0 vs +0)
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.z).toBeCloseTo(0);
  });

  it('should handle negative coordinates', () => {
    const transform = (x, y, z) => ({ x: x, y: z, z: -y });
    const result = transform(-5, 10, -3);
    expect(result).toEqual({ x: -5, y: -3, z: -10 });
  });
});

describe('Bounds computation', () => {
  function computeBounds(positions) {
    const b = {
      min: [+Infinity, +Infinity, +Infinity],
      max: [-Infinity, -Infinity, -Infinity]
    };
    
    for (let i = 0; i < positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = positions[i + k];
        if (v < b.min[k]) b.min[k] = v;
        if (v > b.max[k]) b.max[k] = v;
      }
    }
    
    const center = [
      (b.min[0] + b.max[0]) / 2,
      (b.min[1] + b.max[1]) / 2,
      (b.min[2] + b.max[2]) / 2
    ];
    
    const size = [
      b.max[0] - b.min[0],
      b.max[1] - b.min[1],
      b.max[2] - b.min[2]
    ];
    
    const radius = Math.hypot(size[0], size[1], size[2]) * 0.5;
    
    return { bounds: b, center, radius };
  }

  it('should compute bounds for single point', () => {
    const positions = new Float32Array([1, 2, 3]);
    const result = computeBounds(positions);
    
    expect(result.center).toEqual([1, 2, 3]);
    expect(result.radius).toBe(0);
  });

  it('should compute bounds for multiple points', () => {
    const positions = new Float32Array([
      0, 0, 0,
      10, 0, 0,
      0, 10, 0,
      0, 0, 10
    ]);
    
    const result = computeBounds(positions);
    
    expect(result.center).toEqual([5, 5, 5]);
    expect(result.bounds.min).toEqual([0, 0, 0]);
    expect(result.bounds.max).toEqual([10, 10, 10]);
    expect(result.radius).toBeGreaterThan(0);
  });

  it('should handle negative coordinates', () => {
    const positions = new Float32Array([
      -10, -10, -10,
      10, 10, 10
    ]);
    
    const result = computeBounds(positions);
    expect(result.center).toEqual([0, 0, 0]);
  });
});

describe('Binary data parsing', () => {
  it('should parse Float32Array from little-endian buffer', () => {
    // Create a test buffer with known float values
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    
    view.setFloat32(0, 1.5, true);  // little-endian
    view.setFloat32(4, -2.5, true);
    view.setFloat32(8, 3.14, true);
    
    const positions = new Float32Array(buffer);
    
    expect(positions[0]).toBeCloseTo(1.5, 5);
    expect(positions[1]).toBeCloseTo(-2.5, 5);
    expect(positions[2]).toBeCloseTo(3.14, 5);
  });

  it('should parse Uint32Array from little-endian buffer', () => {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    
    view.setUint32(0, 30000001, true);  // little-endian
    view.setUint32(4, 30000002, true);
    view.setUint32(8, 30000003, true);
    
    const ids = new Uint32Array(buffer);
    
    expect(ids[0]).toBe(30000001);
    expect(ids[1]).toBe(30000002);
    expect(ids[2]).toBe(30000003);
  });
});
