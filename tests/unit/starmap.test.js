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

describe('System filtering', () => {
  function isFilteredSystem(name) {
    // Patterns to exclude: V-### (variable stars) and AD### (anomaly detection)
    return /^V-\d{3}$/i.test(name) || /^AD\d{3}$/i.test(name);
  }

  it('should filter V-### pattern systems', () => {
    expect(isFilteredSystem('V-001')).toBe(true);
    expect(isFilteredSystem('V-999')).toBe(true);
    expect(isFilteredSystem('v-123')).toBe(true);
  });

  it('should filter AD### pattern systems', () => {
    expect(isFilteredSystem('AD001')).toBe(true);
    expect(isFilteredSystem('AD999')).toBe(true);
    expect(isFilteredSystem('ad123')).toBe(true);
  });

  it('should not filter normal systems', () => {
    expect(isFilteredSystem('Jita')).toBe(false);
    expect(isFilteredSystem('E3Q-3SC')).toBe(false);
    expect(isFilteredSystem('J100001')).toBe(false);
    expect(isFilteredSystem('V-1234')).toBe(false); // 4 digits, not 3
    expect(isFilteredSystem('AD1234')).toBe(false); // 4 digits, not 3
  });
});

describe('Focus system functionality', () => {
  function findSystemIndex(systemIdOrName, idToName, indexOf) {
    let systemIndex = -1;
    
    // Try as ID first (numeric)
    const asNumber = parseInt(systemIdOrName, 10);
    if (!isNaN(asNumber)) {
      systemIndex = indexOf.get(asNumber);
    }
    
    // Try as name if not found by ID
    if (systemIndex === undefined || systemIndex === -1) {
      const searchName = String(systemIdOrName).toLowerCase();
      for (const [id, name] of Object.entries(idToName)) {
        if (name.toLowerCase() === searchName) {
          systemIndex = indexOf.get(parseInt(id, 10));
          break;
        }
      }
    }
    
    return systemIndex !== undefined ? systemIndex : -1;
  }

  it('should find system by numeric ID', () => {
    const idToName = { '30000142': 'Jita', '30001234': 'TestSystem' };
    const indexOf = new Map([[30000142, 0], [30001234, 1]]);
    
    const index = findSystemIndex('30000142', idToName, indexOf);
    expect(index).toBe(0);
  });

  it('should find system by name (case-insensitive)', () => {
    const idToName = { '30000142': 'Jita', '30001234': 'TestSystem' };
    const indexOf = new Map([[30000142, 0], [30001234, 1]]);
    
    const index1 = findSystemIndex('Jita', idToName, indexOf);
    expect(index1).toBe(0);
    
    const index2 = findSystemIndex('jita', idToName, indexOf);
    expect(index2).toBe(0);
    
    const index3 = findSystemIndex('TESTSYSTEM', idToName, indexOf);
    expect(index3).toBe(1);
  });

  it('should return -1 for non-existent system', () => {
    const idToName = { '30000142': 'Jita' };
    const indexOf = new Map([[30000142, 0]]);
    
    const index = findSystemIndex('NonExistent', idToName, indexOf);
    expect(index).toBe(-1);
  });
});

describe('URL query parameter parsing', () => {
  it('should parse focus parameter from URL', () => {
    const url = new URL('http://localhost:3000/public/?focus=Jita');
    const params = new URLSearchParams(url.search);
    expect(params.get('focus')).toBe('Jita');
  });

  it('should parse debug parameter from URL', () => {
    const url = new URL('http://localhost:3000/public/?debug=true');
    const params = new URLSearchParams(url.search);
    expect(params.get('debug')).toBe('true');
  });

  it('should parse multiple parameters', () => {
    const url = new URL('http://localhost:3000/public/?debug=true&focus=E3Q-3SC');
    const params = new URLSearchParams(url.search);
    expect(params.get('debug')).toBe('true');
    expect(params.get('focus')).toBe('E3Q-3SC');
  });
});

describe('Station system detection', () => {
  it('should detect station systems from Set', () => {
    const stationSystemSet = new Set([30000142, 30001234]);
    
    expect(stationSystemSet.has(30000142)).toBe(true);
    expect(stationSystemSet.has(30001234)).toBe(true);
    expect(stationSystemSet.has(99999999)).toBe(false);
  });

  it('should format station labels with emoji', () => {
    const formatLabel = (name, hasStation) => {
      return hasStation ? `🛰️ ${name}` : name;
    };
    
    expect(formatLabel('Jita', true)).toBe('🛰️ Jita');
    expect(formatLabel('Regular', false)).toBe('Regular');
  });
});

describe('Route bitpacking decoder', () => {
  // Mock BitReader for testing
  class BitReader {
    constructor(buf) {
      this._buf = buf;
      this._i = 0;
      this._cur = 0;
      this._bits = 0;
    }
    
    readBits(bitCount) {
      let v = 0 >>> 0;
      for (let i = 0; i < bitCount; i++) {
        if (this._bits === 0) {
          if (this._i >= this._buf.length) throw new Error('Unexpected EOF');
          this._cur = this._buf[this._i++];
          this._bits = 8;
        }
        const msb = (this._cur & 0x80) ? 1 : 0;
        v = (v << 1) | msb;
        this._cur = (this._cur << 1) & 0xff;
        this._bits--;
      }
      return v >>> 0;
    }
  }
  
  it('should read bits correctly', () => {
    const buf = new Uint8Array([0b10110011, 0b11001010]);
    const br = new BitReader(buf);
    
    expect(br.readBits(4)).toBe(0b1011);
    expect(br.readBits(4)).toBe(0b0011);
    expect(br.readBits(4)).toBe(0b1100);
    expect(br.readBits(4)).toBe(0b1010);
  });
  
  it('should convert base64url to bytes', () => {
    const fromBase64Url = (s) => {
      s = s.replace(/-/g, '+').replace(/_/g, '/');
      const pad = s.length % 4;
      if (pad === 2) s += '==';
      else if (pad === 3) s += '=';
      
      const binaryString = atob(s);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    };
    
    // Test with known base64url string
    const encoded = 'SGVsbG8'; // "Hello" in base64
    const decoded = fromBase64Url(encoded);
    
    expect(decoded[0]).toBe(72);  // 'H'
    expect(decoded[1]).toBe(101); // 'e'
    expect(decoded[2]).toBe(108); // 'l'
    expect(decoded[3]).toBe(108); // 'l'
    expect(decoded[4]).toBe(111); // 'o'
  });
  
  it('should handle base64url with padding', () => {
    const fromBase64Url = (s) => {
      s = s.replace(/-/g, '+').replace(/_/g, '/');
      const pad = s.length % 4;
      if (pad === 2) s += '==';
      else if (pad === 3) s += '=';
      return s;
    };
    
    expect(fromBase64Url('YQ')).toBe('YQ==');
    expect(fromBase64Url('YWI')).toBe('YWI=');
    expect(fromBase64Url('YWJj')).toBe('YWJj');
  });
});
